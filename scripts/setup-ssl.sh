#!/usr/bin/env bash
#
# setup-ssl.sh — SSL certificate setup for Hermes deployments
#
# Supports two modes:
#   self-signed  — Generate self-signed cert for local/LAN use (default)
#   letsencrypt  — Obtain Let's Encrypt cert via DNS or HTTP challenge
#
# Idempotent: safe to run multiple times. Existing certs are preserved
# unless --force is passed.
#
# Usage:
#   ./scripts/setup-ssl.sh                    # Self-signed mode (default)
#   ./scripts/setup-ssl.sh --mode letsencrypt --domain example.com
#   ./scripts/setup-ssl.sh --mode letsencrypt --domain example.com --dns cloudflare
#   ./scripts/setup-ssl.sh --mode tailscale    # Use Tailscale certs
#   ./scripts/setup-ssl.sh --force             # Regenerate even if certs exist
#   ./scripts/setup-ssl.sh --deploy            # Also restart relay service
#

set -euo pipefail

# ============================================================
# Configuration
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Certificate locations
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
RELAY_CERTS="$HERMES_HOME/hermes-relay/certs"
LE_CERTS="/etc/letsencrypt/live"

# Defaults
MODE="self-signed"
DOMAIN=""
DNS_PROVIDER="cloudflare"
FORCE=false
DEPLOY=false
TAILSCALE_HOSTNAME=""
KEY_SIZE=4096
CERT_DAYS=365
LOG_FILE=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================
# Functions
# ============================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $*"
}

die() {
    log_error "$*"
    exit 1
}

# Check if running on supported OS
check_os() {
    if [[ ! -f /etc/debian_version ]] && [[ ! -f /etc/lsb-release ]]; then
        log_warn "This script targets Ubuntu/Debian. Proceed with caution."
    fi
}

# Parse command-line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --mode)
                MODE="$2"
                shift 2
                ;;
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --dns)
                DNS_PROVIDER="$2"
                shift 2
                ;;
            --tailscale-hostname)
                TAILSCALE_HOSTNAME="$2"
                shift 2
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --deploy)
                DEPLOY=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                die "Unknown option: $1 (see --help)"
                ;;
        esac
    done

    # Validate mode
    case "$MODE" in
        self-signed|letsencrypt|tailscale) ;;
        *) die "Invalid mode: $MODE (must be: self-signed, letsencrypt, or tailscale)" ;;
    esac

    # Validate domain for letsencrypt
    if [[ "$MODE" = "letsencrypt" && -z "$DOMAIN" ]]; then
        die "--domain is required for letsencrypt mode"
    fi

    # Validate tailscale hostname
    if [[ "$MODE" = "tailscale" && -z "$TAILSCALE_HOSTNAME" ]]; then
        die "--tailscale-hostname is required for tailscale mode"
    fi
}

show_help() {
    cat << 'EOF'
setup-ssl.sh — SSL certificate setup for Hermes deployments

USAGE:
    setup-ssl.sh [OPTIONS]

OPTIONS:
    --mode <mode>           Certificate mode: self-signed, letsencrypt, tailscale
                            (default: self-signed)
    --domain <domain>       Domain name for Let's Encrypt certificate
    --dns <provider>        DNS provider for DNS-01 challenge (default: cloudflare)
    --tailscale-hostname <hostname>
                            Tailscale hostname (e.g., foo.ts.net)
    --force                 Regenerate certificate even if one exists
    --deploy                Restart relay service after setup
    --help, -h              Show this help message

EXAMPLES:
    # Self-signed cert for local use
    ./scripts/setup-ssl.sh

    # Let's Encrypt via Cloudflare DNS
    ./scripts/setup-ssl.sh --mode letsencrypt --domain example.com --dns cloudflare

    # Let's Encrypt via HTTP-01 (port 80 must be open)
    ./scripts/setup-ssl.sh --mode letsencrypt --domain example.com --dns http

    # Tailscale certificate
    ./scripts/setup-ssl.sh --mode tailscale --tailscale-hostname foo.ts.net

    # Force regenerate and restart relay
    ./scripts/setup-ssl.sh --force --deploy
EOF
}

