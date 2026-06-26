# Let's Encrypt SSL Setup for Hermes Deployments

Comprehensive guide for configuring SSL/TLS certificates for the Hermes Agent
ecosystem (gateway + relay) on Ubuntu/WSL2. Covers both Let's Encrypt
(production) and self-signed (local) certificates.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Certbot Installation](#certbot-installation)
3. [Certificate Generation](#certificate-generation)
4. [DNS Challenge Setup](#dns-challenge-setup)
5. [Automatic Renewal](#automatic-renewal)
6. [Integration with Hermes Gateway](#integration-with-hermes-gateway)
7. [Self-Signed Cert Fallback](#self-signed-cert-fallback)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The Hermes ecosystem uses TLS in two places:

| Component | Port | Cert Source | Env Vars |
|-----------|------|-------------|----------|
| Hermes API Server (Gateway) | 8642 | Config `ssl_cert` / `ssl_key` | `HERMES_SSL_CERT`, `HERMES_SSL_KEY` |
| Hermes Relay (WSS bridge) | 8767 | `hermes-relay/certs/` | `RELAY_SSL_CERT`, `RELAY_SSL_KEY` |

Both components expect PEM-encoded certificate and key files. The relay
auto-detects SSL mode: if `RELAY_SSL_CERT` is set and the file exists, it
serves WSS; otherwise it falls back to plain WS.

```
┌─────────────────────────────────────────────────────┐
│  Host (Ubuntu / WSL2)                               │
│                                                     │
│  ┌──────────────┐  :8642  ┌──────────────────────┐ │
│  │ Hermes API   │◄───────►│  Let's Encrypt cert  │ │
│  │ (gateway)    │  TLS    │  /etc/letsencrypt/   │ │
│  └──────────────┘         └──────────────────────┘ │
│                                                     │
│  ┌──────────────┐  :8767  ┌──────────────────────┐ │
│  │ Hermes Relay │◄───────►│  RELAY_SSL_CERT      │ │
│  │ (WSS bridge) │  TLS    │  RELAY_SSL_KEY       │ │
│  └──────────────┘         └──────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Certbot Installation

### Ubuntu / WSL2

```bash
# Update package lists
sudo apt update

# Install certbot and DNS plugins
sudo apt install -y certbot python3-certbot-dns-cloudflare

# Verify installation
certbot --version
```

### WSL2-Specific Notes

- WSL2 shares the host's network interface — port 80/443 are accessible from
  the outside world if the Windows firewall allows it.
- If running behind a NAT/router, use DNS challenge (see below) instead of
  HTTP-01.
- Certbot stores certificates in `/etc/letsencrypt/live/<domain>/` which is
  on the WSL2 ext4 filesystem — no Windows filesystem performance penalty.

### Snap Installation (Alternative)

If your distro doesn't have certbot packages:

```bash
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
```

---

## Certificate Generation

### Option A: HTTP-01 Challenge (Port 80 Required)

Best when your host has a public IP and port 80 is open:

```bash
# Single domain
sudo certbot certonly --standalone \
  -d pb-legion-1.tail587e7c.ts.net \
  --preferred-challenges http

# Multiple domains (SAN cert)
sudo certbot certonly --standalone \
  -d pb-legion-1.tail587e7c.ts.net \
  -d hermes.example.com \
  --preferred-challenges http
```

### Option B: DNS-01 Challenge (No Port Required)

Best for hosts behind NAT, Tailscale, or when port 80 is unavailable:

```bash
# Using Cloudflare DNS plugin
sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d pb-legion-1.tail587e7c.ts.net \
  --preferred-challenges dns
```

### Option C: Tailscale + Tailscale Certificates

If you're on a Tailscale network, you can use Tailscale's built-in Let's
Encrypt integration (no certbot needed):

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Get a certificate for your Tailscale hostname
tailscale cert pb-legion-1.tail587e7c.ts.net

# Certs are stored in:
#   ~/pb-legion-1.tail587e7c.ts.net.crt
#   ~/pb-legion-1.tail587e7c.ts.net.key
```

This is the simplest option for Tailscale-hosted Hermes deployments.

---

## DNS Challenge Setup

### Cloudflare DNS Plugin

1. **Get Cloudflare API token:**
   - Log in to [dash.cloudflare.com](https://dash.cloudflare.com)
   - Go to My Profile → API Tokens → Create Token
   - Use template "Edit zone DNS" → include your zone
   - Save the token securely

2. **Create credentials file:**

```bash
sudo mkdir -p /etc/letsencrypt
sudo tee /etc/letsencrypt/cloudflare.ini << 'EOF'
dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN_HERE
EOF
sudo chmod 600 /etc/letsencrypt/cloudflare.ini
```

3. **Generate certificate:**

```bash
sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d your-domain.com \
  --preferred-challenges dns
```

### Other DNS Providers

Certbot supports many DNS plugins:

| Provider | Plugin | Install |
|----------|--------|---------|
| Cloudflare | `python3-certbot-dns-cloudflare` | `apt install` |
| Route53 | `python3-certbot-dns-route53` | `pip install` |
| Google Cloud DNS | `python3-certbot-dns-google` | `pip install` |
| DigitalOcean | `python3-certbot-dns-digitalocean` | `pip install` |
| Linode | `python3-certbot-dns-linode` | `pip install` |

---

## Automatic Renewal

### Method 1: Systemd Timer (Recommended)

```bash
# Create the timer unit
sudo tee /etc/systemd/system/certbot-renew.service << 'EOF'
[Unit]
Description=Certbot Renewal
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet --deploy-hook "systemctl restart hermes-relay"
User=root
EOF

sudo tee /etc/systemd/system/certbot-renew.timer << 'EOF'
[Unit]
Description=Run certbot renewal twice daily

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable --now certbot-renew.timer
```

### Method 2: Cron Job

```bash
# Edit root crontab
sudo crontab -e

# Add this line (runs twice daily at random time)
0 3,15 * * * /usr/bin/certbot renew --quiet --deploy-hook "systemctl restart hermes-relay"
```

### Method 3: User Systemd Timer (No Root)

For WSL2 user-level renewal (when certbot was installed via snap):

```bash
mkdir -p ~/.config/systemd/user

tee ~/.config/systemd/user/certbot-renew.service << 'EOF'
[Unit]
Description=Certbot Renewal

[Service]
Type=oneshot
ExecStart=/snap/bin/certbot renew --quiet
EOF

tee ~/.config/systemd/user/certbot-renew.timer << 'EOF'
[Unit]
Description=Run certbot renewal twice daily

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now certbot-renew.timer
```

### Renewal Verification

```bash
# Check timer status
systemctl list-timers certbot-renew.timer

# Test renewal (dry run)
sudo certbot renew --dry-run

# View renewal logs
journalctl -u certbot-renew.service -f
```

---

## Integration with Hermes Gateway

### Hermes Relay Configuration

The Hermes Relay reads SSL certificate paths from environment variables.
Configure in the systemd service:

```bash
# Edit the relay service
systemctl --user edit hermes-relay.service
```

Add or update the `[Service]` section:

```ini
[Service]
Environment="RELAY_SSL_CERT=%h/.hermes/hermes-relay/certs/cert.pem"
Environment="RELAY_SSL_KEY=%h/.hermes/hermes-relay/certs/key.pem"
```

### Deploying Let's Encrypt Certs to Relay

After obtaining certificates, symlink or copy them to the relay's cert
directory:

```bash
# Create relay cert directory
mkdir -p ~/.hermes/hermes-relay/certs

# Option 1: Symlink (auto-updates on renewal)
sudo ln -sf /etc/letsencrypt/live/pb-legion-1.tail587e7c.ts.net/fullchain.pem \
  ~/.hermes/hermes-relay/certs/cert.pem
sudo ln -sf /etc/letsencrypt/live/pb-legion-1.tail587e7c.ts.net/privkey.pem \
  ~/.hermes/hermes-relay/certs/key.pem

# Option 2: Copy (requires manual update after renewal)
sudo cp /etc/letsencrypt/live/pb-legion-1.tail587e7c.ts.net/fullchain.pem \
  ~/.hermes/hermes-relay/certs/cert.pem
sudo cp /etc/letsencrypt/live/pb-legion-1.tail587e7c.ts.net/privkey.pem \
  ~/.hermes/hermes-relay/certs/key.pem
```

### Auto-Renewal Deploy Hook

Create a deploy hook that copies renewed certs and restarts the relay:

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/hermes-relay.sh << 'EOF'
#!/bin/bash
# Deploy hook: copy renewed certs to relay and restart
RELAY_CERTS="$HOME/.hermes/hermes-relay/certs"
DOMAIN="pb-legion-1.tail587e7c.ts.net"

for domain in $RENEWED_DOMAINS; do
    if [ "$domain" = "$DOMAIN" ]; then
        cp "$RENEWED_LINEAGE/fullchain.pem" "$RELAY_CERTS/cert.pem"
        cp "$RENEWED_LINEAGE/privkey.pem" "$RELAY_CERTS/key.pem"
        chmod 600 "$RELAY_CERTS/key.pem"
        systemctl --user restart hermes-relay.service
        echo "[$(date)] Renewed cert for $domain and restarted relay" >> /var/log/certbot-renewal.log
    fi
done
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/hermes-relay.sh
```

### Hermes API Server (Gateway) SSL

For the main Hermes gateway, SSL is configured in `~/.hermes/config.yaml`:

```yaml
gateway:
  api_server:
    ssl_cert: /etc/letsencrypt/live/pb-legion-1.tail587e7c.ts.net/fullchain.pem
    ssl_key: /etc/letsencrypt/live/pb-legion-1.tail587e7c.ts.net/privkey.pem
```

Or via environment variables in `~/.hermes/.env`:

```bash
HERMES_SSL_CERT=/etc/letsencrypt/live/pb-legion-1.tail587e7c.ts.net/fullchain.pem
HERMES_SSL_KEY=/etc/letsencrypt/live/pb-legion-1.tail587e7c.ts.net/privkey.pem
```

---

## Self-Signed Cert Fallback

For local-only deployments (LAN, localhost, development), generate a
self-signed certificate:

```bash
#!/bin/bash
set -euo pipefail

CERT_DIR="$HOME/.hermes/hermes-relay/certs"
mkdir -p "$CERT_DIR"

# Generate self-signed cert (valid 365 days)
openssl req -x509 -newkey rsa:4096 \
  -keyout "$CERT_DIR/key.pem" \
  -out "$CERT_DIR/cert.pem" \
  -days 365 \
  -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:pb-legion-1.tail587e7c.ts.net,IP:127.0.0.1"

# Set permissions
chmod 600 "$CERT_DIR/key.pem"
chmod 644 "$CERT_DIR/cert.pem"

echo "Self-signed certificate generated at $CERT_DIR/"
echo "  cert.pem: $(openssl x509 -in $CERT_DIR/cert.pem -noout -subject)"
echo "  Expires:   $(openssl x509 -in $CERT_DIR/cert.pem -noout -enddate | cut -d= -f2)"
```

### When to Use Self-Signed

| Scenario | Recommendation |
|----------|---------------|
| Local development | Self-signed |
| LAN-only access (trusted network) | Self-signed or Tailscale certs |
| Tailscale network | `tailscale cert` (free, auto-renews) |
| Public internet | Let's Encrypt |

### Client Configuration

Clients connecting to a self-signed relay need to skip TLS verification
or trust the CA:

```bash
# curl: skip verification
curl -k https://pb-legion-1.tail587e7c.ts.net:8767/health

# Or trust the cert
sudo cp cert.pem /usr/local/share/ca-certificates/hermes-relay.crt
sudo update-ca-certificates
```

---

## Security Best Practices

### Key Permissions

```bash
# Private keys: owner read-only
chmod 600 ~/.hermes/hermes-relay/certs/key.pem
chmod 600 /etc/letsencrypt/live/*/privkey.pem

# Certificates: world-readable (services need to read them)
chmod 644 ~/.hermes/hermes-relay/certs/cert.pem
chmod 644 /etc/letsencrypt/live/*/fullchain.pem

# Cloudflare credentials: root-only
chmod 600 /etc/letsencrypt/cloudflare.ini
```

### Certificate Monitoring

Set up expiry monitoring:

```bash
# Check cert expiry
echo | openssl s_client -servername pb-legion-1.tail587e7c.ts.net \
  -connect pb-legion-1.tail587e7c.ts.net:8767 2>/dev/null | \
  openssl x509 -noout -dates

# Automated check (add to cron)
#!/bin/bash
EXPIRY=$(echo | openssl s_client -servername "$1" -connect "$1:8767" 2>/dev/null | \
  openssl x509 -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
if [ "$DAYS_LEFT" -lt 14 ]; then
    echo "WARNING: Certificate for $1 expires in $DAYS_LEFT days!" | \
      mail -s "Hermes cert expiry warning" admin@example.com
fi
```

### Auto-Renewal Monitoring

```bash
# Check certbot timer is active
systemctl is-active certbot-renew.timer

# Verify last renewal time
journalctl -u certbot-renew.service --no-pager -n 5

# Test renewal without actually renewing
sudo certbot renew --dry-run
```

### Firewall Rules

```bash
# Allow WSS (WebSocket Secure) through firewall
sudo ufw allow 8767/tcp

# If using HTTP-01 challenge
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Certificate Rotation Checklist

When rotating certificates:

1. [ ] Generate new certificate (or trigger renewal)
2. [ ] Copy/symlink to relay cert directory
3. [ ] Restart relay: `systemctl --user restart hermes-relay`
4. [ ] Verify relay is serving WSS: `curl -k https://localhost:8767/health`
5. [ ] Re-pair Android app (if cert fingerprint changed)
6. [ ] Update any other clients using the old cert
7. [ ] Set reminder for next expiry (90 days for Let's Encrypt)

---

## Troubleshooting

### "No SSL cert/key configured" Warning

The relay prints this when `RELAY_SSL_CERT` or `RELAY_SSL_KEY` is not set,
or the files don't exist. Solutions:

```bash
# Verify env vars are set
systemctl --user show-environment | grep RELAY_SSL

# Verify files exist
ls -la ~/.hermes/hermes-relay/certs/

# Restart relay after fixing
systemctl --user restart hermes-relay
```

### Certificate Renewal Fails

```bash
# Check renewal config
sudo certbot certificates

# Test specific domain renewal
sudo certbot renew --cert-name pb-legion-1.tail587e7c.ts.net --dry-run

# Check for rate limits
# Let's Encrypt allows 5 duplicate certificates per week
```

### WSL2 Clock Skew

Let's Encrypt requires accurate system time. WSL2 can drift:

```bash
# Sync time
sudo hwclock -s
# Or install ntp
sudo apt install -y chrony
```

### Relay Won't Start with SSL

Check the relay logs:

```bash
journalctl --user -u hermes-relay -n 50
```

Common issues:
- Key file permissions too open (must be 600 or 640)
- Certificate and key don't match: `openssl x509 -noout -modulus -in cert.pem | md5sum` vs `openssl rsa -noout -modulus -in key.pem | md5sum` (must be equal)
- Intermediate cert missing: use `fullchain.pem` not `cert.pem`

---

## Quick Reference

| Task | Command |
|------|---------|
| Install certbot | `sudo apt install certbot` |
| Generate cert (HTTP) | `sudo certbot certonly --standalone -d domain` |
| Generate cert (DNS) | `sudo certbot certonly --dns-cloudflare -d domain` |
| Tailscale cert | `tailscale cert hostname.ts.net` |
| Test renewal | `sudo certbot renew --dry-run` |
| Force renewal | `sudo certbot renew --force-renewal` |
| Check cert expiry | `echo \| openssl s_client -connect domain:8767 2>/dev/null \| openssl x509 -noout -enddate` |
| Restart relay | `systemctl --user restart hermes-relay` |
| Relay status | `systemctl --user status hermes-relay` |
| Relay logs | `journalctl --user -u hermes-relay -f` |
