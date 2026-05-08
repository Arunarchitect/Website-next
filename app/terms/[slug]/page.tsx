/* eslint-disable @next/next/no-img-element */

"use client";

import { use, useEffect, useState } from "react";
import {
  formatTermDate,
  getTermBySlug,
  getTermImageById,
  type TermBlock,
  type TermDocument,
  type TermImage,
  type TermSection,
} from "@/app/terms/termdata";

type Theme = "dark" | "light";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark";

  return (
    <button
      onClick={onToggle}
      aria-label="Toggle theme"
      className={`relative h-7 w-14 rounded-full border transition-colors duration-500 ${
        isDark ? "border-stone-700 bg-stone-900" : "border-sky-300 bg-sky-100"
      }`}
    >
      <span
        className={`absolute top-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-sm shadow-md transition-all duration-500 ${
          isDark
            ? "translate-x-7 border-stone-600 bg-stone-800"
            : "translate-x-0.5 border-amber-300 bg-amber-400"
        }`}
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

function ReadingProgress({ theme }: { theme: Theme }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const element = document.documentElement;
      const total = element.scrollHeight - element.clientHeight;
      setProgress(total > 0 ? (element.scrollTop / total) * 100 : 0);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-50 h-[3px] ${
        theme === "dark" ? "bg-stone-900" : "bg-stone-200"
      }`}
    >
      <div
        className="h-full bg-amber-500 transition-all duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function TermImageView({
  document,
  imageId,
  theme,
}: {
  document: TermDocument;
  imageId: string;
  theme: Theme;
}) {
  const image: TermImage | undefined = getTermImageById(document, imageId);

  if (!image) return null;

  const isDark = theme === "dark";
  const isPortrait = image.orientation === "portrait";

  return (
    <figure className={`my-9 ${isPortrait ? "mx-auto max-w-md" : "w-full"}`}>
      <div
        className={`overflow-hidden rounded-2xl border ${
          isDark ? "border-stone-800 bg-stone-900" : "border-stone-200 bg-white shadow-sm"
        }`}
      >
        <img
          src={image.src}
          alt={image.alt}
          className={`w-full object-cover ${
            isPortrait ? "aspect-[4/5]" : "aspect-[16/9]"
          }`}
        />
      </div>

      {image.caption && (
        <figcaption
          className={`mt-3 border-l-2 border-amber-600 pl-3 text-sm leading-6 ${
            isDark ? "text-stone-400" : "text-stone-600"
          }`}
        >
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

function RenderBlock({
  block,
  document,
  theme,
}: {
  block: TermBlock;
  document: TermDocument;
  theme: Theme;
}) {
  const isDark = theme === "dark";

  if (block.type === "paragraph") {
    return (
      <p
        className={`mt-5 text-[1.0625rem] leading-8 ${
          isDark ? "text-stone-400" : "text-stone-700"
        }`}
      >
        {block.text}
      </p>
    );
  }

  if (block.type === "bullets") {
    return (
      <ul
        className={`mt-5 list-disc space-y-3 pl-6 text-[1.0625rem] leading-8 ${
          isDark ? "text-stone-400" : "text-stone-700"
        }`}
      >
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "numbered") {
    return (
      <ol
        className={`mt-5 list-decimal space-y-3 pl-6 text-[1.0625rem] leading-8 ${
          isDark ? "text-stone-400" : "text-stone-700"
        }`}
      >
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }

  if (block.type === "note") {
    return (
      <div
        className={`mt-6 rounded-xl border-l-4 border-amber-600 p-4 text-sm leading-7 ${
          isDark ? "bg-stone-900 text-stone-300" : "bg-amber-50 text-stone-700"
        }`}
      >
        {block.text}
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <TermImageView
        document={document}
        imageId={block.imageId}
        theme={theme}
      />
    );
  }

  return null;
}

function SectionBody({
  section,
  document,
  theme,
  level = 2,
}: {
  section: TermSection;
  document: TermDocument;
  theme: Theme;
  level?: 2 | 3;
}) {
  const isDark = theme === "dark";

  return (
    <section id={section.id} className="scroll-mt-24">
      {level === 2 ? (
        <h2
          className={`mt-12 text-2xl font-bold leading-tight ${
            isDark ? "text-stone-100" : "text-stone-900"
          }`}
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {section.title}
        </h2>
      ) : (
        <h3
          className={`mt-9 text-xl font-semibold ${
            isDark ? "text-stone-200" : "text-stone-900"
          }`}
        >
          {section.title}
        </h3>
      )}

      {section.blocks.map((block, index) => (
        <RenderBlock
          key={`${section.id}-${index}`}
          block={block}
          document={document}
          theme={theme}
        />
      ))}

      {section.subheadings?.map((subheading) => (
        <SectionBody
          key={subheading.id}
          section={subheading}
          document={document}
          theme={theme}
          level={3}
        />
      ))}
    </section>
  );
}

function HeadingSidebar({
  document,
  theme,
}: {
  document: TermDocument;
  theme: Theme;
}) {
  const isDark = theme === "dark";

  return (
    <div
      className={`rounded-xl border p-5 ${
        isDark ? "border-stone-800 bg-stone-950" : "border-stone-200 bg-white shadow-sm"
      }`}
    >
      <p
        className={`mb-4 text-[11px] font-semibold uppercase tracking-widest ${
          isDark ? "text-stone-500" : "text-stone-400"
        }`}
      >
        In this document
      </p>

      <nav className="space-y-3">
        {document.sections.map((section) => (
          <div key={section.id}>
            <a
              href={`#${section.id}`}
              className={`block text-sm font-medium ${
                isDark
                  ? "text-stone-400 hover:text-amber-300"
                  : "text-stone-700 hover:text-amber-700"
              }`}
            >
              {section.title}
            </a>

            {section.subheadings && section.subheadings.length > 0 && (
              <div
                className={`mt-2 space-y-2 border-l pl-3 ${
                  isDark ? "border-stone-800" : "border-stone-200"
                }`}
              >
                {section.subheadings.map((subheading) => (
                  <a
                    key={subheading.id}
                    href={`#${subheading.id}`}
                    className={`block text-xs ${
                      isDark
                        ? "text-stone-600 hover:text-amber-300"
                        : "text-stone-500 hover:text-amber-700"
                    }`}
                  >
                    {subheading.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
}

export default function TermDetailPage({ params }: PageProps) {
  const { slug } = use(params);

  const [theme, setTheme] = useState<Theme>("dark");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  useEffect(() => {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    setTheme(prefersLight ? "light" : "dark");
  }, []);

  const document = getTermBySlug(slug);
  const isDark = theme === "dark";

  if (!document) {
    return (
      <div
        className={`flex min-h-screen flex-col items-center justify-center gap-4 ${
          isDark ? "bg-stone-950 text-stone-400" : "bg-stone-50 text-stone-500"
        }`}
      >
        <p className="text-2xl font-bold">Document not found</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-stone-950 text-stone-100" : "bg-stone-50 text-stone-900"
      }`}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
      `}</style>

      <ReadingProgress theme={theme} />

      <header
        className={`sticky top-0 z-30 border-b backdrop-blur ${
          isDark
            ? "border-stone-900 bg-stone-950/90"
            : "border-stone-200 bg-stone-50/90"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <ThemeToggle
            theme={theme}
            onToggle={() => setTheme(isDark ? "light" : "dark")}
          />
        </div>
      </header>

      <div className="h-1 w-full" style={{ background: document.accent }} />

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:px-8 xl:grid-cols-[260px_minmax(0,760px)]">
        {/* Desktop Sidebar */}
        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <HeadingSidebar document={document} theme={theme} />
          </div>
        </aside>

        <article className="min-w-0">
          <p
            className={`mb-4 text-[11px] font-semibold uppercase tracking-widest ${
              isDark ? "text-stone-500" : "text-stone-400"
            }`}
          >
            {document.category}
          </p>

          <h1
            className={`mb-4 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl ${
              isDark ? "text-stone-50" : "text-stone-900"
            }`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {document.title}
          </h1>

          <p
            className={`mb-8 text-lg leading-relaxed ${
              isDark ? "text-stone-400" : "text-stone-600"
            }`}
          >
            {document.subtitle}
          </p>

          <div
            className={`mb-10 border-y py-4 text-sm ${
              isDark
                ? "border-stone-800 text-stone-500"
                : "border-stone-200 text-stone-500"
            }`}
          >
            Last updated: {formatTermDate(document.updatedAt)}
          </div>

          {/* Mobile Sidebar Button */}
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="fixed bottom-5 right-5 z-40 rounded-full bg-amber-600 px-4 py-3 text-sm font-medium text-amber-50 shadow-lg xl:hidden"
          >
            Contents
          </button>

          {/* Mobile Sidebar Drawer */}
          {showMobileSidebar && (
            <div className="fixed inset-0 z-50 xl:hidden">
              <button
                aria-label="Close contents"
                onClick={() => setShowMobileSidebar(false)}
                className="absolute inset-0 bg-black/50"
              />

              <div
                className={`absolute bottom-0 right-0 top-0 w-80 max-w-[85vw] overflow-y-auto p-4 shadow-2xl ${
                  isDark ? "bg-stone-950" : "bg-stone-50"
                }`}
              >
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => setShowMobileSidebar(false)}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      isDark
                        ? "border-stone-700 text-stone-300"
                        : "border-stone-300 text-stone-700"
                    }`}
                  >
                    Close
                  </button>
                </div>

                <HeadingSidebar document={document} theme={theme} />
              </div>
            </div>
          )}

          {document.sections.map((section) => (
            <SectionBody
              key={section.id}
              section={section}
              document={document}
              theme={theme}
            />
          ))}
        </article>
      </div>
    </div>
  );
}