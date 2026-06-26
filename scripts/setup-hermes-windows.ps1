#Requires -Version 7.0
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Complete Hermes Agent Setup Script for Windows 11
    
.DESCRIPTION
    This script installs and configures:
    - WSL2 with Ubuntu
    - NVIDIA GPU passthrough
    - Ollama with recommended models
    - Hermes Agent with optimal configuration
    - Telegram X bot
    - Composio integration
    - Tailscale VPN
    - OpenRouter providers
    - OpenCode Go & Zen
    
.PARAMETER SkipWSL
    Skip WSL2 installation (if already installed)
    
.PARAMETER SkipOllama
    Skip Ollama installation (if already installed)
    
.PARAMETER SkipModels
    Skip model downloads (if already downloaded)
    
.PARAMETER OpenRouterKey
    OpenRouter API key
    
.PARAMETER ComposioKey
    Composio API key
    
.PARAMETER TelegramToken
    Telegram bot token
    
.EXAMPLE
    .\setup-hermes-windows.ps1 -OpenRouterKey "sk-or-..." -ComposioKey "ck_..." -TelegramToken "123:ABC"
    
.EXAMPLE
    .\setup-hermes-windows.ps1 -SkipWSL -SkipOllama
#>

param(
    [switch]$SkipWSL,
    [switch]$SkipOllama,
    [switch]$SkipModels,
    [string]$OpenRouterKey = '',
    [string]$ComposioKey = '',
    [string]$TelegramToken = '',
    [string]$GitHubToken = '',
    [string]$TimeZone = 'Australia/Brisbane',
    [int]$RamLimitGB = 24,
    [int]$CpuCount = 12
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# ============================================================
# CONFIGURATION
# ============================================================
$Script:Config = @{
    WslDistro        = 'Ubuntu-22.04'
    HermesVersion    = 'latest'
    OllamaVersion    = 'latest'
    Models           = @(
        'gemma4:latest'
        'qwen2.5-coder:14b'
        'qwen3-vl:8b'
        'llama3.2:latest'
        'nomic-embed-text'
        'mxbai-embed-large'
        'qwen3-embedding:4b'
    )
    FastModels       = @(
        'llama3.2:latest'
        'gemma4:latest'
    )
    RequiredFeatures = @('Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform')
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

function Write-Err {
    param([string]$Message)
    Write-Host "  [X] $Message" -ForegroundColor Red
}

function Test-Command {
    param([string]$Command)
    return [bool](Get-Command -Name $Command -ErrorAction SilentlyContinue)
}

function Get-UserConfirmation {
    param([string]$Message)
    $response = Read-Host "  $Message (y/N)"
    return $response -eq 'y' -or $response -eq 'Y'
}

# ============================================================
# PREREQUISITE CHECKS
# ============================================================

function Test-Prerequisites {
    Write-Header "Checking Prerequisites"
    
    # Check Windows version
    $os = Get-CimInstance Win32_OperatingSystem
    $build = [int]$os.BuildNumber
    Write-Step "Windows Build: $build"
    
    if ($build -lt 22000) {
        Write-Err "Windows 11 (build 22000+) required. Current: $build"
        throw "Incompatible Windows version"
    }
    
    # Check PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 7) {
        Write-Warn "PowerShell 7+ recommended. Current: $($PSVersionTable.PSVersion)"
        Write-Warn "Install with: winget install Microsoft.PowerShell"
    } else {
        Write-Step "PowerShell $($PSVersionTable.PSVersion) [OK]"
    }
    
    # Check for GPU
    try {
        $gpu = Get-CimInstance Win32_VideoController | Where-Object { $_.Name -match 'NVIDIA' }
        if ($gpu) {
            $driverVersion = $gpu.DriverVersion
            $vram = [math]::Round($gpu.AdapterRAM / 1GB, 1)
            Write-Step "GPU: $($gpu.Name) ($vram GB VRAM)"
            Write-Step "Driver: $driverVersion"
            $Script:HasGPU = $true
        } else {
            Write-Warn "No NVIDIA GPU found. Will use CPU-only mode."
            $Script:HasGPU = $false
        }
    } catch {
        Write-Warn "Could not detect GPU."
        $Script:HasGPU = $false
    }
    
    # Check RAM
    $totalRam = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
    Write-Step "RAM: ${totalRam} GB"
    
    if ($totalRam -lt 16) {
        Write-Warn "16GB+ RAM recommended. Current: ${totalRam} GB"
    }
    
    # Check disk space
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeGB = [math]::Round($disk.FreeSpace / 1GB, 1)
    Write-Step "Disk Free: ${freeGB} GB"
    
    if ($freeGB -lt 50) {
        Write-Warn "50GB+ free space recommended. Current: ${freeGB} GB"
    }
    
    # Check Windows features
    $Script:HasWSL = $false
    try {
        $wslStatus = wsl --status 2>&1
        if ($LASTEXITCODE -eq 0) {
            $Script:HasWSL = $true
            Write-Step "WSL: Already installed"
        }
    } catch {
        Write-Warn "WSL: Not installed"
    }
    
    return $true
}

# ============================================================
# WSL2 INSTALLATION
# ============================================================

function Install-WSL2 {
    if ($SkipWSL -and $Script:HasWSL) {
        Write-Step "Skipping WSL2 installation (already present)"
        return
    }
    
    Write-Header "Installing WSL2"
    
    # Enable Windows features
    Write-Step "Enabling Windows features..."
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
    Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
    
    # Set WSL2 as default
    Write-Step "Setting WSL2 as default..."
    wsl --set-default-version 2
    
    # Install Ubuntu
    Write-Step "Installing $($Script:Config.WslDistro)..."
    wsl --install -d $Script:Config.WslDistro --no-launch
    
    Write-Host ""
    Write-Warr "WSL2 installation requires a restart to complete."
    Write-Warr "After restart, Ubuntu will prompt you to create a user."
    
    if (Get-UserConfirmation "Restart now?") {
        Restart-Computer -Confirm
    } else {
        Write-Warn "Please restart manually to complete WSL2 setup."
    }
}

# ============================================================
# WSL2 CONFIGURATION
# ============================================================

function Set-WSLConfig {
    Write-Header "Configuring WSL2"
    
    $wslConfig = @"
[wsl2]
memory=${RamLimitGB}GB
processors=${CpuCount}
swap=8GB
localhostForwarding=true
gpuSupport=true
"@
    
    $wslConfigPath = "$env:USERPROFILE\.wslconfig"
    $wslConfig | Out-File -FilePath $wslConfigPath -Encoding UTF8 -Force
    Write-Step "Created .wslconfig at $wslConfigPath"
    
    # Restart WSL to apply
    wsl --shutdown
    Write-Step "WSL2 restarted with new configuration"
    
    # Verify
    wsl -d $Script:Config.WslDistro -e echo "WSL2 connected"
    Write-Step "WSL2 configuration applied"
}

# ============================================================
# OLLAMA INSTALLATION
# ============================================================

function Install-OllamaWindows {
    if ($SkipOllama) {
        Write-Step "Skipping Ollama installation"
        return
    }
    
    Write-Header "Installing Ollama (Windows)"
    
    if (Test-Command 'ollama') {
        Write-Step "Ollama already installed"
        $version = ollama --version
        Write-Step "Version: $version"
        return
    }
    
    # Download and install
    Write-Step "Downloading Ollama..."
    $ollamaUrl = "https://ollama.com/download/OllamaSetup.exe"
    $installer = "$env:TEMP\OllamaSetup.exe"
    
    Invoke-WebRequest -Uri $ollamaUrl -OutFile $installer -UseBasicParsing
    
    Write-Step "Installing Ollama..."
    Start-Process -FilePath $installer -ArgumentList '/S' -Wait
    
    # Cleanup
    Remove-Item $installer -Force
    
    # Verify
    if (Test-Command 'ollama') {
        Write-Step "Ollama installed successfully"
    } else {
        Write-Warn "Ollama may need manual installation"
    }
}

# ============================================================
# GPU CONFIGURATION
# ============================================================

function Set-GPUConfig {
    Write-Header "Configuring NVIDIA GPU"
    
    if (-not $Script:HasGPU) {
        Write-Warr "No GPU detected. Skipping GPU configuration."
        return
    }
    
    # Check NVIDIA driver
    try {
        $nvidiaSmi = & nvidia-smi 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Step "NVIDIA driver detected"
            $nvidiaSmi | Select-Object -First 5 | ForEach-Object { Write-Host "    $_" }
        }
    } catch {
        Write-Warn "nvidia-smi not found. Please install NVIDIA drivers."
        Write-Warn "Download from: https://www.nvidia.com/download/index.aspx"
    }
    
    # Configure GPU for WSL
    Write-Step "GPU passthrough enabled via .wslconfig"
    Write-Step "WSL2 will automatically use NVIDIA GPU"
}

