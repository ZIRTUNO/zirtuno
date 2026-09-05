"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { registerWetBlock } from "@/lib/motion/wet-edge";

type Tag = "p" | "h1" | "h2" | "h3" | "div" | "span" | "li" | "blockquote";

type WetTypeProps = {
  children: ReactNode;
  /** Element to render. Semantics are the caller's — this never changes them. */
  as?: Tag;
  className?: string;
  style?: CSSProperties;
  /**
   * How a word carries the front.
   *
   * "ink"   — the word's own colour travels dry → arrived. For any block whose
   *           glyphs are painted from `color`.
   * "glass" — the word paints a VEIL over the block instead. Display type here
   *           is liquid GLASS: the glyphs are cut out of `--liquid-glass-fill`
   *           by the BLOCK's `background-clip: text`, and a word inside it has
   *           no ink of its own to move — setting `color` on it paints a flat
   *           slab on top of the fill. So the word darkens the slab instead,
   *           and clears to fully transparent on arrival, which leaves the
   *           headline byte-identical to how it ships today. Reads as glass
   *           that is not lit until the front reaches it.
   */
  paint?: "ink" | "glass";
};

/**
 * THE WETTING EDGE, applied to one block of copy.
 *
 * The block's words are wrapped at render time — on the SERVER as well as the
 * client, so the split HTML is what ships and there is no post-hydration
 * reflow and no hydration mismatch. `lib/motion/wet-edge.ts` then writes ONE
 * number onto the block per frame and the stylesheet derives each word's own
 * arrival from it. This component runs no animation itself.
 *
 * Three things the split deliberately does NOT do:
 *
 *   · it does not touch whitespace. Every run of spaces between two words
 *     stays a real text node, and word spans stay `display: inline`, so line
 *     breaking, `text-wrap: balance` and the accessibility tree come out
 *     byte-identical to the unsplit paragraph. (Per-word `inline-block` is
 *     what makes screen readers pause between words — that is the mistake
 *     this avoids.)
 *
 *   · it does not descend into nested COMPONENTS, only into intrinsic
 *     elements. A `<span className="font-poetic">` inside a lead is split
 *     along with everything else; another component's children are its own
 *     business.
 *
 *   · it does not carry a colour. The stylesheet mixes toward
 *     `currentcolor`, which in the `color` property is the INHERITED value,
 *     so a word arrives at whatever its own parent authored — the studio's
 *     muted italic tail included — and no block has to declare an ink.
 *
 *   · it does not branch on reduced motion. The markup is identical either
 *     way — only the REGISTRATION is skipped, which leaves `data-wet` unset,
 *     which leaves the copy at full strength. Branching the markup on a value
 *     that is false during SSR and true after mount is a hydration mismatch.
 */
export function WetType({
  children,
  as = "p",
  className,
  style,
  paint = "ink",
}: WetTypeProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    return registerWetBlock(el);
  }, [reduced]);

  const counter = { n: 0 };
  const content = wetten(children, counter, "w");

  const Tag = as;
  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        ref.current = node;
      }}
      className={cn("wet", className)}
      data-paint={paint === "glass" ? "glass" : undefined}
      style={
        {
          ...style,
          // The word count is what turns one block-level number into a
          // per-word one, so it has to travel with the block.
          "--wet-n": counter.n || 1,
        } as CSSProperties
      }
    >
      {content}
    </Tag>
  );
}

/** Wrap every word in `node` in a span carrying its running index. */
function wetten(
  node: ReactNode,
  counter: { n: number },
  key: string,
): ReactNode {
  if (typeof node === "string" || typeof node === "number") {
    return splitWords(String(node), counter, key);
  }

  if (Array.isArray(node)) {
    return Children.map(node, (child, i) => wetten(child, counter, `${key}${i}`));
  }

  if (isValidElement(node)) {
    // Intrinsic elements only — see the note in the component's doc comment.
    if (typeof node.type !== "string") return node;
    const element = node as ReactElement<{ children?: ReactNode }>;
    const inner = element.props.children;
    if (inner === undefined || inner === null) return node;
    return cloneElement(element, undefined, wetten(inner, counter, `${key}e`));
  }

  return node;
}

/** Split on whitespace, KEEPING the whitespace as its own text node. */
function splitWords(
  text: string,
  counter: { n: number },
  key: string,
): ReactNode[] {
  const out: ReactNode[] = [];
  for (const [i, part] of text.split(/(\s+)/).entries()) {
    if (!part) continue;
    if (!part.trim()) {
      out.push(part);
      continue;
    }
    out.push(
      <span
        key={`${key}${i}`}
        className="wet-w"
        style={{ "--wet-i": counter.n++ } as CSSProperties}
      >
        {part}
      </span>,
    );
  }
  return out;
}
