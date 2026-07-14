import type { Project } from "@/lib/sanity/types";

// TODO(decision): These are six concept studies for explicit local demo mode.
// They are never a production CMS fallback. Every entry is marked both as a
// prototype and a selected architecture so any consuming surface can fail
// safely. Replace them with owner-approved, verified content via Sanity.

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
      pt: "Proposta de uma plataforma única para conectar vendas, estoque e atendimento, com automações entre as ferramentas e um painel central de decisão.",
      en: "A proposal for one platform connecting sales, inventory, and service, with automations between tools and a central decision dashboard.",
    },
    outcome: {
      pt: "Proposta de ecossistema conectando operação, dados e atendimento.",
      en: "A proposed ecosystem connecting operations, data, and service.",
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
      pt: "Proposta de uma identidade coerente e um site para organizar serviços e agendamento em uma só experiência.",
      en: "A proposal for a coherent identity and a site organizing services and scheduling into one experience.",
    },
    outcome: {
      pt: "Direção de sistema para reunir marca e agendamento em uma presença única e clara.",
      en: "A system direction designed to unite brand and scheduling in one clear presence.",
    },
    outcomeType: "architecture",
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
      pt: "Proposta de um agente de IA integrado ao CRM para atender, qualificar e encaminhar contatos em fluxo contínuo.",
      en: "A proposal for an AI agent integrated with the CRM to serve, qualify, and route contacts continuously.",
    },
    outcome: {
      pt: "Proposta de atendimento inteligente conectado ao CRM.",
      en: "A proposed intelligent service flow connected to the CRM.",
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
      pt: "Proposta de um painel para reunir as fontes de dados do negócio em uma visão clara e atualizada.",
      en: "A proposal for a dashboard bringing the business's data sources into one clear, current view.",
    },
    outcome: {
      pt: "Direção de dados para reunir fontes dispersas em um só painel de decisão.",
      en: "A data direction designed to bring scattered sources into one decision dashboard.",
    },
    outcomeType: "architecture",
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
      pt: "Proposta de uma estrutura de aquisição e conteúdo conectada a dashboards de performance.",
      en: "A proposal for an acquisition and content structure connected to performance dashboards.",
    },
    outcome: {
      pt: "Proposta de crescimento conectada à estrutura digital.",
      en: "A proposed growth system connected to the digital structure.",
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
      pt: "Proposta de fluxos automáticos para conectar ferramentas e fazer a informação circular sem repasses manuais.",
      en: "A proposal for automated flows connecting tools so information moves without manual handoffs.",
    },
    outcome: {
      pt: "Proposta de automação conectando processos e sistemas.",
      en: "A proposed automation system connecting processes and platforms.",
    },
    outcomeType: "architecture",
    order: 6,
    prototype: true,
  },
];
