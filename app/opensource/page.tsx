// app/opensource/page.tsx
"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Donor {
  id: string;
  name: string;
  logoUrl: string;
  link?: string;
  amount: number;
  cols: number;
  rows: number;
  isActive: boolean; // false if subscription ended
}

interface PlacedDonor extends Donor {
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */

const GRID_COLUMNS = 40;
const PIXEL_SIZE = 20;
const COST_PER_PIXEL = 5;

/* ------------------------------------------------------------------ */
/*  Mock data — replace with a fetch() to your API                    */
/* ------------------------------------------------------------------ */

const DONORS: Donor[] = [
  {
    id: "1",
    name: "Acme Corp",
    logoUrl: "https://dummyimage.com/160x160/4f46e5/ffffff&text=Acme",
    link: "https://acme.example.com",
    amount: 2000,
    cols: 8,
    rows: 8,
    isActive: true,
  },
  {
    id: "2",
    name: "Jane Doe",
    logoUrl: "https://dummyimage.com/80x80/16a34a/ffffff&text=JD",
    amount: 200,
    cols: 4,
    rows: 4,
    isActive: true,
  },
  {
    id: "3",
    name: "OpenStack Foundry",
    logoUrl: "https://dummyimage.com/120x120/ea580c/ffffff&text=OSF",
    link: "https://openstackfoundry.example.com",
    amount: 800,
    cols: 6,
    rows: 6,
    isActive: false, // Subscription ended
  },
  {
    id: "4",
    name: "Priya K.",
    logoUrl: "https://dummyimage.com/40x40/db2777/ffffff&text=PK",
    amount: 20,
    cols: 2,
    rows: 2,
    isActive: true,
  },
  {
    id: "5",
    name: "Nimbus Cloud",
    logoUrl: "https://dummyimage.com/100x100/0891b2/ffffff&text=Nimbus",
    link: "https://nimbus.example.com",
    amount: 400,
    cols: 4,
    rows: 4,
    isActive: false, // Subscription ended
  },
  {
    id: "6",
    name: "Anon Supporter",
    logoUrl: "https://dummyimage.com/40x40/6b7280/ffffff&text=%3F",
    amount: 20,
    cols: 2,
    rows: 2,
    isActive: true,
  },
];

/* ------------------------------------------------------------------ */
/*  Packing algorithm                                                 */
/* ------------------------------------------------------------------ */

function packDonors(
  donors: Donor[],
  gridCols: number
): { placed: PlacedDonor[]; totalRows: number } {
  // Only pack active donors
  const activeDonors = donors.filter(d => d.isActive);
  const sorted = [...activeDonors].sort((a, b) => b.rows * b.cols - a.rows * a.cols);

  const occupied: boolean[][] = [];

  const ensureRows = (rows: number) => {
    while (occupied.length < rows) {
      occupied.push(new Array(gridCols).fill(false));
    }
  };

  const fits = (x: number, y: number, w: number, h: number) => {
    if (x + w > gridCols) return false;
    ensureRows(y + h);
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        if (occupied[r][c]) return false;
      }
    }
    return true;
  };

  const place = (x: number, y: number, w: number, h: number) => {
    ensureRows(y + h);
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        occupied[r][c] = true;
      }
    }
  };

  const placed: PlacedDonor[] = [];

  for (const donor of sorted) {
    const w = donor.cols;
    const h = donor.rows;
    let foundY = 0;
    let foundX = 0;
    let found = false;

    outerLoop: for (let y = 0; y < 5000; y++) {
      ensureRows(y + h);
      for (let x = 0; x <= gridCols - w; x++) {
        if (fits(x, y, w, h)) {
          foundX = x;
          foundY = y;
          found = true;
          break outerLoop;
        }
      }
    }

    if (found) {
      place(foundX, foundY, w, h);
      placed.push({ ...donor, x: foundX, y: foundY });
    }
  }

  const totalRows = occupied.length;
  return { placed, totalRows };
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function OpenSourcePage() {
  const { placed, totalRows } = useMemo(() => packDonors(DONORS, GRID_COLUMNS), []);
  const [hovered, setHovered] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const activeDonors = DONORS.filter(d => d.isActive);
  const totalRaised = activeDonors.reduce((sum, d) => sum + d.amount, 0);
  const inactiveDonors = DONORS.filter(d => !d.isActive);

  // Mouse drag handlers for sliding
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    setStartX(e.touches[0].pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const x = e.touches[0].pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  const themeClasses = {
    background: theme === "dark" ? "bg-neutral-950" : "bg-neutral-50",
    text: theme === "dark" ? "text-neutral-100" : "text-neutral-900",
    textSecondary: theme === "dark" ? "text-neutral-400" : "text-neutral-600",
    border: theme === "dark" ? "border-neutral-800" : "border-neutral-200",
    cardBg: theme === "dark" ? "bg-neutral-900" : "bg-white",
    cardBorder: theme === "dark" ? "border-neutral-800" : "border-neutral-200",
    gridLines: theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
  };

  return (
    <main className={`min-h-screen ${themeClasses.background} ${themeClasses.text} px-4 py-6 sm:py-12 sm:px-8 transition-colors duration-300`}>
      <div className="mx-auto max-w-5xl">
        {/* Theme toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg ${themeClasses.cardBg} ${themeClasses.border} border transition-colors duration-200 text-2xl`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Heading */}
        <section className="mb-8 text-center">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
            We Support Open Source Development Through Modelflick
          </h1>
          <p className={`mt-2 ${themeClasses.textSecondary} text-sm sm:text-base max-w-2xl mx-auto`}>
            Every organization and individual below bought pixels on this wall
            to fund open source development on our platform.
          </p>
        </section>

        {/* Pixel wall with drag to slide */}
        <div
          ref={containerRef}
          className={`mb-6 overflow-x-auto rounded-xl border ${themeClasses.cardBorder} ${themeClasses.cardBg} p-4 transition-colors duration-300 cursor-grab active:cursor-grabbing`}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          style={{
            scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            className="relative mx-auto"
            style={{
              width: GRID_COLUMNS * PIXEL_SIZE,
              height: totalRows * PIXEL_SIZE,
              minWidth: GRID_COLUMNS * PIXEL_SIZE,
              backgroundImage:
                `linear-gradient(to right, ${themeClasses.gridLines} 1px, transparent 1px), linear-gradient(to bottom, ${themeClasses.gridLines} 1px, transparent 1px)`,
              backgroundSize: `${PIXEL_SIZE}px ${PIXEL_SIZE}px`,
            }}
          >
            {placed.map((donor) => {
              const donorBlock = (
                <div
                  onMouseEnter={() => setHovered(donor.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="absolute border border-neutral-950/60 overflow-hidden transition-transform duration-150 hover:z-10 hover:scale-[1.03] hover:shadow-lg"
                  style={{
                    left: donor.x * PIXEL_SIZE,
                    top: donor.y * PIXEL_SIZE,
                    width: donor.cols * PIXEL_SIZE,
                    height: donor.rows * PIXEL_SIZE,
                  }}
                >
                  <Image
                    src={donor.logoUrl}
                    alt={donor.name}
                    fill
                    sizes={`${donor.cols * PIXEL_SIZE}px`}
                    className="object-cover"
                  />
                  {hovered === donor.id && (
                    <div className={`absolute inset-0 flex flex-col items-center justify-center ${theme === "dark" ? "bg-black/75" : "bg-white/75"} text-center px-1`}>
                      <span className="text-[10px] sm:text-xs font-medium leading-tight">
                        {donor.name}
                      </span>
                    </div>
                  )}
                </div>
              );

              if (donor.link) {
                return (
                  <a key={donor.id} href={donor.link} target="_blank" rel="noopener noreferrer" className="contents">
                    {donorBlock}
                  </a>
                );
              }

              return <div key={donor.id}>{donorBlock}</div>;
            })}
          </div>
        </div>

        {/* Stats after the wall - only supporters and total raised */}
        <div className={`flex flex-wrap justify-center gap-6 sm:gap-8 text-sm mb-8 ${themeClasses.textSecondary}`}>
          <span>
            <strong className={themeClasses.text}>{activeDonors.length}</strong> supporters
          </span>
          <span>
            <strong className={themeClasses.text}>${totalRaised.toLocaleString()}</strong> raised
          </span>
        </div>

        {/* Support section with text link and archives link */}
        <section className={`rounded-xl border ${themeClasses.cardBorder} ${themeClasses.cardBg} p-6 sm:p-8 transition-colors duration-300 space-y-4`}>
          <div className="text-center">
            <p className={`${themeClasses.textSecondary} text-sm sm:text-base`}>
              I want to support open source dev through this platform.{' '}
              <Link
                href="/opensource/pixels"
                className="text-indigo-500 hover:text-indigo-400 font-medium underline underline-offset-2 transition-colors"
              >
                Click here
              </Link>
            </p>
          </div>
          
          {inactiveDonors.length > 0 && (
            <div className="text-center border-t pt-4 border-neutral-700/30">
              <Link
                href="/opensource/archives"
                className={`text-xs ${themeClasses.textSecondary} hover:${themeClasses.text} transition-colors underline underline-offset-2`}
              >
                View {inactiveDonors.length} archived supporters whose subscriptions have ended →
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}