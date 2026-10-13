// The Parameter: static site generator. No framework; Node 22 + sharp.
// Usage: node src/build.mjs   (writes ./dist)
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { artSvg, logoSvg } from "./art.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const site = JSON.parse(read("data/site.json"));
const authors = JSON.parse(read("data/authors.json"));
const rawArticles = JSON.parse(read("data/articles.json"));

/* ---------- helpers ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const abs = (p) => site.url + p;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fmtLong = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const fmtShort = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const fmtDay = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const jsonLd = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

/* ---------- tiny markdown ---------- */
function inline(s) {
  let t = esc(s);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, b) => `<a href="${b}">${a}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  return t;
}
function markdown(src) {
  const lines = src.replace(/\r/g, "").split("\n");
  const out = [], headings = [];
  let i = 0, lastHeading = "Table";
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) {
      const level = m[1].length, text = m[2].trim(), id = slugify(text);
      if (level === 2) headings.push({ id, text });
      lastHeading = text;
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`); i++; continue;
    }
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]), body = rows.slice(2).map(cells);
      out.push(`<div class="table-wrap" role="region" aria-label="${esc(lastHeading)} (table)" tabindex="0"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c, ci) => ci === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) { items.push(lines[i].replace(/^-\s+/, "")); i++; }
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`); continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
      out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>`); continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|-\s|\d+\.\s|\|)/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return { html: out.join("\n"), headings };
}

/* ---------- content model ---------- */
const sections = site.sections.map((s) => ({ ...s, url: `/${s.slug}/` }));
const sectionBy = Object.fromEntries(sections.map((s) => [s.slug, s]));
const authorBy = Object.fromEntries(authors.map((a) => [a.slug, a]));

const articles = rawArticles.map((a) => {
  const body = markdown(read(`content/${a.slug}.md`));
  const words = read(`content/${a.slug}.md`).replace(/[#*|\-\[\]()]/g, " ").split(/\s+/).filter(Boolean).length;
  return {
    ...a,
    sectionName: sectionBy[a.section].name,
    authorName: authorBy[a.author].name,
    url: `/${a.section}/${a.slug}/`,
    body, words,
    readingMinutes: Math.max(1, Math.ceil(words / 200)),
    img: (w) => `/images/${a.slug}-${w}.webp`,
    og: `/images/og/${a.slug}.jpg`
  };
});
for (const a of articles) {
  if (!authorBy[a.author]) throw new Error(`Unknown author for ${a.id}`);
  if (a.updated < a.published) throw new Error(`Updated before published: ${a.id}`);
}
const byDate = [...articles].sort((x, y) => (x.published < y.published ? 1 : x.published > y.published ? -1 : x.id.localeCompare(y.id)));
const lead = articles.find((a) => a.featured);
const inSection = (slug) => byDate.filter((a) => a.section === slug);

/* ---------- components ---------- */
const meta = (a) => `<p class="meta"><time datetime="${a.published}">${fmtShort(a.published)}</time><span class="dot" aria-hidden="true">·</span><span>${a.readingMinutes} min read</span></p>`;
const picture = (a, { sizes, eager = false, alt = "" }) =>
  `<img src="${a.img(800)}" srcset="${a.img(480)} 480w, ${a.img(800)} 800w, ${a.img(1200)} 1200w" sizes="${sizes}" width="1200" height="675" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}>`;

function leadCard(a) {
  return `<article class="lead">
  <figure>
    <div class="thumb">${picture(a, { sizes: "(min-width: 64rem) 780px, 100vw", eager: true, alt: a.image.alt })}</div>
    <figcaption>Original illustration for The Parameter.</figcaption>
  </figure>
  <p class="category">${esc(a.category)}</p>
  <h2 class="lead-title"><a class="title-link stretched" href="${a.url}">${esc(a.headline)}</a></h2>
  <p class="summary">${esc(a.summary)}</p>
  <footer class="article-card__metadata"><p class="byline">By ${esc(a.authorName)}</p>${meta(a)}</footer>
</article>`;
}
function card(a, { level = 3, wide = false } = {}) {
  const sizes = wide ? "(min-width: 64rem) 560px, (min-width: 40rem) 60vw, 100vw" : "(min-width: 64rem) 400px, (min-width: 40rem) 50vw, 100vw";
  return `<article class="article-card${wide ? " article-card--wide" : ""}">
  <div class="thumb">${picture(a, { sizes })}</div>
  <p class="category">${esc(a.category)}</p>
  <h${level} class="article-card__title"><a class="title-link stretched" href="${a.url}">${esc(a.headline)}</a></h${level}>
  <p class="summary">${esc(a.summary)}</p>
  <footer class="article-card__metadata"><p class="byline">By ${esc(a.authorName)}</p>${meta(a)}</footer>
