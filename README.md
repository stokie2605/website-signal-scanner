# Website Signal Scanner

A local website audit assistant that turns homepage URLs into practical technical, SEO, accessibility, link-health, screenshot, and visual improvement notes.

It is designed for quickly reviewing small business websites, portfolio targets, or public homepages before deciding whether a deeper manual audit is worth doing.

## Why Use It

Website Signal Scanner helps answer one simple question:

```text
Which of these websites looks like it has clear improvement opportunities?
```

It is useful when you have a short list of websites and want a fast first-pass review covering structure, contact clarity, local SEO basics, accessibility signals, mobile readiness, broken-link risk, and visible design issues.

## What It Checks

- HTTPS and response status
- Page title and meta description quality
- H1 and heading structure
- Mobile viewport metadata
- Image alt text coverage
- Contact links and call-to-action visibility
- Local wording and service/category signals
- Structured data hints
- Stale footer/copyright signals
- Initial HTML response time
- Sampled internal broken links
- Desktop and mobile screenshot previews
- Screenshot-based visual signals such as mobile overflow, weak above-the-fold copy, missing visual proof, small mobile text, and missing CTAs

## Tool Modules

| Module | What It Does |
| --- | --- |
| Website Signal Scanner | Scans pasted URLs and ranks improvement opportunities. |
| Audit Report Builder | Creates a copyable/downloadable/printable audit report from the selected result. |
| Competitor Comparator | Summarises best opportunity, fastest response, strongest local SEO signal, and broken-link risk across scanned sites. |
| Homepage Screenshot Archive | Stores desktop/mobile screenshots locally for each scanned URL. |
| Broken Link Checker | Samples internal links and flags links returning errors or timeouts. |
| Local SEO Checker | Checks service/category wording, local wording, contact route, schema hints, and readable domain signals. |
| Accessibility Quick Pass | Checks H1 structure, headings, image alt coverage, form label hooks, and accessible action names. |
| Local Lead Finder Workflow | Extracts URLs from pasted search-result text or manually collected URL lists for fast candidate scanning. |

## How It Works

1. Paste homepage URLs or copied search-result text.
2. Click **Scan URL**.
3. The tool extracts URLs, fetches each homepage, captures desktop/mobile screenshots, samples internal links, and ranks the results.
4. The highest-opportunity result automatically populates an editable audit report.
5. Copy the summary, export CSV, print/save PDF, or download a static HTML report.

## Run Locally

```bash
npm install
npm start
```

Then open:

```text
http://localhost:4177
```

## Best URLs To Scan

Use public homepages:

```text
https://example-business.co.uk
https://another-local-company.com
```

Avoid private or low-value pages such as tracking links, checkout pages, login pages, account pages, and admin routes.


## Safe Use Defaults

The scanner is designed to stay free and polite by default:

- Respects `robots.txt` before scanning public pages or sampled internal links.
- Public homepage safe mode skips login, account, admin, checkout, payment, order, tracking, and private-looking URLs.
- Caps each batch at 10 URLs.
- Adds a short delay between scans instead of hammering websites.
- Runs locally with no paid APIs required.

Use it for public homepages and first-pass portfolio-style audits. Do not use it to bypass access controls, scrape private areas, collect personal data, or republish site content. This is practical engineering guidance, not legal advice.
## Project Scope

This is a portfolio/practice tool, not a replacement for a full professional audit. It gives a fast first-pass signal review and helps generate starting recommendations. A human should still review brand fit, content quality, conversion intent, and business context.

## Possible Next Steps

- Add deeper Lighthouse performance/accessibility scoring
- Add full-site crawling with configurable depth
- Add PDF generation server-side
- Add saved scan history
- Add Google Places or search API discovery with cost controls
- Add AI-assisted copy rewrite suggestions

## License

MIT License. See [LICENSE](./LICENSE).
