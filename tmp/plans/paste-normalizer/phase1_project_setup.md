# Phase 1: Project Setup

## Goal

Working TypeScript + Vitest + fast-check scaffold。
`npm test` が通る状態（tracer bullet 1 件 + PBT 1 件）まで整える。

## Root directory

`~/Documents/git/personal/paste-normalizer`

## Files to Create

### package.json

```json
{
  "name": "paste-normalizer",
  "displayName": "Paste Normalizer",
  "description": "Normalize pasted Claude output in the active editor",
  "version": "0.0.1",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "pasteNormalizer.normalizeClaudeOutput",
        "title": "Normalize Pasted Claude Output"
      }
    ]
  },
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "test": "vitest run",
    "test:watch": "vitest",
    "vscode:prepublish": "npm run compile"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "fast-check": "^3.15.0",
    "typescript": "^5.3.0",
    "vitest": "^2.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./out",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

### .vscode/launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

### .gitignore (append these lines to existing file)

```
node_modules/
out/
*.vsix
```

### src/normalizer.ts (stub)

```typescript
export function normalizeClaudeText(input: string): string {
  return input;
}
```

### src/**tests**/normalizer.test.ts (tracer bullet only)

```typescript
import { describe, expect, test } from "vitest";
import { normalizeClaudeText } from "../normalizer";

describe("normalizeClaudeText", () => {
  test("returns already-normalized text unchanged", () => {
    const input = "Hello world.\n\nSecond paragraph.\n";
    expect(normalizeClaudeText(input)).toBe(input);
  });
});
```

### src/**tests**/normalizer.pbt.test.ts (idempotency only)

```typescript
import { describe, expect, test } from "vitest";
import fc from "fast-check";
import { normalizeClaudeText } from "../normalizer";

describe("PBT: normalizeClaudeText", () => {
  test("is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const once = normalizeClaudeText(s);
        const twice = normalizeClaudeText(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 500 }
    );
  });
});
```

## Steps

1. Create all files listed above
2. Run: `npm install`
3. Run: `npm test`
4. Verify: tracer bullet PASSES, idempotency PBT PASSES (stub is identity = idempotent)
5. Commit: `"chore: scaffold VSCode extension with vitest and fast-check"`

## Success Criteria

- `npm test` exits with code 0
- 2 tests pass: tracer bullet + idempotency PBT
