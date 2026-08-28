import { extractEmbeddedAgentVersion } from './versioning.js';

export type AgentInstallerOptions = {
  apiUrl: string;
  enrollmentToken: string;
  artifact: Buffer;
  artifactChecksum: string;
  version: string;
  unitCode: string;
};

const nodeVersion = 'v22.23.2';
const winSwVersion = 'v2.12.0';
const winSwSha256 = '923111c7142b3dc783a3c722b19b8a21bcb78222d7a136ac33f0ca8a29f4cb66';

function base64(value: string | Buffer): string {
  return Buffer.isBuffer(value) ? value.toString('base64') : Buffer.from(value, 'utf8').toString('base64');
}

function validateOptions(options: AgentInstallerOptions): void {
  if (!/^https?:\/\//i.test(options.apiUrl)) throw new Error('URL pública da API inválida para o instalador.');
  if (!/^[a-f0-9]{64}$/i.test(options.artifactChecksum)) throw new Error('Checksum do artefato inválido.');
  if (!/^\d+\.\d+\.\d+$/.test(options.version)) throw new Error('Versão do agente inválida.');
  if (!options.artifact.length) throw new Error('Artefato do agente vazio.');
  if (extractEmbeddedAgentVersion(options.artifact) !== options.version) throw new Error('A versão embutida do artefato não corresponde à versão do instalador.');
}

export function renderWindowsInstaller(options: AgentInstallerOptions): string {
  validateOptions(options);
  const apiBase64 = base64(options.apiUrl.replace(/\/+$/, ''));
  const tokenBase64 = base64(options.enrollmentToken);
  const unitBase64 = base64(options.unitCode);
  const artifactBase64 = base64(options.artifact);
  const checksum = options.artifactChecksum.toLowerCase();
  return `#requires -version 5.1
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$apiUrl = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${apiBase64}'))
$enrollmentToken = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${tokenBase64}'))
$unitCode = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${unitBase64}'))
$artifactBase64 = @'
${artifactBase64}
'@
$artifactChecksum = '${checksum}'
$agentVersion = '${options.version}'
$serviceName = 'HealthLinkSentinelAgent'

if ($env:HEALTHLINK_INSTALLER_TEST_MODE -eq '1') {
  [ordered]@{ platform = 'windows'; version = $agentVersion; unitCode = $unitCode; checksum = $artifactChecksum; service = $serviceName; interactive = $false } | ConvertTo-Json -Compress
  exit 0
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  if (-not $PSCommandPath) { throw 'Execute este instalador como Administrador.' }
  $elevated = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'))
  exit $elevated.ExitCode
}

$installDir = Join-Path $env:ProgramData 'HealthLink Sentinel\Agent'
$runtimeDir = Join-Path $installDir 'runtime'
$releaseDir = Join-Path $installDir 'releases'
$dataDir = Join-Path $installDir 'data'
$logDir = Join-Path $installDir 'logs'
$configPath = Join-Path $installDir 'agent.json'
$agentPath = Join-Path $releaseDir 'healthlink-agent.cjs'
$winswPath = Join-Path $installDir ($serviceName + '.exe')
$winswConfigPath = Join-Path $installDir ($serviceName + '.xml')

New-Item -ItemType Directory -Force -Path $installDir, $releaseDir, $dataDir, $logDir | Out-Null
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existingService) {
  if ($existingService.Status -ne 'Stopped') { Stop-Service -Name $serviceName -Force }
  if (Test-Path $winswPath) { & $winswPath uninstall | Out-Null }
}

$nodeExe = Join-Path $runtimeDir 'node.exe'
if (-not (Test-Path $nodeExe)) {
  $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } elseif ($env:PROCESSOR_ARCHITECTURE -eq 'AMD64') { 'x64' } else { throw 'Arquitetura Windows não suportada. Use x64 ou ARM64.' }
  $archiveName = 'node-${nodeVersion}-win-' + $architecture + '.zip'
  $temporaryDir = Join-Path ([IO.Path]::GetTempPath()) ('healthlink-agent-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $temporaryDir | Out-Null
  try {
    $archivePath = Join-Path $temporaryDir $archiveName
    $shasumsPath = Join-Path $temporaryDir 'SHASUMS256.txt'
    Invoke-WebRequest -UseBasicParsing -Uri ('https://nodejs.org/dist/${nodeVersion}/' + $archiveName) -OutFile $archivePath
    Invoke-WebRequest -UseBasicParsing -Uri 'https://nodejs.org/dist/${nodeVersion}/SHASUMS256.txt' -OutFile $shasumsPath
    $checksumLine = Get-Content $shasumsPath | Where-Object { $_ -match ('\s' + [regex]::Escape($archiveName) + '$') } | Select-Object -First 1
    if (-not $checksumLine) { throw 'Não foi possível validar o runtime Node.js.' }
    $expectedNodeHash = ($checksumLine -split '\s+')[0].ToLowerInvariant()
    $receivedNodeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
    if ($receivedNodeHash -ne $expectedNodeHash) { throw 'Checksum inválido do runtime Node.js.' }
    $expanded = Join-Path $temporaryDir 'expanded'
    Expand-Archive -LiteralPath $archivePath -DestinationPath $expanded -Force
    $expandedRoot = Get-ChildItem -LiteralPath $expanded -Directory | Select-Object -First 1
    if (-not $expandedRoot) { throw 'Conteúdo do runtime Node.js inválido.' }
    if (Test-Path $runtimeDir) { Remove-Item -LiteralPath $runtimeDir -Recurse -Force }
    Move-Item -LiteralPath $expandedRoot.FullName -Destination $runtimeDir
  } finally {
    if (Test-Path $temporaryDir) { Remove-Item -LiteralPath $temporaryDir -Recurse -Force }
  }
}

if (-not (Test-Path $winswPath) -or (Get-FileHash -Algorithm SHA256 -LiteralPath $winswPath).Hash.ToLowerInvariant() -ne '${winSwSha256}') {
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/winsw/winsw/releases/download/${winSwVersion}/WinSW.NET4.exe' -OutFile $winswPath
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $winswPath).Hash.ToLowerInvariant() -ne '${winSwSha256}') { throw 'Checksum inválido do WinSW; instalação cancelada.' }

[IO.File]::WriteAllBytes($agentPath, [Convert]::FromBase64String(($artifactBase64 -replace '\s', '')))
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $agentPath).Hash.ToLowerInvariant() -ne $artifactChecksum) { throw 'Checksum inválido do agente; instalação cancelada.' }

$backupConfig = $configPath + '.previous'
if (Test-Path $backupConfig) { Remove-Item -LiteralPath $backupConfig -Force }
if (Test-Path $configPath) { Move-Item -LiteralPath $configPath -Destination $backupConfig -Force }
try {
  & $nodeExe $agentPath enroll --api $apiUrl --token $enrollmentToken --config $configPath --data-dir $dataDir --agent-path $agentPath
  if ($LASTEXITCODE -ne 0) { throw 'O agente não conseguiu consumir o enrollment.' }
  if (Test-Path $backupConfig) { Remove-Item -LiteralPath $backupConfig -Force }
} catch {
  if (Test-Path $configPath) { Remove-Item -LiteralPath $configPath -Force }
  if (Test-Path $backupConfig) { Move-Item -LiteralPath $backupConfig -Destination $configPath -Force }
  throw
}

& icacls.exe $configPath /inheritance:r /grant:r '*S-1-5-18:(F)' '*S-1-5-32-544:(F)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível proteger a configuração do agente.' }

$nodeXml = [Security.SecurityElement]::Escape($nodeExe)
$agentXml = [Security.SecurityElement]::Escape($agentPath)
$configXml = [Security.SecurityElement]::Escape($configPath)
$logXml = [Security.SecurityElement]::Escape($logDir)
$serviceXml = @"
<service>
  <id>$serviceName</id>
  <name>HealthLink Sentinel Agent</name>
  <description>Agente de coleta da unidade $unitCode.</description>
  <executable>$nodeXml</executable>
  <arguments>&quot;$agentXml&quot; run --config &quot;$configXml&quot;</arguments>
  <logpath>$logXml</logpath>
  <log mode="roll-by-size"><sizeThreshold>10485760</sizeThreshold><keepFiles>5</keepFiles></log>
  <hidewindow>true</hidewindow>
  <onfailure action="restart" delay="10 sec" />
  <resetfailure>1 hour</resetfailure>
  <stoptimeout>15 sec</stoptimeout>
</service>
"@
[IO.File]::WriteAllText($winswConfigPath, $serviceXml, (New-Object Text.UTF8Encoding($false)))
& $winswPath install
if ($LASTEXITCODE -ne 0) { throw 'Falha ao registrar o serviço HealthLink Sentinel Agent.' }
& $winswPath start
if ($LASTEXITCODE -ne 0) { throw 'O serviço foi registrado, mas não iniciou.' }
Write-Host ('HealthLink Sentinel Agent ' + $agentVersion + ' instalado e iniciado para ' + $unitCode + '.') -ForegroundColor Green
`;
}

export function renderLinuxInstaller(options: AgentInstallerOptions): string {
  validateOptions(options);
  const apiBase64 = base64(options.apiUrl.replace(/\/+$/, ''));
  const tokenBase64 = base64(options.enrollmentToken);
  const unitBase64 = base64(options.unitCode);
  const artifactBase64 = base64(options.artifact);
  const checksum = options.artifactChecksum.toLowerCase();
  return `#!/usr/bin/env bash
set -euo pipefail

api_b64='${apiBase64}'
token_b64='${tokenBase64}'
unit_b64='${unitBase64}'
artifact_checksum='${checksum}'
agent_version='${options.version}'

if [ "$(printenv HEALTHLINK_INSTALLER_TEST_MODE 2>/dev/null || true)" = "1" ]; then
  printf '{"platform":"linux","version":"%s","unitCode":"%s","checksum":"%s","service":"healthlink-agent.service","interactive":false}\n' "$agent_version" "$(printf '%s' "$unit_b64" | base64 -d)" "$artifact_checksum"
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo 'Execute este instalador com sudo ou como root.' >&2
  exit 1
fi

for command_name in curl sha256sum tar base64 systemctl useradd; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "Comando obrigatório ausente: $command_name" >&2; exit 1; }
done

api_url=$(printf '%s' "$api_b64" | base64 -d)
enrollment_token=$(printf '%s' "$token_b64" | base64 -d)
unit_code=$(printf '%s' "$unit_b64" | base64 -d)
install_dir='/opt/healthlink-agent'
runtime_dir="$install_dir/runtime"
release_dir="$install_dir/releases"
data_dir='/var/lib/healthlink-agent'
config_dir='/etc/healthlink-agent'
config_path="$config_dir/agent.json"
agent_path="$release_dir/healthlink-agent.cjs"
service_path='/etc/systemd/system/healthlink-agent.service'

mkdir -p "$install_dir" "$release_dir" "$data_dir" "$config_dir"
if systemctl list-unit-files healthlink-agent.service >/dev/null 2>&1; then systemctl stop healthlink-agent.service || true; fi

node_exe="$runtime_dir/bin/node"
if [ ! -x "$node_exe" ]; then
  case "$(uname -m)" in
    x86_64) node_arch='x64' ;;
    aarch64|arm64) node_arch='arm64' ;;
    *) echo 'Arquitetura Linux não suportada. Use x64 ou ARM64.' >&2; exit 1 ;;
  esac
  archive_name="node-${nodeVersion}-linux-$node_arch.tar.xz"
  temporary_dir=$(mktemp -d)
  trap 'rm -rf "$temporary_dir"' EXIT
  archive_path="$temporary_dir/$archive_name"
  shasums_path="$temporary_dir/SHASUMS256.txt"
  curl -fsSL "https://nodejs.org/dist/${nodeVersion}/$archive_name" -o "$archive_path"
  curl -fsSL "https://nodejs.org/dist/${nodeVersion}/SHASUMS256.txt" -o "$shasums_path"
  expected_node_hash=$(awk -v file="$archive_name" '$2 == file { print $1 }' "$shasums_path")
  [ -n "$expected_node_hash" ] || { echo 'Não foi possível validar o runtime Node.js.' >&2; exit 1; }
  printf '%s  %s\n' "$expected_node_hash" "$archive_path" | sha256sum -c - >/dev/null
  rm -rf "$runtime_dir"
  mkdir -p "$runtime_dir"
  tar -xJf "$archive_path" -C "$runtime_dir" --strip-components=1
fi

artifact_tmp="$release_dir/healthlink-agent.cjs.installing"
base64 -d > "$artifact_tmp" <<'HEALTHLINK_AGENT_ARTIFACT'
${artifactBase64}
HEALTHLINK_AGENT_ARTIFACT
printf '%s  %s\n' "$artifact_checksum" "$artifact_tmp" | sha256sum -c - >/dev/null
mv -f "$artifact_tmp" "$agent_path"
chmod 0755 "$agent_path"

if ! id healthlink-agent >/dev/null 2>&1; then
  useradd --system --home-dir "$data_dir" --shell /usr/sbin/nologin healthlink-agent
fi
chown -R root:root "$runtime_dir"
chown -R healthlink-agent:healthlink-agent "$release_dir" "$data_dir"

backup_config="$config_path.previous"
rm -f "$backup_config"
if [ -f "$config_path" ]; then mv -f "$config_path" "$backup_config"; fi
if ! "$node_exe" "$agent_path" enroll --api "$api_url" --token "$enrollment_token" --config "$config_path" --data-dir "$data_dir" --agent-path "$agent_path"; then
  rm -f "$config_path"
  if [ -f "$backup_config" ]; then mv -f "$backup_config" "$config_path"; fi
  echo 'O agente não conseguiu consumir o enrollment.' >&2
  exit 1
fi
rm -f "$backup_config"
chown healthlink-agent:healthlink-agent "$config_path"
chmod 0600 "$config_path"

cat > "$service_path" <<HEALTHLINK_SYSTEMD_UNIT
[Unit]
Description=HealthLink Sentinel Agent - $unit_code
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=healthlink-agent
Group=healthlink-agent
UMask=0077
ExecStart=$node_exe $agent_path run --config $config_path
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=$release_dir $data_dir

[Install]
WantedBy=multi-user.target
HEALTHLINK_SYSTEMD_UNIT
chmod 0644 "$service_path"
systemctl daemon-reload
systemctl enable --now healthlink-agent.service
systemctl is-active --quiet healthlink-agent.service
echo "HealthLink Sentinel Agent $agent_version instalado e iniciado para $unit_code."
`;
}
