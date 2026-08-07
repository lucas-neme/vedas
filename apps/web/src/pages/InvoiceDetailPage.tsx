import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBox, InvoiceStatusBadge, Loading, Modal, PAYMENT_LABELS } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import {
  currency,
  date,
  dateTime,
  decimal,
  formatAccessKey,
  formatDocument,
  formatZip,
} from '@/lib/format';
import type { CompanySettings, Invoice, SalePayment } from '@/types';

type InvoiceDetail = {
  invoice: Invoice;
  company: CompanySettings;
  sale: {
    id: number;
    number: number;
    total: number;
    discount: number;
    freight: number;
    items_total: number;
    notes: string;
    sold_at: string;
    customer_id: number | null;
    customer_name: string | null;
    customer_trade_name: string | null;
    customer_document: string | null;
    customer_ie: string | null;
    customer_street: string | null;
    customer_number: string | null;
    customer_district: string | null;
    customer_city: string | null;
    customer_state: string | null;
    customer_zip: string | null;
    customer_phone: string | null;
  } | null;
  items: Array<{
    id: number;
    description: string;
    qty: number;
    unit_price: number;
    discount: number;
    total: number;
    sku: string | null;
    unit: string | null;
    ncm: string | null;
    cfop: string | null;
  }>;
  payments: SalePayment[];
  qrCode: string | null;
};

const TAX_REGIME: Record<string, string> = {
  '1': 'Simples Nacional',
  '2': 'Simples Nacional - excesso de sublimite',
  '3': 'Regime Normal',
};

