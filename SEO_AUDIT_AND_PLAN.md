# SEO Audit & Improvement Plan for vntyper.org

**Date:** 2026-03-16
**Target Keywords:** MUC1, ADTKD, ADTKD-MUC1, ADTKD Diagnostics, VNtyper, VNtyper 2, MCKD, MUC1 VNTR, tubulointerstitial kidney disease, MUC1 genotyping

---

## 1. Current State Assessment

### Lighthouse Scores (March 2026)

| Category        | Score   | Status |
|-----------------|---------|--------|
| SEO             | 100/100 | Good   |
| Performance     | 80-87/100 | Needs work |
| Accessibility   | 96/100  | Good   |
| Best Practices  | 96/100  | Good   |

### Performance Metrics

| Metric | Value | Score |
|--------|-------|-------|
| First Contentful Paint | 2.2s | 77 |
| Largest Contentful Paint | 3.0s | 79 |
| Total Blocking Time | 450ms | 63 |
| Cumulative Layout Shift | 0 | 100 |
| Speed Index | 3.9s | 82 |
| Time to Interactive | 3.0s | 96 |

### What's Working Well

- Valid canonical tags on all pages
- Meta descriptions present on all pages
- `lang="en"` attribute set
- Schema.org JSON-LD (WebSite type) present
- HTTPS with HSTS, strong security headers (A+ across Mozilla Observatory, SSL Labs, ImmuniWeb)
- HTTP/2 enabled, gzip compression configured
- Good accessibility (skip-to-content link, ARIA labels, semantic HTML)
- Proper alt text on all images
- Clean heading hierarchy on subpages

---

## 2. Critical SEO Issues Found

### 2.1 Missing `robots.txt` (HIGH PRIORITY)

**Status:** No `robots.txt` file exists at `https://vntyper.org/robots.txt`

**Impact:** Search engines may crawl pages inefficiently. Missing sitemap reference.

**Fix:** Create `robots.txt` in project root:

```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://vntyper.org/sitemap.xml
```

### 2.2 Missing `sitemap.xml` (HIGH PRIORITY)

**Status:** No sitemap exists at `https://vntyper.org/sitemap.xml`

**Impact:** Search engines don't know about all pages. The ADTKD diagnostics page is particularly important for keyword ranking but may not be discovered quickly.

**Fix:** Create `sitemap.xml` in project root:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://vntyper.org/</loc>
    <lastmod>2026-03-16</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://vntyper.org/adtkd_diagnostics.html</loc>
    <lastmod>2026-03-16</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://vntyper.org/contact.html</loc>
    <lastmod>2026-03-16</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://vntyper.org/impressum_en.html</loc>
    <lastmod>2026-03-16</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.2</priority>
  </url>