</article>`;
}
function compact(a, { level = 3, thumb = false } = {}) {
  return `<article class="compact${thumb ? " compact--thumb" : ""}">
  ${thumb ? `<div class="thumb">${picture(a, { sizes: "(min-width: 40rem) 160px, 120px" })}</div>` : ""}
  <p class="category">${esc(a.category)}</p>
  <h${level} class="compact__title"><a class="title-link stretched" href="${a.url}">${esc(a.headline)}</a></h${level}>
  ${meta(a)}
</article>`;
}
const li = (html) => `<li>${html}</li>`;

let formCount = 0;
function newsletterBand({ headingId, title, copy, level = 2 }) {
  const n = ++formCount;
  return `<section class="newsletter" aria-labelledby="${headingId}">
  <div class="container">
    <div class="newsletter-copy">
      <h${level} class="newsletter-title" id="${headingId}">${esc(title)}</h${level}>
      <p>${esc(copy)}</p>
    </div>
    <form class="newsletter-form" data-newsletter novalidate>
      <div class="field">
        <label for="nl-email-${n}">Email address</label>
        <input type="email" id="nl-email-${n}" name="email" autocomplete="email" inputmode="email" required aria-describedby="nl-hint-${n} nl-error-${n}" placeholder="name@example.com">
        <p class="hint" id="nl-hint-${n}">Enter the address where you want to receive the newsletter.</p>
        <p class="field-error" id="nl-error-${n}" hidden></p>
      </div>
      <button class="button" type="submit">Subscribe to the newsletter</button>
      <p class="form-status" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>`;
}

/* ---------- page shell ---------- */
const navItems = [
  ["Home", "/"], ...sections.map((s) => [s.name, s.url]), ["About", "/about/"], ["Newsletter", "/newsletter/"]
];
const footerLinks = [
  ["About", "/about/"], ["Contact", "/contact/"], ["Editorial Policy", "/editorial-policy/"], ["Privacy", "/privacy/"],
  ["Terms", "/terms/"], ["Newsletter", "/newsletter/"], ["Search", "/search/"], ["RSS feed", "/feed.xml"]
];

function shell({ title, description, urlPath, main, jsonldGraph, robots = "index,follow", ogType = "website", ogImage, preload = "", published, modified, bodyClass = "" }) {
  const canonical = abs(urlPath);
  const img = abs(ogImage || lead.og);
  const fullTitle = urlPath === "/" ? `${site.name}: ${site.tagline}` : `${title} | ${site.name}`;
  const nav = navItems.map(([label, href]) => `<li><a href="${href}"${href === urlPath ? ' aria-current="page"' : ""}>${label}</a></li>`).join("");
  const footerNav = footerLinks.map(([label, href]) => `<li><a href="${href}">${label}</a></li>`).join("");
  return `<!doctype html>
<html lang="${site.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}" href="/feed.xml">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
${published ? `<meta property="article:published_time" content="${published}">\n` : ""}${modified ? `<meta property="article:modified_time" content="${modified}">\n` : ""}<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/assets/fonts/newsreader-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
${preload}<link rel="stylesheet" href="/assets/css/site.css">
<script>document.documentElement.className+=" js"</script>
<script src="/assets/js/site.js" defer></script>
${jsonLd({ "@context": "https://schema.org", "@graph": jsonldGraph })}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
  <div class="dateline"><div class="container"><p><time datetime="${site.today}">${fmtDay(site.today)}</time></p><p class="dateline-note">Demonstration edition</p></div></div>
  <div class="masthead container">
    <a class="brand" href="/"><svg class="brand-mark" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#12161b"/><g stroke="#fff" stroke-width="2" stroke-linecap="round"><line x1="6" y1="10" x2="26" y2="10"/><line x1="6" y1="16" x2="26" y2="16"/><line x1="6" y1="22" x2="26" y2="22"/></g><circle cx="20" cy="10" r="3.5" fill="#00b8e6"/><circle cx="11" cy="16" r="3.5" fill="#fff"/><circle cx="17" cy="22" r="3.5" fill="#0052ff"/></svg><span class="brand-name">${esc(site.name)}</span></a>
    <div class="masthead-actions">
      <a class="button subscribe-link" href="/newsletter/">Subscribe</a>
      <button class="button button--ghost menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu">Menu</button>
    </div>
  </div>
  <div class="site-menu" id="site-menu">
    <div class="container menu-inner">
      <nav class="primary-nav" aria-label="Primary"><ul>${nav}</ul></nav>
      <search class="site-search">
        <form action="/search/" method="get">
          <label class="sr-only" for="site-search-q">Search articles</label>
          <input type="search" id="site-search-q" name="q" placeholder="Search articles" autocomplete="off" enterkeyhint="search">
          <button class="search-button" type="submit">Search</button>
        </form>
      </search>
    </div>
  </div>
