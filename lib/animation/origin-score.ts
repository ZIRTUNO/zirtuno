import { gsap } from "gsap";

/** A paused GSAP score, scrubbed by PageStage's existing measurement loop.
 * One scroll reader, one clock for semantic wipes and scene progression.
 * GSAP never touches positions/velocities: a held score leaves physics alive. */
export function makeOriginScore() {
  const state = { p: 0, gather: 0, seal: 0, release: 0, focus: 0, capture: 0, ignite: 0 };
  const timeline = gsap.timeline({ paused: true });
  const ease = (v: number) => v * v * (3 - 2 * v);
  timeline.to(state, { p: 1, duration: 1, ease: "none" }, 0);
  timeline.to(state, { gather: 1, duration: .37, ease }, .18);
  timeline.to(state, { seal: 1, duration: .13, ease }, .49);
  timeline.to(state, { release: 1, duration: .21, ease }, .78);
  timeline.to(state, { focus: 1, duration: .10, ease }, .71);
  timeline.to(state, { capture: 1, duration: .34, ease }, .15);
  timeline.to(state, { ignite: 1, duration: .23, ease }, .08);
  timeline.addLabel("force", 0);
  timeline.addLabel("direction", 0.18);
  timeline.addLabel("convergence", 0.36);
  timeline.addLabel("identity", 0.56);
  timeline.addLabel("continuation", 0.76);
  return {
    sample(p: number) { timeline.progress(p, true); return state; },
    dispose() { timeline.kill(); },
  };
}
