#!/bin/bash
# ============================================================
# Ollama WSL2 Setup Script
# For: Ubuntu 22.04+ in WSL2 on Windows 11
# Supports: NVIDIA GPU (RTX 5090) and CPU-only mode
# Last Updated: 2026-06-26
# ============================================================

set -euo pipefail

# ============================================================
# CONFIGURATION
# ============================================================
OLLAMA_VERSION="latest"
OLLAMA_HOST="0.0.0.0:11434"
OLLAMA_KEEP_ALIVE="-1"
OLLAMA_NUM_PARALLEL=2

# Models to download
MODELS_GPU=(
    "gemma4:latest"
    "qwen2.5-coder:14b"
    "qwen3-vl:8b"
    "llama3.2:latest"
    "nomic-embed-text"
    "mxbai-embed-large"
    "qwen3-embedding:4b"
)

MODELS_CPU=(
    "llama3.2:latest"
    "gemma4:latest"
    "nomic-embed-text"
)

# System prompts
GEMMA4_HERMES_SYSTEM="You are Hermes, a helpful AI assistant by Nous Research. You are direct, knowledgeable, and efficient. You provide accurate information and admit when you don't know something. You follow instructions precisely and ask clarifying questions when needed. You have strong opinions and skip filler. UK English always."

QWEN_CODER_SYSTEM="You are a coding assistant powered by Qwen. You write clean, well-documented code. You explain your reasoning and provide examples. You follow best practices and design patterns."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

log_info() {
    echo -e "${GREEN}[+]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[X]${NC} $1"
}

log_header() {
    echo ""
    echo -e "${CYAN}$(printf '=%.0s' {1..60})${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}$(printf '=%.0s' {1..60})${NC}"
    echo ""
}

check_command() {
    command -v "$1" &>/dev/null
}

get_user_confirmation() {
    read -p "$1 (y/N): " response
    [[ "$response" =~ ^[Yy]$ ]]
}

# ============================================================
# PREREQUISITE CHECKS
# ============================================================

check_prerequisites() {
    log_header "Checking Prerequisites"
    
    # Check WSL
    if grep -qi microsoft /proc/version 2>/dev/null; then
        log_info "Running in WSL2"
    else
        log_warn "Not running in WSL2. Some features may not work."
    fi
    
    # Check Ubuntu version
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        log_info "OS: $NAME $VERSION_ID"
    fi
    
    # Check for NVIDIA GPU
    HAS_GPU=false
    if check_command nvidia-smi; then
        GPU_INFO=$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null | head -1)
        if [ -n "$GPU_INFO" ]; then
            HAS_GPU=true
            log_info "GPU: $GPU_INFO"
        fi
    else
        log_warn "No NVIDIA GPU detected. Will use CPU-only mode."
    fi
    
    # Check RAM
    TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    TOTAL_RAM_GB=$((TOTAL_RAM_KB / 1024 / 1024))
    log_info "RAM: ${TOTAL_RAM_GB} GB"
    
    if [ "$TOTAL_RAM_GB" -lt 16 ]; then
        log_warn "16GB+ RAM recommended for local models"
    fi
    
    # Check disk space
    FREE_DISK_KB=$(df / | tail -1 | awk '{print $4}')
    FREE_DISK_GB=$((FREE_DISK_KB / 1024 / 1024))
    log_info "Disk Free: ${FREE_DISK_GB} GB"
    
    if [ "$FREE_DISK_GB" -lt 50 ]; then
        log_warn "50GB+ free space recommended for models"
    fi
    
    # Check network
    if ping -c 1 ollama.com &>/dev/null; then
        log_info "Network: Connected"
    else
        log_error "Network: Cannot reach ollama.com"
        exit 1
    fi
    
    echo "$HAS_GPU"
}

# ============================================================
# OLLAMA INSTALLATION
# ============================================================

