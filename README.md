# FDR QR Auth

Système d’authentification et de vérification de documents signés pour le Fonds Routier (FDR), conçu pour une démonstration en environnement local Wi‑Fi et en mode soutenance.

Le projet permet à un agent d’enregistrer des documents, de générer un QR code associé, puis à un vérificateur de scanner le QR pour vérifier si le document est authentique ou a été altéré.

## Objectif du projet

- Gérer les documents administratifs du Fonds Routier
- Générer un QR code unique par document
- Vérifier automatiquement l’authenticité d’un document via un token sécurisé
- Faciliter la validation en réseau local sans dépendre d’Internet
- Produire une démonstration fonctionnelle pour la soutenance

## Fonctionnalités principales

- Authentification des utilisateurs
- Gestion des rôles utilisateur
- Enregistrement de documents PDF
- Calcul d’empreinte numérique (hash SHA-256)
- Génération de QR codes sécurisés
- Vérification publique d’un document sans connexion utilisateur
- Historique des vérifications et des documents
- Interface web React pour l’administration et la vérification
- Backend API Express pour la logique métier
- Support Docker pour un déploiement rapide

## Stack technique

### Frontend
- React
- TypeScript
- Vite
- React Router
- Axios
- QRCode React

### Backend
- Node.js
- Express
- TypeScript
- JWT
- Prisma
- PostgreSQL (en environnement Docker / production)
- Multer pour l’upload de fichiers
- PDF-lib / QR generation

## Architecture du projet

```text
système/
├── backend/              # API Express + logique métier
├── frontend/             # Interface utilisateur React
├── docs/                 # Documentation et fichiers annexes
├── schema/               # Schémas et modèles de données
├── uml/                  # Diagrammes UML
├── docker-compose.yml    # Déploiement Docker local
├── docker-compose.prod.yml
├── .env.example          # Exemple de variables d’environnement
├── setup-network.ps1     # Script de configuration IP locale
├── RESEAU_LOCAL.md       # Guide réseau local Wi‑Fi
├── package.json          # Scripts racine
├── README.md
└── ...
```

## Prérequis

Avant de lancer le projet, vérifiez que vous avez installé :

- Node.js 18 ou supérieur
- npm
- Git
- Docker et Docker Compose (optionnel, pour le mode conteneurisé)
- PowerShell (pour le script réseau local sur Windows)

## Installation locale

### 1. Cloner le projet

```bash
git clone https://github.com/wolf999-pixel/fdr-auth.git
cd fdr-auth
```

### 2. Installer les dépendances

Depuis la racine du projet :

```bash
npm install
```

Puis installer les dépendances backend et frontend :

```bash
npm --prefix backend install
npm --prefix frontend install
```

### 3. Configurer les variables d’environnement

Copiez le fichier exemple :

```bash
cp .env.example .env
```

Ou sur Windows PowerShell :

```powershell
Copy-Item .env.example .env
```

Configurez ensuite les valeurs selon votre environnement.

### 4. Lancer l’application

Depuis la racine :

```bash
npm run dev
```

Cela lance simultanément :
- Backend sur le port `4000`
- Frontend sur le port `5173`

### 5. Accès à l’application

- Frontend (PC): `http://localhost:5173`
- API: `http://localhost:4000/api`
- Vérification QR: `http://<IP_LOCALE>:5173/verify`

## Déploiement Docker

### Démarrage rapide avec Docker Compose

```bash
docker-compose up --build
```

Cela démarre :
- backend
- frontend
- base PostgreSQL

Accès :
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Base de données: `localhost:5432`

Pour arrêter les conteneurs :

```bash
docker-compose down
```

## Configuration réseau local Wi‑Fi

Pour une démonstration sur téléphone, le projet est conçu pour fonctionner sur un réseau local isolé.

### Étape recommandée

Depuis la racine :

```powershell
powershell -ExecutionPolicy Bypass -File setup-network.ps1
```

Le script détecte automatiquement l’adresse IPv4 du PC et met à jour la configuration locale pour que les QR codes pointent vers la bonne adresse.

### Variables importantes

#### Backend
```env
PUBLIC_APP_URL=http://<VOTRE_IP>:5173
```

#### Frontend
```env
VITE_API_BASE_URL=http://<VOTRE_IP>:4000/api
```

## Comptes de démonstration

Par défaut, l’application est préparée avec des comptes de test. Exemple :

- Email: `admin@example.com`
- Mot de passe: `password`

## Flux de démonstration

### 1. Se connecter
- Ouvrir le frontend sur le PC
- Se connecter avec le compte administrateur

### 2. Enregistrer un document
- Déposer un document PDF
- Saisir les informations liées au document
- Enregistrer le document

### 3. Générer le QR code
- Sélectionner le document
- Générer le QR code associé

### 4. Vérifier sur un téléphone
- Scanner le QR code depuis un autre appareil connecté au même Wi‑Fi
- Ouvrir la page de vérification
- Vérifier si le document est authentique

## Routes principales

### API backend
- `GET /api` → Vérification de disponibilité de l’API
- `POST /api/auth/login` → Connexion
- `POST /api/documents` → Création d’un document
- `GET /api/documents` → Liste des documents
- `POST /api/documents/:id/qr` → Génération du QR
- `POST /api/verify` → Vérification d’un QR/document
- `GET /api/history` → Historique

### Frontend
- `/login` → connexion
- `/dashboard` → tableau de bord
- `/documents` → enregistrement des documents
- `/qr` → affichage du QR
- `/verify` → vérification publique
- `/history` → historique

## Bonnes pratiques de sécurité

- Utiliser une clé JWT forte en production
- Ne pas exposer les secrets dans le dépôt Git
- Vérifier le réseau local et le pare-feu lors d’une démonstration Wi‑Fi
- Remplacer les valeurs de démonstration par des données réelles avant un déploiement production

## Dépannage

### Le QR pointe vers localhost au lieu de l’IP locale
- Vérifier les variables d’environnement du frontend et du backend
- Vérifier que le navigateur ne recharge pas une ancienne version
- Relancer le serveur frontend après modification

### Le téléphone ne peut pas ouvrir la page
- Vérifier que le téléphone est sur le même Wi‑Fi
- Vérifier l’IPv4 du PC avec `ipconfig`
- Vérifier le pare-feu Windows si nécessaire

## Licence

Ce projet est fourni à des fins pédagogiques et de démonstration.

## Auteurs

Projet développé dans le cadre d’une soutenance technique / projet de fin d’études.

## Contact

Pour toute demande d’information ou de support technique, merci de contacter le responsable du projet ou l’équipe de développement.