</header>
<main id="main" tabindex="-1">
${main}
</main>
<footer class="site-footer">
  <div class="container">
    <div class="footer-about">
      <a class="brand" href="/"><span class="brand-name">${esc(site.name)}</span></a>
      <p>${esc(site.description)}</p>
    </div>
    <nav class="footer-nav" aria-label="Footer"><ul>${footerNav}</ul></nav>
    <div class="footer-legal">
      <p>${esc(site.demoNotice)}</p>
      <p>© 2026 ${esc(site.name)}. Template legal pages must be reviewed before launch.</p>
    </div>
  </div>
</footer>
</body>
</html>
`;
}

/* ---------- structured data ---------- */
const orgId = abs("/#organization");
const org = {
  "@type": "Organization", "@id": orgId, name: site.name, url: abs("/"),
  logo: { "@type": "ImageObject", url: abs("/images/logo-512.png"), width: 512, height: 512 },
  description: site.description
};
const breadcrumbLd = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(p) }))
});
const personLd = (a) => ({ "@type": "Person", "@id": abs(`/about/#${a.slug}`), name: a.name, jobTitle: a.role, url: abs(`/about/#${a.slug}`), worksFor: { "@id": orgId } });

/* ---------- pages ---------- */
const pages = []; // {path, html, lastmod, sitemap}
const addPage = (urlPath, html, opts = {}) => pages.push({ urlPath, html, lastmod: opts.lastmod || site.today, sitemap: opts.sitemap !== false });

function homePage() {
  const latest = byDate.filter((a) => a !== lead).slice(0, 5);
  const wideIds = new Set([articles[0].id, articles[5].id]);
  const topicCounts = {};
  articles.forEach((a) => a.tags.forEach((t) => (topicCounts[t] = (topicCounts[t] || 0) + 1)));
  const topics = Object.entries(topicCounts).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 14).map(([t]) => t);
  const related = articles.filter((a) => a !== lead).map((a) => ({ a, s: a.tags.filter((t) => lead.tags.includes(t)).length })).sort((x, y) => y.s - x.s || (x.a.published < y.a.published ? 1 : -1)).slice(0, 4).map((x) => x.a);
  const secHead = (id, title, slug, linkText) => `<div class="section-head"><h2 class="section-title" id="${id}">${title}</h2>${slug ? `<a class="section-link" href="/${slug}/">${linkText}<span class="sr-only"> articles</span></a>` : ""}</div>`;

  const main = `<h1 class="sr-only">${esc(site.name)}: AI news, trends, tools, research and guides</h1>
<div class="container front">
  <div class="front-lead">${leadCard(lead)}</div>
  <section class="front-latest" aria-labelledby="latest-h">
    <div class="section-head"><h2 class="section-title" id="latest-h">Latest AI news</h2></div>
    <ol class="compact-list">${latest.map((a) => li(compact(a))).join("")}</ol>
  </section>
</div>

<section class="section" aria-labelledby="ten-h">
  <div class="container">
    ${secHead("ten-h", "Ten stories to read now")}
    <p class="section-intro">One story from each corner of the field: news, infrastructure, agents, tools, model choice, marketing, research, governance, workflows and outlook.</p>
    <div class="card-grid">${articles.map((a) => card(a, { wide: wideIds.has(a.id) })).join("\n")}</div>
  </div>
</section>

<section class="section" aria-labelledby="trends-h">
  <div class="container">
    ${secHead("trends-h", "Emerging AI trends", "trends", "All trends")}
    <p class="section-intro">${esc(sectionBy.trends.description)}</p>
    <div class="split">${inSection("trends").map((a) => card(a)).join("")}</div>
  </div>
</section>

<section class="section" aria-labelledby="tools-h">
  <div class="container">
    ${secHead("tools-h", "AI tools discovery", "ai-tools", "All tools")}
    <div class="split split--aside">
      <div><ul class="compact-list">${inSection("ai-tools").map((a) => li(compact(a, { thumb: true }))).join("")}</ul></div>
      <div>
        <h3 class="panel-title">Five questions before adopting any AI tool</h3>
        <ol class="checklist">
          <li>Which task will it replace, and how long does that task take today?</li>
          <li>Can you test it on five questions whose answers you already know?</li>
          <li>Does it show its sources, and do the sources support the claims?</li>
          <li>Where does your data go, and how long is it kept?</li>
          <li>What does it cost per completed task, checked on the vendor’s own page today?</li>
        </ol>
      </div>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="research-h">
  <div class="container">
    ${secHead("research-h", "Research and industry analysis", "research", "All research")}
    <p class="section-intro">${esc(sectionBy.research.description)}</p>
    <ul class="compact-list split">${inSection("research").map((a) => li(compact(a, { thumb: true }))).join("")}</ul>
  </div>
</section>

<section class="section" aria-labelledby="guides-h">
  <div class="container">
    ${secHead("guides-h", "Practical AI guides", "guides", "All guides")}
    <p class="section-intro">${esc(sectionBy.guides.description)}</p>
    <div class="split">${inSection("guides").map((a) => card(a)).join("")}</div>
  </div>
</section>

${newsletterBand({ headingId: "newsletter-h", title: "Get the week’s AI developments, with the sources attached", copy: "A digest of what changed, what it means and what remains unverified. Each edition links to the primary documents so you can check the claims yourself." })}

<aside class="section" aria-labelledby="related-h">
  <div class="container split split--aside">
    <div class="aside-block">
      <h2 class="section-title" id="related-h">Related reading</h2>
      <p class="section-intro">More on the themes of the lead story: ${lead.tags.map(esc).join(", ")}.</p>
      <ul class="compact-list">${related.map((a) => li(compact(a))).join("")}</ul>
    </div>
    <div class="aside-block">
      <h2 class="panel-title">Topics in this edition</h2>
      <ul class="topic-list">${topics.map((t) => `<li><a href="/search/?q=${encodeURIComponent(t)}">${esc(t)}</a></li>`).join("")}</ul>
    </div>
  </div>
</aside>`;

  const graph = [
    org,
    { "@type": "WebSite", "@id": abs("/#website"), url: abs("/"), name: site.name, description: site.description, inLanguage: site.locale, publisher: { "@id": orgId },
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: abs("/search/?q={search_term_string}") }, "query-input": "required name=search_term_string" } },
    { "@type": "CollectionPage", "@id": abs("/#webpage"), url: abs("/"), name: `${site.name}: ${site.tagline}`, description: site.description, isPartOf: { "@id": abs("/#website") }, inLanguage: site.locale,
      mainEntity: { "@type": "ItemList", itemListOrder: "https://schema.org/ItemListOrderDescending", numberOfItems: articles.length,
        itemListElement: byDate.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: abs(a.url), name: a.headline })) } }
  ];
  const preload = `<link rel="preload" as="image" href="${lead.img(800)}" imagesrcset="${lead.img(480)} 480w, ${lead.img(800)} 800w, ${lead.img(1200)} 1200w" imagesizes="(min-width: 64rem) 780px, 100vw" fetchpriority="high">\n`;
  addPage("/", shell({ title: site.name, description: site.description, urlPath: "/", main, jsonldGraph: graph, preload }));
}

