// PORTABLE core: the quick-phrase library model.
// Pure data + helpers, no platform/storage assumptions (the platform layer
// decides where these are persisted). Phase 4 wires editing + persistence.

const DEFAULT_PHRASES = [
  'Yes',
  'No',
  'One second',
  'Thank you',
  'Hello!',
  'Can you repeat that?',
  'I need a moment',
  'Goodbye',
];

/** Normalise an arbitrary stored value into a clean string array. */
function normalize(list) {
  if (!Array.isArray(list)) return [...DEFAULT_PHRASES];
  const cleaned = list.map((s) => String(s).trim()).filter(Boolean);
  return cleaned.length ? cleaned : [...DEFAULT_PHRASES];
}

module.exports = { DEFAULT_PHRASES, normalize };
