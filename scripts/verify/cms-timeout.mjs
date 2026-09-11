// Exercise the real client configuration against a local stalled CMS. No
// production service or credential is used, and no message is submitted.
import assert from "node:assert/strict";
import http from "node:http";

process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = "timeout-test";
delete process.env.SANITY_API_TOKEN;
const { sanityClient } = await import("../../lib/sanity/client.ts");
let requests = 0;
let healthy = false;
const server = http.createServer((_req, res) => {
  requests++;
  if (healthy) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ result: [{ title: "Recovered" }] }));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const client = sanityClient.withConfig({
    apiHost: `http://127.0.0.1:${server.address().port}`,
    useProjectHostname: false,
    useCdn: false,
    token: undefined,
  });
  const start = performance.now();
  await assert.rejects(client.fetch("*[]"), /timeout|timed out/i);
  const elapsed = performance.now() - start;
  assert(elapsed >= 2500 && elapsed < 4500, `CMS timeout took ${elapsed}ms`);
  assert.equal(requests, 1, "optional CMS reads must not retry past the page budget");
  healthy = true;
  assert.deepEqual(await client.fetch("*[]"), [{ title: "Recovered" }]);
  console.log(`CMS timeout: ${Math.round(elapsed)}ms, one attempt; next request recovers`);
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
