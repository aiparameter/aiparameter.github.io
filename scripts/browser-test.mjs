import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { serve } from "./serve.mjs";
const out = process.argv[2];
const server = await serve(4173);
const browser = await puppeteer.launch({ args: [...chromium.args.filter((a) => a !== "--single-process"), "--no-sandbox"], executablePath: await chromium.executablePath(), headless: "shell" });
const base = "http://localhost:4173";
const widths = [1440, 1024, 768, 390, 320];
const pagesToTest = ["/", "/ai-news/", "/ai-news/inside-the-new-ai-model/", "/ai-tools/five-types-of-ai-research-tools/", "/about/", "/newsletter/", "/search/?q=agents"];
const report = { overflow: [], consoleErrors: [], failedRequests: [], vitals: {}, fonts: {}, typography: {} };

for (const w of widths) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
  page.on("console", (m) => { if (m.type() === "error") report.consoleErrors.push(`${w} ${m.text()}`); });
  page.on("requestfailed", (r) => report.failedRequests.push(`${w} ${r.url()}`));
  page.on("response", (r) => { if (r.status() >= 400) report.failedRequests.push(`${w} ${r.status()} ${r.url()}`); });
  for (const p of pagesToTest) {
    await page.evaluateOnNewDocument(() => {
      window.__cls = 0; window.__lcp = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((l) => { const e = l.getEntries().at(-1); window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto(base + p, { waitUntil: "networkidle0" });
    const o = await page.evaluate(() => {
      const de = document.documentElement;
      const wide = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > de.clientWidth + 1 && !e.closest(".table-wrap") && getComputedStyle(e).position !== "fixed" && !e.closest(".sr-only") && r.width > 0; }).slice(0, 3).map((e) => e.tagName + "." + e.className);
      return { sw: de.scrollWidth, cw: de.clientWidth, wide };
    });
    if (o.sw > o.cw) report.overflow.push(`${w}px ${p}: scrollWidth ${o.sw} > ${o.cw} ${o.wide.join(",")}`);
    if (p === "/" || p.includes("inside-the-new")) {
      const v = await page.evaluate(() => ({ cls: window.__cls, lcp: Math.round(window.__lcp) }));
      (report.vitals[`${w} ${p}`] = v);
    }
    const name = (p === "/" ? "home" : p.replace(/\W+/g, "_")).replace(/^_|_$/g, "");
    if (["/", "/ai-news/inside-the-new-ai-model/"].includes(p) || (w === 390 && p === "/search/?q=agents")) await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: false });
  }
  await page.close();
}

// Full-page home at 1440 and 390 for visual review
{
  const page = await browser.newPage();
  for (const w of [1440, 390]) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto(base + "/", { waitUntil: "networkidle0" });
    await page.screenshot({ path: `${out}/home-full-${w}.png`, fullPage: true });
  }
  // fonts + typography
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base + "/ai-news/inside-the-new-ai-model/", { waitUntil: "networkidle0" });
  report.fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].map((f) => `${f.family} ${f.style} ${f.status}`); });
  report.typography = await page.evaluate(() => {
    const cs = (s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return { size: c.fontSize, weight: c.fontWeight, lh: c.lineHeight, family: c.fontFamily.split(",")[0] }; };
    const body = document.querySelector(".article-body > p:nth-of-type(2)");
    const chars = body ? Math.round(body.getBoundingClientRect().width / (parseFloat(getComputedStyle(body).fontSize) * 0.5)) : null;
    return { h1: cs(".article-title"), h2: cs(".article-body h2"), h3Related: cs(".related h3"), body: cs(".article-body p + p"), category: cs(".category"), meta: cs(".byline-block"), approxCharsPerLine: chars, bodyWidthPx: body && Math.round(body.getBoundingClientRect().width) };
  });
  await page.close();
}

