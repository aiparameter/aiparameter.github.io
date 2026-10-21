// ==============================================================================
// The Parameter: Supabase Edge Function - Autonomous AI Article Publishing API
// Path: supabase/functions/publish-article/index.ts
// Runtime: Deno / Supabase Edge Runtime
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface GeoPayload {
  enabled?: boolean;
  target_country?: string;
  target_region?: string;
  target_city?: string;
  placename?: string;
  latitude?: number;
  longitude?: number;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface CitationItem {
  name: string;
  url: string;
}

interface ArticlePayload {
  title: string;
  slug?: string;
  dek?: string;
  content_markdown: string;
  content_html?: string;
  category?: string;
  tags?: string[];
  author_name?: string;
  author_role?: string;
  author_url?: string;
  featured_image_url?: string;
  featured_image_alt?: string;
  featured_image_caption?: string;
  meta_title?: string;
  meta_description?: string;
  primary_keyword?: string;
  secondary_keywords?: string[];
  geo?: GeoPayload;
  faqs?: FaqItem[];
  citations?: CitationItem[];
  schema_type?: "NewsArticle" | "BlogPosting" | "TechArticle";
  publish_immediately?: boolean;
}

// Simple slug generator
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Estimate reading time (average 200 words per minute)
function estimateReadingTime(text: string): { wordCount: number; minutes: number } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return { wordCount, minutes };
}

