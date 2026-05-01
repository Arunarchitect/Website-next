/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  CATEGORIES,
  AUTHORS,
  searchPosts,
  getFeaturedPosts,
  formatDate,
  type BlogPost,
  type Author,
  type AuthorRole,
} from '@/app/modelblog/blogapi';

type Theme = 'dark' | 'light';

function AuthorPip({
  author,
  size = 'sm',
}: {
  author: Author;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <span
      className={`${dim} rounded-full flex items-center justify-center font-bold text-white ring-2 shrink-0`}
      style={{ backgroundColor: author.avatarColor }}
      title={author.name}
    >
      {author.avatarInitials}
    </span>
  );
}

const ROLE_STYLES_DARK: Record<AuthorRole, string> = {
  Eminent: 'bg-amber-900/40 text-amber-300 border border-amber-700/40',
  Editorial: 'bg-sky-900/40 text-sky-300 border border-sky-700/40',
  Guest: 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40',
  Staff: 'bg-stone-800 text-stone-400 border border-stone-700',
};
const ROLE_STYLES_LIGHT: Record<AuthorRole, string> = {
  Eminent: 'bg-amber-100 text-amber-800 border border-amber-300',
  Editorial: 'bg-sky-100 text-sky-800 border border-sky-300',
  Guest: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  Staff: 'bg-stone-100 text-stone-600 border border-stone-300',
};

function RoleBadge({ role, theme }: { role: AuthorRole; theme: Theme }) {
  const styles = theme === 'dark' ? ROLE_STYLES_DARK : ROLE_STYLES_LIGHT;
  return (
    <span
      className={`text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full ${styles[role]}`}
    >
      {role}
    </span>
  );
}

function AuthorCard({ author, theme }: { author: Author; theme: Theme }) {
  const isDark = theme === 'dark';
  return (
    <div className="flex items-start gap-3 py-2">
      <AuthorPip author={author} size="md" />
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
            {author.name}
          </span>
          <RoleBadge role={author.role} theme={theme} />
        </div>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-stone-500' : 'text-stone-500'}`}>
          {author.title}
        </p>
      </div>
    </div>
  );
}

