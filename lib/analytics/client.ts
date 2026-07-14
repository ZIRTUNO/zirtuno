"use client";

type AnalyticsValue = string | number | boolean;
type AnalyticsProps = Record<string, AnalyticsValue | undefined>;

type PlausibleFunction = {
  (event: string, options?: { props?: Record<string, AnalyticsValue> }): void;
  q?: unknown[][];
};

declare global {
  interface Window {
    plausible?: PlausibleFunction;
  }
}

const enabled = Boolean(
  process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN &&
    process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL,
);

/** Privacy-conscious product telemetry. Never pass visitor-entered content. */
export function ensureAnalyticsQueue() {
  if (!enabled || typeof window === "undefined") return;
  if (!window.plausible) {
    const queued: PlausibleFunction = (...args: unknown[]) => {
      queued.q ??= [];
      queued.q.push(args);
    };
    window.plausible = queued;
  }
}

/** Privacy-conscious product telemetry. Never pass visitor-entered content. */
export function trackEvent(event: string, props: AnalyticsProps = {}) {
  if (!enabled || typeof window === "undefined") return;
  ensureAnalyticsQueue();

  const cleanProps = Object.fromEntries(
    Object.entries(props).filter(
      (entry): entry is [string, AnalyticsValue] => entry[1] !== undefined,
    ),
  );
  window.plausible?.(event, { props: cleanProps });
}
