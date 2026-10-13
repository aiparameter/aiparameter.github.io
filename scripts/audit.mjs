// Audit: links, assets, landmarks, headings, ids, images, JSON-LD vs visible content, axe (jsdom), contrast.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";
const require = createRequire(import.meta.url);
const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const dist = path.resolve(import.meta.dirname, "../dist");
const site = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../data/site.json"), "utf8"));
const articles = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../data/articles.json"), "utf8"));

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const htmlFiles = walk(dist).filter((f) => f.endsWith(".html"));
const problems = [];
const note = (f, msg) => problems.push(`${path.relative(dist, f)}: ${msg}`);

const exists = (url) => {
  let p = url.split("#")[0].split("?")[0];
  if (!p || /^(https?:|mailto:|tel:)/.test(p)) return true;
  if (!p.startsWith("/")) return null;
  const target = path.join(dist, p);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return true;
  return fs.existsSync(path.join(target, "index.html"));
};

let linkCount = 0, pagesChecked = 0, anchorCount = 0;
const outlines = {};
const jsonldTypes = new Set();

for (const file of htmlFiles) {
  pagesChecked++;
  const html = fs.readFileSync(file, "utf8");
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // landmarks
  const count = (sel) => doc.querySelectorAll(sel).length;
  if (count("main") !== 1) note(file, `expected 1 <main>, found ${count("main")}`);
  if (count("h1") !== 1) note(file, `expected 1 <h1>, found ${count("h1")}`);
  if (count("header.site-header") !== 1) note(file, "site header missing");
  if (count("body > footer.site-footer") !== 1) note(file, "site footer missing");
  doc.querySelectorAll("nav").forEach((n) => { if (!n.getAttribute("aria-label")) note(file, "nav without accessible name"); });

  // ids unique
  const ids = [...doc.querySelectorAll("[id]")].map((e) => e.id);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) note(file, `duplicate ids: ${[...new Set(dup)].join(", ")}`);

  // links and fragments
  doc.querySelectorAll("a[href]").forEach((a) => {
    linkCount++;
    const href = a.getAttribute("href");
    if (!href || href === "#") note(file, `empty link: ${a.textContent.trim().slice(0, 40)}`);
    const ok = exists(href);
    if (ok === false) note(file, `broken internal link: ${href}`);
    if (ok === null) note(file, `relative link (avoid): ${href}`);
    if (!a.textContent.trim() && !a.getAttribute("aria-label")) note(file, `link without text: ${href}`);
    const hash = href.split("#")[1];
    if (hash && href.startsWith("/") && href.split("#")[0] !== "") {
      const target = href.split("#")[0];
      const tfile = fs.existsSync(path.join(dist, target, "index.html")) ? path.join(dist, target, "index.html") : path.join(dist, target);
      if (fs.existsSync(tfile) && !fs.readFileSync(tfile, "utf8").includes(`id="${hash}"`)) note(file, `missing anchor target: ${href}`);
    } else if (hash && href.startsWith("#")) {
      anchorCount++;
      if (!doc.getElementById(hash)) note(file, `missing in-page anchor: ${href}`);
    }
  });
  // assets
  doc.querySelectorAll("link[href], script[src], img[src]").forEach((e) => {
    const u = e.getAttribute("href") || e.getAttribute("src");
    if (exists(u) === false) note(file, `missing asset: ${u}`);
  });
  doc.querySelectorAll("img[srcset]").forEach((e) => e.getAttribute("srcset").split(",").forEach((s) => { const u = s.trim().split(/\s+/)[0]; if (exists(u) === false) note(file, `missing srcset asset: ${u}`); }));

  // images
  doc.querySelectorAll("img").forEach((img) => {
    if (!img.getAttribute("width") || !img.getAttribute("height")) note(file, `img without width/height: ${img.src}`);
    if (!img.hasAttribute("alt")) note(file, `img without alt: ${img.src}`);
  });

  // forms
  doc.querySelectorAll("input, select").forEach((inp) => {
    const id = inp.id;
    if (!id || !doc.querySelector(`label[for="${id}"]`)) note(file, `form control without label: ${inp.name}`);
  });
  doc.querySelectorAll("button").forEach((b) => { if (!b.textContent.trim()) note(file, "button without text"); });

  // heading outline
  const hs = [...doc.querySelectorAll("h1,h2,h3,h4,h5,h6")];
  let prev = 0; const outline = [];
  hs.forEach((h) => {
    const l = Number(h.tagName[1]);
    if (prev && l > prev + 1) note(file, `heading level skipped: h${prev} → h${l} ("${h.textContent.trim().slice(0, 50)}")`);
    if (!prev && l !== 1) note(file, `first heading is h${l}`);
    prev = l; outline.push(`${"  ".repeat(l - 1)}h${l} ${h.textContent.trim().slice(0, 60)}`);
  });
  outlines[path.relative(dist, file)] = outline;

  // headings should be non-empty
  hs.forEach((h) => { if (!h.textContent.trim()) note(file, "empty heading"); });

  // JSON-LD
  const blocks = [...doc.querySelectorAll('script[type="application/ld+json"]')];
  if (blocks.length !== 1) note(file, `expected 1 JSON-LD block, found ${blocks.length}`);
  blocks.forEach((b) => {
    let data;
    try { data = JSON.parse(b.textContent); } catch (e) { note(file, "JSON-LD does not parse"); return; }
    const graph = data["@graph"] || [data];
    graph.forEach((n) => jsonldTypes.add(n["@type"]));
    const art = graph.find((n) => n["@type"] === "Article" || n["@type"] === "NewsArticle");
    if (art) {
      const h1 = doc.querySelector("h1").textContent.trim();
      if (art.headline !== h1) note(file, "JSON-LD headline differs from visible h1");
      const times = [...doc.querySelectorAll("article time")].map((t) => t.getAttribute("datetime"));
      if (!times.includes(art.datePublished)) note(file, "datePublished not visible on page");
      if (!times.includes(art.dateModified)) note(file, "dateModified not visible on page");
      const person = graph.find((n) => n["@type"] === "Person");
      if (!person || !doc.body.textContent.includes(person.name)) note(file, "author in JSON-LD not visible");
      const visibleSources = [...doc.querySelectorAll(".sources a")].map((a) => new URL(a.getAttribute("href")).href);
      (art.citation || []).forEach((c) => { if (!visibleSources.includes(new URL(c.url).href)) note(file, `citation not visible: ${c.url}`); });
      if (new Set(visibleSources).size !== (art.citation || []).length) note(file, "citation count differs from visible sources");
    }
    const bc = graph.find((n) => n["@type"] === "BreadcrumbList");
    if (bc) {
      const crumbs = [...doc.querySelectorAll(".breadcrumb li")].map((l) => l.textContent.trim());
      if (bc.itemListElement.length !== crumbs.length) note(file, "breadcrumb JSON-LD count differs from visible");
    }
    const list = graph.find((n) => n.mainEntity && n.mainEntity["@type"] === "ItemList");
    if (list) {
      list.mainEntity.itemListElement.forEach((it) => { if (!doc.querySelector(`a[href="${new URL(it.url).pathname}"]`)) note(file, `ItemList entry not linked on page: ${it.url}`); });
    }
  });

  // canonical + title + description
  const canon = doc.querySelector('link[rel="canonical"]')?.href;
  if (!canon) note(file, "missing canonical");
  const desc = doc.querySelector('meta[name="description"]')?.content || "";
  if (desc.length < 50 || desc.length > 175) note(file, `meta description length ${desc.length}`);
}