function sectionPage(s) {
  const list = inSection(s.slug);
  const tabs = `<nav class="section-tabs container" aria-label="Sections"><ul>${sections.map((x) => `<li><a href="${x.url}"${x.slug === s.slug ? ' aria-current="page"' : ""}>${esc(x.name)}</a></li>`).join("")}</ul></nav>`;
  const main = `<div class="container"><nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><span aria-current="page">${esc(s.name)}</span></li></ol></nav></div>
<div class="page-head"><div class="container"><h1 class="page-title">${esc(s.name)}</h1><p class="page-lede">${esc(s.description)}</p></div></div>
${tabs}
<section class="section" aria-labelledby="sec-list-h"><div class="container"><h2 class="sr-only" id="sec-list-h">${esc(s.name)} articles</h2>
<div class="card-grid">${list.map((a) => card(a, { level: 3 })).join("")}</div></div></section>
${newsletterBand({ headingId: "newsletter-h", title: "Follow the sources, not the noise", copy: "Get new analysis in your inbox with the primary documents linked." })}`;
  const graph = [org, { "@type": "CollectionPage", "@id": abs(s.url) + "#webpage", url: abs(s.url), name: s.name, description: s.description, isPartOf: { "@id": abs("/#website") },
    mainEntity: { "@type": "ItemList", numberOfItems: list.length, itemListElement: list.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: abs(a.url), name: a.headline })) } },
    breadcrumbLd([["Home", "/"], [s.name, s.url]])];
  addPage(s.url, shell({ title: s.name, description: s.description, urlPath: s.url, main, jsonldGraph: graph }));
}