</urlset>
```

### 2.3 Missing Open Graph & Twitter Card Meta Tags (HIGH PRIORITY)

**Status:** Zero Open Graph or Twitter Card tags on any page.

**Impact:** When shared on social media, LinkedIn, X/Twitter, or academic platforms, the page shows a generic preview with no image, poor title, and no description. Twitter Card tags don't require a Twitter account — they control how link previews render when anyone shares the URL.

**Fix for `index.html`:**
```html
<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://vntyper.org/">
<meta property="og:title" content="VNtyper Online - MUC1 VNTR Genotyping for ADTKD Diagnostics">
<meta property="og:description" content="Free online tool for MUC1 VNTR genotyping from BAM files. Screen for ADTKD-MUC1 mutations using VNtyper 2.0 directly in your browser.">
<meta property="og:image" content="https://vntyper.org/resources/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="VNtyper Online">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="VNtyper Online - MUC1 VNTR Genotyping for ADTKD Diagnostics">
<meta name="twitter:description" content="Free online tool for MUC1 VNTR genotyping from BAM files. Screen for ADTKD-MUC1 mutations using VNtyper 2.0.">
<meta name="twitter:image" content="https://vntyper.org/resources/assets/og-image.png">
```

**Fix for `adtkd_diagnostics.html`:**
```html
<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:url" content="https://vntyper.org/adtkd_diagnostics.html">
<meta property="og:title" content="ADTKD Diagnostics - Autosomal Dominant Tubulointerstitial Kidney Disease">
<meta property="og:description" content="Overview of ADTKD genetic basis, diagnostic strategies, MUC1 VNTR analysis, VNtyper 2.0 screening, and ADTKD-Net diagnostic labs.">
<meta property="og:image" content="https://vntyper.org/resources/assets/og-image-adtkd.png">
<meta property="og:site_name" content="VNtyper Online">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="ADTKD Diagnostics - Genetic Testing & VNtyper Screening">
<meta name="twitter:description" content="Diagnostic pathways for ADTKD-MUC1 including specialized testing and VNtyper 2.0 screening from short-read sequencing data.">
<meta name="twitter:image" content="https://vntyper.org/resources/assets/og-image-adtkd.png">
```

**Action item:** Create OG images (1200x630px) for both pages. Can use the existing logo and branding.

### 2.4 Weak Title Tags (HIGH PRIORITY)

**Current titles:**
- `index.html`: `vntyper-online` (generic, no keywords)
- `adtkd_diagnostics.html`: `ADTKD Diagnostics - vntyper-online` (better, but could be stronger)
- `contact.html`: `Contact - vntyper-online`
- `impressum_en.html`: `Imprint - vntyper-online`

**Recommended titles (60 chars max for Google display):**
- `index.html`: `VNtyper Online - MUC1 VNTR Genotyping | ADTKD Screening Tool`
- `adtkd_diagnostics.html`: `ADTKD Diagnostics - MUC1 Testing & VNtyper 2.0 Screening`
- `contact.html`: `Contact - VNtyper Online | MUC1 VNTR Analysis Support`
- `impressum_en.html`: `Imprint - VNtyper Online`

### 2.5 Weak Meta Descriptions (MEDIUM PRIORITY)

**Current:** `vntyper-online offers online MUC1 VNTR genotyping using the vntyper algorithm.` (78 chars — too short, misses key terms)

**Recommended (150-160 chars, keyword-rich):**

**index.html:**
> `VNtyper Online: Free browser-based MUC1 VNTR genotyping tool for ADTKD-MUC1 screening. Analyze BAM files with VNtyper 2.0 — no upload of full genome data required.`

**adtkd_diagnostics.html:**
> `ADTKD diagnostics guide: MUC1 VNTR mutation detection, VNtyper 2.0 screening from NGS data, specialized diagnostic labs, and recommended diagnostic workflows.`

### 2.6 Missing H1 on Homepage (HIGH PRIORITY)

**Status:** The homepage has NO `<h1>` tag. The site name is in an `<h2>` inside the nav. The heading hierarchy goes `h2 > h3` (FAQ items in a modal, not visible to crawlers).

**Impact:** Major SEO signal is missing. Google uses H1 to understand page topic.

**Fix:** Add a visible H1 below the nav, before the upload form:

```html
<h1>MUC1 VNTR Genotyping — Online ADTKD Screening with VNtyper 2.0</h1>
```

Or if a more subtle approach is needed, an introductory section:

```html
<section class="hero-section">
  <h1>Online MUC1 VNTR Genotyping for ADTKD Diagnostics</h1>
  <p>Screen BAM files for MUC1 coding VNTR mutations using VNtyper 2.0.
     Fast, secure, browser-based analysis for autosomal dominant
     tubulointerstitial kidney disease (ADTKD-MUC1, MCKD).</p>
