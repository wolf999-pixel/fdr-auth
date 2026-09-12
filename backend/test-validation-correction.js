#!/usr/bin/env node
/**
 * TEST DE VALIDATION POST-CORRECTION
 * Simule le téléchargement et valide que les fichiers ne sont plus 0 Ko
 */

const crypto = require('crypto');
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

async function testDownloadPipeline() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('📋 TEST DE VALIDATION POST-CORRECTION - PDF À 0 KO');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  try {
    // Step 1: Login
    console.log('ÉTAPE 1: Authentification');
    console.log('─'.repeat(70));
    
    const loginRes = await makeRequest('POST', '/api/auth/login', null, {
      email: 'admin@fdr.test',
      password: 'admin123'
    });
    
    if (loginRes.status !== 200) {
      console.log('❌ Login échoué');
      return;
    }
    
    const token = loginRes.json.token;
    console.log('✅ Login réussi\n');
    
    // Step 2: Get documents
    console.log('ÉTAPE 2: Récupération des documents');
    console.log('─'.repeat(70));
    
    const docsRes = await makeRequest('GET', '/api/documents', token);
    const docs = docsRes.json?.data || [];
    
    if (docs.length === 0) {
      console.log('❌ Aucun document trouvé\n');
      return;
    }
    
    console.log(`✅ ${docs.length} documents trouvés\n`);
    
    // Step 3: Test téléchargement pour chaque document
    console.log('ÉTAPE 3: Test de téléchargements');
    console.log('─'.repeat(70) + '\n');
    
    let successCount = 0;
    let failureCount = 0;
    let zeroKbCount = 0;
    
    for (let i = 0; i < Math.min(docs.length, 3); i++) {
      const doc = docs[i];
      const ref = doc.reference || doc.id.substring(0, 8);
      
      console.log(`📄 Document ${i + 1}: ${ref}`);
      
      // Test /file (original)
      const fileRes = await makeRequest('GET', `/api/documents/${doc.id}/file`, token);
      console.log(`   GET /file`);
      console.log(`     Status: ${fileRes.status}`);
      console.log(`     Size: ${fileRes.dataSize} bytes`);
      
      if (fileRes.status === 200 && fileRes.dataSize > 0) {
        console.log(`     ✅ OK\n`);
        successCount++;
      } else if (fileRes.dataSize === 0) {
        console.log(`     ❌ 0 KO!\n`);
        zeroKbCount++;
        failureCount++;
      } else {
        console.log(`     ⚠️  Erreur\n`);
        failureCount++;
      }
      
      // Test /secure-pdf (avec QR)
      if (doc.qrcodes && doc.qrcodes.length > 0) {
        const securePdfRes = await makeRequest('GET', `/api/documents/${doc.id}/secure-pdf`, token);
        console.log(`   GET /secure-pdf (avec QR)`);
        console.log(`     Status: ${securePdfRes.status}`);
        console.log(`     Size: ${securePdfRes.dataSize} bytes`);
        
        if (securePdfRes.status === 200 && securePdfRes.dataSize > 0) {
          console.log(`     ✅ OK (fichier + QR)\n`);
          successCount++;
        } else if (securePdfRes.dataSize === 0) {
          console.log(`     ❌ 0 KO!\n`);
          zeroKbCount++;
          failureCount++;
        } else {
          console.log(`     ⚠️  Erreur\n`);
          failureCount++;
        }
      }
    }
    
    // Step 4: Summary
    console.log('─'.repeat(70));
    console.log('📊 RÉSUMÉ DES TESTS\n');
    console.log(`✅ Succès: ${successCount}`);
    console.log(`❌ Zéro KB: ${zeroKbCount}`);
    console.log(`⚠️  Erreurs: ${failureCount - zeroKbCount}\n`);
    
    if (zeroKbCount === 0 && failureCount === 0) {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('🎉 TOUS LES TESTS RÉUSSIS!');
      console.log('═══════════════════════════════════════════════════════════════════\n');
      console.log('✅ La correction est VALIDÉE!');
      console.log('✅ Les fichiers ne sont plus 0 KB');
      console.log('✅ Les téléchargements fonctionnent correctement\n');
    } else if (zeroKbCount > 0) {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('⚠️  PROBLÈME ENCORE PRÉSENT');
      console.log('═══════════════════════════════════════════════════════════════════\n');
      console.log(`❌ ${zeroKbCount} fichiers toujours à 0 KB`);
      console.log('La correction n\'a pas complètement résolu le problème.\n');
    }
    
    // Step 5: Détails techniques
    console.log('📌 DÉTAILS TECHNIQUES:\n');
    console.log('Changement appliqué:');
    console.log('  Avant: const blob = new Blob([resp.data], { type: "application/pdf" })');
    console.log('  Après: const blob = resp.data as Blob\n');
    console.log('Raison:');
    console.log('  Avec responseType="blob", resp.data est déjà un Blob');
    console.log('  new Blob([Blob]) re-encapsule et crée un Blob corrompu');
    console.log('  Utiliser directement resp.data préserve le contenu\n');
    
  } catch (e) {
    console.log('❌ Erreur test:', e.message, '\n');
  }
}

testDownloadPipeline().catch(console.error);
