# AUDIT FONCTIONNALITÉ 5 - SIGNED DOCUMENT UPLOAD

**Date:** 11 septembre 2026  
**Statut:** AUDIT COMPLET EN COURS  
**Bloqueurs:** 5 IDENTIFIÉS  

---

## 1. STATE AVANT AUDIT

### Architecture de signature électronique:
```
Agent:
  POST /api/documents/:id/signed
  Body: multipart {file: signed PDF}
  ↓
Backend:
  1. Lookup Document par ID
  2. Valider fichier PDF
  3. Stocker fichier en uploads/
  4. Créer ou update SignedDocument record
  5. Créer AuditLog
  6. Retourner 201 {signed_document}

Database:
  SignedDocument: id, documentId (FK), filePath, fileName, uploadedBy (FK User), uploadedAt
  Document can have 0..1 signed version (exclusive)
```

### Code existant:
- **Endpoint:** `POST /api/documents/:id/signed` (auth required, agent+admin roles)
- **Implémentation:** `uploadSignedDocument()` dans documentController.ts (lignes 237-265)
- **Route:** [backend/src/routes/documents.ts](backend/src/routes/documents.ts#L16)
- **Frontend:** [frontend/src/pages/SignedDocumentPage.tsx](frontend/src/pages/SignedDocumentPage.tsx) (STUB)
- **Database:** SignedDocument model in schema.prisma

---

## 2. BLOQUEURS IDENTIFIÉS

### ❌ BLOQUEUR 1: Pas de validation PDF sur document signé

**Localisation:** documentController.ts ligne ~239
```typescript
export async function uploadSignedDocument(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: 'File required' });
  const { id } = req.params;
  // ← NO PDF VALIDATION! Accepts any file type
  
  const finalPath = path.join(uploadsDir, req.file.filename);
  fs.renameSync(req.file.path, finalPath);  // ← Moves file without validation
}
```

**Problème:**
- N'importe quel type de fichier accepté (PNG, DOCX, EXE, etc)
- Pas de vérification magic bytes
- Pas de limite de taille
- Le fichier est déplacé AVANT validation (impossible de rollback)
- Attaquant peut envoyer 1GB de données

**Impact:** CRITIQUE - Sécurité (DoS, disk saturation, corruption)

**Scénario:**
```
Agent croit uploader PDF signé
Mais envoie un fichier PNG par erreur
Document signé "contient" PNG, pas PDF
Vérificateur reçoit PNG au lieu de PDF
```

**Solution requise:** Valider PDF avant déplacer le fichier

---

### ❌ BLOQUEUR 2: Pas de validation UUID documentId

**Localisation:** documentController.ts ligne ~239
```typescript
const { id } = req.params;
const doc = await prisma.document.findUnique({ where: { id } });
// ← No UUID validation, Prisma can throw 500 on malformed ID
```

**Problème:**
- Malformed UUID pas validé
- Prisma lance exception au lieu de retourner gracefully
- HTTP 500 au lieu de 400
- Fuite d'info (Prisma error message)

**Impact:** MODÉRÉ - UX, sécurité

---

### ❌ BLOQUEUR 3: Pas de file cleanup si upload échoue

**Localisation:** documentController.ts lignes 237-265
```typescript
const finalPath = path.join(uploadsDir, req.file.filename);
fs.renameSync(req.file.path, finalPath);

const signed = await prisma.signedDocument.upsert({  // ← Could fail!
  // ...
});
// ← No cleanup if upsert fails!
```

**Problème:**
- Si Prisma upsert échoue → fichier reste sur disque (orphelin)
- Pas de try/catch, pas de finally cleanup
- Accumulation de fichiers zombie

**Impact:** MODÉRÉ - Disk leak, resource management

---

### ❌ BLOQUEUR 4: Pas d'audit log pour signature

**Localisation:** documentController.ts ligne ~265 (no AuditLog created)

**Problème:**
- Aucun log de qui a uploadé version signée, quand
- Pas de traçabilité pour compliance
- Spécification recommande audit trails complets

**Impact:** MODÉRÉ - Compliance, audit trail

---

### ❌ BLOQUEUR 5: Frontend stub - formulaire ne fonctionne pas

**Localisation:** [frontend/src/pages/SignedDocumentPage.tsx](frontend/src/pages/SignedDocumentPage.tsx)
```typescript
const handleSubmit = (event: FormEvent) => {
  event.preventDefault();
  if (!file) return;
  setMessage(`Document signé enregistré : ${file.name}`);  // ← FAKE! Never sends to API
};
```

**Problème:**
- Formulaire ne fait RIEN
- Juste affiche message statique
- N'envoie pas req HTTP vers `/documents/:id/signed`
- Pas de documentId sélectionné
- Pas de gestion d'erreur
- Pas de redirect après succès

**Impact:** CRITIQUE - Feature completely non-functional

**Scénario:**
```
Agent ouvre SignedDocumentPage
Choisit fichier PDF signé
Clique "Enregistrer"
↓
Message "Document signé enregistré : ...pdf" apparaît (FAKE)
Mais EN RÉALITÉ rien n'a été envoyé au serveur
Personne ne le sait
Variable d'état local juste mise à jour
```

---

## 3. VÉRIFICATIONS POSITIVES ✅

- ✅ Route protégée (auth + role check: agent/admin)
- ✅ Document lookup implémenté
- ✅ File handling (rename) implémenté
- ✅ Database upsert implémenté
- ✅ Response structure correct

---

## 4. PLAN DE CORRECTION

**Phase 1 - BLOQUEURS CRITIQUES** (avant validation):
1. Valider PDF + UUID documentId
2. Implémenter file cleanup + try/catch
3. Fixer frontend pour vraiment envoyer au serveur

**Phase 2 - BLOCKERS MODÉRÉS**:
4. Ajouter audit log
5. Valider que document existe ET a un QR valide (non-revoqué)

**Effort estimé:**
- Phase 1: ~30 min
- Phase 2: ~20 min

---

## 5. CHECKLIST AVANT VALIDATION

- [ ] Fichier uploadé validé (PDF only, size limit)
- [ ] UUID documentId validé (400 si malformé)
- [ ] File cleanup si upload échoue
- [ ] AuditLog créé pour chaque upload signé
- [ ] Frontend formulaire vraiment envoie au serveur
- [ ] Frontend gère erreurs et succès
- [ ] Frontend redirect après succès (vers view page?)
- [ ] Test: Upload PDF signé valide → 201
- [ ] Test: Upload fichier non-PDF → 400
- [ ] Test: Upload à document inexistant → 404

---

**CONCLUSION:** Fonctionnalité 5 partiellement implémentée, mais **2 BLOQUEURS CRITIQUES** (PDF validation + Frontend stub) empêchent utilisation. À corriger avant passage à Func 6.
