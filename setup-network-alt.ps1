#!/usr/bin/env pwsh
# Script alternatif de configuration réseau — plus robuste
# Détecte toute adresse IPv4 accessible

Write-Host "=== Configuration réseau FDR QR Auth ===" -ForegroundColor Cyan
Write-Host ""

# Méthode 1 : Chercher WiFi
$ipv4 = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "*WiFi*" -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress

# Méthode 2 : Si WiFi pas trouvé, chercher n'importe quelle interface active
if (-not $ipv4) {
    $ipv4 = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" } | Select-Object -First 1).IPAddress
}

# Méthode 3 : Afficher toutes les interfaces disponibles
if (-not $ipv4) {
    Write-Host "Interfaces réseau disponibles :" -ForegroundColor Yellow
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object InterfaceAlias, IPAddress | Format-Table
    
    Write-Host ""
    Write-Host "Veuillez entrer manuellement votre adresse IPv4 (par ex: 192.168.1.100):" -ForegroundColor Yellow
    $ipv4 = Read-Host "IPv4"
    
    if (-not $ipv4) {
        Write-Host "Erreur : Aucune adresse IPv4 fournie." -ForegroundColor Red
        Read-Host "Appuyez sur Entrer pour quitter"
        exit 1
    }
}

Write-Host "✓ Adresse IPv4 détectée/fournie : $ipv4" -ForegroundColor Green
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
Write-Host "  http://$ipv4`:5173/verify" -ForegroundColor Magenta
Write-Host ""
Write-Host "Pour démarrer :" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Tips :" -ForegroundColor Yellow
Write-Host "  - Téléphone doit être sur le même WiFi" -ForegroundColor Gray
Write-Host "  - /verify est publique (pas d'authentification)" -ForegroundColor Gray
Write-Host ""
