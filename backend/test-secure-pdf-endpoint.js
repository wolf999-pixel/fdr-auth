#!/usr/bin/env node
/**
 * Test de l'endpoint secure-pdf
 * Vérifier la taille des fichiers retournés
 */

const http = require('http');
const fs = require('fs');

function makeRequest(method, path, token, body = null) {
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
      let data = Buffer.alloc(0);
      
      res.on('data', chunk => {
        data = Buffer.concat([data, chunk]);
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          dataSize: data.length,
          data,
          json: (() => {
            try {
              return JSON.parse(data.toString());
            } catch (e) {
              return null;
            }
          })()
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
    
    setTimeout(() => reject(new Error('Request timeout')), 8000);
  });
}

async function testExportSecurePdf() {
  console.log('\n🔍 TEST SECURE-PDF ENDPOINT\n');
  
  try {
    // Login d'abord
    console.log('Step 1: Login...');
    const loginRes = await makeRequest('POST', '/api/auth/login', null, {
      email: 'admin@fdr.test',
      password: 'admin123'
    });
    
    if (loginRes.status !== 200 || !loginRes.json?.token) {
      console.log('❌ Login échoué');
      console.log('Response:', loginRes.json);
      return;
    }
    
    const token = loginRes.json.token;
    console.log('✅ Login OK\n');
    
    // Just test with known document ID
    const documentIds = [
      'cefb711d-8522-4383-ad89-1412a612d062',
      '95d03fc0-b284-42a9-91a7-e12387b7b3e9'
    ];
    
    for (const docId of documentIds) {
      console.log(`\n📄 Testing document: ${docId.substring(0, 8)}...\n`);
      
      // Test GET /documents/:id/file (original)
      console.log('GET /documents/:id/file (original file)');
      const fileRes = await makeRequest('GET', `/api/documents/${docId}/file`, token);
      console.log(`  Status: ${fileRes.status}`);
      console.log(`  Size: ${fileRes.dataSize} bytes`);
      console.log(`  Type: ${fileRes.headers['content-type']}`);
      
      if (fileRes.status === 200 && fileRes.dataSize > 0) {
        console.log(`  ✅ OK\n`);
      } else if (fileRes.dataSize === 0) {
        console.log(`  ❌ RETOURNE 0 BYTES!\n`);
      } else {
        console.log(`  ⚠️  Status ${fileRes.status}\n`);
      }
      
      // Test GET /documents/:id/secure-pdf (with QR)
      console.log('GET /documents/:id/secure-pdf (with QR code)');
      const securePdfRes = await makeRequest('GET', `/api/documents/${docId}/secure-pdf`, token);
      console.log(`  Status: ${securePdfRes.status}`);
      console.log(`  Size: ${securePdfRes.dataSize} bytes`);
      console.log(`  Type: ${securePdfRes.headers['content-type']}`);
      
      if (securePdfRes.status === 200 && securePdfRes.dataSize > 0) {
        console.log(`  ✅ OK\n`);
      } else if (securePdfRes.dataSize === 0) {
        console.log(`  ❌ RETOURNE 0 BYTES!\n`);
      } else {
        console.log(`  ⚠️  Status ${securePdfRes.status}\n`);
      }
    }
    
    console.log('─'.repeat(70));
    console.log('\n📊 RÉSUMÉ:\n');
    console.log('Si /documents/:id/file retourne du contenu et /documents/:id/secure-pdf retourne 0:');
    console.log('→ Le problème est dans exportSecurePdf()');
    console.log('\nSi les deux retournent 0:');
    console.log('→ Le problème est dans getDocumentFile()');
    console.log('\nSi les deux retournent du contenu mais le frontend télécharge 0:');
    console.log('→ Le problème est dans le Blob côté frontend\n');
    
  } catch (e) {
    console.log('❌ Erreur:', e.message);
  }
}

testExportSecurePdf();
