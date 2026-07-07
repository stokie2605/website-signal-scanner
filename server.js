const crypto = require("node:crypto");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

let chromium = null;
try {
  ({ chromium } = require("playwright"));
} catch {
  chromium = null;
}

const port = Number(process.env.PORT || 4177);
const root = __dirname;
const screenshotRoot = path.join(root, "screenshots");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
};

function sendJson(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

function sendStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const name = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(root, name));
  if (!file.startsWith(root)) return res.writeHead(403).end("Forbidden");
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end("Not found");
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "text/plain" });
    res.end(data);
  });
}

function normalizeUrl(input) {
  const value = String(input || "").trim();
  if (!value) return null;
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeText(value) { return stripHtml(value).slice(0, 280); }
function textBetween(html, regex) { const m = html.match(regex); return m ? safeText(m[1]) : ""; }
function attr(tag, name) { const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i")); return m ? m[1].trim() : ""; }
function matches(html, regex) { return [...html.matchAll(regex)].map((m) => m[0]); }

function visualRecommendations(signals) {
  if (!signals || signals.error || !signals.available) return [];
  const recs = [];
  if (signals.mobile?.hasHorizontalOverflow) recs.push("Fix mobile horizontal overflow so visitors do not have to sideways-scroll.");
  if ((signals.desktop?.visibleCtaCount || 0) === 0 && (signals.mobile?.visibleCtaCount || 0) === 0) recs.push("Add a clear above-the-fold call-to-action such as Call, Book, Get a quote, or Contact.");
  if ((signals.desktop?.aboveFoldTextLength || 0) < 90) recs.push("Add clearer above-the-fold copy explaining what the business does and who it helps.");
  if ((signals.desktop?.aboveFoldTextLength || 0) > 1200) recs.push("Reduce above-the-fold copy so the page feels easier to scan.");
  if ((signals.desktop?.aboveFoldImageCount || 0) === 0 && (signals.mobile?.aboveFoldImageCount || 0) === 0) recs.push("Add a relevant visual proof point near the top, such as work examples, premises, product, or service imagery.");
  if ((signals.mobile?.smallTextCount || 0) > 12) recs.push("Review small mobile text sizes so key content is easier to read on phones.");
  return recs.slice(0, 6);
}


function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractInternalLinks(html, finalUrl, limit = 12) {
  const base = new URL(finalUrl);
  const hrefs = matches(html, /<a\b[^>]*>/gi)
    .map((tag) => attr(tag, "href"))
    .filter((href) => href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:") && !href.startsWith("javascript:"));

  return unique(hrefs.map((href) => {
    try {
      const url = new URL(href, base);
      url.hash = "";
      return url.origin === base.origin ? url.href : null;
    } catch {
      return null;
    }
  })).filter((href) => href !== base.href).slice(0, limit);
}

async function checkBrokenLinks(html, finalUrl) {
  const links = extractInternalLinks(html, finalUrl);
  const broken = [];
  const checked = [];

  for (const href of links) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      let response = await fetch(href, { method: "HEAD", redirect: "follow", signal: controller.signal, headers: { "User-Agent": "WebsiteHealthChecker/1.0 link audit" } });
      if (response.status === 405 || response.status === 403) {
        response = await fetch(href, { method: "GET", redirect: "follow", signal: controller.signal, headers: { "User-Agent": "WebsiteHealthChecker/1.0 link audit" } });
      }
      checked.push({ href, status: response.status, ok: response.status >= 200 && response.status < 400 });
      if (response.status >= 400) broken.push({ href, status: response.status });
    } catch (error) {
      checked.push({ href, status: 0, ok: false, error: error.name === "AbortError" ? "timeout" : error.message });
      broken.push({ href, status: 0 });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    checkedCount: checked.length,
    brokenCount: broken.length,
    checked,
    broken: broken.slice(0, 6),
    recommendations: broken.length ? [`Fix or redirect ${broken.length} internal link${broken.length === 1 ? "" : "s"} returning errors.`] : [],
  };
}

function buildLocalSeoAudit({ title, description, h1, visibleText, contactLinks, finalUrl }) {
  const urlHost = (() => { try { return new URL(finalUrl).hostname; } catch { return ""; } })();
  const locationWords = /(stoke|staffordshire|cheshire|alsager|crewe|sandbach|congleton|newcastle-under-lyme|near me|local)/i;
  const serviceWords = /(service|repair|support|design|maintenance|installation|emergency|booking|quote|shop|studio|clinic|garage|foodbank|joinery|mechanic|tree|plumber|electrician)/i;
  const hasPhone = /(?:\+44|0)\s?\d{2,5}[\s-]?\d{3,4}[\s-]?\d{3,4}/.test(visibleText) || /tel:/i.test(visibleText);
  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(visibleText) || /mailto:/i.test(visibleText);
  const hasSchema = /application\/ld\+json/i.test(visibleText);
  const signals = [
    { key: "location", label: "Mentions location/service area", passed: locationWords.test(`${title} ${description} ${h1} ${visibleText}`) },
    { key: "service", label: "Mentions service/category", passed: serviceWords.test(`${title} ${description} ${h1} ${visibleText}`) },
    { key: "contact", label: "Shows contact route", passed: contactLinks.length > 0 || hasPhone || hasEmail },
    { key: "schema", label: "Has structured data hint", passed: hasSchema },
    { key: "domain", label: "Uses readable domain", passed: Boolean(urlHost && !/[0-9a-f]{12,}/i.test(urlHost)) },
  ];
  const recommendations = [];
  if (!signals[0].passed) recommendations.push("Add clear location or service-area wording for local search context.");
  if (!signals[1].passed) recommendations.push("Make the primary service or site category obvious in the title, H1, and intro copy.");
  if (!signals[2].passed) recommendations.push("Add a visible contact route such as phone, email, booking, or contact link.");
  if (!signals[3].passed) recommendations.push("Consider adding structured data where appropriate, such as LocalBusiness, Organization, or WebSite schema.");
  return { score: Math.round((signals.filter((s) => s.passed).length / signals.length) * 100), signals, recommendations };
}

function buildAccessibilityAudit({ h1Count, headings, images, missingAlt, html }) {
  const formControls = matches(html, /<(input|select|textarea)\b[^>]*>/gi);
  const labelledControls = formControls.filter((tag) => /aria-label=|aria-labelledby=|id=/i.test(tag));
  const buttons = matches(html, /<button\b[^>]*>[\s\S]*?<\/button>|<a\b[^>]*>[\s\S]*?<\/a>/gi).slice(0, 300);
  const unnamedActions = buttons.filter((tag) => !stripHtml(tag) && !/aria-label=|title=/i.test(tag));
  const signals = [
    { key: "h1", label: "Single clear H1", passed: h1Count === 1 },
    { key: "headings", label: "Enough headings for scanning", passed: headings >= 3 },
    { key: "alt", label: "Image alt coverage", passed: images.length === 0 || missingAlt.length / images.length <= 0.25 },
    { key: "forms", label: "Form controls have label hooks", passed: formControls.length === 0 || labelledControls.length / formControls.length >= 0.75 },
    { key: "actions", label: "Buttons/links have accessible names", passed: unnamedActions.length === 0 },
  ];
  const recommendations = [];
  if (!signals[0].passed) recommendations.push("Use one clear H1 to improve page structure for screen readers and search engines.");
  if (!signals[1].passed) recommendations.push("Add descriptive section headings so the page is easier to scan and navigate.");
  if (!signals[2].passed) recommendations.push(`Add useful alt text to key images (${missingAlt.length} missing or empty).`);
  if (!signals[3].passed) recommendations.push("Review form labels and ARIA label hooks for keyboard and screen-reader users.");
  if (!signals[4].passed) recommendations.push("Give icon-only links/buttons accessible names with text or aria-label.");
  return { score: Math.round((signals.filter((s) => s.passed).length / signals.length) * 100), signals, recommendations };
}
function scorePage({ url, finalUrl, html, elapsedMs, status }) {
  const title = textBetween(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const descriptionTag = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0] || "";
  const description = attr(descriptionTag, "content");
  const h1 = textBetween(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Count = matches(html, /<h1\b[^>]*>/gi).length;
  const headings = matches(html, /<h[1-6]\b[^>]*>/gi).length;
  const images = matches(html, /<img\b[^>]*>/gi).slice(0, 300);
  const missingAlt = images.filter((tag) => !/\salt\s*=/i.test(tag) || !attr(tag, "alt"));
  const links = matches(html, /<a\b[^>]*>/gi).slice(0, 500);
  const contactLinks = links.filter((tag) => {
    const href = attr(tag, "href").toLowerCase();
    const text = stripHtml(tag).toLowerCase();
    return href.startsWith("tel:") || href.startsWith("mailto:") || href.includes("contact") || text.includes("contact");
  });
  const visibleText = stripHtml(html).slice(0, 8000);
  const localSignals = /(stoke|alsager|crewe|sandbach|cheshire|stafford|newcastle-under-lyme|congleton|near me|local)/i.test(visibleText);
  const oldCopyright = html.match(/(?:©|&copy;|copyright)[^0-9]*(20[0-2][0-4])/i)?.[1] || "";
  const hasViewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);

  const checks = [
    ["https", "Uses HTTPS", url.protocol === "https:", "Move the site to HTTPS so browsers do not show security warnings."],
    ["status", "Homepage returns a successful status", status >= 200 && status < 400, `Investigate the homepage response status (${status}).`],
    ["title", "Has a useful page title", title.length >= 12 && title.length <= 70, "Write a clear page title with the service, business name, and location."],
    ["description", "Has a meta description", description.length >= 50 && description.length <= 170, "Add a concise meta description explaining the service and location."],
    ["h1", "Has one clear H1 heading", h1Count === 1 && h1.length > 0, "Use one clear H1 that describes the business or primary service."],
    ["headings", "Uses section headings", headings >= 3, "Add useful section headings so visitors and search engines can scan the page."],
    ["viewport", "Includes mobile viewport metadata", hasViewport, "Add a viewport meta tag so the site scales correctly on mobile devices."],
    ["alt", "Images include alt text", images.length === 0 || missingAlt.length / images.length <= 0.25, `Add meaningful alt text to key images (${missingAlt.length} missing or empty).`],
    ["contact", "Contact route is visible", contactLinks.length > 0, "Add a clear contact, phone, or email link near the top of the page."],
    ["local", "Mentions local service area", localSignals, "Include clear local area wording in the homepage copy."],
    ["speed", "Initial HTML fetch is responsive", elapsedMs < 1800, "Investigate hosting, image size, and unused scripts if the page feels slow."],
    ["freshness", "No obviously stale copyright year", !oldCopyright, `Update stale copyright or footer date (${oldCopyright}).`],
  ].map(([key, label, passed, fix]) => ({ key, label, passed, fix }));

  const localSeo = buildLocalSeoAudit({ title, description, h1, visibleText, contactLinks, finalUrl });
  const accessibility = buildAccessibilityAudit({ h1Count, headings, images, missingAlt, html });
  const failed = checks.filter((c) => !c.passed);
  const modulePenalty = Math.round(((100 - localSeo.score) + (100 - accessibility.score)) / 20);
  const improvementScore = Math.min(100, Math.round((failed.length / checks.length) * 100) + modulePenalty);
  const healthScore = 100 - improvementScore;
  return {
    url: url.href,
    finalUrl,
    title: title || "No title found",
    metaDescription: description || "No meta description found",
    h1: h1 || "No H1 found",
    status,
    elapsedMs,
    counts: { headings, images: images.length, imagesMissingAlt: missingAlt.length, links: links.length, contactLinks: contactLinks.length },
    checks,
    localSeo,
    accessibility,
    fixes: unique([...failed.map((c) => c.fix), ...localSeo.recommendations, ...accessibility.recommendations]).slice(0, 10),
    healthScore,
    improvementScore,
    opportunity: improvementScore >= 65 ? "High" : improvementScore >= 35 ? "Medium" : "Low",
    scannedAt: new Date().toISOString(),
  };
}

async function collectViewport(page, viewport, screenshotPath) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(600);
  const signals = await page.evaluate(() => {
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || 1) > 0;
    };
    const actionWords = /(call|book|get quote|quote|contact|enquire|email|start|order|buy|apply|track|demo)/i;
    const actions = [...document.querySelectorAll("a,button,[role='button'],input[type='submit']")].filter(isVisible);
    const ctas = actions.filter((el) => actionWords.test(`${el.textContent || ""} ${el.getAttribute("href") || ""} ${el.getAttribute("aria-label") || ""}`));
    const above = [...document.body.querySelectorAll("body *")].filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.top < window.innerHeight && rect.width > 0 && rect.height > 0;
    });
    const topText = [...new Set(above.map((el) => (el.innerText || "").trim()).filter(Boolean))].join(" ").replace(/\s+/g, " ");
    const smallTextCount = above.filter((el) => {
      const text = (el.textContent || "").trim();
      if (!text) return false;
      return parseFloat(window.getComputedStyle(el).fontSize) < 13;
    }).length;
    const images = [...document.images].filter(isVisible);
    return {
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 4,
      visibleActionCount: actions.length,
      visibleCtaCount: ctas.length,
      aboveFoldTextLength: topText.length,
      aboveFoldImageCount: images.length,
      smallTextCount,
    };
  });
  await page.screenshot({ path: screenshotPath, fullPage: false });
  return signals;
}