</section>
```

### 2.7 No Keyword-Rich Content on Homepage (HIGH PRIORITY)

**Status:** The homepage is essentially a file upload form with no visible text content explaining what the tool does, what ADTKD is, or why MUC1 matters. All explanatory content is hidden inside FAQ modals (invisible to crawlers).

**Impact:** Google cannot understand the page's relevance for target keywords. There is virtually no crawlable text content.

**Fix:** Add an "About" or introductory section to the homepage with keyword-rich content. This should appear above or below the upload form and be visible on page load (not in a modal). See Section 4.1 for content recommendations.

---

## 3. Additional SEO Issues

### 3.1 Schema.org Structured Data Improvements (MEDIUM)

**Current:** Only `WebSite` schema type, which is generic.

**Additional issues found:**
- Uses `http://schema.org` in `@context` — should be `https://schema.org`
- JSON-LD description says "comprehensive genetic variant analysis and visualization tools" which differs from the meta description ("MUC1 VNTR genotyping"). These should be consistent.
- Publisher `@type` is "Person" with a `logo` property, but `logo` is typically for `Organization` type

**Recommended additions:**

**`SoftwareApplication` schema for the tool itself:**
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "VNtyper Online",
  "alternateName": ["VNtyper 2.0", "VNtyper2", "vntyper-online"],
  "applicationCategory": "HealthApplication",
  "applicationSubCategory": "Genetic Analysis Tool",
  "operatingSystem": "Web Browser",
  "url": "https://vntyper.org/",
  "description": "Online MUC1 VNTR genotyping tool for screening autosomal dominant tubulointerstitial kidney disease (ADTKD-MUC1) from BAM files using VNtyper 2.0.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "author": [
    {
      "@type": "Person",
      "name": "Bernt Popp",
      "url": "https://berntpopp.com"
    },
    {
      "@type": "Person",
      "name": "Hassan Saei",
      "url": "https://github.com/hassansaei"
    }
  ],
  "citation": {
    "@type": "ScholarlyArticle",
    "name": "VNtyper enables accurate alignment-free genotyping of MUC1 coding VNTR",
    "url": "https://doi.org/10.1016/j.isci.2023.107171",
    "datePublished": "2023-06-17",
    "isPartOf": {
      "@type": "Periodical",
      "name": "iScience"
    }
  }
}
```

**`FAQPage` schema for FAQ content:**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is vntyper-online?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "vntyper-online offers online MUC1 VNTR genotyping using the VNtyper algorithm..."
      }
    }
  ]
}
```

**`MedicalWebPage` schema for ADTKD diagnostics page:**
```json
{
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  "name": "ADTKD Diagnostics",
  "about": {
    "@type": "MedicalCondition",
    "name": "Autosomal Dominant Tubulointerstitial Kidney Disease",
    "alternateName": ["ADTKD", "ADTKD-MUC1", "MCKD", "Medullary Cystic Kidney Disease"]
  },
  "lastReviewed": "2026-03-16"
}
```

### 3.2 Missing `hreflang` Tags (LOW-MEDIUM)

**Status:** German imprint page (`impressum_de.html`) exists but no `hreflang` tags link the English and German versions.

**Fix:** Add to `impressum_en.html`:
```html
<link rel="alternate" hreflang="en" href="https://vntyper.org/impressum_en.html" />
<link rel="alternate" hreflang="de" href="https://vntyper.org/impressum_de.html" />
```

### 3.3 Footer Links with Empty Anchor Text (MEDIUM)

**Status:** Institution logo links in the footer have no text content — just images inside anchors. While alt text exists on images, the links themselves appear as empty to some crawlers.

**Fix:** Ensure each logo link has descriptive text (can be visually hidden via `sr-only` class):
```html
<a href="https://www.institutimagine.org/en" ...>
  <img src="..." alt="Institut Imagine Paris">
  <span class="sr-only">Visit Institut Imagine Paris</span>
</a>
```

### 3.4 SVG Workflow Diagram Not Accessible to Search Engines (MEDIUM)

**Status:** The diagnostic workflow on `adtkd_diagnostics.html` is an inline SVG. Text inside SVGs is generally not well-indexed by search engines.

