#!/usr/bin/env node
/**
 * Vapi Webhook Test Script
 * Run this to verify your webhook is working correctly
 *
 * Usage:
 *   node test-webhook.js
 *   WEBHOOK_URL=https://your-url.ngrok-free.app WEBHOOK_SECRET=xxx node test-webhook.js
 */

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:4000/vapi/webhook';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-secret';

const tests = [
  {
    name: 'Status Update',
    body: {
      message: {
        type: 'status-update',
        call: { id: 'test-call-123', status: 'initiated' },
        status: 'initiated',
        timestamp: Date.now()
      }
    }
  },
  {
    name: 'Assistant Request',
    body: {
      message: {
        type: 'assistant-request',
        phoneNumber: { id: 'phone-123', number: '+15551234567' },
        call: { id: 'incoming-call-123' },
        timestamp: Date.now()
      }
    }
  },
  {
    name: 'Tool Call - getCurrentTime',
    body: {
      message: {
        type: 'tool-calls',
        call: { id: 'test-call-123' },
        toolCallList: [
          {
            id: 'call_abc123',
            name: 'getCurrentTime',
            parameters: {}
          }
        ],
        timestamp: Date.now()
      }
    }
  },
  {
    name: 'Tool Call - lookupCustomer',
    body: {
      message: {
        type: 'tool-calls',
        call: { id: 'test-call-123' },
        toolCallList: [
          {
            id: 'call_def456',
            name: 'lookupCustomer',
            parameters: { phoneNumber: '+15551234567' }
          }
        ],
        timestamp: Date.now()
      }
    }
  },
  {
    name: 'End of Call Report',
    body: {
      message: {
        type: 'end-of-call-report',
        call: {
          id: 'test-call-123',
          startedAt: new Date(Date.now() - 60000).toISOString(),
          endedAt: new Date().toISOString(),
          endedReason: 'customer-ended'
        },
        transcript: [
          { role: 'assistant', message: 'Hello!' },
          { role: 'user', message: 'Hi there' }
        ],
        timestamp: Date.now()
      }
    }
  }
];

async function runTest(test) {
  console.log(`\n🧪 Testing: ${test.name}`);
  console.log('─'.repeat(50));

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-secret': WEBHOOK_SECRET
      },
      body: JSON.stringify(test.body)
    });

    const status = response.status;
    const responseBody = await response.json().catch(() => ({}));

    if (status === 200) {
      console.log(`✅ Status: ${status}`);
      console.log('Response:', JSON.stringify(responseBody, null, 2));
      return true;
    } else {
      console.log(`❌ Status: ${status}`);
      console.log('Response:', responseBody);
      return false;
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║     Vapi Webhook Test Suite                    ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`\nWebhook URL: ${WEBHOOK_URL}`);
  console.log(`Secret: ${WEBHOOK_SECRET.slice(0, 5)}...`);

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const success = await runTest(test);
    if (success) passed++;
    else failed++;

    // Small delay between tests
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n✨ All tests passed! Your webhook is ready.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

main().catch(console.error);
