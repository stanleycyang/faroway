import React from "react";
import Image from "next/image";

export function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "tip" | "important";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-blue-50 border-blue-400 text-blue-900",
    warning: "bg-amber-50 border-amber-400 text-amber-900",
    tip: "bg-green-50 border-green-400 text-green-900",
    important: "bg-purple-50 border-purple-400 text-purple-900",
  };
  const icons = { info: "ℹ️", warning: "⚠️", tip: "💡", important: "🔥" };

  return (
    <div
      className={`my-6 rounded-xl border-l-4 p-4 md:p-6 ${styles[type]}`}
      role="note"
    >
      <span className="mr-2">{icons[type]}</span>
      {children}
    </div>
  );
}

export function TipBox({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-6 rounded-xl bg-primary-50 border border-primary-200 p-4 md:p-6">
      {title && (
        <p className="font-semibold text-primary-800 mb-2">💡 {title}</p>
      )}
      <div className="text-primary-900">{children}</div>
    </div>
  );
}

export function ImageGallery({
  images,
}: {
  images: { src: string; alt: string; caption?: string }[];
}) {
  return (
    <div className="my-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {images.map((img, i) => (
        <figure key={i} className="relative overflow-hidden rounded-xl">
          <Image
            src={img.src}
            alt={img.alt}
            width={600}
            height={256}
            className="w-full h-64 object-cover"
            unoptimized
          />
          {img.caption && (
            <figcaption className="text-sm text-gray-500 mt-2 text-center">
              {img.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

export function EmbeddedMap({ src, title }: { src: string; title?: string }) {
  return (
    <div className="my-8 rounded-xl overflow-hidden aspect-video">
      <iframe
        src={src}
        title={title || "Map"}
        className="w-full h-full border-0"
        loading="lazy"
        allowFullScreen
      />
    </div>
  );
}

// Prose wrapper for MDX content rendered as HTML
export function ProseWrapper({ html }: { html: string }) {
  return (
    <div
      className="prose prose-lg prose-gray max-w-none prose-editorial
        prose-headings:font-bold prose-headings:tracking-tight prose-headings:scroll-mt-24
        prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4
        prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
        prose-p:leading-relaxed prose-p:text-gray-700
        prose-a:text-primary-600 prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-primary-800
        prose-strong:text-gray-900
        prose-ul:my-4 prose-li:my-1
        prose-img:rounded-xl prose-img:shadow-lg
        prose-blockquote:border-primary-400 prose-blockquote:bg-gray-50 prose-blockquote:rounded-r-xl prose-blockquote:py-1
        prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-primary-700 prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-gray-950 prose-pre:rounded-2xl prose-pre:shadow-lg
        prose-hr:my-12
        prose-table:overflow-x-auto prose-table:rounded-xl prose-table:border prose-table:border-gray-200
        prose-th:bg-gray-50 prose-th:text-left prose-th:text-sm prose-th:font-semibold prose-th:text-slate-700 prose-th:px-4 prose-th:py-3
        prose-td:px-4 prose-td:py-3 prose-td:text-sm prose-td:text-slate-600 prose-td:border-t prose-td:border-gray-100"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