**Fix:** Add a descriptive `<figcaption>` or visible text summary below the SVG, and wrap in `<figure>`:
```html
<figure>
  <svg ...>...</svg>
  <figcaption>
    Diagnostic workflow for ADTKD: Pathway A starts with clinical suspicion and NGS,
    followed by VNtyper 2.0 screening and confirmation. Pathway B proceeds directly
    to specialized diagnostics when ADTKD-MUC1 is strongly suspected.
  </figcaption>
</figure>
```

### 3.5 Performance Improvements for SEO (MEDIUM-HIGH)

Google uses Core Web Vitals as a ranking signal. Current issues:

| Issue | Current | Target |
|-------|---------|--------|
| FCP | 2.1-2.2s | < 1.8s |
| LCP | 2.9-3.0s | < 2.5s |
| TBT | 270-450ms | < 200ms |

**Critical: No Cache Headers (TTL: 0s on all 74 static assets)**

Lighthouse found that ALL static resources (JS, CSS, images) have zero cache lifetime. This means every page visit re-downloads everything. This is the single biggest performance opportunity.

**Fix:** Add cache headers in nginx proxy config or frontend nginx:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff2?)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

Since the frontend already uses query-string versioning (`?v=0.66.0`) for cache-busting, aggressive caching is safe.

**Critical: Intro.js CSS causes 922ms render blocking**

`introjs.min.css` is loaded in `<head>` and blocks rendering for 922ms. The tutorial is rarely used on first page load.

**Fix:** Load Intro.js CSS asynchronously or defer it:
```html
<link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/intro.js/4.0.0/introjs.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/intro.js/4.0.0/introjs.min.css"></noscript>
```

**Additional Recommendations:**
1. **Preload the logo image** (LCP element): `<link rel="preload" as="image" href="resources/assets/logo/vntyperonline_logo_80px.png">`
2. **Defer non-critical CSS**: Load `modal.css`, `faq.css`, `citations.css`, `log.css`, `usageStats.css` asynchronously
3. **Preconnect to CDN origins**: `<link rel="preconnect" href="https://cdnjs.cloudflare.com">` and `<link rel="preconnect" href="https://biowasm.com">`
4. **Set explicit width/height on images** to prevent layout shift (already at CLS 0, but good practice)
5. **Consider lazy-loading institution logos** in footer (below the fold)
6. **Serve higher-resolution logo** (at least 160px wide for retina; current 80px image is displayed larger, flagged as low-res by Lighthouse)

### 3.6 Accessibility Issues Affecting SEO (LOW)

Lighthouse found:
- **Color contrast fail**: Extract button text contrast too low
- **Accessible names mismatch**: `resetHeader` div has `role="button"` with `aria-label="Reset Page"` but visible text says "vntyper-online"

---

## 4. Content Strategy for Target Keywords

### 4.1 Homepage Content Section (NEW — HIGH PRIORITY)

Add a visible content section to `index.html`. Currently the page has no crawlable text explaining the tool. Suggested content:

```html
<section class="about-section" id="about">
  <h2>About VNtyper Online</h2>
  <p>
    <strong>VNtyper Online</strong> is a free, browser-based tool for
    <strong>MUC1 VNTR genotyping</strong> using the
    <strong>VNtyper 2.0</strong> algorithm. It enables rapid screening
    for mutations in the MUC1 coding variable number of tandem repeats
    (VNTR), the most common cause of
    <strong>Autosomal Dominant Tubulointerstitial Kidney Disease (ADTKD-MUC1)</strong>,
    also known as <strong>Medullary Cystic Kidney Disease (MCKD)</strong>.
  </p>
  <h3>How It Works</h3>
  <p>
    Upload your BAM/BAI sequencing files — only the MUC1 region is
    extracted locally in your browser using BioWasm, ensuring genomic
    privacy. The extracted reads are then analyzed server-side by
    VNtyper 2.0 to detect the prototypic insC mutation and other
    VNTR alterations.
  </p>
  <h3>Who Is This For?</h3>
  <p>
    VNtyper Online serves geneticists, nephrologists, and researchers
    investigating <strong>ADTKD</strong>, <strong>ADTKD-MUC1</strong>,
    chronic kidney disease of unknown etiology, and familial kidney
    disorders. It democratizes access to MUC1 screening by working with
    standard short-read sequencing data (Illumina WES/WGS).
  </p>
</section>
```