function FeaturedCard({
  post,
  index,
  theme,
  onClick,
}: {
  post: BlogPost;
  index: number;
  theme: Theme;
  onClick: () => void;
}) {
  const isWide = index === 0;
  const isDark = theme === 'dark';

  return (
    <article
      className={`relative rounded-2xl overflow-hidden border group cursor-pointer flex flex-col transition-all duration-200
        ${isWide ? 'md:col-span-2' : ''}
        ${isDark ? 'bg-stone-950 border-stone-800 hover:border-stone-600' : 'bg-white border-stone-200 hover:border-stone-400 shadow-sm hover:shadow-md'}`}
      onClick={onClick}
    >
      <div className="h-1 w-full shrink-0" style={{ background: post.coverAccent }} />
      <div className="flex flex-col flex-1 p-6 gap-4">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-semibold tracking-widest uppercase ${isDark ? 'text-stone-500' : 'text-stone-400'}`}>
            {post.category}
          </span>
          <span className={`text-[11px] ${isDark ? 'text-stone-600' : 'text-stone-400'}`}>
            {post.readingTimeMinutes} min read
          </span>
        </div>
        <div>
          <h2
            className={`font-bold leading-tight transition-colors
              ${isWide ? 'text-2xl md:text-3xl' : 'text-xl'}
              ${isDark ? 'text-stone-100 group-hover:text-amber-300' : 'text-stone-900 group-hover:text-amber-700'}`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {post.title}
          </h2>
          <p className={`mt-1.5 text-sm leading-relaxed ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
            {post.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-auto">
          <div className="flex -space-x-2">
            {post.authors.map((a) => (
              <AuthorPip key={a.id} author={a} />
            ))}
          </div>
          <span className={`text-xs ${isDark ? 'text-stone-500' : 'text-stone-500'}`}>
            {post.authors.map((a) => a.name).join(' & ')}
          </span>
          <span className={`ml-auto text-xs ${isDark ? 'text-stone-700' : 'text-stone-400'}`}>
            {formatDate(post.publishedAt)}
          </span>
        </div>
        <p className={`text-[10px] transition-colors ${isDark ? 'text-stone-700 group-hover:text-stone-500' : 'text-stone-400 group-hover:text-stone-600'}`}>
          Click to read →
        </p>
      </div>
    </article>
  );
}

function PostCard({
  post,
  theme,
  onClick,
}: {
  post: BlogPost;
  theme: Theme;
  onClick: () => void;
}) {
  const isDark = theme === 'dark';
  return (
    <article
      className={`border rounded-xl overflow-hidden flex flex-col cursor-pointer group transition-all duration-200
        ${isDark ? 'bg-stone-950 border-stone-800 hover:border-stone-600' : 'bg-white border-stone-200 hover:border-stone-400 shadow-sm hover:shadow-md'}`}
      onClick={onClick}
    >
      <div className="h-[3px] w-full" style={{ background: post.coverAccent }} />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-semibold tracking-widest uppercase ${isDark ? 'text-stone-600' : 'text-stone-400'}`}>
            {post.category}
          </span>
          <span className={`text-[10px] ${isDark ? 'text-stone-700' : 'text-stone-400'}`}>
            {post.readingTimeMinutes} min
          </span>
        </div>
        <h3
          className={`text-base font-bold leading-snug transition-colors
            ${isDark ? 'text-stone-200 group-hover:text-amber-300' : 'text-stone-900 group-hover:text-amber-700'}`}
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {post.title}
        </h3>
        <p className={`text-xs leading-relaxed line-clamp-2 ${isDark ? 'text-stone-500' : 'text-stone-500'}`}>
          {post.subtitle}
        </p>
        <div className={`flex items-center gap-2 mt-auto pt-2 border-t ${isDark ? 'border-stone-900' : 'border-stone-100'}`}>
          <div className="flex -space-x-1.5">
            {post.authors.map((a) => (
              <AuthorPip key={a.id} author={a} />
            ))}
          </div>
          <span className={`text-[11px] truncate ${isDark ? 'text-stone-600' : 'text-stone-500'}`}>
            {post.authors.map((a) => a.name).join(' & ')}
          </span>
        </div>
      </div>
    </article>
  );
}

function AuthorsSidebar({ theme }: { theme: Theme }) {
  const isDark = theme === 'dark';
  return (
    <aside className={`border rounded-xl p-5 ${isDark ? 'bg-stone-950 border-stone-800' : 'bg-white border-stone-200 shadow-sm'}`}>
      <h3
        className={`text-xs font-semibold tracking-widest uppercase mb-4 ${isDark ? 'text-stone-500' : 'text-stone-400'}`}
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        Contributors
      </h3>
      <div className={`divide-y ${isDark ? 'divide-stone-900' : 'divide-stone-100'}`}>
        {Object.values(AUTHORS).map((a) => (
          <div key={a.id} className="py-3">
            <div className="flex items-center gap-2 mb-1">
              <AuthorPip author={a} size="sm" />
              <div>
                <p className={`text-xs font-semibold ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>
                  {a.name}
                </p>
                <RoleBadge role={a.role} theme={theme} />
              </div>
            </div>
            <p className={`text-[11px] leading-snug ml-9 ${isDark ? 'text-stone-600' : 'text-stone-500'}`}>
              {a.bio}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function ModelBlogPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>('dark');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';
  const featured = getFeaturedPosts();

  const results = useMemo(
    () => searchPosts(searchTerm, selectedCategory),
    [searchTerm, selectedCategory]
  );

  const nonFeatured = useMemo(
    () => results.filter((p) => !p.featured || searchTerm || selectedCategory !== 'All'),
    [results, searchTerm, selectedCategory]
  );

  const showFeatured = !searchTerm && selectedCategory === 'All';

  const navigateToPost = (slug: string) => {
    router.push(`/modelblog/blog/${slug}`);
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-stone-950 text-stone-100' : 'bg-stone-50 text-stone-900'}`}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      {/* ── Header ── */}
      <header
        className={`sticky top-0 z-30 backdrop-blur border-b transition-colors duration-300
          ${isDark ? 'bg-stone-950/90 border-stone-900' : 'bg-stone-50/90 border-stone-200'}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <span
              className={`text-xl font-bold tracking-tight ${isDark ? 'text-stone-100' : 'text-stone-900'}`}
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Model<span className="text-amber-500">Blog</span>
            </span>
            <span className={`hidden sm:inline text-xs ml-3 tracking-widest uppercase ${isDark ? 'text-stone-600' : 'text-stone-400'}`}>
              Architecture · Cities · Environment
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`text-xs border rounded-lg px-3 py-1.5 transition-colors
                ${isDark ? 'text-stone-400 border-stone-800 hover:text-stone-100 hover:border-stone-600' : 'text-stone-500 border-stone-300 hover:text-stone-800 hover:border-stone-500'}`}
              aria-label="Toggle theme"
            >
              {isDark ? '☀ Light' : '☾ Dark'}
            </button>
            <button
              onClick={() => setShowSidebar((s) => !s)}
              className={`text-xs border rounded-lg px-3 py-1.5 transition-colors
                ${isDark ? 'text-stone-500 border-stone-800 hover:text-stone-200' : 'text-stone-500 border-stone-300 hover:text-stone-800'}`}
            >
              Contributors
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* ── Dev notice ── */}
        <div
          className={`mb-8 px-4 py-3 rounded-lg border text-xs
            ${isDark ? 'border-amber-900/50 bg-amber-950/30 text-amber-400/80' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
        >
          This blog is in active development. Articles are written or commissioned; sources are cited
          inline. All editorial content represents the author&apos;s view.
        </div>

        {/* ── Search + Filter ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search articles, authors, topics…"
              className={`w-full border rounded-xl px-4 py-2.5 text-sm placeholder-stone-500
                focus:outline-none transition-colors
                ${isDark ? 'bg-stone-900 border-stone-800 text-stone-200 focus:border-amber-700' : 'bg-white border-stone-300 text-stone-800 focus:border-amber-500'}`}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-stone-600 hover:text-stone-300' : 'text-stone-400 hover:text-stone-700'}`}
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all
                  ${
                    selectedCategory === cat
                      ? 'bg-amber-600 text-amber-100'
                      : isDark
                        ? 'bg-stone-900 text-stone-500 border border-stone-800 hover:text-stone-200 hover:border-stone-600'
                        : 'bg-white text-stone-500 border border-stone-300 hover:text-stone-800 hover:border-stone-500'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-8">
          <main className="flex-1 min-w-0">
            {/* ── Featured ── */}
            {showFeatured && (
              <section className="mb-12">
                <div className="flex items-center gap-3 mb-5">
                  <h2
                    className={`text-xs font-semibold tracking-widest uppercase ${isDark ? 'text-stone-500' : 'text-stone-400'}`}
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    Featured
                  </h2>
                  <div className={`flex-1 h-px ${isDark ? 'bg-stone-900' : 'bg-stone-200'}`} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {featured.map((post, i) => (
                    <FeaturedCard
                      key={post.id}
                      post={post}
                      index={i}
                      theme={theme}
                      onClick={() => navigateToPost(post.slug)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── All / Filtered ── */}
            <section>
              <div className="flex items-center gap-3 mb-5">
                <h2
                  className={`text-xs font-semibold tracking-widest uppercase ${isDark ? 'text-stone-500' : 'text-stone-400'}`}
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {searchTerm
                    ? `${results.length} result${results.length !== 1 ? 's' : ''} for "${searchTerm}"`
                    : selectedCategory !== 'All'
                      ? selectedCategory
                      : 'All Articles'}
                </h2>
                <div className={`flex-1 h-px ${isDark ? 'bg-stone-900' : 'bg-stone-200'}`} />
              </div>

              {(showFeatured ? nonFeatured : results).length === 0 ? (
                <div className={`text-sm py-16 text-center ${isDark ? 'text-stone-600' : 'text-stone-400'}`}>
                  No articles match your search.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(showFeatured ? nonFeatured : results).map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      theme={theme}
                      onClick={() => navigateToPost(post.slug)}
                    />
                  ))}
                </div>
              )}
            </section>
          </main>

          {/* ── Sidebar Desktop ── */}
          {showSidebar && (
            <aside className="hidden lg:block w-72 shrink-0">
              <div className="sticky top-24">
                <AuthorsSidebar theme={theme} />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ── Mobile Sidebar Drawer ── */}
      {showSidebar && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSidebar(false)} />
          <div
            className={`absolute right-0 top-0 bottom-0 w-80 border-l overflow-y-auto p-5
              ${isDark ? 'bg-stone-950 border-stone-800' : 'bg-white border-stone-200'}`}
          >
            <button
              className={`text-sm mb-4 ${isDark ? 'text-stone-500 hover:text-stone-200' : 'text-stone-400 hover:text-stone-800'}`}
              onClick={() => setShowSidebar(false)}
            >
              ✕ Close
            </button>
            <AuthorsSidebar theme={theme} />
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer
        className={`border-t mt-20 py-8 text-center text-xs transition-colors duration-300
          ${isDark ? 'border-stone-900 text-stone-700' : 'border-stone-200 text-stone-400'}`}
      >
        ModelBlog — informed writing on architecture, cities, and the built environment.
        All articles are independently authored and editorially reviewed.
      </footer>
    </div>
  );
}