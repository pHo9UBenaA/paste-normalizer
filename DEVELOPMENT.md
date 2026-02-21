# Development

## Setup

```sh
npm install
```

## Build

```sh
npm run compile        # production build
npm run watch          # development build (watch mode)
```

## Test

```sh
npm test               # run tests once
npm run test:watch     # run tests in watch mode
```

## Debug

1. Open this folder in VSCode
2. Press F5 (or Cmd+Shift+P → "Debug: Start Debugging")
3. Extension Development Host opens — open any text file and run "Paste Normalizer: Normalize Pasted Claude Output" from the command palette

## Package & Install

```sh
npm run package
code --install-extension paste-normalizer-0.0.2.vsix --force
```

## Project Structure

```
src/
  extension.ts              # Entry point, command registration
  normalizer.ts             # Pure: normalizeClaudeText state machine
src/__tests__/
  normalizer.test.ts        # Unit tests (TDD vertical slices)
  normalizer.pbt.test.ts    # Property-based tests (fast-check)
```

Architecture: **pure-core / imperative-shell** — all normalization logic lives in `src/normalizer.ts` as a pure function with zero VSCode dependency. `src/extension.ts` is a thin adapter that wires the command to the normalizer.
