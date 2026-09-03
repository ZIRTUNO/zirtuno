"use client";

import { useEffect, useMemo } from "react";
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useStateMachineInput,
} from "@rive-app/react-webgl2";
import { bindOriginRive } from "./OriginRive";

const ARTBOARD = "Origin";
const MACHINE = "Origin";
const INPUT_PROGRESS = "progress";
const INPUT_IDEA = "idea";

/**
 * The only module in S7 that imports the Rive runtime, loaded lazily and only
 * when `NEXT_PUBLIC_ORIGIN_RIVE` names a file. See OriginRive.tsx for the
 * authoring contract; the short version is that this artboard is SCRUBBED by
 * the chapter's clock and must not move on its own.
 */
export default function OriginRiveRuntime({
  src,
  idea,
}: {
  src: string;
  idea: 0 | 1;
}) {
  const layout = useMemo(
    () => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    [],
  );

  const { rive, RiveComponent } = useRive({
    src,
    artboard: ARTBOARD,
    stateMachines: MACHINE,
    // The machine must EVALUATE — otherwise writing the input changes nothing.
    // It must not ANIMATE; that is the artboard author's side of the contract.
    autoplay: true,
    layout,
    automaticallyHandleEvents: false,
    shouldDisableRiveListeners: true,
    onRiveReady: (r) => {
      // Audio is out for v1, including audio inside a file.
      r.volume = 0;
    },
  });

  const progress = useStateMachineInput(rive, MACHINE, INPUT_PROGRESS);
  const which = useStateMachineInput(rive, MACHINE, INPUT_IDEA);

  useEffect(() => {
    if (which) which.value = idea;
  }, [which, idea]);

  useEffect(() => {
    // A file that does not honour the contract simply never moves.
    if (!progress) return;
    return bindOriginRive((p: number) => {
      progress.value = Math.max(0, Math.min(100, p * 100));
    });
  }, [progress]);

  return <RiveComponent className="origin-idea-sigil-canvas" aria-hidden="true" tabIndex={-1} />;
}