// Convert simple markdown headings, lists, bold to HTML if not provided
function simpleMarkdownToHtml(md: string): string {
  let html = md
    .replace(/### (.*$)/gim, '<h3 id="$1">$1</h3>')
    .replace(/## (.*$)/gim, '<h2 id="$1">$1</h2>')
    .replace(/# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\[([^\[]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
    .replace(/\n\n/gim, '</p><p>');

  return `<p>${html}</p>`;
}

// Generate comprehensive Schema.org JSON-LD graph with SEO and Geo targeting
function generateSchemaGraph(article: {
  slug: string;
  title: string;
  dek: string;
  category: string;
  author_name: string;
  author_role: string;
  author_url: string;
  featured_image_url: string;
  published_at: string;
  word_count: number;
  primary_keyword: string;
  geo?: GeoPayload;
  faqs?: FaqItem[];
  citations?: CitationItem[];
  schema_type: string;
}) {
  const canonicalUrl = `https://aiparameter.github.io/${article.category.toLowerCase().replace(/\s+/g, "-")}/${article.slug}/`;
  const orgId = "https://aiparameter.github.io/#organization";
  const authorSlug = article.author_name.toLowerCase().replace(/\s+/g, "-");
  const authorId = `https://aiparameter.github.io/about/#${authorSlug}`;

  const graph: any[] = [
    {
      "@type": "Organization",
      "@id": orgId,
      "name": "The Parameter",
      "url": "https://aiparameter.github.io/",
      "logo": {
        "@type": "ImageObject",
        "url": "https://aiparameter.github.io/images/logo-512.png",
        "width": 512,
        "height": 512
      },
      "description": "The Parameter is an AI publication covering news, trends, tools, model releases, research and practical applications, with every claim tied to a source."
    },
    {
      "@type": "Person",
      "@id": authorId,
      "name": article.author_name,
      "jobTitle": article.author_role || "Senior Editor",
      "url": article.author_url || "https://aiparameter.github.io/about/",
      "worksFor": { "@id": orgId }
    }
  ];

  // Base Article schema
  const articleEntity: any = {
    "@type": article.schema_type || "NewsArticle",
    "@id": `${canonicalUrl}#article`,
    "headline": article.title,
    "description": article.dek,
    "image": article.featured_image_url ? [article.featured_image_url] : [],
    "datePublished": article.published_at,
    "dateModified": article.published_at,
    "author": { "@id": authorId },
    "publisher": { "@id": orgId },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalUrl
    },
    "articleSection": article.category,
    "keywords": article.primary_keyword,
    "wordCount": article.word_count,
    "inLanguage": "en",
    "isAccessibleForFree": true
  };

  // Add citations if present
  if (article.citations && article.citations.length > 0) {
    articleEntity.citation = article.citations.map((c) => ({
      "@type": "CreativeWork",
      "name": c.name,
      "url": c.url
    }));
  }

  // Add Geo-Optimization schema if enabled
  if (article.geo?.enabled) {
    const place: any = {
      "@type": "Place",
      "name": article.geo.placename || article.geo.target_city || article.geo.target_country,
    };

    if (article.geo.target_city || article.geo.target_country) {
      place.address = {
        "@type": "PostalAddress",
        ...(article.geo.target_city ? { "addressLocality": article.geo.target_city } : {}),
        ...(article.geo.target_region ? { "addressRegion": article.geo.target_region } : {}),
        ...(article.geo.target_country ? { "addressCountry": article.geo.target_country } : {})
      };
    }

    if (article.geo.latitude && article.geo.longitude) {
      place.geo = {
        "@type": "GeoCoordinates",
        "latitude": article.geo.latitude,
        "longitude": article.geo.longitude
      };
    }

    articleEntity.contentLocation = place;

    if (article.geo.target_country) {
      articleEntity.spatialCoverage = {
        "@type": "Place",
        "name": article.geo.target_country
      };
    }
  }

  graph.push(articleEntity);

  // Add FAQPage Schema if FAQs exist
  if (article.faqs && article.faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${canonicalUrl}#faq`,
      "mainEntity": article.faqs.map((f) => ({
        "@type": "Question",
        "name": f.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": f.answer
        }
      }))
    });
  }

  // Add Breadcrumb schema
  graph.push({
    "@type": "BreadcrumbList",
    "@id": `${canonicalUrl}#breadcrumb`,
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://aiparameter.github.io/" },
      { "@type": "ListItem", "position": 2, "name": article.category, "item": `https://aiparameter.github.io/${article.category.toLowerCase().replace(/\s+/g, "-")}/` },
      { "@type": "ListItem", "position": 3, "name": article.title, "item": canonicalUrl }
    ]
  });

  return {
    "@context": "https://schema.org",
    "@graph": graph
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase service environment configuration." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate Request
    const authHeader = req.headers.get("Authorization") || req.headers.get("x-api-key");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Missing Authorization header. Use 'Authorization: Bearer <API_KEY>' or 'x-api-key: <API_KEY>'."
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    // Verify token against database
    const { data: authResult, error: authError } = await supabase.rpc("verify_api_key", {
      raw_token: token
    });

    const isServiceRole = token === supabaseServiceKey;
    const isApiKeyValid = authResult && authResult.length > 0 && authResult[0].valid;

    if (!isServiceRole && !isApiKeyValid) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or revoked API key."
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse & Validate Payload
    const body: ArticlePayload = await req.json();

    if (!body.title || (!body.content_markdown && !body.content_html)) {
      return new Response(
        JSON.stringify({
          error: "Unprocessable Entity",
          message: "'title' and either 'content_markdown' or 'content_html' are required."
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const title = body.title.trim();
    const slug = body.slug ? generateSlug(body.slug) : generateSlug(title);
    const category = body.category || "AI News";
    const categorySlug = category.toLowerCase().replace(/\s+/g, "-");
    const dek = body.dek || "";
    const contentMarkdown = body.content_markdown || "";
    const contentHtml = body.content_html || simpleMarkdownToHtml(contentMarkdown);
    const reading = estimateReadingTime(contentMarkdown || contentHtml);
    const publishedAt = (body.publish_immediately !== false) ? new Date().toISOString() : null;
    const status = (body.publish_immediately !== false) ? "published" : "draft";

    // Generate Full Schema.org graph
    const schemaGraph = generateSchemaGraph({
      slug,
      title,
      dek,
      category,
      author_name: body.author_name || "The Parameter Staff",
      author_role: body.author_role || "Senior Editor",
      author_url: body.author_url || "https://aiparameter.github.io/about/",
      featured_image_url: body.featured_image_url || "",
      published_at: publishedAt || new Date().toISOString(),
      word_count: reading.wordCount,
      primary_keyword: body.primary_keyword || title,
      geo: body.geo,
      faqs: body.faqs,
      citations: body.citations,
      schema_type: body.schema_type || "NewsArticle"
    });

    // 3. Upsert into Supabase Database
    const { data: insertedArticle, error: dbError } = await supabase
      .from("articles")
      .upsert({
        slug,
        title,
        dek,
        content_markdown: contentMarkdown,
        content_html: contentHtml,
        category,
        tags: body.tags || [],
        author_name: body.author_name || "The Parameter Staff",
        author_role: body.author_role || "Senior Editor",
        author_url: body.author_url || "https://aiparameter.github.io/about/",
        featured_image_url: body.featured_image_url || null,
        featured_image_alt: body.featured_image_alt || null,
        featured_image_caption: body.featured_image_caption || null,
        meta_title: body.meta_title || `${title} | The Parameter`,
        meta_description: body.meta_description || dek,
        canonical_url: `https://aiparameter.github.io/${categorySlug}/${slug}/`,
        primary_keyword: body.primary_keyword || null,
        secondary_keywords: body.secondary_keywords || [],
        word_count: reading.wordCount,
        read_time_minutes: reading.minutes,
        geo_enabled: !!body.geo?.enabled,
        geo_target_country: body.geo?.target_country || "Global",
        geo_target_region: body.geo?.target_region || null,
        geo_target_city: body.geo?.target_city || null,
        geo_latitude: body.geo?.latitude || null,
        geo_longitude: body.geo?.longitude || null,
        geo_placename: body.geo?.placename || null,
        schema_type: body.schema_type || "NewsArticle",
        faqs: body.faqs || [],
        citations: body.citations || [],
        status,
        published_at: publishedAt
      }, { onConflict: "slug" })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      return new Response(
        JSON.stringify({ error: "Database Error", details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Log the publish event
    await supabase.from("publish_logs").insert({
      article_id: insertedArticle.id,
      source: isApiKeyValid ? "api_agent" : "service_role",
      api_key_id: isApiKeyValid ? authResult[0].key_id : null,
      status: "success",
      payload_snapshot: { title, slug, category, status }
    });

    const liveUrl = `https://aiparameter.github.io/${categorySlug}/${slug}/`;

    return new Response(
      JSON.stringify({
        success: true,
        message: status === "published" ? "Article successfully published" : "Draft saved",
        id: insertedArticle.id,
        slug: insertedArticle.slug,
        category: insertedArticle.category,
        live_url: liveUrl,
        status: insertedArticle.status,
        published_at: insertedArticle.published_at,
        word_count: reading.wordCount,
        read_time_minutes: reading.minutes,
        schema_graph: schemaGraph
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
