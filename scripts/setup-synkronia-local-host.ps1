# Executar como Administrador (PowerShell):
#   Set-ExecutionPolicy -Scope Process Bypass; .\scripts\setup-synkronia-local-host.ps1
#
# Adiciona synkronia.local → 127.0.0.1 no hosts do Windows.
# Alternativa sem admin: use http://synkronia.lvh.me:3001 (já resolve para 127.0.0.1).

$hostsPath = "$env:Windir\System32\drivers\etc\hosts"
$entry = "127.0.0.1       synkronia.local"
$marker = "# escritorio-virtual synkron dev"

$content = Get-Content $hostsPath -Raw -ErrorAction Stop
if ($content -match "synkronia\.local") {
  Write-Host "synkronia.local ja existe no hosts." -ForegroundColor Green
  exit 0
}

$block = "`n$marker`n$entry`n"
Add-Content -Path $hostsPath -Value $block -Encoding ASCII
Write-Host "Adicionado: $entry" -ForegroundColor Green
Write-Host "Acesse: http://synkronia.local:3001" -ForegroundColor Cyan
