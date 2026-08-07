<#
.SYNOPSIS
  Cria (ou atualiza) a stack do Vedas CRM em um Portainer, via API.

.DESCRIPTION
  Le as variaveis de .env.portainer - arquivo local, fora do Git - e cria a
  stack apontando para o repositorio Git, com todas as variaveis de ambiente
  ja preenchidas. Nenhum segredo passa por linha de comando.

.EXAMPLE
  npm run deploy
  powershell -ExecutionPolicy Bypass -File scripts/deploy-portainer.ps1
  powershell -ExecutionPolicy Bypass -File scripts/deploy-portainer.ps1 -Update
#>

param(
  # Atualiza a stack se ela ja existir, em vez de falhar.
  [switch]$Update,
  # Nome da stack no Portainer.
  [string]$StackName = 'vedas',
  # Ignora certificado autoassinado (comum em Portainer na porta 9443).
  [switch]$SkipCertCheck = $true
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env.portainer'

if (-not (Test-Path $envFile)) {
  throw "Arquivo .env.portainer nao encontrado em $root"
}

# ── Le o arquivo de variaveis ────────────────────────────────────────────────
$vars = @{}
foreach ($line in [System.IO.File]::ReadAllLines($envFile, [System.Text.Encoding]::UTF8)) {
  $trimmed = $line.Trim()
  if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
  $idx = $trimmed.IndexOf('=')
  if ($idx -lt 1) { continue }
  $vars[$trimmed.Substring(0, $idx).Trim()] = $trimmed.Substring($idx + 1).Trim()
}

function Need($name, $hint) {
  if (-not $vars.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($vars[$name])) {
    throw "$name esta vazio em .env.portainer. $hint"
  }
  return $vars[$name]
}

$portainerUrl = (Need 'PORTAINER_URL' 'Ex.: https://192.168.0.50:9443').TrimEnd('/')
$portainerToken = Need 'PORTAINER_TOKEN' 'Gere em Portainer > My account > Access tokens.'
$adminPassword = Need 'ADMIN_PASSWORD' 'Defina a senha do primeiro login no CRM.'

if ($adminPassword.Length -lt 6) {
  throw 'ADMIN_PASSWORD precisa de ao menos 6 caracteres.'
}

# ── TLS autoassinado ─────────────────────────────────────────────────────────
if ($SkipCertCheck) {
  Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class VedasCertPolicy : ICertificatePolicy {
  public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) { return true; }
}
"@ -ErrorAction SilentlyContinue
  [System.Net.ServicePointManager]::CertificatePolicy = New-Object VedasCertPolicy
  [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
}

$headers = @{ 'X-API-Key' = $portainerToken }

# Cloudflare Access / Zero Trust: sem estes cabecalhos o proxy devolve a pagina
# de login com HTTP 200 e a API nunca e alcancada.
if ($vars['CF_ACCESS_CLIENT_ID'] -and $vars['CF_ACCESS_CLIENT_SECRET']) {
  $headers['CF-Access-Client-Id'] = $vars['CF_ACCESS_CLIENT_ID']
  $headers['CF-Access-Client-Secret'] = $vars['CF_ACCESS_CLIENT_SECRET']
  $usingCloudflare = $true
}
else {
  $usingCloudflare = $false
}

<#
  Chama a API validando a resposta.

  O Portainer sempre responde JSON. Se vier HTML, a requisicao foi
  interceptada por proxy, portal de login ou pagina de erro - e tratar isso
  como sucesso levaria a um "deploy" que nunca aconteceu.
#>
function Invoke-Portainer($Method, $Path, $Body) {
  $uri = "$portainerUrl$Path"
  $params = @{
    Method          = $Method
    Uri             = $uri
    Headers         = $headers
    ContentType     = 'application/json'
    UseBasicParsing = $true
    TimeoutSec      = 120
  }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress) }

  $response = Invoke-WebRequest @params
  $contentType = [string]$response.Headers['Content-Type']
  $content = $response.Content

  if ($content -match 'Cloudflare Access' -or $content -match 'cf-access') {
    throw @"
O Portainer esta protegido por Cloudflare Access e a requisicao parou na tela de login.

Para liberar o acesso automatizado, crie um Service Token:
  Cloudflare Zero Trust > Access > Service Auth > Service Tokens > Create
  Depois, na aplicacao Access que protege $portainerUrl, adicione uma policy
  com Action = Service Auth e Include = Service Token (o que voce criou).

Cole os dois valores em .env.portainer:
  CF_ACCESS_CLIENT_ID=<...>.access
  CF_ACCESS_CLIENT_SECRET=<...>
"@
  }

  if ($contentType -notlike '*json*') {
    $preview = ($content.Substring(0, [Math]::Min(300, $content.Length)) -replace '\s+', ' ')
    throw "Esperava JSON da API do Portainer, veio '$contentType'. Confira PORTAINER_URL.`nInicio da resposta: $preview"
  }

  if ([string]::IsNullOrWhiteSpace($content)) { return $null }
  return $content | ConvertFrom-Json
}

