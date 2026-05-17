# DenimLabs Discord Voicenote Transcriber

DenimLabs Discord Voicenote Transcriber (DL-DVT) is a Vencord/Vesktop plugin plus local helper app for transcribing Discord voice notes with whisper.cpp.

The Vencord plugin adds a Transcribe button to audio attachments. The helper runs locally on `127.0.0.1:8765`, downloads or accepts audio, converts it to 16 kHz mono WAV with ffmpeg, runs whisper.cpp, and returns the transcript.

This is currently a companion-app prototype. The helper must be running locally before the plugin can transcribe voice notes.

Transcription is local and private: audio is sent only to the helper running on your machine, then processed with the bundled whisper.cpp binary and model.

## Project Structure

```text
DL-DVT/
├── package.json
├── helper/
│   ├── server.js
│   ├── package.json
│   ├── uploads/
│   ├── bin/
│   │   ├── whisper-cli
│   │   └── ffmpeg
│   └── models/
│       └── ggml-base.en.bin
└── plugin/
    └── DL-DVT/
        ├── index.tsx
        └── style.css
```

## Current Dev Setup

The helper is a Node/Express server. It exposes:

- `POST /transcribe-url` with JSON like `{ "url": "https://cdn.discordapp.com/attachments/..." }`
- `POST /transcribe` with a multipart uploaded audio file named `audio`

The helper uses paths relative to the `helper/` folder:

- `helper/bin/whisper-cli`
- `helper/models/ggml-base.en.bin`
- `helper/bin/ffmpeg` when present, otherwise the system `ffmpeg`
- `helper/uploads/`

## Start The Helper

```bash
cd ~/DL-DVT
npm run install:helper
npm start
```

For development, `npm run dev` currently runs the same helper server command.

## Vencord Plugin Development

During development, copy the plugin folder into Vencord's user plugins directory:

```bash
cp -r ~/DL-DVT/plugin/DL-DVT ~/Vencord/src/userplugins/
```

Then rebuild or restart Vencord/Vesktop using your normal Vencord development workflow.

The plugin currently calls:

```text
http://127.0.0.1:8765/transcribe-url
```
