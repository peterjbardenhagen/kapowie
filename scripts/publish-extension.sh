#!/bin/bash
# Publish Chrome extension to Chrome Web Store
# Requires: Chrome Web Store API credentials
# Usage: ./scripts/publish-extension.sh [path-to-zip]

set -e

ZIP_FILE="${1:-scripts/dist/kapowie-extension-v0.1.0.zip}"
EXTENSION_ID="YOUR_EXTENSION_ID_HERE"  # Replace after first upload

if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ Zip file not found: $ZIP_FILE"
    echo "   Run ./scripts/build-extension.sh first"
    exit 1
fi

echo "📤 Publishing to Chrome Web Store..."
echo "   File: $ZIP_FILE"

# Upload new version
# Requires OAuth2 credentials set via:
#   export WEB_STORE_CLIENT_ID=...
#   export WEB_STORE_CLIENT_SECRET=...
#   export WEB_STORE_REFRESH_TOKEN=...
# Or use chrome-web-store CLI tool

chrome-web-store upload "$ZIP_FILE" --extension-id "$EXTENSION_ID" --publish

echo ""
echo "✅ Published successfully!"
echo "   Extension ID: $EXTENSION_ID"
echo "   View at: https://chrome.google.com/webstore/detail/$EXTENSION_ID"
echo ""
echo "Note: First publish requires manual upload to create the extension ID."
echo "      Get credentials at: https://chrome.google.com/webstore/devconsole/"
