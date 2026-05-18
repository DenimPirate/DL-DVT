import definePlugin from "@utils/types";
import { Button } from "@webpack/common";
import { React } from "@webpack/common";
import "./style.css";

function TranscribeButton({ url }: { url: string }) {
    const [text, setText] = React.useState("");
    const [status, setStatus] = React.useState("");

    async function transcribe() {
        setStatus("Transcribing...");
        setText("");

        try {
            const response = await fetch("http://127.0.0.1:8765/transcribe-url", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "DL-DVT helper returned an error");
            }

            setText(data.text || "No transcript returned");
            setStatus("");
        } catch (err) {
            console.error("DL-DVT failed:", err);
            setStatus("");

            const errorMessage = String(err);
            if (errorMessage.includes("Failed to fetch")) {
                setText("DL-DVT helper is not running. Open the DL-DVT helper app, click Start Helper, then try again.");
            } else {
                setText(`Transcription failed: ${errorMessage}`);
            }
        }
    }

    return (
        <div style={{ marginTop: "8px" }}>
            <Button
                size={Button.Sizes.SMALL}
                onClick={transcribe}
            >
                Transcribe
            </Button>

            {status && (
                <div className="vc-dl-dvt-loading">
                    <span className="vc-dl-dvt-spinner" />
                    <span>Transcribing...</span>
                </div>
            )}
            {text && (
                <div className="vc-dl-dvt-transcript">
                    {text}
                </div>
            )}
        </div>
    );
}

export default definePlugin({
    name: "DL-DVT",
    description: "DenimLabs Discord Voicenote Transcriber: transcribes Discord voice notes locally using Whisper.cpp",
    authors: [{ name: "Pierce" }],

    renderMessageAccessory(props: any) {
        const attachments = props.message?.attachments;

        if (!attachments?.length) return null;

        const audioAttachment = attachments.find((a: any) =>
            a.content_type?.includes("audio")
        );

        if (!audioAttachment?.url) return null;

        return <TranscribeButton url={audioAttachment.url} />;
    }
});
