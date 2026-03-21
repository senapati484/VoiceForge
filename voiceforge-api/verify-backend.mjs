#!/usr/bin/env node
/**
 * VoiceForge Backend Verification Script
 * Run with: node verify-backend.js
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load environment
require('dotenv').config();

console.log('🔍 VoiceForge Backend Verification\n');
console.log('=' .repeat(50));

let exitCode = 0;

// Test 1: Environment Variables
console.log('\n📋 Checking Environment Variables...\n');
const requiredEnv = [
  'MONGODB_URI',
  'JWT_SECRET',
  'GEMINI_API_KEY',
  'VAPI_API_KEY',
  'VAPI_WEBHOOK_SECRET',
  'PINECONE_API_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'SMTP_USER',
  'SMTP_PASS'
];

const missing = [];
requiredEnv.forEach(key => {
  if (!process.env[key]) {
    missing.push(key);
    console.log(`  ✗ ${key}: MISSING`);
  } else {
    const val = process.env[key];
    const display = val.length > 30 ? val.substring(0, 27) + '...' : val;
    console.log(`  ✓ ${key}: ${display}`);
  }
});

if (missing.length > 0) {
  console.log(`\n⚠️  Missing ${missing.length} required environment variables`);
  exitCode = 1;
}

// Test 2: Build Output
console.log('\n📦 Checking Build Output...\n');
import('fs').then(fs => {
  const distExists = fs.existsSync('./dist');
  if (distExists) {
    console.log('  ✓ dist/ folder exists');
  } else {
    console.log('  ✗ dist/ folder not found (run: npm run build)');
    exitCode = 1;
  }

  // Test 3: Module Imports
  console.log('\n🔌 Testing Module Imports...\n');

  import('./dist/config.js')
    .then(() => console.log('  ✓ config.js imports'))
    .catch(err => { console.log(`  ✗ config.js: ${err.message}`); exitCode = 1; });

  import('./dist/db/index.js')
    .then(db => {
      console.log('  ✓ db/index.js imports');
      if (db.User && db.Agent && db.CallLog) {
        console.log('    - User model ✓');
        console.log('    - Agent model ✓');
        console.log('    - CallLog model ✓');
      }
    })
    .catch(err => { console.log(`  ✗ db/index.js: ${err.message}`); exitCode = 1; });

  import('./dist/routes/auth.js')
    .then(() => console.log('  ✓ routes/auth.js imports'))
    .catch(err => { console.log(`  ✗ routes/auth.js: ${err.message}`); exitCode = 1; });

  import('./dist/routes/agents.js')
    .then(() => console.log('  ✓ routes/agents.js imports'))
    .catch(err => { console.log(`  ✗ routes/agents.js: ${err.message}`); exitCode = 1; });

  import('./dist/services/vapi.service.js')
    .then(() => console.log('  ✓ services/vapi.service.js imports'))
    .catch(err => { console.log(`  ✗ services/vapi.service.js: ${err.message}`); exitCode = 1; });

  import('./dist/services/campaign.service.js')
    .then(() => console.log('  ✓ services/campaign.service.js imports'))
    .catch(err => { console.log(`  ✗ services/campaign.service.js: ${err.message}`); exitCode = 1; });

  import('./dist/rag/ingest.js')
    .then(() => console.log('  ✓ rag/ingest.js imports'))
    .catch(err => { console.log(`  ✗ rag/ingest.js: ${err.message}`); exitCode = 1; });

  import('./dist/rag/retrieve.js')
    .then(() => console.log('  ✓ rag/retrieve.js imports'))
    .catch(err => { console.log(`  ✗ rag/retrieve.js: ${err.message}`); exitCode = 1; });

  import('./dist/worker/index.js')
    .then(() => console.log('  ✓ worker/index.js imports'))
    .catch(err => { console.log(`  ✗ worker/index.js: ${err.message}`); exitCode = 1; });

  // Wait for all imports and then show summary
  setTimeout(() => {
    console.log('\n' + '='.repeat(50));
    if (exitCode === 0) {
      console.log('✅ All verification checks passed!');
      console.log('\n🚀 Ready to start:');
      console.log('   npm run dev    (development)');
      console.log('   npm start      (production)');
    } else {
      console.log('❌ Some checks failed. Please fix the issues above.');
    }
    process.exit(exitCode);
  }, 2000);
});
