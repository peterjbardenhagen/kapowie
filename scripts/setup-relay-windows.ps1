#Requires -Version 7.0
<#
.SYNOPSIS
    Hermes Relay Setup Script for Windows 11
    
.DESCRIPTION
    Configures Hermes Relay for Android devices including:
    - Relay plugin installation
    - Android pairing
    - Tailscale VPN for remote access
    - Terminal configuration
    - Voice setup
    - Samsung Z Flip6 specific settings
    
.PARAMETER DeviceType
    Device type: 'android' or 'flip6'
    
.PARAMETER Tailscale
    Enable Tailscale for remote access
    
.PARAMETER VoiceOnly
    Configure voice-only mode (no terminal)
    
.EXAMPLE
    .\setup-relay-windows.ps1 -DeviceType flip6 -Tailscale
#>

param(
    [ValidateSet('android', 'flip6', 'generic')]
    [string]$DeviceType = 'android',
    
    [switch]$Tailscale,
    [switch]$VoiceOnly,
    [switch]$SkipPairing
)

$ErrorActionPreference = 'Stop'

# ============================================================
# CONFIGURATION
# ============================================================
$Script:Config = @{
    WslDistro      = 'Ubuntu-22.04'
    RelayPlugin    = 'hermes-relay'
    GatewayPort    = 8000
    TailscalePort  = 8000
}

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

function Write-Header {
    param([string]$Title)
    Write-Host "`n$('=' * 60)" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "$('=' * 60)`n" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Message)
    Write-Host "  [+] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [!] $Message" -ForegroundColor Yellow
}

function Test-Command {
    param([string]$Command)
    return [bool](Get-Command -Name $Command -ErrorAction SilentlyContinue)
}

# ============================================================
# RELAY PLUGIN INSTALLATION
# ============================================================

function Install-RelayPlugin {
    Write-Header "Installing Hermes Relay Plugin"
    
    # Check if already installed
    $pluginCheck = wsl -d $Script:Config.WslDistro -e bash -c "hermes plugins list 2>/dev/null | grep -i relay" 2>&1
    
    if ($pluginCheck -match 'relay') {
        Write-Step "Relay plugin already installed"
        return
    }
    
    Write-Step "Installing hermes-relay plugin..."
    wsl -d $Script:Config.WslDistro -e bash -c "hermes plugins install hermes-relay"
    
    Write-Step "Enabling relay plugin..."
    wsl -d $Script:Config.WslDistro -e bash -c "hermes plugins enable hermes-relay"
    
    Write-Step "Relay plugin installed and enabled"
}

# ============================================================
# GATEWAY CONFIGURATION
# ============================================================

function Set-RelayGateway {
    Write-Header "Configuring Gateway for Relay"
    
    $gatewayScript = @'
#!/bin/bash
set -e

echo "Configuring gateway for Relay..."

# Ensure gateway is running
hermes gateway restart

# Wait for gateway to be ready
sleep 3

# Check gateway status
hermes gateway status

echo "Gateway configured for Relay"
'@
    
    $gatewayScript | wsl -d $Script:Config.WslDistro -e bash -s
    Write-Step "Gateway configured for Relay"
}

# ============================================================
# ANDROID PAIRING
# ============================================================

function Start-AndroidPairing {
    if ($SkipPairing) {
        Write-Step "Skipping pairing"
        return
    }
    
    Write-Header "Pairing Android Device"
    
    Write-Host @"
  
  Android Pairing Instructions:
  ==============================
  
  1. Install "Hermes Relay" from Google Play Store
  
  2. Open the app on your Android device
  
  3. Grant permissions:
     - Microphone (for voice)
     - Notifications (for alerts)
     - Storage (for file access)
  
  4. The app will generate a pairing code below.
     Enter it in the Relay app on your phone.
  
"@
    
    # Generate pairing code
    Write-Step "Generating pairing code..."
    $pairResult = wsl -d $Script:Config.WslDistro -e bash -c "hermes relay pair" 2>&1
    
    Write-Host "`n  $pairResult" -ForegroundColor Yellow
    
    Write-Host @"
  
  5. Enter the code in your Relay app
  
  6. Wait for "Connected" status
  
"@
    
    # Wait for pairing
    Start-Sleep -Seconds 10
    
    # Check status
    $status = wsl -d $Script:Config.WslDistro -e bash -c "hermes relay status" 2>&1
    Write-Host "  $status" -ForegroundColor Green
}

