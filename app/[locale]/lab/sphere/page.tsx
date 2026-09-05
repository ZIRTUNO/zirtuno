import { setRequestLocale } from "next-intl/server";
import { LabSphereStage } from "@/components/lab/LabSphereStage";
import {
  AIM_KEYS,
  SPHERE_REST,
  type SphereState,
} from "@/lib/lab/sphere-shader";

/**
 * THE SPHERE, ON ITS OWN.
 *
 * The dot sphere was the Hero's object for a day. The Hero is text again, so
 * the object lives here instead of being deleted — one route, no chrome, no
 * copy, nothing competing with it. Inherited from the no-index Lab layout and
 * never linked from the public site.
 *
 * It is a real route for the same reason `/lab/forms` is: Playwright drives
 * the same browser and the same WebGL2 stack production would, so what is
 * measured here is the object and not a mock of it.
 *
 * ── driving it ──────────────────────────────────────────────────────────────
 *
 *   /lab/sphere                         the entry, then rest
 *   /lab/sphere?d=gather:0.35           one frozen frame of the assembly
 *   /lab/sphere?d=scatter:1.4,rim:2     a state that does not exist yet
 *   /lab/sphere?d=spin:0.72,flow:4.1    SPHERE_STILL — the reduced-motion frame
 *   /lab/sphere?dots=1200               the thin cloud, to see the lattice
 *   /lab/sphere?pointer=0               no hand, for a capture that must not move
 *
 * `d` accepts any driver in SPHERE_TAU plus the two clocks, and ANY value it
 * is given: the drivers are not clamped, because half of what a lab is for is
 * finding out what the thing does past the range it was tuned in.
 */

/** the clocks are not aimable, so they are not in AIM_KEYS — but they are snappable */
const CLOCK_KEYS = ["spin", "flow"] as const;
const DRIVER_KEYS = new Set<string>([...AIM_KEYS, ...CLOCK_KEYS]);

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * `?d=gather:0.35,rim:2` → a partial state.
 *
 * Unknown keys and unparseable numbers are DROPPED rather than defaulted: a
 * typo that silently became `0` would be a state you did not ask for, shown
 * without saying so, which is the one thing a reference surface may not do.
 */
function parseDrivers(value: string | string[] | undefined) {
  const raw = first(value);
  if (!raw) return undefined;

  const out: Partial<SphereState> = {};
  let found = false;
  for (const pair of raw.split(",")) {
    const [key, num] = pair.split(":");
    if (!key || num === undefined) continue;
    const k = key.trim();
    const n = Number(num);
    if (!DRIVER_KEYS.has(k) || !Number.isFinite(n)) continue;
    out[k as keyof SphereState] = n;
    found = true;
  }
  return found ? out : undefined;
}

function parseDots(value: string | string[] | undefined) {
  const raw = first(value);
  const n = raw ? Number(raw) : NaN;
  // the floor keeps a typo from rendering an empty canvas that reads as a bug;
  // the ceiling is roughly twice the Hero's cloud, which is already generous
  return Number.isFinite(n) ? Math.min(20000, Math.max(50, Math.round(n))) : undefined;
}

export default async function SphereLabPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const overrides = parseDrivers(query.d);
  const dots = parseDots(query.dots);
  const pointer = first(query.pointer) !== "0";

  // What is actually on screen, stated. A lab surface whose caption is a guess
  // is worse than one with no caption — this is read off the same values the
  // stage is handed, so it cannot drift from them.
  const state = { ...SPHERE_REST, ...overrides };
  const label = overrides
    ? `Sphere held at ${Object.entries(overrides)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}`
    : "Sphere at rest, after its assembly";

  return (
    <main id="content" className="lab-solo">
      <div className="lab-solo-stage">
        <LabSphereStage overrides={overrides} dots={dots} pointer={pointer} />
      </div>

      <p className="lab-solo-caption">
        <span>{label}</span>
        <span aria-hidden="true">·</span>
        <span>gather {state.gather}</span>
        <span aria-hidden="true">·</span>
        <span>{dots ? `${dots} dots` : "auto dots"}</span>
        <span aria-hidden="true">·</span>
        <span>{pointer ? "hand on" : "hand off"}</span>
      </p>
    </main>
  );
}
