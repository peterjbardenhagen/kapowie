---
name: aito-test
description: "AITO (AI Test Orchestrator) security scanning — hands off to OpenClaw on pb-legion for PowerShell and Docker-based vulnerability scanning"
version: 1.0.0
tags: [security, testing, aito, openclaw, powershell, docker]
---

# AITO Test — Security Scanning via OpenClaw

## What is AITO?

AITO (AI Test Orchestrator) is an automated security testing platform that runs industry-standard open-source security, quality, and performance tools via Docker containers. It provides 29+ test suites including OWASP ZAP, Nuclei, k6, Playwright, and Semgrep.

## Architecture

```
Hermes (orchestrator) → OpenClaw (pb-legion Windows) → AITO (PowerShell + Docker)
                                                          ↓
                                                    29+ Security Tools
                                                          ↓
                                                    HTML Reports → Obsidian → Email
```

## Trigger

Use this skill when:
- User says "run AITO scan" or "AITO test"
- User asks for security vulnerability scan on a URL
- User wants to test infrastructure security
- Running the `aito-test` cron job

## Workflow

### Phase 1: Prepare

1. **Identify target URL** — What are we scanning?
2. **Check pb-legion availability** — Verify OpenClaw gateway is reachable:
   ```bash
   curl -s http://100.79.214.107:18789/health 2>/dev/null || echo "pb-legion unreachable"
   ```
3. **Verify AITO is installed** on pb-legion:
   ```
   dir "C:\Users\PeterBardenhagen\development\testlight-projects\ai-pen-test.bardenhagen.xyz\platforms\windows\cybersec-audit.ps1"
   ```

### Phase 2: Delegate to OpenClaw

**IMPORTANT:** AITO scanning MUST run on the Windows host (pb-legion) because:
- It uses PowerShell scripts that require Windows
- Docker Desktop runs on Windows
- Some tools (Playwright, k6) need Windows-native binaries

**Delegation command:**
```
Delegate to OpenClaw with context:
- Target URL: <url>
- AITO project path: C:\Users\PeterBardenhagen\development\testlight-projects\ai-pen-test.bardenhagen.xyz
- Commands to run:
  1. cd <aito_path>
  2. .\platforms\windows\cybersec-audit.ps1 -TargetUrl "<url>"
  3. .\platforms\windows\load-testing.ps1 -TargetUrl "<url>"
- Save report to: <output_path>
- Email to: <recipient>
```

### Phase 3: AITO Commands Reference

#### Interactive Menu (Full Scan)
```powershell
cd C:\Users\PeterBardenhagen\development\testlight-projects\ai-pen-test.bardenhagen.xyz
.\test-manager.ps1
```

#### Individual Scans
```powershell
# Cybersecurity audit (OWASP ZAP, Nuclei, secrets, dependencies)
.\platforms\windows\cybersec-audit.ps1 -TargetUrl "https://example.com"

# Load testing (k6)
.\platforms\windows\load-testing.ps1 -TargetUrl "https://example.com"

# Playwright E2E
.\platforms\windows\run-playwright-e2e.ps1 -BaseUrl "https://example.com"

# Run ALL suites
.\platforms\windows\run-all.ps1 -TargetUrl "https://example.com"
```

#### Non-Interactive (CI/CD)
```powershell
.\platforms\windows\cybersec-audit.ps1 -TargetUrl "https://example.com" -NonInteractive
```

### Phase 4: Report Collection

AITO generates HTML reports in:
```
<aito_path>\reportdata\<host_or_repo>_<YYYYMMDD_HHMMSS>\index.html
```

After scan completes:
1. Read the latest report from `reportdata/`
2. Extract findings and format as markdown
3. Save to Obsidian vault under `Clients/`
4. Email to user via Composio Outlook

### Phase 5: Cleanup

After report is saved and emailed:
1. Clean up old report data (keep last 30 days)
2. Update Kanban board if applicable

## Configuration

| Setting | Value |
|---------|-------|
| AITO Path | `C:\Users\PeterBardenhagen\development\testlight-projects\ai-pen-test.bardenhagen.xyz` |
| Report Output | `<aito_path>\reportdata\` |
| Obsidian Vault | `/mnt/c/Users/PeterBardenhagen/OneDrive - digitalresponse.com.au/PB Private/Obsidian-PJB/PJB/` |
| Email Recipient | `peter@bardenhagen.xyz` |
| Email Account | `outlook_lippy-teleut` (Composio) |
| OpenClaw Gateway | `http://100.79.214.107:18789` |

| pb-legion Tailscale IP | `100.79.214.107` |
| pb-legion Hostname | `pb-legion` |

## Test Suites Available

| # | Suite | What It Tests |
|---|-------|--------------|
| 1 | SAST Analysis | Static code analysis (Semgrep) |
| 2 | DAST Scanning | Dynamic scanning (OWASP ZAP) |
| 3 | Secret Detection | GitLeaks, secret scanning |
| 4 | Dependency Scan | Snyk, npm audit, safety |
| 5 | SSL/TLS Audit | Certificate, cipher suites |
| 6 | Security Headers | HSTS, CSP, X-Frame-Options |
| 7 | Open Redirect | URL redirect vulnerabilities |
| 8 | XSS Scan | Cross-site scripting |
| 9 | SQL Injection | SQLi detection |
| 10 | CSRF Scan | Cross-site request forgery |
| 11 | Authentication | Auth bypass, session management |
| 12 | Access Control | Privilege escalation |
| 13 | API Security | REST/GraphQL API testing |
| 14 | LLM Security | Prompt injection, MCP validation |
| 15 | MCP Security | MCP tool validation |
| 16 | Database Security | MongoDB, Postgres, MySQL |
| 17 | Network Security | Nmap, port scanning |
| 18 | Container Security | Docker, Kubernetes |
| 19 | Compliance | GDPR, PCI-DSS, SOC2 |
| 20 | Performance | k6 load testing |
| 21 | Core Web Vitals | Lighthouse, page speed |
| 22 | Stress Testing | High-load stress testing |
| 23 | E2E Functional | Playwright end-to-end |
| 24 | Contract Testing | API contract validation |
| 25 | Chaos Engineering | Resilience testing |
| 26 | Visual Regression | Pixel-perfect UI testing |
| 27 | Accessibility | WCAG 2.1 AA compliance |
| 28 | SEO Audit | Search engine optimization |
| 29 | Mobile Testing | Responsive, mobile-specific |

## Pitfalls

- **Never run AITO from WSL** — It requires Windows PowerShell and Docker Desktop
- **Don't skip `-TargetUrl`** — Always specify the target
- **Check Docker is running** — AITO needs Docker Desktop on Windows
- **Reports take time** — Full scan can take 15-30 minutes
- **Disk space** — Each scan generates ~500MB of report data
- **OpenClaw timeout** — AITO scanning takes longer than OpenClaw's 15-min timeout; use the Kanban board to track progress

## Integration with Kanban

When running AITO scans, create Kanban tasks to track:

```
T1: Prepare AITO scan (this skill)
T2: Delegate to OpenClaw → Run cybersec-audit.ps1
T3: Delegate to OpenClaw → Run load-testing.ps1
T4: Collect and format report
T5: Save to Obsidian vault
T6: Email report to user
```

T2 and T3 can run in parallel. T4 depends on both. T5 depends on T4. T6 depends on T5.
