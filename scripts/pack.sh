#!/bin/sh
# Build fitv-chrome-<version>.zip with manifest.json at the zip root.
set -e
cd "$(dirname "$0")/.."
V=$(node -p "require('./src/manifest.json').version")
OUT="fitv-chrome-$V.zip"
rm -f "$OUT"
(cd src && zip -r -X -q "../$OUT" . -x '.*' -x '*/.DS_Store')
echo "$OUT"
unzip -l "$OUT"
