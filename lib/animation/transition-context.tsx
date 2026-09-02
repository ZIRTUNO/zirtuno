"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/** Plays a page's exit timeline; resolves when the page has left.
 *  `ready` settles when the destination route can be committed — the exit
 *  holds its last VISIBLE beat until then, so a slow route never resolves
 *  into an empty viewport. */
export type ExitRunner = (ready: Promise<void>) => Promise<void>;

/** How long the departing page will wait for a route before leaving anyway.
 *  A ceiling, not a budget: past this the visitor is better served by movement
 *  than by a page that appears to have ignored the click. */
const ROUTE_WAIT_CAP = 2500;

type TransitionValue = {
  /** True once the incoming page's enter timeline has finished. Mirrors the
   *  reference's flag: work that must not run against a moving, transformed
   *  ancestor can wait on it. */
  completed: boolean;
  toggleCompleted: (value: boolean) => void;
  /** The mounted page registers its exit timeline; the returned disposer only
   *  clears the slot if it still owns it (see the ordering note below). */
  registerExit: (run: ExitRunner) => () => void;
  /** Leave the current page, then route. Use for programmatic navigation. */
  navigate: (href: string) => void;
};

const TransitionContext = createContext<TransitionValue>({
  completed: false,
  toggleCompleted: () => {},
  registerExit: () => () => {},
  navigate: () => {},
});

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
 * Page transitions, ported from the GSAP + React Router reference
 * (stackblitz react-6rzfpp) to the App Router.
 *
 * The reference drives everything from `SwitchTransition` in its default
 * `out-in` mode: the outgoing route animates away, and only then does the
 * incoming one animate in. The App Router has no such component — a
 * `router.push()` unmounts the old tree immediately — so the two halves are
 * split across two places:
 *
 *   enter — `template.tsx` remounts per navigation, so `PageTransition`
 *           playing on mount IS the reference's `onEnter`.
 *   exit  — this provider intercepts internal link clicks in the CAPTURE
 *           phase, ahead of `<Link>`'s own handler, plays the mounted page's
 *           `onExit`, and pushes only once it has finished.
 *
 * Capture phase is required rather than preferred: Next's `<Link>` calls
 * `preventDefault()` and starts routing in its own handler, so by the bubble
 * phase the navigation is already underway and there is nothing left to
 * animate out.
 */
export function TransitionProvider({ children }: { children: ReactNode }) {
  const [completed, setCompleted] = useState(false);
  const router = useRouter();
  const reduced = useReducedMotion();
  const exitRef = useRef<ExitRunner | null>(null);
  const leavingRef = useRef(false);

  const toggleCompleted = useCallback((value: boolean) => {
    setCompleted(value);
  }, []);

  // React mounts the incoming template BEFORE it unmounts the outgoing one, so
  // a naive `registerExit(null)` cleanup would erase the arriving page's
  // runner. The disposer therefore only clears the slot it still owns.
  const registerExit = useCallback((run: ExitRunner) => {
    exitRef.current = run;
    return () => {
      if (exitRef.current === run) exitRef.current = null;
    };
  }, []);

  const navigate = useCallback(
    (href: string) => {
      if (leavingRef.current) return; // one departure at a time
      const exit = exitRef.current;
      if (reduced || !exit) {
        router.push(href);
        return;
      }
      leavingRef.current = true;
      void exit(warmRoute(router, href))
        .catch(() => {})
        .then(() => {
          router.push(href);
          leavingRef.current = false;
        });
    },
    [reduced, router],
  );

  // Warm the route on INTENT, not on the click. The exit timeline is only
  // 0.4s long and nothing is painted behind the departing page, so any route
  // that resolves slower than that leaves the viewport empty — which is what a
  // cold legal page looked like. `<Link>` prefetches on its own in production,
  // but Next disables that in development, so there the click was when
  // compilation STARTED. Prefetching on hover/focus moves that work ahead of
  // the pointer in both modes; by the time the exit finishes, the payload is
  // usually already in the router cache and the push commits immediately.
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

  const value = useMemo(
    () => ({ completed, toggleCompleted, registerExit, navigate }),
    [completed, toggleCompleted, registerExit, navigate],
  );

  return (
    <TransitionContext.Provider value={value}>
      {children}
    </TransitionContext.Provider>
  );
}

export default TransitionContext;
