const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = 'http://localhost:4000';
const PDF_PATH = path.join(__dirname, '..', 'tmp_fdr_test.pdf');

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@fdr.test', password: 'admin123' })
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`);
  }

  const json = await res.json();
  return json.token;
}

async function uploadDocument(token, filePath) {
  const form = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const file = new File([fileBuffer], 'tmp_fdr_test.pdf', { type: 'application/pdf' });
  form.append('file', file);
  form.append('reference', `DIAG-${Date.now()}`);
  form.append('subject', 'Diagnostic PDF 0 Ko');
  form.append('recipient', 'Test');
  form.append('service', 'Diagnostic');
  form.append('year', '2026');

  const res = await fetch(`${BASE}/api/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  console.log('A. taille original navigateur:', fileBuffer.length);
  console.log('POST /api/documents status:', res.status);
  console.log('POST /api/documents response:', JSON.stringify(json).slice(0, 400));

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  return json.document;
}

async function getFileSize(filePath) {
  try {
    return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  } catch {
    return 0;
  }
}

async function main() {
  console.log('\n=== DIAGNOSTIC ÉTAPE PAR ÉTAPE - FICHIER PDF 0 KO ===\n');
  const token = await login();
  const pdfPath = PDF_PATH;
  const originalSize = fs.statSync(pdfPath).size;
  console.log('A. PDF original navigateur:', originalSize, 'octets');

  const doc = await uploadDocument(token, pdfPath);
  console.log('B. doc.upload response id:', doc?.id);
  console.log('C. filePath DB:', doc?.filePath);
  console.log('D. size filePath physique après upload:', await getFileSize(doc.filePath));

  const diskAfterUpload = await getFileSize(doc.filePath);
  const hashAfterUpload = crypto.createHash('sha256').update(fs.readFileSync(doc.filePath)).digest('hex');
  console.log('E. SHA256 après upload:', hashAfterUpload.slice(0, 16));

  const qrRes = await fetch(`${BASE}/api/documents/${doc.id}/qr`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const qrText = await qrRes.text();
  console.log('QR generation status:', qrRes.status);
  console.log('QR response size bytes:', Buffer.byteLength(qrText));
  console.log('F. size filePath après QR:', await getFileSize(doc.filePath));

  const rawFileRes = await fetch(`${BASE}/api/documents/${doc.id}/file`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const rawBytes = Buffer.from(await rawFileRes.arrayBuffer());
  console.log('G. route GET /file status:', rawFileRes.status);
  console.log('H. route GET /file body size:', rawBytes.length);
  console.log('I. size filePath juste avant download:', await getFileSize(doc.filePath));

  const secureRes = await fetch(`${BASE}/api/documents/${doc.id}/secure-pdf`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  const secureBytes = Buffer.from(await secureRes.arrayBuffer());
  console.log('J. route GET /secure-pdf status:', secureRes.status);
  console.log('K. route GET /secure-pdf body size:', secureBytes.length);
  console.log('L. taille fichier physique final:', await getFileSize(doc.filePath));

  const browserBlob = secureBytes;
  console.log('M. Blob frontend simulé size:', browserBlob.length);
  console.log('N. SHA256 original vs downloaded:',
    crypto.createHash('sha256').update(fs.readFileSync(pdfPath)).digest('hex').slice(0, 20),
    'vs',
    crypto.createHash('sha256').update(secureBytes).digest('hex').slice(0, 20)
  );

  console.log('\n=== RÉSUMÉ ===');
  console.log('Original navigateur:', originalSize);
  console.log('Stocké sur disque:', diskAfterUpload);
  console.log('GET /file:', rawBytes.length);
  console.log('GET /secure-pdf:', secureBytes.length);
  console.log('Blob frontend simulé:', browserBlob.length);
}

main().catch((e) => {
  console.error('DIAGNOSTIC ERROR:', e);
  process.exit(1);
});
