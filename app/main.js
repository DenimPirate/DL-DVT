const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

const HELPER_URL = "http://127.0.0.1:8765";
const GITHUB_URL = "https://github.com/DenimPirate/DL-DVT";
const ROOT_DIR = path.join(__dirname, "..");

let mainWindow = null;
let helperProcess = null;
let helperStatus = "stopped";
let helperError = "";
let isQuitting = false;

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
    app.quit();
    process.exit(0);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 520,
        height: 430,
        minWidth: 420,
        minHeight: 360,
        title: "DL-DVT Helper",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, "index.html"));

    mainWindow.on("close", event => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
}

function setHelperStatus(status, error = "") {
    helperStatus = status;
    helperError = error;

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("helper-status", getHelperState());
    }
}

function getHelperState() {
    return {
        status: helperStatus,
        error: helperError,
        url: HELPER_URL,
        hasManagedProcess: Boolean(helperProcess)
    };
}

async function checkHealth() {
    try {
        const response = await fetch(`${HELPER_URL}/health`);
        if (!response.ok) {
            throw new Error(`Health check failed: ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        return null;
    }
}

async function refreshStatusFromHealth() {
    if (["starting", "stopping"].includes(helperStatus)) return getHelperState();

    const health = await checkHealth();

    if (health?.ok) {
        setHelperStatus("running");
    } else if (!helperProcess) {
        setHelperStatus("stopped");
    }

    return getHelperState();
}

async function waitForHealthy(timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const health = await checkHealth();
        if (health?.ok) return true;
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return false;
}

async function startHelper() {
    if (helperProcess || ["starting", "running"].includes(helperStatus)) {
        return getHelperState();
    }

    const existingHealth = await checkHealth();
    if (existingHealth?.ok) {
        setHelperStatus("running");
        return getHelperState();
    }

    setHelperStatus("starting");

    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    helperProcess = spawn(npmCommand, ["--prefix", "helper", "start"], {
        cwd: ROOT_DIR,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"]
    });

    helperProcess.stdout.on("data", data => {
        console.log(`[helper] ${data.toString().trim()}`);
    });

    helperProcess.stderr.on("data", data => {
        console.error(`[helper] ${data.toString().trim()}`);
    });

    helperProcess.on("error", err => {
        helperProcess = null;
        setHelperStatus("error", err.message);
    });

    helperProcess.on("exit", (code, signal) => {
        helperProcess = null;

        if (helperStatus === "stopping" || isQuitting) {
            setHelperStatus("stopped");
            return;
        }

        setHelperStatus("error", `Helper exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}`);
    });

    const isHealthy = await waitForHealthy();
    if (isHealthy) {
        setHelperStatus("running");
    } else if (helperProcess) {
        setHelperStatus("error", "Helper started, but the health check did not respond.");
    }

    return getHelperState();
}

async function stopHelper() {
    if (!helperProcess) {
        setHelperStatus("stopped");
        return getHelperState();
    }

    setHelperStatus("stopping");

    const processToStop = helperProcess;

    if (process.platform === "win32") {
        processToStop.kill("SIGTERM");
    } else {
        try {
            process.kill(-processToStop.pid, "SIGTERM");
        } catch (err) {
            processToStop.kill("SIGTERM");
        }
    }

    await new Promise(resolve => {
        const timeout = setTimeout(resolve, 5000);
        processToStop.once("exit", () => {
            clearTimeout(timeout);
            resolve();
        });
    });

    if (helperProcess === processToStop) {
        if (process.platform === "win32") {
            processToStop.kill("SIGKILL");
        } else {
            try {
                process.kill(-processToStop.pid, "SIGKILL");
            } catch (err) {
                processToStop.kill("SIGKILL");
            }
        }

        helperProcess = null;
    }

    setHelperStatus("stopped");
    return getHelperState();
}

async function quitApp() {
    isQuitting = true;
    await stopHelper();
    app.quit();
}

app.whenReady().then(async () => {
    createWindow();
    await refreshStatusFromHealth();
});

app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
});

app.on("activate", () => {
    if (mainWindow) {
        mainWindow.show();
    } else {
        createWindow();
    }
});

app.on("window-all-closed", () => {});

ipcMain.handle("helper:get-status", refreshStatusFromHealth);
ipcMain.handle("helper:start", startHelper);
ipcMain.handle("helper:stop", stopHelper);
ipcMain.handle("app:quit", quitApp);
ipcMain.handle("app:open-github", () => shell.openExternal(GITHUB_URL));