function articlePage(a) {
  const s = sectionBy[a.section], au = authorBy[a.author];
  const headings = [...a.body.headings, { id: "sources", text: "Sources" }];
  const related = articles.filter((x) => x !== a).map((x) => ({ x, sc: (x.section === a.section ? 3 : 0) + x.tags.filter((t) => a.tags.includes(t)).length })).sort((p, q) => q.sc - p.sc || (p.x.published < q.x.published ? 1 : -1)).slice(0, 3).map((o) => o.x);
  const updated = a.updated !== a.published;
  const toc = headings.length >= 3 ? `<nav class="toc" aria-label="On this page"><p class="toc-title">On this page</p><ol>${headings.map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join("")}</ol></nav>` : "";
  const main = `<div class="container">
<nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="${s.url}">${esc(s.name)}</a></li><li><span aria-current="page">${esc(a.category)}</span></li></ol></nav>
<article>
  <header class="article-header">
    <p class="category">${esc(a.category)}</p>
    <h1 class="article-title">${esc(a.headline)}</h1>
    <p class="article-dek">${esc(a.summary)}</p>
    <div class="byline-block">
      <p>By <a href="/about/#${au.slug}" rel="author">${esc(au.name)}</a>, ${esc(au.role)}</p>
      <p>Published <time datetime="${a.published}">${fmtLong(a.published)}</time></p>
      ${updated ? `<p>Updated <time datetime="${a.updated}">${fmtLong(a.updated)}</time></p>` : ""}
      <p>${a.readingMinutes} min read</p>
    </div>
    <p class="notice">Demonstration article. It shows the publication’s editorial format and reports no real events, statistics, quotations or prices. The sources listed below are real, published documents.</p>
  </header>
  <figure class="article-hero">
    ${picture(a, { sizes: "(min-width: 80rem) 1176px, 100vw", eager: true, alt: a.image.alt })}
    <figcaption>${esc(a.image.alt)}. Original illustration for The Parameter.</figcaption>
  </figure>
  <div class="article-layout">
    ${toc}
    <div class="article-main">
      <div class="article-body">
${a.body.html}
      </div>
      <section class="sources" aria-labelledby="sources">
        <h2 id="sources">Sources</h2>
        <ol>${a.sources.map((src) => `<li><a href="${src.url}">${esc(src.title)}</a>. ${esc(src.publisher)}, ${src.year}.</li>`).join("")}</ol>
      </section>
      <footer class="article-footer">
        <p><strong>${esc(au.name)}</strong>, ${esc(au.role)}. ${esc(au.bio)}</p>
        <p>${updated ? `Last updated <time datetime="${a.updated}">${fmtLong(a.updated)}</time>. ` : ""}Spotted an error? See our <a href="/editorial-policy/#corrections">corrections policy</a>.</p>
        <p>More from <a href="${s.url}">${esc(s.name)}</a>.</p>
      </footer>
    </div>
  </div>
</article>
</div>
<aside class="related" aria-labelledby="related-h"><div class="container">
  <div class="section-head"><h2 class="section-title" id="related-h">Related articles</h2></div>
  <div class="card-grid">${related.map((x) => card(x, { level: 3 })).join("")}</div>
</div></aside>
${newsletterBand({ headingId: "newsletter-h", title: "Get the next analysis in your inbox", copy: "New articles, with the primary sources linked, delivered as a digest." })}`;
  const url = abs(a.url);
  const graph = [org, personLd(au),
    { "@type": a.contentType === "news-analysis" ? "NewsArticle" : "Article", "@id": url + "#article", headline: a.headline, description: a.summary,
      image: [abs(a.img(1200)), abs(a.og)], datePublished: a.published, dateModified: a.updated,
      author: { "@id": abs(`/about/#${au.slug}`) }, publisher: { "@id": orgId }, mainEntityOfPage: { "@type": "WebPage", "@id": url },
      articleSection: a.category, keywords: a.tags.join(", "), wordCount: a.words, inLanguage: site.locale, isAccessibleForFree: true,
      citation: a.sources.map((x) => ({ "@type": "CreativeWork", name: x.title, url: x.url })) },
    { "@type": "WebPage", "@id": url, url, name: a.headline, isPartOf: { "@id": abs("/#website") }, breadcrumb: { "@id": url + "#breadcrumb" } },
    { ...breadcrumbLd([["Home", "/"], [s.name, s.url], [a.category, a.url]]), "@id": url + "#breadcrumb" }];
  addPage(a.url, shell({ title: a.headline, description: a.summary, urlPath: a.url, main, jsonldGraph: graph, ogType: "article", ogImage: a.og, published: a.published, modified: a.updated }), { lastmod: a.updated });
}