async function captureVisualAudit(targetUrl) {
  if (!chromium) {
    return { available: false, error: "Playwright is not installed. Run npm install playwright to enable screenshot audits." };
  }

  fs.mkdirSync(screenshotRoot, { recursive: true });
  const id = crypto.createHash("sha1").update(targetUrl).digest("hex").slice(0, 12);
  const desktopFile = `${id}-desktop.png`;
  const mobileFile = `${id}-mobile.png`;
  const desktopPath = path.join(screenshotRoot, desktopFile);
  const mobilePath = path.join(screenshotRoot, mobileFile);
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ userAgent: "WebsiteHealthChecker/1.0 visual audit" });
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 14000 });
    try { await page.waitForLoadState("networkidle", { timeout: 4500 }); } catch {}
    const desktop = await collectViewport(page, { width: 1365, height: 900 }, desktopPath);
    const mobile = await collectViewport(page, { width: 390, height: 844 }, mobilePath);
    const audit = {
      available: true,
      screenshots: {
        desktop: `/screenshots/${desktopFile}`,
        mobile: `/screenshots/${mobileFile}`,
      },
      desktop,
      mobile,
    };
    audit.recommendations = visualRecommendations(audit);
    return audit;
  } catch (error) {
    return { available: false, error: `Visual audit failed: ${error.message}` };
  } finally {
    if (browser) await browser.close();
  }
}

