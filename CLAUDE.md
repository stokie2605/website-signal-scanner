# CLAUDE.md

This file is lightweight project memory for AI-assisted work on Website Signal Scanner.
It is documentation only and does not affect the application runtime.

## 1. Git Workflow

- Main branch: `main`
- Commit style: short, practical messages that describe the user-facing change.
- Push policy: push only after checks pass.
- Avoid unrelated cleanup while working on a focused change.

## 2. Project Purpose

Website Signal Scanner is a local portfolio/practice tool that turns public homepage URLs into practical first-pass audit notes.
It checks HTML structure, local SEO basics, accessibility signals, contact clarity, screenshot-based visual issues, and sampled link health.

The project should stay recruiter-friendly:

- Present it as a technical audit assistant and portfolio project.
- Avoid commercial outreach, pricing, agency, or freelance-sales language.
- Keep safe-use messaging visible and clear.

## 3. Decisions

- Use plain Node.js and browser assets instead of adding a frontend framework.
- Keep scanning local-first and free by default.
- Respect `robots.txt` and keep public homepage safe mode enabled by default.
- Cap batch scans to avoid aggressive crawling.
- Treat generated recommendations as first-pass signals, not professional/legal guarantees.

## 4. Session Mode

- For multi-file changes, explain the intent before editing.
- Run `npm run check` before committing code changes.
- Do not introduce paid APIs or network discovery features without an explicit decision.
- Do not weaken safe scanning defaults.
- Keep UI copy plain, technical, and portfolio-safe.

## 5. Current State

### What got done

- Built a local website audit scanner with URL extraction, homepage checks, screenshots, sampled broken-link checks, local SEO checks, accessibility quick-pass checks, and exportable reports.
- Added legal-safe defaults: `robots.txt` respect, safe-mode filtering, max 10 URLs per scan, and polite scan delay.
- Refined the visual design into a cleaner light SaaS-style dashboard.
- Added an audit workspace and improved report preview layout.

### Where things stand

- App runs locally with `npm start`.
- Main check command is `npm run check`.
- GitHub repository is `stokie2605/website-signal-scanner`.

### Next

- Add saved scan history or a cleaner report/PDF template if the project continues.

### Blocked on

- Nothing.
