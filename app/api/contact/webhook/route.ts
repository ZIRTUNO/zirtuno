import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  readLimitedText,
  RequestBodyTooLargeError,
} from "@/lib/http/read-limited-text";

export const runtime = "nodejs";

const TRACKED_EVENTS = new Set([
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
]);

const ERROR_EVENTS = new Set([
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
]);
const WEBHOOK_MAX_BYTES = 262_144;

/** Signature-verified, PII-free final delivery telemetry from Resend. */
export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!apiKey || !webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let payload: string;
  try {
    payload = await readLimitedText(req, WEBHOOK_MAX_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      console.warn(
        JSON.stringify({ scope: "contact", event: "webhook_too_large" }),
      );
      return NextResponse.json({ ok: false }, { status: 413 });
    }
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  let event;
  try {
    const resend = new Resend(apiKey);
    event = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });
  } catch {
    console.warn(
      JSON.stringify({ scope: "contact", event: "webhook_signature_rejected" }),
    );
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!TRACKED_EVENTS.has(event.type) || !("email_id" in event.data)) {
    return new NextResponse(null, { status: 204 });
  }

  if (
    !("tags" in event.data) ||
    event.data.tags?.source !== "website-contact"
  ) {
    return new NextResponse(null, { status: 204 });
  }

  const entry = {
    scope: "contact",
    event: "delivery_webhook",
    deliveryEvent: event.type,
    providerMessageId: event.data.email_id,
  };
  if (ERROR_EVENTS.has(event.type)) console.error(JSON.stringify(entry));
  else console.info(JSON.stringify(entry));

  return new NextResponse(null, { status: 204 });
}
