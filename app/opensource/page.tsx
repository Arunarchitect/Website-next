"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
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

const DRAG_THRESHOLD = 6;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;

const CONTENT_WIDTH = GRID_COLUMNS * PIXEL_SIZE;

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
    isActive: false,
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
    isActive: false,
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
  const activeDonors = donors.filter((d) => d.isActive);
  const sorted = [...activeDonors].sort(
    (a, b) => b.rows * b.cols - a.rows * a.cols
  );

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
  const { placed, totalRows } = useMemo(
    () => packDonors(DONORS, GRID_COLUMNS),
    []
  );

  const contentHeight = Math.max(totalRows * PIXEL_SIZE, 1);

  const [hovered, setHovered] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Canvas pan / zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  // Canvas interaction refs
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef({
    distance: 0,
    zoom: 1,
    pan: { x: 0, y: 0 },
    midpoint: { x: 0, y: 0 },
  });

  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  }, [zoom, pan]);

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

  const zoomIn = () => setZoom((v) => Math.min(v * 1.2, MAX_ZOOM));
  const zoomOut = () => setZoom((v) => Math.max(v / 1.2, MIN_ZOOM));

  const fitAllView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const padding = 48;
    const availableWidth = Math.max(rect.width - padding * 2, 1);
    const availableHeight = Math.max(rect.height - padding * 2, 1);

    const scaleX = availableWidth / CONTENT_WIDTH;
    const scaleY = availableHeight / contentHeight;

    const nextZoom = Math.min(
      Math.max(Math.min(scaleX, scaleY), MIN_ZOOM),
      MAX_ZOOM
    );

    setZoom(nextZoom);
    setPan({ x: 0, y: 0 });
  }, [contentHeight]);

  // Initial fit + refit when content size changes
  useEffect(() => {
    const frame = requestAnimationFrame(fitAllView);
    return () => cancelAnimationFrame(frame);
  }, [fitAllView]);

  // Wheel zoom around cursor
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      const oldZoom = zoomRef.current;
      const newZoom = Math.min(Math.max(oldZoom * factor, MIN_ZOOM), MAX_ZOOM);

      if (newZoom === oldZoom) return;

      const rect = viewport.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;
      const ratio = newZoom / oldZoom;
      const oldPan = panRef.current;

      setZoom(newZoom);
      setPan({
        x: (mouseX - halfW) * (1 - ratio) + oldPan.x * ratio,
        y: (mouseY - halfH) * (1 - ratio) + oldPan.y * ratio,
      });
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, []);

  const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const getMidpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const pointers = activePointers.current;

    if (pointers.size === 1) {
      dragStart.current = { x: event.clientX, y: event.clientY };
      panStart.current = { ...pan };
      didDragRef.current = false;
    } else if (pointers.size === 2) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(false);

      const [p1, p2] = Array.from(pointers.values());
      pinchStart.current = {
        distance: getDistance(p1, p2),
        zoom,
        pan: { ...pan },
        midpoint: getMidpoint(p1, p2),
      };
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(event.pointerId)) return;

    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const pointers = activePointers.current;

    if (pointers.size === 1) {
      const dx = event.clientX - dragStart.current.x;
      const dy = event.clientY - dragStart.current.y;

      if (!dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      }

      setPan({
        x: panStart.current.x + dx,
        y: panStart.current.y + dy,
      });
      didDragRef.current = true;
    } else if (pointers.size === 2) {
      const [p1, p2] = Array.from(pointers.values());
      const newDist = getDistance(p1, p2);
      const oldDist = pinchStart.current.distance;

      if (oldDist === 0) return;

      const ratio = newDist / oldDist;
      const newZoom = Math.min(
        Math.max(pinchStart.current.zoom * ratio, MIN_ZOOM),
        MAX_ZOOM
      );

      const viewport = viewportRef.current;
      if (!viewport) return;

      const rect = viewport.getBoundingClientRect();
      const mid = getMidpoint(p1, p2);
      const localX = mid.x - rect.left;
      const localY = mid.y - rect.top;
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;
      const zoomRatio = newZoom / pinchStart.current.zoom;
      const oldPan = pinchStart.current.pan;

      setZoom(newZoom);
      setPan({
        x: (localX - halfW) * (1 - zoomRatio) + oldPan.x * zoomRatio,
        y: (localY - halfH) * (1 - zoomRatio) + oldPan.y * zoomRatio,
      });

      didDragRef.current = true;
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(event.pointerId);
    if (activePointers.current.size < 2) {
      setDragging(false);
    }
  };

  const handleViewportClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (didDragRef.current) {
      event.preventDefault();
      event.stopPropagation();
      didDragRef.current = false;
    }
  };

  const activeDonors = DONORS.filter((d) => d.isActive);
  const totalRaised = activeDonors.reduce((sum, d) => sum + d.amount, 0);
  const inactiveDonors = DONORS.filter((d) => !d.isActive);

  const themeClasses = {
    background: theme === "dark" ? "bg-neutral-950" : "bg-neutral-50",
    text: theme === "dark" ? "text-neutral-100" : "text-neutral-900",
    textSecondary: theme === "dark" ? "text-neutral-400" : "text-neutral-600",
    border: theme === "dark" ? "border-neutral-800" : "border-neutral-200",
    cardBg: theme === "dark" ? "bg-neutral-900" : "bg-white",
    cardBorder: theme === "dark" ? "border-neutral-800" : "border-neutral-200",
    gridLines: theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
    canvasBg: theme === "dark" ? "bg-neutral-950" : "bg-neutral-100",
  };

  return (
    <main
      className={`min-h-screen ${themeClasses.background} ${themeClasses.text} px-4 py-6 sm:py-12 sm:px-8 transition-colors duration-300`}
    >
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

        {/* Canvas toolbar */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          <button
            onClick={zoomOut}
            title="Zoom out"
            className={`h-9 w-9 rounded-lg border ${themeClasses.border} ${themeClasses.cardBg} text-lg font-medium transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800`}
          >
            −
          </button>

          <div className="min-w-[52px] text-center text-sm tabular-nums text-neutral-500">
            {Math.round(zoom * 100)}%
          </div>

          <button
            onClick={zoomIn}
            title="Zoom in"
            className={`h-9 w-9 rounded-lg border ${themeClasses.border} ${themeClasses.cardBg} text-lg font-medium transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800`}
          >
            +
          </button>

          <button
            onClick={fitAllView}
            title="Fit to screen"
            className={`h-9 px-3 rounded-lg border ${themeClasses.border} ${themeClasses.cardBg} text-sm font-medium transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800`}
          >
            Fit to wall
          </button>
        </div>

        {/* Pixel wall canvas */}
        <div
          ref={viewportRef}
          className={`relative mb-6 h-[55vh] min-h-[400px] w-full overflow-hidden rounded-xl border ${themeClasses.cardBorder} ${themeClasses.canvasBg} p-4 transition-colors duration-300 ${
            dragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{
            touchAction: "none",
            userSelect: dragging ? "none" : "auto",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClickCapture={handleViewportClickCapture}
        >
          <div
            className="absolute"
            style={{
              left: "50%",
              top: "50%",
              width: CONTENT_WIDTH,
              height: contentHeight,
              boxSizing: "border-box",
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
              transformOrigin: "center center",
              transition: dragging ? "none" : "transform 0.08s ease-out",
              backgroundImage: `linear-gradient(to right, ${themeClasses.gridLines} 1px, transparent 1px), linear-gradient(to bottom, ${themeClasses.gridLines} 1px, transparent 1px)`,
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
                    draggable={false}
                    sizes={`${donor.cols * PIXEL_SIZE}px`}
                    className="object-cover"
                  />

                  {hovered === donor.id && (
                    <div
                      className={`absolute inset-0 flex flex-col items-center justify-center ${
                        theme === "dark" ? "bg-black/75" : "bg-white/75"
                      } text-center px-1`}
                    >
                      <span className="text-[10px] sm:text-xs font-medium leading-tight">
                        {donor.name}
                      </span>
                    </div>
                  )}
                </div>
              );

              if (donor.link) {
                return (
                  <a
                    key={donor.id}
                    href={donor.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="contents"
                  >
                    {donorBlock}
                  </a>
                );
              }

              return <div key={donor.id}>{donorBlock}</div>;
            })}
          </div>
        </div>

        {/* Stats after the wall */}
        <div
          className={`flex flex-wrap justify-center gap-6 sm:gap-8 text-sm mb-8 ${themeClasses.textSecondary}`}
        >
          <span>
            <strong className={themeClasses.text}>{activeDonors.length}</strong> supporters
          </span>
          <span>
            <strong className={themeClasses.text}>${totalRaised.toLocaleString()}</strong> raised
          </span>
        </div>

        {/* Support section */}
        <section
          className={`rounded-xl border ${themeClasses.cardBorder} ${themeClasses.cardBg} p-6 sm:p-8 transition-colors duration-300 space-y-4`}
        >
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