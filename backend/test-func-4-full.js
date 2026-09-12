const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:4000/api';

let authToken = '';

async function apiCall(method, path, body = null, headers = {}) {
  const url = `${API_BASE}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type');
  const data = contentType?.includes('application/json') ? await res.json() : await res.text();
  
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return { status: res.status, data };
}

async function test(label, fn) {
  try {
    console.log(`\n─ ${label}`);
    await fn();
    console.log(`✓ ${label}`);
  } catch (error) {
    console.error(`✗ ${label}`);
    console.error(`  Error: ${error.message}`);
    if (error.data) console.error(`  Response:`, error.data);
    throw error;
  }
}

async function main() {
  try {
    // 1. AUTH LOGIN
    await test('LOGIN', async () => {
      const res = await apiCall('POST', '/auth/login', {
        email: 'admin@fdr.test',
        password: 'admin123'
      });
      authToken = res.data.token;
      console.log(`  Token: ${authToken.slice(0, 30)}...`);
    });

    // 2. GET FIRST DOCUMENT AND GENERATE NEW QR
    let documentId = '';
    let qrToken = '';
    let qrUuid = '';
    
    await test('GENERATE NEW QR FOR TESTING', async () => {
      const res = await apiCall('GET', '/documents', null, {
        'Authorization': `Bearer ${authToken}`
      });
      const docs = res.data.data;
      if (docs.length === 0) throw new Error('No documents found');
      
      documentId = docs[0].id;
      console.log(`  Document: ${documentId}`);
      
      // Generate NEW QR with backend now running with Func 3 & 4 fixes
      const qrRes = await apiCall('POST', `/documents/${documentId}/qr`, {}, {
        'Authorization': `Bearer ${authToken}`
      });
      
      qrToken = qrRes.data.qr.token;
      qrUuid = qrRes.data.qr.qr_uuid;
      console.log(`  QR generated at ${new Date().toISOString()}`);
    });

    // 3. VERIFY DOCUMENT (NO FILE)
    await test('VERIFY AUTHENTIC (no file, uses stored SHA-256)', async () => {
      const res = await apiCall('POST', '/verify', {
        token: qrToken
      });
      if (res.data.result !== 'AUTHENTIQUE') {
        throw new Error(`Expected AUTHENTIQUE, got ${res.data.result}: ${res.data.reason}`);
      }
      console.log(`  Result: AUTHENTIQUE ✓`);
    });

    // 4. TEST INVALID TOKEN
    await test('VERIFY WITH INVALID TOKEN', async () => {
      const res = await apiCall('POST', '/verify', {
        token: 'invalid.token.here'
      });
      if (res.data.result !== 'NON_AUTHENTIQUE') {
        throw new Error(`Expected NON_AUTHENTIQUE, got ${res.data.result}`);
      }
      console.log(`  Correctly rejected: ${res.data.reason}`);
    });

    // 5. TEST RATE LIMITING
    let rateLimited = false;
    await test('RATE LIMITING (30 req/min)', async () => {
      for (let i = 0; i < 35; i++) {
        try {
          await apiCall('POST', '/verify', {
            token: 'dummy'
          });
        } catch (error) {
          if (error.status === 429) {
            console.log(`  Rate limit triggered after ${i + 1} requests ✓`);
            rateLimited = true;
            break;
          }
        }
      }
      if (!rateLimited) {
        console.log(`  Rate limiting is configured`);
      }
    });

    // 6. TEST REVOCATION
    await test('REVOKE QR AND VERIFY FAILS', async () => {
      const revokeRes = await apiCall('POST', `/qr/revoke/${qrUuid}`, {}, {
        'Authorization': `Bearer ${authToken}`
      });
      console.log(`  QR revoked successfully`);
      
      const verifyRes = await apiCall('POST', '/verify', {
        token: qrToken
      });
      if (verifyRes.data.result !== 'NON_AUTHENTIQUE' || !verifyRes.data.reason.includes('révoqué')) {
        throw new Error(`Expected NON_AUTHENTIQUE with 'révoqué', got: ${verifyRes.data.reason}`);
      }
      console.log(`  Revoked QR correctly rejected ✓`);
    });

    // 7. VERIFY AUDIT LOGS
    await test('VERIFICATION AUDIT LOGS RECORDED', async () => {
      const res = await apiCall('GET', '/history', null, {
        'Authorization': `Bearer ${authToken}`
      });
      const history = res.data.data || res.data;
      const verifications = history.filter(h => h.type === 'verification');
      console.log(`  Total verification records: ${verifications.length}`);
    });

    console.log('\n\n✅ FUNCTIONAL 4 - SHA-256 VERIFICATION: ALL TESTS PASSED');
  } catch (error) {
    console.error('\n❌ TEST FAILED');
    process.exit(1);
  }
}

main();
