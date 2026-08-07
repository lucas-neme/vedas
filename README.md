# 🐾 Vedas CRM — loja de rações e pet shop

CRM completo para loja de rações e produtos para pets: cadastro de clientes com
os pets, catálogo de produtos, controle de estoque com lote e validade, PDV,
vendas, contas a receber, emissão de documento fiscal (NF-e / NFC-e) e
relatórios.

**Stack:** TypeScript ponta a ponta · React 18 + Vite · Fastify + Kysely ·
PostgreSQL 16 · Docker Compose (deploy via Portainer).

---

## O que o sistema faz

### Operação
| Módulo | O que resolve |
| --- | --- |
| **PDV** | Venda de balcão com busca por nome/SKU/**leitor de código de barras**, múltiplas formas de pagamento, desconto por item e no total, frete e crediário. |
| **Vendas** | Histórico, detalhamento com margem por venda, cancelamento com devolução automática ao estoque. |
| **Notas fiscais** | Geração da chave de acesso e do XML no layout **NF-e 4.00** (modelos 55 e 65), DANFE imprimível, QR Code da NFC-e, download do XML e cancelamento com justificativa. |
| **Contas a receber** | Crediário e boletos em aberto, destaque de vencidos, baixa de pagamento e cobrança por WhatsApp em um clique. |

### Cadastros
| Módulo | Destaques para pet shop |
| --- | --- |
| **Clientes e pets** | PF/PJ com endereço completo (busca por CEP via ViaCEP) e **ficha de cada pet**: espécie, raça, porte, peso, castração, ração habitual e consumo diário. |
| **Produtos** | SKU, EAN, categoria, marca, espécie-alvo, fase da vida (filhote/adulto/sênior), peso da embalagem, custo, preço, margem calculada e campos fiscais (NCM, CFOP, CEST, CSOSN/CST, origem). |
| **Estoque** | Entrada de mercadoria com **lote e validade**, custo médio ponderado, ajuste de inventário, baixa de perdas, histórico completo de movimentações e alertas de estoque mínimo e de validade. |
| **Fornecedores, categorias e marcas** | Organização do catálogo e da reposição. |

### Personalização
A aba **Configurações** deixa a loja com a cara dela, sem mexer em código:

| Aba | O que dá para mudar |
| --- | --- |
| **🎨 Aparência** | Nome do CRM e slogan, **logo** (upload de PNG/JPG/WEBP/SVG ou emoji), **cor principal e de destaque** (8 paletas prontas ou seletor livre), estilo da barra lateral (escura, clara ou na cor da marca) e tema padrão (claro, escuro ou o do sistema). Tudo com **prévia ao vivo** antes de salvar. |
| **🏪 Dados da loja** | Razão social, nome fantasia, CNPJ, inscrições, regime tributário, endereço completo (com busca por CEP), telefone, WhatsApp, e-mail, Instagram, site, horário de funcionamento e a mensagem do rodapé do cupom. |
| **👤 Responsável** | Dados pessoais de quem responde pela loja: nome, CPF (validado), cargo, telefone, e-mail e nascimento. |
| **📄 Fiscal** | Ambiente, séries e numeração de NF-e/NFC-e, CSC e padrões fiscais do catálogo. |
| **⚙️ Operação** | Antecedência do alerta de validade e destaque de estoque mínimo. |

A identidade visual vale para todo o sistema: menu, botões, gráficos, tela de
login (que carrega a logo antes mesmo de autenticar), aba do navegador e o
cabeçalho do DANFE. Cada pessoa da equipe ainda pode alternar entre tema claro
e escuro no botão 🌙 da barra superior — a escolha individual tem prioridade
sobre o padrão da loja.

### Gestão
- **Painel** com faturamento do dia e do mês, ticket médio, margem, valor imobilizado em estoque, contas a receber, gráfico de 30 dias, mais vendidos e alertas.
- **Relatórios**: vendas por período (com margem e forma de pagamento), curva de produtos, melhores clientes, **clientes inativos** para reativação.
- **🐾 Previsão de recompra de ração** — o diferencial do negócio: a partir do
  consumo diário do pet, do peso da embalagem e da última compra daquele
  produto, o sistema calcula quando a ração vai acabar e monta a régua de
  contato no WhatsApp. *(Ex.: pacote de 15 kg ÷ 420 g/dia = 35 dias.)*

### Controles internos
- **Baixa de estoque FEFO** (*First Expired, First Out*): a saída consome sempre
  o lote de validade mais próxima, dividindo a venda entre lotes quando
  necessário — cada linha da venda guarda o lote de origem, garantindo
  rastreabilidade para recall.
- **Perfis de acesso**: administrador, gerente e operador de caixa.
- Estoque nunca é editado direto: toda alteração gera uma movimentação
  auditável com usuário, motivo e saldo resultante.

---

## Deploy no Portainer

A stack sobe três containers: **db** (o Postgres próprio da loja), **api** e
**web** — mais dois opcionais, ativados por *profile*:

| Serviço | Profile | Para quê |
| --- | --- | --- |
| `db` | — | PostgreSQL 16 da loja, com volume nomeado e healthcheck |
| `api` | — | API Fastify; aplica migrations e seed no boot |
| `web` | — | React servido por nginx, com proxy `/api` para a API |
| `backup` | `backup` | `pg_dump` comprimido em intervalo configurável, com expurgo automático |
| `pgadmin` | `tools` | pgAdmin no navegador para administrar o banco |

```bash
docker network create proxynet            # uma vez, antes do primeiro deploy
docker compose up -d                      # db + api + web
docker compose --profile backup up -d     # + backup diário
docker compose --profile tools  up -d     # + pgAdmin
```

### Exposição: nenhuma porta publicada

Nenhum serviço da stack publica porta no host. O banco e a API existem só
dentro da rede privada `vedas` — o Postgres **não** é alcançável de fora do
servidor. Apenas o `web` entra também na rede `proxynet`, onde o seu reverse
proxy (Nginx Proxy Manager, Traefik, Caddy…) o encontra pelo nome do container:

```
seu-dominio.com.br  →  http://vedas-web:80
```

O proxy cuida do TLS. No Nginx Proxy Manager, um *Proxy Host* com
**Forward Hostname** `vedas-web` e **Forward Port** `80` resolve — desde que o
container do proxy também esteja na rede `proxynet`.

Para rodar numa máquina isolada, sem reverse proxy, o cabeçalho do
`docker-compose.yml` explica como voltar a publicar a porta do `web`.

### 1. Publique o código em um repositório Git
O Portainer precisa do repositório para conseguir *buildar* as imagens da API e
do frontend.

### 2. Crie a stack
No Portainer: **Stacks → Add stack → Repository**

| Campo | Valor |
| --- | --- |
| Name | `vedas` |
| Repository URL | a URL do seu repositório |
| Compose path | `docker-compose.yml` |

### 3. Configure as variáveis de ambiente
Em *Environment variables* (use `.env.example` como referência):

```
POSTGRES_USER=vedas
POSTGRES_PASSWORD=<uma senha forte>
POSTGRES_DB=vedas
POSTGRES_PORT=5433
WEB_PORT=8080
JWT_SECRET=<string longa e aleatória>
TZ=America/Sao_Paulo
ADMIN_EMAIL=admin@vedas.com.br
ADMIN_PASSWORD=<obrigatória — senha do primeiro acesso>
SEED_ON_START=true
NFE_ENVIRONMENT=2
```

> `SEED_ON_START=true` popula o banco com categorias, marcas e 20 produtos de
> exemplo de pet shop no primeiro boot. Coloque `false` se for começar com o
> catálogo vazio. O usuário administrador é criado de qualquer forma.

> **`ADMIN_PASSWORD` é obrigatória** — não existe senha padrão no código. Ela só
> é usada para criar o primeiro usuário num banco vazio; a partir daí a senha do
> banco é a fonte da verdade e a variável passa a ser ignorada. Se o banco estiver
> vazio e a variável não estiver definida, a API se recusa a subir com uma
> mensagem explicando o que falta.

### 4. Deploy
Clique em **Deploy the stack**. O primeiro build leva alguns minutos. A API
aguarda o Postgres ficar saudável, aplica as migrations e roda o seed sozinha.

### 5. Acesse
`http://IP_DO_SERVIDOR:8080` — entre com o `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

**Primeiros passos no sistema:**
1. **Configurações** → preencha CNPJ, inscrição estadual, endereço e o código
   IBGE do município (obrigatórios para emitir nota).
2. **Usuários** → troque a senha do administrador e crie os acessos da equipe.
3. **Produtos / Estoque** → ajuste o catálogo e faça a carga inicial do estoque
   pela tela de *Entrada de mercadoria* (com lote e validade).

### Sem registry, com build no host
Se preferir não usar o método *Repository*, envie a pasta para o servidor e rode:

```bash
cp .env.example .env   # e edite
docker compose up -d --build
```

O `docker-compose.yml` também aceita `API_IMAGE` / `WEB_IMAGE` caso você
prefira publicar as imagens em um registry próprio.

---

## Rodar em localhost

Pré-requisito único: **Node 22+**. Não precisa de Docker.

```powershell
# 1. Dependências (uma vez)
npm run setup

# 2. Banco local dedicado — cria um cluster PostgreSQL isolado em .localdb/
npm run db:start

# 3. API — http://localhost:3333
#    ADMIN_PASSWORD só é necessária no primeiro boot, para criar o admin.
$env:ADMIN_PASSWORD = "escolha-uma-senha"
npm run dev:api

# 4. Frontend — http://localhost:5173  (em outro terminal)
npm run dev:web
```

Abra **http://localhost:5173** e entre com `admin@vedas.com.br` e a senha que
você escolheu no passo 3. Migrations e seed rodam sozinhos no boot da API.

### Prefere o banco em Docker?

Existe um compose só com o Postgres de desenvolvimento, na mesma porta e com as
mesmas credenciais do cluster local — dá para trocar um pelo outro sem mexer em
nada:

```bash
docker compose -f docker-compose.dev.yml up -d
npm run dev:api
npm run dev:web
```

### O banco local

`npm run db:start` usa os binários do PostgreSQL já instalados na máquina para
criar um cluster **isolado**, dentro da pasta `.localdb/` do próprio projeto, na
**porta 55432** — ele não toca em nenhum serviço PostgreSQL existente e não
compartilha dados com ele.

| Comando | O que faz |
| --- | --- |
| `npm run db:start` | Cria (se preciso) e inicia o cluster local |
| `npm run db:stop` | Para o cluster |
| `npm run db:status` | Mostra se está rodando |
| `npm run db:reset` | **Apaga tudo** e recria do zero (volta ao seed) |
| `npm run db:psql` | Abre um `psql` conectado ao banco |

Se o PostgreSQL não estiver no caminho padrão, aponte a variável `PGBIN` para a
pasta `bin` da instalação. Para usar outro banco, basta definir `DATABASE_URL`
antes de subir a API:

```powershell
$env:DATABASE_URL = "postgres://usuario:senha@localhost:5432/vedas"
cd apps/api ; npm run dev
```

### Atalhos da interface

| Atalho | Ação |
| --- | --- |
| `F2` | Abre o PDV de qualquer tela |
| `↑` `↓` `Enter` | Navega e adiciona produtos na busca do PDV |
| `Esc` | Fecha o modal aberto |
| Botão 🌙 | Alterna tema claro/escuro |
| Botão ☰ | Recolhe a barra lateral (vira menu deslizante no celular) |

### Estrutura

```
vedas/
├── docker-compose.yml          # stack do Portainer (db + api + web)
├── .env.example
├── docs/
│   └── fiscal.md               # como ligar a emissão à SEFAZ
├── scripts/
│   └── localdb.ps1             # cluster PostgreSQL local, sem Docker
└── apps/
    ├── api/                    # Fastify + Kysely + Postgres
    │   ├── Dockerfile
    │   └── src/
    │       ├── db/             # schema SQL, migrator, seed e tipos
    │       ├── routes/         # endpoints REST
    │       ├── services/       # estoque (FEFO), vendas e NF-e
    │       └── lib/            # CPF/CNPJ, chave de acesso, dinheiro
    └── web/                    # React + Vite + React Query
        ├── Dockerfile          # build + nginx (serve SPA e faz proxy /api)
        ├── nginx.conf
        └── src/
            ├── components/
            ├── contexts/       # sessão, tema/identidade visual e avisos
            ├── pages/
            └── lib/            # cliente HTTP, formatação e geração de paleta
```

### Comandos

```bash
npm run typecheck   # em apps/api e apps/web
npm run build       # compila API (tsc) e frontend (vite)
```

---

## Emissão de nota fiscal — leia antes de usar em produção

O sistema **gera** o documento fiscal completo: numeração e série controladas,
chave de acesso de 44 dígitos com dígito verificador (módulo 11), XML no layout
NF-e 4.00 com todos os grupos (`ide`, `emit`, `dest`, `det`, `total`, `transp`,
`pag`, `infAdic`), tributação por Simples Nacional (CSOSN) ou regime normal
(CST), DANFE imprimível e QR Code da NFC-e a partir do CSC.

A **assinatura digital com certificado A1 e a transmissão à SEFAZ não estão
incluídas** — elas exigem o certificado da empresa e homologação junto ao seu
contador. O sistema já expõe o ponto de integração
(`POST /api/invoices/:id/status`) para o transmissor devolver o protocolo de
autorização. O passo a passo está em [`docs/fiscal.md`](docs/fiscal.md).

Enquanto `NFE_ENVIRONMENT=2` (padrão), os documentos saem marcados como
**homologação, sem valor fiscal**.

---

## Segurança

- Troque `JWT_SECRET` e `POSTGRES_PASSWORD` antes de expor o sistema.
- A porta do Postgres (`5433`) é publicada só para administração; comente esse
  bloco no `docker-compose.yml` se não precisar de acesso externo.
- Coloque um proxy reverso com HTTPS (Traefik, Nginx Proxy Manager, Caddy) na
  frente do container `web` antes de disponibilizar o sistema fora da rede local.
