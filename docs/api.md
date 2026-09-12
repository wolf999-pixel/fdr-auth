API REST — Spécification pour Express

Authentification générale
- Header: `Authorization: Bearer <JWT>`
- JWT contient `sub` (user id), `role` (agent|verifier|admin), `exp`.

Errors comunes
- 400 Bad Request — payload invalide
- 401 Unauthorized — token manquant/invalid
- 403 Forbidden — rôle insuffisant
- 404 Not Found — ressource introuvable
- 500 Internal Server Error — erreur serveur

Endpoints principaux

1) POST /api/auth/login
- Rôle: public
- Body: { "email": "...", "password": "..." }
- Réponse 200: { "token": "<JWT>", "user": { id, full_name, email, role } }
- Erreurs: 400, 401

2) POST /api/auth/register  (optionnel, admin)
- Rôle: admin
- Body: { "full_name","email","password","role" }
- Réponse 201: created user
- Erreurs: 400, 403

3) POST /api/documents
- Rôle: agent
- Auth: required
- Multipart form-data: file: PDF, metadata: reference, subject, recipient, service, year
- Traitement: stock file, calc SHA-256, create document row
- Réponse 201: { document: { id, reference, sha256, file_path, ... } }
- Erreurs: 400, 401, 403

4) GET /api/documents
- Rôle: agent/admin
- Query: ?page=&limit=&service=&year=
- Réponse 200: { data: [documents], meta }

5) GET /api/documents/:id
- Rôle: agent/admin
- Réponse 200: document details (without file binary) ; pour télécharger le fichier route séparée

6) GET /api/documents/:id/file
- Rôle: agent/admin (ou rôle avec accès)
- Réponse: file stream (Content-Type: application/pdf)

7) POST /api/documents/:id/qr
- Rôle: agent
- Auth required
- Body: optional params (expire_at?)
- Traitement: gen qr_uuid, build payload {qr_uuid, document_id, sha256, issued_at}, sign payload (RS256 or HS256), generate token (JWS/JWT), generate QR image (data-URL or PNG), save qr_codes row
- Réponse 201: { qr: { id, qr_uuid, token, qr_image_data_url, created_at } }

8) POST /api/documents/:id/signed
- Rôle: agent
- Multipart: file signed PDF
- Traitement: store file, create signed_documents row (link to document)
- Réponse 201: { signed_document }

9) POST /api/verify
- Rôle: public (recommande: rate-limit, captcha)
- Body: { token: "<from QR>", file: (optional) PDF }
- Traitement:
  1. Parse token, verify signature
  2. Lookup qr_uuid in `qr_codes`
  3. If not found or revoked => result: NON_AUTHENTIQUE, reason
  4. If file provided: calc sha256 and compare to payload.sha256
  5. If no file provided: server can optionally fetch original or return info only
  6. Create verifications row with result and reason
- Réponse 200: { result: "AUTHENTIQUE" | "NON_AUTHENTIQUE", reason, qr: { qr_uuid, document_id }, document: {meta if allowed} }
- Erreurs: 400, 401 (if private), 429

10) GET /api/history
- Rôle: admin/agent (with filters)
- Query: ?user_id=&from=&to=&type=verify|create|qr
- Réponse: { data: [audit entries or verifications] }

Sécurité & règles
- JWT expiry: e.g., 1h for sessions
- QR token: signé (RS256 recommended). Keep private key off-repo (env/KMS). Public key can be used by external verifier services if desired.
- Rate-limit `/api/verify` and log every attempt.
- Store minimal PII; sanitize uploaded filenames.
- Use `Content-Security-Policy`, `helmet`, `cors` configured to allowed origins.

Exemples de payloads
- Payload QR (stored in `payload` JSONB):
  {
    "qr_uuid": "...",
    "document_id": "...",
    "sha256": "...",
    "issued_at": "2026-09-09T12:00:00Z"
  }

Notes d'implémentation Express
- Middleware: `authVerify` (JWT), `roleCheck(['agent'])`, `multer` pour uploads, `errorHandler`
- Services: `documentService` (store file + sha256), `qrService` (sign + generate qrcode), `verifyService` (verify token + compare hash)
- DB access via Prisma or pg pool

Prochaine étape: générer le squelette Express/TypeScript (fichiers créés) ou générer un spec OpenAPI si vous préférez Swagger UI.