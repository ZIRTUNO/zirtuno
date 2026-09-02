# 0002 — Repository layout

- **Status:** accepted
- **Date:** 2026-09-02

## Context

The project grew from a Create Next App scaffold through roughly a hundred
commits of feature work. Two areas accumulated flat:

- **`scripts/`** held 86 files in one directory. The naming convention
  (`verify-*`, `capture-*`, `probe-*`) was carrying the organisation on its own.
- **The repository root** held seven specification documents totalling about
  200 KB, alongside the configuration files. A reader landing on the root could
  not tell at a glance what was project structure and what was documentation.

Both were workable at the time and would not have scaled.

## Decision

### Top level holds configuration and entry points only

```
app/            Next.js routes (locale-segmented)
components/     UI, grouped by domain: chapters, chrome, field, lab, motion, work
lib/            engine and data: webgl, animation, motion, content, i18n, forms, sanity
public/         shipped static assets, including brand marks
references/     morph reference set consumed by tooling, not shipped
scripts/        development and verification tooling
docs/           specifications, decisions, QA notes, archive
.github/        CI and collaboration templates
AGENTS.md       working rules and verification protocol
```

### `scripts/` is grouped by verb

| Directory | Holds | Naming |
| --- | --- | --- |
| `scripts/verify/` | pass/fail gates | prefix dropped: `verify-a11y.mjs` → `verify/a11y.mjs` |
| `scripts/capture/` | screenshot and filmstrip harnesses | prefix dropped; `record-*` keeps its name, since recording is not screenshotting |
| `scripts/probe/` | diagnostics and one-off investigations | prefix dropped |
| `scripts/tools/` | generators and asset pipelines | full names kept — the directory holds several verbs |
| `scripts/support/` | shared modules imported by the above | — |
| `scripts/fixtures/` | committed baselines (`postfx-baseline.json`, `rest-exact.json`) | — |

The directory carries the verb, so the filename carries only the subject. This
replaces the `_` prefix, which had been doing two contradictory jobs: marking
disposable scratch (`_probe-cls.mjs`) and marking load-bearing shared modules
(`_launch.mjs`, imported by 41 scripts).

### The shared directory is `support/`, not `lib/`

Scripts import the application's engine with `../../lib/webgl/…`. Naming the
shared script directory `scripts/lib/` would make a stale `../lib/…` reference
resolve successfully to the wrong directory instead of failing loudly. A path
that silently resolves to the wrong file is a worse failure mode than one that
throws, so the name avoids the collision entirely.

### Documentation lives under `docs/`

```
docs/specs/       build, metaball-morph, field-liquid, cta-membrane, entry-intro
docs/decisions/   these records
docs/design-qa.md
docs/references.md
docs/archive/     superseded plans, kept for provenance
```

`README.md` and `AGENTS.md` stay at the root, where both are conventionally
looked for.

## Consequences

- Scripts resolve the project root as `path.join(__dirname, "..", "..")`. A new
  script placed directly in `scripts/` would need one `..`, so put new scripts
  in the subdirectory that matches their verb.
- `package.json` script entries, and every path in `AGENTS.md` and `docs/`, were
  rewritten in the same commit as the move, so no reference points at the old
  flat layout.
- Adding a gate means adding a file to `scripts/verify/` and, if it should run
  routinely, a `package.json` entry. Nothing else needs to change.

## See also

[0001 — Retire the dead-code quarantine folder](0001-dead-code-quarantine.md)
