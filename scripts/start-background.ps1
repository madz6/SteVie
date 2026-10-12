$ErrorActionPreference = 'Stop'
$stevieRoot = Split-Path -Parent $PSScriptRoot
# A single listener owns the queue. Never terminate an unrelated process.
try {
    $stevieHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:4317/api/health' -TimeoutSec 3
    if ($stevieHealth.app -eq 'stevie') { exit 0 }
} catch { }
$stevieNode = (Get-Command node.exe -ErrorAction Stop).Source
$stevieRuntime = Join-Path $stevieRoot '.runtime'
New-Item -ItemType Directory -Force -Path $stevieRuntime | Out-Null
Start-Process -FilePath $stevieNode -WorkingDirectory $stevieRoot -WindowStyle Hidden -ArgumentList '--env-file-if-exists=.env --import tsx server/index.ts --production' -RedirectStandardOutput (Join-Path $stevieRuntime 'server.log') -RedirectStandardError (Join-Path $stevieRuntime 'server-error.log') | Out-Null
