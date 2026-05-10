"use client";

import Link from "next/link";
import { FaRulerCombined, FaEye, FaArrowRight } from "react-icons/fa";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const tools = [
  {
    icon: <FaRulerCombined size={20} />,
    label: "Area Calculator",
    description:
      "Estimate total built-up area by composing spaces. Adjust for walls, circulation, and floor multipliers.",
    href: "/tools/areacalc",
    cta: "Open Calculator",
    accent: "#16a34a",
    accentDark: "#4ade80",
    bg: "#f0fdf4",
    bgDark: "#052e16",
  },
  {
    icon: <FaEye size={20} />,
    label: "360° Viewer",
    description:
      "Step inside your project. Explore architectural spaces with an immersive, drag-to-rotate panoramic viewer.",
    href: "/tools/panorama",
    cta: "Open Viewer",
    accent: "#b45309",
    accentDark: "#facc15",
    bg: "#fefce8",
    bgDark: "#1c1400",
  },
];

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

export default function ToolsPage() {
  const [theme, setTheme] = useState<Theme | null>(null);

  // Read browser preference on mount
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(mq.matches ? "dark" : "light");
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // Avoid flash — render nothing until theme is resolved
  if (!theme) return null;

  const isDark = theme === "dark";

  const styles = {
    page: {
      minHeight: "60vh",
      padding: "48px 24px 72px",
      background: isDark ? "#111" : "#f8f8f6",
      transition: "background 0.3s ease",
      fontFamily: "'DM Sans', sans-serif",
    } as React.CSSProperties,
    inner: {
      maxWidth: 860,
      margin: "0 auto",
    } as React.CSSProperties,
    topBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      flexWrap: "wrap" as const,
      gap: 16,
      marginBottom: 48,
    },
    heading: {
      fontFamily: "'Playfair Display', serif",
      fontSize: "clamp(28px, 4vw, 40px)",
      fontWeight: 600,
      color: isDark ? "#f0f0f0" : "#1a1a1a",
      letterSpacing: "-0.5px",
      lineHeight: 1.2,
    } as React.CSSProperties,
    sub: {
      marginTop: 8,
      fontSize: 14,
      fontWeight: 300,
      color: isDark ? "#888" : "#666",
      lineHeight: 1.7,
    } as React.CSSProperties,
    toggleBtn: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "7px 14px",
      borderRadius: 999,
      border: `1px solid ${isDark ? "#333" : "#d4d4d4"}`,
      background: isDark ? "#1c1c1c" : "#fff",
      color: isDark ? "#aaa" : "#555",
      cursor: "pointer",
      fontSize: 13,
      fontFamily: "'DM Sans', sans-serif",
      transition: "all 0.2s ease",
      flexShrink: 0,
    } as React.CSSProperties,
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: 24,
    } as React.CSSProperties,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=Playfair+Display:wght@600&display=swap');

        .tool-card {
          border-radius: 14px;
          padding: 36px 32px;
          border: 1px solid ${isDark ? "#262626" : "#e5e5e5"};
          background: ${isDark ? "#171717" : "#ffffff"};
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
          position: relative;
          overflow: hidden;
        }
        .tool-card::after {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.22s ease;
          pointer-events: none;
          border-radius: 14px;
        }
        .tool-card:hover {
          transform: translateY(-3px);
        }
        .tool-card-green:hover {
          border-color: ${isDark ? "#4ade80" : "#16a34a"};
          box-shadow: 0 12px 40px ${isDark ? "#4ade8020" : "#16a34a18"};
        }
        .tool-card-amber:hover {
          border-color: ${isDark ? "#facc15" : "#b45309"};
          box-shadow: 0 12px 40px ${isDark ? "#facc1520" : "#b4530918"};
        }

        .icon-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          margin-bottom: 22px;
          transition: background 0.2s ease;
        }

        .tool-card-label {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.2px;
          margin-bottom: 10px;
          color: ${isDark ? "#f0f0f0" : "#1a1a1a"};
        }
        .tool-card-desc {
          font-size: 13.5px;
          font-weight: 300;
          line-height: 1.75;
          color: ${isDark ? "#777" : "#666"};
          margin-bottom: 28px;
        }
        .tool-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 18px;
          border-radius: 7px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          letter-spacing: 0.2px;
          transition: background 0.18s ease, color 0.18s ease, opacity 0.18s ease;
        }
      `}</style>

      <div style={styles.page}>
        <div style={styles.inner}>

          {/* Top bar: heading + toggle */}
          <div style={styles.topBar}>
            <div>
              <h1 style={styles.heading}>Studio Tools</h1>
              <p style={styles.sub}>Precision utilities for design and exploration.</p>
            </div>
            <button onClick={toggle} style={styles.toggleBtn} aria-label="Toggle theme">
              {isDark ? <SunIcon /> : <MoonIcon />}
              <span>{isDark ? "Light" : "Dark"}</span>
            </button>
          </div>

          {/* Cards */}
          <div style={styles.grid}>
            {tools.map((tool, i) => {
              const accent = isDark ? tool.accentDark : tool.accent;
              const iconBg = isDark ? tool.bgDark : tool.bg;
              return (
                <div
                  key={tool.href}
                  className={`tool-card ${i === 0 ? "tool-card-green" : "tool-card-amber"}`}
                >
                  <div
                    className="icon-pill"
                    style={{ background: iconBg, color: accent }}
                  >
                    {tool.icon}
                  </div>
                  <div className="tool-card-label">{tool.label}</div>
                  <p className="tool-card-desc">{tool.description}</p>
                  <Link
                    href={tool.href}
                    className="tool-btn"
                    style={{
                      background: accent,
                      color: isDark && i === 0 ? "#052e16" : isDark && i === 1 ? "#1c1400" : "#fff",
                    }}
                  >
                    {tool.cta}
                    <FaArrowRight size={10} />
                  </Link>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </>
  );
}