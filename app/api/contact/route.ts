import { NextResponse } from "next/server";
import { Resend } from "resend";
import { contactSchema } from "@/lib/forms/contact";

// S10.6 — validate (zod) → send via Resend (with intent) → JSON.
// Degrades gracefully: without RESEND_API_KEY the submission is accepted and
// logged so local/dev works; production should set the key + a verified sender.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 422 });
  }

  const { name, email, company, message, intent } = parsed.data;
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_EMAIL_TO ?? "zirtuno@gmail.com";
  const from = process.env.CONTACT_EMAIL_FROM ?? "Zirtuno <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn(
      "[contact] RESEND_API_KEY not set — submission logged, not emailed:",
      { name, email, company, intent },
    );
    return NextResponse.json({ ok: true, delivered: false });
  }

  try {
    const resend = new Resend(apiKey);
    const subject = `Solicitação — ${name}${company ? ` · ${company}` : ""} [${intent}]`;
    const text = [
      `Intent: ${intent}`,
      `Nome: ${name}`,
      `Email: ${email}`,
      `Empresa: ${company || "—"}`,
      "",
      message,
    ].join("\n");

    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject,
      text,
    });

    if (error) {
      console.error("[contact] Resend error", error);
      return NextResponse.json({ ok: false, error: "send" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, delivered: true });
  } catch (err) {
    console.error("[contact] send failed", err);
    return NextResponse.json({ ok: false, error: "send" }, { status: 502 });
  }
}
