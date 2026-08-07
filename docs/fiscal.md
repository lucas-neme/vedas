# Emissão fiscal — NF-e e NFC-e

Este documento explica **exatamente o que o Vedas CRM faz** na parte fiscal, o
que falta para a nota ter valor jurídico e como fechar essa última etapa.

---

## O que já está implementado

| Etapa | Status |
| --- | --- |
| Controle de numeração e série (modelos 55 e 65), sem furo e sem duplicidade | ✅ |
| Chave de acesso de 44 dígitos com DV calculado por módulo 11 | ✅ |
| XML no layout **NF-e 4.00** (`ide`, `emit`, `dest`, `det`, `total`, `transp`, `pag`, `infAdic`) | ✅ |
| Tributação Simples Nacional (`ICMSSN102` / CSOSN) e regime normal (`ICMS00` / CST) | ✅ |
| Mapeamento das formas de pagamento para a tabela `tPag` da SEFAZ | ✅ |
| Validação de CPF/CNPJ e exigência de destinatário completo na NF-e 55 | ✅ |
| DANFE imprimível (retrato para NF-e, simplificado para NFC-e) | ✅ |
| QR Code da NFC-e (layout 2.00) a partir do CSC | ✅ |
| Download do XML | ✅ |
| Cancelamento com justificativa mínima de 15 caracteres | ✅ |
| Bloqueio do cancelamento de venda que possui NF ativa | ✅ |
| **Assinatura digital XMLDSig com certificado A1** | ❌ requer certificado |
| **Transmissão aos webservices da SEFAZ** | ❌ requer certificado |

Um documento recém-gerado nasce com status `gerada`. Os status possíveis são:
`gerada → assinada → autorizada` (ou `rejeitada`), e `cancelada`.

---

## Por que a assinatura não vem pronta

Assinar e transmitir exige:

1. **Certificado digital A1** (arquivo `.pfx` + senha) da empresa — é um
   documento sigiloso que só o dono da loja pode fornecer;
2. **Credenciamento na SEFAZ** do estado, feito pelo contador;
3. Para NFC-e, o **CSC** (Código de Segurança do Contribuinte), emitido no portal
   da SEFAZ estadual;
4. Testes em homologação antes de qualquer emissão real.

Por isso o sistema para no XML pronto e deixa um ponto de integração aberto.

---

## Como fechar a integração

### Opção A — API de terceiros (mais rápido)

Serviços como Focus NFe, NFe.io, WebmaniaBR, Tecnospeed ou eNotas recebem os
dados da nota, assinam com o seu certificado e transmitem à SEFAZ.

Fluxo sugerido:

1. Emita o documento no Vedas (`POST /api/invoices`) — você recebe o `id`, a
   chave de acesso e o XML.
2. Envie o XML (ou os dados da venda) ao provedor.
3. Quando o provedor retornar a autorização, grave o resultado no Vedas:

```http
POST /api/invoices/:id/status
Authorization: Bearer <token de um usuário admin ou gerente>
Content-Type: application/json

{
  "status": "autorizada",
  "protocol": "135240000123456",
  "message": "Autorizado o uso da NF-e",
  "xml": "<nfeProc>...</nfeProc>"
}
```

O campo `xml` é opcional — envie o **XML autorizado** (`nfeProc`, já com o
protocolo) para que ele substitua o XML gerado localmente. É esse arquivo que
deve ser guardado por 5 anos e enviado ao contador.

Em caso de rejeição:

```json
{ "status": "rejeitada", "message": "539 - Duplicidade de NF-e" }
```

### Opção B — Assinar e transmitir no próprio servidor

Bibliotecas Node como `node-nfe`, `nfewizard` ou uma implementação própria com
`xml-crypto` + `node-forge` conseguem assinar o XML e chamar os webservices.

Passos:

1. Monte um volume com o certificado (`./certs:/app/certs:ro`) e adicione
   `CERT_PATH` / `CERT_PASSWORD` ao serviço `api` no `docker-compose.yml`.
   O diretório `certs/` já está no `.gitignore` — **nunca** versione o `.pfx`.
2. Crie um serviço `apps/api/src/services/nfe-transmitter.ts` que:
   - assine o `infNFe` (XMLDSig, algoritmo RSA-SHA1, referência `#NFe<chave>`);
   - monte o lote (`enviNFe`) e chame o webservice `NFeAutorizacao4` da UF;
   - consulte o recibo (`NFeRetAutorizacao4`);
   - atualize a nota com o mesmo payload do `POST /api/invoices/:id/status`.
3. Para o cancelamento, implemente o evento `110111` (`RecepcaoEvento4`) e o
   envie antes de marcar a nota como cancelada no banco.

> Atenção: no XML de **homologação**, a SEFAZ exige que o nome do destinatário
> seja literalmente `NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL`.
> Trate isso na camada de transmissão, mantendo o cadastro real no banco.

---

## Configuração obrigatória antes de emitir

Em **Configurações → Dados da empresa / Parâmetros fiscais**:

| Campo | Observação |
| --- | --- |
| CNPJ | validado com dígito verificador |
| Inscrição estadual | `ISENTO` se não houver |
| Regime tributário (CRT) | 1 Simples, 2 Simples com excesso, 3 Regime normal |
| Endereço completo | logradouro, número, bairro, cidade, UF, CEP |
| **Código IBGE do município** | preenchido automaticamente pela busca de CEP |
| Série e próximo número | por modelo (55 e 65) |
| CSC ID e token | somente para NFC-e |
| Ambiente | `2` homologação (padrão) / `1` produção |

Nos **produtos**, confira `NCM`, `CFOP`, `CSOSN` (ou `CST` + alíquota de ICMS) e
`origem`. Padrões já vêm preenchidos para o ramo:

- `NCM 23091000` — alimentos para cães e gatos, acondicionados para venda a varejo
- `CFOP 5102` — venda de mercadoria dentro do estado
- `CSOSN 102` — Simples Nacional sem permissão de crédito

Produtos de outras famílias (medicamentos `30049099`, higiene `48181000`,
acessórios, brinquedos `95030099`) precisam do NCM correto — **confirme a
classificação com seu contador**, ela é responsabilidade fiscal da loja.

---

## Regras de negócio implementadas

- NF-e modelo 55 exige cliente identificado **com CPF/CNPJ preenchido**; sem
  destinatário, use a NFC-e modelo 65.
- Uma venda só pode ter uma nota ativa: tentar emitir de novo retorna `409`.
- Uma venda com nota ativa não pode ser cancelada — cancele a nota primeiro.
- A numeração só avança quando o documento é efetivamente gravado (transação
  única com `SELECT ... FOR UPDATE` nas configurações), evitando saltos.
- O valor da nota é recalculado a partir dos itens, não copiado da venda.

---

## Endpoints fiscais

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/invoices` | Lista com filtros de modelo, status, período e busca por número/chave |
| `GET` | `/api/invoices/:id` | Dados completos para o DANFE (empresa, venda, itens, pagamentos, QR Code) |
| `GET` | `/api/invoices/:id/xml` | Download do XML |
| `POST` | `/api/invoices` | Emite a partir de uma venda (`sale_id`, `model`) |
| `POST` | `/api/invoices/:id/status` | Grava o retorno da SEFAZ (admin/gerente) |
| `POST` | `/api/invoices/:id/cancel` | Cancela com justificativa (admin/gerente) |
