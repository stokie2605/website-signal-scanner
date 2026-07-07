# Website Signal Scanner

A local website audit assistant that turns homepage URLs into practical technical and visual improvement notes.

It is designed for quickly reviewing small business websites, portfolio targets, or public homepages before deciding whether a deeper manual audit is worth doing.

## Why Use It

Website Signal Scanner helps answer one simple question:

```text
Which of these websites looks like it has clear improvement opportunities?
```

It is useful when you have a short list of websites and want a fast first-pass review covering structure, contact clarity, local SEO basics, accessibility signals, mobile readiness, and visible design issues.

## What It Checks

- HTTPS and response status
- Page title and meta description quality
- H1 and heading structure
- Mobile viewport metadata
- Image alt text coverage
- Contact links and call-to-action visibility
- Local wording and service-area signals
- Stale footer/copyright signals
- Initial HTML response time
- Desktop and mobile screenshot previews
- Screenshot-based visual signals such as mobile overflow, weak above-the-fold copy, missing visual proof, small mobile text, and missing CTAs

## How It Works

1. Paste one homepage URL per line.
2. Click **Scan URL**.
3. The tool fetches each homepage, captures desktop/mobile screenshots, and ranks the results.
4. The highest-opportunity result automatically populates an editable audit report.
5. Copy the summary or download a static HTML report.

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

## Project Scope

This is a portfolio/practice tool, not a replacement for a full professional audit. It gives a fast first-pass signal review and helps generate starting recommendations. A human should still review brand fit, content quality, conversion intent, and business context.

## Possible Next Steps

- Add Lighthouse performance/accessibility scoring
- Add broken-link crawling
- Add CSV import/export for URL lists
- Add PDF report export
- Add Google Places or search API discovery
- Add AI-assisted copy rewrite suggestions
- Add historical scan storage

## License

MIT License. See [LICENSE](./LICENSE).
