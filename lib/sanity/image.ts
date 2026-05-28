import imageUrlBuilder from "@sanity/image-url";
import { sanityClient } from "./client";

const builder = sanityClient ? imageUrlBuilder(sanityClient) : null;

/** Build a Sanity image URL, or null when Sanity isn't configured. */
export function urlForImage(source: unknown): string | null {
  if (!builder || !source) return null;
  try {
    return builder.image(source as never).url();
  } catch {
    return null;
  }
}
