#!/usr/bin/env node
/**
 * AUDIT 0 KB PROBLEM - Diagnostic complet de la chaîne de traitement
 * 
 * Vérifie chaque étape: upload -> stockage -> base de données -> téléchargement
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function auditDocumentPipeline() {
  console.log('\n═══════════════════════════════════════════════════════════════════\n');
  console.log('🔍 AUDIT COMPLET - FICHIERS À 0 KO\n');
  
  // Connexion Prisma
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  try {
    // ÉTAPE 1: Vérifier les fichiers sur disque
    console.log('ÉTAPE 1: Fichiers physiques sur disque');
    console.log('─'.repeat(70));
    
    const uploadsDir = process.env.UPLOADS_DIR || 'uploads';
    if (!fs.existsSync(uploadsDir)) {
      console.log(`❌ Dossier uploads introuvable: ${uploadsDir}\n`);
      return;
    }
    
    const files = fs.readdirSync(uploadsDir);
    console.log(`✅ Dossier uploads trouvé: ${uploadsDir}`);
    console.log(`✅ Fichiers sur disque: ${files.length}\n`);
    
    files.forEach(f => {
      const filePath = path.join(uploadsDir, f);
      const stat = fs.statSync(filePath);
      console.log(`  📄 ${f}: ${stat.size} bytes`);
    });
    
    // ÉTAPE 2: Vérifier les documents en base de données
    console.log('\n\nÉTAPE 2: Documents en base de données');
    console.log('─'.repeat(70));
    
    const docs = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log(`✅ Documents trouvés en base: ${docs.length}\n`);
    
    // ÉTAPE 3: Vérifier la cohérence chemin fichier / base de données
    console.log('\nÉTAPE 3: Cohérence chemin <-> fichier<-> base de données');
    console.log('─'.repeat(70));
    
    for (const doc of docs) {
      console.log(`\n📋 Document: ${doc.reference || doc.id.substring(0, 8)}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Chemin en base: ${doc.filePath}`);
      console.log(`   Nom fichier en base: ${doc.fileName}`);
      console.log(`   SHA256: ${doc.sha256?.substring(0, 16)}...`);
      
      // Vérifier existence du fichier pointé par la base
      const fileExistsOnDisk = fs.existsSync(doc.filePath);
      console.log(`   ${fileExistsOnDisk ? '✅' : '❌'} Fichier existe: ${doc.filePath}`);
      
      if (fileExistsOnDisk) {
        const stat = fs.statSync(doc.filePath);
        console.log(`   📊 Taille fichier: ${stat.size} bytes`);
        
        // Calculer le SHA256 du fichier réel
        const fileContent = fs.readFileSync(doc.filePath);
        const actualSha256 = crypto.createHash('sha256').update(fileContent).digest('hex');
        
        console.log(`   ${actualSha256 === doc.sha256 ? '✅' : '❌'} SHA256 match: ${actualSha256.substring(0, 16)}...`);
        
        if (stat.size === 0) {
          console.log(`   🚨 PROBLÈME: Fichier 0 Ko!`);
        }
      } else {
        console.log(`   🚨 PROBLÈME: Fichier introuvable sur disque!`);
      }
      
      // Vérifier les QR codes associés
      const qrs = await prisma.qrCode.findMany({
        where: { documentId: doc.id }
      });
      console.log(`   📱 QR codes: ${qrs.length}`);
    }
    
    // ÉTAPE 4: Vérifier la fonction getDocumentFile
    console.log('\n\nÉTAPE 4: Simulation de getDocumentFile()');
    console.log('─'.repeat(70));
    
    if (docs.length > 0) {
      const testDoc = docs[0];
      console.log(`\nTest avec document: ${testDoc.reference || testDoc.id.substring(0, 8)}\n`);
      
      if (fs.existsSync(testDoc.filePath)) {
        console.log(`✅ Fichier trouvé: ${testDoc.filePath}`);
        
        const stat = fs.statSync(testDoc.filePath);
        console.log(`✅ Taille: ${stat.size} bytes`);
        
        // Simuler la création d'un stream
        const stream = fs.createReadStream(testDoc.filePath);
        let streamSize = 0;
        
        stream.on('data', chunk => {
          streamSize += chunk.length;
        });
        
        stream.on('end', () => {
          console.log(`✅ Stream transmettrait: ${streamSize} bytes`);
        });
        
        stream.on('error', (err) => {
          console.log(`❌ Erreur stream: ${err.message}`);
        });
        
        // Attendre que le stream finisse
        await new Promise(resolve => stream.on('end', resolve));
      } else {
        console.log(`❌ Fichier introuvable: ${testDoc.filePath}`);
      }
    }
    
    // ÉTAPE 5: Vérifier exportSecurePdf
    console.log('\n\nÉTAPE 5: Vérification exportSecurePdf()');
    console.log('─'.repeat(70));
    
    const docWithQr = docs.find(d => 
      d.qrcodes && Array.isArray(d.qrcodes) && d.qrcodes.length > 0
    ) || docs[0];
    
    if (docWithQr) {
      console.log(`\nTest avec document: ${docWithQr.reference || docWithQr.id.substring(0, 8)}`);
      
      const hasQr = await prisma.qrCode.findFirst({
        where: { documentId: docWithQr.id, revoked: false }
      });
      
      if (hasQr) {
        console.log(`✅ QR code trouvé: ${hasQr.qrUuid}`);
        console.log(`✅ Document original existe: ${fs.existsSync(docWithQr.filePath)}`);
        
        if (fs.existsSync(docWithQr.filePath)) {
          const fileStat = fs.statSync(docWithQr.filePath);
          console.log(`✅ Taille fichier original: ${fileStat.size} bytes`);
        }
      } else {
        console.log(`⚠️  Pas de QR code non-révoqué`);
      }
    }
    
    console.log('\n\n═══════════════════════════════════════════════════════════════════\n');
    console.log('📊 RÉSUMÉ DU DIAGNOSTIC:\n');
    console.log('Vérifications à faire:');
    console.log('1. ✅ Fichiers existent sur disque');
    console.log('2. ✅ Chemins en base correspondent');
    console.log('3. ✅ Fichiers ne sont pas 0 Ko');
    console.log('4. ⏳ SHA256 match');
    console.log('5. ⏳ Stream récupère les bytes correctement');
    
  } catch (error) {
    console.error('❌ Erreur audit:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

auditDocumentPipeline().catch(console.error);
