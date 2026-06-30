# Chrome Web Store — Submission Checklist & Listing Copy

Use this document when submitting Kapowie to the Chrome Web Store Developer Dashboard
(https://chrome.google.com/webstore/devconsole). Fill the fields below verbatim, then
complete the manual steps in §6.

---

## 1. Store Listing Copy

### Name (up to 45 characters)
```
Kapowie — Stream Recorder
```

### Short description (up to 132 characters)
```
Record and re-stream live HLS/DASH video streams from any website. One-click recording with quality selection and MP4 export.
```

### Detailed description (up to 16 000 characters)

```
Kapowie lets you record live video streams directly in Chrome — no separate app required.

WHAT IT DOES
• Auto-detects HLS (.m3u8) and DASH (.mpd) streams on any page
• One-click REC button to start capturing
• Concurrent segment downloading (up to 10 at once) for zero-gap recordings
• AES-128 decryption for encrypted streams
• Quality selection: 1080p / 720p / 480p when multiple variants are available
• Pause and resume a recording mid-stream
• Muxes all segments into a clean MP4 using FFmpeg (runs entirely in your browser — no upload needed)
• Re-stream locally via an HLS server on port 8080 so you can watch on your TV or phone while recording
• Manual URL input for .m3u8, .mpd, and direct .mp4 links

ALL LOCAL — NO ACCOUNT REQUIRED
Everything runs on your device. Kapowie has no backend, no account, no analytics, and no ads.
Recorded files are saved straight to your Downloads folder.

OPEN SOURCE — MIT LICENSED
Full source code at https://github.com/peterjbardenhagen/kapowie

SYSTEM REQUIREMENTS
• Chrome / Chromium 120 or later
• Works on Windows, macOS, and Linux
```

### Category
`Video` (primary) — or `Productivity` if Video is not offered as a top-level category option.

### Language
`English`

### Privacy policy URL
```
https://kapowie.vercel.app/privacy.html
```

---

## 2. Permission Justifications

The CWS review team requires written justification for each permission in the
**"Justify your use"** step of the submission form.

| Permission | Justification |
|---|---|
| `webRequest` | Intercepts network requests to detect HLS/DASH stream URLs (`.m3u8`, `.mpd`, `.m4s`, `.ts` patterns) on the current page. Required to discover the stream before the user clicks Record. |
| `declarativeNetRequest` | Injects `Access-Control-Allow-Origin` response headers on stream segment requests so the browser can fetch segments cross-origin. Without this the download is blocked by CORS policy. |
| `activeTab` | Reads the current tab's video element via a content script to identify the stream URL and attach a floating REC button overlay. Only active while the popup is open. |
| `scripting` | Executes the stream-detection content script on the active tab. Used solely to find the stream URL and inject the REC button; the script does not read page content. |
| `tabs` | Reads the current tab URL to pass context to the background service worker. Used only to know which tab to attach stream detection to. |
| `storage` | Persists user preferences (quality level, output format) and in-progress recording state locally via `chrome.storage.local`. No data leaves the device. |
| `downloads` | Writes the finished MP4 file to the user's Downloads folder after muxing. Required to save the recording. |
| `offscreen` | Opens a hidden Offscreen Document to run FFmpeg (compiled to WebAssembly) for muxing downloaded segments into an MP4 container. Required because WebAssembly with SharedArrayBuffer needs a controlled document context. |
| `host_permissions: <all_urls>` | Stream segments (`.ts`, `.m4s`) can be hosted on any domain — the recording follows wherever the stream originates. Also needed to inject CORS override headers on those requests. The extension does not read general page content via these permissions. |

---

## 3. Single-Purpose Statement

> Kapowie's single purpose is to record and locally save live video streams (HLS/DASH)
> that the user is watching in their browser. Every permission it requests is directly
> required by this recording function: detecting the stream URL, downloading its segments,
> decrypting them, muxing them into MP4, and saving the file to disk.

---

## 4. Data Safety / Privacy Practices

Answer these questions in the **Privacy practices** step of the Developer Dashboard:

| Question | Answer |
|---|---|
| Does your extension collect or use personal data? | No |
| Does your extension store data on an external server? | No |
| Does your extension share data with third parties? | No |
| Do you handle personal communications (email, messages)? | No |
| Do you handle authentication credentials? | No |
| Do you use the data for any purpose other than the extension's primary function? | No |
| Does your extension inject ads or modify search results? | No |

**Summary statement for the form:**
> Kapowie records video streams locally on the user's device. It collects no personal data,
> sends no data to external servers, and has no analytics or advertising. The host_permissions
> are used solely to fetch stream segments from the streaming provider and inject CORS headers.
> All processing (decryption, muxing) runs in the browser via WebAssembly.

---

## 5. Store Assets Checklist

Before submitting, prepare these assets. Exact pixel dimensions are required.

| Asset | Dimensions | Required | Notes |
|---|---|---|---|
| Extension icon (128×128) | 128×128 px PNG | Yes | Already in `extension/src/public/icon-128.png` |
| Small promotional tile | 440×280 px PNG/JPG | Yes | See `docs/assets/store-promo-440x280.png` (generated) |
| Large promotional tile | 920×680 px PNG/JPG | Optional | Needed for featured placement |
| Marquee banner | 1400×560 px PNG/JPG | Optional | Needed for featured placement |
| Screenshots | 1280×800 or 640×400 px PNG/JPG | Yes (at least 1) | See `docs/assets/store-screenshot-*.png` |

Screenshots should show the extension popup open on a page with a detected stream,
and the recording controls in use.

---

## 6. Manual Submission Steps

These steps cannot be automated — they require your Google account and the
Chrome Web Store Developer Dashboard.

1. **Register as a developer** (one-time, $5 USD fee)
   → https://chrome.google.com/webstore/devconsole/register

2. **Build the extension ZIP**
   ```bash
   cd extension
   npm run zip
   # Output: .output/kapowie-0.1.0.zip  (or similar — check .output/ directory)
   ```

3. **Upload to the Dashboard**
   - Go to https://chrome.google.com/webstore/devconsole
   - Click "New item" → upload the ZIP
   - Your extension gets assigned a permanent **Extension ID** — record it in
     `scripts/publish-extension.sh` replacing `YOUR_EXTENSION_ID_HERE`.

4. **Fill in the Store Listing** using the copy in §1 above.

5. **Fill in Permission Justifications** using the table in §2 above.

6. **Upload assets** from §5 above.

7. **Set Privacy Policy URL** to `https://kapowie.vercel.app/privacy.html`

8. **Answer Data Safety questions** using §4 above.

9. **Submit for review** — initial review typically takes 1–3 business days.

### For subsequent releases (automated):
After the first manual upload, use `scripts/publish-extension.sh` with OAuth2
credentials from the Developer Dashboard:
```bash
export WEB_STORE_CLIENT_ID=...
export WEB_STORE_CLIENT_SECRET=...
export WEB_STORE_REFRESH_TOKEN=...
./scripts/publish-extension.sh .output/kapowie-0.1.1.zip
```
