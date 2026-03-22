import { Router } from 'express';
import { config } from '../config';

const router = Router();

// GET /voices/preview/:voiceId - Proxy voice preview with CORS headers
router.get('/preview/:voiceId', async (req, res) => {
  const { voiceId } = req.params;
  const previewUrl = `https://storage.vapi.ai/voice/${voiceId.toLowerCase()}.mp3`;

  console.log(`[Voice Preview] Proxying voice preview: ${voiceId} -> ${previewUrl}`);

  try {
    const response = await fetch(previewUrl);
    if (response.ok) {
      // Set CORS headers to allow frontend access
      res.set('Content-Type', 'audio/mpeg');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

      // Stream the audio data
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } else {
      console.error(`[Voice Preview] Voice not found: ${voiceId}`);
      res.status(404).json({ error: 'Voice preview not found' });
    }
  } catch (err) {
    console.error('[Voice Preview] Error fetching voice:', err);
    res.status(500).json({ error: 'Failed to load voice preview' });
  }
});
type VoiceDto = { voiceId: string; name: string; provider: string; previewUrl?: string };

// Module-level cache
const cache = {
  data: null as VoiceDto[] | null,
  fetchedAt: 0
};

const CACHE_TTL = 3600000; // 1 hour
// Vapi provides sample audio at: https://storage.vapi.ai/voice/{voiceId}.mp3
// We use our proxy endpoint to avoid CORS issues in the frontend
const FALLBACK_VOICES: VoiceDto[] = [
  { voiceId: 'Elliot', name: 'Elliot (Demo)', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/elliot` },
  { voiceId: 'elliot', name: 'Elliot', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/elliot` },
  { voiceId: 'rohan', name: 'Rohan', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/rohan` },
  { voiceId: 'emma', name: 'Emma', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/emma` },
  { voiceId: 'clara', name: 'Clara', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/clara` },
  { voiceId: 'nico', name: 'Nico', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/nico` },
  { voiceId: 'kai', name: 'Kai', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/kai` },
  { voiceId: 'sagar', name: 'Sagar', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/sagar` },
  { voiceId: 'godfrey', name: 'Godfrey', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/godfrey` },
  { voiceId: 'neil', name: 'Neil', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/neil` },
  { voiceId: 'joseph', name: 'Joseph', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/joseph` },
  { voiceId: 'jennifer', name: 'Jennifer', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/jennifer` },
  { voiceId: 'michael', name: 'Michael', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/michael` },
  { voiceId: 'sarah', name: 'Sarah', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/sarah` },
  { voiceId: 'alex', name: 'Alex', provider: 'vapi', previewUrl: `${config.apiPublicUrl}/api/voices/preview/alex` }
];

function normalizeVoicesResponse(payload: unknown): VoiceDto[] {
  const root = payload as
    | Array<Record<string, unknown>>
    | { data?: Array<Record<string, unknown>>; voices?: Array<Record<string, unknown>> };

  const rawList = Array.isArray(root) ? root : (root?.data || root?.voices || []);
  return rawList
    .map((v) => {
      const voiceId = String(v.id ?? v.voiceId ?? '');
      // Use our proxy endpoint for CORS-free preview
      const proxyPreviewUrl = voiceId ? `${config.apiPublicUrl}/api/voices/preview/${voiceId.toLowerCase()}` : undefined;

      return {
        voiceId,
        name: String(v.name ?? 'Unknown'),
        provider: String(v.provider ?? 'vapi'),
        // Use proxy URL instead of direct Vapi URL to avoid CORS issues
        previewUrl: proxyPreviewUrl
      };
    })
    .filter((v) => Boolean(v.voiceId));
}

function withDemoVoice(voices: VoiceDto[]): VoiceDto[] {
  const idx = voices.findIndex((v) => v.voiceId.toLowerCase() === 'elliot');
  if (idx <= 0) return voices;
  const demo = voices[idx];
  return [{ ...demo, name: `${demo.name} (Demo)` }, ...voices.filter((_, i) => i !== idx)];
}

// GET /voices - List available voices (cached, no auth required)
router.get('/', async (req, res, next) => {
  try {
    // Check cache
    if (Date.now() - cache.fetchedAt < CACHE_TTL && cache.data) {
      return res.json({ voices: cache.data });
    }

    const headers = { Authorization: `Bearer ${config.vapi.apiKey}` };
    let mappedVoices: VoiceDto[] = [];

    // Try plural endpoint first, then singular for compatibility.
    const plural = await fetch('https://api.vapi.ai/voices', { headers });
    if (plural.ok) {
      mappedVoices = normalizeVoicesResponse(await plural.json());
    } else {
      const singular = await fetch('https://api.vapi.ai/voice', { headers });
      if (singular.ok) {
        mappedVoices = normalizeVoicesResponse(await singular.json());
      }
    }

    if (mappedVoices.length === 0) {
      console.warn('[Voices] Vapi voice list empty/unavailable; using fallback voices');
      mappedVoices = FALLBACK_VOICES;
    } else {
      mappedVoices = withDemoVoice(mappedVoices);
    }

    // Update cache
    cache.data = mappedVoices;
    cache.fetchedAt = Date.now();

    res.json({ voices: mappedVoices });
  } catch (err) {
    console.warn('[Voices] Failed to fetch from Vapi; using fallback voices', err);
    cache.data = FALLBACK_VOICES;
    cache.fetchedAt = Date.now();
    res.json({ voices: FALLBACK_VOICES });
  }
});

export default router;
