# Changelog

All notable changes to **@galaxy-stack/nebula-cli** (formerly `@galaxy-stack/design-cli`, formerly `galaxy-design`) are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] — 2026-09-19

Nebula milestone — first stable major release.

### Changed — BREAKING

- Package renamed: `@galaxy-stack/design-cli` → **`@galaxy-stack/nebula-cli`**
- Command renamed: `galaxy-design` / `galaxy-ui-cli` → **`nebula`**
- Repository moved to the **galaxy-nebula** GitHub organization

### Added

- `--theme <name>` flag for `init` — theme presets: `default`, `violet`, `green`, `blue`
- `--overwrite` flag for `add` (backs up existing files to `.galaxy/backups/`)
- `--registry-url <url>` for `add` — fetch from a versioned, integrity-verified registry CDN
- `list`, `doctor`, `diff`, `update` commands
- `migrate tailwind` command (`--dry-run`, `--yes`, `--cwd`) — Tailwind v3 → v4 migration
- Icon library transform (lucide → heroicons / radix-icons)
- JS mode (`typescript: false`) via SWC transform

### Fixed

- Framework registry integrity — 62 canonical manifests validated against real source files
- Tailwind v3/v4 compatibility matrix (all 14 fixture tests pass)

### Migration from 0.3.1

```bash
npm uninstall -g @galaxy-stack/design-cli
npm install -g @galaxy-stack/nebula-cli
nebula init
```

## [0.3.1] — 2026-09-17

- Scoped package: `galaxy-design` → `@galaxy-stack/design-cli`
- `--overwrite` + `--registry-url` for `add`
- Registry integrity verification (sha256 + digest)

## [0.3.0] — 2026-09-16

- Multi-framework registry sync from canonical manifests
- `list`, `doctor`, `diff`, `update` commands
- Tailwind v4 target support + migration plan
- Registry CDN distribution via Vercel

## [0.2.x]

- Core `init` / `add` / `migrate tailwind` flows, 5-framework support, registry manifest system.

[1.0.0]: https://github.com/galaxy-nebula/galaxy-design-cli/releases/tag/v1.0.0
[0.3.1]: https://www.npmjs.com/package/@galaxy-stack/design-cli
