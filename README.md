# Talkobold 🗣️

**Type text, hear it spoken into a virtual microphone.** A small desktop app
that gives a voice to people who can't talk — so they can be heard in voice
chats (Discord, Zoom, WhatsApp calls, games) and hear their own voice too.

Powered by [ElevenLabs](https://elevenlabs.io) text-to-speech.

> **Status: Phases 1–4 done + a one-click Windows installer.** Window + hotkey,
> ElevenLabs speech, the virtual microphone + monitor, editable quick phrases,
> and a first-run setup wizard all work on Linux and Windows.
> See [`PLAN.md`](./PLAN.md) and [`NEXT-STEPS.md`](./NEXT-STEPS.md).

## Install (Windows)

Run **`Talkobold Setup <version>.exe`** (built with `npm run dist:win`, see
below). It's a one-click per-user install — no admin — that adds Start Menu +
desktop shortcuts and launches the app. The installer is unsigned, so Windows
SmartScreen shows an "unknown publisher" notice: **More info → Run anyway**.

On first run a **setup wizard** walks you through your ElevenLabs key, a voice,
and the virtual mic. Windows needs the free **VB-CABLE** virtual-audio device —
the wizard detects it and offers an **Install** button if it's missing.

## Run from source (Linux/dev)

```bash
npm install
npm run gen-icon
npm run dev        # or: npm start  (needs the sandbox fixup in NEXT-STEPS.md)
```

On **first launch the window appears with the setup wizard**. After that,
**`Ctrl + Alt + Space`** summons/hides the window — or keep "show on launch"
enabled in Settings. Drop a square **PNG** at `assets/icon.png` for your own icon.

## How it works

The app creates a **virtual microphone** and plays synthesized speech into it.
Any voice app you point at the virtual mic transmits that speech as if you were
talking. You also hear your own voice through a separate monitor output.

```
type text ─▶ ElevenLabs TTS ─▶ virtual mic ─▶ Discord / Zoom / …
                            └─▶ your headphones (monitor)
```

- **Linux** — PipeWire `pw-loopback`, spawned automatically ("Talkobold Mic").
- **Windows** — free **VB-CABLE** driver, installed once via the wizard
  (apps pick "CABLE Output (VB-Audio Virtual Cable)").
- **macOS** (later) — BlackHole.

## Build the Windows installer

```bash
npm run dist:win        # → dist/Talkobold Setup <version>.exe  (≈ 80 MB)
```

Cross-building from Linux needs Wine once (`sudo apt install -y wine`, with i386
enabled — details in [`NEXT-STEPS.md`](./NEXT-STEPS.md)); building on Windows or
a GitHub Actions `windows-latest` runner needs no Wine.

## Tech

Electron + ElevenLabs, packaged with electron-builder. Core logic (`src/core/`)
and the platform boundary (`src/platform/`) are kept separate so the OS-specific
bits (virtual mic, window, tray) can be swapped for a [Tauri](https://tauri.app)
build (smaller installers, mobile) later.

## License

MIT
