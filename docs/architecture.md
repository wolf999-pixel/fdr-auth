Résumé de l'architecture — Système d'authentification des documents signés

Décisions principales

- Frontend : React + TypeScript (React Router, Axios, Context API). UI responsive et sobre.
- Backend : Node.js + Express + TypeScript. ORM recommandé : Prisma (PostgreSQL).
- Auth : bcrypt (password hashing) + JWT pour sessions.
- QR tokens : payload signé (JWS/JWT). Préférence : signature asymétrique (RS256/ES256). Clé privée hors repo (env/KMS).
- Stockage fichiers : `uploads/` local en dev ; S3/Azure Blob recommandé en prod.
- Crypto : SHA-256 pour empreinte des fichiers.

Sécurité & opérations

- TLS obligatoire en production.
- Limiter accès aux fichiers et mettre en place des logs/audit.
- Liste de révocation des QR (`revoked` flag) pour invalidation sans suppression.
- Politique de conservation des documents à confirmer auprès du maître de stage.

Fichiers ajoutés

- `schema/sql/schema.sql` : script SQL initial pour PostgreSQL.
- `uml/db_er.puml` : diagramme ERD PlantUML.

Prochaines étapes recommandées

1. Définir les endpoints API (contrats request/response).
2. Initialiser le repo backend (TypeScript + Prisma) et exécuter le script SQL.
3. Créer les modèles Prisma (si choisi) et migrations.

Choix suivant ?
- Générer la définition détaillée des endpoints API.
- Initialiser le squelette backend (package.json, tsconfig, app.ts, connexion DB).
