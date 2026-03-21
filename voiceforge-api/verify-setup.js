#!/usr/bin/env node
/**
 * Complete Vapi Webhook Test & Setup Verification
 * Run this to ensure everything is configured correctly
 */

const fs = require('fs');
const path = require('path');

// ANSI colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(message, type = 'info') {
  const color = type === 'success' ? GREEN : type === 'error' ? RED : type === 'warning' ? YELLOW : BLUE;
  console.log(`${color}${message}${RESET}`);
}

function checkEnvFile() {
  log('\n🔍 Checking Environment Variables...', 'info');

  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    log('❌ .env file not found!', 'error');
    return false;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const apiPublicUrl = envContent.match(/API_PUBLIC_URL=(.+)/);
  const vapiApiKey = envContent.match(/VAPI_API_KEY=(.+)/);
  const vapiWebhookSecret = envContent.match(/VAPI_WEBHOOK_SECRET=(.+)/);

  let hasErrors = false;

  if (!apiPublicUrl) {
    log('❌ API_PUBLIC_URL not set in .env', 'error');
    hasErrors = true;
  } else {
    const url = apiPublicUrl[1];
    if (url.includes('ngrok-free.app') || url.includes('ngrok.app')) {
      if (!url.includes('/vapi/webhook')) {
        log(`⚠️  API_PUBLIC_URL should NOT include /vapi/webhook`, 'warning');
        log(`   Current: ${url}`, 'info');
        log(`   The webhook path is added automatically by the code`, 'info');
      } else {
        log('✅ API_PUBLIC_URL looks correct', 'success');
      }
    } else {
      log(`ℹ️  API_PUBLIC_URL: ${url}`, 'info');
    }
  }

  if (!vapiApiKey) {
    log('❌ VAPI_API_KEY not set in .env', 'error');
    hasErrors = true;
  } else {
    log('✅ VAPI_API_KEY is set', 'success');
  }

  if (!vapiWebhookSecret) {
    log('❌ VAPI_WEBHOOK_SECRET not set in .env', 'error');
    hasErrors = true;
  } else {
    log('✅ VAPI_WEBHOOK_SECRET is set', 'success');
  }

  return !hasErrors;
}

async function testNgrok() {
  log('\n🌐 Testing Ngrok Connection...', 'info');

  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const apiPublicUrl = envContent.match(/API_PUBLIC_URL=(.+)/);

  if (!apiPublicUrl) {
    log('❌ Cannot test without API_PUBLIC_URL', 'error');
    return false;
  }

  const baseUrl = apiPublicUrl[1].trim();

  try {
    // Test health endpoint
    const healthUrl = `${baseUrl}/health`;
    log(`   Testing: ${healthUrl}`, 'info');

    const response = await fetch(healthUrl);
    if (response.ok) {
      const data = await response.json();
      log(`✅ Ngrok is working! Server time: ${data.ts}`, 'success');
      return true;
    } else {
      log(`❌ Health check failed: ${response.status}`, 'error');
      return false;
    }
  } catch (err) {
    log(`❌ Cannot connect to ngrok: ${err.message}`, 'error');
    log(`   Make sure:`, 'info');
    log(`   1. ngrok is running (ngrok http 4000)`, 'info');
    log(`   2. The API server is running (npm run dev)`, 'info');
    log(`   3. API_PUBLIC_URL in .env matches the ngrok URL`, 'info');
    return false;
  }
}

async function testWebhook() {
  log('\n📞 Testing Webhook Endpoint...', 'info');

  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const apiPublicUrl = envContent.match(/API_PUBLIC_URL=(.+)/);
  const webhookSecret = envContent.match(/VAPI_WEBHOOK_SECRET=(.+)/);

  if (!apiPublicUrl || !webhookSecret) {
    log('❌ Cannot test without API_PUBLIC_URL and VAPI_WEBHOOK_SECRET', 'error');
    return false;
  }

  const baseUrl = apiPublicUrl[1].trim();
  const secret = webhookSecret[1].trim();
  const webhookUrl = `${baseUrl}/vapi/webhook`;

  try {
    // Test assistant-request
    log(`   Testing assistant-request...`, 'info');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-secret': secret
      },
      body: JSON.stringify({
        message: {
          type: 'assistant-request',
          phoneNumber: { number: '+15551234567' },
          call: { id: 'test-call-123' },
          timestamp: Date.now()
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.assistant || data.assistantId) {
        log(`✅ Webhook is responding correctly!`, 'success');
        log(`   Response: ${JSON.stringify(data, null, 2).substring(0, 200)}...`, 'info');
        return true;
      } else {
        log(`⚠️  Webhook responded but may have issues`, 'warning');
        log(`   Response: ${JSON.stringify(data)}`, 'info');
        return false;
      }
    } else {
      log(`❌ Webhook test failed: ${response.status}`, 'error');
      const text = await response.text();
      log(`   Response: ${text}`, 'info');
      return false;
    }
  } catch (err) {
    log(`❌ Webhook test error: ${err.message}`, 'error');
    return false;
  }
}

