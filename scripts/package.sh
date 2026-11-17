#!/usr/bin/env bash
# Builds dist/faw-claude-account-switcher-<version>.zip containing ONLY the extension files.
set -euo pipefail
cd "$(dirname "$0")/.."
v=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
mkdir -p dist
out="dist/faw-claude-account-switcher-$v.zip"
rm -f "$out"
(cd extension && zip -qr "../$out" . -x "*.DS_Store")
echo "built $out"; unzip -l "$out" | tail -1
