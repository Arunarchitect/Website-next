'use client'; // Marking this file as a client component

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Use the Next.js Router
import Link from 'next/link';
import './globals.css'; // Optionally import global CSS if you have any

// This layout will wrap the entire application
const Layout: React.FC = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State for hamburger menu
  const [isPageLoaded, setIsPageLoaded] = useState(false); // State to track page load
  const router = useRouter(); // Next.js Router

  // Close the mobile menu and navigate
  const closeMenuAndNavigate = (href: string) => {
    setIsMenuOpen(false); // Close the mobile menu
    router.push(href); // Navigate to the page
  };

  // Wait for the page to load before closing the mobile menu
  useEffect(() => {
    // This effect will trigger once the page is loaded
    setIsPageLoaded(true);
  }, []);

  return (
    <html lang="en">
      <head />
      <body className="bg-black text-white font-sans">
        {/* Navbar */}
        <nav className="bg-black text-white p-4 fixed w-full top-0 left-0 z-50 shadow-none">
          <div className="container mx-auto flex items-center justify-between">
            {/* Modelflick Logo */}
            <div className="text-xl font-bold">
              <Link href="/">Modelflick</Link>
            </div>

            {/* Hamburger Icon for Mobile */}
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
              <Link href="/contact" className="hover:text-gray-400">Contact</Link>
            </div>
          </div>
        </nav>

        {/* Main content of the page (children) */}
        <main>{children}</main> {/* Removed pt-16 */}

        {/* Mobile Menu (Hamburger) */}
        {isMenuOpen && isPageLoaded && (
          <div className="lg:hidden fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 flex justify-center items-center z-50 transition-opacity duration-300">
            <div className="text-center">
              <button
                className="block py-2 text-white text-2xl uppercase"
                onClick={() => closeMenuAndNavigate("/")}
              >
                Home
              </button>
              <button
                className="block py-2 text-white text-2xl uppercase"
                onClick={() => closeMenuAndNavigate("/about")}
              >
                About
              </button>
              <button
                className="block py-2 text-white text-2xl uppercase"
                onClick={() => closeMenuAndNavigate("/services")}
              >
                Services
              </button>
              <button
                className="block py-2 text-white text-2xl uppercase"
                onClick={() => closeMenuAndNavigate("/contact")}
              >
                Contact
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="bg-black text-white p-4 mt-0">
          <div className="text-center">© 2025 Modelflick</div>
        </footer>
      </body>
    </html>
  );
};

export default Layout;
