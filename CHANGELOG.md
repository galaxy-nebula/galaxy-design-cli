# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-09-18

### Changed

- Renamed the npm package from `@galaxy-stack/design-cli` to
  `@galaxy-stack/nebula-cli` as part of the Galaxy Stack organization plan
  (galaxy design product line moves to the
  [galaxy-nebula](https://github.com/galaxy-nebula) organization).
- Renamed the CLI command from `galaxy-design` / `galaxy-ui-cli` to `nebula`.
- `@galaxy-stack/design-cli@0.3.1` and earlier are deprecated; they still work
  but print a deprecation notice pointing to this package.
- Repository metadata now points to the `galaxy-nebula` organization.

### Added

- `--theme` flag for `init` with `violet`, `green`, and `blue` presets, plus a
  theme-CSS builder and auto-registration-ready presets.

## [0.3.1] - 2026

### Added

- P1.4 rotation flow: digest warning and `update:registry-digest` release
  script.
- Registered `dashboard-block` in CLI registries (React 64, Vue 64, Angular 62).
- Combobox component; toast registered for React Native and Flutter.

### Changed

- P2.2 JS mode: SWC type stripping, `cssVariables: false`, prefix in scaffold;
  iconLibrary transform and `aliases.ui` handling; overwrite flag wired.

For releases before 0.3.1, see the repository git history.
