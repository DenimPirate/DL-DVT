const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const HELPER_DIR = __dirname;
const UPLOADS_DIR = path.join(HELPER_DIR, "uploads");
const WHISPER_BIN = path.join(HELPER_DIR, "bin", "whisper-cli");
const MODEL = path.join(HELPER_DIR, "models", "ggml-base.en.bin");
const BUNDLED_FFMPEG = path.join(HELPER_DIR, "bin", "ffmpeg");
const FFMPEG = fs.existsSync(BUNDLED_FFMPEG) ? BUNDLED_FFMPEG : "ffmpeg";

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR });

app.post("/transcribe-url", async (req, res) => {
    const { url } = req.body;
    console.log("Request received: POST /transcribe-url", { url });

    if (!url) {
        return res.status(400).json({ error: "No URL provided" });
    }

    const inputPath = path.join(UPLOADS_DIR, `${Date.now()}-voice.ogg`);
    const wavPath = `${inputPath}.wav`;

    try {
        const audioResponse = await fetch(url);

        if (!audioResponse.ok) {
            throw new Error(`Failed to download audio: ${audioResponse.status}`);
        }

        const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
        fs.writeFileSync(inputPath, audioBuffer);

        console.log("ffmpeg started");
        await run(FFMPEG, [
            "-y",
            "-i", inputPath,
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            wavPath
        ]);
        console.log("ffmpeg finished");

        console.log("whisper started");
        const output = await run(WHISPER_BIN, [
            "-m", MODEL,
            "-f", wavPath,
            "--no-timestamps"
        ]);
        console.log("whisper finished");

        const text = cleanWhisperOutput(output);

        res.json({ text });
        console.log("Transcription complete");
    } catch (err) {
        console.error("Transcription error:", err.stack || err);
        res.status(500).json({ error: err.message });
    } finally {
        fs.rmSync(inputPath, { force: true });
        fs.rmSync(wavPath, { force: true });
    }
});


app.post("/transcribe", upload.single("audio"), async (req, res) => {
    console.log("Request received: POST /transcribe");

    if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded" });
    }

    const inputPath = req.file.path;
    const wavPath = `${inputPath}.wav`;

    try {
        console.log("ffmpeg started");
        await run(FFMPEG, [
            "-y",
            "-i", inputPath,
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            wavPath
        ]);
        console.log("ffmpeg finished");

        console.log("whisper started");
        const output = await run(WHISPER_BIN, [
            "-m", MODEL,
            "-f", wavPath,
            "--no-timestamps"
        ]);
        console.log("whisper finished");

        const text = cleanWhisperOutput(output);

        res.json({ text });
        console.log("Transcription complete");
    } catch (err) {
        console.error("Transcription error:", err.stack || err);
        res.status(500).json({ error: err.message });
    } finally {
        fs.rmSync(inputPath, { force: true });
        fs.rmSync(wavPath, { force: true });
    }
});

function run(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args);

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", data => {
            stdout += data.toString();
        });

        child.stderr.on("data", data => {
            stderr += data.toString();
        });

        child.on("close", code => {
            if (code !== 0) {
                reject(new Error(stderr || `${command} exited with code ${code}`));
            } else {
                resolve(stdout || stderr);
            }
        });
    });
}

function cleanWhisperOutput(output) {
    return output
        .split("\n")
        .filter(line => line.trim())
        .filter(line => !line.includes("whisper_"))
        .filter(line => !line.includes("system_info"))
        .map(line => line.replace(/\[[^\]]+\]/g, "").trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

app.listen(8765, "127.0.0.1", () => {
    console.log("Server started: Voice note transcriber running on http://127.0.0.1:8765");
    console.log("Using whisper binary:", WHISPER_BIN);
    console.log("Using model:", MODEL);
    console.log("Using ffmpeg:", FFMPEG);
    console.log("Using uploads directory:", UPLOADS_DIR);
});
