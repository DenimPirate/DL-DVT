const { ipcRenderer } = require("electron");

const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const helperUrl = document.getElementById("helperUrl");
const healthText = document.getElementById("healthText");
const errorText = document.getElementById("errorText");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const githubButton = document.getElementById("githubButton");
const quitButton = document.getElementById("quitButton");

const statusLabels = {
    stopped: "Stopped",
    starting: "Starting...",
    running: "Running",
    stopping: "Stopping...",
    error: "Error"
};

let latestState = {
    status: "stopped",
    error: "",
    url: "http://127.0.0.1:8765"
};

function renderState(state) {
    latestState = state;

    const status = state.status || "stopped";
    statusText.textContent = statusLabels[status] || status;
    statusDot.className = `status-dot ${status}`;
    helperUrl.textContent = state.url || "http://127.0.0.1:8765";

    startButton.disabled = ["starting", "running", "stopping"].includes(status);
    stopButton.disabled = ["stopped", "starting", "stopping"].includes(status);

    if (state.error) {
        errorText.hidden = false;
        errorText.textContent = state.error;
    } else {
        errorText.hidden = true;
        errorText.textContent = "";
    }
}

async function pollHealth() {
    try {
        const response = await fetch(`${latestState.url}/health`);
        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error("Health check failed");
        }

        healthText.textContent = `${data.name}: ${data.status}`;

        if (!["starting", "stopping"].includes(latestState.status)) {
            renderState({ ...latestState, status: "running", error: "" });
        }
    } catch (err) {
        healthText.textContent = "No response from /health";

        if (!["starting", "stopping", "error"].includes(latestState.status)) {
            renderState({ ...latestState, status: "stopped" });
        }
    }
}

async function refreshFromMain() {
    const state = await ipcRenderer.invoke("helper:get-status");
    renderState(state);
    await pollHealth();
}

startButton.addEventListener("click", async () => {
    renderState({ ...latestState, status: "starting", error: "" });
    renderState(await ipcRenderer.invoke("helper:start"));
    await pollHealth();
});

stopButton.addEventListener("click", async () => {
    renderState({ ...latestState, status: "stopping", error: "" });
    renderState(await ipcRenderer.invoke("helper:stop"));
    await pollHealth();
});

githubButton.addEventListener("click", () => {
    ipcRenderer.invoke("app:open-github");
});

quitButton.addEventListener("click", () => {
    ipcRenderer.invoke("app:quit");
});

ipcRenderer.on("helper-status", (event, state) => {
    renderState(state);
});

refreshFromMain();
setInterval(pollHealth, 2500);
