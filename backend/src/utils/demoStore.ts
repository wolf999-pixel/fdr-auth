import crypto from 'crypto';

export type DemoDocument = {
  id: string;
  reference: string | null;
  subject: string | null;
  recipient: string | null;
  service: string | null;
  year: number | null;
  filePath: string;
  fileName: string;
  sha256: string;
  createdBy: string | null;
  createdAt: string;
  signedDocument?: DemoSignedDocument | null;
};

export type DemoSignedDocument = {
  id: string;
  documentId: string;
  filePath: string;
  fileName: string;
  uploadedBy: string | null;
  uploadedAt: string;
};

export type DemoQrCode = {
  id: string;
  qrUuid: string;
  documentId: string;
  payload: Record<string, any>;
  signature: string;
  token: string;
  revoked: boolean;
  createdAt: string;
};

export type DemoVerification = {
  id: string;
  qrCodeId: string | null;
  documentId: string | null;
  result: string;
  reason: string | null;
  verifierInfo: Record<string, any> | null;
  createdAt: string;
};

export const demoState = {
  documents: [] as DemoDocument[],
  qrcodes: [] as DemoQrCode[],
  verifications: [] as DemoVerification[],
  auditLogs: [] as Array<{ id: string; userId: string | null; action: string; metadata: any; createdAt: string }>
};

export function isDemoMode() {
  return process.env.ALLOW_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
}

export function computeSha256(buffer: Buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function createDemoToken(payload: Record<string, unknown>) {
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'devsecret';
  return jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
}

export function createDemoQrToken(document: DemoDocument) {
  const payload = {
    qr_uuid: crypto.randomUUID(),
    document_id: document.id,
    sha256: document.sha256,
    issued_at: new Date().toISOString()
  };

  const token = createDemoToken(payload);
  const qr: DemoQrCode = {
    id: crypto.randomUUID(),
    qrUuid: payload.qr_uuid,
    documentId: document.id,
    payload,
    signature: 'demo-signature',
    token,
    revoked: false,
    createdAt: new Date().toISOString()
  };

  demoState.qrcodes.push(qr);
  return { token, qr };
}
