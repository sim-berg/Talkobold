// PORTABLE core: ElevenLabs text-to-speech.
// No Electron imports here — this module must stay runnable under Tauri/mobile.
// Phase 2 fills in the real streaming call; phase 1 ships the interface + a stub.

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

/**
 * Convert text to speech via ElevenLabs.
 * @param {object} opts
 * @param {string} opts.apiKey   - ElevenLabs API key
 * @param {string} opts.text     - text to speak
 * @param {string} opts.voiceId  - ElevenLabs voice id
 * @param {string} [opts.modelId] - defaults to the low-latency flash model
 * @returns {Promise<ArrayBuffer>} audio bytes (mp3)
 */
async function synthesize({ apiKey, text, voiceId, modelId = 'eleven_flash_v2_5' }) {
  if (!apiKey) throw new Error('Missing ElevenLabs API key');
  if (!text || !text.trim()) throw new Error('Nothing to speak');
  if (!voiceId) throw new Error('No voice selected');

  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      output_format: 'mp3_44100_128',
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${detail || res.statusText}`);
  }
  return res.arrayBuffer();
}

/**
 * Fetch the account's available voices for the picker.
 * @param {object} opts
 * @param {string} opts.apiKey
 * @returns {Promise<Array<{voiceId: string, name: string}>>}
 */
async function listVoices({ apiKey }) {
  if (!apiKey) throw new Error('Missing ElevenLabs API key');
  const res = await fetch(`${ELEVENLABS_BASE}/voices`, {
    headers: { 'xi-api-key': apiKey, Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${detail || res.statusText}`);
  }
  const data = await res.json();
  return (data.voices || []).map((v) => ({ voiceId: v.voice_id, name: v.name }));
}

module.exports = { synthesize, listVoices, ELEVENLABS_BASE };
