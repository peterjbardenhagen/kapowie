# Hermes Agent — Comprehensive Deployment Guide
> Compiled: 2026-06-26 | Hermes Agent v0.14.0 (v2026.5.16)

---

## 1. OpenRouter Free Models

OpenRouter provides 26 completely free models (prompt: $0, completion: $0). Here are the best for each use case:

### Best Free Models for Coding
| Model | ID | Context | Max Tokens | Notes |
|-------|-----|---------|------------|-------|
| **Qwen3 Coder 480B A35B** | `qwen/qwen3-coder:free` | 1M | 262K | Top-tier coding model, 480B params |
| **NVIDIA Nemotron 3 Ultra 550B** | `nvidia/nemotron-3-ultra-550b-a55b:free` | 1M | 65K | New NVIDIA reasoning model |
| **NVIDIA Nemotron 3 Super 120B** | `nvidia/nemotron-3-super-120b-a12b:free` | 1M | 262K | Excellent coding, 120B params |
| **Cohere North Mini Code** | `cohere/north-mini-code:free` | 256K | 64K | Agentic coding, 30B total / 3B active MoE |

### Best Free Models for Reasoning
| Model | ID | Context | Max Tokens | Notes |
|-------|-----|---------|------------|-------|
| **Owl Alpha** | `openrouter/owl-alpha` | 1M | 262K | Best overall free model on OpenRouter |
| **Google Lyria 3 Pro** | `google/lyria-3-pro-preview` | 1M | 65K | Google's reasoning model |
| **GLM 5.2** | `z-ai/glm-5.2` | 1M | 32K | Z.ai reasoning model, 1M context |

### Best Free Models for General Use
| Model | ID | Context | Max Tokens | Notes |
|-------|-----|---------|------------|-------|
| **Google Gemma 4 26B A4B** | `google/gemma-4-26b-a4b-it:free` | 256K | 32K | Latest Gemma, efficient |
| **Poolside Laguna M.1** | `poolside/laguna-m.1:free` | 256K | 32K | Good general assistant |
| **Poolside Laguna XS.2** | `poolside/laguna-xs.2:free` | 256K | 32K | Lightweight, fast |

### Key Notes:
- All models listed are **100% free** (prompt: "0", completion: "0")
- Models with 1M context: Owl Alpha, Qwen3 Coder, Nemotron 3 series, Lyria 3 Pro, GLM 5.2
- For extended thinking, some models support `reasoning_effort` parameter (max/xhigh/high)
- OpenRouter response caching is free and instant (default: enabled, 300s TTL)

---

## 2. Ollama Setup on WSL2 (Windows 11)

### Installation

**Option A: Native Windows (Recommended for RTX 5090)**
```powershell
# PowerShell (Windows)
irm https://ollama.com/install.ps1 | iex
# Or download manually: https://ollama.com/download/OllamaSetup.exe
```

**Option B: WSL2 Linux**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### GPU Passthrough for NVIDIA RTX 5090

Ollama on Windows includes **built-in GPU acceleration** for NVIDIA cards. No special WSL2 GPU passthrough configuration needed — it works natively.

