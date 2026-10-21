# The Parameter

Static AI-news publication. Node 22, no framework. `npm run build` writes `dist/`; `npm run serve` previews at http://localhost:4173.

## Structure
- `data/site.json` site config, sections, newsletter endpoint, demo notice
- `data/articles.json` article model (id, slug, section, category, contentType, headline, summary, author, published, updated, image+alt, featured, tags, sources)
- `content/<slug>.md` article bodies (## headings, lists, tables, links)
- `src/build.mjs` components (lead, card, compact), templates, JSON-LD, sitemap, robots, RSS, search index
- `src/art.mjs` original generative illustrations (rasterized to WebP with sharp)
- `assets/` CSS design system and progressive-enhancement JS

## Before launch
1. Set `url` and `contactEmail` in `data/site.json` (currently placeholders).
2. Set `newsletter.endpoint` to your email service's form-post URL. Until then the form says nothing was sent.
3. Replace demonstration articles, bylines and the legal-page templates.
4. Re-run `npm run build`, `npm run validate`, `npm run audit`.