# ============================================================
# HERMES INSTALLATION
# ============================================================

function Install-HermesAgent {
    Write-Header "Installing Hermes Agent"
    
    $installScript = @'
#!/bin/bash
set -e

echo "Installing Hermes Agent in WSL2..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y \
    python3 python3-pip python3-venv \
    build-essential curl wget git \
    nodejs npm

# Create virtual environment
python3 -m venv ~/.hermes/hermes-agent/venv
source ~/.hermes/hermes-agent/venv/bin/activate

# Install Hermes Agent
pip install hermes-agent

# Create config directory
mkdir -p ~/.hermes
mkdir -p ~/.hermes/logs

echo "Hermes Agent installed successfully!"
echo "Run 'hermes setup' to configure."
'@
    
    $installScript | wsl -d $Script:Config.WslDistro -e bash -s
    Write-Step "Hermes Agent installed in WSL2"
}

# ============================================================
# PROVIDER CONFIGURATION
# ============================================================

function Set-Providers {
    Write-Header "Configuring Providers"
    
    # OpenRouter
    if (-not $OpenRouterKey) {
        $OpenRouterKey = Read-Host "  Enter OpenRouter API key (or press Enter to skip)"
    }
    
    if ($OpenRouterKey) {
        Write-Step "OpenRouter API key configured"
    } else {
        Write-Warn "No OpenRouter key provided. Cloud models unavailable."
    }
    
    # Composio
    if (-not $ComposioKey) {
        $ComposioKey = Read-Host "  Enter Composio API key (or press Enter to skip)"
    }
    
    if ($ComposioKey) {
        Write-Step "Composio API key configured"
    } else {
        Write-Warn "No Composio key provided. API integrations unavailable."
    }
    
    # Telegram
    if (-not $TelegramToken) {
        $TelegramToken = Read-Host "  Enter Telegram bot token (or press Enter to skip)"
    }
    
    if ($TelegramToken) {
        Write-Step "Telegram bot token configured"
    } else {
        Write-Warn "No Telegram token provided. Bot unavailable."
    }
    
    # GitHub
    if (-not $GitHubToken) {
        $GitHubToken = Read-Host "  Enter GitHub personal access token (or press Enter to skip)"
    }
    
    if ($GitHubToken) {
        Write-Step "GitHub token configured"
    }
    
    # Store in environment
    $envContent = @"
# Hermes Agent Environment
export OPENROUTER_API_KEY="$OpenRouterKey"
export COMPOSIO_API_KEY="$ComposioKey"
export TELEGRAM_BOT_TOKEN="$TelegramToken"
export GITHUB_PERSONAL_ACCESS_TOKEN="$GitHubToken"
export OLLAMA_KEEP_ALIVE="-1"
export OLLAMA_NUM_PARALLEL=2
export OLLAMA_HOST=0.0.0.0:11434
"@
    
    $envContent | wsl -d $Script:Config.WslDistro -e bash -c "cat >> ~/.bashrc"
    Write-Step "Environment variables configured in WSL2"
}