function staticPage({ slug, title, description, body, schemaType = "WebPage", lede }) {
  const urlPath = `/${slug}/`;
  const main = `<div class="container"><nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><span aria-current="page">${esc(title)}</span></li></ol></nav>
<div class="page-head" style="border-bottom:0;padding-bottom:0"><h1 class="page-title">${esc(title)}</h1>${lede ? `<p class="page-lede">${esc(lede)}</p>` : ""}</div>
<div class="prose">${body}</div></div>`;
  const graph = [org, { "@type": schemaType, "@id": abs(urlPath) + "#webpage", url: abs(urlPath), name: title, description, isPartOf: { "@id": abs("/#website") } }, breadcrumbLd([["Home", "/"], [title, urlPath]])];
  addPage(urlPath, shell({ title, description, urlPath, main, jsonldGraph: graph }));
}

const templateNotice = `<p class="notice">Template text. Replace the bracketed details and have the page reviewed before launch. It is not legal advice.</p>`;

function buildStatic() {
  staticPage({
    slug: "about", title: "About The Parameter", schemaType: "AboutPage",
    description: "The Parameter is an independent AI publication covering news, trends, tools and research, with every claim tied to a source.",
    lede: "An AI publication that shows its sources.",
    body: `<p>${esc(site.name)} covers artificial intelligence for readers who want to understand what is happening, find tools worth testing and turn new developments into practical knowledge. We explain models, infrastructure, agents, research and regulation in plain language, and we link every significant claim to the document it came from.</p>
<p class="notice">${esc(site.demoNotice)}</p>
<h2>What we cover</h2>
<ul>${sections.map((s) => `<li><a href="${s.url}">${esc(s.name)}</a>: ${esc(s.description)}</li>`).join("")}</ul>
<h2>How we work</h2>
<ul><li>We prefer primary sources: papers, filings, official data and original statements.</li><li>Dates are visible on every article, with updates labeled.</li><li>We separate what was measured from what was concluded.</li><li>We say plainly what remains unverified.</li><li>Corrections are published with the article, as described in our <a href="/editorial-policy/">editorial policy</a>.</li></ul>
<h2>The team</h2>
${authors.map((p) => `<h3 id="${p.slug}">${esc(p.name)}</h3><p><strong>${esc(p.role)}.</strong> ${esc(p.bio)}</p>`).join("")}`
  });
  staticPage({
    slug: "contact", title: "Contact", schemaType: "ContactPage",
    description: "How to reach The Parameter editors with story tips, corrections and press enquiries.",
    lede: "Story tips, corrections and press enquiries.",
    body: `<h2>Email the editors</h2><p><a href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a></p>
<p>Include links to any sources. For a correction, include the article title, the sentence in question and the document that shows the right information.</p>
<p class="notice">Placeholder address. Set <code>contactEmail</code> in <code>data/site.json</code> to a monitored inbox before launch.</p>`
  });
  staticPage({
    slug: "editorial-policy", title: "Editorial Policy",
    description: "How The Parameter sources, verifies, corrects and discloses its AI coverage.",
    lede: "How we decide what to publish and how we fix what we get wrong.",
    body: `<p class="notice">Starting template. Edit this policy so that it describes your newsroom’s real practice before publication.</p>
<h2 id="sourcing">Sourcing</h2><p>We link primary sources wherever they exist. When we rely on a secondary report, we say so and link to it. We do not cite sources we have not opened.</p>
<h2 id="verification">Verification</h2><p>Statistics, quotations, dates, prices and names are checked against the source before publication. If a claim cannot be verified, we leave it out or label it as unverified.</p>
<h2 id="numbers">Numbers and quotations</h2><p>We never invent figures, quotations or findings. Prices change often, so we link to the vendor’s own page and note the date we checked.</p>
<h2 id="corrections">Corrections and updates</h2><p>When we find an error, we correct it in the article, state what changed and show the update date. Send corrections to <a href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a>.</p>
<h2 id="ai-use">Use of AI in our work</h2><p>[Describe whether and how AI tools assist research, drafting or editing, and who is accountable for the final text.]</p>
<h2 id="independence">Independence</h2><p>[Describe how you handle sponsorships, affiliate links, vendor access and conflicts of interest.]</p>`
  });
  staticPage({
    slug: "privacy", title: "Privacy",
    description: "What The Parameter collects, how the newsletter and search work, and how to contact us about your data.",
    body: `${templateNotice}
<h2>What this site collects</h2><p>The site as built includes no analytics, advertising scripts or tracking cookies, and it serves its fonts from its own domain. Your host’s server logs may record standard request data such as IP address and user agent.</p>
<h2>Search</h2><p>Search runs in your browser against a list of articles that the page downloads. Your search terms are not sent to a search service.</p>
<h2>Newsletter</h2><p>If you subscribe, your email address is sent to [name your email service provider], which sends the newsletter on our behalf. [State what you store, how long you keep it, and how readers unsubscribe.]</p>
<h2>Your rights</h2><p>[Describe how readers can request access to, correction of or deletion of their data, and the legal basis you rely on in your jurisdiction.]</p>
<h2>Contact</h2><p>Questions about privacy: <a href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a>.</p>`
  });
  staticPage({
    slug: "terms", title: "Terms of Use",
    description: "Terms that apply to using The Parameter website and its content.",
    body: `${templateNotice}
<h2>Use of the site</h2><p>You may read and share links to articles. Do not scrape the site in a way that harms its operation or republish articles without permission.</p>
<h2>Content</h2><p>Articles are published for information, not as professional, legal or financial advice. We work to keep them accurate and publish corrections, but we cannot guarantee that every statement is complete or current.</p>
<h2>Third-party links</h2><p>We link to external sources. We do not control them and are not responsible for their content.</p>
<h2>Changes</h2><p>We may update these terms. The date of the latest revision will appear here. [Add revision date, governing law and operator details.]</p>`
  });
}

