const fs = require('fs');
const path = require('path');
const http = require('http');

async function test() {
  try {
    const token = await login();
    console.log('AUTH: OK\n');

    const docId = await uploadDocument(token);
    console.log(`DOCUMENT CREATED: ${docId}\n`);

    const qr = await generateQr(token, docId);
    console.log(`QR CREATED: ${qr.qr_uuid}\n`);

    const doc = await getDocument(token, docId);
    console.log('DB CHECK:');
    console.log(`SHA256: ${doc.document.sha256}`);
    console.log(`QRs count: ${doc.document.qrcodes ? doc.document.qrcodes.length : 0}`);

  } catch (error) {
    console.error('TEST FAILED:', error.message);
  }
}

function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email: 'admin@fdr.test', password: 'admin123' });
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    };
    const req = http.request(options, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.token);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function uploadDocument(token) {
  return new Promise((resolve, reject) => {
    const pdfPath = path.join(__dirname, 'test-doc.pdf');
    const fileBuffer = fs.readFileSync(pdfPath);

    const boundary = '----FormBoundary' + Math.random().toString(36);
    let body = `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="reference"\r\n\r\n';
    body += `DOC-TEST-${Date.now()}\r\n`;
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="subject"\r\n\r\n';
    body += 'Document de test\r\n';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="recipient"\r\n\r\n';
    body += 'QA Team\r\n';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="service"\r\n\r\n';
    body += 'Tests\r\n';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="year"\r\n\r\n';
    body += '2026\r\n';
    body += `--${boundary}\r\n`;
    body += 'Content-Disposition: form-data; name="file"; filename="test-doc.pdf"\r\n';
    body += 'Content-Type: application/pdf\r\n\r\n';

    const bodyStart = Buffer.from(body, 'utf8');
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const totalLength = bodyStart.length + fileBuffer.length + bodyEnd.length;

    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/documents',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLength,
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, res => {
      let respBody = '';
      res.on('data', d => respBody += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(respBody);
          resolve(json.document.id);
        } catch (e) {
          reject(new Error(`Response: ${respBody}`));
        }
      });
    });

    req.on('error', reject);
    req.write(bodyStart);
    req.write(fileBuffer);
    req.write(bodyEnd);
    req.end();
  });
}

function generateQr(token, docId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: `/api/documents/${docId}/qr`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Length': 0 }
    };
    const req = http.request(options, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.qr);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function getDocument(token, docId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: `/api/documents/${docId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    };
    const req = http.request(options, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

test();