// Interaction tests
const page = await browser.newPage();
const results = {};
await page.setViewport({ width: 390, height: 800 });
await page.goto(base + "/", { waitUntil: "networkidle0" });
results.menuHiddenInitially = await page.evaluate(() => getComputedStyle(document.getElementById("site-menu")).display === "none");
await page.click(".menu-toggle");
results.menuOpensOnClick = await page.evaluate(() => getComputedStyle(document.getElementById("site-menu")).display !== "none" && document.querySelector(".menu-toggle").getAttribute("aria-expanded") === "true");
await page.keyboard.press("Escape");
results.escapeClosesAndFocusesToggle = await page.evaluate(() => getComputedStyle(document.getElementById("site-menu")).display === "none" && document.activeElement === document.querySelector(".menu-toggle"));
await page.focus(".menu-toggle"); await page.keyboard.press("Enter");
results.menuOpensWithKeyboard = await page.evaluate(() => document.querySelector(".menu-toggle").getAttribute("aria-expanded") === "true");
results.menuTouchTarget = await page.evaluate(() => { const r = document.querySelector(".menu-toggle").getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; });
// header search submits to results page
await page.type("#site-search-q", "agents");
await Promise.all([page.waitForNavigation(), page.keyboard.press("Enter")]);
await page.waitForFunction(() => document.querySelectorAll("#search-results li").length > 0);
results.searchUrl = page.url();
results.searchAgentsHits = await page.evaluate(() => ({ status: document.getElementById("search-status").textContent, titles: [...document.querySelectorAll("#search-results h3")].map((h) => h.textContent.slice(0, 45)), fallbackHidden: document.getElementById("search-fallback").hidden }));
await page.evaluate(() => { document.getElementById("search-page-q").value = "zzzzqq"; });
await page.click("#search-page-form button");
results.searchNoHits = await page.evaluate(() => document.getElementById("search-status").textContent);
await page.select("#search-section", "guides");
await page.evaluate(() => { document.getElementById("search-page-q").value = "workflow"; });
await page.click("#search-page-form button");
results.searchSectionFilter = await page.evaluate(() => ({ status: document.getElementById("search-status").textContent, n: document.querySelectorAll("#search-results li").length }));
// newsletter validation + unconfigured behaviour
await page.setViewport({ width: 1440, height: 900 });
await page.goto(base + "/newsletter/", { waitUntil: "networkidle0" });
await page.click('form[data-newsletter] button[type="submit"]');
results.newsletterEmpty = await page.evaluate(() => ({ error: document.querySelector(".field-error").textContent, invalid: document.querySelector('form[data-newsletter] input').getAttribute("aria-invalid"), focused: document.activeElement.type }));
await page.type('form[data-newsletter] input', "not-an-email");
await page.click('form[data-newsletter] button[type="submit"]');
results.newsletterBad = await page.evaluate(() => document.querySelector(".field-error").textContent);
await page.evaluate(() => { document.querySelector('form[data-newsletter] input').value = ""; });
await page.type('form[data-newsletter] input', "reader@example.com");
await page.click('form[data-newsletter] button[type="submit"]');
results.newsletterUnconfigured = await page.evaluate(() => ({ status: document.querySelector(".form-status").textContent, state: document.querySelector(".form-status").dataset.state, errorHidden: document.querySelector(".field-error").hidden }));
// configured endpoint simulation (success + failure) by intercepting requests
await page.setRequestInterception(true);
let mode = "ok";
page.on("request", (req) => { if (req.url().startsWith("https://subscribe.test/")) { req.respond({ status: mode === "ok" ? 200 : 500, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: "{}" }); } else req.continue(); });
await page.evaluate(() => { window.PARAMETER_CONFIG.newsletterEndpoint = "https://subscribe.test/api"; });
await page.evaluate(() => { document.querySelector('form[data-newsletter] input').value = "reader@example.com"; });
await page.click('form[data-newsletter] button[type="submit"]');
await new Promise((r) => setTimeout(r, 500));
results.newsletterEndpointOk = await page.evaluate(() => ({ status: document.querySelector(".form-status").textContent, state: document.querySelector(".form-status").dataset.state }));
mode = "fail";
await page.evaluate(() => { document.querySelector('form[data-newsletter] input').value = "reader@example.com"; });
await page.click('form[data-newsletter] button[type="submit"]');
await new Promise((r) => setTimeout(r, 500));
results.newsletterEndpointFail = await page.evaluate(() => ({ status: document.querySelector(".form-status").textContent, state: document.querySelector(".form-status").dataset.state }));

// keyboard focus visible + tab order sample
await page.goto(base + "/", { waitUntil: "networkidle0" });
await page.keyboard.press("Tab");
results.firstTabIsSkipLink = await page.evaluate(() => document.activeElement.className === "skip-link" && document.activeElement.getBoundingClientRect().top >= 0);
results.focusOutline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle + " " + getComputedStyle(document.activeElement).outlineWidth);
// reduced motion
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
results.reducedMotionTransition = await page.evaluate(() => getComputedStyle(document.querySelector(".thumb img")).transitionDuration);
// no-JS rendering: menu visible, search fallback present

const nojs = await browser.newPage();
await nojs.setJavaScriptEnabled(false);
await nojs.setViewport({ width: 390, height: 800 });
await nojs.goto(base + "/", { waitUntil: "load" });
results.noJsMenuVisible = await nojs.evaluate(() => getComputedStyle(document.getElementById("site-menu")).display !== "none");
await nojs.goto(base + "/search/", { waitUntil: "load" });
results.noJsSearchListsArticles = await nojs.evaluate(() => document.querySelectorAll("#search-fallback li").length);
await nojs.close();

console.log(JSON.stringify({ report, results }, null, 2));
await browser.close(); server.close();
