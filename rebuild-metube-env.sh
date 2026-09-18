#!/bin/bash
# Rebuilds the MeTube dev environment after a sandbox reset.
# (Only regular files persist across sessions; tools/venvs/builds must be reinstalled.)
# Usage: bash ~/rebuild-metube-env.sh
# Then start servers (each in its own start_process call):
#   1. /home/user/.local/bin/bgutil-pot server
#   2. cd /home/user/metube && export YTDL_OPTIONS='{"impersonate":"chrome"}';
#      PATH="/home/user/.local/bin:/usr/local/bin:/usr/bin:/bin" PORT=8081 \
#      DOWNLOAD_DIR=/home/user/metube-downloads AUDIO_DOWNLOAD_DIR=/home/user/metube-downloads \
#      STATE_DIR=/home/user/metube-downloads/.metube TEMP_DIR=/home/user/metube-downloads \
#      /home/user/metube/.venv/bin/python app/main.py
set -e
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$HOME/.local/share/pnpm/bin:$PATH"

NEED_NODE=0
command -v node >/dev/null && node -e "const [a,b,c]=process.version.slice(1).split('.').map(Number); process.exit((a===22&&b>22)||(a===22&&b===22&&c>=3)||a>22?0:1)" || NEED_NODE=1
if [ "$NEED_NODE" = "1" ]; then
  echo "=== installing node latest-v22 ==="
  mkdir -p "$HOME/.local"
  LATEST_V22=$(curl -fsSL https://nodejs.org/dist/index.json | grep -o '"version":"v22[^"]*"' | head -1 | cut -d'"' -f4)
  cd /tmp && curl -fsSLO "https://nodejs.org/dist/${LATEST_V22}/node-${LATEST_V22}-linux-x64.tar.xz"
  tar -xf "node-${LATEST_V22}-linux-x64.tar.xz" && rm -rf "$HOME/.local/node" && mv "node-${LATEST_V22}-linux-x64" "$HOME/.local/node" && rm -f "node-${LATEST_V22}-linux-x64.tar.xz"
  export PATH="$HOME/.local/node/bin:$PATH"; node --version
fi
if ! command -v uv >/dev/null; then echo "=== installing uv ==="; curl -LsSf https://astral.sh/uv/install.sh | sh; fi
export PATH="$HOME/.local/bin:$PATH"; uv --version
if ! command -v pnpm >/dev/null; then echo "=== installing pnpm ==="; curl -fsSL https://get.pnpm.io/install.sh | sh - 2>&1 | tail -1; fi
export PATH="$HOME/.local/share/pnpm/bin:$PATH"; pnpm --version
if ! command -v ffmpeg >/dev/null; then echo "=== installing ffmpeg ==="; sudo apt-get update -qq 2>&1 | tail -1; sudo apt-get install -y -qq ffmpeg 2>&1 | tail -1; fi
if ! command -v deno >/dev/null; then echo "=== installing deno ==="; curl -fsSL https://deno.land/install.sh | DENO_INSTALL=$HOME/.local sh 2>&1 | tail -1; fi
if [ ! -d /home/user/metube/.venv ]; then echo "=== uv sync ==="; cd /home/user/metube && uv sync --frozen 2>&1 | tail -2; fi
if ! command -v bgutil-pot >/dev/null; then
  echo "=== bgutil ==="
  BGUTIL_TAG="$(curl -Ls -o /dev/null -w '%{url_effective}' https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/latest | sed 's#.*/tag/##')"
  curl -fsSL -o "$HOME/.local/bin/bgutil-pot" "https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/download/${BGUTIL_TAG}/bgutil-pot-linux-x86_64" && chmod +x "$HOME/.local/bin/bgutil-pot"
  PLUGIN_DIR="$(/home/user/metube/.venv/bin/python -c 'import site; print(site.getsitepackages()[0])')"
  curl -fsSL -o /tmp/bgutil-plugin.zip "https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs/releases/download/${BGUTIL_TAG}/bgutil-ytdlp-pot-provider-rs.zip"
  /home/user/metube/.venv/bin/python -m zipfile -e /tmp/bgutil-plugin.zip "$PLUGIN_DIR" && rm /tmp/bgutil-plugin.zip
fi
if [ ! -d /home/user/metube/ui/node_modules ]; then echo "=== pnpm install ==="; cd /home/user/metube/ui && export CI=true && pnpm install --frozen-lockfile 2>&1 | tail -2; fi
if [ ! -f /home/user/metube/ui/dist/metube/browser/index.html ]; then
  echo "=== building UI ==="; cd /home/user/metube/ui && export CI=true NODE_OPTIONS="--max-old-space-size=1408" && pnpm run build 2>&1 | tail -3
fi
echo REBUILD-DONE