install_ollama() {
    log_header "Installing Ollama"
    
    if check_command ollama; then
        CURRENT_VERSION=$(ollama --version)
        log_info "Ollama already installed: $CURRENT_VERSION"
        
        if get_user_confirmation "Reinstall/update Ollama?"; then
            curl -fsSL https://ollama.com/install.sh | sh
            log_info "Ollama updated"
        fi
        return
    fi
    
    log_info "Downloading Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    
    if check_command ollama; then
        log_info "Ollama installed successfully"
    else
        log_error "Ollama installation failed"
        exit 1
    fi
}

# ============================================================
# GPU CONFIGURATION
# ============================================================

configure_gpu() {
    log_header "Configuring NVIDIA GPU"
    
    if [ "$HAS_GPU" = false ]; then
        log_warn "No GPU detected. Skipping GPU configuration."
        return
    fi
    
    # Verify nvidia-smi works
    if ! nvidia-smi &>/dev/null; then
        log_error "nvidia-smi failed. Check NVIDIA drivers."
        log_error "Install latest driver on Windows host:"
        log_error "  https://www.nvidia.com/download/index.aspx"
        return
    fi
    
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
    GPU_MEM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader | head -1)
    
    log_info "GPU: $GPU_NAME"
    log_info "VRAM: $GPU_MEM"
    
    # Check CUDA version
    CUDA_VERSION=$(nvidia-smi | grep "CUDA Version" | sed 's/.*CUDA Version: \([0-9.]*\).*/\1/')
    if [ -n "$CUDA_VERSION" ]; then
        log_info "CUDA: $CUDA_VERSION"
    fi
    
    # Configure Ollama for GPU
    log_info "Configuring Ollama for GPU acceleration..."
    
    # Create Ollama service override
    sudo mkdir -p /etc/systemd/system/ollama.service.d
    
    sudo tee /etc/systemd/system/ollama.service.d/override.conf > /dev/null << EOF
[Service]
Environment="OLLAMA_KEEP_ALIVE=-1"
Environment="OLLAMA_NUM_PARALLEL=2"
Environment="OLLAMA_HOST=0.0.0.0:11434"
EOF
    
    # Reload and restart
    sudo systemctl daemon-reload
    sudo systemctl restart ollama
    
    log_info "GPU configuration complete"
    
    # Test GPU
    log_info "Testing GPU with small model..."
    ollama pull llama3.2:latest
    ollama run llama3.2:latest "Hello" <<< "Hello" &>/dev/null || true
    log_info "GPU test complete"
}

# ============================================================
# CPU-ONLY CONFIGURATION
# ============================================================

configure_cpu() {
    log_header "Configuring CPU-Only Mode"
    
    log_info "Setting up Ollama for CPU-only operation..."
    
    # Create Ollama service override for CPU
    sudo mkdir -p /etc/systemd/system/ollama.service.d
    
    sudo tee /etc/systemd/system/ollama.service.d/override.conf > /dev/null << EOF
[Service]
Environment="OLLAMA_KEEP_ALIVE=-1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_CPU_ONLY=1"
EOF
    
    # Reload and restart
    sudo systemctl daemon-reload
    sudo systemctl restart ollama
    
    log_info "CPU-only configuration complete"
    log_warn "Models will run slowly. Consider using smaller models:"
    log_warn "  - llama3.2:latest (3B)"
    log_warn "  - gemma4:latest (small)"
    log_warn "  - phi4:latest (14B)"
}

# ============================================================
# MODEL DOWNLOAD
# ============================================================

download_models() {
    log_header "Downloading Models"
    
    if [ "$HAS_GPU" = true ]; then
        MODELS=("${MODELS_GPU[@]}")
        log_info "Downloading GPU-optimized models..."
    else
        MODELS=("${MODELS_CPU[@]}")
        log_info "Downloading CPU-optimized models..."
    fi
    
    for model in "${MODELS[@]}"; do
        log_info "Pulling $model..."
        ollama pull "$model"
        log_info "$model downloaded successfully"
    done
    
    log_info "All models downloaded"
}

# ============================================================
# SYSTEM PROMPTS
# ============================================================

