// ==============================================================================
// The Parameter: Static Publishing & GitHub Pages Sync Engine
// Path: scripts/publish_engine.mjs
// Description: Compiles Supabase / AI Agent article payloads into pure static HTML,
//              generates SEO & Geo JSON-LD schema, and updates sitemap.xml, feed.xml,
//              and index.html matching The Parameter's exact design system.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Format a Date object into human readable format: e.g. "Oct 21, 2026"
 */
function formatDateShort(isoString) {
  const d = new Date(isoString || Date.now());
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format a Date object into ISO date: "2026-10-21"
 */
function formatDateISO(isoString) {
  const d = new Date(isoString || Date.now());
  return d.toISOString().split('T')[0];
}

/**
 * Extract H2 headings from HTML content to generate Table of Contents
 */
function extractHeadings(html) {
  const regex = /<h2\s+id="([^"]+)">([^<]+)<\/h2>/gi;
  const headings = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({ id: match[1], text: match[2] });
  }
  return headings;
}

/**
 * Generate Schema.org JSON-LD graph with SEO and Geo targeting
 */
export function buildSchemaGraph(article) {
  const catSlug = article.category.toLowerCase().replace(/\s+/g, '-');
  const canonicalUrl = `https://aiparameter.github.io/${catSlug}/${article.slug}/`;
  const orgId = 'https://aiparameter.github.io/#organization';
  const authorSlug = (article.author_name || 'Amara Ellison').toLowerCase().replace(/\s+/g, '-');
  const authorId = `https://aiparameter.github.io/about/#${authorSlug}`;
  const pubDate = formatDateISO(article.published_at);

  const graph = [
    {
      '@type': 'Organization',
      '@id': orgId,
      name: 'The Parameter',
      url: 'https://aiparameter.github.io/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://aiparameter.github.io/images/logo-512.png',
        width: 512,
        height: 512
      },
      description: 'The Parameter is an AI publication covering news, trends, tools, model releases, research and practical applications, with every claim tied to a source.'
    },
    {
      '@type': 'Person',
      '@id': authorId,
      name: article.author_name || 'Amara Ellison',
      jobTitle: article.author_role || 'Senior Editor, Models and Industry',
      url: article.author_url || 'https://aiparameter.github.io/about/',
      worksFor: { '@id': orgId }
    }
  ];

  // NewsArticle / BlogPosting Schema
  const articleEntity = {
    '@type': article.schema_type || 'NewsArticle',
    '@id': `${canonicalUrl}#article`,
    headline: article.title,
    description: article.dek || article.meta_description || '',
    image: article.featured_image_url ? [article.featured_image_url] : ['https://aiparameter.github.io/images/og/inside-the-new-ai-model.jpg'],
    datePublished: pubDate,
    dateModified: pubDate,
    author: { '@id': authorId },
    publisher: { '@id': orgId },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl
    },
    articleSection: article.category,
    keywords: article.primary_keyword || (article.tags || []).join(', '),
    wordCount: article.word_count || 600,
    inLanguage: 'en',
    isAccessibleForFree: true
  };

  // Add citations if present
  if (Array.isArray(article.citations) && article.citations.length > 0) {
    articleEntity.citation = article.citations.map(c => ({
      '@type': 'CreativeWork',
      name: c.name,
      url: c.url
    }));
  }

  // Add Geo-Optimization schema if enabled
  if (article.geo_enabled || article.geo?.enabled) {
    const geo = article.geo || {
      target_country: article.geo_target_country,
      target_region: article.geo_target_region,
      target_city: article.geo_target_city,
      placename: article.geo_placename,
      latitude: article.geo_latitude,
      longitude: article.geo_longitude
    };

    const place = {
      '@type': 'Place',
      name: geo.placename || geo.target_city || geo.target_country || 'Global Location'
    };

    if (geo.target_city || geo.target_country) {
      place.address = {
        '@type': 'PostalAddress',
        ...(geo.target_city ? { addressLocality: geo.target_city } : {}),
        ...(geo.target_region ? { addressRegion: geo.target_region } : {}),
        ...(geo.target_country ? { addressCountry: geo.target_country } : {})
      };
    }

    if (geo.latitude && geo.longitude) {
      place.geo = {
        '@type': 'GeoCoordinates',
        latitude: parseFloat(geo.latitude),
        longitude: parseFloat(geo.longitude)
      };
    }

    articleEntity.contentLocation = place;

    if (geo.target_country) {
      articleEntity.spatialCoverage = {
        '@type': 'Place',
        name: geo.target_country
      };
    }
  }

  graph.push(articleEntity);

  // Add FAQPage Schema if FAQs exist
  const faqs = article.faqs || [];
  if (Array.isArray(faqs) && faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonicalUrl}#faq`,
      mainEntity: faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer
        }
      }))
    });
  }

  // Add Breadcrumb schema
  graph.push({
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://aiparameter.github.io/' },
      { '@type': 'ListItem', 'position': 2, 'name': article.category, 'item': `https://aiparameter.github.io/${catSlug}/` },
      { '@type': 'ListItem', 'position': 3, 'name': article.title, 'item': canonicalUrl }
    ]
  });

  return {
    '@context': 'https://schema.org',
    '@graph': graph
  };
}

