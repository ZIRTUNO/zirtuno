"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * The mounted curtain (`components/motion/PageVeil.tsx`).
 *
 * `cover` takes the promise that settles when the destination route can be
 * committed, and resolves once the page is hidden AND that promise has
 * settled — so the route warms inside the same 0.72s the wave spends crossing
 * the screen rather than after it. `reveal` drains the curtain off a page that
 * has already been swapped. `wash` is the crest alone, for an arrival nobody
 * covered for.
 */
export type VeilRunner = {
  cover: (ready: Promise<void>) => Promise<void>;
  reveal: () => Promise<void>;
  wash: () => Promise<void>;
  /** True while a full opaque cover is standing — i.e. a swap is unseeable. */
  covered: () => boolean;
};

/** How long the departing page will wait for a route before leaving anyway.
 *  A ceiling, not a budget: past this the visitor is better served by movement
 *  than by a page that appears to have ignored the click. */
const ROUTE_WAIT_CAP = 2500;

/**
 * How long a covered screen will wait for the arriving template to announce
 * itself before draining anyway.
 *
 * `template.tsx` remounting is what normally calls `enter()`, and it is
 * reliable — but it is also the ONLY caller, and the failure it guards against
 * is total: a push that never commits (a middleware redirect back to the same
 * URL, a route that throws before its template mounts) leaves an opaque black
 * curtain over a working site with nothing scheduled to lift it. A stuck
 * transition has to degrade into a slow one, never into a dead screen.
 */
const REVEAL_WATCHDOG = 1600;

type TransitionValue = {
  /** The curtain registers itself; the disposer only clears the slot if it
   *  still owns it. */
  registerVeil: (runner: VeilRunner) => () => void;
  /** Called by `template.tsx` on every mount that is a route change. */
  enter: () => void;
  /** Leave the current page, then route. Use for programmatic navigation. */
  navigate: (href: string) => void;
};

const TransitionContext = createContext<TransitionValue>({
  registerVeil: () => () => {},
  enter: () => {},
  navigate: () => {},
});

/**
 * Start resolving the destination and report when it is ready.
 *
 * `router.prefetch` returns void, so it cannot be awaited. The probe alongside
 * it requests the same RSC payload the router will use, which gives us a real
 * readiness signal — and in development it forces the route to COMPILE, which
 * is the thing that was actually taking two seconds. Every failure mode
 * resolves rather than rejects: this only decides when the page may leave, so
 * a bad guess costs a slightly early exit, never a stuck one.
 */
function warmRoute(
  router: { prefetch: (href: string) => void },
  href: string,
): Promise<void> {
  try {
    router.prefetch(href);
  } catch {
    /* optimisation only */
  }
  const probe = fetch(href, {
    headers: { RSC: "1" },
    credentials: "same-origin",
    // Never let the probe land in the HTTP cache: the router fetches this same
    // URL for real, and a stored response of ours could be served back to it.
    // This request exists to MEASURE readiness, not to supply the payload.
    cache: "no-store",
  })
    .then((r) => r.text())
    .then(() => undefined)
    .catch(() => undefined);
  const cap = new Promise<void>((r) => setTimeout(r, ROUTE_WAIT_CAP));
  return Promise.race([probe, cap]);
}

/**
 * The href of a link that should get a page transition, or null.
 *
 * Null covers everything that is not a route change: external origins,
 * downloads, new tabs, an explicit `data-no-transition` opt-out, and — the
 * important one — any link resolving to the pathname we are already on. That
 * last test is what keeps AGENTS.md §4.11 intact: the skip link, the mobile
 * menu's chapter anchors and the homepage CTA's `/?intent=…#contact` are
 * same-document scrolls that own their own Lenis behavior.
 */
