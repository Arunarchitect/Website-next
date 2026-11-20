// app/gallery/layout.tsx
import type { ReactNode } from "react";
import { GalleryProvider } from "./GalleryContext";
import { Footer, Masthead } from "./components";
import "./style.css";

export const metadata = {
  title: "The Online Gallery",
  description: "An online exhibition and sale of contemporary art.",
};

export default function GalleryLayout({ children }: { children: ReactNode }) {
  return (
    <GalleryProvider>
      <div className="g-root">
        <Masthead />
        <main className="g-main">{children}</main>
        <Footer />
      </div>
    </GalleryProvider>
  );
}