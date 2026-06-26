#!/bin/bash
# Build and package Chrome extension for Chrome Web Store
# Usage: ./scripts/build-extension.sh [version]

set -e

EXTENSION_DIR="$(cd "$(dirname "$0")/../extension" && pwd)"
VERSION="${1:-$(node -p "require('$EXTENSION_DIR/package.json').version")}"
OUTPUT_DIR="$(dirname "$0")/dist"
PACKAGE_NAME="kapowie-extension-v${VERSION}.zip"

echo "🎬 Building Kapowie Chrome Extension v${VERSION}"

# Clean previous builds
rm -rf "$EXTENSION_DIR/.output"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Install dependencies
cd "$EXTENSION_DIR"
npm ci

# Run type check
echo "📋 Type checking..."
npm run type-check

# Run tests
echo "🧪 Running tests..."
npm run test

# Build for production
echo "🔨 Building..."
npm run build

# Verify output exists
if [ ! -d ".output/chrome-mv3" ]; then
    echo "❌ Build failed: .output/chrome-mv3 not found"
    exit 1
fi

# Package as zip
echo "📦 Packaging..."
cd .output/chrome-mv3
zip -r "../../../$OUTPUT_DIR/$PACKAGE_NAME" . -x "*.DS_Store" -x "__MACOSX/*" -x "*.git*"

echo ""
echo "✅ Build complete!"
echo "   Output: $OUTPUT_DIR/$PACKAGE_NAME"
echo "   Version: $VERSION"
echo ""
echo "Next steps:"
echo "  1. Test locally: chrome://extensions → Load unpacked → select extension/.output/chrome-mv3/"
echo "  2. Publish: Upload $PACKAGE_NAME to Chrome Web Store Developer Dashboard"
