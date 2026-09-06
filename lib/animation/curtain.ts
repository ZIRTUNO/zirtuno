"use client";

/**
 * "Is anything painted over the page right now?" — and a way to be told when
 * nothing is.
 *
 * WHY THIS EXISTS. Two curtains can be standing over a route: the entry veil
 * (`components/chrome/EntryVeil.tsx`, ~3.42s on every document load) and the
 * page veil (`components/motion/PageVeil.tsx`, on every internal navigation).
 * Anything that plays a one-shot entrance has to wait for them, and the reason
 * it is easy to get wrong is EFFECT ORDER: React runs a page's effects before
 * its layout's, so a reveal mounted in the page builds and fires while the
 * layout's veil is still opaque. The visitor then gets a curtain that lifts on
 * a page which has already finished arriving — the animation ran, nobody saw
 * it. That is not a timing nicety, it is the whole gesture.
 *
 * WHY IT POLLS. A rAF loop rather than a MutationObserver, on purpose. The two
 * curtains signal differently — the entry veil UNMOUNTS its element, the page
 * veil rewrites `data-veil` on an element that stays put — and a third one
 * added later would signal a third way. Reading the answer once a frame costs
 * two `querySelector` calls for at most a few seconds and cannot miss an edge,
 * where an observer has to be configured for each signal and silently misses
 * anything it was not told to watch.
 *
 * IT ALWAYS FIRES. `cap` is a hard backstop, not a timeout to tune: a curtain
 * that never lifts is a bug, and the correct behaviour under that bug is a
 * page whose content is visible, never one holding an entrance forever. The
 * entry veil has its own hard cap at ~4.62s (`SCORE.end + 1.2`), so the
 * default here sits past it with room to spare.
 */

/** Curtain states that actually hide the page. `wash` is the crest alone — it
 *  covers nothing and the page under it is live, so it is not a wait. */
const HIDING = new Set(["cover", "reveal"]);

export function pageIsCovered(): boolean {
  if (typeof document === "undefined") return false;
  // The entry veil signals by existing. It renders on the first client commit
  // and removes itself on release (or immediately, in a capture context).
  if (document.querySelector(".entry-veil")) return true;
  const veil = document.querySelector<SVGElement>(".page-veil");
  return !!veil && HIDING.has(veil.dataset.veil ?? "idle");
}

/**
 * Run `fn` once, as soon as no curtain is covering the page.
 *
 * Returns a disposer. If nothing is covering already, `fn` still runs on the
 * next frame rather than synchronously — the caller is invariably about to
 * measure layout, and a frame of settling is worth more than the immediacy.
 */
export function whenUncovered(fn: () => void, cap = 6000): () => void {
  let done = false;
  let raf = 0;
  let timer = 0;

  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
    fn();
  };

  const tick = () => {
    if (done) return;
    if (!pageIsCovered()) return finish();
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  timer = window.setTimeout(finish, cap);

  return () => {
    done = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
  };
}
