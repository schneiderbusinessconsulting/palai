---
name: security-audit
description: Security Audit — prüft Code auf OWASP Top 10, Secrets, Schwachstellen.
argument-hint: "[verzeichnis oder datei]"
user-invocable: true
---

Security Audit für: $ARGUMENTS

1. **Scan nach Secrets:**
   - API Keys, Tokens, Passwörter im Code
   - .env Dateien im Git
   - Hardcoded Credentials

2. **OWASP Top 10 Check:**
   | # | Vulnerability | Prüfe auf |
   |---|---|---|
   | A01 | Broken Access Control | Fehlende Auth-Checks, IDOR |
   | A02 | Cryptographic Failures | Schwache Hashes, HTTP statt HTTPS |
   | A03 | Injection | SQL, Command, XSS, Template Injection |
   | A04 | Insecure Design | Fehlende Rate Limits, Business Logic |
   | A05 | Security Misconfiguration | Debug Mode, Default Credentials |
   | A06 | Vulnerable Components | Veraltete Dependencies |
   | A07 | Auth Failures | Schwache Passwort-Regeln, fehlende MFA |
   | A08 | Data Integrity | Unsichere Deserialisierung |
   | A09 | Logging Failures | Fehlende Audit Logs |
   | A10 | SSRF | Unvalidierte URLs |

3. **Dependency Check:** Bekannte CVEs in dependencies
4. **Report:** Findings mit Severity + konkreten Fixes
