-- ==============================================================================
-- The Parameter: Supabase CMS Schema Migration
-- Migration: 20261021_init_parameter_cms.sql
-- Description: Core tables, enums, triggers, RLS, and functions for AI autonomous publishing
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. ENUMS
do $$ begin
    create type article_status as enum ('draft', 'published', 'scheduled', 'archived');
exception
    when duplicate_object then null;
end $$;

do $$ begin
    create type schema_article_type as enum ('NewsArticle', 'BlogPosting', 'TechArticle');
exception
    when duplicate_object then null;
end $$;

-- 3. CATEGORIES TABLE
create table if not exists public.categories (
    id uuid primary key default uuid_generate_v4(),
    slug text not null unique,
    name text not null,
    description text,
    sort_order integer default 0,
    created_at timestamptz default now()
);

-- Seed default categories matching The Parameter
insert into public.categories (slug, name, description, sort_order)
values 
    ('ai-news', 'AI News', 'Independent coverage of breakthrough model releases, benchmarks, and infrastructure developments', 1),
    ('trends', 'Trends', 'Deep-dive analysis on industry shifts, agentic workflows, and emerging paradigms', 2),
    ('ai-tools', 'AI Tools', 'Practical benchmarks and evaluations of developer tools, workflows, and platforms', 3),
    ('research', 'Research', 'Academic papers distilled: analyzing real findings without vendor exaggeration', 4),
    ('guides', 'Guides', 'Step-by-step technical implementation and production deployment methodologies', 5)
on conflict (slug) do nothing;

-- 4. ARTICLES TABLE (Core CMS Storage)
create table if not exists public.articles (
    id uuid primary key default uuid_generate_v4(),
    slug text not null unique,
    title text not null,
    dek text, -- Short summary / subtitle
    content_markdown text not null default '',
    content_html text not null default '',
    category text not null default 'AI News',
    tags text[] default '{}',
    
    -- Authorship
    author_name text not null default 'The Parameter Staff',
    author_role text default 'Senior Editor',
    author_url text default 'https://aiparameter.github.io/about/',
    
    -- Featured Media
    featured_image_url text,
    featured_image_alt text,
    featured_image_caption text,
    
    -- SEO Metadata
    meta_title text,
    meta_description text,
    canonical_url text,
    primary_keyword text,
    secondary_keywords text[] default '{}',
    word_count integer default 0,
    read_time_minutes integer default 3,
    
    -- Geo-Targeting Optimization
    geo_enabled boolean default false,
    geo_target_country text default 'Global',    -- ISO code e.g. "US", "GB", "DE" or "Global"
    geo_target_region text,                     -- e.g. "California", "Île-de-France"
    geo_target_city text,                       -- e.g. "San Francisco", "London"
    geo_latitude numeric(9,6),                  -- e.g. 37.774929
    geo_longitude numeric(9,6),                 -- e.g. -122.419416
    geo_placename text,                         -- e.g. "San Francisco Tech Center"
    
    -- Structured Data Schema (JSON-LD)
    schema_type schema_article_type default 'NewsArticle',
    faqs jsonb default '[]'::jsonb,             -- Array: [ { "question": "...", "answer": "..." } ]
    citations jsonb default '[]'::jsonb,        -- Array: [ { "name": "...", "url": "..." } ]
    
    -- Publishing Status & Lifecycle
    status article_status default 'draft',
    published_at timestamptz,
    updated_at timestamptz default now(),
    created_at timestamptz default now()
);

-- Indexes for lightning fast queries
create index if not exists idx_articles_slug on public.articles(slug);
create index if not exists idx_articles_status_published on public.articles(status, published_at desc);
create index if not exists idx_articles_category on public.articles(category);
create index if not exists idx_articles_geo on public.articles(geo_enabled, geo_target_country);

-- 5. API KEYS TABLE (For Autonomous AI Agents)
create table if not exists public.api_keys (
    id uuid primary key default uuid_generate_v4(),
    name text not null,                         -- e.g. "Autonomous Publishing Agent v1"
    key_hash text not null unique,             -- SHA256 hashed secret
    prefix text not null,                      -- Visible identifier e.g. "param_live_xxxx"
    scopes text[] default '{"articles:read", "articles:write"}',
    is_active boolean default true,
    last_used_at timestamptz,
    created_at timestamptz default now()
);

create index if not exists idx_api_keys_prefix on public.api_keys(prefix);

-- 6. PUBLISH AUDIT LOGS (Tracks every AI Agent submission)
create table if not exists public.publish_logs (
    id uuid primary key default uuid_generate_v4(),
    article_id uuid references public.articles(id) on delete set null,
    source text not null default 'api_agent',  -- 'api_agent', 'manual_cms', 'webhook'
    api_key_id uuid references public.api_keys(id) on delete set null,
    status text not null,                      -- 'success', 'validation_error', 'build_error'
    payload_snapshot jsonb,
    error_message text,
    created_at timestamptz default now()
);

-- 7. AUTOMATIC TIMESTAMP TRIGGER
create or replace function public.trigger_set_timestamp()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists set_articles_timestamp on public.articles;
create trigger set_articles_timestamp
    before update on public.articles
    for each row
    execute function public.trigger_set_timestamp();

-- 8. ROW LEVEL SECURITY (RLS)
alter table public.articles enable row level security;
alter table public.categories enable row level security;
alter table public.api_keys enable row level security;
alter table public.publish_logs enable row level security;

-- Public can read all published articles
create policy "Allow public read published articles"
    on public.articles for select
    using (status = 'published');

create policy "Allow public read categories"
    on public.categories for select
    using (true);

-- Authenticated users (editors) and service_role have full access
create policy "Allow service_role and authenticated full access articles"
    on public.articles for all
    using (auth.role() in ('service_role', 'authenticated'))
    with check (auth.role() in ('service_role', 'authenticated'));

create policy "Allow service_role full access api_keys"
    on public.api_keys for all
    using (auth.role() in ('service_role', 'authenticated'))
    with check (auth.role() in ('service_role', 'authenticated'));

create policy "Allow service_role full access publish_logs"
    on public.publish_logs for all
    using (auth.role() in ('service_role', 'authenticated'))
    with check (auth.role() in ('service_role', 'authenticated'));

-- 9. HELPER FUNCTION: Verify API Key
create or replace function public.verify_api_key(raw_token text)
returns table(valid boolean, key_id uuid, key_name text, scopes text[]) as $$
declare
    calculated_hash text;
begin
    calculated_hash := encode(digest(raw_token, 'sha256'), 'hex');
    
    return query
    select true, ak.id, ak.name, ak.scopes
    from public.api_keys ak
    where ak.key_hash = calculated_hash and ak.is_active = true;
    
    -- Update last used timestamp
    update public.api_keys
    set last_used_at = now()
    where key_hash = calculated_hash;
end;
$$ language plpgsql security definer;
