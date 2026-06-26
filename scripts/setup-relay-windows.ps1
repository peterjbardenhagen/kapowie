# setup-relay-windows.ps1
# Hermes Relay setup + Android pairing for Samsung Z Flip6
# Run as Administrator in PowerShell 7+

param(
    [switch]$SkipPair,
    [switch]$RegenerateCode
)

$ErrorActionPreference = "Stop"

function Write-Step { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-OK { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }

# ─── Check Relay Status ───────────────────────────────────────────────────────
Write-Step "Checking Hermes Relay"

$relayHealth = curl -sk https://localhost:8767/health 2>$null
if ($relayHealth -match "ok") {
    Write-OK "Relay is running at https://localhost:8767"
} else {
    Write-Warn "Relay not running. Starting..."
    
    $venvPath = "$env:USERPROFILE\hermes\hermes-agent\venv"
    if (Test-Path "$venvPath\Scripts\activate") {
        & "$venvPath\Scripts\activate"
        Start-Process -FilePath "python" -ArgumentList "-m","plugin.relay","--","--no-ssl" -NoNewWindow -Wait
        Write-OK "Relay started"
    } else {
        Write-Error "Hermes venv not found. Run setup-hermes-windows.ps1 first."
        exit 1
    }
}

# ─── Check Gateway Status ─────────────────────────────────────────────────────
Write-Step "Checking Hermes Gateway"

$gwStatus = hermes gateway status 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-OK "Gateway is running"
} else {
    Write-Warn "Gateway not running. Starting Hermes..."
    hermes gateway start
    Write-OK "Gateway started"
}

# ─── Check Tailscale ──────────────────────────────────────────────────────────
Write-Step "Checking Tailscale"

$tailscale = Get-Command tailscale -ErrorAction SilentlyContinue
if ($tailscale) {
    $tsStatus = tailscale status 2>&1
    Write-OK "Tailscale is running"
    
    $tsIP = tailscale ip 4 2>$null
    if ($tsIP) {
        Write-OK "Tailscale IP: $tsIP"
    } else {
        Write-Warn "No Tailscale IP assigned. Check Tailscale connection."
    }
} else {
    Write-Warn "Tailscale not installed. Install from https://tailscale.com/download"
}

# ─── Pairing Code ─────────────────────────────────────────────────────────────
if (-not $SkipPair) {
    Write-Step "Android Pairing Code"
    
    $existingCode = curl -sk -X POST https://localhost:8767/pairing/check 2>$null
    
    if ($RegenerateCode -or -not ($existingCode -match "ok")) {
        $code = Read-Host "  Enter new 6-char pairing code (e.g. KAPOW2)"
        $code = $code.ToUpper()
        
        if ($code -ne "^[A-Z0-9]{6}$") {
            Write-Error "Invalid code format. Must be 6 alphanumeric characters."
            exit 1
        }
        
        $body = @{code=$code; ttl="30d"; grants=@{chat=0; bridge=168}} | ConvertTo-Json
        $result = curl -sk -X POST https://localhost:8767/pairing/register `
            -H "Content-Type: application/json" `
            -Body $body
        
        if ($result -match "ok") {
            Write-OK "Pairing code registered: $code"
        } else {
            Write-Error "Failed to register code: $result"
        }
    } else {
        Write-OK "Existing pairing code active"
    }
    
    Write-Host @"

  ANDROID PAIRING INSTRUCTIONS:
  ==============================
  1. Open Hermes-Relay app on Flip6
  2. Settings → Connection
  3. Tap "Manual pairing code (fallback)"
  4. Enter code: $code
  5. Grant permissions:
     - [ ] Camera
     - [ ] Screen Capture
     - [ ] Accessibility (Hermes-Relay)
     - [ ] Microphone
     - [ ] Notifications
  6. Flip "Allow Agent Control" ON
  7. Tap Connect

"@ -ForegroundColor Yellow
}

# ─── Check Relay Connection ───────────────────────────────────────────────────
Write-Step "Checking phone connection"

$bridgeStatus = curl -sk https://localhost:8767/bridge/status 2>$null
if ($bridgeStatus -match '"phone_connected": true') {
    Write-OK "Phone connected!"
    
    # Parse device info
    $deviceName = ($bridgeStatus | Select-String '"device_name": "([^"]*)"').Matches.Groups[1].Value
    $battery = ($bridgeStatus | Select-String '"battery_level": ([0-9]+)').Matches.Groups[1].Value
    
    if ($deviceName) { Write-OK "Device: $deviceName" }
    if ($battery) { Write-OK "Battery: $battery%" }
} else {
    Write-Warn "Phone not connected. Complete pairing steps above."
}

# ─── Enable Features ─────────────────────────────────────────────────────────
Write-Step "Enabling Relay features"

# Check available tools
$tools = hermes tools 2>&1
$featureChecks = @{
    "Terminal" = "terminal"
    "Voice" = "voice"
    "Desktop" = "desktop"
    "Relay" = "relay"
}

foreach ($feature in $featureChecks.GetEnumerator()) {
    if ($tools -match $feature.Value) {
        Write-OK "$($feature.Key): Enabled"
    } else {
        Write-Warn "$($feature.Key): Disabled — check configuration"
    }
}

Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║  RELAY SETUP COMPLETE                                        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Server URL: https://pb-legion-1.tail587e7c.ts.net:8767     ║
║  Dashboard:  http://localhost:8642                           ║
║  Health:     https://localhost:8767/health                   ║
║                                                              ║
║  To re-pair phone:                                           ║
║  - Generate new code: hermes-pair --register-code XXXXXX     ║
║  - Or: ./scripts/setup-relay-windows.ps1 -RegenerateCode     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green