function newsletterPage() {
  const main = `<div class="container"><nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><span aria-current="page">Newsletter</span></li></ol></nav>
<div class="page-head" style="border-bottom:0;padding-bottom:0"><h1 class="page-title">The Parameter newsletter</h1><p class="page-lede">The week’s AI developments in one digest, with the primary sources linked.</p></div>
<div class="prose"><h2>What each edition contains</h2><ul><li>The developments that mattered, and what was verified.</li><li>One tool or method worth testing on your own work.</li><li>A short list of papers and documents to read in full.</li></ul>
<p class="notice">${site.newsletter.endpoint ? "Subscriptions are handled by the configured email service." : "Subscriptions are not configured on this demonstration site. The form below checks your address and tells you that nothing was sent."}</p></div></div>
${newsletterBand({ headingId: "newsletter-h", title: "Subscribe", copy: "Enter your email address to receive the newsletter." })}`;
  const graph = [org, { "@type": "WebPage", "@id": abs("/newsletter/") + "#webpage", url: abs("/newsletter/"), name: "The Parameter newsletter", description: "Subscribe to The Parameter newsletter.", isPartOf: { "@id": abs("/#website") } }, breadcrumbLd([["Home", "/"], ["Newsletter", "/newsletter/"]])];
  addPage("/newsletter/", shell({ title: "Newsletter", description: "Subscribe to The Parameter for a weekly digest of AI developments with the primary sources linked.", urlPath: "/newsletter/", main, jsonldGraph: graph, bodyClass: "newsletter-page" }));
}

function searchPage() {
  const main = `<div class="container"><nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><span aria-current="page">Search</span></li></ol></nav>
<div class="page-head" style="border-bottom:0;padding-bottom:0"><h1 class="page-title">Search</h1><p class="page-lede">Search headlines, summaries, topics and authors.</p></div>
<search>
<form class="search-form" id="search-page-form" action="/search/" method="get">
  <div class="row">
    <div><label for="search-page-q">Search terms</label>
    <input type="search" id="search-page-q" name="q" autocomplete="off" enterkeyhint="search"></div>
    <div class="filters"><div><label for="search-section">Section</label>
    <select id="search-section" name="section"><option value="">All sections</option>${sections.map((s) => `<option value="${s.slug}">${esc(s.name)}</option>`).join("")}</select></div>
    <button class="button" type="submit" style="align-self:end">Search</button></div>
  </div>
</form>
</search>
<noscript><p class="notice">Live search needs JavaScript. You can browse every article in the list below.</p></noscript>
<p class="results-status" id="search-status" role="status" aria-live="polite"></p>
<h2 class="sr-only">Results</h2>
<ol class="results-list" id="search-results"></ol>
<section class="section" id="search-fallback" aria-labelledby="all-h" style="border-top:0"><h2 class="section-title" id="all-h" style="margin-bottom:var(--s5)">All articles</h2>
<ol class="results-list">${byDate.map((a) => li(compact(a, { thumb: true, level: 3 }))).join("")}</ol></section></div>`;
  const graph = [org, { "@type": "SearchResultsPage", "@id": abs("/search/") + "#webpage", url: abs("/search/"), name: "Search", isPartOf: { "@id": abs("/#website") } }];
  addPage("/search/", shell({ title: "Search", description: "Search The Parameter for AI news, trends, tools, research and guides.", urlPath: "/search/", main, jsonldGraph: graph, robots: "noindex,follow" }), { sitemap: false });
}