export function InvoiceDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [xmlOpen, setXmlOpen] = useState(false);

  const detail = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api<InvoiceDetail>(`/invoices/${id}`),
    enabled: Boolean(id),
  });

  const cancel = useMutation({
    mutationFn: () => api(`/invoices/${id}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      toast.success('Nota fiscal cancelada.');
      setCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function downloadXml() {
    if (!detail.data) return;
    const blob = new Blob([detail.data.invoice.xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${detail.data.invoice.access_key}-nfe.xml`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (detail.isLoading) return <Loading />;
  if (detail.error) return <ErrorBox error={detail.error} />;
  if (!detail.data) return null;

  const { invoice, company, sale, items, payments, qrCode } = detail.data;

  return (
    <div className="stack">
      <div className="row between wrap no-print">
        <div className="row">
          <Link to="/notas-fiscais" className="btn ghost sm">
            ← Notas fiscais
          </Link>
          <h1>
            {invoice.model === '55' ? 'NF-e' : 'NFC-e'} nº {invoice.number}
          </h1>
          <InvoiceStatusBadge status={invoice.status} />
          {invoice.environment === '2' ? (
            <span className="badge amber">Homologação · sem valor fiscal</span>
          ) : null}
        </div>
        <div className="row">
          <button type="button" className="btn secondary" onClick={() => setXmlOpen(true)}>
            Ver XML
          </button>
          <button type="button" className="btn secondary" onClick={downloadXml}>
            ⬇ Baixar XML
          </button>
          <button type="button" className="btn secondary" onClick={() => window.print()}>
            🖨 Imprimir DANFE
          </button>
          {invoice.status !== 'cancelada' ? (
            <button type="button" className="btn danger" onClick={() => setCancelOpen(true)}>
              Cancelar NF
            </button>
          ) : null}
        </div>
      </div>

      {invoice.message ? <div className="alert info no-print">{invoice.message}</div> : null}

      <div className="danfe">
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
          <div className="row start" style={{ gap: 12 }}>
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt=""
                style={{ width: 58, height: 58, objectFit: 'contain', flexShrink: 0 }}
              />
            ) : null}
            <div>
            <h2>{company.corporate_name}</h2>
            <div>{company.trade_name}</div>
            <div>
              {company.street}, {company.number} {company.complement} · {company.district}
            </div>
            <div>
              {company.city}/{company.state} · CEP {formatZip(company.zip_code)}
            </div>
            <div>
              CNPJ {formatDocument(company.document)} · IE {company.state_registration || 'ISENTO'}
            </div>
            <div>
              {company.phone} {company.email ? `· ${company.email}` : ''}
            </div>
            <div className="text-xs muted">{TAX_REGIME[company.tax_regime]}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              DANFE {invoice.model === '55' ? '· NF-e' : 'SIMPLIFICADO · NFC-e'}
            </div>
            <div>Modelo {invoice.model}</div>
            <div>
              Série {invoice.series} · Nº {invoice.number}
            </div>
            <div>Emissão {dateTime(invoice.issued_at)}</div>
            <div>Ambiente: {invoice.environment === '1' ? 'Produção' : 'Homologação'}</div>
          </div>
        </div>

        <div className="danfe-box">
          <div className="label">Chave de acesso</div>
          <div className="danfe-key">{formatAccessKey(invoice.access_key)}</div>
          {invoice.protocol ? (
            <div className="text-xs">Protocolo de autorização: {invoice.protocol}</div>
          ) : (
            <div className="text-xs muted">
              Aguardando assinatura digital e transmissão à SEFAZ.
            </div>
          )}
        </div>

        <div className="danfe-box">
          <div className="label">Destinatário</div>
          {sale?.customer_name ? (
            <>
              <div className="strong">{sale.customer_name}</div>
              <div>
                {sale.customer_document ? formatDocument(sale.customer_document) : ''}
                {sale.customer_ie ? ` · IE ${sale.customer_ie}` : ''}
              </div>
              <div>
                {sale.customer_street}
                {sale.customer_number ? `, ${sale.customer_number}` : ''}
                {sale.customer_district ? ` · ${sale.customer_district}` : ''}
              </div>
              <div>
                {sale.customer_city}
                {sale.customer_state ? `/${sale.customer_state}` : ''}
                {sale.customer_zip ? ` · CEP ${formatZip(sale.customer_zip)}` : ''}
              </div>
            </>
          ) : (
            <div>CONSUMIDOR NÃO IDENTIFICADO</div>
          )}
        </div>

        <div className="danfe-box">
          <div className="label">Natureza da operação</div>
          <div>{invoice.operation}</div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cód.</th>
                <th>Descrição</th>
                <th>NCM</th>
                <th>CFOP</th>
                <th>Un.</th>
                <th className="num">Qtd.</th>
                <th className="num">Vl. unit.</th>
                <th className="num">Desc.</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="mono text-xs">{item.sku}</td>
                  <td>{item.description}</td>
                  <td className="mono text-xs">{item.ncm}</td>
                  <td className="mono text-xs">{item.cfop}</td>
                  <td>{item.unit}</td>
                  <td className="num">{decimal(item.qty)}</td>
                  <td className="num">{currency(item.unit_price)}</td>
                  <td className="num">{item.discount > 0 ? currency(item.discount) : '—'}</td>
                  <td className="num strong">{currency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="row between mt-16" style={{ alignItems: 'flex-start', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div className="danfe-box">
              <div className="label">Formas de pagamento</div>
              {payments.length === 0 ? (
                <div>Sem pagamento</div>
              ) : (
                payments.map((payment) => (
                  <div key={payment.id} className="row between">
                    <span>
                      {PAYMENT_LABELS[payment.method] ?? payment.method}
                      {payment.installments > 1 ? ` (${payment.installments}x)` : ''}
                      {payment.due_date ? ` · venc. ${date(payment.due_date)}` : ''}
                    </span>
                    <span className="strong">{currency(payment.amount)}</span>
                  </div>
                ))
              )}
            </div>
            {qrCode ? (
              <div className="danfe-box">
                <div className="label">Consulta pela chave de acesso (NFC-e)</div>
                <div className="text-xs" style={{ wordBreak: 'break-all' }}>{qrCode}</div>
              </div>
            ) : null}
          </div>

          <div style={{ width: 280 }}>
            <div className="danfe-box">
              <div className="row between">
                <span>Produtos</span>
                <span>{currency(sale?.items_total ?? invoice.total)}</span>
              </div>
              {sale && sale.discount > 0 ? (
                <div className="row between">
                  <span>Desconto</span>
                  <span>- {currency(sale.discount)}</span>
                </div>
              ) : null}
              {sale && sale.freight > 0 ? (
                <div className="row between">
                  <span>Frete</span>
                  <span>{currency(sale.freight)}</span>
                </div>
              ) : null}
              <div
                className="row between strong"
                style={{ fontSize: 15, borderTop: '1px solid var(--gray-300)', marginTop: 6, paddingTop: 6 }}
              >
                <span>Total da nota</span>
                <span>{currency(invoice.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {invoice.environment === '2' ? (
          <div
            style={{
              textAlign: 'center',
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: 8,
              border: '1px dashed #94a3b8',
              marginTop: 8,
            }}
          >
            AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
          </div>
        ) : null}

        {company.receipt_footer ? (
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11.5 }}>
            {company.receipt_footer}
            {company.business_hours ? ` · ${company.business_hours}` : ''}
            {company.whatsapp ? ` · WhatsApp ${company.whatsapp}` : ''}
          </div>
        ) : null}
      </div>

      {xmlOpen ? (
        <Modal title="XML do documento" size="wide" onClose={() => setXmlOpen(false)}>
          <pre
            className="mono"
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              background: 'var(--gray-50)',
              padding: 14,
              borderRadius: 8,
              maxHeight: '60vh',
              overflow: 'auto',
            }}
          >
            {invoice.xml}
          </pre>
        </Modal>
      ) : null}

      {cancelOpen ? (
        <Modal
          title="Cancelar nota fiscal"
          size="narrow"
          onClose={() => setCancelOpen(false)}
          footer={
            <>
              <button type="button" className="btn secondary" onClick={() => setCancelOpen(false)}>
                Voltar
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending || reason.trim().length < 15}
              >
                Cancelar NF
              </button>
            </>
          }
        >
          <div className="stack">
            <div className="alert warn">
              A SEFAZ exige justificativa com no mínimo 15 caracteres e cancelamento dentro do prazo
              legal (24h para NF-e em geral).
            </div>
            <div className="field">
              <label>Justificativa ({reason.trim().length}/15)</label>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