### 4.2 ADTKD Diagnostics Page Enhancement (MEDIUM)

The existing page is good but could be improved:

1. **Add more keyword-rich subheadings:**
   - "What is ADTKD?" or "What is Autosomal Dominant Tubulointerstitial Kidney Disease?"
   - "MUC1 Gene and VNTR Mutations"
   - "MCKD vs ADTKD: Understanding the Terminology"

2. **Add a section explaining the relationship between ADTKD subtypes:**
   - ADTKD-MUC1 (MUC1 gene mutations)
   - ADTKD-UMOD (uromodulin)
   - ADTKD-REN (renin)
   - ADTKD-HNF1B
   - ADTKD-SEC61A1

3. **Add internal links** from the diagnostics page back to the main tool

4. **Add alt text / description for the SVG diagram** (currently has none)

### 4.3 Consider Creating Additional Content Pages (LONG-TERM)

To dominate for niche medical keywords, consider creating:

| Page | Target Keywords | Content |
|------|----------------|---------|
| `/muc1-vntr.html` | MUC1, MUC1 VNTR, MUC1 gene | Detailed explanation of MUC1 gene structure, VNTR biology |
| `/adtkd-guide.html` | ADTKD, ADTKD diagnostics, kidney disease | Comprehensive guide for clinicians |
| `/vntyper-algorithm.html` | VNtyper, VNtyper 2, VNtyper 2.0 | How the algorithm works, validation data |
| `/publications.html` | (supports E-E-A-T) | List of publications, citations, validation studies |

---

## 5. Technical SEO Checklist

> **Repo key:**
> - **FE** = `vntyper-online-frontend` (this repo)
> - **BE** = `vntyper-online-backend` (proxy config, docker-compose)
> - **EXT** = External action (browser, third-party service)
> - **DESIGN** = Design/asset creation task

### Immediate Actions (Week 1)

| # | Task | Repo | File(s) |
|---|------|------|---------|
| 1 | Create `robots.txt` with sitemap reference | **FE** | `robots.txt` (new) |
| 2 | Create `sitemap.xml` with all public pages | **FE** | `sitemap.xml` (new) |
| 3 | Update `<title>` tags on all pages with target keywords | **FE** | `index.html`, `adtkd_diagnostics.html`, `contact.html`, `impressum_en.html` |
| 4 | Update meta descriptions (150-160 chars, keyword-rich) | **FE** | `index.html`, `adtkd_diagnostics.html` |
| 5 | Add `<h1>` to homepage with primary keywords | **FE** | `index.html` |
| 6 | Add Open Graph meta tags | **FE** | `index.html`, `adtkd_diagnostics.html` |
| 7 | Add Twitter Card meta tags | **FE** | `index.html`, `adtkd_diagnostics.html` |
| 8 | ~~Create OG images (1200x630px)~~ DONE | **DESIGN** | `resources/assets/og-image.png`, `resources/assets/og-image-adtkd.png` |

### Short-Term Actions (Week 2-3)

| # | Task | Repo | File(s) |
|---|------|------|---------|
| 9 | Add visible content section to homepage (about/how-it-works) | **FE** | `index.html` |
| 10 | Enhance Schema.org JSON-LD (SoftwareApplication, FAQPage) | **FE** | `index.html` |
| 11 | Add MedicalWebPage schema to ADTKD diagnostics page | **FE** | `adtkd_diagnostics.html` |
| 12 | Add `hreflang` tags to imprint pages | **FE** | `impressum_en.html`, `impressum_de.html` |
| 13 | Add `<figcaption>` to SVG workflow diagram | **FE** | `adtkd_diagnostics.html` |
| 14 | Fix footer logo links (add sr-only text) | **FE** | `index.html` (or `config.js` if logos are JS-injected) |
| 15 | Add `<link rel="preconnect">` for CDN origins | **FE** | `index.html` |
| 16 | Add `<link rel="preload">` for LCP image | **FE** | `index.html` |
| 17 | Defer Intro.js CSS loading (async) | **FE** | `index.html` |
| 18 | Fix accessibility contrast issues (extract button) | **FE** | `resources/css/buttons.css` |
| 19 | Add cache headers for static assets (TTL: 0 → 1 year) | **BE** | `proxy/nginx.conf.template.ssl`, `proxy/nginx.conf.template.http` |