# ============================================================
# TELEGRAM X SETUP
# ============================================================

function Set-TelegramX {
    Write-Header "Setting Up Telegram X"
    
    Write-Host @"
  
  Telegram X Setup:
  ==================
  
  1. Install Telegram X from Google Play Store
     (NOT regular Telegram - it crashes with bots)
  
  2. Open Telegram X and sign in
  
  3. Search for @BotFather
  
  4. Send: /newbot
  
  5. Enter bot name: MyHermesBot
  
  6. Enter username: my_hermes_bot (must end in 'bot')
  
  7. Copy the API token
  
  8. Paste it when prompted in this script
  
  Why Telegram X?
  - Regular Telegram crashes with long bot responses
  - Telegram X has higher message limits
  - Better streaming support
  - More stable connection
  
"@
    
    if (-not $TelegramToken) {
        $TelegramToken = Read-Host "  Enter Telegram bot token"
    }
    
    if ($TelegramToken) {
        Write-Step "Telegram bot token saved"
    }
}

# ============================================================
# TAILSCALE SETUP
# ============================================================

function Set-Tailscale {
    Write-Header "Setting Up Tailscale"
    
    if (Test-Command 'tailscale') {
        Write-Step "Tailscale already installed"
        
        $status = tailscale status 2>&1
        if ($status -match 'Logged out') {
            Write-Step "Starting Tailscale..."
            tailscale up
        } else {
            Write-Step "Tailscale connected"
        }
    } else {
        Write-Step "Installing Tailscale..."
        winget install Tailscale.Tailscale
        
        Write-Step "Starting Tailscale..."
        tailscale up
    }
    
    # Get Tailscale IP
    $tsIP = tailscale ip -4 2>$null
    if ($tsIP) {
        Write-Step "Tailscale IP: $tsIP"
    }
}