create_system_prompts() {
    log_header "Creating System Prompts"
    
    # Create Modelfile for gemma4-hermes
    log_info "Creating gemma4-hermes-131k model..."
    
    cat > /tmp/Modelfile.gemma4-hermes << 'MODELEOF'
FROM gemma4:latest

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_ctx 131072
PARAMETER num_predict 8192
PARAMETER repeat_penalty 1.1
PARAMETER seed 0

SYSTEM """
You are Hermes, a helpful AI assistant by Nous Research. You are direct, knowledgeable, and efficient. You provide accurate information and admit when you don't know something. You follow instructions precisely and ask clarifying questions when needed. You have strong opinions and skip filler. UK English always. No corporate sludge. You think like a Solution Architect because that is who you serve.
"""

TEMPLATE """
{{ if .System }}<start_of_turn>system
{{ .System }}<end_of_turn>
{{ end }}{{ if .Prompt }}<start_of_turn>user
{{ .Prompt }}<end_of_turn>
{{ end }}<start_of_turn>model
{{ .Response }}<end_of_turn>
"""
MODELEOF
    
    ollama create gemma4-hermes-131k -f /tmp/Modelfile.gemma4-hermes
    log_info "gemma4-hermes-131k created"
    
    # Create Modelfile for qwen25-coder-hermes
    log_info "Creating qwen25-coder-14b-hermes-32k model..."
    
    cat > /tmp/Modelfile.qwen25-coder-hermes << 'MODELEOF'
FROM qwen2.5-coder:14b

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_ctx 32768
PARAMETER num_predict 8192
PARAMETER repeat_penalty 1.1

SYSTEM """
You are a coding assistant powered by Qwen. You write clean, well-documented code. You explain your reasoning and provide examples. You follow best practices and design patterns. You think like a Solution Architect. UK English always.
"""

TEMPLATE """
{{ if .System }}<|im_start|>system
{{ .System }}<|im_end|>
{{ end }}{{ if .Prompt }}<|im_start|>user
{{ .Prompt }}<|im_end|>
{{ end }}<|im_start|>model
{{ .Response }}<|im_end|>
"""
MODELEOF
    
    ollama create qwen25-coder-14b-hermes-32k -f /tmp/Modelfile.qwen25-coder-hermes
    log_info "qwen25-coder-14b-hermes-32k created"
    
    # Create Modelfile for llama32-hermes
    log_info "Creating llama32-hermes-131k model..."
    
    cat > /tmp/Modelfile.llama32-hermes << 'MODELEOF'
FROM llama3.2:latest

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_ctx 131072
PARAMETER num_predict 4096
PARAMETER repeat_penalty 1.1

SYSTEM """
You are Hermes, a helpful AI assistant. You are direct, knowledgeable, and efficient. You provide accurate information and admit when you don't know something. You follow instructions precisely. UK English always.
"""

TEMPLATE """
{{ if .System }}<|start_header_id|>system<|end_header_id|>

{{ .System }}<|eot_id|>{{ end }}{{ if .Prompt }}<|start_header_id|>user<|end_header_id|>

{{ .Prompt }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>

{{ .Response }}<|eot_id|>
"""
MODELEOF
    
    ollama create llama32-hermes-131k -f /tmp/Modelfile.llama32-hermes
    log_info "llama32-hermes-131k created"
    
    # Cleanup
    rm -f /tmp/Modelfile.*
    
    log_info "All system prompts created"
}

# ============================================================
# ENVIRONMENT CONFIGURATION
# ============================================================

configure_environment() {
    log_header "Configuring Environment"
    
    # Add to .bashrc
    log_info "Adding environment variables to .bashrc..."
    
    cat >> ~/.bashrc << 'ENVEOF'

# ============================================================
# Ollama Configuration
# ============================================================
export OLLAMA_KEEP_ALIVE="-1"
export OLLAMA_NUM_PARALLEL=2
export OLLAMA_HOST=0.0.0.0:11434

# ============================================================
# Hermes Agent Configuration
# ============================================================
export HASS_URL="http://192.168.1.11:8123"
export NODE_OPTIONS="--max-old-space-size=8192"

# ============================================================
# Aliases
# ============================================================
alias ollama-list='ollama list'
alias ollama-status='systemctl status ollama'
alias ollama-logs='journalctl -u ollama -f'
alias hermes-status='hermes gateway status'
alias hermes-logs='hermes gateway logs --tail 50'
ENVEOF
    
    source ~/.bashrc
    log_info "Environment configured"
}