# Install certbot if not present
install_certbot() {
    if command -v certbot &>/dev/null; then
        log_info "certbot already installed: $(certbot --version 2>&1)"
        return 0
    fi

    log_step "Installing certbot..."

    if command -v snap &>/dev/null; then
        sudo snap install --classic certbot
        sudo ln -sf /snap/bin/certbot /usr/bin/certbot
    else
        sudo apt update -qq
        sudo apt install -y -qq certbot

        # Install DNS plugin if needed
        if [[ "$DNS_PROVIDER" = "cloudflare" ]]; then
            sudo apt install -y -qq python3-certbot-dns-cloudflare
        fi
    fi

    log_info "certbot installed: $(certbot --version 2>&1)"
}

# Generate self-signed certificate
setup_self_signed() {
    local cert_dir="$RELAY_CERTS"
    local cert_file="$cert_dir/cert.pem"
    local key_file="$cert_dir/key.pem"

    if [[ -f "$cert_file" && -f "$key_file" && "$FORCE" != true ]]; then
        log_info "Self-signed certificate already exists at $cert_dir/"
        log_info "  Use --force to regenerate."
        return 0
    fi

    log_step "Generating self-signed certificate..."

    # Create cert directory
    mkdir -p "$cert_dir"

    # Determine CN and SAN
    local cn="localhost"
    local san="DNS:localhost,DNS:pb-legion-1.tail587e7c.ts.net,IP:127.0.0.1"

    if [[ -n "$DOMAIN" ]]; then
        cn="$DOMAIN"
        san="DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1"
    fi

    # Generate key and certificate
    openssl req -x509 \
        -newkey "rsa:$KEY_SIZE" \
        -keyout "$key_file" \
        -out "$cert_file" \
        -days "$CERT_DAYS" \
        -nodes \
        -subj "/CN=$cn/O=Hermes/C=AU" \
        -addext "subjectAltName=$san" \
        -addext "extendedKeyUsage=serverAuth,clientAuth" \
        2>/dev/null

    # Set permissions
    chmod 600 "$key_file"
    chmod 644 "$cert_file"

    log_info "Self-signed certificate generated successfully."
    log_info "  Certificate: $cert_file"
    log_info "  Key:         $key_file"
    log_info "  Valid for:   $CERT_DAYS days"
    log_info "  CN:          $cn"

    # Show expiry
    local expiry
    expiry=$(openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | cut -d= -f2)
    log_info "  Expires:     $expiry"
}

# Setup Let's Encrypt certificate
setup_letsencrypt() {
    local cert_dir="$LE_CERTS/$DOMAIN"
    local le_cert="$cert_dir/fullchain.pem"
    local le_key="$cert_dir/privkey.pem"
    local relay_cert="$RELAY_CERTS/cert.pem"
    local relay_key="$RELAY_CERTS/key.pem"

    # Check if cert already exists and not forcing
    if [[ -f "$le_cert" && "$FORCE" != true ]]; then
        local days_left
        days_left=$(openssl x509 -in "$le_cert" -noout -enddate 2>/dev/null | cut -d= -f2)
        log_info "Let's Encrypt certificate for $DOMAIN already exists."
        log_info "  Use --force to force renewal."
    else
        install_certbot

        log_step "Obtaining Let's Encrypt certificate for $DOMAIN..."

        local cert_args=(
            --non-interactive
            --agree-tos
            --email="admin@${DOMAIN}"
            "-d" "$DOMAIN"
        )

        case "$DNS_PROVIDER" in
            cloudflare)
                cert_args+=(--dns-cloudflare)
                if [[ -f /etc/letsencrypt/cloudflare.ini ]]; then
                    cert_args+=(--dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini)
                else
                    log_warn "Cloudflare credentials not found at /etc/letsencrypt/cloudflare.ini"
                    log_warn "Create it with: dns_cloudflare_api_token = YOUR_TOKEN"
                    die "Missing Cloudflare credentials"
                fi
                ;;
            http)
                cert_args+=(--preferred-challenges http)
                ;;
            *)
                die "Unsupported DNS provider: $DNS_PROVIDER"
                ;;
        esac

        # Run certbot (may need sudo for port 80 binding)
        if [[ "$DNS_PROVIDER" = "http" ]]; then
            sudo certbot certonly "${cert_args[@]}" --standalone
        else
            sudo certbot certonly "${cert_args[@]}"
        fi

        log_info "Let's Encrypt certificate obtained successfully."
    fi

    # Copy/symlink to relay cert directory
    mkdir -p "$RELAY_CERTS"

    if [[ -f "$le_cert" ]]; then
        cp "$le_cert" "$relay_cert"
        cp "$le_key" "$relay_key"
        chmod 600 "$relay_key"
        chmod 644 "$relay_cert"
        log_info "Certificate copied to relay directory: $RELAY_CERTS/"
    else
        die "Let's Encrypt certificate not found at $le_cert"
    fi

    # Setup auto-renewal
    setup_renewal_hook
    setup_renewal_timer
}

