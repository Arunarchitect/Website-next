'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ClientLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const router = useRouter();

  const closeMenuAndNavigate = (href: string) => {
    setIsMenuOpen(false);
    router.push(href);
  };

  useEffect(() => {
    setIsPageLoaded(true);
  }, []);

  return (
    <>
      {/* Navbar */}
      <nav className="bg-black text-white p-4 fixed w-full top-0 left-0 z-50 shadow-none">
        <div className="container mx-auto flex items-center justify-between">
          <div className="text-xl font-bold">
            <Link href="/">Modelflick</Link>
          </div>

          {/* Hamburger Menu */}
          <div className="lg:hidden flex items-center" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <button className="text-white focus:outline-none">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>

          {/* Desktop Menu */}
          <div className="hidden lg:flex space-x-6">
            <Link href="/" className="hover:text-gray-400">Home</Link>
            <Link href="/about" className="hover:text-gray-400">About</Link>
            <Link href="/services" className="hover:text-gray-400">Services</Link>
            <Link href="/projects" className="hover:text-gray-400">Projects</Link>
            <Link href="/expenses" className="hover:text-gray-400">Expenses</Link>
            <Link href="/contact" className="hover:text-gray-400">Contact</Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-16">{children}</main>

      {/* Mobile Menu */}
      {isMenuOpen && isPageLoaded && (
        <div className="lg:hidden fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 flex justify-center items-center z-50 transition-opacity duration-300">
          <div className="text-center space-y-4">
            <button className="block text-white text-2xl uppercase" onClick={() => closeMenuAndNavigate("/")}>Home</button>
            <button className="block text-white text-2xl uppercase" onClick={() => closeMenuAndNavigate("/about")}>About</button>
            <button className="block text-white text-2xl uppercase" onClick={() => closeMenuAndNavigate("/services")}>Services</button>
            <button className="block text-white text-2xl uppercase" onClick={() => closeMenuAndNavigate("/projects")}>Projects</button>
            <button className="block text-white text-2xl uppercase" onClick={() => closeMenuAndNavigate("/expenses")}>Expenses</button>
            <button className="block text-white text-2xl uppercase" onClick={() => closeMenuAndNavigate("/contact")}>Contact</button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-black text-white p-4 mt-0 text-center">
        © 2025 Modelflick
      </footer>
    </>
  );
};

export default ClientLayout;