# ============================================================
# TERMINAL CONFIGURATION
# ============================================================

function Set-RelayTerminal {
    if ($VoiceOnly) {
        Write-Step "Voice-only mode: skipping terminal config"
        return
    }
    
    Write-Header "Configuring Terminal for Relay"
    
    $terminalScript = @'
#!/bin/bash
set -e

echo "Configuring terminal for Relay..."

# Ensure terminal backend is local
mkdir -p ~/.hermes

# Create terminal config
cat > ~/.hermes/terminal-config.json << 'EOF'
{
  "font_size": 13,
  "font_family": "monospace",
  "color_scheme": "dracula",
  "cursor_style": "block",
  "scrollback_lines": 10000,
  "encoding": "utf-8",
  "word_wrap": true,
  "bell": "none"
}
EOF

echo "Terminal configured for Relay"
'@
    
    $terminalScript | wsl -d $Script:Config.WslDistro -e bash -s
    Write-Step "Terminal configured for Relay"
    
    Write-Host @"
  
  Terminal Settings:
  - Font: Monospace, 13pt
  - Theme: Dracula (AMOLED-friendly)
  - Scrollback: 10,000 lines
  - Encoding: UTF-8
  
  For Samsung Z Flip6:
  - Use Hacker's Keyboard for Ctrl/Alt/Esc keys
  - Flex mode: top half = output, bottom half = keyboard
  - Cover screen: voice-only recommended
  
"@
}

# ============================================================
# VOICE CONFIGURATION
# ============================================================

function Set-RelayVoice {
    Write-Header "Configuring Voice for Relay"
    
    $voiceScript = @'
#!/bin/bash
set -e

echo "Configuring voice for Relay..."

# Create voice config
mkdir -p ~/.hermes

cat > ~/.hermes/voice-config.json << 'EOF'
{
  "input_mode": "push_to_talk",
  "ptt_button": "volume_down",
  "stt_provider": "groq",
  "stt_model": "whisper-large-v3-turbo",
  "tts_provider": "openai",
  "tts_model": "gpt-4o-mini-tts",
  "tts_voice": "alloy",
  "auto_play": true,
  "silence_threshold": 200,
  "silence_duration": 3,
  "max_recording_seconds": 120
}
EOF

echo "Voice configured for Relay"
'@
    
    $voiceScript | wsl -d $Script:Config.WslDistro -e bash -s
    Write-Step "Voice configured for Relay"
    
    Write-Host @"
  
  Voice Settings:
  - Input: Push-to-Talk (hold Volume Down)
  - STT: Groq Whisper Large v3 Turbo
  - TTS: OpenAI GPT-4o-mini (Alloy voice)
  - Max recording: 120 seconds
  
  For Samsung Z Flip6:
  - Cover screen: Volume button = PTT
  - Inner screen: On-screen PTT button
  - Bluetooth: Headset button = PTT
  
"@
}

# ============================================================
# TAILSCALE SETUP
# ============================================================

function Set-RelayTailscale {
    if (-not $Tailscale) {
        Write-Step "Skipping Tailscale (use -Tailscale to enable)"
        return
    }
    
    Write-Header "Setting Up Tailscale for Remote Relay"
    
    # Install Tailscale on Windows
    if (-not (Test-Command 'tailscale')) {
        Write-Step "Installing Tailscale..."
        winget install Tailscale.Tailscale
    }
    
    # Start Tailscale
    Write-Step "Starting Tailscale..."
    tailscale up 2>&1 | Out-Null
    
    # Get Tailscale IP
    $tsIP = tailscale ip -4 2>$null
    Write-Step "Tailscale IP: $tsIP"
    
    # Install Tailscale in WSL2
    $tailscaleWsl = @'
#!/bin/bash
set -e

echo "Installing Tailscale in WSL2..."

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start Tailscale
sudo tailscale up

# Get IP
TAILSCALE_IP=$(tailscale ip -4)
echo "WSL2 Tailscale IP: $TAILSCALE_IP"
'@
    
    $tailscaleWsl | wsl -d $Script:Config.WslDistro -e bash -s
    
    Write-Step "Tailscale configured for remote Relay access"
    
    Write-Host @"
  
  Remote Access:
  - Use Tailscale IP in Relay app settings
  - Port: $($Script:Config.TailscalePort)
  - Connection: ws://<tailscale-ip>:$($Script:Config.TailscalePort)
  
"@
}