# Setup Tailscale certificate
setup_tailscale() {
    local tailscale_cert="$TAILSCALE_HOSTNAME.crt"
    local tailscale_key="$TAILSCALE_HOSTNAME.key"
    local relay_cert="$RELAY_CERTS/cert.pem"
    local relay_key="$RELAY_CERTS/key.pem"

    # Check if tailscale is installed
    if ! command -v tailscale &>/dev/null; then
        log_step "Installing Tailscale..."
        curl -fsSL https://tailscale.com/install.sh | sh
    fi

    log_step "Obtaining Tailscale certificate for $TAILSCALE_HOSTNAME..."

    # Tailscale cert command
    tailscale cert "$TAILSCALE_HOSTNAME"

    # Find the generated certs
    local cert_path="$HOME/$tailscale_cert"
    local key_path="$HOME/$tailscale_key"

    if [[ ! -f "$cert_path" ]]; then
        die "Tailscale certificate not found at $cert_path"
    fi

    # Copy to relay directory
    mkdir -p "$RELAY_CERTS"
    cp "$cert_path" "$relay_cert"
    cp "$key_path" "$relay_key"
    chmod 600 "$relay_key"
    chmod 644 "$relay_cert"

    log_info "Tailscale certificate installed successfully."
    log_info "  Certificate: $relay_cert"
    log_info "  Key:         $relay_key"

    # Tailscale certs auto-renew 24h before expiry
    # Set up a daily check to refresh if needed
    setup_tailscale_renewal_check "$cert_path" "$key_path"
}

# Setup renewal hook for Let's Encrypt
setup_renewal_hook() {
    local hook_dir="/etc/letsencrypt/renewal-hooks/deploy"
    local hook_file="$hook_dir/hermes-relay.sh"

    if [[ -f "$hook_file" ]]; then
        log_info "Renewal hook already exists: $hook_file"
        return 0
    fi

    log_step "Setting up certbot renewal deploy hook..."

    sudo mkdir -p "$hook_dir"
    sudo tee "$hook_file" > /dev/null << HOOKEOF
#!/bin/bash
# Auto-generated by kapowie setup-ssl.sh
# Deploy hook: copy renewed certs to Hermes relay and restart
set -euo pipefail

RELAY_CERTS="$RELAY_CERTS"
DOMAIN="$DOMAIN"

for renewed_domain in \$RENEWED_DOMAINS; do
    if [ "\$renewed_domain" = "\$DOMAIN" ]; then
        cp "\$RENEWED_LINEAGE/fullchain.pem" "\$RELAY_CERTS/cert.pem"
        cp "\$RENEWED_LINEAGE/privkey.pem" "\$RELAY_CERTS/key.pem"
        chmod 600 "\$RELAY_CERTS/key.pem"
        # Restart relay if systemctl is available
        if command -v systemctl &>/dev/null; then
            systemctl --user restart hermes-relay.service 2>/dev/null || true
        fi
        logger "kapowie-ssl: Renewed cert for \$renewed_domain and restarted relay"
    fi
done
HOOKEOF
    sudo chmod +x "$hook_file"
    log_info "Renewal hook created: $hook_file"
}

