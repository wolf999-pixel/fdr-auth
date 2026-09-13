#!/usr/bin/env pwsh
# Script de configuration réseau pour FDR QR Auth
# Détecte l'IP locale et configure le frontend pour accès par réseau WiFi

Write-Host "=== Configuration réseau FDR QR Auth ===" -ForegroundColor Cyan
Write-Host ""

# Obtenir l'adresse IPv4 WiFi
$ipv4 = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "*WiFi*" | Select-Object -First 1).IPAddress

if (-not $ipv4) {
    Write-Host "Erreur : Impossible de trouver une connexion WiFi active." -ForegroundColor Red
    Write-Host "Assurez-vous que le PC est connecté en WiFi." -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrer pour quitter"
    exit 1
}

Write-Host "✓ Adresse IPv4 détectée : $ipv4" -ForegroundColor Green
Write-Host ""

# Créer le fichier .env.local du frontend
$envLocalPath = ".\frontend\.env.local"
$envLocalContent = "VITE_API_BASE_URL=http://$ipv4`:4000/api"

if (Test-Path $envLocalPath) {
    Write-Host "Mise à jour de $envLocalPath" -ForegroundColor Yellow
} else {
    Write-Host "Création de $envLocalPath" -ForegroundColor Green
}

Set-Content -Path $envLocalPath -Value $envLocalContent -Encoding UTF8

Write-Host ""
Write-Host "✓ Configuration créée !" -ForegroundColor Green
Write-Host ""
Write-Host "Accès depuis le téléphone vérificateur :" -ForegroundColor Cyan
Write-Host "  http://$ipv4`:5173" -ForegroundColor Magenta
Write-Host ""
Write-Host "Flux de démonstration :" -ForegroundColor Cyan
Write-Host "  1. Lancer : npm run dev" -ForegroundColor White
Write-Host "  2. Agent (PC) : http://localhost:5173" -ForegroundColor White
Write-Host "  3. Vérificateur (Téléphone) : http://$ipv4`:5173/verify" -ForegroundColor White
Write-Host ""
Write-Host "Tips :" -ForegroundColor Yellow
Write-Host "  - Le téléphone doit être sur le même WiFi que le PC" -ForegroundColor Gray
Write-Host "  - Aucune authentification requise pour /verify" -ForegroundColor Gray
Write-Host "  - Le QR code redirige automatiquement à la vérification" -ForegroundColor Gray
Write-Host ""
