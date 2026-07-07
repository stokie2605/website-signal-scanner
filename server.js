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

  const failed = checks.filter((c) => !c.passed);
  const improvementScore = Math.round((failed.length / checks.length) * 100);
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
    fixes: failed.map((c) => c.fix).slice(0, 8),
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
    const visualFixes = result.visualAudit?.recommendations || [];
    if (visualFixes.length) {
      result.fixes = [...result.fixes, ...visualFixes].slice(0, 10);
      result.improvementScore = Math.min(100, result.improvementScore + Math.min(24, visualFixes.length * 4));
      result.healthScore = 100 - result.improvementScore;
      result.opportunity = result.improvementScore >= 65 ? "High" : result.improvementScore >= 35 ? "Medium" : "Low";
    }
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
