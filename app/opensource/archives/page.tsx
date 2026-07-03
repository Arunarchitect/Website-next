// app/opensource/archives/page.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

interface ArchivedDonor {
  id: string;
  name: string;
  logoUrl: string;
  link?: string;
  amount: number;
  subscriptionEnded: string; // Date when subscription ended
}

// Mock archived donors - in reality, this would come from your API
const ARCHIVED_DONORS: ArchivedDonor[] = [
  {
    id: "3",
    name: "OpenStack Foundry",
    logoUrl: "https://dummyimage.com/120x120/ea580c/ffffff&text=OSF",
    link: "https://openstackfoundry.example.com",
    amount: 800,
    subscriptionEnded: "2024-12-15",
  },
  {
    id: "5",
    name: "Nimbus Cloud",
    logoUrl: "https://dummyimage.com/100x100/0891b2/ffffff&text=Nimbus",
    link: "https://nimbus.example.com",
    amount: 400,
    subscriptionEnded: "2024-11-30",
  },
];

export default function ArchivesPage() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

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

  const themeClasses = {
    background: theme === "dark" ? "bg-neutral-950" : "bg-neutral-50",
    text: theme === "dark" ? "text-neutral-100" : "text-neutral-900",
    textSecondary: theme === "dark" ? "text-neutral-400" : "text-neutral-600",
    border: theme === "dark" ? "border-neutral-800" : "border-neutral-200",
    cardBg: theme === "dark" ? "bg-neutral-900" : "bg-white",
    cardBorder: theme === "dark" ? "border-neutral-800" : "border-neutral-200",
  };

  return (
    <main className={`min-h-screen ${themeClasses.background} ${themeClasses.text} px-4 py-6 sm:py-12 sm:px-8 transition-colors duration-300`}>
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/opensource" className="text-indigo-500 hover:text-indigo-400 transition-colors">
            ← Back to Wall
          </Link>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg ${themeClasses.cardBg} ${themeClasses.border} border transition-colors duration-200 text-2xl`}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>

        <h1 className="text-3xl font-bold mb-4">Archived Supporters</h1>
        <p className={`${themeClasses.textSecondary} mb-8`}>
          These supporters have previously contributed to open source development through Modelflick.
          Their subscriptions have ended, but we appreciate their past support.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ARCHIVED_DONORS.map((donor) => (
            <div
              key={donor.id}
              className={`rounded-xl border ${themeClasses.cardBorder} ${themeClasses.cardBg} p-6 transition-colors duration-300`}
            >
              <div className="relative w-24 h-24 mx-auto mb-4">
                <Image
                  src={donor.logoUrl}
                  alt={donor.name}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
              <h3 className="text-lg font-semibold text-center">{donor.name}</h3>
              {donor.link && (
                <a
                  href={donor.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-500 hover:text-indigo-400 text-sm block text-center mt-1"
                >
                  Visit website →
                </a>
              )}
              <div className="mt-4 pt-4 border-t border-neutral-700/30">
                <p className={`${themeClasses.textSecondary} text-sm text-center`}>
                  Contributed ${donor.amount.toLocaleString()}
                </p>
                <p className={`${themeClasses.textSecondary} text-xs text-center mt-1`}>
                  Subscription ended: {new Date(donor.subscriptionEnded).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {ARCHIVED_DONORS.length === 0 && (
          <div className={`text-center py-12 ${themeClasses.textSecondary}`}>
            <p>No archived supporters yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}