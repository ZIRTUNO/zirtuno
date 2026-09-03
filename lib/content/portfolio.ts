import type { Project } from "@/lib/sanity/types";

/**
 * The published selection — REAL, delivered, owner-supplied client work.
 *
 * This is deliberately a different thing from `SEED_PROJECTS` in
 * `./projects.ts`. Those are concept studies: unverified scaffolding, gated
 * behind an explicit non-production demo flag, and never proof. These are
 * shipped sites with public URLs anyone can open and check, authored in the
 * repo the same way `services.ts` and `legal.ts` author their content. They
 * satisfy rule #9 by being verifiable rather than by being labelled: every
 * claim below is either visible on the live site or is a description of the
 * artefact itself.
 *
 * Sanity still wins when it is configured (see `./work.ts`) — this is the
 * committed floor, not a fallback for a failed CMS request.
 *
 * Outcomes are `narrative` on purpose. Both sites publish their own numbers
 * (Diego's "+800 alunos formados", for one) but those are the CLIENT's claims
 * about their practice, not measured results of the engagement, so restating
 * them here as our outcome would be exactly the invented proof rule #9 bans.
 *
 * TODO(owner): `servicesInvolved` lists the disciplines evidenced BY the
 * delivered sites. Confirm the real commercial scope of each engagement and
 * correct these lines if they overstate or understate it.
 */
export const VERIFIED_PROJECTS: Project[] = [
  {
    slug: "juliana-delmonte",
    title: { pt: "Juliana Delmonte", en: "Juliana Delmonte" },
    category: ["web-design", "branding"],
    servicesInvolved: [
      "Site institucional",
      "Design de interface",
      "Narrativa e conteúdo",
      "SEO técnico",
    ],
    summary: {
      pt: "Um site narrativo para uma nutricionista comportamental: leva o leitor do sintoma que ele reconhece até o método que explica a causa.",
      en: "A narrative site for a behavioural nutritionist: it carries the reader from the symptom they recognise to the method that explains the cause.",
    },
    challenge: {
      pt: "Um método comportamental difícil de resumir em uma frase, falando com quem já tentou — e abandonou — várias dietas. A objeção vem antes do interesse.",
      en: "A behavioural method that resists a one-line summary, speaking to people who have already tried and abandoned several diets. The objection arrives before the interest.",
    },
    built: {
      pt: "Um site que conduz a leitura em vez de listar serviços: os pensamentos que a paciente reconhece como seus, o método em três princípios, a consulta em quatro passos e um bloco de dúvidas que responde às objeções antes do primeiro contato. A conversa termina no WhatsApp.",
      en: "A site that guides the reading instead of listing services: the thoughts the patient recognises as her own, the method in three principles, the consultation in four steps, and a questions block that answers the objections before first contact. The conversation ends in WhatsApp.",
    },
    outcome: {
      pt: "Uma presença que explica o método antes da primeira consulta e entrega a conversa já qualificada no WhatsApp.",
      en: "A presence that explains the method before the first consultation and hands the conversation over to WhatsApp already qualified.",
    },
    outcomeType: "narrative",
    previewImage: "/work/juliana-delmonte-2026.jpg",
    markImage: "/work/juliana-delmonte-mark.png",
    liveUrl: "https://julianadelmonte.com.br",
    featured: true,
    order: 1,
  },
  {
    slug: "diego-santos",
    title: { pt: "Diego Santos", en: "Diego Santos" },
    category: ["web-design", "branding"],
    servicesInvolved: [
      "Site institucional",
      "Design de interface",
      "Narrativa e conteúdo",
      "SEO técnico",
    ],
    summary: {
      pt: "Uma presença de alta performance para um personal trainer: história, método, serviços e resultados encadeados como uma subida.",
      en: "A high-performance presence for a personal trainer: story, method, services and results chained together as one climb.",
    },
    challenge: {
      pt: "Um treinador cujo diferencial é o método, num mercado que se apresenta com fotos e promessas. Era preciso mostrar o rigor sem soar genérico.",
      en: "A trainer whose differentiator is the method, in a market that presents itself with photos and promises. The rigour had to show without sounding generic.",
    },
    built: {
      pt: "Um site em escalada, construído sobre a metáfora da montanha: a história, o método, os serviços e os resultados avançam em capítulos, cada um com seu próprio movimento, e terminam no contato direto com o treinador.",
      en: "A site built as a climb, on the mountain metaphor: story, method, services and results advance in chapters, each with its own movement, ending in direct contact with the trainer.",
    },
    outcome: {
      pt: "Uma presença que sustenta o posicionamento de alta performance e abre a conversa direto com o treinador.",
      en: "A presence that carries the high-performance positioning and opens the conversation directly with the trainer.",
    },
    outcomeType: "narrative",
    previewImage: "/work/diego-santos-2026.jpg",
    markImage: "/work/diego-santos-mark.png",
    liveUrl: "https://www.diegosantospersonal.com.br",
    featured: true,
    order: 2,
  },
];
