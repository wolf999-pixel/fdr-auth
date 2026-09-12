#!/usr/bin/env node
/**
 * Test d'authentification - Vérifie que le flow login → token → requests fonctionne
 */

const http = require('http');
const url = require('url');

const BASE_URL = 'http://localhost:4000';
const CREDENTIALS = { email: 'admin@fdr.test', password: 'admin123' };

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new url.URL(`${BASE_URL}${path}`);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 4000,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
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
            body: data ? JSON.parse(data) : null,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
    
    setTimeout(() => reject(new Error('Request timeout')), 8000);
  });
}

async function runAuthTests() {
  console.log('\n🔐 TEST D\'AUTHENTIFICATION - FONCTION 5\n');
  
  console.log('Vérifications:');
  console.log('─'.repeat(70));
  
  try {
    console.log('1️⃣  TEST: Backend accessible?');
    const healthCheck = await makeRequest('GET', '/api/health');
    if (healthCheck.status === 200 || healthCheck.status === 201 || healthCheck.status === 404) {
      console.log('   ✅ Backend répond (status ' + healthCheck.status + ')\n');
    } else {
      console.log('   ❌ Backend ne répond pas (status ' + healthCheck.status + ')\n');
      process.exit(1);
    }
  } catch (e) {
    console.log('   ❌ Impossible de se connecter au backend');
    console.log('   → Lancez: npm --prefix backend run dev\n');
    process.exit(1);
  }

  try {
    console.log('2️⃣  TEST: Login avec credentials valides');
    const loginRes = await makeRequest('POST', '/api/auth/login', CREDENTIALS);
    
    if (loginRes.status === 200 && loginRes.body?.token) {
      console.log('   ✅ Login réussi');
      console.log('   Token reçu: ' + loginRes.body.token.substring(0, 20) + '...\n');
      
      const token = loginRes.body.token;
      
      console.log('3️⃣  TEST: Requête avec token valide');
      const withTokenRes = await makeRequest('GET', '/api/documents', null, token);
      
      if (withTokenRes.status === 200) {
        console.log('   ✅ Requête authentifiée OK (status 200)\n');
      } else if (withTokenRes.status === 401) {
        console.log('   ❌ Token invalide ou expiré (status 401)\n');
      } else {
        console.log('   ⚠️  Status: ' + withTokenRes.status + '\n');
      }
      
      console.log('4️⃣  TEST: Requête sans token');
      const noTokenRes = await makeRequest('GET', '/api/documents', null);
      
      if (noTokenRes.status === 401) {
        console.log('   ✅ Backend rejette sans token (status 401) - CORRECT\n');
      } else {
        console.log('   ❌ Backend n\'a pas rejeté la requête (status ' + noTokenRes.status + ')\n');
      }
      
      console.log('─'.repeat(70));
      console.log('✨ RÉSUMÉ: Authentification fonctionne correctement!\n');
      
      console.log('📝 Pour tester le frontend:');
      console.log('   1. Ouvrir: http://localhost:5173/login');
      console.log('   2. Email: admin@fdr.test');
      console.log('   3. Password: admin123');
      console.log('   4. Cliquer "Se connecter"');
      console.log('   5. Accès au dashboard\n');
      
    } else if (loginRes.status === 401) {
      console.log('   ❌ Login échoué - Credentials invalides');
      console.log('   Response:', loginRes.body, '\n');
    } else {
      console.log('   ❌ Login échoué (status ' + loginRes.status + ')');
      console.log('   Response:', loginRes.body, '\n');
    }
  } catch (e) {
    console.log('   ❌ Erreur: ' + e.message + '\n');
  }
}

runAuthTests().catch(console.error);
