import type { AbstractIntlMessages } from "next-intl";

/** Only namespaces read by Client Components cross the RSC boundary. Server
 * chapters and metadata still use the complete authored request catalogue.
 * Keep this list in sync with useTranslations in client components.
 */
export function clientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const studio = messages.studio as AbstractIntlMessages;
  return {
    nav: messages.nav,
    cta: messages.cta,
    lab: messages.lab,
    work: messages.work,
    contact: messages.contact,
    studio: { cards: studio.cards },
  };
}