# ── 1. Conexao e identidade ──────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/5] conectando em $portainerUrl ..." -ForegroundColor Cyan
if ($usingCloudflare) { Write-Host "      usando Service Token do Cloudflare Access" -ForegroundColor DarkGray }

$me = Invoke-Portainer 'GET' '/api/users/me'
if (-not $me -or [string]::IsNullOrWhiteSpace($me.Username)) {
  throw "A API respondeu, mas sem identificar o usuario. PORTAINER_TOKEN e valido?"
}
Write-Host "      autenticado como '$($me.Username)'" -ForegroundColor Green

# ── 2. Ambiente (endpoint) ───────────────────────────────────────────────────
Write-Host "[2/5] descobrindo o ambiente Docker ..."
$endpoints = @(Invoke-Portainer 'GET' '/api/endpoints')
if ($endpoints.Count -eq 0) {
  throw 'Nenhum ambiente Docker cadastrado neste Portainer.'
}

if ($vars['PORTAINER_ENDPOINT_ID']) {
  $endpointId = [int]$vars['PORTAINER_ENDPOINT_ID']
  $endpoint = $endpoints | Where-Object { $_.Id -eq $endpointId } | Select-Object -First 1
  if (-not $endpoint) { throw "Ambiente de ID $endpointId nao existe neste Portainer." }
}
elseif ($endpoints.Count -eq 1) {
  $endpoint = $endpoints[0]
}
else {
  Write-Host ""
  Write-Host "Ha mais de um ambiente. Escolha um e coloque o ID em PORTAINER_ENDPOINT_ID:" -ForegroundColor Yellow
  $endpoints | ForEach-Object { Write-Host ("   ID {0,-4} {1}" -f $_.Id, $_.Name) }
  throw 'Defina PORTAINER_ENDPOINT_ID em .env.portainer.'
}

$endpointId = $endpoint.Id
if (-not $endpointId) { throw 'A API nao devolveu o ID do ambiente.' }
Write-Host "      ambiente: '$($endpoint.Name)' (ID $endpointId)" -ForegroundColor Green

# ── 3. Variaveis da stack ────────────────────────────────────────────────────
$stackVarNames = @(
  'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB',
  'JWT_SECRET', 'TZ',
  'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'SEED_ON_START', 'NFE_ENVIRONMENT',
  'BACKUP_INTERVAL', 'BACKUP_KEEP_DAYS', 'PGADMIN_PASSWORD'
)

$stackEnv = @()
foreach ($name in $stackVarNames) {
  if ($vars.ContainsKey($name) -and -not [string]::IsNullOrWhiteSpace($vars[$name])) {
    $stackEnv += @{ name = $name; value = $vars[$name] }
  }
}
# O compose exige PGADMIN_PASSWORD mesmo sem usar o profile "tools".
if (-not ($stackEnv | Where-Object { $_.name -eq 'PGADMIN_PASSWORD' })) {
  $stackEnv += @{ name = 'PGADMIN_PASSWORD'; value = 'nao-utilizado' }
}
Write-Host "[3/5] $($stackEnv.Count) variaveis de ambiente preparadas"

