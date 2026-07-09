const defaults = {
  businessName: "Example Local Business",
  websiteUrl: "https://example.com",
  reviewContext:
    "Initial front-end review focused on mobile usability, contact clarity, accessibility basics, and local search structure.",
  scores: { mobile: 68, performance: 62, accessibility: 58, seo: 71 },
  checks: { title: true, headings: false, contact: true, mobile: false, alt: false, links: true },
  mainConcern:
    "The mobile contact journey could be clearer, and accessibility basics need a pass before the site feels polished on smaller screens.",
  recommendedFixes:
    "Add a visible call button near the top of the mobile layout.\nCheck heading order and form labels.\nCompress large images and remove unused visual assets.\nImprove contrast on muted text.\nAdd location/service wording to the page title and intro copy.",
};

const fields = {
  businessName: document.querySelector("#business-name"),
  websiteUrl: document.querySelector("#website-url"),
  reviewContext: document.querySelector("#review-context"),
  mainConcern: document.querySelector("#main-concern"),
  recommendedFixes: document.querySelector("#recommended-fixes"),
  scores: {
    mobile: document.querySelector("#mobile-score"),
    performance: document.querySelector("#performance-score"),
    accessibility: document.querySelector("#accessibility-score"),
    seo: document.querySelector("#seo-score"),
  },
  checks: {
    title: document.querySelector("#has-title"),
    headings: document.querySelector("#has-headings"),
    contact: document.querySelector("#has-contact"),
    mobile: document.querySelector("#has-mobile"),
    alt: document.querySelector("#has-alt"),
    links: document.querySelector("#has-links"),
  },
};

const outputs = {
  completion: document.querySelector("#completion-label"),
  businessName: document.querySelector("#report-title"),
  websiteUrl: document.querySelector("#report-url"),
  context: document.querySelector("#context-output"),
  concern: document.querySelector("#concern-output"),
  fixes: document.querySelector("#fixes-output"),
  checklist: document.querySelector("#checklist-output"),
  scoreSummary: document.querySelector("#score-summary"),
  scoreNumbers: {
    mobile: document.querySelector("#mobile-score-output"),
    performance: document.querySelector("#performance-score-output"),
    accessibility: document.querySelector("#accessibility-score-output"),
    seo: document.querySelector("#seo-score-output"),
  },
};

const scanner = {
  urls: document.querySelector("#scan-urls"),
  button: document.querySelector("#run-scan"),
  status: document.querySelector("#scan-status"),
  results: document.querySelector("#scan-results"),
  comparison: document.querySelector("#comparison-output"),
  respectRobots: document.querySelector("#respect-robots"),
  safeMode: document.querySelector("#safe-mode"),
};

const checkLabels = {
  title: "Clear page title and description",
  headings: "Logical heading structure",
  contact: "Contact route is easy to find",
  mobile: "Mobile viewport metadata present",
  alt: "Images have useful alt text",
  links: "Main links and buttons work",
};

let latestScanResults = [];
let selectedResult = null;