/**
 * Generate full HTML page for the article
 */
export function renderArticleHtml(article) {
  const catSlug = article.category.toLowerCase().replace(/\s+/g, '-');
  const canonicalUrl = `https://aiparameter.github.io/${catSlug}/${article.slug}/`;
  const pubDateFormatted = formatDateShort(article.published_at);
  const pubDateISO = formatDateISO(article.published_at);
  const schemaJson = JSON.stringify(buildSchemaGraph(article));
  const headings = extractHeadings(article.content_html);

  const heroImage = article.featured_image_url || '/images/inside-the-new-ai-model-800.webp';
  const heroAlt = article.featured_image_alt || article.title;
  const heroCaption = article.featured_image_caption || `Illustration for ${article.title}. Original for The Parameter.`;

  // Render FAQs HTML accordion if present
  let faqsHtml = '';
  if (Array.isArray(article.faqs) && article.faqs.length > 0) {
    faqsHtml = `
      <section class="article-faqs" id="faqs" aria-labelledby="faqs-heading" style="margin-top: 2.5rem; padding-top: 2rem; border-top: 1px solid var(--border-color, #232a35);">
        <h2 id="faqs-heading" style="font-size: 1.5rem; margin-bottom: 1.25rem;">Frequently Asked Questions</h2>
        <div class="faq-list">
          ${article.faqs.map(faq => `
            <details class="faq-item" style="margin-bottom: 1rem; padding: 1rem; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px;">
              <summary style="font-weight: 600; cursor: pointer; color: #fff;">${faq.question}</summary>
              <div class="faq-answer" style="margin-top: 0.75rem; color: #b0b8c4; line-height: 1.6;">
                <p>${faq.answer}</p>
              </div>
            </details>
          `).join('')}
        </div>
      </section>
    `;
  }

  // Render Geo Info Badge if present
  let geoHtml = '';
  if (article.geo_enabled || article.geo?.enabled) {
    const city = article.geo?.target_city || article.geo_target_city || '';
    const region = article.geo?.target_region || article.geo_target_region || '';
    const country = article.geo?.target_country || article.geo_target_country || '';
    const locText = [city, region, country].filter(Boolean).join(', ');
    if (locText) {
      geoHtml = `
        <div class="geo-badge" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: #00b8e6; margin-top: 0.5rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span>Coverage region: ${locText}</span>
        </div>
      `;
    }
  }

  // Render Citations / Sources HTML if present
  let sourcesHtml = '';
  if (Array.isArray(article.citations) && article.citations.length > 0) {
    sourcesHtml = `
      <section class="sources" aria-labelledby="sources">
        <h2 id="sources">Sources</h2>
        <ol>
          ${article.citations.map(c => `<li><a href="${c.url}" target="_blank" rel="noopener">${c.name}</a></li>`).join('')}
        </ol>
      </section>
    `;
  }

  // Render Table of Contents
  let tocHtml = '';
  if (headings.length > 0) {
    tocHtml = `
      <nav class="toc" aria-label="On this page">
        <p class="toc-title">On this page</p>
        <ol>
          ${headings.map(h => `<li><a href="#${h.id}">${h.text}</a></li>`).join('')}
          ${article.faqs?.length ? `<li><a href="#faqs-heading">Frequently Asked Questions</a></li>` : ''}
          ${article.citations?.length ? `<li><a href="#sources">Sources</a></li>` : ''}
        </ol>
      </nav>
    `;
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${article.meta_title || `${article.title} | The Parameter`}</title>
<meta name="description" content="${article.meta_description || article.dek || ''}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonicalUrl}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="The Parameter" href="/feed.xml">
<meta property="og:site_name" content="The Parameter">
<meta property="og:type" content="article">
<meta property="og:title" content="${article.title}">
<meta property="og:description" content="${article.meta_description || article.dek || ''}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:image" content="${heroImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="article:published_time" content="${pubDateISO}">
<meta property="article:modified_time" content="${pubDateISO}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/assets/fonts/newsreader-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css">
<script>document.documentElement.className+=" js"</script>
<script src="/assets/js/site.js" defer></script>
<script type="application/ld+json">${schemaJson}</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
  <div class="dateline"><div class="container"><p><time datetime="${pubDateISO}">${pubDateFormatted}</time></p><p class="dateline-note">Live edition</p></div></div>
  <div class="masthead container">
    <a class="brand" href="/"><svg class="brand-mark" aria-hidden="true" focusable="false" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#12161b"/><g stroke="#fff" stroke-width="2" stroke-linecap="round"><line x1="6" y1="10" x2="26" y2="10"/><line x1="6" y1="16" x2="26" y2="16"/><line x1="6" y1="22" x2="26" y2="22"/></g><circle cx="20" cy="10" r="3.5" fill="#00b8e6"/><circle cx="11" cy="16" r="3.5" fill="#fff"/><circle cx="17" cy="22" r="3.5" fill="#0052ff"/></svg><span class="brand-name">The Parameter</span></a>
    <div class="masthead-actions">
      <a class="button subscribe-link" href="/newsletter/">Subscribe</a>
      <button class="button button--ghost menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu">Menu</button>
    </div>
  </div>
  <div class="site-menu" id="site-menu">
    <div class="container menu-inner">
      <nav class="primary-nav" aria-label="Primary"><ul><li><a href="/">Home</a></li><li><a href="/ai-news/">AI News</a></li><li><a href="/trends/">Trends</a></li><li><a href="/ai-tools/">AI Tools</a></li><li><a href="/research/">Research</a></li><li><a href="/guides/">Guides</a></li><li><a href="/about/">About</a></li><li><a href="/newsletter/">Newsletter</a></li></ul></nav>
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
<div class="container">
<nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/${catSlug}/">${article.category}</a></li><li><span aria-current="page">${article.category}</span></li></ol></nav>
<article>
  <header class="article-header">
    <p class="category">${article.category}</p>
    <h1 class="article-title">${article.title}</h1>
    ${article.dek ? `<p class="article-dek">${article.dek}</p>` : ''}
    <div class="byline-block">
      <p>By <a href="${article.author_url || '/about/'}" rel="author">${article.author_name || 'The Parameter Staff'}</a>, ${article.author_role || 'Senior Editor'}</p>
      <p>Published <time datetime="${pubDateISO}">${pubDateFormatted}</time></p>
      <p>${article.read_time_minutes || 3} min read</p>
    </div>
    ${geoHtml}
  </header>
  <figure class="article-hero">
    <img src="${heroImage}" width="1200" height="675" alt="${heroAlt}" fetchpriority="high">
    <figcaption>${heroCaption}</figcaption>
  </figure>
  <div class="article-layout">
    ${tocHtml}
    <div class="article-main">
      <div class="article-body">
${article.content_html}
${faqsHtml}
      </div>
      ${sourcesHtml}
      <footer class="article-footer">
        <p><strong>${article.author_name || 'The Parameter Staff'}</strong>, ${article.author_role || 'Senior Editor'}. Independent AI analysis.</p>
        <p>Spotted an error? See our <a href="/editorial-policy/#corrections">corrections policy</a>.</p>
        <p>More from <a href="/${catSlug}/">${article.category}</a>.</p>
      </footer>
    </div>
  </div>
</article>
</div>
</main>
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand"><p class="footer-title">The Parameter</p><p class="footer-summary">Independent coverage of AI models, tools and research. Every claim tied to a source.</p></div>
      <div class="footer-nav"><p class="footer-heading">Sections</p><ul><li><a href="/ai-news/">AI News</a></li><li><a href="/trends/">Trends</a></li><li><a href="/ai-tools/">AI Tools</a></li><li><a href="/research/">Research</a></li><li><a href="/guides/">Guides</a></li></ul></div>
      <div class="footer-nav"><p class="footer-heading">About</p><ul><li><a href="/about/">About us</a></li><li><a href="/editorial-policy/">Editorial policy</a></li><li><a href="/contact/">Contact</a></li><li><a href="/newsletter/">Newsletter</a></li><li><a href="/feed.xml">RSS feed</a></li></ul></div>
      <div class="footer-nav"><p class="footer-heading">Legal</p><ul><li><a href="/privacy/">Privacy policy</a></li><li><a href="/terms/">Terms of service</a></li></ul></div>
    </div>
    <div class="footer-bottom"><p class="copyright">&copy; 2026 The Parameter. All rights reserved.</p></div>
  </div>
</footer>
</body>
</html>`;
}

/**
 * Publish an article to the static filesystem and update sitemap/feed/index
 */
export async function publishArticleToStatic(article) {
  const catSlug = article.category.toLowerCase().replace(/\s+/g, '-');
  const targetDir = path.join(ROOT_DIR, catSlug, article.slug);
  const targetFile = path.join(targetDir, 'index.html');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. Render and write article HTML
  const html = renderArticleHtml(article);
  fs.writeFileSync(targetFile, html, 'utf-8');
  console.log(`[PublishEngine] Generated: ${targetFile}`);

  // 2. Update sitemap.xml
  updateSitemap(article, catSlug);

  // 3. Update feed.xml
  updateFeed(article, catSlug);

  return {
    success: true,
    file: targetFile,
    url: `https://aiparameter.github.io/${catSlug}/${article.slug}/`
  };
}

