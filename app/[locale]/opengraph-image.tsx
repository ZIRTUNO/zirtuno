import { ImageResponse } from "next/og";

export const alt = "Zirtuno: ecossistemas digitais completos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TAGLINE: Record<string, string> = {
  pt: "Ecossistemas digitais completos",
  en: "Complete digital ecosystems",
};

// Branded OG image (S15). Cyan-on-black, localized tagline. Dynamic — no binary.
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tagline = TAGLINE[locale] ?? TAGLINE.pt;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#000000",
          color: "#F2F0EB",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 380,
            right: -80,
            width: 460,
            height: 460,
            borderRadius: "9999px",
            background:
              "radial-gradient(circle at 40% 40%, #4DECFF, #00E3FE 45%, transparent 72%)",
            filter: "blur(8px)",
            opacity: 0.85,
          }}
        />
        <div
          style={{
            fontSize: 28,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#00E3FE",
          }}
        >
          Zirtuno
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 84,
            fontWeight: 600,
            lineHeight: 1.05,
            maxWidth: 820,
          }}
        >
          {tagline}
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 26,
            color: "rgba(242,240,235,0.5)",
          }}
        >
          Discreto. Preciso. Transformador.
        </div>
      </div>
    ),
    size,
  );
}
