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
  const moduleCards = [
    ["Mobile", state.scores.mobile],
    ["Performance", state.scores.performance],
    ["Accessibility", state.scores.accessibility],
    ["SEO", state.scores.seo],
    ["Local SEO", result?.localSeo?.score ?? "n/a"],
    ["Broken Links", moduleScores.brokenLinks ?? "n/a"],
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeText(state.businessName)} Website Signal Report</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #172033; background: #f4f6fb; }
    main { width: min(980px, calc(100% - 32px)); margin: 0 auto; padding: 42px 0; }
    header { border-bottom: 4px solid #3657f5; margin-bottom: 24px; padding-bottom: 18px; }
    h1 { margin: 0 0 8px; font-size: 42px; line-height: 1; }
    h2 { margin-top: 30px; }
    .scores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .score, .shot { background: white; border: 1px solid #dbe2ee; border-radius: 12px; padding: 16px; }
    .score strong { display: block; color: #3657f5; font-size: 28px; }
    .shots { display: grid; grid-template-columns: 1fr 0.38fr; gap: 14px; }
    img { display: block; width: 100%; border-radius: 10px; border: 1px solid #dbe2ee; }
    li { margin-bottom: 8px; line-height: 1.5; }
    @media (max-width: 680px) { .scores, .shots { grid-template-columns: 1fr; } h1 { font-size: 32px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <p>Website Signal Report</p>
      <h1>${safeText(state.businessName)}</h1>
      <p>${safeText(state.websiteUrl)}</p>
      <p>${new Date().toLocaleDateString()}</p>
    </header>
    <section class="scores">
      ${moduleCards.map(([label, value]) => `<div class="score"><strong>${safeText(value)}</strong>${safeText(label)}</div>`).join("")}
    </section>
    ${screenshots ? `<h2>Screenshot Evidence</h2><section class="shots"><div class="shot"><img src="${safeText(screenshots.desktop)}" alt="Desktop screenshot"></div><div class="shot"><img src="${safeText(screenshots.mobile)}" alt="Mobile screenshot"></div></section>` : ""}
    <h2>Review Context</h2>
    <p>${safeText(state.reviewContext)}</p>
    <h2>Scan Findings</h2>
    <ul>${Object.entries(state.checks).map(([key, passed]) => `<li>${passed ? "Pass" : "Needs review"}: ${safeText(checkLabels[key])}</li>`).join("")}</ul>
    <h2>Main Concern</h2>
    <p>${safeText(state.mainConcern)}</p>
    <h2>Recommended Fixes</h2>
    <ol>${fixes.map((fix) => `<li>${safeText(fix)}</li>`).join("")}</ol>
    ${broken.length ? `<h2>Sample Broken Links</h2><ul>${broken.map((item) => `<li>${safeText(item.href)} (${safeText(item.status)})</li>`).join("")}</ul>` : ""}
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

function loadSavedState() {
  const saved = localStorage.getItem("website-health-checker");
  if (!saved) return defaults;
  try { return { ...defaults, ...JSON.parse(saved) }; } catch { return defaults; }
}

Object.values(fields.scores).forEach((field) => field.addEventListener("input", render));
Object.values(fields.checks).forEach((field) => field.addEventListener("change", render));
[fields.businessName, fields.websiteUrl, fields.reviewContext, fields.mainConcern, fields.recommendedFixes].forEach((field) => field.addEventListener("input", render));

document.querySelector("#copy-summary").addEventListener("click", copySummary);
document.querySelector("#download-report").addEventListener("click", downloadReport);
document.querySelector("#print-report").addEventListener("click", () => window.print());
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

setState(defaults);