# ============================================================
# SAMSUNG Z FLIP6 SPECIFIC
# ============================================================

function Set-Flip6Config {
    if ($DeviceType -ne 'flip6') {
        return
    }
    
    Write-Header "Samsung Z Flip6 Specific Configuration"
    
    Write-Host @"
  
  Samsung Z Flip6 Setup:
  ======================
  
  1. INSTALL HERMES RELAY
     - Open Google Play Store
     - Search "Hermes Relay"
     - Install and open
  
  2. GRANT PERMISSIONS
     - Microphone: Allow
     - Notifications: Allow
     - Storage: Allow
     - Battery: Set to "Unrestricted"
  
  3. DISABLE BATTERY OPTIMIZATION (CRITICAL!)
     Settings → Apps → Hermes Relay → Battery → Unrestricted
     Settings → Battery → Background usage limits → Never sleeping apps → Add Relay
     Settings → Device Care → Battery → App power management → Disable for Relay
  
  4. CONFIGURE FLEX MODE
     - Settings → Display → App continuity → Enable
     - Hermes Relay → Show on cover screen → Enable
  
  5. INSTALL HACKER'S KEYBOARD
     - Search "Hacker's Keyboard" in Play Store
     - Install
     - In Relay settings → Terminal → Keyboard → Select Hacker's Keyboard
  
  6. SET UP PTT (Push-to-Talk)
     - Relay app → Settings → Voice
     - Input Mode: Push-to-Talk
     - PTT Button: Volume Down (hold)
  
  7. ADD COVER SCREEN WIDGET
     - Long-press cover screen
     - Tap Widgets
     - Add Hermes Relay widget
  
  TIPS:
  - Flex mode (half-folded): Top = terminal, Bottom = keyboard
  - Cover screen: Quick voice input
  - Unfolded: Full terminal experience
  - Use Bluetooth keyboard for extended sessions
  
"@
    
    # Create Flip6-specific config
    $flip6Script = @'
#!/bin/bash
set -e

echo "Creating Z Flip6 specific configuration..."

mkdir -p ~/.hermes/relay

cat > ~/.hermes/relay/flip6-config.json << 'EOF'
{
  "device": "samsung_z_flip6",
  "model": "SM-F741B",
  "display": {
    "inner_width": 2640,
    "inner_height": 1080,
    "cover_width": 720,
    "cover_height": 720,
    "flex_mode": true
  },
  "terminal": {
    "font_size": 13,
    "font_family": "monospace",
    "color_scheme": "dracula",
    "scrollback_lines": 10000,
    "word_wrap": true
  },
  "voice": {
    "input_mode": "push_to_talk",
    "ptt_button": "volume_down",
    "auto_play": true,
    "silence_threshold": 200
  },
  "battery": {
    "optimization_disabled": true,
    "background_unrestricted": true
  }
}
EOF

echo "Z Flip6 configuration created"
'@
    
    $flip6Script | wsl -d $Script:Config.WslDistro -e bash -s
    Write-Step "Z Flip6 configuration created"
}

# ============================================================
# RELAY TOOLS ENABLING
# ============================================================

