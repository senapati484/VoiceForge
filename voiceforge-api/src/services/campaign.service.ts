import { parse } from 'csv-parse/sync';
import { Campaign, CsvContact, Agent, User, CallLog } from '../db';
import type { ICampaign } from '../db/models/Campaign';
import { uploadToR2 } from './r2.service';
import { triggerOutboundCallWithDynamicContext } from './vapi.service';

interface CsvRow {
  name: string;
  phone: string;
  notes?: string;
}

export async function parseCsvBuffer(buffer: Buffer): Promise<CsvRow[]> {
  // Try to detect if CSV has headers by checking first row
  const rawContent = buffer.toString('utf-8');
  const lines = rawContent.split(/\r?\n/).filter(l => l.trim());

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Detect delimiter (comma or semicolon)
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

  let records: Record<string, string>[];
  let hasHeaders: boolean;

  try {
    records = await parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter
    }) as Record<string, string>[];
    hasHeaders = records.length > 0 && Object.keys(records[0]).some(k =>
      /^(phone|mobile|number|contact|name)/i.test(k)
    );
  } catch {
    hasHeaders = false;
    records = [];
  }

  // If no headers detected or parsing failed, treat first row as headers with generic names
  if (!hasHeaders || records.length === 0) {
    const firstRowValues = firstLine.split(delimiter).map(v => v.trim());

    // Check if first row looks like data (numbers) vs headers (letters)
    const looksLikeData = firstRowValues.some(v => /^\d{7,}$/.test(v.replace(/\D/g, '')));

    if (looksLikeData) {
      // No headers - create generic column names
      records = await parse(buffer, {
        columns: firstRowValues.map((_, i) => `col${i}`),
        skip_empty_lines: true,
        trim: true,
        delimiter
      }) as Record<string, string>[];
    }
  }

  if (records.length === 0) {
    throw new Error('CSV has no data rows');
  }

  // Detect columns
  const columns = Object.keys(records[0]).map(c => c.toLowerCase().trim());

  // Detect phone column FIRST with more flexible matching
  let phoneColumn = columns.find(c =>
    ['phone', 'mobile', 'number', 'contact', 'phonenumber', 'cell', 'tel', 'telephone', 'mob', 'cellphone'].includes(c)
  ) || columns.find(c => c.includes('phone') || c.includes('mobile') || c.includes('number'));

  if (!phoneColumn) {
    // If still no phone column, check if any column contains phone-like values
    let autoDetectedPhoneCol: string | null = null;
    for (const col of columns) {
      const sampleValue = records[0][col];
      if (sampleValue && /\d{7,}/.test(sampleValue.replace(/\D/g, ''))) {
        console.log(`[CSV] Auto-detected phone column: ${col}`);
        autoDetectedPhoneCol = col;
        break;
      }
    }
    if (!autoDetectedPhoneCol) {
      console.error('[CSV] Available columns:', columns.join(', '));
      console.error('[CSV] First row sample:', records[0]);
      throw new Error(`CSV must have a phone column. Detected columns: ${columns.join(', ')}. Please use: phone, mobile, number, contact, etc.`);
    }
    phoneColumn = autoDetectedPhoneCol;
  }

  // Find name column with more options (fallback to first non-phone column)
  const nameColumn = columns.find(c =>
    ['name', 'fullname', 'full_name', 'contactname', 'contact_name', 'first_name', 'firstname', 'last_name', 'lastname', 'customer', 'client'].includes(c)
  ) || columns.find(c => c.includes('name'))
    || (columns[0] !== phoneColumn ? columns[0] : (columns[1] || 'col0'));

  // Find notes column (optional) with more options
  const notesColumn = columns.find(c =>
    ['notes', 'comments', 'info', 'details', 'remarks', 'note', 'comment', 'description', 'desc', 'memo', 'message'].includes(c)
  ) || columns.find(c => c.includes('note') || c.includes('comment'));

  console.log(`[CSV] Detected columns - phone: "${phoneColumn}", name: "${nameColumn}", notes: "${notesColumn || 'none'}"`);

  const rows: CsvRow[] = [];

  for (const record of records) {
    const rawPhone = record[phoneColumn]?.trim();
    if (!rawPhone) continue;

    // Normalize to E.164
    const phone = normalizePhone(rawPhone);
    if (!phone) continue;

    rows.push({
      name: record[nameColumn]?.trim() || 'Unknown',
      phone,
      notes: notesColumn ? record[notesColumn]?.trim() : undefined
    });
  }

  if (rows.length === 0) {
    throw new Error('CSV has no valid rows with phone numbers');
  }

  return rows;
}

/**
 * Check if a phone number is likely international compared to the agent's number
 * Free Vapi numbers don't support international calls, so we detect this
 */
function isLikelyInternational(contactPhone: string, agentPhone?: string): boolean {
  if (!agentPhone) return true; // Assume international if no agent phone

  // Extract country codes
  const agentCountryCode = extractCountryCode(agentPhone);
  const contactCountryCode = extractCountryCode(contactPhone);

  // If we can't determine codes, assume international to be safe
  if (agentCountryCode === 'UNKNOWN' || contactCountryCode === 'UNKNOWN') {
    return false; // Let it try with the agent's number
  }

  return agentCountryCode !== contactCountryCode;
}

/**
 * Extract country code from E.164 phone number
 * Returns country identifier or 'UNKNOWN'
 */