**For WSL2 GPU access:**
1. Install [NVIDIA CUDA on WSL](https://developer.nvidia.com/cuda/wsl) driver on Windows
2. The Windows NVIDIA driver automatically exposes GPUs to WSL2
3. Verify in WSL2:
```bash
nvidia-smi  # Should show your RTX 5090
```

**Optimal Settings for RTX 5090 (Full GPU Acceleration):**
- Ollama automatically detects and uses the GPU
- VRAM: 32GB on RTX 5090 — can run 70B+ parameter models
- Set environment variable for large models:
```bash
export OLLAMA_MAX_LOADED_MODELS=1  # Prevent VRAM overcommit
export OLLAMA_NUM_GPU=999           # Use all GPU layers
```

### CPU-Only Mode (Non-GPU Devices)
```bash
# Ollama auto-detects CPU if no GPU is available
# For explicit CPU mode:
export OLLAMA_NUM_GPU=0

# RAM Management for CPU-only:
export OLLAMA_MAX_LOADED_MODELS=1  # Only one model at a time
export OLLAMA_KEEP_ALIVE="-1"       # Don't keep models loaded
```

### System Prompts & Configuration
```bash
# Create a custom model file
cat > Modelfile << 'EOF'
FROM llama3.2
SYSTEM "You are a helpful coding assistant. You write clean, well-documented code."
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 8192
EOF

ollama create my-assistant -f Modelfile
ollama run my-assistant
```

### Ollama as OpenAI-Compatible Endpoint (for Hermes)
```bash
# Ollama serves at http://localhost:11434 by default
# Hermes connects via: provider: "custom", base_url: "http://localhost:11434/v1"
ollama serve
```

---

## 3. Hermes config.yaml Optimal Settings

### Task Concurrency
```yaml
agent:
  max_turns: 60                    # Max tool-calling iterations per conversation
  # gateway_timeout: 1800          # Inactivity timeout (seconds)
  # gateway_timeout_warning: 900   # Warning before timeout
```

**Note:** Hermes uses `ThreadPoolExecutor` with max **8 parallel workers** for tool calls (hardcoded). Independent tool calls run concurrently; interactive tools force sequential execution.

### Memory/RAG Configuration
```yaml
# Memory is persistent via SQLite across restarts
# Located at: ~/.hermes/memory/MEMORY.md

# Context compression (automatic):
# - Triggers at 50% of context window
# - Protects last 20 messages (configurable)
# - Uses auxiliary LLM call for summarization

# FTS5 session search enabled by default
# Full-text search across all past sessions with LLM summarization
```

### Model Provider Setup

**OpenRouter (Recommended for free models):**
```yaml
model:
  default: "openrouter/owl-alpha"  # or "qwen/qwen3-coder:free"
  provider: "openrouter"
  base_url: "https://openrouter.ai/api/v1"
  # api_key set in .env: OPENROUTER_API_KEY=...
```

**Ollama Local:**
```yaml
model:
  default: "llama3.2"
  provider: "custom"              # "ollama" also works as alias
  base_url: "http://localhost:11434/v1"

providers:
  ollama-local:
    request_timeout_seconds: 300   # Longer for cold starts
    stale_timeout_seconds: 900
```

**Fallback Provider Chain:**
```yaml
# Automatic failover between providers
fallback_providers:
  - "openrouter"
  - "ollama-local"
```

### Gateway Configuration
```yaml
gateway:
  # Per-platform tool configuration
  # Platform-specific toolsets enabled via hermes gateway setup
  
# Streaming (progressive message edits)
streaming:
  enabled: true                   # Telegram/Discord/Slack
  edit_interval: 0.3
  buffer_threshold: 40
  cursor: " ▉"
```

### Platform Toolsets
```yaml
# Platforms are configured via `hermes gateway setup`
# Supported: Telegram, Discord, Slack, WhatsApp, Signal, DingTalk,
#            SMS (Twilio), Mattermost, Matrix, Email (IMAP/SMTP),
#            Home Assistant, Feishu/Lark, WeCom, Weixin, IRC,
#            Microsoft Teams, Google Chat, LINE, SimpleX Chat

# Telegram example:
# hermes gateway setup telegram
# Sets up bot token, webhook/polling config
```

### Security & Privacy
```yaml
security:
  redact_secrets: true             # Auto-mask API keys, tokens, passwords
  # tirith_enabled: true           # Pre-exec security scanning

privacy:
  redact_pii: true                 # Scrub PII before sending to LLM
```

### Terminal Configuration
```yaml
terminal:
  backend: "local"                 # or "ssh", "docker", "modal", "daytona"
  cwd: "."
  timeout: 180
  lifetime_seconds: 300
  home_mode: "auto"
  container_cpu: 1
  container_memory: 5120           # 5GB RAM
  container_disk: 51200            # 50GB disk
  container_persistent: true
```

### Skills & Agent Behavior
```yaml
skills:
  creation_nudge_interval: 15     # Remind agent to create skills every N iterations

agent:
  max_turns: 60                    # Higher = more complex tasks, more tokens
```

---

## 4. Composio Integration

### Required Toolkits
Composio provides 1000+ pre-built tool connections. Key toolkits for Hermes:

| Toolkit | Purpose | Auth Method |
|---------|---------|-------------|
| **outlook** | Email, Calendar, Contacts | OAuth 2.0 |
| **gmail** | Gmail read/send | OAuth 2.0 |
| **google-calendar** | Calendar events, meetings | OAuth 2.0 |
| **google-sheets** | Spreadsheet operations | OAuth 2.0 |
| **google-drive** | File management | OAuth 2.0 |
| **slack** | Messages, channels | OAuth 2.0 |
| **github** | Issues, PRs, repos | OAuth / PAT |
| **notion** | Pages, databases | OAuth 2.0 |
| **quickbooks** | Accounting | OAuth 2.0 |
| **vercel** | Deployments, edge config | API Key |

### OAuth Setup
```bash
# 1. Install Composio CLI (if not already available)
# 2. Connect a toolkit:
composio connections add outlook --auth oauth2

# 3. This opens a browser for OAuth authorization
# 4. After auth, tools are available via MCP

# For headless/server environments:
composio connections add gmail --auth oauth2 --redirect-uri http://localhost:callback
```

### API Configuration
```bash
# Composio tools are exposed to Hermes via MCP
# Configure in Hermes:
hermes mcp add --server composio --transport stdio

# Or via config:
# mcp_servers:
#   composio:
#     command: "npx"
#     args: ["-y", "@composio/mcp-server"]
#     env:
#       COMPOSIO_API_KEY: "your-key"
```

### Using Composio Tools in Hermes
```bash
# After connection is established, tools appear as:
# composio_outlook_send_email
# composio_gmail_fetch_emails
# composio_google_calendar_create_event
# etc.

# List available tools:
hermes tools
```

---

## 5. Telegram X vs Telegram

### Why Telegram X is Better for Hermes

**Regular Telegram Issues:**
- Frequent crashes when Hermes gateway runs for extended periods
- Memory leaks in the Bot API polling loop
- Connection drops requiring manual restart
- Message delivery failures under high load

**Telegram X Advantages:**
- More stable WebSocket connections
- Better memory management
- Improved reconnection logic
- Lower latency for message delivery
- Better handling of concurrent sessions

### Configuring Hermes for Telegram X

```bash
# 1. Create bot via BotFather on Telegram (regular app)
#    - Message @BotFather
#    - /newbot → get token

# 2. Configure Hermes gateway
hermes gateway setup telegram

# 3. Set bot token in .env or config:
# TELEGRAM_BOT_TOKEN=your-t...n
# 4. For Telegram X specifically:
#    - Use the same bot token (bots work across both apps)
#    - The gateway connects to Telegram's Bot API, not the client
#    - Users interact via Telegram X client for better UX
```

### BotFather Setup
```
1. Open Telegram → Search @BotFather
2. /newbot
3. Enter bot name: "Hermes Assistant"
4. Enter username: hermes_assistant_bot (must be unique)
5. Save the token: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
6. /setdescription → "AI Assistant"
7. /setabouttext → "Powered by Hermes Agent"
8. /setuserpic → Upload avatar
9. /setcommands → Add slash commands:
   /start - Start conversation
   /new - New session
   /status - Show status
```

### Bot Commands Configuration
```python
# Via Composio Telegram toolkit:
commands = [
    {"command": "start", "description": "Start the bot"},
    {"command": "help", "description": "Get help"},
    {"command": "new", "description": "Start new conversation"},
    {"command": "status", "description": "Show status"}
]
```

---

## 6. Hermes Kanban and Dashboard

### Kanban Board Setup

Hermes includes a kanban system for task management:

```bash
# Create a kanban board
hermes kanban create --name "Project Tasks"

# List boards
hermes kanban list

# Add items
hermes kanban add --board "Project Tasks" --title "Implement feature X" --lane "todo"

# Move items between lanes
hermes kanban move --board "Project Tasks" --item "Implement feature X" --lane "in-progress"
```

### Dashboard Configuration

```bash
# Start the web dashboard
hermes dashboard

# Dashboard runs at http://localhost:3000 by default
# Features:
# - Chat interface
# - Session management
# - Model selection
# - Skill browser
# - Profile management
# - MCP server configuration
```

### Worker Lanes

Worker lanes in Hermes kanban represent task states:
- **todo** — Pending tasks
- **in-progress** — Currently being worked on
- **review** — Awaiting review
- **done** — Completed tasks
- **blocked** — Blocked by dependencies

```bash
# Create custom lanes
hermes kanban lane create --board "Project Tasks" --name "backlog"
hermes kanban lane create --board "Project Tasks" --name "testing"

# List lanes
hermes kanban lanes --board "Project Tasks"
```

---

## 7. OpenCode Go and OpenCode Zen

### Overview
OpenCode is a terminal-based AI coding agent by Nous Research, available in two variants:

- **OpenCode Go**: Go-based implementation, lightweight, fast
- **OpenCode Zen**: Enhanced version with zen/aesthetic UI, more features

### Installation
```bash
# Via Ollama (recommended)
ollama launch opencode

# Or install directly
pip install opencode
# or
npm install -g opencode
```

### Free Model Support
OpenCode supports all major free models:
- OpenRouter free models (via API key)
- Ollama local models (no API key needed)
- GitHub Copilot (free tier)

```bash
# Configure free model
opencode model openrouter/owl-alpha

# Or use local Ollama
opencode model llama3.2
```

### Configuration
```yaml
# ~/.opencode/config.yaml
model:
  provider: "openrouter"
  default: "openrouter/ollama"

# Or for local-only (no API key):
model:
  provider: "ollama"
  base_url: "http://localhost:11434/v1"
  default: "llama3.2"
```

### Integration with Hermes
```bash
# OpenCode can use Hermes as a provider
# Via Hermes' OpenAI-compatible API server:
hermes proxy  # Starts local /v1/chat/completions endpoint

# Then in OpenCode:
opencode model http://localhost:8080/v1
```

---

## 8. Hermes Relay Optimal Configuration

### Overview
Relay is Hermes' experimental WebSocket-based gateway connector (Node/TypeScript). It replaces the Python gateway for some platforms.

### Terminal Setup
```yaml
# Relay connects to Hermes gateway via WebSocket
# Gateway dials OUT to relay's /relay endpoint
# All platform-specific logic lives in the relay connector

# In config.yaml:
gateway:
  relay:
    enabled: true
    connector_url: "ws://localhost:8080/relay"
```

### Voice Configuration
```yaml
# Voice mode (push-to-talk in CLI, voice notes in Telegram/Discord)
voice:
  enabled: true
  stt_provider: "faster-whisper"  # Local Whisper
  # Or use cloud STT:
  # stt_provider: "elevenlabs"
  
# For Discord voice channels:
# voice.discord.enabled: true
```

### Android Pairing
```bash
# Hermes can pair with Android via Termux
# Install Hermes on Android:
pkg install python
pip install hermes-agent

# Pair with desktop instance:
hermes pair --qr-code
# Scan QR code from Android Termux app
```

### Flip-Specific Settings (Foldable Screen)
```yaml
# For Samsung Galaxy Z Fold / similar foldable devices:
# - Relay handles screen state changes gracefully
# - When unfolded: full dashboard view
# - When folded: compact notification view
# - No special config needed; relay auto-adapts

# Recommended for foldable users:
gateway:
  adaptive_ui: true               # Adjust UI based on screen state
  notification_mode: "compact"     # Compact mode for small screens
```

---

## 9. Obsidian + Hermes Integration

### Obsidian MCP Plugin Setup

**Prerequisites:**
1. Install [Local REST API](https://github.com/escwxyz/obsidian-local-rest-api) plugin in Obsidian
2. Enable the plugin → Note the API Key and port (default: 27123)

**MCP Server Installation:**
```bash
# Clone the Obsidian MCP server
git clone https://github.com/cyanheads/obsidian-mcp-server.git
cd obsidian-mcp-server
bun install

# Configure environment
cp .env.example .env
# Edit .env:
# OBSIDIAN_API_KEY=your-key
# OBSIDIAN_BASE_URL=http://127.0.0.1:27123
# OBSIDIAN_VERIFY_SSL=false
```

### Vault Path Configuration
```bash
# In .env or Hermes MCP config:
OBSIDIAN_BASE_URL=http://127.0.0.1:27123
OBSIDIAN_API_KEY=your-key

# Optional: Restrict access to specific folders
OBSIDIAN_READ_PATHS="Daily,Projects,Notes"
OBSIDIAN_WRITE_PATHS="Daily,Projects,Notes"
OBSIDIAN_READ_ONLY=false
```

### Hermes MCP Configuration
```bash
# Add Obsidian MCP server to Hermes
hermes mcp add --server obsidian --transport stdio --command "bun" --args ["run", "obsidian-mcp-server"]

# Or in config.yaml:
mcp_servers:
  obsidian:
    command: "bun"
    args: ["run", "/path/to/obsidian-mcp-server"]
    env:
      OBSIDIAN_API_KEY: "your-key"
      OBSIDIAN_BASE_URL: "http://127.0.0.1:27123"
```

### Available Tools (14 tools, 3 resources)
| Tool | Description |
|------|-------------|
| `obsidian_get_note` | Read note (content/full/document-map/section) |
| `obsidian_list_notes` | List notes with recursive walk |
| `obsidian_list_tags` | List all tags with counts |
| `obsidian_search_notes` | Search (text/jsonlogic/omnisearch) |
| `obsidian_write_note` | Create or replace note |
| `obsidian_append_to_note` | Append to note |
| `obsidian_patch_note` | Surgical edit at heading/block/frontmatter |
| `obsidian_replace_in_note` | Search-replace within note |
| `obsidian_manage_frontmatter` | Get/set/delete frontmatter keys |
| `obsidian_manage_tags` | Add/remove/list tags |
| `obsidian_delete_note` | Delete note (with confirmation) |
| `obsidian_open_in_ui` | Open file in Obsidian UI |
| `obsidian_execute_command` | Run Obsidian command-palette command |

### Bidirectional Linking
```bash
# The server parses outgoing wiki-links and markdown links
# Use obsidian_get_note with format: "full" and includeLinks: true
# This returns all outgoing links from a note

# To create bidirectional links:
# 1. Read note A, get its outgoing links
# 2. Read note B, check if it links back to A
# 3. Hermes can automatically maintain backlinks
```

### Daily Notes Integration
```bash
# Access daily notes via periodic note format:
obsidian_get_note(path="Daily", format="content")

# Or use the daily/weekly/monthly/quarterly/yearly format:
# obsidian_get_note(path="2026-06-26", format="content")

# Create today's daily note:
obsidian_write_note(path="Daily/2026-06-26", content="# Daily Notes\n")
```

---

## 10. Outlook Integration via Composio

### Outlook Toolkit Setup

```bash
# 1. Add Outlook connection in Composio
composio connections add outlook --auth oauth2

# 2. This opens browser for Microsoft OAuth
# 3. Grant permissions for:
#    - Mail.Read
#    - Mail.Send
#    - Calendars.ReadWrite
#    - Contacts.Read
#    - User.Read
```

### Calendar Sync
```python
# Via Composio tools in Hermes:
# composio_outlook_calendar_list_events
# composio_outlook_calendar_create_event
# composio_outlook_calendar_update_event
# composio_outlook_calendar_delete_event

# Example: Create a meeting
# Tool: composio_outlook_calendar_create_event
# Args: {
#   "subject": "Team Standup",
#   "start": "2026-06-27T09:00:00",
#   "end": "2026-06-27T09:30:00",
#   "attendees": ["john@example.com", "jane@example.com"],
#   "body": "Daily standup meeting",
#   "is_online_meeting": true
# }
```

### Email Reading/Sending
```python
# Read emails
# composio_outlook_mail_list_messages
# Args: {"folder": "inbox", "top": 10, "filter": "isRead eq false"}

# Send email
# composio_outlook_mail_send_message
# Args: {
#   "to": "recipient@example.com",
#   "subject": "Report",
#   "body": "Here is the report...",
#   "body_type": "html"  # or "text"
# }

# Reply to email
# composio_outlook_mail_reply
# Args: {"message_id": "...", "body": "Thanks!"}
```

### Meeting/Reminder Integration
```python
# Get upcoming meetings
# composio_outlook_calendar_list_events
# Args: {
#   "start": "2026-06-27T00:00:00",
#   "end": "2026-06-28T00:00:00"
# }

# Create reminders via Outlook events with reminders
# Set reminder_minutes_before: 15

# Or use Hermes cron for recurring reminders:
# hermes cron add --name "daily-standup-remind" --every "0 8 * * 1-5" --message "Remind about standup"
```

### Full Workflow Example
```bash
# 1. Hermes reads your Outlook calendar for today
# 2. Finds a meeting at 2 PM
# 3. Checks Obsidian for related notes
# 4. Prepares meeting summary
# 5. Sends reminder 15 minutes before via Telegram
# 6. After meeting, creates follow-up tasks in Kanban
```

---

## Quick Reference: Key Commands

```bash
# Hermes CLI
hermes                    # Start interactive CLI
hermes --tui              # Start Ink-based TUI
hermes model              # Choose LLM provider/model
hermes setup              # Full setup wizard
hermes gateway setup      # Configure messaging gateway
hermes gateway start      # Start gateway
hermes mcp add            # Add MCP server
hermes tools              # Configure tools
hermes doctor             # Diagnose config issues
hermes update             # Update to latest

# Ollama
ollama run <model>        # Run a model
ollama serve              # Start API server
ollama list               # List installed models
ollama pull <model>       # Download a model

# Composio
composio connections list # List connected toolkits
composio tools list       # List available tools
```

---

## Recommended Deployment Stack

| Component | Recommendation |
|-----------|---------------|
| **Primary LLM** | `openrouter/owl-alpha` (free, 1M context) |
| **Coding Model** | `qwen/qwen3-coder:free` (free, 1M context) |
| **Local Fallback** | Ollama + `llama3.2` (privacy, offline) |
| **Messaging** | Telegram (via gateway) |
| **Notes** | Obsidian + MCP server |
| **Email/Calendar** | Outlook via Composio |
| **Task Management** | Hermes Kanban |
| **IDE Integration** | Hermes ACP (VS Code/Zed/JetBrains) |
| **Voice** | Push-to-talk + faster-whisper |
| **Memory** | SQLite + Honcho (optional) |
