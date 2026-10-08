$ErrorActionPreference = 'Stop'

$bin = (Resolve-Path (Join-Path $PSScriptRoot '..\.runtime\claude\node_modules\@anthropic-ai\claude-code\bin')).Path
$client = Join-Path $bin 'claude.exe'
if (-not (Test-Path -LiteralPath $client)) {
  throw "The project-local Claude Code executable was not found at $client. Re-run the project dependency setup first."
}

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$parts = @($userPath -split ';' | Where-Object { $_ -and $_.Trim() })
if ($parts -notcontains $bin) {
  [Environment]::SetEnvironmentVariable('Path', (($parts + $bin) -join ';'), 'User')
}
$env:Path = "$bin;$env:Path"

Write-Host "Claude Code is available for this PowerShell session and future user sessions."
Write-Host "Starting the official Claude sign-in flow..."
& $client auth login