function extractCountryCode(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  // Remove leading 1 if present (North America)
  if (digits.length === 11 && digits.startsWith('1')) {
    return 'US/CA';
  }

  // Common country codes
  if (digits.startsWith('1')) return 'US/CA';     // US/Canada
  if (digits.startsWith('91')) return 'IN';        // India
  if (digits.startsWith('44')) return 'UK';        // UK
  if (digits.startsWith('49')) return 'DE';        // Germany
  if (digits.startsWith('33')) return 'FR';        // France
  if (digits.startsWith('61')) return 'AU';        // Australia
  if (digits.startsWith('81')) return 'JP';        // Japan
  if (digits.startsWith('86')) return 'CN';        // China
  if (digits.startsWith('7')) return 'RU';         // Russia
  if (digits.startsWith('55')) return 'BR';        // Brazil
  if (digits.startsWith('52')) return 'MX';        // Mexico

  // If number has more than 10 digits, likely has country code
  if (digits.length > 10) {
    return 'INT'; // International/other
  }

  return 'UNKNOWN';
}

function normalizePhone(phone: string): string | null {
  if (!phone || typeof phone !== 'string') return null;

  // Remove all non-digit characters except leading +
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 0) return null;

  // If already has country code (11+ digits) or starts with +
  if (digits.length >= 11 || hasPlus) {
    return '+' + digits;
  }

  // If 10 digits (common US/Indian mobile), add +1 for US or +91 for India
  if (digits.length === 10) {
    // Default to +1 (US/Canada) for 10-digit numbers
    // You can change this default based on your primary market
    return '+1' + digits;
  }

  // 9 digits (some countries)
  if (digits.length === 9) {
    return '+91' + digits; // Assume India for 9 digits
  }

  // Invalid - less than 9 digits
  console.warn(`[Phone] Invalid phone number format: "${phone}" (${digits.length} digits)`);
  return null;
}

export async function createCampaign(
  userId: string,
  agentId: string,
  campaignName: string,
  csvBuffer: Buffer
): Promise<ICampaign> {
  const rows = await parseCsvBuffer(csvBuffer);

  // Upload CSV to R2
  const csvR2Key = `campaigns/${userId}/${Date.now()}.csv`;
  await uploadToR2(csvR2Key, csvBuffer, 'text/csv');

  // Create campaign
  const campaign = await Campaign.create({
    userId,
    agentId,
    name: campaignName,
    totalContacts: rows.length,
    csvR2Key,
    status: 'draft'
  });

  // Create contacts
  await CsvContact.insertMany(
    rows.map(row => ({
      campaignId: campaign._id,
      userId,
      name: row.name,
      phone: row.phone,
      notes: row.notes,
      status: 'pending'
    }))
  );

  return campaign;
}

export async function runCampaign(campaignId: string): Promise<void> {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const agent = await Agent.findById(campaign.agentId);
  if (!agent || !agent.vapiAgentId) {
    await Campaign.findByIdAndUpdate(campaignId, { status: 'paused' });
    throw new Error('Agent not configured');
  }

  await Campaign.findByIdAndUpdate(campaignId, {
    status: 'running',
    startedAt: new Date()
  });

  // Get pending contacts
  const contacts = await CsvContact.find({
    campaignId,
    status: 'pending'
  });

  for (const contact of contacts) {
    // Check credits before EACH call
    const freshUser = await User.findById(campaign.userId).select('credits');
    if (!freshUser || freshUser.credits < 5) {
      await Campaign.findByIdAndUpdate(campaignId, { status: 'paused' });
      console.log(`Campaign ${campaignId} paused — insufficient credits`);
      break;
    }

    await CsvContact.findByIdAndUpdate(contact._id, { status: 'calling' });

    // Build personalized metadata
    const metadata = {
      userId: campaign.userId.toString(),
      agentId: campaign.agentId.toString(),
      campaignId: campaignId,
      csvContactId: contact._id.toString(),
      contactName: contact.name,
      contactNotes: contact.notes || ''
    };

    try {
      // Check if this is an international call
      // If the agent has a phone number and it's different country from contact, don't use phoneNumberId
      // This allows Vapi to use their platform number for international calls
      const isInternational = isLikelyInternational(contact.phone, agent.phoneNumber);

      console.log(`[Campaign] Calling ${contact.phone} (${isInternational ? 'international' : 'domestic'})...`);

      // Use triggerOutboundCallWithDynamicContext to FORCE webhook usage
      // This passes full assistant config instead of just assistantId
      // Vapi MUST call our webhook to get dynamic context (agent name, business context, etc.)
      const vapiRes = await triggerOutboundCallWithDynamicContext(
        agent,
        contact.phone,
        metadata,
        // Don't pass phoneNumberId for international calls
        // This uses Vapi's platform number instead of your free Vapi number
        // Free Vapi numbers don't support international calling
        isInternational ? undefined : undefined
      );

      await CallLog.create({
        userId: campaign.userId,
        agentId: campaign.agentId,
        campaignId,
        csvContactId: contact._id,
        vapiCallId: vapiRes.id,
        direction: 'outbound',
        toNumber: contact.phone,
        status: 'initiated',
        startedAt: new Date()
      });
    } catch (err) {
      console.error(`Failed to call ${contact.phone}:`, err);
      await CsvContact.findByIdAndUpdate(contact._id, { status: 'failed' });
      await Campaign.findByIdAndUpdate(campaignId, {
        $inc: { failed: 1, called: 1 }
      });
    }

    // Wait 30 seconds between calls
    await new Promise(resolve => setTimeout(resolve, 30000));
  }

  // Mark completed (unless already paused)
  const finalCampaign = await Campaign.findById(campaignId);
  if (finalCampaign && finalCampaign.status === 'running') {
    await Campaign.findByIdAndUpdate(campaignId, {
      status: 'completed',
      completedAt: new Date()
    });
  }
}
