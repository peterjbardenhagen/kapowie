#!/bin/bash
# Build script for Chrome Extension publishing
# Packages the extension as a ZIP file for Chrome Web Store upload

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EXTENSION_DIR="$PROJECT_ROOT/extension"
BUILD_DIR="$PROJECT_ROOT/build"
VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$PROJECT_ROOT/package.json" | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')

echo "Building Kapowie Chrome Extension v${VERSION}"

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Check extension directory exists
if [ ! -d "$EXTENSION_DIR" ]; then
  echo "Error: Extension directory not found at $EXTENSION_DIR"
  exit 1
fi

# Copy extension files
cp -r "$EXTENSION_DIR" "$BUILD_DIR/kapowie-extension"

# Update version in manifest if present
if [ -f "$BUILD_DIR/kapowie-extension/manifest.json" ]; then
  sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" "$BUILD_DIR/kapowie-extension/manifest.json"
  echo "Updated manifest version to ${VERSION}"
fi

# Create ZIP
ZIP_FILE="$BUILD_DIR/kapowie-extension-v${VERSION}.zip"
cd "$BUILD_DIR"
zip -r "kapowie-extension-v${VERSION}.zip" kapowie-extension/
cd "$PROJECT_ROOT"

echo "Build complete: $ZIP_FILE"
echo "Ready for Chrome Web Store upload"