### Medium-Term Actions (Month 1-2)

| # | Task | Repo | File(s) |
|---|------|------|---------|
| 20 | Register site with Google Search Console | **EXT** | — |
| 21 | Register site with Bing Webmaster Tools | **EXT** | — |
| 22 | Submit sitemap to both search engines | **EXT** | — |
| 23 | Create a publications/citations page | **FE** | `publications.html` (new) |
| 24 | Enhance ADTKD diagnostics page content (subtypes, terminology) | **FE** | `adtkd_diagnostics.html` |
| 25 | ~~Serve higher-resolution logo (160px+ for retina)~~ DONE — `vntyperonline_logo_160px.png` created | **FE** + **DESIGN** | `resources/assets/logo/` |
| 26 | Defer non-critical CSS loading (`modal.css`, `faq.css`, `log.css`, etc.) | **FE** | `index.html` |
| 27 | Create standalone `/faq.html` page (crawlable, indexable) | **FE** | `faq.html` (new) |
| 28 | Add `<meta name="google-site-verification">` | **FE** | `index.html` (after Search Console registration) |

### Long-Term Actions (Month 2-6)

| # | Task | Repo | File(s) |
|---|------|------|---------|
| 29 | Create dedicated content pages (MUC1 VNTR, ADTKD guide, VNtyper algorithm) | **FE** | new `.html` files |
| 30 | Register with bio.tools, SciCrunch, OMICtools | **EXT** | — |
| 31 | Build backlinks (academic citations, medical genetics forums) | **EXT** | — |
| 32 | Add blog/news section for algorithm updates, case studies | **FE** | new section/pages |
| 33 | Monitor keyword rankings and adjust content strategy | **EXT** | — |
| 34 | Ensure iScience paper links to vntyper.org (Google Scholar) | **EXT** | — |
| 35 | Implement breadcrumb structured data for subpages | **FE** | all subpages |
| 36 | Add ORCID IDs to author Schema.org markup | **FE** | `index.html` |

---

## 6. Competitive Keyword Analysis

### Primary Keywords and Current Assessment

| Keyword | Search Volume Est. | Competition | Current Ranking Potential | Notes |
|---------|-------------------|-------------|--------------------------|-------|
| VNtyper | Very low | Very low | HIGH | Brand term — should rank #1 easily |
| VNtyper 2 | Very low | Very low | HIGH | Brand variant |
| vntyper-online | Very low | None | HIGH | Exact match domain |
| ADTKD | Low | Low | MEDIUM | Medical term, some competition from KDIGO, OMIM |
| ADTKD-MUC1 | Very low | Very low | HIGH | Very specific, low competition |
| ADTKD diagnostics | Very low | Low | MEDIUM | Dedicated page exists |
| MUC1 | Medium | Medium | LOW | Very broad gene term — much competition |
| MUC1 VNTR | Low | Low | HIGH | More specific, tool directly relevant |
| MCKD | Low | Medium | LOW | Older term, need content to establish relevance |
| MUC1 genotyping | Very low | Very low | HIGH | Exact match to tool function |
| tubulointerstitial kidney disease | Low | Medium | MEDIUM | Need content depth |

### Strategy by Keyword Group

**Brand terms (VNtyper, VNtyper 2, vntyper-online):** Fix title tags and H1, ensure brand appears consistently. Should rank #1 with minimal effort.

**Disease terms (ADTKD, ADTKD-MUC1, MCKD):** Expand content on ADTKD diagnostics page, add new pages, build E-E-A-T signals (author credentials, citations, institutional backing).

