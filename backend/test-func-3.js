const axios = require('axios');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:4000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

let authToken = '';
let documentId = '';
let qrUuid = '';

async function test(label, fn) {
  try {
    console.log(`\n─ ${label}`);
    await fn();
    console.log(`✓ ${label}`);
  } catch (error) {
    console.error(`✗ ${label}`);
    console.error(`  Error: ${error.message}`);
    if (error.response?.data) console.error(`  Response:`, error.response.data);
    throw error;
  }
}

async function main() {
  try {
    // 1. AUTH LOGIN
    await test('LOGIN', async () => {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        email: 'admin@fonds.cm',
        password: 'adminpass'
      });
      authToken = res.data.token;
      console.log(`  Token: ${authToken.slice(0, 30)}...`);
    });

    // 2. FETCH FIRST DOCUMENT (or use one from func2)
    await test('GET FIRST DOCUMENT', async () => {
      const res = await axios.get(`${API_BASE}/documents`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const docs = res.data.data;
      if (docs.length === 0) throw new Error('No documents found');
      documentId = docs[0].id;
      console.log(`  Document ID: ${documentId}`);
    });

    // 3. TEST: Invalid UUID should return 400
    await test('UUID VALIDATION (malformed UUID → 400)', async () => {
      try {
        await axios.post(`${API_BASE}/documents/not-a-uuid/qr`, {}, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        throw new Error('Should have returned 400');
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`  Correctly rejected malformed UUID`);
        } else {
          throw error;
        }
      }
    });

    // 4. GENERATE QR
    await test('GENERATE QR', async () => {
      const res = await axios.post(`${API_BASE}/documents/${documentId}/qr`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      qrUuid = res.data.qr.qr_uuid;
      const token = res.data.qr.token;
      console.log(`  QR UUID: ${qrUuid}`);
      console.log(`  Token: ${token.slice(0, 30)}...`);
      
      // Verify token expiration is 10y (4200 hours ≈ 10 years)
      const decoded = jwt.verify(token, JWT_SECRET);
      const now = Math.floor(Date.now() / 1000);
      const exp = decoded.exp;
      const hoursUntilExpiry = (exp - now) / 3600;
      console.log(`  Token expires in: ${hoursUntilExpiry.toFixed(0)} hours (~${(hoursUntilExpiry / 8760).toFixed(1)} years)`);
      
      if (hoursUntilExpiry < 8000) {
        throw new Error(`Token expiration too short: ${hoursUntilExpiry} hours (expected ~87600 hours for 10y)`);
      }
    });

    // 5. CHECK AUDIT LOG
    await test('AUDIT LOG CREATED', async () => {
      const res = await axios.get(`${API_BASE}/history?type=qr`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const logs = res.data.data || res.data;
      const qrGeneratedLog = logs.find(log => 
        log.action === 'QR_GENERATED' && log.metadata?.qr_uuid === qrUuid
      );
      if (!qrGeneratedLog) {
        throw new Error('No QR_GENERATED audit log found');
      }
      console.log(`  Audit log found: ${JSON.stringify(qrGeneratedLog)}`);
    });

    // 6. REVOKE QR
    await test('REVOKE QR', async () => {
      const res = await axios.post(`${API_BASE}/qr/revoke/${qrUuid}`, {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log(`  Revoked at: ${res.data.revoked_at}`);
      if (!res.data.success) throw new Error('Revocation failed');
    });

    // 7. TEST: Revoked QR returns 400
    await test('REVOKE ALREADY-REVOKED QR (should fail)', async () => {
      try {
        await axios.post(`${API_BASE}/qr/revoke/${qrUuid}`, {}, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        throw new Error('Should have returned 400');
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`  Correctly rejected already-revoked QR`);
        } else {
          throw error;
        }
      }
    });

    // 8. VERIFY REVOKED QR REJECTS
    await test('VERIFY REVOKED QR (should return NON_AUTHENTIQUE)', async () => {
      const res = await axios.post(`${API_BASE}/verify`, {
        token: res.data.qr.token // Use the token we generated
      });
      if (res.data.result !== 'NON_AUTHENTIQUE' || !res.data.reason.includes('révoqué')) {
        throw new Error(`Expected NON_AUTHENTIQUE with revoke reason, got: ${JSON.stringify(res.data)}`);
      }
      console.log(`  Revoked QR correctly rejected: ${res.data.reason}`);
    });

    // 9. AUDIT LOG REVOCATION
    await test('AUDIT LOG REVOCATION RECORDED', async () => {
      const res = await axios.get(`${API_BASE}/history?type=qr`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const logs = res.data.data || res.data;
      const qrRevokedLog = logs.find(log => 
        log.action === 'QR_REVOKED' && log.metadata?.qr_uuid === qrUuid
      );
      if (!qrRevokedLog) {
        throw new Error('No QR_REVOKED audit log found');
      }
      console.log(`  Audit log found: ${JSON.stringify(qrRevokedLog)}`);
    });

    console.log('\n\n✅ FUNCTIONAL 3 - QR GENERATION: ALL TESTS PASSED');
  } catch (error) {
    console.error('\n❌ TEST FAILED');
    process.exit(1);
  }
}

main();
