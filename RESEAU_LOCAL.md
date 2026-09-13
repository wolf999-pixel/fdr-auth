# FDR QR Auth — Configuration Réseau Local WiFi

## 🎯 Objectif
Système d'authentification des documents en réseau fermé WiFi local, conçu pour une démonstration de soutenance avec :
- **PC (Serveur)** : Backend + Frontend
- **Téléphone 1** : Hotspot WiFi
- **Téléphone 2** : Vérificateur (scanne QR, pas besoin authentification)

## 🚀 Démarrage rapide

### 1️⃣ Configuration automatique (recommandé)

Depuis la racine du projet, exécute le script PowerShell :

```powershell
powershell -ExecutionPolicy Bypass -File setup-network.ps1
```

Ce script détecte automatiquement votre adresse IPv4 et configure le frontend.

### 2️⃣ Lancer les serveurs

```bash
npm run dev
```

Vous verrez dans la console :
```
Backend running on port 4000
Frontend running on port 5173 (ou le prochain port libre)
```

### 3️⃣ Accès depuis le navigateur

**Agent (enregistrement) — Sur le PC :**
```
http://localhost:5173
```
Identifiants :
- Email : `admin@example.com`
- Mot de passe : `password`

**Vérificateur (scan QR) — Sur le téléphone :**
```
http://192.168.x.x:5173/verify
```
(Remplace `192.168.x.x` par l'IP détectée par le script ou visible dans la console)

---

## 📋 Flux complet de démonstration

### Étape 1 : Enregistrement du document (Agent sur PC)
1. Ouvrir : http://localhost:5173
2. Login avec `admin@example.com` / `password`
3. Aller à "Nouveau document"
4. Remplir les champs (référence, objet, destinataire, service, année)
5. Télécharger un fichier PDF
6. Cliquer "Enregistrer le document"

### Étape 2 : Générer le QR code (Agent sur PC)
1. Aller à "QR codes"
2. Cliquer "Générer QR" pour le document
3. **Scanner le QR code** avec un APP scanner sur le téléphone vérificateur (par exemple)

### Étape 3 : Vérifier l'authenticité (Vérificateur sur téléphone)
1. Scanner le QR code
2. Cela ouvre automatiquement : `http://192.168.x.x:5173/verify?token=...`
3. Cliquer "Vérifier"
4. Résultat : **DOCUMENT AUTHENTIQUE** ✓ ou **DOCUMENT NON AUTHENTIQUE** ✗

---

## ⚙️ Configuration manuelle (si le script ne fonctionne pas)

### Trouver votre adresse IPv4

Ouvre PowerShell et tape :
```powershell
ipconfig
```

Cherche sous ta connexion WiFi :
```
Adresse IPv4 . . . . . . . . . . . : 192.168.1.100
```

### Configurer le frontend manuellement

Modifie `frontend/.env.local` :
```env
VITE_API_BASE_URL=http://192.168.1.100:4000/api
```

Remplace `192.168.1.100` par ton adresse réelle.

---

## 🔒 Points clés de sécurité

- ✅ **Aucune auth requise pour `/verify`** : Les vérificateurs externes peuvent scanner sans login
- ✅ **Backend isolé sur le réseau WiFi local** : Pas d'exposition internet
- ✅ **JWT valides localement** : Tokens générés sur le serveur local uniquement
- ✅ **QR tokens signés** : Impossible de falsifier un QR code sans la clé privée du serveur

---

## 📱 Réseau WiFi requis

Assurez-vous que tous les appareils sont connectés au **même réseau WiFi** :

```
┌─────────────────────────────────────────┐
│     Réseau WiFi (Téléphone 1 Hotspot)   │
├────────────────────┬────────────────────┤
│                    │                    │
│  PC (192.168.1.100)│  Téléphone 2      │
│  Backend + Frontend│  (Vérificateur)    │
│                    │                    │
└────────────────────┴────────────────────┘
```

---

## 🧪 Tests manuels

### Test 1 : Vérifier que l'API répond

```bash
curl http://192.168.1.100:4000/api
```

Réponse attendue :
```json
{
  "message": "FDR QR Auth API is running",
  "status": "ok"
}
```

### Test 2 : Tester la connexion

```bash
curl -X POST http://192.168.1.100:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"password\":\"password\"}"
```

---

## ❌ Troubleshooting

### Le téléphone ne peut pas accéder à l'adresse

- Vérifier que le téléphone est sur le **même WiFi** que le PC
- Vérifier l'**adresse IPv4** avec `ipconfig`
- Vérifier que le **firewall Windows** n'est pas en travers (voir section Firewall ci-dessous)

### Le firewall Windows bloque

Exécute en admin PowerShell :
```powershell
New-NetFirewallRule -DisplayName "FDR Backend" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "FDR Frontend" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow
```

### L'adresse IP change après redémarrage

Configurer une **adresse IP statique** sur la carte WiFi du PC ou relancer le script `setup-network.ps1`.

---

## 📖 Architecture

```
Frontend (React)
  ├─ /login (publique)
  ├─ /dashboard, /documents, /history (protégées, avec auth)
  └─ /verify (publique, sans auth — pour vérificateurs externes)

Backend (Express)
  ├─ POST /api/auth/login
  ├─ POST /api/documents
  ├─ GET /api/documents
  ├─ POST /api/documents/:id/qr
  ├─ POST /api/verify (publique, pas d'auth requise)
  └─ GET /api/history

Stockage (mode démo)
  └─ En mémoire (documents, QR codes, vérifications)
```

---

## 📝 Cas de test pour la soutenance

| # | Scénario | Acteur | Résultat attendu |
|---|----------|--------|-----------------|
| 1 | QR valide + document original | Vérificateur | ✓ AUTHENTIQUE |
| 2 | QR valide + document modifié | Vérificateur | ✗ NON AUTHENTIQUE |
| 3 | QR inexistant | Vérificateur | ✗ NON AUTHENTIQUE |
| 4 | QR du doc A sur doc B | Vérificateur | ✗ NON AUTHENTIQUE |
| 5 | Login valide | Agent | ✓ Token reçu |
| 6 | Login invalide | Agent | ✗ 401 Unauthorized |
| 7 | Accès protégé sans token | Agent | ✗ 401 Unauthorized |
| 8 | Accès /verify sans auth | Vérificateur | ✓ Page chargée |

---

## 💡 Tips pour la soutenance

1. **Lancer une fois** : `npm run dev` depuis la racine, puis laisser tourner
2. **Démo agent** : Utiliser le PC pour enregistrer et générer le QR
3. **Démo vérificateur** : Utiliser le téléphone pour scanner et vérifier
4. **Montrer les logs** : Les deux terminaux affichent les appels API en temps réel
5. **Préparer un QR d'avance** : Screenshot le QR généré pour le scanner facilement

---

## 🎓 Pour la soutenance

Le système démontre :
- **Architecture moderne** : React + Node.js + REST API
- **Authentification sécurisée** : JWT + bcrypt
- **Cryptographie** : SHA-256 pour empreinte + QR token signé
- **Réseau local fermé** : Indépendant d'internet
- **UX responsif** : Fonctionne sur PC et téléphone

Bon courage pour la soutenance ! 🚀