**Gene/Technical terms (MUC1, MUC1 VNTR, genotyping):** Add homepage content section, create dedicated MUC1 VNTR page, leverage the citation and published paper.

---

## 7. E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)

This is critical for medical/health-related content (Google's YMYL — Your Money or Your Life).

### Current Strengths
- Associated with established research institutions (BIH Charité, Institut Imagine, etc.)
- Peer-reviewed publication in iScience
- HTTPS with strong security (A+ ratings)
- Clear disclaimer about research use
- Author profiles linked (Bernt Popp, Hassan Saei)

### Improvements Needed
1. **Author credentials with ORCID IDs:** Add ORCID IDs to JSON-LD (`sameAs` array) and consider a visible "About the Authors" section with credentials (MD, PhD, institutional affiliations). ORCID links are strong E-E-A-T signals for medical/scientific content.
2. **Medical disclaimer:** Already good, but consider adding a brief visible disclaimer to ADTKD diagnostics page specifically (not just behind the modal on homepage)
3. **Last reviewed date:** Add visible "Last reviewed: [date]" to medical content pages (the `MedicalWebPage` schema supports `lastReviewed`)
4. **Institutional endorsement:** Make the ADTKD-Net consortium backing more prominent in text content, not just logos
5. **Publication list:** Create a dedicated page listing all related publications, citing papers
6. **Link to published validation studies** from the homepage
7. **Register with bioinformatics tool directories:** [bio.tools](https://bio.tools/), [SciCrunch](https://scicrunch.org/), [OMICtools](https://omictools.com/) — these provide authoritative backlinks and increase discoverability in the research community
8. **Google Scholar integration:** Ensure the iScience paper links to vntyper.org. Google Scholar results frequently appear in regular Google search for medical terms

---

## 8. Quick-Win Implementation Priority

Ranked by impact-to-effort ratio:

1. **Add `robots.txt` + `sitemap.xml`** — 15 min, foundational
2. **Fix title tags** — 10 min, immediate ranking signal improvement
3. **Add H1 to homepage** — 5 min, major missing signal
4. **Update meta descriptions** — 15 min, improves CTR from search results
5. **Add OG/Twitter meta tags** — 20 min, enables social sharing
6. **Add homepage content section** — 30 min, provides crawlable keyword content
7. **Enhance Schema.org** — 30 min, enables rich results
8. **Register with Google Search Console** — 10 min, enables monitoring

---

## Appendix: Files to Create/Modify

### Frontend repo (`vntyper-online-frontend`)

**New files:**
- `robots.txt` — crawl directives + sitemap reference
- `sitemap.xml` — all public page URLs
- `resources/assets/og-image.png` — 1200x630px social sharing image (DESIGN)
- `resources/assets/og-image-adtkd.png` — 1200x630px for ADTKD page (DESIGN)
- `faq.html` — standalone crawlable FAQ page (medium-term)
- `publications.html` — publication list for E-E-A-T (medium-term)

**Modified files:**
- `index.html` — title, meta description, H1, OG/Twitter tags, preconnect/preload, content section, enhanced Schema.org, defer Intro.js CSS
- `adtkd_diagnostics.html` — title, meta description, OG/Twitter tags, MedicalWebPage schema, SVG figcaption, content enhancements
- `contact.html` — title, OG tags
- `impressum_en.html` — OG tags, hreflang
- `impressum_de.html` — hreflang
- `resources/css/buttons.css` — fix extract button contrast

### Backend repo (`vntyper-online-backend`)

**Modified files:**
- `proxy/nginx.conf.template.ssl` — add cache headers for static assets (`expires 1y`)
- `proxy/nginx.conf.template.http` — same cache headers (for local/dev)

### External actions (no code changes)
- Register with Google Search Console + submit sitemap
- Register with Bing Webmaster Tools
- Register with bio.tools, SciCrunch, OMICtools
- Verify iScience paper links to vntyper.org
- Monitor keyword rankings
