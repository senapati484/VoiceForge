/**
 * VoiceForge Backend Test Script
 * Run with: node test-setup.js
 */

// Load environment variables
import('dotenv').then(m => m.config());

const tests = {
  passed: 0,
  failed: 0,
  errors: []
};

function test(name, fn) {
  try {
    fn();
    tests.passed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    tests.failed++;
    tests.errors.push({ name, error: err.message });
    console.log(`✗ ${name}: ${err.message}`);
  }
}

console.log('\n=== VoiceForge Backend Tests ===\n');

// Test 1: Check environment variables
test('Environment variables configured', () => {
  const required = ['MONGODB_URI', 'JWT_SECRET', 'GEMINI_API_KEY', 'VAPI_API_KEY', 'VAPI_WEBHOOK_SECRET', 'PINECONE_API_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing: ${missing.join(', ')}`);
  }
});

// Test 2: Check imports work
test('Module imports work', async () => {
  try {
    await import('./dist/config.js');
    await import('./dist/db/mongoose.js');
    await import('./dist/utils/jwt.js');
  } catch (err) {
    throw new Error(`Import failed: ${err.message}`);
  }
});

// Test 3: Check models can be imported
test('Database models importable', async () => {
  try {
    const db = await import('./dist/db/index.js');
    if (!db.User || !db.Agent || !db.CallLog) {
      throw new Error('Missing models');
    }
  } catch (err) {
    throw new Error(`Model import failed: ${err.message}`);
  }
});

// Test 4: Check services can be imported
test('Services importable', async () => {
  try {
    await import('./dist/services/vapi.service.js');
    await import('./dist/services/r2.service.js');
    await import('./dist/services/campaign.service.js');
    await import('./dist/services/otp.service.js');
  } catch (err) {
    throw new Error(`Service import failed: ${err.message}`);
  }
});

// Test 5: Check routes can be imported
test('Routes importable', async () => {
  try {
    await import('./dist/routes/auth.js');
    await import('./dist/routes/agents.js');
    await import('./dist/routes/campaigns.js');
    await import('./dist/routes/knowledge.js');
  } catch (err) {
    throw new Error(`Route import failed: ${err.message}`);
  }
});

// Test 6: Check RAG modules can be imported
test('RAG modules importable', async () => {
  try {
    await import('./dist/rag/ingest.js');
    await import('./dist/rag/retrieve.js');
  } catch (err) {
    throw new Error(`RAG import failed: ${err.message}`);
  }
});

// Run async tests
(async () => {
  await test('Module imports work', async () => {
    await import('./dist/config.js');
  });

  await test('Database models importable', async () => {
    const db = await import('./dist/db/index.js');
    if (!db.User) throw new Error('User model missing');
  });

  await test('Services importable', async () => {
    await import('./dist/services/vapi.service.js');
  });

  await test('Routes importable', async () => {
    await import('./dist/routes/auth.js');
  });

  await test('RAG modules importable', async () => {
    await import('./dist/rag/ingest.js');
  });

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${tests.passed}`);
  console.log(`Failed: ${tests.failed}`);

  if (tests.errors.length > 0) {
    console.log('\nErrors:');
    tests.errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
    process.exit(1);
  } else {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  }
})();
