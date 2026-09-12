#!/usr/bin/env node
/**
 * Test de l'endpoint /api/documents
 * Vérifier que le 500 est maintenant géré
 */

const http = require('http');

const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1ZDFhM2Q0Yi0zYzQ1LTQ2ZjItYTA3NC05ZDU5YzVlOWE2MDEiLCJyb2xlIjoiYWdlbnQifQ.test';

function makeRequest(method, path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

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
    req.end();
    
    setTimeout(() => reject(new Error('Request timeout')), 5000);
  });
}

async function test() {
  console.log('\n🧪 TEST: GET /api/documents\n');
  
  try {
    const res = await makeRequest('GET', '/api/documents', MOCK_TOKEN);
    
    console.log('Status: ' + res.status);
    
    if (res.status === 200) {
      console.log('✅ Requête réussie (200)');
      console.log('Réponse:', JSON.stringify(res.body, null, 2).substring(0, 200) + '...\n');
    } else if (res.status === 500) {
      console.log('❌ Erreur interne serveur (500)');
      console.log('Réponse:', res.body, '\n');
    } else {
      console.log('⚠️  Status: ' + res.status);
      console.log('Réponse:', res.body, '\n');
    }
  } catch (e) {
    console.log('❌ Erreur de connexion:', e.message);
    console.log('→ Vérifiez que le backend tourne sur le port 4000\n');
  }
}

test();
