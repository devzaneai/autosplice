#!/bin/bash
# AutoSplice Installer for macOS
set -e

DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/autosplice"

echo "=== AutoSplice Installer ==="
echo ""
echo "Installing to: $DEST"
echo ""

# Create destination
mkdir -p "$DEST"

# Copy built extension
if [ -d "dist/cep" ]; then
  cp -R dist/cep/* "$DEST/"
elif [ -d "cep" ]; then
  cp -R cep/* "$DEST/"
else
  echo "ERROR: Could not find built extension."
  echo "If you downloaded a release, unzip it and run this script from inside the folder."
  echo "If you're building from source, run 'npm run build' first."
  exit 1
fi

echo "Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Restart Adobe Premiere Pro"
echo "  2. Go to Window → Extensions → AutoSplice"
echo ""
