import crypto from 'node:crypto';
import { db } from '../db';
import type { PaymentMethod } from '../db/types';
import { accessKeyCheckDigit, onlyDigits, pad } from '../lib/br';
import { badRequest, conflict, notFound } from '../lib/errors';
import { formatDecimal, round2 } from '../lib/money';
import { group, sanitizeText, tag } from './xml';

/** Código IBGE das UFs (cUF da chave de acesso). */
export const UF_CODES: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53',
};

/** Tabela de formas de pagamento da NF-e (tPag). */
const PAYMENT_CODES: Record<PaymentMethod, string> = {
  dinheiro: '01',
  credito: '03',
  debito: '04',
  crediario: '05',
  boleto: '15',
  pix: '17',
  transferencia: '18',
};

export type IssueInvoiceInput = {
  saleId: number;
  /** 55 = NF-e (com destinatário), 65 = NFC-e (consumidor no varejo). */
  model?: '55' | '65';
  operation?: string;
  additionalInfo?: string;
};

function buildAccessKey(params: {
  ufCode: string;
  issuedAt: Date;
  cnpj: string;
  model: string;
  series: number;
  number: number;
  numericCode: string;
}): string {
  const year = String(params.issuedAt.getFullYear()).slice(-2);
  const month = pad(params.issuedAt.getMonth() + 1, 2);
  const base =
    params.ufCode +
    year +
    month +
    pad(params.cnpj, 14) +
    pad(params.model, 2) +
    pad(params.series, 3) +
    pad(params.number, 9) +
    '1' + // tpEmis: emissão normal
    pad(params.numericCode, 8);

  return base + String(accessKeyCheckDigit(base));
}

function formatDateTimeUtcOffset(date: Date): string {
  // Formato exigido: AAAA-MM-DDThh:mm:ssTZD
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offset = `${sign}${pad(Math.floor(abs / 60), 2)}:${pad(abs % 60, 2)}`;
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 19);
  return `${local}${offset}`;
}

/**
 * Emite o documento fiscal de uma venda.
 *
 * Gera a chave de acesso e o XML no layout NF-e 4.00, reserva a numeração e
 * grava o documento com status `gerada`. A assinatura digital (certificado A1)
 * e a transmissão à SEFAZ são feitas pelo transmissor configurado — veja
 * `docs/fiscal.md`.
 */