function printSetupGuide() {
  log('\n' + '='.repeat(60), 'info');
  log('VAPI DASHBOARD SETUP GUIDE', 'info');
  log('='.repeat(60), 'info');

  log(`
🎯 WHAT YOU NEED TO DO IN VAPI DASHBOARD:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 STEP 1: Configure Phone Number
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to: https://dashboard.vapi.ai/phone-numbers
2. Click on your phone number
3. Scroll to "Server URL" section
4. Set Server URL to:

   ${YELLOW}https://your-ngrok-url.ngrok-free.app/vapi/webhook${RESET}

5. Click "Save"

⚠️  IMPORTANT: The URL MUST include /vapi/webhook at the end!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 STEP 2: Configure Assistant (HIGHER PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to: https://dashboard.vapi.ai/assistants
2. Click on your assistant (e.g., "Alex")
3. Click "Advanced" tab at the top
4. Find "Server URL" field
5. Set it to:

   ${YELLOW}https://your-ngrok-url.ngrok-free.app/vapi/webhook${RESET}

6. Click "Save"

✅ Assistant-level URL OVERRIDES phone-level URL
   (This takes priority!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 STEP 3: Link Phone to Assistant (CRITICAL!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Go to: https://dashboard.vapi.ai/phone-numbers
2. Click on your phone number
3. Scroll down to "Inbound Settings"
4. Set "Assistant" dropdown to your assistant (e.g., "Alex")
5. Click "Save"

❌ Without this step, calls won't trigger your assistant!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧪 STEP 4: Test the Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Option A: Use "Talk to Assistant" button
1. In assistant page, click "Talk to Assistant"
2. Enter your phone number
3. Click "Call"
4. Answer your phone when it rings
5. You should hear your AI assistant speak!

Option B: Call your Vapi number directly
1. Call the Vapi phone number from your cell phone
2. The AI should answer and speak

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 STEP 5: Verify in Your Terminal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When a call comes in, you should see logs like:

${GREEN}[Vapi Webhook] Received request: {...}${RESET}
${GREEN}[Vapi Webhook] Processing event type: assistant-request${RESET}
${GREEN}[Vapi Webhook] Assistant request: {...}${RESET}
${GREEN}[Vapi Webhook] Processing event type: status-update${RESET}
${GREEN}[Vapi Webhook] Status update: initiated for call {...}${RESET}

If you see these logs → SUCCESS! 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`, 'info');
}

function printTroubleshooting() {
  log(`
🔧 TROUBLESHOOTING:

❌ "Cannot connect to ngrok"
   → Make sure ngrok is running: ngrok http 4000
   → Make sure API server is running: npm run dev
   → Update API_PUBLIC_URL in .env with new ngrok URL

❌ "Unauthorized" error
   → Check VAPI_WEBHOOK_SECRET matches in .env and Vapi dashboard
   → Make sure 'x-vapi-secret' header is being sent

❌ "Assistant not responding"
   → Check that phone number is linked to assistant (Step 3)
   → Verify Server URL includes /vapi/webhook
   → Check Vapi dashboard for error logs

❌ "No logs in terminal"
   → Check ngrok inspector: http://127.0.0.1:4040
   → Verify the webhook URL is correct in Vapi
   → Make sure backend restarted after .env changes
`, 'info');
}

async function main() {
  log('╔════════════════════════════════════════════════════════╗', 'info');
  log('║    VAPI WEBHOOK SETUP VERIFICATION                    ║', 'info');
  log('╚════════════════════════════════════════════════════════╝', 'info');

  const envOk = checkEnvFile();
  const ngrokOk = await testNgrok();
  const webhookOk = await testWebhook();

  log('\n' + '='.repeat(60), 'info');
  log('SUMMARY', 'info');
  log('='.repeat(60), 'info');

  if (envOk && ngrokOk && webhookOk) {
    log('✅ All checks passed! Your webhook is ready.', 'success');
    log('✅ Follow the dashboard setup guide below:', 'success');
    printSetupGuide();
  } else {
    log('❌ Some checks failed. Please fix the issues above.', 'error');
    printTroubleshooting();
  }

  log('\n' + '='.repeat(60), 'info');
  log('NEXT STEPS', 'info');
  log('='.repeat(60), 'info');
  log('1. Fix any failed checks above', 'info');
  log('2. Follow the Vapi Dashboard Setup Guide', 'info');
  log('3. Test with "Talk to Assistant" button', 'info');
  log('4. Watch your terminal for webhook logs', 'info');
  log('='.repeat(60), 'info');
}

main().catch(console.error);
