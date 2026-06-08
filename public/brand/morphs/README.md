# Zirtuno Morph References

This folder contains the seven definitive service morph references.

Each category folder keeps the original PNG and its traced SVG endpoint together:

- `original/` keeps the owner-provided source image.
- `svg/` keeps the transparent cyan vector silhouette.
- `public/brand/forms/{key}.svg` mirrors the final SVGs for runtime SDF/glass rendering.

Trace settings:

- threshold: 34
- simplify tolerance: 1.15
- minimum contour area: 36
- fill: #00E3FE

| Order | Runtime key | Represents | Category folder | Runtime SVG |
|---|---|---|---|---|
| 01 | web | Web Design & Digital Experience | 01-web-design | public/brand/forms/web.svg |
| 02 | software | Software & App Development | 02-software-development | public/brand/forms/software.svg |
| 03 | ai | Artificial Intelligence | 03-ai | public/brand/forms/ai.svg |
| 04 | automation | Automation & Integrations | 04-automation | public/brand/forms/automation.svg |
| 05 | data | Data & Dashboards | 05-data | public/brand/forms/data.svg |
| 06 | branding | Branding & Positioning | 06-branding | public/brand/forms/branding.svg |
| 07 | marketing | Marketing & Growth | 07-marketing | public/brand/forms/marketing.svg |

Use `manifest.json` as the machine-readable map for AI/reference workflows.