# ============================================================
# OLLAMA SERVICE
# ============================================================

start_ollama_service() {
    log_header "Starting Ollama Service"
    
    # Enable and start Ollama
    sudo systemctl enable ollama
    sudo systemctl start ollama
    
    # Wait for service
    sleep 3
    
    # Check status
    if systemctl is-active --quiet ollama; then
        log_info "Ollama service: Running"
    else
        log_error "Ollama service: Failed to start"
        sudo systemctl status ollama
        exit 1
    fi
    
    # Test API
    if curl -s http://localhost:11434/api/tags &>/dev/null; then
        log_info "Ollama API: Responding"
    else
        log_error "Ollama API: Not responding"
        exit 1
    fi
}

# ============================================================
# VERIFICATION
# ============================================================

verify_installation() {
    log_header "Verifying Installation"
    
    # Check Ollama
    if check_command ollama; then
        OLLAMA_VER=$(ollama --version)
        log_info "Ollama: $OLLAMA_VER"
    else
        log_error "Ollama: Not found"
    fi
    
    # Check service
    if systemctl is-active --quiet ollama; then
        log_info "Service: Running"
    else
        log_warn "Service: Not running"
    fi
    
    # Check models
    log_info "Installed models:"
    ollama list 2>/dev/null | tail -n +2 | while read -r line; do
        echo "    $line"
    done
    
    # Check GPU
    if [ "$HAS_GPU" = true ]; then
        log_info "GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)"
        log_info "GPU Memory: $(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader | head -1)"
    fi
    
    # Check API
    if curl -s http://localhost:11434/api/tags | grep -q "models"; then
        log_info "API: Responding at http://localhost:11434"
    else
        log_warn "API: Not responding"
    fi
}

# ============================================================
# MAIN EXECUTION
# ============================================================

main() {
    echo ""
    echo -e "${CYAN}  ╔══════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}  ║   Ollama WSL2 Setup Script                  ║${NC}"
    echo -e "${CYAN}  ║   For: Ubuntu 22.04+ in WSL2                ║${NC}"
    echo -e "${CYAN}  ║   Date: 2026-06-26                          ║${NC}"
    echo -e "${CYAN}  ╚══════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Check prerequisites
    HAS_GPU=$(check_prerequisites)
    
    # Confirm
    echo ""
    echo "  This script will:"
    echo "  1. Install/update Ollama"
    echo "  2. Configure GPU passthrough (if available)"
    echo "  3. Download recommended models"
    echo "  4. Create Hermes-tuned models"
    echo "  5. Configure environment variables"
    echo "  6. Start Ollama service"
    echo ""
    
    if ! get_user_confirmation "Continue"; then
        echo "  Setup cancelled."
        exit 0
    fi
    
    # Execute steps
    install_ollama
    
    if [ "$HAS_GPU" = true ]; then
        configure_gpu
    else
        configure_cpu
    fi
    
    start_ollama_service
    download_models
    create_system_prompts
    configure_environment
    verify_installation
    
    # Summary
    log_header "Setup Complete!"
    
    echo ""
    echo "  Next Steps:"
    echo "  ==========="
    echo ""
    echo "  1. Verify Ollama is running:"
    echo "     ollama list"
    echo ""
    echo "  2. Test a model:"
    echo "     ollama run gemma4-hermes-131k 'Hello!'"
    echo ""
    echo "  3. Start Hermes Agent:"
    echo "     hermes gateway start"
    echo ""
    echo "  4. Check GPU usage:"
    echo "     watch -n 1 nvidia-smi"
    echo ""
    echo "  Installed Models:"
    ollama list 2>/dev/null | tail -n +2 | while read -r line; do
        echo "    - $line"
    done
    echo ""
}

# Run
main "$@"