function safeText(text) {
  return String(text || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}


function extractUrls(text) {
  const matches = String(text || "").match(/https?:\/\/[^\s"'<>]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s"'<>]*)?/gi) || [];
  return [...new Set(matches.map((value) => value.replace(/[),.;]+$/, "")).map((value) => /^https?:\/\//i.test(value) ? value : `https://${value}`))];
}

function renderComparison(results) {
  const valid = results.filter((result) => !result.error);
  if (!valid.length) {
    scanner.comparison.innerHTML = "";
    return;
  }
  const highest = valid[0];
  const fastest = [...valid].sort((a, b) => a.elapsedMs - b.elapsedMs)[0];
  const bestSeo = [...valid].sort((a, b) => (b.localSeo?.score || 0) - (a.localSeo?.score || 0))[0];
  const mostBroken = [...valid].sort((a, b) => (b.brokenLinks?.brokenCount || 0) - (a.brokenLinks?.brokenCount || 0))[0];
  scanner.comparison.innerHTML = `<section class="comparison-grid" aria-label="Comparison summary">
    <article><span>Best opportunity</span><strong>${safeText(highest.title)}</strong><small>${highest.improvementScore} need score</small></article>
    <article><span>Fastest response</span><strong>${safeText(fastest.title)}</strong><small>${fastest.elapsedMs}ms HTML response</small></article>
    <article><span>Strongest local SEO</span><strong>${safeText(bestSeo.title)}</strong><small>${bestSeo.localSeo?.score ?? "n/a"}/100 local signal score</small></article>
    <article><span>Broken link risk</span><strong>${safeText(mostBroken.title)}</strong><small>${mostBroken.brokenLinks?.brokenCount || 0} sampled broken links</small></article>
  </section>`;
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportCsv() {
  if (!latestScanResults.length) return;
  const headers = ["title", "url", "opportunity", "improvementScore", "healthScore", "localSeo", "accessibility", "brokenLinks", "responseMs", "topFixes"];
  const rows = latestScanResults.filter((result) => !result.error).map((result) => [
    result.title,
    result.finalUrl || result.url,
    result.opportunity,
    result.improvementScore,
    result.healthScore,
    result.localSeo?.score,
    result.accessibility?.score,
    result.brokenLinks?.brokenCount || 0,
    result.elapsedMs,
    (result.fixes || []).slice(0, 5).join(" | "),
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "website-signal-scanner-results.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}
function getState() {
  return {
    businessName: fields.businessName.value.trim() || "Untitled website",
    websiteUrl: fields.websiteUrl.value.trim() || "No URL supplied",
    reviewContext: fields.reviewContext.value.trim(),
    mainConcern: fields.mainConcern.value.trim(),
    recommendedFixes: fields.recommendedFixes.value.trim(),
    scores: Object.fromEntries(Object.entries(fields.scores).map(([key, field]) => [key, Number(field.value)])),
    checks: Object.fromEntries(Object.entries(fields.checks).map(([key, field]) => [key, field.checked])),
  };
}

function setState(state, sourceResult = null) {
  selectedResult = sourceResult || selectedResult;
  fields.businessName.value = state.businessName;
  fields.websiteUrl.value = state.websiteUrl;
  fields.reviewContext.value = state.reviewContext;
  fields.mainConcern.value = state.mainConcern;
  fields.recommendedFixes.value = state.recommendedFixes;
  Object.entries(state.scores).forEach(([key, value]) => { fields.scores[key].value = value; });
  Object.entries(state.checks).forEach(([key, value]) => { fields.checks[key].checked = value; });
  render();
}

function completionPercent(state) {
  const completedChecks = Object.values(state.checks).filter(Boolean).length;
  const averageScore = Object.values(state.scores).reduce((total, value) => total + value, 0) / Object.values(state.scores).length;
  return Math.round((completedChecks / Object.keys(state.checks).length) * 50 + averageScore * 0.5);
}

function scoreClass(score) {
  if (score >= 75) return "pass";
  if (score >= 55) return "";
  return "warn";
}

function render() {
  const state = getState();
  outputs.businessName.textContent = state.businessName;
  outputs.websiteUrl.textContent = state.websiteUrl;
  outputs.context.textContent = state.reviewContext || "No review context added.";
  outputs.concern.textContent = state.mainConcern || "No concern added yet.";
  outputs.completion.textContent = `${completionPercent(state)}% report ready`;

  Object.entries(state.scores).forEach(([key, value]) => { outputs.scoreNumbers[key].textContent = value; });

  outputs.scoreSummary.innerHTML = Object.entries(state.scores).map(([key, value]) => {
    const label = key.replace(/^\w/, (letter) => letter.toUpperCase());
    return `<div class="metric"><strong class="${scoreClass(value)}">${value}</strong><span>${label}</span></div>`;
  }).join("");

  outputs.checklist.innerHTML = Object.entries(state.checks).map(([key, passed]) => {
    const status = passed ? "Pass" : "Needs review";
    const className = passed ? "pass" : "warn";
    return `<li><strong class="${className}">${status}:</strong> ${safeText(checkLabels[key])}</li>`;
  }).join("");

  const fixes = state.recommendedFixes.split("\n").map((fix) => fix.trim()).filter(Boolean);
  outputs.fixes.innerHTML = fixes.length ? fixes.map((fix) => `<li>${safeText(fix)}</li>`).join("") : "<li>No fixes added yet.</li>";
  document.querySelectorAll(".finding-row").forEach((row) => {
    const input = row.querySelector("input");
    row.classList.toggle("finding-pass", Boolean(input?.checked));
    row.classList.toggle("finding-warn", !input?.checked);
  });
}

function domainName(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function scanResultToState(result) {
  const failedKeys = new Set((result.checks || []).filter((check) => !check.passed).map((check) => check.key));
  const visualFixes = result.visualAudit?.recommendations || [];
  const allFixes = [...(result.fixes || []), ...visualFixes];
  const fixes = allFixes.length ? [...new Set(allFixes)].join("\n") : "No major fixes detected. Manually review visual quality, copy, and conversion flow.";
  const health = Number(result.healthScore || 50);
  return {
    businessName: result.title && result.title !== "No title found" ? result.title : domainName(result.finalUrl || result.url),
    websiteUrl: result.finalUrl || result.url,
    reviewContext: `Automatic HTML scan completed for ${domainName(result.finalUrl || result.url)}. The scanner checked SEO tags, headings, mobile viewport metadata, image alt coverage, contact routes, local wording, freshness signals, and initial HTML response time.`,
    mainConcern: result.error ? result.error : `${result.opportunity} improvement opportunity. Health score ${result.healthScore}/100 with ${result.fixes?.length || 0} priority fixes detected.`,
    recommendedFixes: fixes,
    scores: {
      mobile: failedKeys.has("viewport") ? Math.max(35, health - 18) : Math.min(95, health + 8),
      performance: failedKeys.has("speed") ? Math.max(30, health - 20) : Math.min(95, health + 5),
      accessibility: failedKeys.has("alt") || failedKeys.has("headings") ? Math.max(35, health - 15) : Math.min(92, health + 4),
      seo: failedKeys.has("title") || failedKeys.has("description") || failedKeys.has("h1") || failedKeys.has("local") ? Math.max(30, health - 18) : Math.min(94, health + 6),
    },
    checks: {
      title: !failedKeys.has("title") && !failedKeys.has("description"),
      headings: !failedKeys.has("headings") && !failedKeys.has("h1"),
      contact: !failedKeys.has("contact"),
      mobile: !failedKeys.has("viewport"),
      alt: !failedKeys.has("alt"),
      links: !failedKeys.has("status"),
    },
  };
}

function renderScanResults(results) {
  latestScanResults = results;
  if (!results.length) {
    scanner.results.innerHTML = "";
  scanner.comparison.innerHTML = "";
    return;
  }

  scanner.results.innerHTML = results.map((result, index) => {
    if (result.error) {
      return `<article class="result-card error"><div><p class="result-rank">${index + 1}</p><h3>${safeText(result.url)}</h3><p>${safeText(result.error)}</p></div></article>`;
    }
    const failed = result.checks.filter((check) => !check.passed).slice(0, 4);
    const visual = result.visualAudit;
    const visualItems = visual?.recommendations?.length ? visual.recommendations.map((item) => `<li>${safeText(item)}</li>`).join("") : "<li>No screenshot design issues detected by the automated checks.</li>";
    const screenshotMarkup = visual?.available ? `<div class="screenshot-strip"><a href="${safeText(visual.screenshots.desktop)}" target="_blank" rel="noreferrer"><img src="${safeText(visual.screenshots.desktop)}" alt="Desktop screenshot for ${safeText(result.title)}"></a><a href="${safeText(visual.screenshots.mobile)}" target="_blank" rel="noreferrer"><img src="${safeText(visual.screenshots.mobile)}" alt="Mobile screenshot for ${safeText(result.title)}"></a></div>` : `<p class="visual-note">${safeText(visual?.error || "Visual audit unavailable.")}</p>`;
    return `<article class="result-card">
      <div class="result-score"><strong>${result.improvementScore}</strong><span>need</span></div>
      <div class="result-body">
        <div class="result-title-row"><p class="result-rank">${index + 1}</p><h3>${safeText(result.title)}</h3><span>${safeText(result.opportunity)}</span></div>
        <p class="result-url">${safeText(result.finalUrl || result.url)}</p>
        <div class="result-meta"><span>Status ${result.status}</span><span>${result.elapsedMs}ms</span><span>${result.counts.imagesMissingAlt}/${result.counts.images} images missing alt</span><span>${result.counts.contactLinks} contact links</span><span>SEO ${result.localSeo?.score ?? "n/a"}</span><span>A11y ${result.accessibility?.score ?? "n/a"}</span><span>${result.brokenLinks?.brokenCount || 0} broken links</span></div>
        <ul>${failed.map((check) => `<li>${safeText(check.fix)}</li>`).join("") || "<li>No obvious HTML issues detected. Check visual design manually.</li>"}</ul>
        ${screenshotMarkup}
        <div class="visual-recs"><strong>Visual ideas</strong><ul>${visualItems}</ul></div>
      </div>
      <button class="use-result" type="button" data-index="${index}">Use in Report</button>
    </article>`;
  }).join("");
}

async function runScan() {
  const urls = extractUrls(scanner.urls.value);
  if (!urls.length) {
    scanner.status.textContent = "Add at least one URL first.";
    return;
  }

  scanner.button.disabled = true;
  const scanCount = Math.min(urls.length, 10);
  scanner.status.textContent = `Scanning ${scanCount} URL${scanCount === 1 ? "" : "s"} with safe options enabled...`;
  scanner.results.innerHTML = `<div class="loading-line">Fetching pages and checking HTML signals...</div>`;

  try {
    const response = await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls,
        respectRobots: scanner.respectRobots.checked,
        safeMode: scanner.safeMode.checked,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Scan failed.");
    renderScanResults(data.results || []);
    renderComparison(data.results || []);
    saveToHistory(data.results || []);
    renderHistory();
    const topResult = (data.results || []).find((result) => !result.error);
    if (topResult) setState(scanResultToState(topResult), topResult);
    scanner.status.textContent = `Scan complete: ${data.results?.length || 0} result${data.results?.length === 1 ? "" : "s"}. Report updated automatically.`;
  } catch (error) {
    scanner.status.textContent = error.message;
    scanner.results.innerHTML = `<div class="loading-line error-text">${safeText(error.message)}</div>`;
  } finally {
    scanner.button.disabled = false;
  }
}

function reportMarkup() {
  const state = getState();
  const result = selectedResult;
  const fixes = state.recommendedFixes.split("\n").map((fix) => fix.trim()).filter(Boolean);
  const moduleScores = result?.modules || {};
  const screenshots = result?.visualAudit?.available ? result.visualAudit.screenshots : null;
  const broken = result?.brokenLinks?.broken || [];
  const checkedLinksCount = result?.brokenLinks?.checkedCount || 0;
  const brokenLinksCount = result?.brokenLinks?.brokenCount || 0;

  const moduleCards = [
    ["Mobile Layout", state.scores.mobile, "Calculated based on mobile viewport rendering and sizing."],
    ["Performance", state.scores.performance, "Page HTML fetch speeds and response weight indicators."],
    ["Accessibility", state.scores.accessibility, "Heading structure, image alt tags, and input labels check."],
    ["Core SEO", state.scores.seo, "Metadata completeness, title keywords, and content headings."],
    ["Local Search Signals", result?.localSeo?.score ?? "n/a", "Location references, contact links, and local intent phrases."],
    ["Link Health", moduleScores.brokenLinks ?? "n/a", `Sampled checking of internal page-to-page links (${checkedLinksCount} scanned).`]
  ];

  const getScoreColorClass = (score) => {
    if (score === "n/a" || score === null) return "muted";
    if (score >= 75) return "pass";
    if (score >= 50) return "average";
    return "warn";
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeText(state.businessName)} - Website Signal Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
    
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --border: #e2e8f0;
      --primary: #3657f5;
      --primary-soft: #eff6ff;
      --emerald: #059669;
      --emerald-soft: #ecfdf5;
      --amber: #d97706;
      --amber-soft: #fffbeb;
      --red: #dc2626;
      --red-soft: #fef2f2;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Inter', sans-serif;
      color: var(--text);
      background: var(--bg);
      line-height: 1.6;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    
    h1, h2, h3, h4 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-weight: 700;
      margin-top: 0;
      letter-spacing: -0.02em;
    }

    main {
      width: min(1000px, calc(100% - 40px));
      margin: 0 auto;
      padding: 50px 0;
    }

    header {
      background: var(--surface);
      border: 1px solid var(--border);
      border-top: 6px solid var(--primary);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 28px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02), 0 8px 24px rgba(24,32,51,0.02);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 20px;
    }

    .header-main h1 { font-size: 32px; margin-bottom: 6px; color: var(--text); }
    .header-main .url { color: var(--primary); font-weight: 600; text-decoration: none; word-break: break-all; }
    .header-meta { text-align: right; font-size: 0.9rem; color: var(--muted); }
    .header-meta strong { color: var(--text); display: block; font-size: 1.1rem; }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 28px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02), 0 8px 24px rgba(24,32,51,0.02);
      page-break-inside: avoid;
    }

    .card h2 {
      font-size: 20px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
      margin-bottom: 20px;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .scores-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }

    .score-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      page-break-inside: avoid;
    }

    .score-badge {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 800;
      font-family: 'Plus Jakarta Sans', sans-serif;
      flex-shrink: 0;
    }

    .score-badge.pass { background: var(--emerald-soft); color: var(--emerald); border: 1px solid rgba(5,150,105,0.15); }
    .score-badge.average { background: var(--amber-soft); color: var(--amber); border: 1px solid rgba(217,119,6,0.15); }
    .score-badge.warn { background: var(--red-soft); color: var(--red); border: 1px solid rgba(220,38,38,0.15); }
    .score-badge.muted { background: #f1f5f9; color: #64748b; border: 1px solid var(--border); }

    .score-info { min-width: 0; }
    .score-info h3 { font-size: 15px; margin-bottom: 4px; color: var(--text); }
    .score-info p { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.4; }

    .pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .pill.pass { background: var(--emerald-soft); color: var(--emerald); }
    .pill.warn { background: var(--amber-soft); color: var(--amber); }

    .checklist-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 12px;
    }

    .checklist-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg);
    }

    .checklist-item.pass { border-left: 4px solid var(--emerald); }
    .checklist-item.warn { border-left: 4px solid var(--amber); }

    .checklist-item span.text { font-size: 14px; font-weight: 500; }

    .concern-text {
      font-size: 16px;
      line-height: 1.6;
      color: var(--text);
      border-left: 4px solid var(--primary);
      padding-left: 16px;
      margin: 0;
    }

    .fixes-list {
      padding-left: 20px;
      margin: 0;
    }
    
    .fixes-list li {
      margin-bottom: 12px;
      font-size: 15px;
      line-height: 1.5;
    }
    
    .fixes-list li::marker {
      color: var(--primary);
      font-weight: 700;
    }

    .screenshots-container {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 20px;
    }
    
    .screenshot-frame {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #f1f5f9;
      padding: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }
    
    .screenshot-frame img {
      width: 100%;
      display: block;
      border-radius: 6px;
      border: 1px solid var(--border);
      object-fit: cover;
      object-position: top;
    }
    
    .screenshot-frame.desktop img { height: 350px; }
    .screenshot-frame.mobile img { height: 350px; }

    .broken-links-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      margin-top: 10px;
    }
    
    .broken-links-table th, .broken-links-table td {
      border: 1px solid var(--border);
      padding: 10px 12px;
      text-align: left;
    }
    
    .broken-links-table th {
      background: var(--bg);
      font-weight: 600;
    }

    .broken-links-table tr.error-row td {
      background: var(--red-soft);
    }

    @media (max-width: 768px) {
      header { flex-direction: column; text-align: left; padding: 20px; }
      .header-meta { text-align: left; }
      .screenshots-container { grid-template-columns: 1fr; }
      .checklist-list { grid-template-columns: 1fr; }
      main { padding: 20px 0; }
    }

    @media print {
      body { background: white; color: black; font-size: 12pt; }
      main { width: 100%; padding: 0; }
      header { border-top: 4px solid var(--primary); border-radius: 0; box-shadow: none; border-color: #000; padding: 15px; margin-bottom: 20px; }
      .card { border-radius: 0; box-shadow: none; border-color: #ccc; padding: 15px; margin-bottom: 20px; page-break-inside: avoid; }
      .score-badge { border-color: #000 !important; color: black !important; background: transparent !important; }
      .score-badge.pass, .score-badge.average, .score-badge.warn { border: 1px solid #000 !important; }
      .pill { border: 1px solid #000 !important; color: black !important; background: transparent !important; }
      .checklist-item { border-left-color: #000 !important; background: transparent !important; }
      .screenshot-frame { background: transparent !important; box-shadow: none !important; }
      .screenshot-frame.desktop img, .screenshot-frame.mobile img { height: 260px; }
      .page-break { page-break-before: always; }
      a { text-decoration: underline; color: black; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="header-main">
        <p style="margin:0 0 4px; font-weight:700; color:var(--muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em;">Website Technical Signal Audit</p>
        <h1>${safeText(state.businessName)}</h1>
        <a href="${safeText(state.websiteUrl)}" target="_blank" rel="noopener" class="url">${safeText(state.websiteUrl)}</a>
      </div>
      <div class="header-meta">
        <strong>Technical Health Audit</strong>
        <span>Generated: ${new Date().toLocaleDateString()}</span>
      </div>
    </header>

    <div class="card">
      <h2>Technical Performance & Accessibility Overview</h2>
      <div class="scores-grid">
        ${moduleCards.map(([label, score, desc]) => `
          <div class="score-card">
            <div class="score-badge ${getScoreColorClass(score)}">${safeText(score)}</div>
            <div class="score-info">
              <h3>${safeText(label)}</h3>
              <p>${safeText(desc)}</p>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="card">
      <h2>Review Context & Parameters</h2>
      <p class="concern-text" style="border-left-color: var(--muted); font-style: italic; color: var(--muted);">${safeText(state.reviewContext)}</p>
    </div>

    <div class="card page-break">
      <h2>Automated Signal Checks</h2>
      <div class="checklist-list">
        ${Object.entries(state.checks).map(([key, passed]) => `
          <div class="checklist-item ${passed ? "pass" : "warn"}">
            <span class="pill ${passed ? "pass" : "warn"}">${passed ? "Pass" : "Review"}</span>
            <span class="text">${safeText(checkLabels[key])}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="card">
      <h2>Primary Findings & Concerns</h2>
      <p class="concern-text">${safeText(state.mainConcern)}</p>
    </div>

    <div class="card page-break">
      <h2>Action Plan: Priority Technical Recommendations</h2>
      <ol class="fixes-list">
        ${fixes.map((fix) => `<li>${safeText(fix)}</li>`).join("")}
      </ol>
    </div>

    ${broken.length ? `
    <div class="card">
      <h2>Broken Link Validation</h2>
      <p>The scanner sampled links internally and flagged the following responses that returned dead or timeout signals (${brokenLinksCount} errors found):</p>
      <table class="broken-links-table">
        <thead>
          <tr>
            <th>Link Target Path</th>
            <th>HTTP Status / Error</th>
          </tr>
        </thead>
        <tbody>
          ${broken.map((item) => `
            <tr class="error-row">
              <td style="word-break: break-all;"><a href="${safeText(item.href)}" target="_blank">${safeText(item.href)}</a></td>
              <td><strong>${item.status === 0 ? "Timeout / DNS Error" : "HTTP Status " + safeText(item.status)}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    ` : ""}

    ${screenshots ? `
    <div class="card page-break">
      <h2>Visual Layout Evidence</h2>
      <p style="margin:0 0 16px; color:var(--muted); font-size:14px;">The scanner captured visual viewports at standard resolutions to audit mobile-responsiveness, CTA visibility, and above-the-fold sizing.</p>
      <div class="screenshots-container">
        <div class="screenshot-frame desktop">
          <div style="font-size:12px; font-weight:700; color:var(--muted); margin-bottom:6px;">Desktop Viewport (1365px width)</div>
          <img src="${safeText(screenshots.desktop)}" alt="Desktop Viewport Audit Screenshot">
        </div>
        <div class="screenshot-frame mobile">
          <div style="font-size:12px; font-weight:700; color:var(--muted); margin-bottom:6px;">Mobile Viewport (390px width)</div>
          <img src="${safeText(screenshots.mobile)}" alt="Mobile Viewport Audit Screenshot">
        </div>
      </div>
    </div>
    ` : ""}
  </main>
</body>
</html>`;
}

function copySummary() {
  const state = getState();
  const summary = `${state.businessName} website health check\n${state.websiteUrl}\n\nMain concern:\n${state.mainConcern}\n\nRecommended fixes:\n${state.recommendedFixes}`;
  navigator.clipboard.writeText(summary);
}

function downloadReport() {
  const blob = new Blob([reportMarkup()], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${getState().businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "website"}-health-check.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function loadHistory() {
  try {
    const saved = localStorage.getItem("website-signal-scanner-history");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveToHistory(results) {
  if (!results || !results.length) return;
  let history = loadHistory();
  for (const result of results) {
    if (result.error) continue;
    history = history.filter((item) => item.url !== result.url && item.finalUrl !== result.finalUrl);
    history.unshift(result);
  }
  localStorage.setItem("website-signal-scanner-history", JSON.stringify(history.slice(0, 30)));
}

function renderHistory() {
  const list = document.querySelector("#scan-history-list");
  const clearBtn = document.querySelector("#clear-history");
  if (!list) return;

  const history = loadHistory();
  if (!history.length) {
    list.innerHTML = `<li class="empty-history">No past scans saved.</li>`;
    if (clearBtn) clearBtn.style.display = "none";
    return;
  }

  if (clearBtn) clearBtn.style.display = "block";
  list.innerHTML = history.map((result, index) => {
    const title = result.title && result.title !== "No title found" ? result.title : domainName(result.finalUrl || result.url);
    const date = new Date(result.scannedAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<li class="scan-history-item" data-index="${index}">
      <div class="scan-history-info">
        <span class="scan-history-title">${safeText(title)}</span>
        <span class="scan-history-meta">Need: ${result.improvementScore} • ${date}</span>
      </div>
      <div class="scan-history-item-actions">
        <button class="scan-history-delete" type="button" data-url="${safeText(result.url)}" title="Delete from history">×</button>
      </div>
    </li>`;
  }).join("");
}

function deleteHistoryItem(url) {
  let history = loadHistory();
  history = history.filter((item) => item.url !== url);
  localStorage.setItem("website-signal-scanner-history", JSON.stringify(history));
  renderHistory();
}

function clearHistory() {
  localStorage.removeItem("website-signal-scanner-history");
  renderHistory();
}

Object.values(fields.scores).forEach((field) => field.addEventListener("input", render));
Object.values(fields.checks).forEach((field) => field.addEventListener("change", render));
[fields.businessName, fields.websiteUrl, fields.reviewContext, fields.mainConcern, fields.recommendedFixes].forEach((field) => field.addEventListener("input", render));

document.querySelector("#copy-summary").addEventListener("click", copySummary);
document.querySelector("#download-report").addEventListener("click", downloadReport);
document.querySelector("#print-report").addEventListener("click", async () => {
  const button = document.querySelector("#print-report");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Generating PDF...";

  try {
    const state = getState();
    const response = await fetch("/api/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });

    if (!response.ok) throw new Error("Backend PDF generation failed");

    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `website-audit-${state.businessName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("PDF API error, falling back to window.print():", error);
    window.print();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
document.querySelector("#export-csv").addEventListener("click", exportCsv);
document.querySelector("#reset-report").addEventListener("click", () => {
  scanner.urls.value = "";
  scanner.results.innerHTML = "";
  scanner.comparison.innerHTML = "";
  scanner.status.textContent = "Local scanner idle";
  setState(defaults);
});
scanner.button.addEventListener("click", runScan);
scanner.results.addEventListener("click", (event) => {
  const button = event.target.closest(".use-result");
  if (!button) return;
  const result = latestScanResults[Number(button.dataset.index)];
  if (result) setState(scanResultToState(result), result);
});
scanner.urls.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") runScan();
});

// Event delegation for history items selection and deletion
const historyList = document.querySelector("#scan-history-list");
if (historyList) {
  historyList.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest(".scan-history-delete");
    if (deleteBtn) {
      event.stopPropagation();
      const url = deleteBtn.dataset.url;
      deleteHistoryItem(url);
      return;
    }

    const item = event.target.closest(".scan-history-item");
    if (item) {
      const history = loadHistory();
      const result = history[Number(item.dataset.index)];
      if (result) {
        latestScanResults = [result];
        renderScanResults([result]);
        renderComparison([result]);
        setState(scanResultToState(result), result);
        scanner.status.textContent = `Loaded saved scan for ${domainName(result.finalUrl || result.url)}`;
      }
    }
  });
}

const clearHistoryBtn = document.querySelector("#clear-history");
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", clearHistory);
}

// Initial state setup and history load
setState(defaults);
renderHistory();