async function auditOne(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return { url: rawUrl, error: "Enter a valid URL." };
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { "User-Agent": "WebsiteHealthChecker/1.0 local audit tool", Accept: "text/html,application/xhtml+xml" } });
    const elapsedMs = Date.now() - started;
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html")) return { url: url.href, finalUrl: response.url, error: `Not an HTML page (${type || "unknown content type"}).` };
    const html = await response.text();
    const result = scorePage({ url: new URL(response.url), finalUrl: response.url, html, elapsedMs, status: response.status });
    result.visualAudit = await captureVisualAudit(result.finalUrl);
    result.brokenLinks = await checkBrokenLinks(html, result.finalUrl);
    const visualFixes = result.visualAudit?.recommendations || [];
    const linkFixes = result.brokenLinks?.recommendations || [];
    if (visualFixes.length || linkFixes.length) {
      result.fixes = unique([...result.fixes, ...visualFixes, ...linkFixes]).slice(0, 12);
      result.improvementScore = Math.min(100, result.improvementScore + Math.min(28, visualFixes.length * 4 + linkFixes.length * 6));
      result.healthScore = 100 - result.improvementScore;
      result.opportunity = result.improvementScore >= 65 ? "High" : result.improvementScore >= 35 ? "Medium" : "Low";
    }
    result.modules = {
      technical: result.healthScore,
      localSeo: result.localSeo.score,
      accessibility: result.accessibility.score,
      brokenLinks: result.brokenLinks.checkedCount ? Math.max(0, 100 - result.brokenLinks.brokenCount * 20) : null,
      visual: result.visualAudit?.available ? Math.max(0, 100 - (result.visualAudit.recommendations || []).length * 18) : null,
    };
    return result;
  } catch (error) {
    return { url: url.href, error: error.name === "AbortError" ? "The site took too long to respond." : error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function handleAudit(req, res) {
  let body = "";
  req.on("data", (chunk) => { body += chunk; if (body.length > 100000) req.destroy(); });
  req.on("end", async () => {
    try {
      const payload = JSON.parse(body || "{}");
      const rawUrls = Array.isArray(payload.urls) ? payload.urls : String(payload.urls || payload.url || "").split(/\r?\n/);
      const urls = rawUrls.map((x) => String(x).trim()).filter(Boolean).slice(0, 20);
      if (!urls.length) return sendJson(res, 400, { error: "Add at least one URL to scan." });
      const results = [];
      for (const url of urls) results.push(await auditOne(url));
      results.sort((a, b) => (b.improvementScore || 0) - (a.improvementScore || 0));
      sendJson(res, 200, { results });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
  });
}

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/audit") return handleAudit(req, res);
  if (req.method === "GET") return sendStatic(req, res);
  res.writeHead(405).end("Method not allowed");
}).listen(port, () => console.log(`Website Health Checker running at http://localhost:${port}`));