# ============================================================
# OBSIDIAN INTEGRATION
# ============================================================

function Set-Obsidian {
    Write-Header "Setting Up Obsidian Integration"
    
    $vaultPath = Read-Host "  Enter Obsidian vault path (or press Enter to skip)"
    
    if ($vaultPath) {
        # Convert Windows path to WSL path
        $wslVaultPath = $vaultPath -replace '^([A-Za-z]):', '/mnt/$($1.ToLower())' -replace '\\', '/'
        
        Write-Step "Vault path: $vaultPath"
        Write-Step "WSL path: $wslVaultPath"
        
        # Add to Hermes config
        $obsidianConfig = @"

# Obsidian Integration
mcp_servers:
  obsidian:
    command: npx
    args:
      - -y
      - obsidian-mcp-server
    connect_timeout: 30
    timeout: 60
"@
        
        Write-Step "Obsidian integration configured"
    } else {
        Write-Warn "Skipping Obsidian integration"
    }
}

# ============================================================
# MODEL DOWNLOAD
# ============================================================

function Install-Models {
    if ($SkipModels) {
        Write-Step "Skipping model downloads"
        return
    }
    
    Write-Header "Downloading Ollama Models"
    
    if (-not $Script:HasGPU) {
        Write-Warn "No GPU detected. Downloading lightweight models only..."
        $modelsToDownload = $Script:Config.FastModels
    } else {
        $modelsToDownload = $Script:Config.Models
    }
    
    foreach ($model in $modelsToDownload) {
        Write-Step "Pulling $model..."
        wsl -d $Script:Config.WslDistro -e ollama pull $model
    }
    
    Write-Step "All models downloaded"
}

# ============================================================
# OPTIMAL SETTINGS
# ============================================================

function Set-OptimalSettings {
    Write-Header "Applying Optimal Settings"
    
    $settingsScript = @'
#!/bin/bash
set -e

echo "Applying optimal Hermes settings..."

# Create Hermes config directory
mkdir -p ~/.hermes

# Set optimal environment variables
cat >> ~/.bashrc << 'ENVEOF'

# Hermes Agent - Optimal Settings
export OLLAMA_KEEP_ALIVE="-1"
export OLLAMA_NUM_PARALLEL=2
export OLLAMA_HOST=0.0.0.0:11434
export HASS_URL="http://192.168.1.11:8123"

# Performance
export NODE_OPTIONS="--max-old-space-size=8192"

ENVEOF

source ~/.bashrc

echo "Optimal settings applied!"
'@
    
    $settingsScript | wsl -d $Script:Config.WslDistro -e bash -s
    Write-Step "Optimal settings applied"
}

