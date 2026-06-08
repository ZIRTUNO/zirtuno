import createMiddleware from "next-intl/middleware";
import { routing } from "./lib/i18n/config";

export const proxy = createMiddleware(routing);

export const config = {
  // Match all paths except API, Next internals, and static files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
