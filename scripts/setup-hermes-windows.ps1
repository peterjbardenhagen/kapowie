# setup-hermes-windows.ps1
# Complete Hermes Agent setup for Windows 11 + WSL2
# Run as Administrator in PowerShell 7+

param(
    [switch]$SkipWSL,
    [skip]$SkipOllama,
    [switch]$SkipModels
)

$ErrorActionPreference = "Stop"

function Write-Step { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-OK { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }

# ─── Check Prerequisites ─────────────────────────────────────────────────────
Write-Step "Checking prerequisites"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator")) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

$os = Get-CimInstance Win32_OperatingSystem
if ([int]$os.BuildNumber -lt 22000) {
    Write-Error "Windows 11 required (build 22000+). Current: $($os.BuildNumber)"
    exit 1
}
Write-OK "Windows 11 detected (build $($os.BuildNumber))"

# ─── Install WSL2 ─────────────────────────────────────────────────────────────
if (-not $SkipWSL) {
    Write-Step "Installing WSL2"
    
    $wsl = Get-Command wsl -ErrorAction SilentlyContinue
    if (-not $wsl) {
        wsl --install -d Ubuntu-24.04 --no-launch
        Write-OK "WSL2 installed. REBOOT required after script completes."
    } else {
        Write-OK "WSL2 already installed"
    }
    
    # Configure WSL
    $wslConfig = @"
[wsl2]
memory=32GB
processors=16
swap=8GB
localhostForwarding=true
gpuSupport=true
"@
    $wslConfig | Out-File -FilePath "$env:USERPROFILE\.wslconfig" -Encoding UTF8
    Write-OK "WSL config written"
}

# ─── Install Tailscale ────────────────────────────────────────────────────────
Write-Step "Installing Tailscale"

$tailscale = Get-Command tailscale -ErrorAction SilentlyContinue
if (-not $tailscale) {
    winget install Tailscale.Tailscale --accept-source-agreements --accept-package-agreements
    Write-OK "Tailscale installed"
} else {
    Write-OK "Tailscale already installed"
}

# ─── Install PowerShell 7 ─────────────────────────────────────────────────────
Write-Step "Checking PowerShell version"

if ($PSVersionTable.PSVersion.Major -lt 7) {
    winget install Microsoft.PowerShell --accept-source-agreements --accept-package-agreements
    Write-OK "PowerShell 7 installed. Please restart and re-run this script."
} else {
    Write-OK "PowerShell $($PSVersionTable.PSVersion) detected"
}

# ─── Install Ollama ───────────────────────────────────────────────────────────
if (-not $SkipOllama) {
    Write-Step "Installing Ollama"
    
    $ollama = Get-Command ollama -ErrorAction SilentlyContinue
    if (-not $ollama) {
        # Install Ollama on Windows
        $ollamaUrl = "https://ollama.com/download/OllamaSetup.exe"
        $ollamaInstaller = "$env:TEMP\OllamaSetup.exe"
        
        Write-Host "  Downloading Ollama..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $ollamaUrl -OutFile $ollamaInstaller -UseBasicParsing
        
        Write-Host "  Running installer..." -ForegroundColor Gray
        Start-Process -FilePath $ollamaInstaller -Wait
        
        Remove-Item $ollamaInstaller -Force
        Write-OK "Ollama installed"
    } else {
        Write-OK "Ollama already installed"
    }
    
    # Check for NVIDIA GPU
    $gpu = Get-CimInstance Win32_VideoController | Where-Object { $_.Name -match "NVIDIA" }
    if ($gpu) {
        Write-OK "NVIDIA GPU detected: $($gpu.Name)"
    } else {
        Write-Warn "No NVIDIA GPU detected. Ollama will run in CPU-only mode."
    }
}

# ─── Install Python ───────────────────────────────────────────────────────────
Write-Step "Installing Python 3.11+"

$python = Get-Command python -ErrorAction SilentlyContinue
if ($python -and [int]$python.Version.Major -ge 3 -and [int]$python.Version.Minor -ge 11) {
    Write-OK "Python $($python.Version) detected"
} else {
    winget install Python.Python.3.11 --accept-source-agreements --accept-package-agreements
    Write-OK "Python 3.11 installed"
}

# ─── Install Git ──────────────────────────────────────────────────────────────
Write-Step "Installing Git"

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    winget install Git.Git --accept-source-agreements --accept-package-agreements
    Write-OK "Git installed"
} else {
    Write-OK "Git already installed"
}

# ─── Install Hermes Agent ─────────────────────────────────────────────────────
Write-Step "Installing Hermes Agent"

$hermesDir = "$env:USERPROFILE\hermes\hermes-agent"
if (-not (Test-Path $hermesDir)) {
    git clone https://github.com/NousResearch/hermes-agent.git $hermesDir
    Write-OK "Hermes cloned to $hermesDir"
} else {
    Write-OK "Hermes already cloned at $hermesDir"
}

# Create venv
$venvPath = "$hermesDir\venv"
if (-not (Test-Path $venvPath)) {
    python -m venv $venvPath
    Write-OK "Python venv created"
}

# Activate and install
& "$venvPath\Scripts\activate"
pip install -e $hermesDir
Write-OK "Hermes Agent installed in venv"

# ─── Configure Hermes ─────────────────────────────────────────────────────────
Write-Step "Configuring Hermes"

$configDir = "$env:USERPROFILE\.hermes"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

$configYaml = @"
model:
  base_url: https://openrouter.ai/api/v1
  default: google/gemini-2.5-flash
  provider: openrouter