# Setup systemd timer for certbot renewal
setup_renewal_timer() {
    local timer_service="/etc/systemd/system/certbot-renew.service"
    local timer_unit="/etc/systemd/system/certbot-renew.timer"

    if [[ -f "$timer_unit" ]]; then
        log_info "Certbot renewal timer already exists."
        return 0
    fi

    log_step "Setting up certbot renewal timer..."

    sudo tee "$timer_service" > /dev/null << 'EOF'
[Unit]
Description=Certbot Renewal
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet
User=root
EOF

    sudo tee "$timer_unit" > /dev/null << 'EOF'
[Unit]
Description=Run certbot renewal twice daily

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable --now certbot-renew.timer
    log_info "Certbot renewal timer enabled."
}

# Setup Tailscale cert renewal check
setup_tailscale_renewal_check() {
    local cert_path="$1"
    local key_path="$2"
    local check_script="$PROJECT_DIR/scripts/check-tailscale-cert.sh"

    log_step "Setting up Tailscale cert renewal check..."

    cat > "$check_script" << 'CHECKEOF'
#!/bin/bash
# Check Tailscale cert expiry and renew if < 24h remaining
set -euo pipefail

CERT_PATH="$HOME/${TAILSCALE_HOSTNAME}.crt"
RELAY_CERTS="$HOME/.hermes/hermes-relay/certs"

if [[ ! -f "$CERT_PATH" ]]; then
    echo "Tailscale cert not found: $CERT_PATH"
    exit 0
fi

EXPIRY_EPOCH=$(openssl x509 -in "$CERT_PATH" -noout -enddate 2>/dev/null | cut -d= -f2 | xargs -I{} date -d @{} +%s 2>/dev/null || echo 0)
NOW_EPOCH=$(date +%s)
SECONDS_LEFT=$(( EXPIRY_EPOCH - NOW_EPOCH ))
HOURS_LEFT=$(( SECONDS_LEFT / 3600 ))

if [[ $HOURS_LEFT -lt 24 ]]; then
    echo "Tailscale cert expires in ${HOURS_LEFT}h, renewing..."
    tailscale cert "$TAILSCALE_HOSTNAME"
    cp "$HOME/${TAILSCALE_HOSTNAME}.crt" "$RELAY_CERTS/cert.pem"
    cp "$HOME/${TAILSCALE_HOSTNAME}.key" "$RELAY_CERTS/key.pem"
    chmod 600 "$RELAY_CERTS/key.pem"
    echo "Tailscale cert renewed and deployed."
else
    echo "Tailscale cert valid for ${HOURS_LEFT}h, no action needed."
fi
CHECKEOF

    chmod +x "$check_script"

    # Add to crontab if not already present
    if ! crontab -l 2>/dev/null | grep -q "check-tailscale-cert"; then
        (crontab -l 2>/dev/null; echo "0 4 * * * $check_script >> /tmp/tailscale-cert-check.log 2>&1") | crontab -
        log_info "Tailscale cert check added to crontab (daily at 04:00)."
    else
        log_info "Tailscale cert check already in crontab."
    fi
}

# Configure Hermes relay to use the certificate
configure_relay() {
    local cert_file="$RELAY_CERTS/cert.pem"
    local key_file="$RELAY_CERTS/key.pem"

    log_step "Configuring Hermes relay to use SSL certificates..."

    # Verify cert and key match
    local cert_modulus key_modulus
    cert_modulus=$(openssl x509 -noout -modulus -in "$cert_file" 2>/dev/null | openssl md5)
    key_modulus=$(openssl rsa -noout -modulus -in "$key_file" 2>/dev/null | openssl md5)

    if [[ "$cert_modulus" != "$key_modulus" ]]; then
        die "Certificate and key do not match! Check your files."
    fi

    log_info "Certificate and key match verified."

    # Check if relay service exists
    if systemctl --user list-unit-files | grep -q "hermes-relay.service"; then
        # Update environment variables
        systemctl --user import-environment \
            RELAY_SSL_CERT="$cert_file" \
            RELAY_SSL_KEY="$key_file" 2>/dev/null || true

        log_info "Relay environment variables set."
    else
        log_warn "hermes-relay.service not found. Install it first."
        log_warn "Then run: systemctl --user start hermes-relay"
    fi
}