function Enable-RelayTools {
    Write-Header "Enabling Relay Tools"
    
    $toolsScript = @'
#!/bin/bash
set -e

echo "Enabling Relay tools..."

# Enable relay-specific toolsets
mkdir -p ~/.hermes

# Create relay tools config
cat > ~/.hermes/relay/tools-config.json << 'EOF'
{
  "enabled_tools": [
    "terminal",
    "voice",
    "file_access",
    "notifications",
    "camera",
    "location",
    "clipboard"
  ],
  "terminal": {
    "enabled": true,
    "shell": "/bin/bash",
    "max_sessions": 5,
    "timeout": 300
  },
  "voice": {
    "enabled": true,
    "stt": true,
    "tts": true,
    "push_to_talk": true
  },
  "file_access": {
    "enabled": true,
    "allowed_paths": ["/home", "/tmp", "/mnt"],
    "max_file_size_mb": 50
  },
  "notifications": {
    "enabled": true,
    "priority": "normal"
  }
}
EOF

echo "Relay tools enabled"
'@
    
    $toolsScript | wsl -d $Script:Config.WslDistro -e bash -s
    Write-Step "Relay tools enabled"
}

# ============================================================
# PAIRING CODE GENERATION
# ============================================================

function New-PairingCode {
    Write-Header "Generating Pairing Code"
    
    $code = wsl -d $Script:Config.WslDistro -e bash -c "hermes relay pair" 2>&1
    
    Write-Host "`n  $code" -ForegroundColor Yellow
    
    Write-Host @"
  
  Enter this code in your Hermes Relay app:
  1. Open Relay on your phone
  2. Tap "Pair New Device"
  3. Enter the code above
  4. Tap "Connect"
  
"@
}

# ============================================================
# VERIFICATION
# ============================================================

function Test-RelaySetup {
    Write-Header "Verifying Relay Setup"
    
    # Check plugin
    $plugin = wsl -d $Script:Config.WslDistro -e bash -c "hermes plugins list 2>/dev/null | grep -i relay" 2>&1
    if ($plugin -match 'relay') {
        Write-Step "Relay plugin: Installed"
    } else {
        Write-Warn "Relay plugin: Not found"
    }
    
    # Check gateway
    $gw = wsl -d $Script:Config.WslDistro -e bash -c "hermes gateway status" 2>&1
    if ($gw -match 'running|active') {
        Write-Step "Gateway: Running"
    } else {
        Write-Warn "Gateway: Not running (start with: hermes gateway start)"
    }
    
    # Check relay status
    $relay = wsl -d $Script:Config.WslDistro -e bash -c "hermes relay status" 2>&1
    Write-Step "Relay status: $relay"
    
    # Check Tailscale
    if ($Tailscale) {
        $ts = tailscale status 2>&1
        if ($ts -match 'Linux') {
            Write-Step "Tailscale: Connected"
        } else {
            Write-Warn "Tailscale: Not connected"
        }
    }
}

# ============================================================
# MAIN EXECUTION
# ============================================================

function Main {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║   Hermes Relay — Windows 11 Setup Script     ║" -ForegroundColor Cyan
    Write-Host "  ║   Device: $($DeviceType.PadRight(33))║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        Install-RelayPlugin
        Set-RelayGateway
        Set-RelayTerminal
        Set-RelayVoice
        Set-RelayTailscale
        Set-Flip6Config
        Enable-RelayTools
        Start-AndroidPairing
        New-PairingCode
        Test-RelaySetup
        
        # Summary
        Write-Header "Relay Setup Complete!"
        
        Write-Host @"
  
  Next Steps:
  ===========
  
  1. Open Hermes Relay on your Android device
  
  2. Enter the pairing code shown above
  
  3. For terminal: Tap "Terminal" in Relay app
  
  4. For voice: Hold Volume Down and speak
  
  5. For remote access (Tailscale):
     - Use Tailscale IP in Relay settings
     - Port: $($Script:Config.TailscalePort)
  
  Troubleshooting:
  - Connection refused: Run 'hermes gateway start'
  - Pairing expired: Run 'hermes relay pair' again
  - Voice not working: Check mic permissions
  - Terminal garbled: Set UTF-8 encoding in settings
  
"@
        
    } catch {
        Write-Host "  [X] Setup failed: $_" -ForegroundColor Red
    }
}

# Run
Main
