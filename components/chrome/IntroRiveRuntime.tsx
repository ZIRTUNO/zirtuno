"use client";

import { useEffect, useMemo } from "react";
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useStateMachineInput,
} from "@rive-app/react-webgl2";

const ARTBOARD = "Intro";
const MACHINE = "Intro";
const INPUT = "progress";

/**
 * The only module in the intro that imports the Rive runtime, loaded lazily and
 * only when `NEXT_PUBLIC_INTRO_RIVE` names a file. See IntroRive.tsx for the
 * authoring contract; the short version is that this artboard is SCRUBBED and
 * must not move on its own.
 */
export default function IntroRiveRuntime({
  src,
  bind,
}: {
  src: string;
  bind: (set: (p: number) => void) => void;
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
    // It must not ANIMATE; that is the artboard author's side of the contract
    // (a 1-D blend state, no self-advancing timelines).
    autoplay: true,
    layout,
    automaticallyHandleEvents: false,
    shouldDisableRiveListeners: true,
    onRiveReady: (r) => {
      // Audio is out of scope for the intro, including audio inside a file.
      r.volume = 0;
    },
  });

  const progress = useStateMachineInput(rive, MACHINE, INPUT);

  useEffect(() => {
    if (!progress) {
      // A file that does not honour the contract simply never moves. It is a
      // decorative layer; a missing input is not worth a broken first frame.
      bind(() => {});
      return;
    }
    bind((p: number) => {
      progress.value = Math.max(0, Math.min(100, p * 100));
    });
    return () => bind(() => {});
  }, [progress, bind]);

  return (
    <RiveComponent
      className="entry-veil-rive"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
