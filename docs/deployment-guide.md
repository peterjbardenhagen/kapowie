# Hermes Agent — Complete Deployment Guide
# For: Windows 11 + WSL2 (Ubuntu) + NVIDIA RTX 5090
# Last Updated: 2026-06-26

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Windows 11 Setup](#3-windows-11-setup)
4. [WSL2 Configuration](#4-wsl2-configuration)
5. [Ollama & Local Models](#5-ollama--local-models)
6. [Hermes Agent Installation](#6-hermes-agent-installation)
7. [Hermes Dashboard & Kanban](#7-hermes-dashboard--kanban)
8. [Hermes Relay Setup](#8-hermes-relay-setup)
9. [Composio Integration](#9-composio-integration)
10. [Memory & Obsidian Integration](#10-memory--obsidian-integration)
11. [Outlook Integration](#11-outlook-integration)
12. [OpenRouter Configuration](#12-openrouter-configuration)
13. [OpenCode Go & Zen](#13-opencode-go--zen)
14. [Telegram X Setup](#14-telegram-x-setup)
15. [Optimum Settings](#15-optimum-settings)
16. [Troubleshooting](#16-troubleshooting)
17. [Quick Reference](#17-quick-reference)

---

## 1. Overview

This guide covers the complete deployment of **Hermes Agent** — an open-source AI assistant by Nous Research — on a Windows 11 machine with WSL2, NVIDIA GPU acceleration, and full integration ecosystem.

### What You'll Have After This Guide

- ✅ Hermes Agent running in WSL2 with GPU-accelerated local models
- ✅ Dashboard with Kanban board for task management
- ✅ Relay for Android (Samsung Z Flip6) with terminal and voice
- ✅ Composio integration for Outlook, Gmail, Google Calendar
- ✅ Obsidian vault integration for memory/knowledge management
- ✅ OpenRouter with free models for cloud fallback
- ✅ OpenCode Go & Zen for additional model providers
- ✅ Telegram X bot for mobile access
- ✅ Tailscale for secure remote access

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Windows 11 Host                         │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Telegram X  │  │   Tailscale  │  │  Ollama (WSL2)   │   │
│  │  (Bot API)   │  │  (VPN Mesh)  │  │  (Local Models)  │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                    │             │
│  ┌──────┴─────────────────┴────────────────────┴─────────┐  │
│  │              Hermes Gateway (WSL2)                     │  │
│  │                                                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │  │
│  │  │  Ollama  │ │OpenRouter│ │OpenCode  │ │Composio │ │  │
│  │  │  Local   │ │  Cloud   │ │ Go/Zen   │ │  APIs   │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────┘ │  │
│  │                                                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │  │
│  │  │  Kanban  │ │  Memory  │ │  Relay   │ │Obsidian │ │  │
│  │  │  Board   │ │  (RAG)   │ │ (Phone)  │ │  Vault  │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              NVIDIA RTX 5090 (GPU Passthrough)        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores (Intel i7/AMD Ryzen 7) |
| RAM | 16 GB | 32+ GB |
| GPU | Optional | NVIDIA RTX 5090 (16GB+ VRAM) |
| Storage | 50 GB free | 100+ GB SSD |
| Network | Broadband | Stable connection |

### Software Requirements

- **Windows 11** (22H2 or later)
- **WSL2** with Ubuntu 22.04+
- **NVIDIA GPU Driver** (latest, for GPU acceleration)
- **PowerShell 7+** (for setup scripts)
- **Git** (for repository management)

### Accounts Needed

- [OpenRouter](https://openrouter.ai) — API key for cloud models
- [Composio](https://composio.dev) — API key for integrations
- [Telegram](https://telegram.org) — Bot token (via BotFather)
- [Tailscale](https://tailscale.com) — For remote access (optional)
- [GitHub](https://github.com) — Personal access token

---

## 3. Windows 11 Setup

### 3.1 Enable WSL2

Open PowerShell as Administrator:

```powershell
# Enable WSL
wsl --install

# Set WSL2 as default
wsl --set-default-version 2

# Verify
wsl --list --verbose
```

### 3.2 Install NVIDIA Drivers

1. Download latest driver from [NVIDIA](https://www.nvidia.com/download/index.aspx)
2. Install **Game Ready** or **Studio Driver**
3. Verify in PowerShell:

```powershell
nvidia-smi
```

### 3.3 Install PowerShell 7

```powershell
# Via winget
winget install Microsoft.PowerShell

# Or via Chocolatey
choco install powershell-core -y
```

### 3.4 Install Git

```powershell
winget install Git.Git
```

### 3.5 Install Tailscale (Optional but Recommended)

```powershell
winget install Tailscale.Tailscale

# Start and authenticate
tailscale up
```

---

## 4. WSL2 Configuration

### 4.1 Update WSL2

```powershell
wsl --update
```

### 4.2 Configure WSL2 Resources

Create/edit `%USERPROFILE%\.wslconfig`:

```ini
[wsl2]
memory=24GB
processors=12
swap=8GB
localhostForwarding=true
gpuSupport=true
```

Restart WSL:

```powershell
wsl --shutdown
wsl
```

### 4.3 Update Ubuntu

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential curl wget git python3 python3-pip python3-venv
```

### 4.4 Verify GPU Passthrough

```bash
# In WSL2
nvidia-smi

# Should show your RTX 5090
```

---

## 5. Ollama & Local Models

### 5.1 Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 5.2 Configure Ollama for GPU

```bash
# Set environment variables
echo 'export OLLAMA_KEEP_ALIVE="-1"' >> ~/.bashrc
echo 'export OLLAMA_NUM_PARALLEL=2' >> ~/.bashrc
echo 'export OLLAMA_HOST=0.0.0.0:11434' >> ~/.bashrc
source ~/.bashrc

# Start Ollama
ollama serve
```

### 5.3 Download Recommended Models

```bash
# Primary model (general purpose, 131K context)
ollama pull gemma4:latest

# Coding model
ollama pull qwen2.5-coder:14b

# Vision model
ollama pull qwen3-vl:8b

# Embedding models
ollama pull nomic-embed-text
ollama pull mxbai-embed-large
ollama pull qwen3-embedding:4b

# Lightweight model (fast responses)
ollama pull llama3.2:latest
```

### 5.4 Create Hermes-Tuned Models

Create a `Modelfile` for gemma4-hermes:

```dockerfile
FROM gemma4:latest

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_ctx 131072

SYSTEM """
You are Hermes, a helpful AI assistant by Nous Research. You are direct, knowledgeable, and efficient. You provide accurate information and admit when you don't know something. You follow instructions precisely and ask clarifying questions when needed.
"""
```

Build it:

```bash
ollama create gemma4-hermes-131k -f ./Modelfile
```

### 5.5 CPU-Only Mode (No GPU)

If you don't have an NVIDIA GPU:

```bash
# Ollama automatically falls back to CPU
# Just reduce model sizes:
ollama pull llama3.2:latest        # 3B params
ollama pull qwen2.5:7b             # 7B params
ollama pull phi4:latest            # 14B params

# Set lower context for CPU
# In config: num_ctx 16384
```

---

## 6. Hermes Agent Installation

### 6.1 Install in WSL2

```bash
# Create directory
mkdir -p ~/.hermes && cd ~/.hermes

# Install via pip
pip3 install hermes-agent

# Or install from source
git clone https://github.com/NousResearch/hermes-agent.git
cd hermes-agent
pip3 install -e .
```

### 6.2 Initial Configuration

```bash
# Run setup wizard
hermes setup

# Or manually create config
mkdir -p ~/.hermes
cp config/hermes-config-optimal.yaml ~/.hermes/config.yaml
```

### 6.3 Start Gateway

```bash
# Start the gateway service
hermes gateway start

# Check status
hermes gateway status

# View logs
hermes gateway logs
```

### 6.4 Update Hermes

```bash
hermes update
```

---

## 7. Hermes Dashboard & Kanban

### 7.1 Dashboard Setup

The Hermes dashboard provides a web-based UI for monitoring and managing your agent.

```bash
# Start dashboard (included with gateway)
hermes dashboard start

# Access at http://localhost:8000
```

### 7.2 Kanban Board Setup

The Kanban board enables task management with automatic decomposition and delegation.

**Configuration in `config.yaml`:**

```yaml
kanban:
  dispatch_in_gateway: true
  dispatch_interval_seconds: 30
  failure_limit: 2
  max_in_progress_per_profile: 10
  auto_decompose: true
  auto_decompose_per_tick: 8
  max_parallel_jobs: 12
```

### 7.3 Using the Kanban Board

```bash
# Create a task
hermes kanban add "Implement user authentication" --priority high

# List tasks
hermes kanban list

# Move task to in-progress
hermes kanban move <task-id> in_progress

# Complete task
hermes kanban complete <task-id>

# View board
hermes kanban board
```

### 7.4 Kanban CLI Commands

| Command | Description |
|---------|-------------|
| `hermes kanban add <title>` | Create new task |
| `hermes kanban list` | List all tasks |
| `hermes kanban move <id> <status>` | Move task to new status |
| `hermes kanban complete <id>` | Mark task complete |
| `hermes kanban delete <id>` | Delete task |
| `hermes kanban board` | Show board view |
| `hermes kanban assign <id> <profile>` | Assign to profile |

### 7.5 Auto-Decomposition

When `auto_decompose: true`, complex tasks are automatically broken into subtasks:

```
Task: "Build a web application"
  ├── Subtask: "Set up project structure"
  ├── Subtask: "Create database schema"
  ├── Subtask: "Implement API endpoints"
  ├── Subtask: "Build frontend components"
  └── Subtask: "Write tests"
```

---

## 8. Hermes Relay Setup

### 8.1 Install Relay Plugin

```bash
# Install relay plugin
hermes plugins install hermes-relay

# Verify
hermes plugins list
```

### 8.2 Configure Relay

```yaml
# In config.yaml
plugins:
  enabled:
    - hermes-relay
```

### 8.3 Pair Android Device

```bash
# Generate pairing code
hermes relay pair

# Enter code in Relay app on your phone
# App: "Hermes Relay" on Google Play Store
```

### 8.4 Terminal Access

Once paired, you can access your WSL2 terminal from your phone:

1. Open **Hermes Relay** on Android
2. Tap **Terminal**
3. You now have full shell access to your WSL2 instance

### 8.5 Voice Configuration

```bash
# In Relay app on phone:
# Settings → Voice → Push-to-Talk
# Set PTT button to Volume Down (hold)
```

### 8.6 Samsung Z Flip6 Specific

See [flip6-setup.md](flip6-setup.md) for detailed Z Flip6 instructions including:
- Flex mode terminal layout
- Cover screen quick actions
- Battery optimization settings
- Foldable screen considerations

---

## 9. Composio Integration

### 9.1 What is Composio?

Composio provides 500+ API integrations for Hermes Agent, including:
- **Outlook** — Email, Calendar, Contacts
- **Gmail** — Email, Labels, Threads
- **Google Calendar** — Events, Reminders
- **Slack** — Messages, Channels
- **GitHub** — Issues, PRs, Repos
- **Notion** — Pages, Databases
- **Linear** — Issues, Projects
- And many more...

### 9.2 Setup Composio

```bash
# Sign up at https://composio.dev
# Get your API key from dashboard

# In Hermes:
# Composio MCP server is auto-discovered
# Or add manually to config:
```

```yaml
mcp_servers:
  composio:
    url: https://connect.composio.dev/mcp
    connect_timeout: 60
    timeout: 180
    headers:
      x-consumer-api-key: "YOUR_COMPOSIO_API_KEY"
```

### 9.3 Connect Outlook

```bash
# In Hermes chat:
# "Connect my Outlook account"
# Follow the OAuth flow
```

Or via Composio dashboard:
1. Go to https://app.composio.dev
2. Click **"Add Integration"**
3. Search for **"Outlook"**
4. Click **"Connect"**
5. Sign in with Microsoft account
6. Grant permissions

### 9.4 Connect Gmail

```bash
# In Hermes chat:
# "Connect my Gmail account"
# Follow the OAuth flow
```

### 9.5 Connect Google Calendar

```bash
# In Hermes chat:
# "Connect my Google Calendar"
# Follow the OAuth flow
```

### 9.6 Using Composio Tools

Once connected, you can use natural language:

```
# Email
"Send an email to john@example.com about the meeting"
"What emails do I have from Sarah?"
"Mark all emails from newsletter as read"

# Calendar
"What's on my calendar today?"
"Create a meeting for tomorrow at 2pm"
"Cancel my 3pm meeting"

# Contacts
"Find John's email address"
"Add a new contact: Jane Doe, jane@example.com"
```

### 9.7 Available Composio Toolkits

| Toolkit | Tools | Use Case |
|---------|-------|----------|
| Outlook | 50+ | Email, calendar, contacts |
| Gmail | 40+ | Email, labels, threads |
| Google Calendar | 20+ | Events, reminders |
| Slack | 30+ | Messages, channels |
| GitHub | 60+ | Issues, PRs, repos |
| Notion | 25+ | Pages, databases |
| Linear | 20+ | Issues, projects |
| Discord | 15+ | Messages, channels |
| Twitter/X | 20+ | Tweets, DMs |
| Figma | 15+ | Design files |
| Spotify | 10+ | Playback, playlists |

---

## 10. Memory & Obsidian Integration

### 10.1 Overview

Hermes memory can be integrated with Obsidian vaults for:
- **Bidirectional linking** between Hermes notes and Obsidian
- **Daily notes** auto-creation
- **Knowledge graph** synchronization
- **Long-term memory** persistence

### 10.2 Obsidian MCP Plugin Setup

1. Open **Obsidian**
2. Go to **Settings → Community Plugins**
3. Click **"Browse"**
4. Search for **"MCP"** or **"Model Context Protocol"**
5. Install **"MCP Server"** plugin by *Anonymous
6. Enable the plugin

### 10.3 Configure Obsidian MCP

In Obsidian MCP settings:

```json
{
  "port": 27124,
  "allowedOrigins": ["http://localhost:3000"],
  "vaultPath": "/path/to/your/vault"
}
```

### 10.4 Configure Hermes for Obsidian

```yaml
# In config.yaml
mcp_servers:
  obsidian:
    command: npx
    args:
      - -y
      - 'obsidian-mcp-server'
    connect_timeout: 30
    timeout: 60
```

### 10.5 Vault Path Configuration

```yaml
# Set your Obsidian vault path
filesystem:
  paths:
    - /home/peterb/dev
    - /mnt/c/Users/PeterBardenhagen/Documents/Obsidian-Vault
```

### 10.6 Bidirectional Linking

Hermes can create and read Obsidian-style links:

```markdown
# In Hermes memory:
- [[Daily Note 2026-06-26]] - Today's tasks
- [[Project Kapowie]] - Stream recorder project
- [[Meeting Notes]] - Team sync
```

### 10.7 Daily Notes

Configure Hermes to auto-create daily notes:

```yaml
memory:
  memory_enabled: true
  provider: obsidian
  daily_notes:
    enabled: true
    template: |
      # {{date:YYYY-MM-DD}} - {{date:dddd}}
      
      ## Tasks
      - [ ] 
      
      ## Notes
      
      ## Links
```

### 10.8 Memory Commands

```bash
# Search memory
hermes memory search "project kapowie"

# Add to memory
hermes memory add "Kapowie uses WXT + Svelte for extension"

# View memory
hermes memory view

# Export memory
hermes memory export --format markdown
```

---

## 11. Outlook Integration

### 11.1 Via Composio (Recommended)

See [Section 9](#9-composio-integration) for Composio setup.

### 11.2 Via Native Hermes Tools

Hermes has built-in Outlook skills:

```bash
# Install Outlook skills
hermes skills install outlook-inbox-cleanup
hermes skills install outlook-inbox-summary
```

### 11.3 Outlook Configuration

```yaml
# In config.yaml
platform_toolsets:
  cli:
    - outlook
```

### 11.4 Outlook Commands

```bash
# In Hermes chat:
"Summarize my inbox"
"Clean up old emails"
"Show me unread emails from this week"
"Create a calendar event for tomorrow at 3pm"
```

---

## 12. OpenRouter Configuration

### 12.1 Get API Key

1. Go to https://openrouter.ai
2. Sign up / Log in
3. Go to **Keys** section
4. Create a new API key

### 12.2 Configure in Hermes

```yaml
# In config.yaml
model:
  base_url: https://openrouter.ai/api/v1
  default: google/gemini-2.5-flash
  provider: openrouter

providers:
  openrouter:
    api: https://openrouter.ai/api/v1
    default_model: google/gemini-2.5-flash
    models:
      - google/gemini-2.5-flash
      - anthropic/claude-sonnet-4
      - deepseek/deepseek-r1
      - openai/gpt-4o-mini
    name: OpenRouter
```

### 12.3 Free Models

See [openrouter-free-models.md](../config/openrouter-free-models.md) for the complete list of free models.

### 12.4 Response Caching

```yaml
openrouter:
  response_cache: true
  response_cache_ttl: 300
  min_coding_score: 0.65
```

---

## 13. OpenCode Go & Zen

### 13.1 What are OpenCode Go & Zen?

- **OpenCode Go** — Fast, lightweight model provider
- **OpenCode Zen** — Premium model provider with more options

### 13.2 Setup

```yaml
# In config.yaml
providers:
  opencode-go:
    api: https://opencode.ai/zen/go/v1
    default_model: glm-5
    models:
      - glm-5
      - kimi-k2.5
      - minimax-m2.5
    name: OpenCode Go

  opencode-zen:
    api: https://opencode.ai/zen/v1
    default_model: google/gemini-2.5-flash
    models:
      - google/gemini-2.5-flash
      - claude-sonnet-4
      - gpt-4o-mini
      - minimax-m2.5
      - glm-5
      - kimi-k2.5
    name: OpenCode Zen
```

### 13.3 Free Models on OpenCode

| Model | Provider | Context | Best For |
|-------|----------|---------|----------|
| glm-5 | ZhipuAI | 128K | General, coding |
| kimi-k2.5 | Moonshot | 128K | Long context |
| minimax-m2.5 | MiniMax | 128K | General |
| gpt-4o-mini | OpenAI | 128K | Fast, cheap |
| gemini-2.5-flash | Google | 1M | Long context |
| claude-sonnet-4 | Anthropic | 200K | Coding |

### 13.4 Using OpenCode

```bash
# Switch to OpenCode Go
hermes model opencode-go/glm-5

# Switch to OpenCode Zen
hermes model opencode-zen/gemini-2.5-flash
```

---

## 14. Telegram X Setup

### 14.1 Why Telegram X?

**Regular Telegram crashes** with Hermes bot due to:
- Message size limits (Telegram caps at 4096 chars)
- Streaming message edits (rate limited)
- Long response handling (timeouts)

**Telegram X** fixes these issues:
- Higher message size limits
- Better streaming support
- More stable connection
- Faster message delivery

### 14.2 Install Telegram X

1. Open **Google Play Store**
2. Search for **"Telegram X"**
3. Install (it's a separate app from regular Telegram)
4. Sign in with your Telegram account

### 14.3 Create Bot

1. Open **@BotFather** in Telegram X
2. Send `/newbot`
3. Enter bot name: `MyHermesBot`
4. Enter username: `my_hermes_bot`
5. Copy the **API token**

### 14.4 Configure Hermes for Telegram

```yaml
# In config.yaml
gateway:
  telegram:
    enabled: true

telegram:
  reactions: false
  channel_prompts: {}
  allowed_chats: ''
  extra:
    rich_messages: false
```

### 14.5 Set Bot Token

```bash
# In WSL2
export TELEGRAM_BOT_TOKEN="your-bot-token-here"
hermes gateway restart
```

### 14.6 Using Telegram X with Hermes

1. Open **Telegram X**
2. Search for your bot: `@my_hermes_bot`
3. Send `/start`
4. Start chatting!

---

## 15. Optimum Settings

### 15.1 Task Concurrency

```yaml
agent:
  max_concurrent_children: 16      # Max parallel subagents
  max_turns: 200                    # Max turns per session
  gateway_timeout: 1800             # 30 min timeout

delegation:
  max_concurrent_children: 16
  max_async_children: 8
  max_spawn_depth: 2
  orchestrator_enabled: true

kanban:
  max_parallel_jobs: 12
  auto_decompose: true
  auto_decompose_per_tick: 8
```

### 15.2 Memory Settings

```yaml
memory:
  memory_enabled: true
  user_profile_enabled: true
  memory_char_limit: 12000
  user_char_limit: 12000
  flush_min_turns: 3
  nudge_interval: 3

context:
  engine: compressor

compression:
  enabled: true
  threshold: 0.8
  target_ratio: 0.2
  protect_last_n: 30
```

### 15.3 Model Selection Strategy

```
Priority Order:
1. Ollama Local (gemma4-hermes-131k) — Fastest, private
2. OpenRouter (gemini-2.5-flash) — Best free cloud
3. OpenCode Go (glm-5) — Fast alternative
4. OpenCode Zen (gemini-2.5-flash) — Premium fallback
```

### 15.4 Performance Tuning

```yaml
# For RTX 5090 (16GB VRAM)
environment:
  OLLAMA_KEEP_ALIVE: "-1"       # Keep models loaded
  OLLAMA_NUM_PARALLEL: 2        # 2 concurrent requests

# Container resources
container_cpu: 4
container_memory: 8192          # 8GB RAM for containers
```

### 15.5 Security Settings

```yaml
security:
  allow_private_urls: false
  redact_secrets: true
  tirith_enabled: true
  tirith_timeout: 5
  tirith_fail_open: true

approvals:
  mode: manual
  timeout: 60
  mcp_reload_confirm: true
```

---

## 16. Troubleshooting

### 16.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `nvidia-smi` not found in WSL | Driver not installed | Install NVIDIA driver on Windows |
| Ollama won't start | Port already in use | `sudo lsof -i :11434` then kill process |
| Hermes gateway won't start | Config error | `hermes config validate` |
| Relay can't connect | Firewall | Allow port 8000 in Windows Firewall |
| Composio tools not showing | No connection | Check API key, run `hermes mcp reload` |
| Out of memory | Model too large | Use smaller model or add RAM |
| Slow responses | CPU-only mode | Verify GPU passthrough |

### 16.2 Debug Commands

```bash
# Check Hermes status
hermes status

# Validate config
hermes config validate

# Check gateway logs
hermes gateway logs --tail 100

# Check MCP servers
hermes mcp list

# Test model
hermes chat "Hello" --model ollama/gemma4:latest

# Check GPU usage
nvidia-smi

# Check Ollama models
ollama list

# Restart everything
hermes gateway restart
```

### 16.3 Log Locations

| Log | Path |
|-----|------|
| Hermes Gateway | `~/.hermes/logs/gateway.log` |
| Hermes Agent | `~/.hermes/logs/agent.log` |
| Ollama | `~/.ollama/logs/server.log` |
| WSL System | `/var/log/syslog` |

---

## 17. Quick Reference

### Essential Commands

```bash
# Start/stop
hermes gateway start
hermes gateway stop
hermes gateway restart

# Status
hermes status
hermes gateway status

# Models
hermes model list
hermes model switch ollama/gemma4:latest

# Chat
hermes chat "Hello world"
hermes chat --tui

# Kanban
hermes kanban add "Task name"
hermes kanban list
hermes kanban board

# Memory
hermes memory search "query"
hermes memory add "fact"

# Relay
hermes relay pair
hermes relay status

# Update
hermes update
```

### File Locations

| File | Path |
|------|------|
| Config | `~/.hermes/config.yaml` |
| Memory | `~/.hermes/memory/` |
| Skills | `~/.hermes/skills/` |
| Logs | `~/.hermes/logs/` |
| Plugins | `~/.hermes/plugins/` |
| Sessions | `~/.hermes/sessions/` |

### Ports

| Service | Port | Protocol |
|---------|------|----------|
| Hermes Gateway | 8000 | HTTP |
| Ollama | 11434 | HTTP |
| Dashboard | 8000 | HTTP |
| Relay | 8000 | WebSocket |
| SearXNG | 8085 | HTTP |

### Environment Variables

```bash
# Ollama
export OLLAMA_KEEP_ALIVE="-1"
export OLLAMA_NUM_PARALLEL=2
export OLLAMA_HOST=0.0.0.0:11434

# OpenRouter
export OPENROUTER_API_KEY="your-key"

# Composio
export COMPOSIO_API_KEY="your-key"

# Telegram
export TELEGRAM_BOT_TOKEN="your-token"

# GitHub
export GITHUB_PERSONAL_ACCESS_TOKEN="your-token"
```

---

*End of Deployment Guide*
