# Repository Guidelines

## Project Structure & Module Organization

This is a local two-player browser game built with TypeScript, Phaser 3, and Vite.
- `src/main.ts` connects the game scene, controls, and screens; `src/style.css` styles the interface.
- `src/rules.ts` holds gameplay rules; `src/journey.ts` manages character selection and readiness. Other modules handle characters, pets, backgrounds, and elemental effects.
- Unit tests live beside source files as `src/*.test.ts`.
- `public/` contains static assets and the service worker. `pics/` contains source artwork; `scripts/` contains asset preparation and browser QA utilities.
- `dist/` is generated build output; browser QA screenshots go to `artifacts/qa/`.

## Build, Test, and Development Commands

- `npm ci`: install dependencies from `package-lock.json`.
- `npm run dev`: start Vite; use the printed local or network URL. The server binds to all interfaces.
- `npm test`: run Node's built-in test runner with TypeScript type stripping. Use a Node version that supports `--experimental-strip-types`.
- `npm run build`: check strict TypeScript types, then build into `dist/`.
- `npm run preview`: serve the production build locally.
- `JOURNEY_QA_URL=http://localhost:5173 python scripts/qa_journey.py`: run browser smoke checks against a running development server; requires Python Playwright and Google Chrome.

## Coding Style & Naming Conventions

Follow nearby code: two-space TypeScript indentation, single-quoted strings, semicolons, camelCase functions and variables, PascalCase classes, and uppercase constants. Use lowercase, hyphenated module filenames where appropriate, such as `element-magic.ts`. Keep gameplay logic independently testable. No formatter or linter is configured; avoid unrelated formatting changes.

## Testing Guidelines

Use `node:test` and `node:assert/strict`, with descriptive behavior-based test names in `*.test.ts`. Cover changed rules and journey transitions, including edge cases. Run `npm test` and `npm run build` before submitting. For interface or animation changes, run browser QA and inspect phone and desktop screenshots. No coverage threshold is configured.

## Commit & Pull Request Guidelines

This checkout has no available Git history, so existing commit conventions cannot be verified. Use short, imperative subjects, such as `Fix readiness reset after retry`. Keep changes focused. Include a PR description, validation results, related issues when applicable, and screenshots for visual changes.

## Asset Changes

Consult `public/assets/ASSETS.md` and relevant asset documentation before regenerating sprites. Preserve atlas frame names, dimensions, and origins expected by the game. Retain source artwork and generation prompts for reproducibility; do not edit generated `dist/` files.