/**
 * Update sitemap.xml
 */
function updateSitemap(article, catSlug) {
  const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) return;

  const url = `https://aiparameter.github.io/${catSlug}/${article.slug}/`;
  const pubDate = formatDateISO(article.published_at);
  let content = fs.readFileSync(sitemapPath, 'utf-8');

  // Check if entry already exists
  if (content.includes(`<loc>${url}</loc>`)) {
    content = content.replace(
      new RegExp(`<url>\\s*<loc>${url}<\\/loc>[\\s\\S]*?<\\/url>`),
      `<url><loc>${url}</loc><lastmod>${pubDate}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`
    );
  } else {
    const entry = `  <url>\n    <loc>${url}</loc>\n    <lastmod>${pubDate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n</urlset>`;
    content = content.replace('</urlset>', entry);
  }

  fs.writeFileSync(sitemapPath, content, 'utf-8');
  console.log(`[PublishEngine] Updated sitemap.xml with ${url}`);
}

/**
 * Update feed.xml (RSS)
 */
function updateFeed(article, catSlug) {
  const feedPath = path.join(ROOT_DIR, 'feed.xml');
  if (!fs.existsSync(feedPath)) return;

  const url = `https://aiparameter.github.io/${catSlug}/${article.slug}/`;
  const pubDateRFC = new Date(article.published_at || Date.now()).toUTCString();
  let content = fs.readFileSync(feedPath, 'utf-8');

  const item = `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${pubDateRFC}</pubDate>
      <description>${escapeXml(article.dek || article.meta_description || '')}</description>
      <category>${escapeXml(article.category)}</category>
    </item>\n  </channel>`;

  if (!content.includes(`<guid>${url}</guid>`)) {
    content = content.replace(/<\/channel>/i, `${item}`);
    fs.writeFileSync(feedPath, content, 'utf-8');
    console.log(`[PublishEngine] Updated feed.xml with ${url}`);
  }
}

function escapeXml(unsafe) {
  return (unsafe || '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}
