"use client";

import { useMemo } from "react";
import { Alignment, Fit, Layout, useRive } from "@rive-app/react-webgl2";

interface RiveCaseRuntimeProps {
  src: string;
  artboard?: string;
  stateMachine?: string;
  onReady: () => void;
  onError: () => void;
}

/**
 * The only module that imports the Rive runtime. Its parent loads this module
 * lazily and only when a real Sanity-authored file is close to the viewport.
 */
export default function RiveCaseRuntime({
  src,
  artboard,
  stateMachine,
  onReady,
  onError,
}: RiveCaseRuntimeProps) {
  const layout = useMemo(
    () => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    [],
  );

  const { RiveComponent } = useRive({
    src,
    artboard: artboard || undefined,
    stateMachines: stateMachine || undefined,
    autoplay: true,
    layout,
    automaticallyHandleEvents: false,
    // The pilot is a supplemental, aria-hidden illustration. Authored state
    // machines may autoplay, but no hidden canvas may capture pointer/focus
    // until a case ships explicit semantic controls and state descriptions.
    shouldDisableRiveListeners: true,
    onRiveReady: (rive) => {
      // Audio is intentionally out for v1, including audio embedded in a file.
      rive.volume = 0;
      onReady();
    },
    onLoadError: onError,
  });

  return (
    <RiveComponent
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
