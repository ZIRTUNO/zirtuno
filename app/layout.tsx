import type { ReactNode } from "react";

// Passthrough root layout. The real document (<html>/<body>) lives in
// app/[locale]/layout.tsx so we can set <html lang> per locale
// (next-intl App Router pattern).
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
