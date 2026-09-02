"use client";

import Image from "next/image";
import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const RiveCaseRuntime = lazy(() => import("./RiveCaseRuntime"));

interface CaseRiveExperienceProps {
  src: string;
  artboard?: string;
  stateMachine?: string;
  title: string;
  description: string;
  posterImage: string;
}

const subscribeToReducedMotion = (onStoreChange: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
};

const getReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const subscribeToCapabilities = () => () => undefined;
let cachedWebGL2Support: boolean | undefined;

const getWebGL2Support = () => {
  if (cachedWebGL2Support !== undefined) return cachedWebGL2Support;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    cachedWebGL2Support = Boolean(context);
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cachedWebGL2Support = false;
  }
  return cachedWebGL2Support;
};

interface RuntimeBoundaryProps {
  children: ReactNode;
  onError: () => void;
}

interface RuntimeBoundaryState {
  failed: boolean;
}

class RuntimeBoundary extends Component<
  RuntimeBoundaryProps,
  RuntimeBoundaryState
> {
  state: RuntimeBoundaryState = { failed: false };

  static getDerivedStateFromError(): RuntimeBoundaryState {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Optional case-study enhancement. The authored title, description, and poster
 * are the primary output and are server-rendered. Rive is progressively loaded
 * only for motion-capable WebGL2 browsers near the viewport; every failure path
 * leaves the semantic/static version intact.
 */
export function CaseRiveExperience({
  src,
  artboard,
  stateMachine,
  title,
  description,
  posterImage,
}: CaseRiveExperienceProps) {
  const titleId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotion,
    () => true,
  );
  const supportsWebGL2 = useSyncExternalStore(
    subscribeToCapabilities,
    getWebGL2Support,
    () => false,
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const handleReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const handleError = useCallback(() => {
    setHasFailed(true);
    setIsReady(false);
  }, []);

  const shouldLoadRuntime =
    isNearViewport && supportsWebGL2 && !reducedMotion && !hasFailed;

  return (
    <section className="mt-[var(--space-span)]" aria-labelledby={titleId}>
      <div className="grid gap-[var(--space-group)] md:grid-cols-2">
        <h2
          id={titleId}
          className="type-card-title max-w-[20ch] font-grotesk text-paper"
        >
          {title}
        </h2>
        <p className="text-body-l max-w-2xl text-paper-lead">{description}</p>
      </div>

      <div
        ref={hostRef}
        className="relative isolate mt-[var(--space-group)] aspect-video min-h-64 overflow-hidden rounded-3xl border border-paper-faint bg-surface"
      >
        <div
          className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${isReady ? "pointer-events-none opacity-0" : "opacity-100"}`}
          aria-hidden="true"
        >
          <Image
            src={posterImage}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>

        {shouldLoadRuntime && (
          <RuntimeBoundary onError={handleError}>
            <Suspense fallback={null}>
              <div
                className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${isReady ? "opacity-100" : "opacity-0"}`}
              >
                <RiveCaseRuntime
                  src={src}
                  artboard={artboard}
                  stateMachine={stateMachine}
                  onReady={handleReady}
                  onError={handleError}
                />
              </div>
            </Suspense>
          </RuntimeBoundary>
        )}
      </div>
    </section>
  );
}
