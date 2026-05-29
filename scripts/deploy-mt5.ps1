# Deploy MT5 bridge edge function + migrations to Supabase
# Run once: npx supabase login
# Then:     .\scripts\deploy-mt5.ps1

$ErrorActionPreference = "Stop"
$ProjectRef = "nmcrsrszbzitvauzdfrl"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Set-Location $Root

Write-Host "`n=== Supabase MT5 deploy ===" -ForegroundColor Cyan

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  $projects = npx supabase projects list 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "`nNot logged in to Supabase." -ForegroundColor Yellow
    Write-Host "Run: npx supabase login`n" -ForegroundColor White
    exit 1
  }
}

Write-Host "Linking project $ProjectRef ..."
npx supabase link --project-ref $ProjectRef --yes

Write-Host "`nPushing database migrations ..."
npx supabase db push --yes

Write-Host "`nDeploying mt5-bridge edge function ..."
npx supabase functions deploy mt5-bridge --project-ref $ProjectRef --use-api

Write-Host "`nDone! MT5 bridge function is live at:" -ForegroundColor Green
Write-Host "  https://$ProjectRef.supabase.co/functions/v1/mt5-bridge`n" -ForegroundColor White