function internalPath(anchor: HTMLAnchorElement): string | null {
  if (anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.dataset.noTransition !== undefined) return null;

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function usePageTransition() {
  return useContext(TransitionContext);
}

/**
 * Page transitions — THE VEIL (`components/motion/PageVeil.tsx`), ported from
 * GSAP's Dynamic Morphing demo. `lib/motion/veil.mjs` holds the geometry and
 * the reasoning; this file is the routing half.
 *
 * The App Router has no `SwitchTransition`: a `router.push()` unmounts the old
 * tree immediately, so the two halves of an out-in transition are split across
 * two places.
 *
 *   leave  — this provider intercepts internal link clicks in the CAPTURE
 *            phase, ahead of `<Link>`'s own handler, plays the curtain's
 *            `cover`, and pushes only once the screen is hidden.
 *   arrive — `template.tsx` remounts per navigation and calls `enter()`, which
 *            drains the curtain back off.
 *
 * Capture phase is required rather than preferred: Next's `<Link>` calls
 * `preventDefault()` and starts routing in its own handler, so by the bubble
 * phase the navigation is already underway and there is nothing left to
 * animate out.
 *
 * ONE DEPARTURE AT A TIME, and it stays claimed from the click all the way to
 * the arrival — not merely until the push. Re-arming a curtain that is already
 * standing would rewind it to a zero-area path, which is a frame of the old
 * page showing through the middle of its own transition.
 */
export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const veilRef = useRef<VeilRunner | null>(null);
  const leavingRef = useRef(false);
  const watchdogRef = useRef<number | null>(null);

  // React mounts the incoming template BEFORE it unmounts the outgoing one, so
  // a naive `registerVeil(null)` cleanup would erase a live runner. The
  // disposer therefore only clears the slot it still owns.
  const registerVeil = useCallback((runner: VeilRunner) => {
    veilRef.current = runner;
    return () => {
      if (veilRef.current === runner) veilRef.current = null;
    };
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const enter = useCallback(() => {
    clearWatchdog();
    const veil = veilRef.current;
    const departed = leavingRef.current;
    leavingRef.current = false;
    if (reduced || !veil) return;
    // COVERED means we put the curtain there and the swap happened behind it,
    // so the only thing left to do is drain. Anything else is an arrival on a
    // page the visitor can already see — a back/forward, or a push from
    // outside this provider — and gets the crest, which hides nothing. The
    // `departed` test is the third case: our own cover ran but the kernel is
    // no longer standing (an interrupted or reduced run), where a wash would
    // be a second transition for one navigation.
    if (veil.covered()) void veil.reveal().catch(() => {});
    else if (!departed) void veil.wash().catch(() => {});
  }, [clearWatchdog, reduced]);

  const navigate = useCallback(
    (href: string) => {
      if (leavingRef.current) return; // one departure at a time
      const veil = veilRef.current;
      if (reduced || !veil) {
        router.push(href);
        return;
      }
      leavingRef.current = true;
      void veil
        .cover(warmRoute(router, href))
        .catch(() => {})
        .then(() => {
          router.push(href);
          clearWatchdog();
          watchdogRef.current = window.setTimeout(() => {
            watchdogRef.current = null;
            leavingRef.current = false;
            const stuck = veilRef.current;
            if (stuck?.covered()) void stuck.reveal().catch(() => {});
          }, REVEAL_WATCHDOG);
        });
    },
    [clearWatchdog, reduced, router],
  );

  // Warm the route on INTENT, not on the click. The cover is only 0.72s long
  // and the visitor is looking at an opaque curtain for the whole of any wait
  // behind it, so a route that resolves slower than that is dead time on a
  // black screen. `<Link>` prefetches on its own in production, but Next
  // disables that in development, so there the click was when compilation
  // STARTED. Prefetching on hover/focus moves that work ahead of the pointer in
  // both modes; by the time the cover finishes, the payload is usually already
  // in the router cache and the push commits immediately.
  useEffect(() => {
    if (reduced) return;
    const warmed = new Set<string>();

    const warm = (node: EventTarget | null) => {
      const anchor = (node as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const path = internalPath(anchor);
      if (!path || warmed.has(path)) return;
      warmed.add(path);
      try {
        router.prefetch(path);
      } catch {
        /* prefetch is an optimisation; never let it break navigation */
      }
    };

    const onEnter = (e: Event) => warm(e.target);
    document.addEventListener("pointerenter", onEnter, true);
    document.addEventListener("focusin", onEnter, true);
    return () => {
      document.removeEventListener("pointerenter", onEnter, true);
      document.removeEventListener("focusin", onEnter, true);
    };
  }, [reduced, router]);

  useEffect(() => {
    // Under reduced motion there is nothing to play, so leave `<Link>` alone
    // and let it route exactly as it always has.
    if (reduced) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;

      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const path = internalPath(anchor);
      if (!path) return;

      event.preventDefault();
      navigate(path);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [navigate, reduced]);

  useEffect(() => clearWatchdog, [clearWatchdog]);

  const value = useMemo(
    () => ({ registerVeil, enter, navigate }),
    [registerVeil, enter, navigate],
  );

  return (
    <TransitionContext.Provider value={value}>
      {children}
    </TransitionContext.Provider>
  );
}

export default TransitionContext;
