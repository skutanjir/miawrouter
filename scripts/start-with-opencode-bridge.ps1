$ErrorActionPreference = 'Stop'
$bridgeDirectory = Join-Path $env:APPDATA 'miawrouter\integrations\opencode-free-bridge'
$bun = (Get-Command bun -ErrorAction Stop).Source
$bridgeProcess = $null

if (!(Test-Path -LiteralPath (Join-Path $bridgeDirectory 'server.js'))) {
  throw "OpenCode Free Bridge is not installed at $bridgeDirectory"
}

try {
  try {
    $health = Invoke-RestMethod 'http://127.0.0.1:20129/health' -TimeoutSec 2
    if ($health.status -ne 'ok') { throw 'Unexpected service on port 20129' }
  } catch {
    if (Get-NetTCPConnection -LocalPort 20129 -State Listen -ErrorAction SilentlyContinue) { throw }
    $env:HOST = '127.0.0.1'
    $env:PORT = '20129'
    $env:AUTO_UPDATE = '0'
    $bridgeProcess = Start-Process -FilePath $bun -ArgumentList 'server.js' -WorkingDirectory $bridgeDirectory -WindowStyle Hidden -PassThru
    Remove-Item Env:HOST, Env:PORT, Env:AUTO_UPDATE -ErrorAction SilentlyContinue
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      try {
        $health = Invoke-RestMethod 'http://127.0.0.1:20129/health' -TimeoutSec 1
        if ($health.status -eq 'ok') { $ready = $true; break }
      } catch { Start-Sleep -Seconds 1 }
    }
    if (!$ready) { throw 'OpenCode Free Bridge did not start.' }
  }

  & npm run dev
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  if ($bridgeProcess -and !$bridgeProcess.HasExited) { Stop-Process -Id $bridgeProcess.Id }
}
