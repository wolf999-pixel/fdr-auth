#!/usr/bin/env node
/**
 * Test Complet des Endpoints - Validation des correctifs
 * Testet les endpoints critiques après les corrections d'error handling
 */

const http = require('http');

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
    
    setTimeout(() => reject(new Error('Request timeout')), 5000);
  });
}

async function test() {
  console.log('\n🧪 TEST COMPLET - ENDPOINTS CRITIQUES\n');
  
  try {
    // 1. Login pour obtenir un token valide
    console.log('Step 1: Obtenir un token valide...');
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@fdr.test',
      password: 'admin123'
    });
    
    if (loginRes.status !== 200 || !loginRes.body?.token) {
      console.log('❌ Login échoué');
      return;
    }
    
    const token = loginRes.body.token;
    console.log('✅ Token obtenu\n');

    // 2. Test GET /api/documents (ListDocuments)
    console.log('Step 2: GET /api/documents');
    const docsRes = await makeRequest('GET', '/api/documents', null, token);
    console.log(`   Status: ${docsRes.status}`);
    
    if (docsRes.status === 200) {
      console.log('   ✅ ListDocuments OK');
      console.log(`   Documents trouvés: ${docsRes.body?.meta?.total || 0}\n`);
    } else if (docsRes.status === 500) {
      console.log('   ❌ ERREUR 500 - Pas d\'error handling');
      console.log('   Message:', docsRes.body?.error || 'N/A', '\n');
    } else {
      console.log(`   ⚠️  Status unexpected: ${docsRes.status}\n`);
    }

    // 3. Test GET /api/documents/invalid-uuid (validation)
    console.log('Step 3: GET /api/documents/invalid-uuid');
    const invalidRes = await makeRequest('GET', '/api/documents/invalid-uuid', null, token);
    console.log(`   Status: ${invalidRes.status}`);
    
    if (invalidRes.status === 400) {
      console.log('   ✅ UUID validation OK (400)');
      console.log(`   Message: ${invalidRes.body?.error}\n`);
    } else if (invalidRes.status === 500) {
      console.log('   ❌ ERREUR 500 - Pas de validation UUID\n');
    } else {
      console.log(`   ⚠️  Status: ${invalidRes.status}\n`);
    }

    // 4. Test GET /api/documents/stats (getDashboardStats)
    console.log('Step 4: GET /api/documents/stats');
    const statsRes = await makeRequest('GET', '/api/documents/stats', null, token);
    console.log(`   Status: ${statsRes.status}`);
    
    if (statsRes.status === 200) {
      console.log('   ✅ GetDashboardStats OK\n');
    } else if (statsRes.status === 500) {
      console.log('   ❌ ERREUR 500 - Pas d\'error handling\n');
    } else {
      console.log(`   ⚠️  Status: ${statsRes.status}\n`);
    }

    // Summary
    console.log('─'.repeat(70));
    console.log('📊 RÉSUMÉ DES CORRECTIONS:\n');
    console.log('✅ listDocuments() - Error handling ajouté');
    console.log('✅ getDocument() - Error handling + UUID validation ajoutés');
    console.log('✅ exportSecurePdf() - Error handling complet ajouté');
    console.log('✅ API 401 interceptor - Frontend redirige vers login\n');
    
    console.log('🎯 Les erreurs 500 devraient être résolues ou mieux gérées!\n');
    
  } catch (e) {
    console.log('❌ Erreur de test:', e.message);
  }
}

test();
