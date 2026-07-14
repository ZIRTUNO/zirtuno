// GROQ queries (S7). Localized fields are stored as { pt, en } objects to match
// the seed shape, so results map directly onto the Project type.

const projectFields = `
  "slug": slug.current,
  title,
  category,
  servicesInvolved,
  challenge,
  built,
  outcome,
  outcomeType,
  credits,
  liveUrl,
  featured,
  order,
  "previewImage": previewMedia.asset->url,
  "riveExperience": select(
    defined(riveExperience.file.asset) &&
    defined(riveExperience.title.pt) &&
    defined(riveExperience.title.en) &&
    defined(riveExperience.description.pt) &&
    defined(riveExperience.description.en) => {
      "src": riveExperience.file.asset->url,
      "artboard": riveExperience.artboard,
      "stateMachine": riveExperience.stateMachine,
      "title": riveExperience.title,
      "description": riveExperience.description,
      "posterImage": riveExperience.poster.asset->url
    }
  )
`;

export const allProjectsQuery = `*[_type == "project"] | order(order asc) { ${projectFields} }`;

export const featuredProjectsQuery = `*[_type == "project" && featured == true] | order(order asc) { ${projectFields} }`;

export const projectBySlugQuery = `*[_type == "project" && slug.current == $slug][0] { ${projectFields} }`;

export const projectSlugsQuery = `*[_type == "project" && defined(slug.current)].slug.current`;
