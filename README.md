# DenimLabs Discord Voicenote Transcriber

DenimLabs Discord Voicenote Transcriber (DL-DVT) is a Vencord/Vesktop plugin plus local helper app for transcribing Discord voice notes with whisper.cpp.

The Vencord plugin adds a Transcribe button to audio attachments. The GUI helper app starts and stops a local helper on `127.0.0.1:8765`, downloads or accepts audio, converts it to 16 kHz mono WAV with ffmpeg, runs whisper.cpp, and returns the transcript.

This is currently a companion-app prototype. The helper app must be open and the helper must be running before the plugin can transcribe voice notes.

Transcription is local and private: audio is sent only to the helper running on your machine, then processed with the bundled whisper.cpp binary and model.

## Easy Install

For early testers using a Vencord source checkout:

```bash
git clone https://github.com/DenimPirate/DL-DVT.git
cd DL-DVT
./install.sh
npm start
```

After installation, fully restart Vesktop/Discord and enable `DL-DVT` in Vencord plugins if needed.

## Requirements

- Linux
- Vencord source checkout at `~/Vencord`
- `node`, `npm`, `git`, and `pnpm`
- Vesktop or Discord with Vencord

## Project Structure

```text
DL-DVT/
├── package.json
├── app/
│   ├── main.js
│   ├── index.html
│   ├── renderer.js
│   └── style.css
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

- `GET /health` with helper status JSON
- `POST /transcribe-url` with JSON like `{ "url": "https://cdn.discordapp.com/attachments/..." }`
- `POST /transcribe` with a multipart uploaded audio file named `audio`

The helper uses paths relative to the `helper/` folder:

- `helper/bin/whisper-cli`
- `helper/models/ggml-base.en.bin` when present. The installer downloads this automatically if missing.
- `helper/bin/ffmpeg` when present, otherwise the system `ffmpeg`
- `helper/uploads/`

## Start The Helper

```bash
cd ~/DL-DVT
npm run install:helper
npm start
```

`npm start` opens the Electron GUI helper app. Click **Start Helper** to start the local transcription server.

Closing the GUI window hides it and keeps the helper running in the background. Use **Quit** to stop the helper and fully exit the helper app.

For helper-only development without the GUI, run:

```bash
npm run start:helper
```

For GUI development, `npm run dev` launches the Electron helper app.

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

## Release Packaging

Do not upload or share release zips containing `.git`, `node_modules`, or `helper/models/ggml-base.en.bin`. Those may exist locally after development or installation, but they should not be included in release archives.
