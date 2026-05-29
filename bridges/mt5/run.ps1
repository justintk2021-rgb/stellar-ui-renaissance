$ErrorActionPreference = "Stop"

$bridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $bridgeDir

if (-not (Test-Path ".venv\Scripts\python.exe")) {
  Write-Host "Virtual environment not found. Running setup first."
  & ".\setup.ps1"
}

& ".\.venv\Scripts\python.exe" ".\mt5_bridge.py"
