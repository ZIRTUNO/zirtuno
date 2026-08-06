import type { ReactNode } from "react";
import type { Metadata } from "next";
import "@/app/lab.css";

/**
 * LAB — an isolated test space for the cinematic hero direction.
 *
 * Its stylesheet loads only on this route and every selector is namespaced
 * `.lab-*`, so the exploration cannot touch the live site. Never indexed: this
 * is a working surface, not a page.
 */
export const metadata: Metadata = {
  title: "Lab · Cinematic hero",
  robots: { index: false, follow: false },
};

export default function LabLayout({ children }: { children: ReactNode }) {
  return children;
}
