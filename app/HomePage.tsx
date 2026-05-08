"use client";

import Link from "next/link";
import { useAppSelector } from "@/redux/hooks";
import Image from "next/image";
import { useEffect, useRef } from "react";

export default function HomePage() {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const maskRectRef = useRef<SVGRectElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const maskRect = maskRectRef.current;
    const path = pathRef.current;
    if (!maskRect || !path) return;

    const dur = 9000;
    const hold = 2000;
    let phase: "sweep" | "hold" = "sweep";
    let t0: number | null = null;

    const ease = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    function tick(ts: number) {
      if (!t0) t0 = ts;
      const e = ts - t0;

      if (phase === "sweep") {
        const raw = Math.min(e / dur, 1);
        const t = ease(raw);
        maskRect!.setAttribute("x", String(t * 800 - 800));
        if (raw >= 1) { phase = "hold"; t0 = ts; }
      } else {
        if (e >= hold) {
          phase = "sweep";
          t0 = ts;
          maskRect!.setAttribute("x", "-800");
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const guestLinks = () => (
    <div className="mf-cta-group">
      <Link href="/auth/login" className="mf-btn-primary">
        Log into your account
      </Link>
      <Link href="/auth/register" className="mf-btn-secondary">
        Create an account <span aria-hidden="true">→</span>
      </Link>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Inter:wght@300;400;500&display=swap');

        .mf-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          min-height: calc(100vh - 64px);
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          font-family: 'Inter', sans-serif;
        }

        .mf-bg { position: absolute; inset: 0; pointer-events: none; z-index: 0; }

        .mf-bg-dots {
          position: absolute; inset: 0;
          background-image: radial-gradient(circle, #c7d2fe 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.25;
        }
        .mf-bg-wash {
          position: absolute; bottom: -200px; right: -200px;
          width: 500px; height: 500px;
          background: radial-gradient(circle, #e0e7ff 0%, transparent 65%);
          border-radius: 50%;
        }
        .mf-bg-wash-2 {
          position: absolute; top: -160px; left: -160px;
          width: 400px; height: 400px;
          background: radial-gradient(circle, #ede9fe 0%, transparent 65%);
          border-radius: 50%;
        }

        .mf-city-svg {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          pointer-events: none;
          z-index: 1;
        }

        .mf-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 3rem 1.5rem 100px;
          max-width: 600px;
          width: 100%;
        }

        .mf-logo-wrap {
          margin-bottom: 1.75rem;
          animation: mfFadeUp 0.8s ease both;
        }

        .mf-wordmark {
          font-family: 'Playfair Display', serif;
          font-size: clamp(3rem, 8vw, 5.5rem);
          font-weight: 400;
          letter-spacing: -0.02em;
          line-height: 1;
          color: #111827;
          margin-bottom: 1rem;
          animation: mfFadeUp 0.8s ease 0.15s both;
        }
        .mf-wordmark em {
          font-style: italic;
          color: #3949ab;
        }

        .mf-tagline {
          font-family: 'Inter', sans-serif;
          font-size: 0.85rem;
          font-weight: 300;
          color: #9ca3af;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          animation: mfFadeUp 0.8s ease 0.25s both;
        }

        .mf-rule {
          width: 32px;
          height: 1px;
          background: #3949ab;
          margin: 1.75rem auto;
          animation: mfFadeUp 0.8s ease 0.35s both;
        }

        .mf-cta-group {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          flex-wrap: wrap;
          justify-content: center;
          animation: mfFadeUp 0.8s ease 0.45s both;
        }

        .mf-btn-primary {
          display: inline-flex;
          align-items: center;
          background: #3949ab;
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-size: 0.78rem;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 11px 28px;
          border-radius: 6px;
          text-decoration: none;
          transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 2px 12px rgba(57,73,171,0.18);
        }
        .mf-btn-primary:hover {
          background: #303f9f;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(57,73,171,0.26);
        }

        .mf-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #9ca3af;
          font-family: 'Inter', sans-serif;
          font-size: 0.78rem;
          font-weight: 400;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          text-decoration: none;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 2px;
          transition: color 0.2s, border-color 0.2s;
        }
        .mf-btn-secondary:hover {
          color: #3949ab;
          border-color: #3949ab;
        }

        @keyframes mfFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <section className="mf-hero">
        <div className="mf-bg">
          <div className="mf-bg-dots" />
          <div className="mf-bg-wash-2" />
          <div className="mf-bg-wash" />
        </div>

        <svg
          className="mf-city-svg"
          viewBox="0 0 800 120"
          preserveAspectRatio="xMidYMax meet"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="ecgFade" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#3949ab" stopOpacity={0} />
              <stop offset="35%"  stopColor="#3949ab" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#3949ab" stopOpacity={1} />
            </linearGradient>
            <mask id="sweepMask">
              <rect
                ref={maskRectRef}
                x="-800" y="0" width="800" height="120"
                fill="white"
              />
            </mask>
          </defs>

          {/* Left: wide building with gabled roof — Right: tall building with spire */}
          <path
            ref={pathRef}
            fill="none"
            stroke="url(#ecgFade)"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            mask="url(#sweepMask)"
            d="M0,115
               L80,115 L80,90 L160,90
               L160,75 L200,75 L200,50 L240,50 L240,75 L280,75
               L280,90 L340,90 L340,115
               L420,115 L420,60 L460,60 L460,30 L480,30 L480,10 L500,10 L500,30 L520,30 L520,60 L560,60
               L560,115 L800,115"
          />
        </svg>

        <div className="mf-content">
          <div className="mf-logo-wrap">
            <Image
              src="/logo.svg"
              alt="Modelflick"
              width={80}
              height={80}
              priority
              style={{
                borderRadius: "16px",
                boxShadow: "0 4px 20px rgba(57,73,171,0.15)",
              }}
            />
          </div>
          <h1 className="mf-wordmark">
            Model<em>flick</em>
          </h1>
          <p className="mf-tagline">Making Architecture and Planning easier</p>
          <div className="mf-rule" />
          {!isAuthenticated && guestLinks()}
        </div>
      </section>
    </>
  );
}