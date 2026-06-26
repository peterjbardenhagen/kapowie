# Samsung Z Flip6 — Hermes Relay Setup Guide

**Device:** Samsung Galaxy Z Flip6 (SM-F741B/DS)
**OS:** Android 14 / One UI 6.1
**Last Updated:** 2026-06-26

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Hermes Relay Installation](#3-hermes-relay-installation)
4. [Pairing with PC](#4-pairing-with-pc)
5. [Terminal Configuration](#5-terminal-configuration)
6. [Voice Setup](#6-voice-setup)
7. [Foldable Screen Considerations](#7-foldable-screen-considerations)
8. [Tailscale Remote Access](#8-tailscale-remote-access)
9. [Troubleshooting](#9-troubleshooting)
10. [Tips & Tricks](#10-tips--tricks)

---

## 1. Overview

The Samsung Z Flip6 is an excellent companion device for Hermes Relay due to its:
- **Compact form factor** — fits in pocket, always with you
- **Flex mode** — split-screen when partially folded
- **Cover screen** — quick interactions without unfolding
- **Powerful hardware** — Snapdragon 8 Gen 3, 8GB RAM

This guide covers the complete setup of Hermes Relay on the Z Flip6, including terminal access, voice interaction, and foldable-specific optimizations.

---

## 2. Prerequisites

### On Your PC (Windows 11 + WSL2)

- Hermes Agent installed and running
- Hermes Relay plugin installed
- Gateway running and accessible
- Tailscale installed (for remote access)

### On Your Z Flip6

- Android 14 (One UI 6.1) or later
- Google Play Store access
- Stable Wi-Fi connection (or Tailscale for remote)
- Bluetooth (for optional accessories)

---

## 3. Hermes Relay Installation

### Step 1: Install from Play Store

1. Open **Google Play Store** on your Z Flip6
2. Search for **"Hermes Relay"**
3. Tap **Install**
4. Wait for download to complete

### Step 2: Initial Setup

1. Open **Hermes Relay**
2. Grant permissions:
   - **Microphone** (for voice)
   - **Notifications** (for alerts)
   - **Storage** (for file access)
3. Sign in with your Hermes account (or create one)

### Step 3: Configure Connection

1. Go to **Settings → Connection**
2. Set connection mode:
   - **Local Network** (same Wi-Fi as PC)
   - **Tailscale** (remote access)
3. Enter your PC's IP address or Tailscale IP

---

## 4. Pairing with PC

### Step 1: Generate Pairing Code on PC

```bash
# In WSL2 terminal
hermes relay pair

# Output example:
# ┌─────────────────────────────────────┐
# │  Hermes Relay Pairing Code          │
# │                                     │
# │  Code: 847291                       │
# │  Expires: 5 minutes                 │
# │                                     │
# │  Enter this code in Relay app       │
# └─────────────────────────────────────┘
```

### Step 2: Enter Code in Relay App

1. Open **Hermes Relay** on Z Flip6
2. Tap **"Pair New Device"**
3. Enter the 6-digit code: `847291`
4. Tap **"Connect"**

### Step 3: Verify Connection

```
# On PC:
hermes relay status

# Should show:
# ┌─────────────────────────────────────┐
# │  Hermes Relay Status                │
# │                                     │
# │  Status: Connected                  │
# │  Device: Samsung SM-F741B           │
# │  IP: 192.168.1.42                   │
# │  Latency: 12ms                      │
# │  Terminal: Active                   │
# │  Voice: Active                      │
# └─────────────────────────────────────┘
```

---

## 5. Terminal Configuration

### 5.1 Basic Terminal Setup

In Hermes Relay app:

1. Go to **Settings → Terminal**
2. Configure:
   - **Font Size:** 13 (readable on inner display)
   - **Font Family:** Monospace (default)
   - **Color Scheme:** Dracula (AMOLED-friendly)
   - **Cursor Style:** Block
   - **Scrollback:** 10000 lines

### 5.2 Keyboard Setup

For best terminal experience:

1. Install **Hacker's Keyboard** from Play Store
2. In Relay settings → Terminal → Keyboard:
   - Select **Hacker's Keyboard**
   - Enable **Ctrl/Alt/Esc keys**
   - Enable **Arrow keys**
   - Enable **Tab completion**

### 5.3 Terminal Shortcuts

| Gesture | Action |
|---------|--------|
| Swipe left | Previous session |
| Swipe right | Next session |
| Pinch zoom | Adjust font size |
| Long press | Context menu |
| Double tap | Select word |

### 5.4 Using Terminal in Flex Mode

When Z Flip6 is partially folded (Flex mode):
- **Top half:** Terminal output
- **Bottom half:** Keyboard
- This provides a laptop-like experience

---

## 6. Voice Setup

### 6.1 Push-to-Talk Configuration

1. Go to **Settings → Voice**
2. Set **Input Mode:** Push-to-Talk
3. Configure PTT button:
   - **Cover screen:** Volume button (hold)
   - **Inner screen:** On-screen button (hold)
   - **Bluetooth:** Headset button

### 6.2 STT (Speech-to-Text) Settings

```yaml
# In Relay app → Voice → STT
provider: groq          # Groq Whisper (fast, accurate)
model: whisper-large-v3-turbo
language: en
auto_detect: true
```

### 6.3 TTS (Text-to-Speech) Settings

```yaml
# In Relay app → Voice → TTS
provider: openai
model: gpt-4o-mini-tts
voice: alloy
speed: 1.0
auto_play: true
```

### 6.4 Voice Commands

| Command | Action |
|---------|--------|
| "Hey Hermes" | Wake word (if enabled) |
| Hold PTT + speak | Send voice message |
| "Stop" | Cancel current response |
| "Clear" | Clear terminal |
| "New session" | Start new chat |

---

## 7. Foldable Screen Considerations

### 7.1 Inner Display (Unfolded)

- **Resolution:** 2640 x 1080 (22:9 aspect ratio)
- **Best for:** Full terminal, chat, code editing
- **Font size:** 12-14pt recommended
- **Layout:** Standard landscape or portrait

### 7.2 Cover Display (Folded)

- **Resolution:** 720 x 720 (square, on some models) or small cover screen
- **Best for:** Quick voice, notifications, status
- **Limited interaction:** Voice-only recommended
- **Quick actions:** Tap to expand to inner display

### 7.3 Flex Mode (Partially Folded)

- **Angle range:** 75-115 degrees
- **Best for:** Terminal with split view
- **Top half:** Output/preview
- **Bottom half:** Input/keyboard
- **Stable at any angle** — use as mini laptop

### 7.4 App Continuity

When folding/unfolding:
- Hermes Relay **auto-adjusts** layout
- Terminal session **persists** across fold states
- Voice **continues** working on cover screen
- Keyboard **switches** to cover screen keyboard

### 7.5 Samsung-Specific Settings

1. Go to **Settings → Display → App continuity**
2. Enable **"Continue apps on cover screen"**
3. For Hermes Relay:
   - Enable **"Show on cover screen"**
   - Set **Cover screen layout:** Compact
4. Go to **Settings → Battery → Battery optimization**
5. Find **Hermes Relay** → Set to **"Not optimized"**

---

## 8. Tailscale Remote Access

### 8.1 Install Tailscale on Z Flip6

1. Open **Google Play Store**
2. Search for **"Tailscale"**
3. Install and open
4. Sign in with your Tailscale account

### 8.2 Install Tailscale on PC (WSL2)

```bash
# In WSL2
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Get Tailscale IP
tailscale ip -4
# Example: 100.x.y.z
```

### 8.3 Configure Relay for Tailscale

1. In Relay app → Settings → Connection
2. Set **Mode:** Tailscale
3. Enter your PC's Tailscale IP
4. Port: **8000** (default Hermes gateway port)
5. Tap **"Connect"**

### 8.4 Verify Remote Connection

```bash
# On PC, check Tailscale status
tailscale status

# Should show your Z Flip6 as a connected node
```

---

## 9. Troubleshooting

### 9.1 Connection Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Connection refused" | Gateway not running | `hermes gateway start` |
| "Connection timeout" | Wrong IP/port | Verify IP in Relay settings |
| "Pairing expired" | Code expired | Generate new code with `hermes relay pair` |
| "Device not found" | Different network | Use Tailscale or same Wi-Fi |
| Frequent disconnects | Battery optimization | Disable battery optimization for Relay |

### 9.2 Terminal Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Garbled text | Wrong encoding | Set UTF-8 in terminal settings |
| Keyboard missing keys | Default keyboard | Install Hacker's Keyboard |
| Slow rendering | Too many scrollback lines | Reduce scrollback to 5000 |
| Screen too small | Font too large | Reduce font size to 11 |

### 9.3 Voice Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| No audio input | Mic permission denied | Grant mic permission in app settings |
| Poor STT accuracy | Background noise | Use headset, enable noise suppression |
| TTS not playing | Audio focus lost | Check notification settings |
| PTT not working | Button mapping wrong | Reconfigure PTT in voice settings |

### 9.4 Foldable-Specific Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| App crashes on fold | Memory pressure | Close other apps, reduce terminal scrollback |
| Layout broken on cover screen | App not optimized | Enable "Show on cover screen" |
| Keyboard covers input | Flex mode angle | Adjust angle or use Bluetooth keyboard |
| App killed in background | Samsung battery optimization | Disable optimization for Relay |

### 9.5 Samsung Battery Optimization

Samsung aggressively kills background apps. To prevent this:

1. **Settings → Apps → Hermes Relay → Battery**
   - Set to **"Unrestricted"**
2. **Settings → Battery → Background usage limits**
   - Add Hermes Relay to **"Never sleeping apps"**
3. **Settings → Device Care → Battery → App power management**
   - Disable **"Put unused apps to sleep"** for Relay
4. **Settings → Developer options → Background process limit**
   - Set to **"Standard limit"** or higher

---

## 10. Tips & Tricks

### 10.1 Quick Actions

- **Double-tap cover screen** → Open Relay in compact mode
- **Swipe down on cover screen** → Quick voice input
- **Long-press Relay icon** → Quick actions menu

### 10.2 Bluetooth Accessories

Recommended accessories for Z Flip6 + Hermes Relay:
- **Bluetooth keyboard** (for extended terminal use)
- **Bluetooth earbud** (for voice interaction)
- **S Pen** (for precise terminal selection)

### 10.3 Automation

Use **Samsung Bixby Routines** or **Tasker** to:
- Auto-start Relay when connected to home Wi-Fi
- Auto-connect to Hermes when opening Relay
- Adjust screen timeout during Relay sessions

### 10.4 Cover Screen Widgets

Add Hermes Relay widget to cover screen:
1. Long-press cover screen
2. Tap **"Widgets"**
3. Add **Hermes Relay** widget
4. Shows connection status and quick voice button

### 10.5 Multi-Device Workflow

```
Z Flip6 (Relay) ──→ Hermes Gateway ──→ PC (WSL2)
       │                    │
       ├── Voice input      ├── Ollama (local)
       ├── Terminal         ├── OpenRouter (cloud)
       └── Quick chat       └── Composio (APIs)
```

---

*End of Z Flip6 Setup Guide*
