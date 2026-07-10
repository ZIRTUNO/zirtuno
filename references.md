# references.md — Zirtuno Website v0.3

> Curated implementation and taste references for the current raw
> WebGL2/OGL, conductor, physics, post-processing, cinematic, and Next.js
> architecture.
>
> Read only the block mapped to the task. Repository code and the authoritative
> specs remain the source of project-specific truth.

## 1. How to Use This File

1. Read `AGENTS.md` and the relevant part of `build-spec.md`.
2. For any liquid change, read the relevant part of
   `metaball-morph-spec.md`.
3. Use the map in §10 to choose references.
4. Prefer primary/official technical sources.
5. Use inspiration sites to study pacing and interaction principles, never to
   paste a recognizable visual or introduce a new stack.
6. Run the specified project harness after applying any external technique.

This file intentionally does not list Three.js, React Three Fiber, Drei,
raymarch metaballs, shadcn marketplaces, or the old GPU-gating paths. They are
not alternative implementations.

## 2. Raw WebGL2 and OGL

Use for `FieldStage`, SDF textures, framebuffer resources, post-processing, and
context restoration.

- [OGL source and examples](https://github.com/oframe/ogl) — minimal WebGL
  abstraction used by the project. Prefer existing project wrappers before
  introducing more OGL scene-graph machinery.
- [WebGL2RenderingContext — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext)
  — WebGL2 API surface.
- [WebGL framebufferTexture2D — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/framebufferTexture2D)
  — attachment fundamentals for R5-C targets/ping-pong.
- [WebGL framebufferRenderbuffer — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/framebufferRenderbuffer)
  — renderbuffer attachment and lifecycle.
- [EXT_color_buffer_float — MDN](https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float)
  — float render-target support; R5-C must keep an RGBA8 fallback.
- [WebGL context lost event — MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event)
  and [restored event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextrestored_event)
  — rebuild every texture, buffer, framebuffer, and program after restore.
- [Khronos WebGL 2 specification](https://registry.khronos.org/webgl/specs/latest/2.0/)
  — normative behavior when MDN summaries are insufficient.

Project rules:

- keep the renderer in one homepage canvas;
- clean up every GL resource;
- detect extensions/capabilities, do not infer them from GPU names;
- keep Node-runnable kernels free of WebGL/DOM;
- use a full-screen triangle for field/post passes;
- ensure all new R5-C uniforms default to identity.

## 3. Distance Fields, Field Math, and Shading

Use for exact endpoints, the shared scalar field, material normals, warp, and
depth.

- [Inigo Quilez — distance functions](https://iquilezles.org/articles/distfunctions/)
  — SDF conventions and composition.
- [Inigo Quilez — smooth minimum](https://iquilezles.org/articles/smin/)
  — conceptual background only. The current endpoint/morph field uses its
  documented SDF-to-inverse-square mapping, not a return to raymarched smooth-min
  spheres.
- [The Book of Shaders](https://thebookofshaders.com/) — GLSL shaping, noise,
  derivatives, and color fundamentals.
- [GLSL ES specification index — Khronos](https://registry.khronos.org/OpenGL/index_es.php)
  — normative shader language reference.
- [OES_standard_derivatives — MDN](https://developer.mozilla.org/en-US/docs/Web/API/OES_standard_derivatives)
  — background for derivatives; WebGL2 has derivative functions in core.

Project-specific equations, constants, coverage clamp, bounded influence, exact
round-trip, bridge, and glass model are defined in
`metaball-morph-spec.md §§2–5` and the shader source. External demos cannot
override them.

## 4. Post-Processing and Optics — R5-C

Use when implementing `post-chain.ts` and `post-shaders.mjs`.

Primary building blocks:

- WebGL2/framebuffer and float-target references in §2.
- [WebGL texture filtering — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texParameter)
  — explicit filtering/wrap state for scene, bright, blur, and noise textures.
- [WebGL drawBuffers — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawBuffers)
  — reference only if a multi-target design is justified; the approved plan
  does not require MRT.
- [EXT_disjoint_timer_query_webgl2 — MDN](https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query_webgl2)
  — GPU timing where available; keep CPU/readback fallback for QA.
- [Beer–Lambert law — IUPAC Gold Book](https://goldbook.iupac.org/terms/view/B00626/plain)
  — conceptual basis for absorption. The site uses an art-directed internal
  depth control, not a scientific material claim.

R5-C order:

1. scene render target;
2. half-resolution bright pass;
3. horizontal then vertical Gaussian passes;
4. opaque composite with selective cyan bloom;
5. blue-noise dither;
6. luminance-gated grain;
7. exposure/absorption/depth application per the approved shader boundary.

Do not copy a generic “cinematic LUT” stack. No LUT, chromatic aberration,
purple fringe, rainbow dispersion, or constant halo is approved.

## 5. Physics and Simulation

Use for `fluid-core.mjs`, the fixed-step accumulator, forces, and long-run
verification.

- [Fix Your Timestep — Glenn Fiedler](https://gafferongames.com/post/fix_your_timestep/)
  — fixed/substepped integration and frame-rate independence.
- [Curl-noise for procedural fluid flow — Bridson, Houriham, Nordenstam](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf)
  — divergence-free curl-field basis.
- [requestAnimationFrame — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
  — frame scheduling and timestamp behavior.
- [Page Visibility API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
  — pause/idle behavior and background-tab expectations.

Project-specific physics remains the `FLUID` table plus bind contract in
`metaball-morph-spec.md §8`:

- fixed 8 ms substeps;
- TAUP-derived goal seek;
- soft-core repulsion;
- cluster cohesion;
- analytic curl drift;
- page-wide pointer field;
- bounded pinch-off pool;
- exact legacy-shadow blend at bind 1.

A physically plausible result that breaks signed-off choreography is still a
regression.

## 6. Scroll, DOM Motion, and Smooth Scrolling

- [GSAP documentation](https://gsap.com/docs/v3/) — timelines, context/cleanup,
  matchMedia, and easing.
- [ScrollTrigger documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
  — scrub, pin, refresh, progress, direction, and velocity.
- [GSAP React integration](https://gsap.com/resources/React/) — `useGSAP` and
  cleanup.
- [Lenis documentation](https://www.lenis.dev/) — current smooth-scroll API
  and GSAP integration.
- [Motion for React](https://motion.dev/docs/react) — DOM micro-interactions,
  hover/tap/focus, presence, and layout transitions.

Ownership rule:

- GSAP/ScrollTrigger owns scroll-bound DOM choreography;
- the conductor consumes measured progress for liquid scenes;
- Lenis owns smooth scrolling;
- Motion owns local declarative UI motion.

Do not tween conductor droplet positions in GSAP or make Motion and GSAP control
the same transform. Preserve diagnostic anchor selectors when rebuilding
runways.

## 7. Framework, i18n, Content, and Contact

- [Next.js 16 documentation](https://nextjs.org/docs) — App Router, RSC,
  metadata, route handlers, proxy convention, image and font behavior.
- [React documentation](https://react.dev/) — component/effect semantics.
- [Tailwind CSS v4 documentation](https://tailwindcss.com/docs) — CSS-first
  theme configuration.
- [next-intl documentation](https://next-intl.dev/) — locale routing, server
  translations, and client provider.
- [Sanity documentation](https://www.sanity.io/docs) — schemas, client, GROQ,
  localized content, and images.
- [react-hook-form documentation](https://react-hook-form.com/) — accessible
  form state.
- [Zod documentation](https://zod.dev/) — contact validation.
- [Resend documentation](https://resend.com/docs) — sender verification and
  transactional delivery.
- [Vercel OG documentation](https://vercel.com/docs/og-image-generation) —
  localized/project share images.

Project rules:

- keep conversion copy in locale JSON, never in components;
- keep chapter meaning server-rendered;
- treat prototype Sanity fallbacks as development-only;
- do not ship placeholder contact facts;
- preserve CTA intent through same-page and cross-page paths.

## 8. Accessibility and Reduced Motion

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — normative accessibility target.
- [Understanding SC 2.3.1: Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
  — Origin flash constraint.
- [Technique G19: no more than three flashes per second](https://www.w3.org/WAI/WCAG22/Techniques/general/G19)
  — conservative flash test.
- [Understanding SC 1.4.3: Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
  — text contrast through veils/afterglow.
- [prefers-reduced-motion — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
  — static/readable alternatives.
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) — keyboard
  and control patterns.

The Origin uses exactly one flash, at most 400 ms, and none under reduced
motion. Duration alone does not prove compliance; review frequency, area,
luminance transition, contrast, and the final rendered capture.

## 9. Visual and Interaction Inspiration

These are taste sources, not code authorities:

- [Awwwards](https://www.awwwards.com/) — benchmark composition, pacing, and
  the relationship between craft and commercial clarity.
- [Codrops](https://tympanus.net/codrops/) — study scroll staging, text
  particles, post-processing, and interaction breakdowns. Translate the
  principle into the locked stack.
- [Design Spells](https://designspells.com/) — small product details, loading,
  form feedback, transitions, 404s, and restraint.
- [React Bits](https://reactbits.dev/) — the gooey-cursor feel was an
  interaction reference. Do not import its component into the signature field.

Study:

- why an interaction has weight;
- how long it holds;
- where stillness is used;
- how copy remains legible;
- how a transition motivates the next scene.

Do not copy:

- another studio’s recognizable signature;
- generic neon/glass presets;
- an extra rendering framework;
- marketplace layout/components for signature surfaces.

## 10. Spec and Phase Map

| Work area | Read first | Primary references |
|---|---|---|
| Exact forms/SDF | morph spec §§2–4 | §2 WebGL, §3 distance fields |
| §3.3 morph | morph spec §5 | §3 field math, §6 motion only for DOM shell |
| Conductor/scenes | build spec §5.3–5.6, morph spec §7 | §5 simulation, §6 scroll |
| Physics tuning | morph spec §8 | §5 physics/simulation |
| Hero/cursor | build spec §6.1, morph spec §9 | §2–3 plus React Bits as feel reference |
| Problem/Ecosystem | build spec §6.2–6.3, morph spec §11 | §5–6, Codrops for staging |
| Services | build spec §6.4, morph spec §5 | §6 ScrollTrigger |
| Método | build spec §6.5 | §5 physics, §6 ScrollTrigger |
| Work/Studio/Footer scenes | build spec §6.6/6.8/6.10 | §5–6 |
| Origin particles/flash | build spec §6.7 | §6 scroll, §8 accessibility, Codrops particles |
| Contact | build spec §6.9 | §7 forms/email, §8 accessibility |
| R5-C post chain | build spec §5.8/§9, morph spec §10 | §2 and §4 |
| R5-D cinematic layer | build spec §4.5/§9 | §6 and §8 |
| R5-E hardening | build spec §8/§9 | §§2, 5, 7, 8 |

## 11. Stale-Architecture Guard

Stop and re-read the specs if a proposed change includes any of these:

- `three`, `@react-three/fiber`, or `@react-three/drei`;
- a second homepage liquid canvas or chapter-specific canvas;
- raymarching the hero forms;
- mesh metaballs as a “lite” brand;
- `can-run-glass` or GPU-name blocklisting;
- `?glass=`;
- form endpoint opacity crossfades;
- an SDF/ball-only duplicate state registry;
- `framer-motion` imports instead of `motion/react`;
- Tailwind v3 JavaScript theme configuration;
- hard-coded PT/EN copy in a component;
- a generic bloom/LUT/chromatic-aberration preset;
- a flash that repeats or remains under reduced motion.

History explains why these existed. It does not authorize their return.
