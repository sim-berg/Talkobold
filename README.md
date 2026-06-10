# TalkKobold 🗣️

**Type text, hear it spoken into a virtual microphone.** A small desktop app
that gives a voice to people who can't talk — so they can be heard in voice
chats (Discord, Zoom, WhatsApp calls, games) and hear their own voice too.

Powered by [ElevenLabs](https://elevenlabs.io) text-to-speech.

> **Status: Phases 1–4 done.** Window + hotkey, ElevenLabs speech, the
> PipeWire virtual microphone + monitor, and editable quick phrases all work.
> See [`PLAN.md`](./PLAN.md) and [`NEXT-STEPS.md`](./NEXT-STEPS.md).

## Quick start

```bash
npm install
npm run gen-icon
npm run dev        # or: npm start  (needs the sandbox fixup in NEXT-STEPS.md)
```

On **first launch the window appears with a setup wizard** (ElevenLabs key,
voice, virtual mic, "hear yourself"). After that, **`Ctrl + Alt + Space`**
summons/hides the window — or keep "show on launch" enabled in Settings.

Want your own icon? Drop a square **PNG** at `assets/icon.png` and restart.

## How it works

The app creates a **virtual microphone** and plays synthesized speech into it.
Any voice app you point at "TalkKobold Mic" will transmit that speech as if you
were talking. You also hear your own voice through a separate monitor output.

```
type text ─▶ ElevenLabs TTS ─▶ virtual mic ─▶ Discord / Zoom / …
                            └─▶ your headphones (monitor)
```

- **Linux** uses PipeWire (`pw-loopback`) — fully automatic.
- **Windows / macOS** (later) use VB-Cable / BlackHole.

## Tech

Electron + ElevenLabs. Core logic (`src/core/`) is kept platform-free so it can
move to a [Tauri](https://tauri.app) build (smaller installers, mobile) later.

## License

MIT
