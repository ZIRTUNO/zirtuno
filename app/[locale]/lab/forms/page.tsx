import { setRequestLocale } from "next-intl/server";
import FormStillRenderer from "@/components/lab/FormStillRenderer";

const FORM_MAX = 7;

function formIndex(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^[0-7]$/.test(raw) ? Number(raw) : null;
}

function frozenPair(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const match = raw?.match(/^([0-7])-([0-7])-(0(?:\.\d+)?|1(?:\.0+)?)$/);
  if (!match) return null;
  return [
    Number(match[1]),
    Number(match[2]),
    Math.min(1, Math.max(0, Number(match[3]))),
  ] as [number, number, number];
}

function frozenCursor(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const match = raw?.match(/^(\d*\.?\d+),(\d*\.?\d+)$/);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  return x >= 0 && x <= 1 && y >= 0 && y <= 1
    ? ([x, y] as [number, number])
    : null;
}

/**
 * Internal exact-form surface. It is a real route so Playwright can exercise
 * the same browser/WebGL stack as production, but it is inherited from the
 * no-index Lab layout and is never linked from the public site.
 */
export default async function FormsLabPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const state = formIndex(query.fstate) ?? 0;
  const pair = frozenPair(query.fpair) ?? [state, state, 1];
  const cursor = frozenCursor(query.fcursor);
  const label = pair[0] === pair[1]
    ? `Exact liquid form ${Math.min(FORM_MAX, pair[0])}`
    : `Liquid form morph ${pair[0]} to ${pair[1]} at ${pair[2]}`;

  return (
    <main
      id="content"
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        background: "#000",
        padding: "24px",
      }}
    >
      <div
        data-hero-metaball
        role="img"
        aria-label={label}
        style={{
          position: "relative",
          // Match the retired homepage shell's settled 480px capture box so
          // existing byte baselines continue to measure material, not layout.
          width: "min(72vw, 480px)",
          aspectRatio: "1 / 1",
        }}
      >
        <FormStillRenderer frozenPair={pair} frozenCursor={cursor} />
      </div>
    </main>
  );
}