providers:
  ollama:
    api: http://127.0.0.1:11434/v1
    default_model: qwen2.5-coder:14b
    models:
      - qwen2.5-coder:14b
      - deepseek-r1:14b
      - gemma4-hermes-131k
      - qwen3-vl-opt-hermes-256k
      - nomic-embed-text
      - mxbai-embed-large
    name: Ollama
  openrouter:
    api: https://openrouter.ai/api/v1
    default_model: google/gemini-2.5-flash
    models:
      - google/gemini-2.5-flash
      - anthropic/claude-sonnet-4
      - openai/gpt-4o-mini
      - deepseek/deepseek-r1
    name: OpenRouter
  opencode-go:
    api: https://opencode.ai/zen/go/v1
    default_model: glm-5
    models:
      - glm-5
      - kimi-k2.5
    name: OpenCode Go
  opencode-zen:
    api: https://opencode.ai/zen/v1
    default_model: gpt-4o-mini
    models:
      - gpt-4o-mini
      - claude-sonnet-4
    name: OpenCode Zen

fallback_providers:
  - provider: openrouter
    model:
      model: google/gemini-2.5-flash
      provider: openrouter

agent:
  max_turns: 200
  gateway_timeout: 1800
  restart_drain_timeout: 180
  api_max_retries: 5
  tool_use_enforcement: strict
  task_completion_guidance: true
  parallel_tool_call_guidance: true
  environment_probe: true
  coding_context: auto
  gateway_timeout_warning: 900
  clarify_timeout: 600

toolsets:
  - hermes-cli
  - web

max_concurrent_sessions: 4

credential_pool_strategies:
  openrouter: fill_first
"@

$configYaml | Out-File -FilePath "$configDir\config.yaml" -Encoding UTF8
Write-OK "Hermes config.yaml written"

# ─── Setup OpenRouter API Key ─────────────────────────────────────────────────
Write-Step "OpenRouter API Key"

$envFile = "$configDir\.env"
if (-not (Test-Path $envFile) -or -not (Select-String -Path $envFile -Pattern "OPENROUTER_API_KEY" -Quiet)) {
    Write-Host "`n  Go to https://openrouter.ai/keys to get your API key" -ForegroundColor Yellow
    Write-Host "  Free tier gives $1/month credit" -ForegroundColor Gray
    $apiKey = Read-Host "  Enter OpenRouter API Key"
    
    if ($apiKey) {
        "OPENROUTER_API_KEY=$apiKey" | Out-File -FilePath $envFile -Encoding UTF8
        Write-OK "API key saved to $envFile"
    } else {
        Write-Warn "No API key provided. Set OPENROUTER_API_KEY in $envFile manually."
    }
} else {
    Write-OK "OpenRouter API key already configured"
}

# ─── Download Ollama Models ──────────────────────────────────────────────────
if (-not $SkipModels) {
    Write-Step "Downloading Ollama models"
    
    $models = @(
        "qwen2.5-coder:14b",
        "deepseek-r1:14b",
        "gemma4-hermes-131k",
        "nomic-embed-text",
        "llama3.2:latest"
    )
    
    foreach ($model in $models) {
        Write-Host "  Pulling $model..." -ForegroundColor Gray
        ollama pull $model 2>&1 | Out-Null
        Write-OK "Model ready: $model"
    }
}

# ─── Install Hermes Relay ─────────────────────────────────────────────────────
Write-Step "Installing Hermes Relay"

$relayDir = "$env:USERPROFILE\.hermes\hermes-relay"
if (-not (Test-Path $relayDir)) {
    git clone https://github.com/Codename-11/hermes-relay.git $relayDir
    Write-OK "Hermes Relay cloned"
}

# Install relay plugin
& "$venvPath\Scripts\activate"
pip install -e $relayDir
Write-OK "Hermes Relay plugin installed"

# ─── Install Composio ─────────────────────────────────────────────────────────
Write-Step "Installing Composio"

pip install composio-core composio 2>&1 | Out-Null
Write-OK "Composio installed"

# ─── Install OpenCode ─────────────────────────────────────────────────────────
Write-Step "Installing OpenCode"

$opencodeGo = Get-Command opencode-go -ErrorAction SilentlyContinue
if (-not $opencodeGo) {
    curl -fsSL https://opencode.ai/install-go.sh | bash
    Write-OK "OpenCode Go installed"
} else {
    Write-OK "OpenCode Go already installed"
}

$opencodeZen = Get-Command opencode -ErrorAction SilentlyContinue
if (-not $opencodeZen) {
    curl -fsSL https://opencode.ai/install.sh | bash
    Write-OK "OpenCode Zen installed"
} else {
    Write-OK "OpenCode Zen already installed"
}

# ─── Setup Telegram X Bot ─────────────────────────────────────────────────────
Write-Step "Telegram X Bot Setup"

Write-Host @"

  TELEGRAM X SETUP:
  ==================
  1. Uninstall official Telegram app
  2. Install Telegram X from F-Droid: https://f-droid.org/packages/org.thunderdog.challegram/
  3. Message @BotFather: /newbot
  4. Name: Hermes Bot
  5. Save the token
  6. Add to $envFile:
     TELEGRAM_BOT_TOKEN=your_token_here

"@ -ForegroundColor Yellow

# ─── Summary ──────────────────────────────────────────────────────────────────
Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║  SETUP COMPLETE                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Next steps:                                                 ║
║  1. Set OpenRouter API key in $envFile    ║
║  2. Start Hermes: hermes gateway start                       ║
║  3. Start Relay: hermes relay start                          ║
║  4. Pair phone: hermes-pair                                  ║
║  5. Open Dashboard: http://localhost:8642                    ║
║                                                              ║
║  For WSL2 GPU:                                               ║
║  wsl                                                         ║
║  curl -fsSL https://ollama.com/install.sh | sh                  ║
║  ollama pull qwen2.5-coder:14b                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green
