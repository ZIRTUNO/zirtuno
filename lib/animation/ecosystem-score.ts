import { gsap } from "gsap";
import { getLenis } from "./lenis-store";
import { ECO_BEATS, ecosystemBeat } from "@/lib/webgl/ecosystem-flow.mjs";

/** A paused GSAP score sampled by the page's existing geometry loop.
 * Native disclosure, RSC copy, and normal document flow are the fallback. */
export function makeEcosystemScore(root: HTMLElement | null, enabled: boolean, hover: (slot: number) => void) {
  const stage = root?.querySelector<HTMLElement>(".eco-stage");
  const panels = Array.from(root?.querySelectorAll<HTMLElement>(".eco-panel") ?? []);
  const tabs = Array.from(root?.querySelectorAll<HTMLButtonElement>("[data-eco-step]") ?? []);
  const compact = window.matchMedia("(max-height: 639px)");
  const timeline = gsap.timeline({ paused: true });
  const phases = panels.map(() => ({ reveal: 0, leave: 0 }));
  phases.forEach((state, i) => {
    timeline.to(state, { reveal: 1, duration: i === 0 ? 0.01 : 0.065, ease: "none" }, i === 0 ? 0 : [0, 0.265, 0.525, 0.795][i]);
    if (i < 3) timeline.to(state, { leave: 1, duration: 0.065, ease: "none" }, [0.265, 0.525, 0.795][i]);
  });
  timeline.to({}, { duration: 0.13 }, 0.87);
  let last = -1;
  let active = -1;
  let enhanced = false;
  const sync = () => {
    enhanced = enabled && !compact.matches && !!stage;
    if (enhanced) root?.setAttribute("data-eco-live", "true");
    else root?.removeAttribute("data-eco-live");
    last = -1;
    if (!enhanced) panels.forEach(p => { p.inert = false; p.removeAttribute("aria-hidden"); });
  };
  const goTo = (i: number, immediate = false) => {
    if (!root || !enhanced) return;
    const y = root.getBoundingClientRect().top + window.scrollY + ECO_BEATS[i] * (root.offsetHeight - (stage?.offsetHeight ?? window.innerHeight));
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(y, { duration: 1.05, immediate });
    else window.scrollTo({ top: y, behavior: immediate ? "instant" : "smooth" });
  };
  const click = (event: Event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-eco-step]");
    if (button) goTo(Number(button.dataset.ecoStep));
  };
  const point = (event: Event) => {
    const el = (event.target as Element).closest<HTMLElement>("[data-eco-node]");
    hover(el ? Number(el.dataset.ecoNode) : -1);
  };
  const leave = () => hover(-1);
  const focus = (event: Event) => {
    point(event);
    const el = event.target as HTMLElement;
    const panel = el.closest<HTMLElement>(".eco-panel");
    const rect = el.getBoundingClientRect();
    // Browsers do not reliably scroll a masked, sticky descendant into view.
    // Keyboard arrival must land on the same score as deliberate navigation.
    if (panel && (rect.top < 0 || rect.bottom > window.innerHeight)) {
      goTo(panels.indexOf(panel), true);
    }
  };
  const disclosure = (event: Event) => {
    const opened = event.target as HTMLDetailsElement;
    if (opened.open) root?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(el => { if (el !== opened) el.open = false; });
  };
  root?.addEventListener("click", click);
  root?.addEventListener("pointerover", point);
  root?.addEventListener("pointerleave", leave);
  root?.addEventListener("focusin", focus);
  root?.addEventListener("focusout", leave);
  root?.addEventListener("toggle", disclosure, true);
  compact.addEventListener("change", sync);
  sync();
  return {
    sample(p: number) {
      if (!enhanced || Math.abs(p - last) < 0.00015) return;
      last = p;
      timeline.progress(p, true);
      stage?.style.setProperty("--eco-p", p.toFixed(5));
      const next = ecosystemBeat(p);
      panels.forEach((panel, i) => {
        panel.style.setProperty("--eco-reveal", phases[i].reveal.toFixed(5));
        panel.style.setProperty("--eco-leave", phases[i].leave.toFixed(5));
        if (i !== next && panel.contains(document.activeElement)) {
          tabs[Math.min(next, 2)]?.focus({ preventScroll: true });
        }
        panel.inert = i !== next;
        panel.setAttribute("aria-hidden", String(i !== next));
      });
      if (next !== active) {
        active = next;
        stage?.setAttribute("data-eco-beat", String(next));
        tabs.forEach((tab, i) => tab.setAttribute("aria-pressed", String(i === Math.min(next, 2))));
        hover(-1);
      }
      tabs.forEach((tab, i) => {
        const fill = Math.max(0, Math.min(1, (p - i * 0.27) / 0.27));
        tab.style.setProperty("--eco-fill", String(fill));
      });
    },
    dispose() {
      timeline.kill();
      compact.removeEventListener("change", sync);
      root?.removeAttribute("data-eco-live");
      root?.removeEventListener("click", click);
      root?.removeEventListener("pointerover", point);
      root?.removeEventListener("pointerleave", leave);
      root?.removeEventListener("focusin", focus);
      root?.removeEventListener("focusout", leave);
      root?.removeEventListener("toggle", disclosure, true);
      panels.forEach(p => { p.inert = false; p.removeAttribute("aria-hidden"); });
      hover(-1);
    },
  };
}
