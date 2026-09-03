import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// The Cloudflare adapter turns the Next build into a Worker bundle. Defaults
// are deliberate here: no R2 incremental cache and no self-reference service
// binding, so the first deploy needs no pre-provisioned resources. Both are
// additive later — see docs/decisions if either becomes necessary for ISR.
export default defineCloudflareConfig();