// unique titles and descriptions
const titles = {}, descs = {};
for (const f of htmlFiles) {
  const d = new JSDOM(fs.readFileSync(f, "utf8")).window.document;
  const t = d.title, ds = d.querySelector('meta[name="description"]').content;
  (titles[t] ||= []).push(f); (descs[ds] ||= []).push(f);
}
Object.entries(titles).forEach(([t, f]) => f.length > 1 && problems.push(`duplicate title "${t}"`));
Object.entries(descs).forEach(([t, f]) => f.length > 1 && problems.push(`duplicate description "${t.slice(0, 50)}"`));

// article metadata completeness
const home = fs.readFileSync(path.join(dist, "index.html"), "utf8");
for (const a of articles) {
  const url = `/${a.section}/${a.slug}/`;
  if (!home.includes(`href="${url}"`)) problems.push(`home does not link ${url}`);
  const doc = new JSDOM(fs.readFileSync(path.join(dist, url, "index.html"), "utf8")).window.document;
  const need = [[".category", "category"], ["time[datetime]", "date"], [".byline-block a[rel=author]", "author"], ["figure img[alt]", "image+alt"], [".sources li", "sources"], [".toc", "toc"], ["aside.related", "related"], ["form[data-newsletter]", "newsletter"], [".breadcrumb", "breadcrumb"]];
  need.forEach(([sel, name]) => { if (!doc.querySelector(sel)) problems.push(`${url} missing ${name}`); });
}
const cardCount = (home.match(/class="article-card/g) || []).length;

// sitemap vs files
const sm = fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8");
[...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].forEach(([, loc]) => { if (!exists(new URL(loc).pathname)) problems.push(`sitemap URL missing file: ${loc}`); });

// axe (jsdom: no layout, so colour-contrast is excluded here and measured separately)
let axeViolations = 0;
for (const file of htmlFiles) {
  const dom = new JSDOM(fs.readFileSync(file, "utf8"), { runScripts: "outside-only", pretendToBeVisual: true });
  dom.window.eval(axeSrc);
  const res = await dom.window.axe.run(dom.window.document, { rules: { "color-contrast": { enabled: false } }, runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
  res.violations.forEach((v) => { axeViolations++; note(file, `axe ${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`); });
}

// contrast (WCAG 2.x relative luminance)
const lum = (hex) => { const c = hex.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [
  ["body text on white", "#12161b", "#ffffff", 4.5], ["secondary text on white", "#414a55", "#ffffff", 4.5], ["secondary text on surface", "#414a55", "#f4f6f8", 4.5],
  ["category/link text on white", "#0039c7", "#ffffff", 4.5], ["category text on surface", "#0039c7", "#f4f6f8", 4.5], ["accent button: white on blue", "#ffffff", "#0052ff", 4.5],
  ["button hover: white on dark blue", "#ffffff", "#0039c7", 4.5], ["newsletter text on dark", "#ffffff", "#12161b", 4.5], ["newsletter secondary on dark", "#c9d1da", "#12161b", 4.5],
  ["newsletter button: ink on cyan", "#12161b", "#00b8e6", 4.5], ["error text on dark", "#ffb4b4", "#12161b", 4.5], ["success text on dark", "#9ff0c0", "#12161b", 4.5], ["info text on dark", "#ffe08a", "#12161b", 4.5],
  ["placeholder on white", "#5b6672", "#ffffff", 4.5], ["input border on white (UI 3:1)", "#7a8591", "#ffffff", 3], ["focus ring on white (UI 3:1)", "#0052ff", "#ffffff", 3],
  ["breadcrumb separator (decor) on white", "#8a94a0", "#ffffff", 0], ["meta dot on white", "#6b7580", "#ffffff", 3]
];
const contrast = pairs.map(([n, fg, bg, min]) => ({ name: n, ratio: ratio(fg, bg).toFixed(2), min, pass: ratio(fg, bg) >= min }));

console.log(JSON.stringify({ pagesChecked, linksChecked: linkCount, inPageAnchors: anchorCount, homeCardCount: cardCount, jsonldTypes: [...jsonldTypes], axeViolations, problems, contrast: contrast.filter((c) => !c.pass), contrastPassCount: contrast.filter((c) => c.pass).length, contrastTotal: contrast.length }, null, 2));
if (process.argv.includes("--outline")) console.log(["index.html", "ai-news/inside-the-new-ai-model/index.html", "ai-news/index.html"].map((k) => outlines[k]?.join("\n")).join("\n\n"));
