import { Router } from 'express';
import { config } from '../config';

const router = Router();
type VoiceDto = { voiceId: string; name: string; provider: string; previewUrl?: string };

// Module-level cache
const cache = {
  data: null as VoiceDto[] | null,
  fetchedAt: 0
};

const CACHE_TTL = 3600000; // 1 hour
// Vapi provides sample audio at: https://storage.vapi.ai/voice/{voiceId}.mp3
const FALLBACK_VOICES: VoiceDto[] = [
  { voiceId: 'Elliot', name: 'Elliot (Demo)', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/elliot.mp3' },
  { voiceId: 'elliot', name: 'Elliot', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/elliot.mp3' },
  { voiceId: 'rohan', name: 'Rohan', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/rohan.mp3' },
  { voiceId: 'emma', name: 'Emma', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/emma.mp3' },
  { voiceId: 'clara', name: 'Clara', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/clara.mp3' },
  { voiceId: 'nico', name: 'Nico', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/nico.mp3' },
  { voiceId: 'kai', name: 'Kai', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/kai.mp3' },
  { voiceId: 'sagar', name: 'Sagar', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/sagar.mp3' },
  { voiceId: 'godfrey', name: 'Godfrey', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/godfrey.mp3' },
  { voiceId: 'neil', name: 'Neil', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/neil.mp3' },
  { voiceId: 'joseph', name: 'Joseph', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/joseph.mp3' },
  { voiceId: 'jennifer', name: 'Jennifer', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/jennifer.mp3' },
  { voiceId: 'michael', name: 'Michael', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/michael.mp3' },
  { voiceId: 'sarah', name: 'Sarah', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/sarah.mp3' },
  { voiceId: 'alex', name: 'Alex', provider: 'vapi', previewUrl: 'https://storage.vapi.ai/voice/alex.mp3' }
];

function normalizeVoicesResponse(payload: unknown): VoiceDto[] {
  const root = payload as
    | Array<Record<string, unknown>>
    | { data?: Array<Record<string, unknown>>; voices?: Array<Record<string, unknown>> };

  const rawList = Array.isArray(root) ? root : (root?.data || root?.voices || []);
  return rawList
    .map((v) => ({
      voiceId: String(v.id ?? v.voiceId ?? ''),
      name: String(v.name ?? 'Unknown'),
      provider: String(v.provider ?? 'vapi'),
      previewUrl:
        typeof v.previewUrl === 'string'
          ? v.previewUrl
          : typeof v.preview_url === 'string'
            ? String(v.preview_url)
            : typeof v.sampleUrl === 'string'
              ? String(v.sampleUrl)
              : typeof v.sample_url === 'string'
                ? String(v.sample_url)
                : undefined
    }))
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
