# Deploy NSYNC AI (trading-assistant) edge function to Supabase
# Prerequisites:
#   1. npx supabase login  (or set SUPABASE_ACCESS_TOKEN)
#   2. Set your OpenAI key once:
#        npx supabase secrets set OPENAI_API_KEY=sk-... --project-ref nmcrsrszbzitvauzdfrl
# Then run:
#   .\scripts\deploy-trading-assistant.ps1

$ErrorActionPreference = "Stop"
$ProjectRef = "nmcrsrszbzitvauzdfrl"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Set-Location $Root

Write-Host "`n=== Deploy NSYNC AI (trading-assistant) ===" -ForegroundColor Cyan

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  npx supabase projects list 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "`nNot logged in to Supabase." -ForegroundColor Yellow
    Write-Host "Run: npx supabase login`n" -ForegroundColor White
    exit 1
  }
}

Write-Host "Checking secrets..."
$secrets = npx supabase secrets list --project-ref $ProjectRef 2>&1 | Out-String
if ($secrets -notmatch "OPENAI_API_KEY") {
  Write-Host "`nWARNING: OPENAI_API_KEY is not set in Supabase secrets." -ForegroundColor Yellow
  Write-Host "Set it before using the chatbot:" -ForegroundColor White
  Write-Host "  npx supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY --project-ref $ProjectRef`n" -ForegroundColor White
}

Write-Host "Linking project $ProjectRef ..."
npx supabase link --project-ref $ProjectRef --yes

Write-Host "`nDeploying trading-assistant ..."
npx supabase functions deploy trading-assistant --project-ref $ProjectRef --use-api

Write-Host "`nDone! AI assistant endpoint:" -ForegroundColor Green
Write-Host "  https://$ProjectRef.supabase.co/functions/v1/trading-assistant`n" -ForegroundColor White
