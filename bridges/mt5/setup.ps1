$ErrorActionPreference = "Stop"

$bridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $bridgeDir

if (-not (Test-Path ".venv")) {
  py -3 -m venv .venv
}

& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env. Add SUPABASE_URL, SUPABASE_ANON_KEY, and MT5_BRIDGE_KEY before running."
}

Write-Host "MT5 bridge setup complete."
