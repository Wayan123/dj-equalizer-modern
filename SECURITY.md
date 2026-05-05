# Security Policy

## Supported Reporting

Report:

- exposed secrets, keys, or credentials
- SSRF, path traversal, or unsafe file handling
- unsafe subprocess execution
- overly broad CORS, CSP, or asset protocol rules
- updater or download integrity issues

## How to Report

Do not open a public issue for a sensitive security problem. Use a private channel to the repository owner instead.

Include:

- affected file paths
- a short description of the impact
- reproduction steps if available
- whether the issue affects web, desktop, or both

## Data Handling

This project is intended to run locally. Avoid committing:

- personal media files
- API keys or tokens
- private update signing keys
- browser profiles, caches, or generated build output