# Deploy: restart relay service
deploy_relay() {
    log_step "Deploying: restarting Hermes relay..."

    if systemctl --user list-unit-files | grep -q "hermes-relay.service"; then
        systemctl --user restart hermes-relay.service

        # Wait for service to start
        sleep 2

        if systemctl --user is-active hermes-relay.service &>/dev/null; then
            log_info "Hermes relay restarted successfully."
        else
            log_warn "Relay service may have failed to start. Check logs:"
            log_warn "  journalctl --user -u hermes-relay -n 20"
        fi
    else
        log_warn "hermes-relay.service not found. Skipping restart."
    fi
}

# Verify the setup
verify_setup() {
    local cert_file="$RELAY_CERTS/cert.pem"
    local key_file="$RELAY_CERTS/key.pem"

    log_step "Verifying SSL setup..."

    # Check files exist
    if [[ ! -f "$cert_file" ]]; then
        die "Certificate not found: $cert_file"
    fi
    if [[ ! -f "$key_file" ]]; then
        die "Private key not found: $key_file"
    fi

    # Check permissions
    local key_perms
    key_perms=$(stat -c %a "$key_file" 2>/dev/null || stat -f %Lp "$key_file" 2>/dev/null)
    if [[ "$key_perms" != "600" && "$key_perms" != "640" && "$key_perms" != "400" ]]; then
        log_warn "Key file permissions are $key_perms (recommended: 600)"
        log_warn "Fix with: chmod 600 $key_file"
    fi

    # Check cert/key match
    local cert_modulus key_modulus
    cert_modulus=$(openssl x509 -noout -modulus -in "$cert_file" 2>/dev/null | openssl md5)
    key_modulus=$(openssl rsa -noout -modulus -in "$key_file" 2>/dev/null | openssl md5)

    if [[ "$cert_modulus" == "$key_modulus" ]]; then
        log_info "Certificate and key match: OK"
    else
        die "Certificate and key DO NOT match!"
    fi

    # Show certificate info
    local subject expiry issuer
    subject=$(openssl x509 -in "$cert_file" -noout -subject 2>/dev/null | sed 's/subject=//')
    expiry=$(openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | cut -d= -f2)
    issuer=$(openssl x509 -in "$cert_file" -noout -issuer 2>/dev/null | sed 's/issuer=//')

    log_info "Certificate details:"
    log_info "  Subject: $subject"
    log_info "  Issuer:  $issuer"
    log_info "  Expires: $expiry"

    # Check relay status
    if systemctl --user is-active hermes-relay.service &>/dev/null; then
        log_info "Hermes relay: RUNNING"
    else
        log_info "Hermes relay: NOT RUNNING (start with: systemctl --user start hermes-relay)"
    fi

    echo ""
    log_info "SSL setup complete!"
    echo ""
    echo "  Certificate: $cert_file"
    echo "  Key:         $key_file"
    echo ""
    echo "  Relay env vars:"
    echo "    RELAY_SSL_CERT=$cert_file"
    echo "    RELAY_SSL_KEY=$key_file"
}

# Print summary of what will be done
print_summary() {
    echo ""
    echo "============================================"
    echo "  Hermes SSL Setup"
    echo "============================================"
    echo "  Mode:        $MODE"
    [[ -n "$DOMAIN" ]] && echo "  Domain:      $DOMAIN"
    [[ -n "$TAILSCALE_HOSTNAME" ]] && echo "  Tailscale:   $TAILSCALE_HOSTNAME"
    [[ -n "$DNS_PROVIDER" ]] && echo "  DNS:         $DNS_PROVIDER"
    echo "  Force:       $FORCE"
    echo "  Deploy:      $DEPLOY"
    echo "  Cert dir:    $RELAY_CERTS"
    echo "============================================"
    echo ""
}

# ============================================================
# Main
# ============================================================

main() {
    parse_args "$@"
    print_summary

    check_os

    case "$MODE" in
        self-signed)
            setup_self_signed
            ;;
        letsencrypt)
            setup_letsencrypt
            ;;
        tailscale)
            setup_tailscale
            ;;
    esac

    configure_relay

    if [[ "$DEPLOY" = true ]]; then
        deploy_relay
    fi

    verify_setup
}

main "$@"