# ── 4. Stack ja existe? ──────────────────────────────────────────────────────
$existing = $null
try {
  $stacks = Invoke-Portainer 'GET' '/api/stacks'
  $existing = $stacks | Where-Object { $_.Name -eq $StackName } | Select-Object -First 1
}
catch { }

$body = @{
  name                     = $StackName
  repositoryURL            = 'https://github.com/lucas-neme/vedas'
  repositoryReferenceName  = 'refs/heads/main'
  composeFile              = 'docker-compose.yml'
  repositoryAuthentication = $false
  env                      = $stackEnv
}

if ($vars['GITHUB_TOKEN']) {
  $body.repositoryAuthentication = $true
  $body.repositoryUsername = $vars['GITHUB_USERNAME']
  $body.repositoryPassword = $vars['GITHUB_TOKEN']
}

if ($existing) {
  if (-not $Update) {
    Write-Host ""
    Write-Host "A stack '$StackName' ja existe (ID $($existing.Id))." -ForegroundColor Yellow
    Write-Host "Rode de novo com -Update para atualiza-la:" -ForegroundColor Yellow
    Write-Host "   npm run deploy:update" -ForegroundColor Yellow
    exit 1
  }
  Write-Host "[4/5] atualizando a stack existente (ID $($existing.Id)) ..."
  $result = Invoke-Portainer 'PUT' "/api/stacks/$($existing.Id)/git/redeploy?endpointId=$endpointId" @{
    env                      = $stackEnv
    repositoryReferenceName  = 'refs/heads/main'
    repositoryAuthentication = $body.repositoryAuthentication
    repositoryUsername       = $body.repositoryUsername
    repositoryPassword       = $body.repositoryPassword
    # As imagens da API e do frontend sao construidas a partir do proprio
    # repositorio (build context), nao existem em registry nenhum. Com
    # pullImage=true o Portainer tenta `docker pull vedas/api` e falha.
    pullImage                = $false
    prune                    = $false
  }
  $stackId = $existing.Id
}
else {
  Write-Host "[4/5] criando a stack '$StackName' a partir do repositorio ..."
  try {
    # Portainer 2.19+
    $result = Invoke-Portainer 'POST' "/api/stacks/create/standalone/repository?endpointId=$endpointId" $body
  }
  catch {
    # Versoes anteriores
    Write-Host "      (API nova indisponivel, usando a rota antiga)" -ForegroundColor DarkGray
    $result = Invoke-Portainer 'POST' "/api/stacks?type=2&method=repository&endpointId=$endpointId" $body
  }
  $stackId = $result.Id
}

if (-not $stackId) {
  throw "A stack nao foi criada: a API nao devolveu um ID. Resposta: $($result | ConvertTo-Json -Depth 3 -Compress)"
}
Write-Host "      stack ID $stackId" -ForegroundColor Green

# ── 5. Conferencia ───────────────────────────────────────────────────────────
Write-Host "[5/5] aguardando os containers subirem ..."
Start-Sleep -Seconds 15

try {
  $containers = Invoke-RestMethod -Method GET -Headers $headers `
    -Uri "$portainerUrl/api/endpoints/$endpointId/docker/containers/json?all=true"
  $meus = $containers | Where-Object { $_.Names -match 'vedas' }
  Write-Host ""
  foreach ($c in $meus) {
    $nome = ($c.Names[0]).TrimStart('/')
    $cor = if ($c.State -eq 'running') { 'Green' } else { 'Yellow' }
    Write-Host ("   {0,-16} {1}" -f $nome, $c.Status) -ForegroundColor $cor
  }
}
catch {
  Write-Host "   (nao consegui listar os containers: $($_.Exception.Message))" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Stack no ar." -ForegroundColor Green
if ($vars['PUBLIC_URL']) { Write-Host "   CRM:   $($vars['PUBLIC_URL'])" }
Write-Host "   Login: $($vars['ADMIN_EMAIL'])"
Write-Host "   Senha: a que voce definiu em ADMIN_PASSWORD"
Write-Host ""
Write-Host "Nenhuma porta e publicada no host: quem expoe o CRM e o reverse"
Write-Host "proxy, encaminhando o dominio para vedas-web:80 na rede proxynet."
Write-Host ""