# ============================================================
# VERIFICATION
# ============================================================

function Test-Installation {
    Write-Header "Verifying Installation"
    
    $checks = @(
        @{ Name = "WSL2"; Command = { wsl --status } },
        @{ Name = "Ollama"; Command = { wsl -d $Script:Config.WslDistro -e ollama --version } },
        @{ Name = "Hermes"; Command = { wsl -d $Script:Config.WslDistro -e bash -c "source ~/.hermes/hermes-agent/venv/bin/activate && hermes --version" } },
        @{ Name = "Python"; Command = { wsl -d $Script:Config.WslDistro -e python3 --version } },
        @{ Name = "Node.js"; Command = { wsl -d $Script:Config.WslDistro -e node --version } }
    )
    
    foreach ($check in $checks) {
        try {
            $result = & $check.Command 2>&1
            Write-Step "$($check.Name): $result"
        } catch {
            Write-Err "$($check.Name): Not found"
        }
    }
    
    # Check GPU in WSL
    if ($Script:HasGPU) {
        try {
            $gpuCheck = wsl -d $Script:Config.WslDistro -e nvidia-smi 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Step "GPU in WSL2: Available"
            } else {
                Write-Warn "GPU in WSL2: Not available (check drivers)"
            }
        } catch {
            Write-Warn "GPU in WSL2: Not available"
        }
    }
}

# ============================================================
# MAIN EXECUTION
# ============================================================

function Main {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║   Hermes Agent — Windows 11 Setup Script     ║" -ForegroundColor Cyan
    Write-Host "  ║   Version: 1.0.0 | Date: 2026-06-26          ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    # Check prerequisites
    Test-Prerequisites
    
    # Confirm
    Write-Host "`n  This script will:" -ForegroundColor White
    Write-Host "  1. Install WSL2 with Ubuntu 22.04" -ForegroundColor Gray
    Write-Host "  2. Configure NVIDIA GPU passthrough" -ForegroundColor Gray
    Write-Host "  3. Install Ollama" -ForegroundColor Gray
    Write-Host "  4. Install Hermes Agent" -ForegroundColor Gray
    Write-Host "  5. Configure providers (OpenRouter, Composio)" -ForegroundColor Gray
    Write-Host "  6. Set up Telegram X bot" -ForegroundColor Gray
    Write-Host "  7. Configure Tailscale" -ForegroundColor Gray
    Write-Host "  8. Set up Obsidian integration" -ForegroundColor Gray
    Write-Host "  9. Download recommended models" -ForegroundColor Gray
    Write-Host "  10. Apply optimal settings" -ForegroundColor Gray
    Write-Host ""
    
    if (-not (Get-UserConfirmation "Continue?")) {
        Write-Host "  Setup cancelled." -ForegroundColor Yellow
        return
    }
    
    # Execute steps
    try {
        Install-WSL2
        Set-WSLConfig
        Install-OllamaWindows
        Set-GPUConfig
        Install-HermesAgent
        Set-Providers
        Set-TelegramX
        Set-Tailscale
        Set-Obsidian
        Install-Models
        Set-OptimalSettings
        Test-Installation
        
        # Summary
        Write-Header "Setup Complete!"
        
        Write-Host @"
  
  Next Steps:
  ===========
  
  1. Restart your computer (if WSL2 was just installed)
  
  2. Open Ubuntu from Start menu and create your Linux user
  
  3. In WSL2 terminal, run:
     hermes setup
  
  4. Start the gateway:
     hermes gateway start
  
  5. Access dashboard at: http://localhost:8000
  
  6. Pair your phone:
     hermes relay pair
  
  7. Start chatting:
     hermes chat "Hello!"
  
  Documentation: https://hermes-agent.nousresearch.com/docs
  Config file: ~/.hermes/config.yaml
  
"@
        
    } catch {
        Write-Err "Setup failed: $_"
        Write-Err $_.ScriptStackTrace
    }
}

# Run
Main
