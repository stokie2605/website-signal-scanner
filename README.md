# Website Signal Scanner
> **The 1-Line Mission:** Local-first CLI crawler that audits public homepages for search engine visibility, accessibility compliance, and structural performance.

### ⚡ Engineering Breakdown
* **The Problem:** Freelance developers and digital agencies spend hours running manual page audits or configuring bloated SaaS crawlers just to generate prospective sales reports.
* **The Solution:** A lightweight Node utility utilizing Playwright to extract key SEO/accessibility signals, map resource response codes, capture screenshots, and export custom report summaries.
* **The Tech Stack:** `Node.js` `Playwright` `JavaScript`

---

## 🎥 Visual Preview
![Website Signal Scanner Desktop Preview](screenshots/627ec38f0cbc-desktop.png)

---

## ⚙️ Features & Crawler Logic
*   **Playwright Engine Integration:** Boots a headless Chromium browser instance to load and parse public homepages.
*   **Metric Extraction:** Validates meta tags, inspects image alt properties, checks heading hierarchy, and evaluates WAI-ARIA landmark elements.
*   **Link Status Verification:** Samples outbound links to confirm HTTP 200 response codes and flag broken references.
*   **Automated Screenshot Capture:** Saves visual representations of desktop viewports for client review.
