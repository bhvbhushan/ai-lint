# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **SvelteKit Preset**: Added official `presets.sveltekit` configuration to eliminate false-positive `undeclared-import` errors for SvelteKit's built-in aliases (`$lib`, `$app`, `$env`, `$service-worker`). (#42)
- Framework presets are now automatically exported from the main package entry point.

### Changed
- Improved `tsconfig` path resolution fallback logic for monorepo setups.

### Fixed
- Prevents `undeclared-import` from incorrectly flagging dynamic SvelteKit route parameters.
- Resolved configuration loading race condition in watch mode.

## [0.8.0] - 2024-05-15
...