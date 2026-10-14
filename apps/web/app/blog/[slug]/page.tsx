import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/blog";
import { Breadcrumbs } from "@/components/blog/Breadcrumbs";
import { ReadingProgressBar } from "@/components/blog/ReadingProgressBar";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { NewsletterCTA } from "@/components/blog/NewsletterCTA";
import { BlogCard } from "@/components/blog/BlogCard";
import { ViewTracker } from "@/components/blog/ViewTracker";
import { ProseWrapper } from "@/components/blog/MDXComponents";
import { FadeInOnScroll } from "@/components/landing/FadeInOnScroll";
import { getGuideSlugs, getGuideBySlug } from "@/lib/destination-guides";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

export async function generateStaticParams() {
  return (await getAllPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.lastUpdated || post.date,
      authors: [post.author.name],
      tags: post.tags,
      images: [
        { url: post.coverImage, width: 1200, height: 630, alt: post.title },
      ],
      url: `/blog/${post.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [post.coverImage],
    },
  };
}

// ---- Security helpers ----
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  // Block javascript:, data:, vbscript: protocols
  if (/^(javascript|data|vbscript)\s*:/i.test(trimmed)) return false;
  // Allow relative URLs, http(s), mailto, tel
  return (
    /^(https?:\/\/|mailto:|tel:|\/|#|\.)/.test(trimmed) ||
    !trimmed.includes(":")
  );
}

function sanitizeUrl(url: string): string {
  return isSafeUrl(url) ? url : "#";
}

// ---- Markdown-to-HTML renderer ----
function renderMarkdown(md: string): string {
  // Step 1: Escape all raw HTML in source to prevent XSS.
  // Preserve markdown syntax characters (*, #, -, [, ], etc.)
  // but neutralize any HTML tags/attributes in the source content.

  // Extract fenced code blocks first (preserve their content verbatim)
  const codeBlocks: string[] = [];
  let escaped = md.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`,
    );
    return `\n%%CODEBLOCK_${idx}%%\n`;
  });

  // Escape HTML in the remaining content
  escaped = escapeHtml(escaped);

  // Step 2: Apply inline markdown transformations (on escaped content)
  let html = escaped
    // Inline code (single backticks) — before other inline transforms
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Images — validate src URL
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_m, alt, src) =>
        `<img src="${sanitizeUrl(src)}" alt="${alt}" loading="lazy" />`,
    )
    // Links — validate href URL
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_m, text, href) => `<a href="${sanitizeUrl(href)}">${text}</a>`,
    )
    // Bold (must be before italic)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // HR
    .replace(/^---$/gm, "<hr />")
    // Headings (h3 before h2 before h1 — most specific first)
    .replace(/^### (.+)$/gm, (_m, t) => {
      const id = t
        .replace(/<[^>]+>/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      return `<h3 id="${id}">${t}</h3>`;
    })
    .replace(/^## (.+)$/gm, (_m, t) => {
      const id = t
        .replace(/<[^>]+>/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      return `<h2 id="${id}">${t}</h2>`;
    })
    .replace(/^# (.+)$/gm, (_m, t) => {
      const id = t
        .replace(/<[^>]+>/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      return `<h1 id="${id}">${t}</h1>`;
    });

  // Step 3: Restore code blocks
  html = html.replace(
    /%%CODEBLOCK_(\d+)%%/g,
    (_m, idx) => codeBlocks[Number(idx)],
  );

  // Step 4: Process block-level elements (paragraphs, lists, blockquotes, tables)
  const lines = html.split("\n");
  const out: string[] = [];
  let inList = false;
  let listType = "";
  let inBlockquote = false;
  const bqLines: string[] = [];

  const parseTableRow = (row: string): string[] =>
    row
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());

  const isSeparatorRow = (row: string): boolean =>
    /^\|[\s:-]+\|/.test(row) &&
    parseTableRow(row).every((c) => /^:?-+:?$/.test(c));

  const flushBlockquote = () => {
    if (!inBlockquote) return;
    // Group consecutive blockquote lines into paragraphs split by empty > lines
    const paragraphs: string[][] = [[]];
    for (const l of bqLines) {
      if (l.trim() === "") {
        if (paragraphs[paragraphs.length - 1].length > 0) paragraphs.push([]);
      } else {
        paragraphs[paragraphs.length - 1].push(l);
      }
    }
    out.push("<blockquote>");
    for (const p of paragraphs) {
      if (p.length > 0) out.push(`<p>${p.join(" ")}</p>`);
    }
    out.push("</blockquote>");
    bqLines.length = 0;
    inBlockquote = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Blockquote continuation
    if (/^&gt; ?/.test(line)) {
      if (inList) {
        out.push(`</${listType}>`);
        inList = false;
      }
      inBlockquote = true;
      bqLines.push(line.replace(/^&gt; ?/, ""));
      continue;
    }
    if (inBlockquote) flushBlockquote();

    // Table detection: line starts with |, next line is a separator row
    if (
      /^\|/.test(line) &&
      i + 1 < lines.length &&
      isSeparatorRow(lines[i + 1])
    ) {
      if (inList) {
        out.push(`</${listType}>`);
        inList = false;
      }
      const headers = parseTableRow(line);
      out.push("<table>");
      out.push("<thead><tr>");
      for (const h of headers) out.push(`<th>${h}</th>`);
      out.push("</tr></thead>");
      i++; // skip separator row
      out.push("<tbody>");
      while (i + 1 < lines.length && /^\|/.test(lines[i + 1])) {
        i++;
        const cells = parseTableRow(lines[i]);
        out.push("<tr>");
        for (const c of cells) out.push(`<td>${c}</td>`);
        out.push("</tr>");
      }
      out.push("</tbody></table>");
      continue;
    }

    if (/^- /.test(line)) {
      if (!inList || listType !== "ul") {
        if (inList) out.push(`</${listType}>`);
        out.push("<ul>");
        inList = true;
        listType = "ul";
      }
      out.push(`<li>${line.slice(2)}</li>`);
    } else if (/^\d+\. /.test(line)) {
      if (!inList || listType !== "ol") {
        if (inList) out.push(`</${listType}>`);
        out.push("<ol>");
        inList = true;
        listType = "ol";
      }
      out.push(`<li>${line.replace(/^\d+\. /, "")}</li>`);
    } else {
      if (inList) {
        out.push(`</${listType}>`);
        inList = false;
      }
      if (
        /^<(h[1-3]|pre|hr|img|ul|ol|blockquote|table|code)/.test(line) ||
        line.trim() === ""
      ) {
        out.push(line);
      } else if (line.trim()) {
        out.push(`<p>${line}</p>`);
      }
    }
  }
  if (inBlockquote) flushBlockquote();
  if (inList) out.push(`</${listType}>`);

  return out.join("\n");
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [post, related] = await Promise.all([
    getPostBySlug(slug),
    getRelatedPosts(slug, 6),
  ]);
  if (!post) notFound();

  const postUrl = `${baseUrl}/blog/${post.slug}`;
  const contentHtml = renderMarkdown(post.content);

  // Try to match a related destination by name/country appearing in title/description/tags
  const allDestinationSlugs = getGuideSlugs();
  const candidate = allDestinationSlugs
    .map((s) => getGuideBySlug(s))
    .filter(Boolean)
    .find((dest) => {
      const title = post.title.toLowerCase();
      const desc = (post.description || "").toLowerCase();
      const tags = post.tags.map((t) => t.toLowerCase());
      const name = dest!.name.toLowerCase();
      const country = dest!.country.toLowerCase();
      return (
        title.includes(name) ||
        title.includes(country) ||
        desc.includes(name) ||
        desc.includes(country) ||
        tags.some((t) => t.includes(name) || t.includes(country))
      );
    });

  // Article JSON-LD
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: post.coverImage,
    datePublished: post.date,
    dateModified: post.lastUpdated || post.date,
    author: { "@type": "Person", name: post.author.name },
    publisher: {
      "@type": "Organization",
      name: "Faroway",
      logo: { "@type": "ImageObject", url: `${baseUrl}/icon.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
  };

  const categorySlug = post.category.toLowerCase().replace(/\s+/g, "-");
  const isFinancialContent =
    categorySlug === "money" ||
    post.tags.some((tag) => /credit|finance|bank|rewards/i.test(tag));
  const referencedYear = post.title.match(/\b(20\d{2})\b/)?.[1];
  const isDatedFinancialContent =
    isFinancialContent &&
    referencedYear !== undefined &&
    Number(referencedYear) < new Date().getFullYear();
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${baseUrl}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.category,
        item: `${baseUrl}/blog/category/${categorySlug}`,
      },
      { "@type": "ListItem", position: 4, name: post.title, item: postUrl },
    ],
  };

  return (
    <>
      <ReadingProgressBar />
      <ViewTracker slug={post.slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <main className="min-h-screen">
        {/* ===== Immersive Cinematic Hero ===== */}
        <div className="relative w-full min-h-[50vh] md:min-h-[70vh] overflow-hidden flex items-end">
          <Image
            src={post.coverImage}
            alt={post.coverImageAlt || post.title}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          {/* Multi-layer overlays */}
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-primary/5" />

          {/* Hero content overlay */}
          <div className="relative z-10 w-full pb-10 md:pb-16 pt-32">
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
              <div className="max-w-3xl">
                {/* Breadcrumbs */}
                <Breadcrumbs
                  variant="dark"
                  items={[
                    { label: "Home", href: "/" },
                    { label: "Blog", href: "/blog" },
                    {
                      label: post.category,
                      href: `/blog/category/${categorySlug}`,
                    },
                    { label: post.title },
                  ]}
                />

                {/* Category pill */}
                <Link
                  href={`/blog/category/${categorySlug}`}
                  className="inline-block px-3.5 py-1.5 bg-primary/20 border border-primary/30 text-primary-200 backdrop-blur-sm rounded-full text-sm font-semibold mb-5 hover:bg-primary/30 transition-colors"
                >
                  {post.category}
                </Link>

                {/* Title */}
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold text-white leading-[1.1] tracking-tight mb-5">
                  {post.title}
                </h1>

                {/* Description */}
                <p className="text-lg md:text-xl text-white/75 leading-relaxed mb-8 max-w-2xl">
                  {post.description}
                </p>

                {/* Author row + share */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <Image
                      src={post.author.avatar}
                      alt={post.author.name}
                      width={44}
                      height={44}
                      className="rounded-full ring-2 ring-white/20"
                    />
                    <div>
                      <p className="font-semibold text-white text-sm">
                        {post.author.name}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-white/50">
                        <time dateTime={post.date}>
                          {new Date(post.date).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </time>
                        <span>·</span>
                        <span>{post.readingTime} min read</span>
                      </div>
                    </div>
                  </div>
                  <ShareButtons
                    variant="dark"
                    url={postUrl}
                    title={post.title}
                    description={post.description}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Decorative gradient separator ===== */}
        <div className="flex justify-center py-8">
          <div className="h-1 w-24 bg-gradient-to-r from-primary to-amber-500 rounded-full" />
        </div>

        {/* ===== Content + TOC ===== */}
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
          <div className="flex gap-16 max-w-7xl mx-auto mt-8">
            {/* Article content */}
            <article className="max-w-[720px] mx-auto flex-1 min-w-0">
              {isFinancialContent && (
                <aside
                  role="note"
                  className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950"
                >
                  <strong>
                    {isDatedFinancialContent
                      ? `This article references ${referencedYear} terms. `
                      : "Financial terms can change. "}
                  </strong>
                  Verify current fees, rates, rewards, and coverage directly
                  with the card issuer before making a financial decision.
                </aside>
              )}
              <ProseWrapper html={contentHtml} />

              {/* Tags */}
              <div className="mt-14 pt-6 border-t border-gray-200">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Topics
                </p>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm border border-primary-200 hover:bg-primary-100 transition-colors"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Author Bio — Editorial Card */}
              <div className="mt-10 p-6 bg-gradient-to-br from-gray-50 to-primary-50/30 border border-gray-200 rounded-2xl flex gap-5 items-start">
                <Image
                  src={post.author.avatar}
                  alt={post.author.name}
                  width={64}
                  height={64}
                  className="rounded-2xl flex-shrink-0 ring-2 ring-gray-200"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Written by
                  </p>
                  <p className="font-bold text-slate-900 text-lg">
                    {post.author.name}
                  </p>
                  <p className="text-slate-600 text-sm mt-1.5 leading-relaxed">
                    {post.author.bio}
                  </p>
                  {post.author.twitter && (
                    <a
                      href={`https://twitter.com/${post.author.twitter.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 mt-2 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      {post.author.twitter}
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <ShareButtons
                  url={postUrl}
                  title={post.title}
                  description={post.description}
                />
              </div>

              <NewsletterCTA />
            </article>

            {/* Sidebar TOC */}
            <aside className="hidden lg:block w-72 flex-shrink-0">
              <TableOfContents content={post.content} />
            </aside>
          </div>

          {/* ===== Related Destination & Tools ===== */}
          {candidate && (
            <section className="max-w-7xl mx-auto py-16 mt-8">
              <div className="text-center mb-10">
                <span className="inline-block px-4 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm font-semibold border border-primary-200 mb-4">
                  Plan with Faroway
                </span>
                <h2 className="text-3xl font-bold">
                  Headed to <span className="text-gradient">{candidate.name}</span>?
                </h2>
                <p className="text-slate-600 mt-2">
                  Explore our {candidate.name} guide and helpful trip tools.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link
                  href={`/destinations/${candidate.slug}`}
                  className="p-4 rounded-xl border border-slate-200/60 bg-white hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
                    {candidate.name} Destination Guide
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Highlights, itineraries & tips
                  </p>
                </Link>
                <Link
                  href={`/tools/best-time-to-visit/${candidate.slug}`}
                  className="p-4 rounded-xl border border-slate-200/60 bg-white hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
                    Best Time to Visit {candidate.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Climate & crowd data by month
                  </p>
                </Link>
                <Link
                  href={`/tools/trip-cost/${candidate.slug}`}
                  className="p-4 rounded-xl border border-slate-200/60 bg-white hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
                    Trip Cost for {candidate.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Budget breakdowns & prices
                  </p>
                </Link>
                <Link
                  href={`/tools/visa-checker/${candidate.slug}`}
                  className="p-4 rounded-xl border border-slate-200/60 bg-white hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
                    Visa Requirements for {candidate.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Check by passport country
                  </p>
                </Link>
              </div>
            </section>
          )}

          {/* ===== Related Posts ===== */}
          {related.length > 0 && (
            <section className="max-w-7xl mx-auto py-16 mt-8">
              {/* Gradient separator */}
              <div className="flex justify-center mb-12">
                <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              </div>

              {/* Section badge pattern */}
              <div className="text-center mb-10">
                <span className="inline-block px-4 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm font-semibold border border-primary-200 mb-4">
                  Keep Reading
                </span>
                <h2 className="text-3xl font-bold">
                  <span className="text-gradient">You Might Also Like</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {related.map((p, i) => (
                  <FadeInOnScroll key={p.slug} delay={i * 150}>
                    <BlogCard post={p} />
                  </FadeInOnScroll>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