function notFoundPage() {
  const main = `<div class="container"><div class="page-head" style="border-bottom:0"><p class="category">Error 404</p><h1 class="page-title">That page could not be found</h1><p class="page-lede">The link may be old or mistyped. Try the <a href="/">front page</a>, <a href="/search/">search</a> or one of the sections.</p></div>
<nav class="section-tabs" aria-label="Sections"><ul>${sections.map((s) => `<li><a href="${s.url}">${esc(s.name)}</a></li>`).join("")}</ul></nav></div>`;
  addPage("/404.html", shell({ title: "Page not found", description: "The page you requested could not be found. Try the front page, search, or one of the sections.", urlPath: "/404.html", main, jsonldGraph: [org], robots: "noindex,follow" }), { sitemap: false });
}

/* ---------- build ---------- */
async function main() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(path.join(dist, "assets/fonts"), { recursive: true });
  fs.mkdirSync(path.join(dist, "assets/css"), { recursive: true });
  fs.mkdirSync(path.join(dist, "assets/js"), { recursive: true });
  fs.mkdirSync(path.join(dist, "images/og"), { recursive: true });

  // assets
  const fonts = [
    ["node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2", "newsreader-latin-wght-normal.woff2"],
    ["node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2", "newsreader-latin-wght-italic.woff2"],
    ["node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", "inter-latin-wght-normal.woff2"]
  ];
  for (const [src, name] of fonts) fs.copyFileSync(path.join(root, src), path.join(dist, "assets/fonts", name));
  fs.copyFileSync(path.join(root, "assets/css/site.css"), path.join(dist, "assets/css/site.css"));
  const cfg = { newsletterEndpoint: site.newsletter.endpoint, newsletterMethod: site.newsletter.method, newsletterEmailField: site.newsletter.emailField };
  fs.writeFileSync(path.join(dist, "assets/js/site.js"), `window.PARAMETER_CONFIG=${JSON.stringify(cfg)};\n` + read("assets/js/site.js"));

  // images
  fs.writeFileSync(path.join(dist, "favicon.svg"), logoSvg);
  fs.writeFileSync(path.join(dist, "images/logo.svg"), logoSvg);
  const logoBuf = Buffer.from(logoSvg.replace('width="32" height="32"', 'width="512" height="512"'));
  await sharp(logoBuf, { density: 1152 }).resize(512, 512).png().toFile(path.join(dist, "images/logo-512.png"));
  await sharp(logoBuf, { density: 1152 }).resize(180, 180).png().toFile(path.join(dist, "apple-touch-icon.png"));
  for (const a of articles) {
    const svg = Buffer.from(artSvg(a.image.motif, a.image.seed));
    for (const w of [480, 800, 1200]) await sharp(svg, { density: 144 }).resize(w).webp({ quality: 80 }).toFile(path.join(dist, a.img(w)));
    await sharp(svg, { density: 144 }).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 82 }).toFile(path.join(dist, a.og));
  }

  // pages
  homePage();
  sections.forEach(sectionPage);
  articles.forEach(articlePage);
  buildStatic();
  newsletterPage();
  searchPage();
  notFoundPage();

  for (const p of pages) {
    const file = p.urlPath.endsWith("/") ? path.join(dist, p.urlPath, "index.html") : path.join(dist, p.urlPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, p.html);
  }

  // search index, sitemap, robots, feed
  const index = articles.map((a) => ({ id: a.id, headline: a.headline, summary: a.summary, category: a.category, section: a.section, sectionName: a.sectionName, tags: a.tags, authorName: a.authorName, url: a.url, thumb: a.img(480), published: a.published, publishedLabel: fmtShort(a.published), readingMinutes: a.readingMinutes }));
  fs.writeFileSync(path.join(dist, "assets/search-index.json"), JSON.stringify(index));
  const urls = pages.filter((p) => p.sitemap).map((p) => `  <url><loc>${abs(p.urlPath)}</loc><lastmod>${p.lastmod}</lastmod></url>`).join("\n");
  fs.writeFileSync(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  fs.writeFileSync(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /search/\n\nSitemap: ${abs("/sitemap.xml")}\n`);
  const items = byDate.map((a) => `    <item><title>${esc(a.headline)}</title><link>${abs(a.url)}</link><guid isPermaLink="true">${abs(a.url)}</guid><pubDate>${new Date(a.published + "T00:00:00Z").toUTCString()}</pubDate><category>${esc(a.category)}</category><description>${esc(a.summary)}</description></item>`).join("\n");
  fs.writeFileSync(path.join(dist, "feed.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(site.name)}</title><link>${abs("/")}</link><description>${esc(site.description)}</description><language>en</language>\n${items}\n</channel></rss>\n`);

  console.log(`Built ${pages.length} pages, ${articles.length} articles → dist/`);
}
main();
