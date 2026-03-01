# INTEGRATIONS.md — External Services & Integrations

## Overview

This project has no external API integrations at runtime. All external integrations are CI/CD focused, using GitHub-native tooling for automated testing and deployment.

---

## CI/CD — GitHub Actions

Workflows live in `.github/workflows/`. Two pipelines are active.

---

### 1. Deploy to GitHub Pages

**File:** `.github/workflows/deploy.yml`

**Trigger:**
- Push to `dev` branch
- Manual (`workflow_dispatch`)

**Permissions:** `contents: write` (needed to push to `gh-pages` branch)

**Pipeline steps:**

```
checkout → setup Node 20 → npm ci → npm run build → deploy to gh-pages
```

**Deployment target:** `gh-pages` branch, published via `peaceiris/actions-gh-pages@v3`

```yaml
- name: Deploy to gh-pages branch
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./dist
```

**Key details:**
- Uses `GITHUB_TOKEN` (built-in, no manual secret needed)
- Publishes `./dist` — the Vite build output
- Live URL after deploy: `https://<org>.github.io/emilian_game/`
- The `base: '/emilian_game/'` in `vite.config.ts` aligns with this path

---

### 2. Game Tests (Playwright E2E)

**File:** `.github/workflows/test.yml`

**Trigger:**
- Push to `dev` or `main` branches
- Pull requests targeting `main`

**Permissions:** `contents: read`

**Pipeline steps:**

```
checkout → setup Node 22 → npm ci → install Playwright (Firefox) → build → start dev server → run tests
```

**Test execution:**

```yaml
- name: Run game tests
  run: |
    npm run dev -- --port 5173 &
    sleep 5
    ./node_modules/.bin/playwright test --reporter=list
  env:
    CI: true
```

**Key details:**
- Installs only Firefox (`npx playwright install --with-deps firefox`)
- Starts the Vite dev server in background on port 5173, waits 5s, then runs tests
- Node version: 22 (vs 20 for deploy — note the discrepancy)
- On failure: uploads `playwright-report/` as an artifact, retained 7 days

---

## Deployment Architecture

```
dev branch push
      │
      ▼
GitHub Actions (deploy.yml)
      │
      ├─ npm ci
      ├─ npm run build  →  dist/
      │
      ▼
peaceiris/actions-gh-pages
      │
      ▼
gh-pages branch  →  GitHub Pages CDN
      │
      ▼
https://<org>.github.io/emilian_game/
```

---

## Secrets & Environment Variables

| Secret | Source | Used in |
|---|---|---|
| `GITHUB_TOKEN` | GitHub built-in | `deploy.yml` (gh-pages push) |
| `CI=true` | Hardcoded in workflow | `test.yml` (Playwright CI mode) |

No external API keys, webhook tokens, or third-party service credentials are used.

---

## External Services Summary

| Service | Purpose | Auth |
|---|---|---|
| GitHub Pages | Static hosting | `GITHUB_TOKEN` (auto) |
| GitHub Actions | CI/CD runner | GitHub-native |

**No external services at runtime.** The game is entirely self-contained — no analytics, no backend, no CDN assets, no third-party APIs called from the browser.

---

## Node Version Notes

There is a version mismatch between the two workflows:

| Workflow | Node Version |
|---|---|
| `deploy.yml` | 20 |
| `test.yml` | 22 |

This is unlikely to cause issues with current dependencies but worth aligning for consistency.
