"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useReportWebVitals } from "next/web-vitals";
import { ensureAnalyticsQueue, trackEvent } from "@/lib/analytics/client";

const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
const scriptUrl = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?.trim();

/** Optional Plausible integration plus privacy-safe Core Web Vitals reporting. */
export function SiteAnalytics() {
  useReportWebVitals((metric) => {
    trackEvent("web_vital", {
      metric: metric.name,
      value: Math.round(metric.value * 1000) / 1000,
      rating: metric.rating,
    });
  });

  useEffect(() => {
    ensureAnalyticsQueue();
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>("[data-analytics-event]");
      if (!target) return;

      trackEvent(target.dataset.analyticsEvent ?? "interaction", {
        intent: target.dataset.analyticsIntent,
        channel: target.dataset.analyticsChannel,
        locale: target.dataset.analyticsLocale,
        project: target.dataset.analyticsProject,
        placement: target.dataset.analyticsPlacement,
      });
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!domain || !scriptUrl) return null;

  return (
    <Script
      id="plausible-analytics"
      src={scriptUrl}
      data-domain={domain}
      strategy="lazyOnload"
    />
  );
}
