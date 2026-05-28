import type { Project } from "@/lib/sanity/types";

// TODO(decision): These are 6 PROTOTYPE projects for layout/launch. Replace
// with real verified content via Sanity. Per CLAUDE.md rule #3 no metrics are
// invented — every outcome is "architecture" (Arquitetura selecionada) or an
// honest non-numeric "narrative". No project uses outcomeType "metric" until
// real, verified numbers exist.

export const SEED_PROJECTS: Project[] = [
  {
    slug: "ecossistema-varejo",
    title: { pt: "Ecossistema de Varejo", en: "Retail Ecosystem" },
    category: ["software", "automation", "data"],
    servicesInvolved: ["Plataforma web", "Integrações CRM", "Automação", "Dashboards"],
    challenge: {
      pt: "Operação dividida entre loja física e digital, com sistemas que não se falavam.",
      en: "An operation split between physical and digital, with systems that didn't talk.",
    },
    built: {
      pt: "Uma plataforma única que conecta vendas, estoque e atendimento, com automações entre as ferramentas e um painel central de decisão.",
      en: "A single platform connecting sales, inventory, and service, with automations between tools and a central decision dashboard.",
    },
    outcome: {
      pt: "Arquitetura de ecossistema conectando operação, dados e atendimento.",
      en: "An ecosystem architecture connecting operations, data, and service.",
    },
    outcomeType: "architecture",
    featured: true,
    order: 1,
    prototype: true,
  },
  {
    slug: "marca-clinica",
    title: { pt: "Identidade & Site Clínico", en: "Clinic Brand & Site" },
    category: ["branding", "web-design"],
    servicesInvolved: ["Identidade visual", "Site institucional", "Agendamento"],
    challenge: {
      pt: "Marca genérica e presença digital que não transmitia confiança.",
      en: "A generic brand and a digital presence that didn't convey trust.",
    },
    built: {
      pt: "Uma identidade coerente e um site que organiza serviços e agendamento em uma só experiência.",
      en: "A coherent identity and a site that organizes services and scheduling into one experience.",
    },
    outcome: {
      pt: "Centralizou marca e agendamento em uma presença única e clara.",
      en: "Unified brand and scheduling into one clear presence.",
    },
    outcomeType: "narrative",
    featured: true,
    order: 2,
    prototype: true,
  },
  {
    slug: "atendimento-ia",
    title: { pt: "Atendimento com IA", en: "AI-Powered Service" },
    category: ["ai", "automation"],
    servicesInvolved: ["Agente de IA", "Chatbot", "Automação", "Integrações"],
    challenge: {
      pt: "Atendimento sobrecarregado e oportunidades perdidas fora do horário.",
      en: "Overloaded service and opportunities lost after hours.",
    },
    built: {
      pt: "Um agente de IA integrado ao CRM que atende, qualifica e encaminha — disponível 24/7.",
      en: "An AI agent integrated with the CRM that serves, qualifies, and routes — available 24/7.",
    },
    outcome: {
      pt: "Arquitetura de atendimento inteligente conectada ao CRM.",
      en: "An intelligent service architecture connected to the CRM.",
    },
    outcomeType: "architecture",
    featured: true,
    order: 3,
    prototype: true,
  },
  {
    slug: "painel-dados",
    title: { pt: "Painel de Dados Executivo", en: "Executive Data Dashboard" },
    category: ["data", "software"],
    servicesInvolved: ["Organização de dados", "BI", "Dashboards"],
    challenge: {
      pt: "Decisões tomadas no escuro, com dados espalhados em planilhas e ferramentas.",
      en: "Decisions made in the dark, with data scattered across spreadsheets and tools.",
    },
    built: {
      pt: "Um painel que reúne as fontes de dados do negócio em uma visão clara e atualizada.",
      en: "A dashboard that brings the business's data sources into one clear, up-to-date view.",
    },
    outcome: {
      pt: "Unificou fontes de dados dispersas em um só painel de decisão.",
      en: "Unified scattered data sources into a single decision dashboard.",
    },
    outcomeType: "narrative",
    featured: true,
    order: 4,
    prototype: true,
  },
  {
    slug: "growth-saas",
    title: { pt: "Growth para SaaS", en: "SaaS Growth" },
    category: ["marketing", "data"],
    servicesInvolved: ["Tráfego pago", "Conteúdo", "Performance", "Dashboards"],
    challenge: {
      pt: "Investimento em marketing sem retorno claro e crescimento estagnado.",
      en: "Marketing spend with no clear return and stagnant growth.",
    },
    built: {
      pt: "Uma estrutura de aquisição e conteúdo conectada a dashboards de performance.",
      en: "An acquisition and content structure connected to performance dashboards.",
    },
    outcome: {
      pt: "Arquitetura de crescimento conectada à estrutura digital.",
      en: "A growth architecture connected to the digital structure.",
    },
    outcomeType: "architecture",
    order: 5,
    prototype: true,
  },
  {
    slug: "automacao-operacoes",
    title: { pt: "Automação de Operações", en: "Operations Automation" },
    category: ["automation", "software"],
    servicesInvolved: ["Automação de processos", "Integrações", "APIs"],
    challenge: {
      pt: "Tarefas repetitivas e retrabalho consumindo o time todos os dias.",
      en: "Repetitive tasks and rework draining the team every day.",
    },
    built: {
      pt: "Fluxos automáticos que conectam as ferramentas e fazem a informação circular sozinha.",
      en: "Automatic flows connecting the tools so information moves on its own.",
    },
    outcome: {
      pt: "Arquitetura de automação conectando processos e sistemas.",
      en: "An automation architecture connecting processes and systems.",
    },
    outcomeType: "architecture",
    order: 6,
    prototype: true,
  },
];
