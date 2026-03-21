#!/bin/bash
# scripts/package-ffmpeg.sh
# Downloads pre-built FFmpeg static binaries for bundling with AutoSplice

set -e

OUTDIR="src/bin"
mkdir -p "$OUTDIR"

echo "=== AutoSplice FFmpeg Packager ==="
echo ""

# macOS arm64
echo "Downloading FFmpeg for macOS arm64..."
curl -L "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip" -o /tmp/ffmpeg-mac.zip
unzip -o /tmp/ffmpeg-mac.zip -d /tmp/ffmpeg-mac
cp /tmp/ffmpeg-mac/ffmpeg "$OUTDIR/ffmpeg-mac-arm64"
chmod +x "$OUTDIR/ffmpeg-mac-arm64"

# macOS x64 (arm64 binary works via Rosetta)
cp "$OUTDIR/ffmpeg-mac-arm64" "$OUTDIR/ffmpeg-mac-x64"

# Windows x64
echo "Downloading FFmpeg for Windows x64..."
curl -L "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -o /tmp/ffmpeg-win.zip
unzip -o /tmp/ffmpeg-win.zip -d /tmp/ffmpeg-win
find /tmp/ffmpeg-win -name "ffmpeg.exe" -exec cp {} "$OUTDIR/ffmpeg-win-x64.exe" \;

echo ""
echo "FFmpeg binaries ready in $OUTDIR/:"
ls -lh "$OUTDIR/ffmpeg-"*
echo ""
echo "NOTE: These binaries are NOT committed to git."
echo "They are included in GitHub Releases via the CI pipeline."
