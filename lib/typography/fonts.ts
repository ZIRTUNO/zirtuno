import { Bricolage_Grotesque, Nunito } from "next/font/google";

// One font source for localized pages and the root fallback. next/font
// self-hosts these assets at build time; no runtime third-party request occurs.
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

// THE ROUNDED FACE — the web half of a two-part stack.
//
// The brief is SF Pro Rounded, which cannot be shipped: it is not on Google
// Fonts, and Apple's font license covers designing and testing interfaces for
// Apple-platform software, not embedding the file on a public site. So the
// stack in `--font-rounded` asks the OS first via the `ui-rounded` CSS generic
// (CSS Fonts 4), which resolves to the genuine SF Rounded on macOS and iOS
// with the font never leaving the user's machine, and falls through to this
// self-hosted face everywhere else.
//
// Nunito is the fallback because it is the closest widely-licensed match to SF
// Rounded's humanist proportions and softened terminals, and because its
// variable axis spans the four weights the brief names: 300 Light, 400
// Regular, 500 Medium, 700 Bold.
//
// NO `weight` ARRAY, DELIBERATELY. Passing one makes next/font fetch static
// instances, and the stylesheets ask for `font-weight: 550` in six places --
// a value that only exists on a continuous axis. Static instances would snap
// those to 500 and quietly flatten the step between a card title and the body
// under it. Omitting `weight` loads the variable file (wght 200-1000), which
// is also how `bricolage` above is loaded, so both faces behave the same way.
export const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});
