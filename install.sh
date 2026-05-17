#!/usr/bin/env bash

set -e

# First-pass installer for early testers using Vencord source builds.
# This script intentionally avoids sudo, global installs, and changes to source files.

fail() {
    printf 'Error: %s\n' "$1" >&2
    exit 1
}

info() {
    printf '\n==> %s\n' "$1"
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        fail "Missing required dependency: $1. Please install it and run this script again."
    fi
}

download_model() {
    local model_url="$1"
    local model_path="$2"
    local temp_path="${model_path}.tmp"

    if command -v curl >/dev/null 2>&1; then
        curl -L --fail --progress-bar -o "$temp_path" "$model_url"
    elif command -v wget >/dev/null 2>&1; then
        wget -O "$temp_path" "$model_url"
    else
        return 1
    fi

    mv "$temp_path" "$model_path"
}

print_model_instructions() {
    local model_url="$1"
    local model_path="$2"

    printf '\nCould not download the Whisper model automatically.\n'
    printf 'Please download it manually from:\n'
    printf '  %s\n' "$model_url"
    printf 'Then save it as:\n'
    printf '  %s\n' "$model_path"
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
HELPER_DIR="$REPO_DIR/helper"
MODEL_DIR="$HELPER_DIR/models"
MODEL_PATH="$MODEL_DIR/ggml-base.en.bin"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"
VENCORD_DIR="$HOME/Vencord"
USERPLUGINS_DIR="$VENCORD_DIR/src/userplugins"
PLUGIN_SOURCE_DIR="$REPO_DIR/plugin/DL-DVT"
PLUGIN_DEST_DIR="$USERPLUGINS_DIR/DL-DVT"

info "Checking dependencies"
require_command node
require_command npm
require_command git
require_command pnpm

info "Checking project layout"
[ -d "$HELPER_DIR" ] || fail "Missing helper directory: $HELPER_DIR"
[ -d "$PLUGIN_SOURCE_DIR" ] || fail "Missing plugin directory: $PLUGIN_SOURCE_DIR"

info "Checking Vencord source checkout"
[ -d "$VENCORD_DIR" ] || fail "Vencord source checkout not found at $VENCORD_DIR. Please clone/build Vencord from source first, then rerun this installer."
[ -d "$USERPLUGINS_DIR" ] || fail "Vencord userplugins directory not found at $USERPLUGINS_DIR. Please verify your Vencord source checkout is set up correctly."

info "Installing helper dependencies"
(cd "$HELPER_DIR" && npm install)

info "Checking Whisper model"
mkdir -p "$MODEL_DIR"
if [ ! -f "$MODEL_PATH" ]; then
    printf 'Model not found at %s\n' "$MODEL_PATH"
    printf 'Downloading from official whisper.cpp model mirror...\n'

    if ! download_model "$MODEL_URL" "$MODEL_PATH"; then
        rm -f "${MODEL_PATH}.tmp"
        print_model_instructions "$MODEL_URL" "$MODEL_PATH"
        exit 1
    fi
else
    printf 'Model already exists at %s\n' "$MODEL_PATH"
fi

info "Installing Vencord user plugin"
rm -rf "$PLUGIN_DEST_DIR"
cp -R "$PLUGIN_SOURCE_DIR" "$PLUGIN_DEST_DIR"

info "Building Vencord"
(cd "$VENCORD_DIR" && pnpm build)

printf '\nInstallation complete.\n\n'
printf 'Next steps:\n'
printf '  1. Start the helper: cd ~/DL-DVT/helper && npm start\n'
printf '  2. Fully restart Vesktop/Discord.\n'
printf '  3. Enable DL-DVT in Vencord plugins if needed.\n'