export async function issueInvoice(input: IssueInvoiceInput, userId: number) {
  const model = input.model ?? '55';

  return db.transaction().execute(async (trx) => {
    const settings = await trx
      .selectFrom('company_settings')
      .selectAll()
      .where('id', '=', 1)
      .forUpdate()
      .executeTakeFirstOrThrow();

    const cnpj = onlyDigits(settings.document);
    if (cnpj.length !== 14) {
      throw badRequest(
        'Configure o CNPJ da loja em Configurações › Dados fiscais antes de emitir notas.',
      );
    }
    if (!settings.city_ibge_code) {
      throw badRequest('Configure o código IBGE do município da loja em Configurações.');
    }

    const sale = await trx
      .selectFrom('sales')
      .selectAll()
      .where('id', '=', input.saleId)
      .executeTakeFirst();

    if (!sale) throw notFound('Venda');
    if (sale.status !== 'confirmada') {
      throw badRequest('Só é possível emitir nota fiscal de vendas confirmadas.');
    }

    const existing = await trx
      .selectFrom('invoices')
      .select(['id', 'number'])
      .where('sale_id', '=', input.saleId)
      .where('status', '!=', 'cancelada')
      .executeTakeFirst();
    if (existing) {
      throw conflict(`Esta venda já possui a nota fiscal nº ${existing.number}.`);
    }

    const items = await trx
      .selectFrom('sale_items')
      .leftJoin('products', 'products.id', 'sale_items.product_id')
      .select([
        'sale_items.id',
        'sale_items.description',
        'sale_items.qty',
        'sale_items.unit_price',
        'sale_items.discount',
        'sale_items.total',
        'products.sku',
        'products.barcode',
        'products.unit',
        'products.ncm',
        'products.cest',
        'products.cfop',
        'products.origin',
        'products.csosn',
        'products.cst_icms',
        'products.icms_rate',
      ])
      .where('sale_items.sale_id', '=', input.saleId)
      .orderBy('sale_items.id')
      .execute();

    if (!items.length) throw badRequest('A venda não possui itens.');

    const payments = await trx
      .selectFrom('sale_payments')
      .selectAll()
      .where('sale_id', '=', input.saleId)
      .execute();

    const customer = sale.customer_id
      ? await trx
          .selectFrom('customers')
          .selectAll()
          .where('id', '=', sale.customer_id)
          .executeTakeFirst()
      : null;

    if (model === '55' && !customer) {
      throw badRequest(
        'A NF-e modelo 55 exige um destinatário. Selecione o cliente na venda ou emita NFC-e (modelo 65).',
      );
    }
    if (model === '55' && customer && onlyDigits(customer.document).length === 0) {
      throw badRequest('Preencha o CPF/CNPJ do cliente antes de emitir a NF-e.');
    }

    const series = model === '55' ? settings.nfe_series : settings.nfce_series;
    const number = model === '55' ? settings.nfe_next_number : settings.nfce_next_number;
    const ufCode = UF_CODES[settings.state] ?? settings.state_ibge_code ?? '35';
    const issuedAt = new Date();
    const numericCode = pad(crypto.randomInt(0, 99_999_999), 8);

    const accessKey = buildAccessKey({
      ufCode,
      issuedAt,
      cnpj,
      model,
      series,
      number,
      numericCode,
    });

    const isInterstate =
      customer && customer.state && customer.state !== settings.state ? '2' : '1';

    // ── ide ────────────────────────────────────────────────────────────────
    const ide = group('ide', [
      tag('cUF', ufCode),
      tag('cNF', numericCode),
      tag('natOp', sanitizeText(input.operation ?? 'Venda de mercadoria')),
      tag('mod', model),
      tag('serie', String(series)),
      tag('nNF', String(number)),
      tag('dhEmi', formatDateTimeUtcOffset(issuedAt)),
      tag('tpNF', '1'),
      tag('idDest', model === '65' ? '1' : isInterstate),
      tag('cMunFG', settings.city_ibge_code),
      tag('tpImp', model === '65' ? '4' : '1'),
      tag('tpEmis', '1'),
      tag('cDV', accessKey.slice(-1)),
      tag('tpAmb', settings.nfe_environment),
      tag('finNFe', '1'),
      tag('indFinal', '1'),
      tag('indPres', '1'),
      tag('procEmi', '0'),
      tag('verProc', 'Vedas CRM 1.0'),
    ]);

    // ── emit ───────────────────────────────────────────────────────────────
    const emit = group('emit', [
      tag('CNPJ', cnpj),
      tag('xNome', sanitizeText(settings.corporate_name)),
      tag('xFant', sanitizeText(settings.trade_name)),
      group('enderEmit', [
        tag('xLgr', sanitizeText(settings.street)),
        tag('nro', sanitizeText(settings.number, 60) || 'S/N'),
        tag('xCpl', sanitizeText(settings.complement)),
        tag('xBairro', sanitizeText(settings.district)),
        tag('cMun', settings.city_ibge_code),
        tag('xMun', sanitizeText(settings.city)),
        tag('UF', settings.state),
        tag('CEP', pad(settings.zip_code, 8)),
        tag('cPais', '1058'),
        tag('xPais', 'BRASIL'),
        tag('fone', onlyDigits(settings.phone)),
      ]),
      tag('IE', onlyDigits(settings.state_registration) || 'ISENTO'),
      tag('CRT', settings.tax_regime),
    ]);

    // ── dest ───────────────────────────────────────────────────────────────
    let dest = '';
    if (customer) {
      const document = onlyDigits(customer.document);
      const hasAddress = Boolean(customer.city_ibge_code && customer.street);
      dest = group('dest', [
        document.length === 14 ? tag('CNPJ', document) : tag('CPF', document),
        tag('xNome', sanitizeText(customer.name)),
        hasAddress
          ? group('enderDest', [
              tag('xLgr', sanitizeText(customer.street)),
              tag('nro', sanitizeText(customer.number, 60) || 'S/N'),
              tag('xCpl', sanitizeText(customer.complement)),
              tag('xBairro', sanitizeText(customer.district)),
              tag('cMun', customer.city_ibge_code),
              tag('xMun', sanitizeText(customer.city)),
              tag('UF', customer.state),
              tag('CEP', pad(customer.zip_code, 8)),
              tag('cPais', '1058'),
              tag('xPais', 'BRASIL'),
              tag('fone', onlyDigits(customer.phone)),
            ])
          : '',
        tag('indIEDest', customer.state_registration ? '1' : '9'),
        customer.state_registration ? tag('IE', onlyDigits(customer.state_registration)) : '',
        tag('email', customer.email),
      ]);
    }

    // ── det ────────────────────────────────────────────────────────────────
    const isSimples = settings.tax_regime === '1' || settings.tax_regime === '2';
    let icmsTotal = 0;

    const det = items
      .map((item, index) => {
        const qty = Number(item.qty);
        const unitPrice = Number(item.unit_price);
        const grossValue = round2(qty * unitPrice);
        const discount = round2(Number(item.discount));
        const icmsRate = Number(item.icms_rate ?? 0);
        const icmsValue = isSimples ? 0 : round2((grossValue - discount) * (icmsRate / 100));
        icmsTotal += icmsValue;

        const barcode = item.barcode && /^\d{8,14}$/.test(item.barcode) ? item.barcode : 'SEM GTIN';

        const prod = group('prod', [
          tag('cProd', sanitizeText(item.sku ?? String(item.id), 60)),
          tag('cEAN', barcode),
          tag('xProd', sanitizeText(item.description, 120)),
          tag('NCM', onlyDigits(item.ncm ?? '') || '23091000'),
          item.cest ? tag('CEST', onlyDigits(item.cest)) : '',
          tag('CFOP', onlyDigits(item.cfop ?? '') || '5102'),
          tag('uCom', sanitizeText(item.unit ?? 'UN', 6)),
          tag('qCom', formatDecimal(qty, 4)),
          tag('vUnCom', formatDecimal(unitPrice, 10)),
          tag('vProd', formatDecimal(grossValue)),
          tag('cEANTrib', barcode),
          tag('uTrib', sanitizeText(item.unit ?? 'UN', 6)),
          tag('qTrib', formatDecimal(qty, 4)),
          tag('vUnTrib', formatDecimal(unitPrice, 10)),
          discount > 0 ? tag('vDesc', formatDecimal(discount)) : '',
          tag('indTot', '1'),
        ]);

        const icms = isSimples
          ? group('ICMSSN102', [
              tag('orig', item.origin ?? '0'),
              tag('CSOSN', item.csosn || '102'),
            ])
          : group('ICMS00', [
              tag('orig', item.origin ?? '0'),
              tag('CST', item.cst_icms || '00'),
              tag('modBC', '3'),
              tag('vBC', formatDecimal(grossValue - discount)),
              tag('pICMS', formatDecimal(icmsRate)),
              tag('vICMS', formatDecimal(icmsValue)),
            ]);

        const imposto = group('imposto', [
          group('ICMS', [icms]),
          group('PIS', [group('PISNT', [tag('CST', '07')])]),
          group('COFINS', [group('COFINSNT', [tag('CST', '07')])]),
        ]);

        return group('det', [prod, imposto], { nItem: String(index + 1) });
      })
      .join('');

    const productsTotal = round2(items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unit_price), 0));
    const itemsDiscount = round2(items.reduce((sum, item) => sum + Number(item.discount), 0));
    const headerDiscount = round2(Number(sale.discount));
    const totalDiscount = round2(itemsDiscount + headerDiscount);
    const freight = round2(Number(sale.freight));
    const invoiceTotal = round2(productsTotal - totalDiscount + freight);

    const total = group('total', [
      group('ICMSTot', [
        tag('vBC', formatDecimal(isSimples ? 0 : productsTotal - totalDiscount)),
        tag('vICMS', formatDecimal(icmsTotal)),
        tag('vICMSDeson', '0.00'),
        tag('vFCP', '0.00'),
        tag('vBCST', '0.00'),
        tag('vST', '0.00'),
        tag('vFCPST', '0.00'),
        tag('vFCPSTRet', '0.00'),
        tag('vProd', formatDecimal(productsTotal)),
        tag('vFrete', formatDecimal(freight)),
        tag('vSeg', '0.00'),
        tag('vDesc', formatDecimal(totalDiscount)),
        tag('vII', '0.00'),
        tag('vIPI', '0.00'),
        tag('vIPIDevol', '0.00'),
        tag('vPIS', '0.00'),
        tag('vCOFINS', '0.00'),
        tag('vOutro', '0.00'),
        tag('vNF', formatDecimal(invoiceTotal)),
      ]),
    ]);

    const transp = group('transp', [tag('modFrete', freight > 0 ? '0' : '9')]);

    const detPag = payments.length
      ? payments
          .map((payment) =>
            group('detPag', [
              tag('indPag', payment.paid ? '0' : '1'),
              tag('tPag', PAYMENT_CODES[payment.method] ?? '99'),
              tag('vPag', formatDecimal(Number(payment.amount))),
            ]),
          )
          .join('')
      : group('detPag', [tag('tPag', '90'), tag('vPag', formatDecimal(invoiceTotal))]);

    const pag = group('pag', [detPag]);

    const complement = [
      input.additionalInfo ?? '',
      sale.notes,
      isSimples
        ? 'Documento emitido por ME ou EPP optante pelo Simples Nacional. Nao gera direito a credito fiscal de ICMS e de ISS.'
        : '',
      settings.nfe_environment === '2'
        ? 'AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
        : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const infAdic = complement ? group('infAdic', [tag('infCpl', sanitizeText(complement, 5000))]) : '';

    const infNFe = group('infNFe', [ide, emit, dest, det, total, transp, pag, infAdic], {
      Id: `NFe${accessKey}`,
      versao: '4.00',
    });

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">${infNFe}</NFe>`;

    const invoice = await trx
      .insertInto('invoices')
      .values({
        sale_id: input.saleId,
        model,
        series,
        number,
        access_key: accessKey,
        environment: settings.nfe_environment,
        status: 'gerada',
        operation: input.operation ?? 'Venda de mercadoria',
        total: invoiceTotal,
        message:
          settings.nfe_environment === '2'
            ? 'Documento gerado em ambiente de homologação (sem valor fiscal).'
            : 'Documento gerado. Assine e transmita à SEFAZ para autorização.',
        xml,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (model === '55') {
      await trx
        .updateTable('company_settings')
        .set({ nfe_next_number: number + 1 })
        .where('id', '=', 1)
        .execute();
    } else {
      await trx
        .updateTable('company_settings')
        .set({ nfce_next_number: number + 1 })
        .where('id', '=', 1)
        .execute();
    }

    return { invoice, userId };
  });
}

/**
 * URL do QR Code da NFC-e (layout 2.00, emissão normal).
 * Depende do CSC (Código de Segurança do Contribuinte) cadastrado na SEFAZ.
 */
export function buildNfceQrCode(params: {
  accessKey: string;
  environment: '1' | '2';
  cscId: string;
  cscToken: string;
  baseUrl: string;
}): string | null {
  if (!params.cscId || !params.cscToken) return null;
  const payload = `${params.accessKey}|2|${params.environment}|${params.cscId}`;
  const hash = crypto
    .createHash('sha1')
    .update(payload + params.cscToken)
    .digest('hex')
    .toUpperCase();
  return `${params.baseUrl}?p=${payload}|${hash}`;
}

export async function cancelInvoice(invoiceId: number, reason: string) {
  if (reason.trim().length < 15) {
    throw badRequest('A justificativa de cancelamento deve ter ao menos 15 caracteres (regra da SEFAZ).');
  }

  const invoice = await db
    .selectFrom('invoices')
    .selectAll()
    .where('id', '=', invoiceId)
    .executeTakeFirst();

  if (!invoice) throw notFound('Nota fiscal');
  if (invoice.status === 'cancelada') throw conflict('Esta nota já está cancelada.');

  return db
    .updateTable('invoices')
    .set({
      status: 'cancelada',
      cancelled_at: new Date(),
      message: `Cancelada: ${reason}`,
    })
    .where('id', '=', invoiceId)
    .returningAll()
    .executeTakeFirstOrThrow();
}
