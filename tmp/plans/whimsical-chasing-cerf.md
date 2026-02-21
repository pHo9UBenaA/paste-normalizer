# Plan: Paste Normalizer VSCode Extension

## Context

Claude Code などのAI出力をエディタに貼り付けると、不要なインデント・改行崩れ・余分な空行などが混入する。これを一括で正規化するVSCode拡張コマンド `normalizeClaudeOutput` を実装する。

実装方針：
- 純粋TypeScript関数 `normalizeClaudeText(input: string): string` を核心に置く
- TDDで全ての正規化ルールを検証
- PBTで冪等性・不変条件を保証
- 拡張のエントリポイントは薄いアダプタ（ロジックなし）

---

## Phase Structure

```
./tmp/plans/paste-normalizer/
    ├── phase1_project_setup.md
    ├── phase2_core_tdd.md
    └── phase3_extension_integration.md
```

**実装開始時の最初の作業**: 上記3つのフェーズファイルを以下のセクションの内容から作成し、各フェーズを独立した `general-purpose` サブエージェントで実行する。

---

## Phase 1: Project Setup

> ファイルパス: `./tmp/plans/paste-normalizer/phase1_project_setup.md`

```markdown
# Phase 1: Project Setup

## Goal
Working TypeScript + Vitest + fast-check scaffold。
`npm test` が通る状態（tracer bullet 1件 + PBT 1件）まで整える。

## Files to Create

### package.json
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
    "commands": [{
      "command": "pasteNormalizer.normalizeClaudeOutput",
      "title": "Normalize Pasted Claude Output"
    }]
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

### tsconfig.json
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

### vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});

### .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [{
    "name": "Run Extension",
    "type": "extensionHost",
    "request": "launch",
    "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
    "outFiles": ["${workspaceFolder}/out/**/*.js"],
    "preLaunchTask": "${defaultBuildTask}"
  }]
}

### .gitignore (append to existing)
node_modules/
out/
*.vsix

### src/normalizer.ts (stub)
export function normalizeClaudeText(input: string): string {
  return input;
}

### src/__tests__/normalizer.test.ts (tracer bullet only)
import { describe, expect, test } from "vitest";
import { normalizeClaudeText } from "../normalizer";

describe("normalizeClaudeText", () => {
  test("returns already-normalized text unchanged", () => {
    const input = "Hello world.\n\nSecond paragraph.\n";
    expect(normalizeClaudeText(input)).toBe(input);
  });
});

### src/__tests__/normalizer.pbt.test.ts (idempotency only)
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

## Steps
1. Create all files above
2. Run: npm install
3. Run: npm test
4. Verify: tracer bullet PASSES, idempotency PBT PASSES (stub is identity = idempotent)
5. Commit: "chore: scaffold VSCode extension with vitest and fast-check"
```

---

## Phase 2: Core Normalizer (TDD)

> ファイルパス: `./tmp/plans/paste-normalizer/phase2_core_tdd.md`

```markdown
# Phase 2: Core Normalizer — TDD Red-Green Cycles

## Goal
`normalizeClaudeText` の全8要件をTDD（vertical slices）で実装する。
各サイクル: テスト追加(RED) → 最小実装(GREEN) → 繰り返し。
全GREEN後にリファクタ。

## Algorithm Overview

### State Machine States
- NORMAL: 通常テキスト処理中
- CODE_BLOCK: triple backtick ブロック内（内容を保持）
- TABLE_BLOCK: ASCII表罫線文字を含む行ブロック内

### Helper Predicates
```typescript
const TABLE_CHARS = /[┌┐└┘─│├┤┬┴┼]/;
function isCodeFence(line: string): boolean { return /^(`{3,})/.test(line.trimStart()); }
function isTableLine(line: string): boolean { return TABLE_CHARS.test(line); }
function isHeading(line: string): boolean { return /^\s*#{1,6}\s/.test(line) || line.trimStart() === "#".repeat(line.trimStart().match(/^#+/)?.[0].length ?? 0); }
function isListItem(line: string): boolean { return /^\s*[-*+]\s/.test(line) || /^\s*\d+[.)]\s/.test(line); }
function isBlank(line: string): boolean { return line.trim() === ""; }
function endsWithBreak(line: string): boolean { return /[.,:!?]\s*$/.test(line.trimEnd()); }
function startsWithLowercase(line: string): boolean { return /^[a-z]/.test(line.trimStart()); }
```

### Two-Pass Processing
1. Pre-scan: `computeCommonIndent(lines)` — コードブロック・表・空行を除く行の最小インデント
2. State-machine pass: 各行を状態に基づき処理
3. Post-process: `collapseBlankLines(lines)` — 3+連続空行→2

### computeCommonIndent
コードブロック内・表行・空行を除く全行の先頭スペース数の最小値。

### normalizeClaudeText Full Implementation
```typescript
export function normalizeClaudeText(input: string): string {
  // Step 0: CRLF → LF
  const text = input.replace(/\r\n/g, "\n");
  const rawLines = text.split("\n");

  // Step 1: common indent pre-scan
  const commonIndent = computeCommonIndent(rawLines);

  // Step 2: state-machine pass
  type State = "NORMAL" | "CODE_BLOCK" | "TABLE_BLOCK";
  let state: State = "NORMAL";
  const outputLines: string[] = [];

  for (const raw of rawLines) {
    if (state === "CODE_BLOCK") {
      outputLines.push(raw); // preserve as-is (including trailing whitespace)
      if (isCodeFence(raw) && outputLines.filter(l => isCodeFence(l)).length % 2 === 0) {
        state = "NORMAL";
      }
      continue;
    }

    if (state === "TABLE_BLOCK") {
      if (isTableLine(raw)) {
        outputLines.push(raw.trimEnd());
        continue;
      }
      state = "NORMAL"; // fall through to NORMAL processing
    }

    // NORMAL state
    if (isCodeFence(raw)) {
      outputLines.push(raw.trimEnd());
      state = "CODE_BLOCK";
      continue;
    }

    if (isTableLine(raw)) {
      outputLines.push(raw.trimEnd());
      state = "TABLE_BLOCK";
      continue;
    }

    if (isBlank(raw)) {
      outputLines.push("");
      continue;
    }

    if (isHeading(raw)) {
      outputLines.push(raw.trimStart().trimEnd());
      continue;
    }

    // Normal text line: remove common indent, trim trailing WS
    let processed = removeIndent(raw, commonIndent).trimEnd();

    // Reflow: join with previous line if conditions met
    const lastIdx = outputLines.length - 1;
    if (
      lastIdx >= 0 &&
      !isBlank(outputLines[lastIdx]) &&
      !isHeading(outputLines[lastIdx]) &&
      !isListItem(outputLines[lastIdx]) &&
      !isCodeFence(outputLines[lastIdx]) &&
      !endsWithBreak(outputLines[lastIdx]) &&
      startsWithLowercase(processed) &&
      !isHeading(processed) &&
      !isListItem(processed)
    ) {
      outputLines[lastIdx] += " " + processed;
    } else {
      outputLines.push(processed);
    }
  }

  // Step 3: collapse blank lines
  return collapseBlankLines(outputLines).join("\n");
}
```

### CODE_BLOCK state transition (revised)
openingFenceで入り、次のclosing fenceで抜ける。
開いたfenceの文字数と閉じるfenceの文字数が一致するものを対応とする。

```typescript
// Revised: track opener to match closer
// state: "NORMAL" | { type: "CODE_BLOCK", fence: string } | "TABLE_BLOCK"
```

実装上は単純に「コードブロック内で isCodeFence(raw) が来たら NORMAL に戻る」で十分。
フェンスのネストは markdown の仕様上ないため。

## TDD Cycles (Vertical Slices)

### Cycle 2: CRLF Normalization
Tests to add to normalizer.test.ts:
```typescript
test("converts CRLF to LF", () => {
  expect(normalizeClaudeText("line1\r\nline2")).toBe("line1\nline2");
});
test("converts mixed CRLF and LF", () => {
  expect(normalizeClaudeText("a\r\nb\nc")).toBe("a\nb\nc");
});
```
Implementation: `input.replace(/\r\n/g, "\n")`
PBT to add: property 3 (no CRLF in output)

### Cycle 3: Trailing Whitespace
Tests:
```typescript
test("removes trailing whitespace from normal lines", () => {
  expect(normalizeClaudeText("hello   \nworld  ")).toBe("hello\nworld");
});
test("removes trailing whitespace from headings", () => {
  expect(normalizeClaudeText("# Title   ")).toBe("# Title");
});
```
Implementation: `.trimEnd()` on normal lines and headings.

### Cycle 4: Code Block Preservation
Tests:
```typescript
test("preserves content inside fenced code block", () => {
  const input = "```\n  indented code\n  more code\n```";
  expect(normalizeClaudeText(input)).toBe(input);
});
test("preserves trailing whitespace inside code block", () => {
  const input = "```\ncode with trailing   \n```";
  expect(normalizeClaudeText(input)).toBe(input);
});
test("normalizes text before and after code block independently", () => {
  const input = "  before\n```\n  code\n```\n  after";
  expect(normalizeClaudeText(input)).toBe("before\n```\n  code\n```\nafter");
});
test("handles unclosed code fence (EOF inside block)", () => {
  const input = "text\n```\n  code no close";
  expect(normalizeClaudeText(input)).toBe("text\n```\n  code no close");
});
test("handles language hint on code fence", () => {
  const input = "```typescript\nconst x = 1;\n```";
  expect(normalizeClaudeText(input)).toBe(input);
});
```
PBT to add: property 2 (code content preserved)

### Cycle 5: ASCII Table Preservation
Tests:
```typescript
test("preserves table block lines unchanged", () => {
  const table = "┌──┬──┐\n│a │b │\n└──┴──┘";
  expect(normalizeClaudeText(table)).toBe(table);
});
test("normalizes text surrounding a table block", () => {
  const input = "  intro\n┌──┐\n│x │\n└──┘\n  outro";
  expect(normalizeClaudeText(input)).toBe("intro\n┌──┐\n│x │\n└──┘\noutro");
});
```

### Cycle 6: Common Indentation Removal
Tests:
```typescript
test("removes uniform 2-space indent", () => {
  expect(normalizeClaudeText("  foo\n  bar")).toBe("foo\nbar");
});
test("removes minimum common indent when indentation varies", () => {
  expect(normalizeClaudeText("  foo\n    bar")).toBe("foo\n  bar");
});
test("does not remove indent from code block content", () => {
  const input = "  text\n```\n  code\n```";
  expect(normalizeClaudeText(input)).toBe("text\n```\n  code\n```");
});
test("blank lines do not affect common indent calculation", () => {
  expect(normalizeClaudeText("  foo\n\n  bar")).toBe("foo\n\nbar");
});
```
PBT to add: property 6 (line count monotonicity)

### Cycle 7: Heading Normalization
Tests:
```typescript
test("removes leading spaces from headings", () => {
  expect(normalizeClaudeText("   # Title")).toBe("# Title");
});
test("removes leading spaces from subheadings", () => {
  expect(normalizeClaudeText("  ## Sub")).toBe("## Sub");
});
test("does not touch heading-like content inside code block", () => {
  const input = "```\n   # not a heading\n```";
  expect(normalizeClaudeText(input)).toBe(input);
});
```
PBT to add: property 7 (heading structure preserved)

### Cycle 8: Blank Line Normalization
Tests:
```typescript
test("collapses 3 consecutive blank lines to 2", () => {
  expect(normalizeClaudeText("a\n\n\n\nb")).toBe("a\n\n\nb");
});
test("collapses 5 consecutive blank lines to 2", () => {
  expect(normalizeClaudeText("a\n\n\n\n\n\nb")).toBe("a\n\n\nb");
});
test("preserves exactly 2 consecutive blank lines", () => {
  expect(normalizeClaudeText("a\n\n\nb")).toBe("a\n\n\nb");
});
test("preserves exactly 1 blank line", () => {
  expect(normalizeClaudeText("a\n\nb")).toBe("a\n\nb");
});
```
PBT to add: property 4 (no 3+ consecutive blank lines)

### Cycle 9: Paragraph Reflow
Tests:
```typescript
test("joins line not ending in punctuation with next lowercase line", () => {
  expect(normalizeClaudeText("This is a broken\nparagraph line.")).toBe(
    "This is a broken paragraph line."
  );
});
test("does not join when first line ends with period", () => {
  expect(normalizeClaudeText("First sentence.\nSecond sentence.")).toBe(
    "First sentence.\nSecond sentence."
  );
});
test("does not join when next line starts with uppercase", () => {
  expect(normalizeClaudeText("some text\nNew sentence.")).toBe(
    "some text\nNew sentence."
  );
});
test("does not reflow into a heading", () => {
  expect(normalizeClaudeText("some text\n# Heading")).toBe(
    "some text\n# Heading"
  );
});
test("does not reflow into a list item", () => {
  expect(normalizeClaudeText("some text\n- item")).toBe("some text\n- item");
});
test("does not reflow out of a heading", () => {
  expect(normalizeClaudeText("# Title\ncontinuation")).toBe(
    "# Title\ncontinuation"
  );
});
test("does not reflow across blank line", () => {
  expect(normalizeClaudeText("broken line\n\ncontinuation")).toBe(
    "broken line\n\ncontinuation"
  );
});
test("reflows multiple consecutive broken lines", () => {
  expect(
    normalizeClaudeText("This is a broken\nline that continues\nand ends here.")
  ).toBe("This is a broken line that continues and ends here.");
});
test("line ending with comma does not trigger reflow", () => {
  expect(normalizeClaudeText("first part,\ncontinued.")).toBe(
    "first part,\ncontinued."
  );
});
```
Run all PBT after this cycle (especially idempotency — reflow is the most error-prone).

### Cycle 10: Integration
Test:
```typescript
test("processes real Claude output with multiple features", () => {
  const input = [
    "  # Overview   ",
    "",
    "  This is a broken",
    "  paragraph that spans",
    "  multiple lines.",
    "",
    "  ```typescript",
    "  const x = 1;   ",
    "  ```",
    "",
    "  ┌────┬────┐",
    "  │ A  │ B  │",
    "  └────┴────┘",
    "",
    "",
    "",
    "  Final paragraph.",
  ].join("\n");

  const expected = [
    "# Overview",
    "",
    "This is a broken paragraph that spans multiple lines.",
    "",
    "```typescript",
    "  const x = 1;   ",
    "```",
    "",
    "┌────┬────┐",
    "│ A  │ B  │",
    "└────┴────┘",
    "",
    "",
    "Final paragraph.",
  ].join("\n");

  expect(normalizeClaudeText(input)).toBe(expected);
});
```

### PBT Properties (src/__tests__/normalizer.pbt.test.ts)

Add in order as cycles progress:

Property 2: Code content preserved
```typescript
test("content between backtick fences is never modified", () => {
  const codeContentArb = fc.string().filter((s) => !s.includes("```"));
  fc.assert(
    fc.property(codeContentArb, (content) => {
      const input = `\`\`\`\n${content}\n\`\`\``;
      const result = normalizeClaudeText(input);
      expect(result).toContain(content);
    }),
    { numRuns: 300 }
  );
});
```

Property 3: No CRLF in output
```typescript
test("output never contains CRLF", () => {
  fc.assert(
    fc.property(fc.string(), (s) => {
      const result = normalizeClaudeText(s);
      expect(result).not.toMatch(/\r/);
    }),
    { numRuns: 500 }
  );
});
```

Property 4: No 3+ consecutive blank lines
```typescript
test("output never has 3+ consecutive blank lines", () => {
  fc.assert(
    fc.property(fc.string(), (s) => {
      const result = normalizeClaudeText(s);
      expect(result).not.toMatch(/\n\n\n/);
    }),
    { numRuns: 500 }
  );
});
```

Property 5: No trailing whitespace outside code blocks
```typescript
test("no trailing whitespace outside code blocks", () => {
  const noFenceArb = fc.string().filter((s) => !s.includes("```"));
  fc.assert(
    fc.property(noFenceArb, (s) => {
      const lines = normalizeClaudeText(s).split("\n");
      for (const line of lines) {
        expect(line).toBe(line.trimEnd());
      }
    }),
    { numRuns: 300 }
  );
});
```

Property 6: Line count monotonicity
```typescript
test("normalization never increases line count", () => {
  fc.assert(
    fc.property(fc.string(), (s) => {
      const inputCount = s.split("\n").length;
      const outputCount = normalizeClaudeText(s).split("\n").length;
      expect(outputCount).toBeLessThanOrEqual(inputCount);
    }),
    { numRuns: 500 }
  );
});
```

Property 7: Headings not indented
```typescript
test("no heading in output starts with whitespace", () => {
  const noFenceArb = fc.string().filter((s) => !s.includes("```"));
  fc.assert(
    fc.property(noFenceArb, (s) => {
      const lines = normalizeClaudeText(s).split("\n");
      for (const line of lines) {
        if (/^#{1,6}\s/.test(line.trimStart())) {
          expect(line).not.toMatch(/^\s/);
        }
      }
    }),
    { numRuns: 300 }
  );
});
```

## Refactor Phase (after all GREEN)
- Extract all predicates (`isCodeFence`, `isTableLine`, etc.) as named exported functions if beneficial for readability
- Extract `computeCommonIndent`, `removeIndent`, `collapseBlankLines` as module-level functions
- Run all tests after each extraction
- No functional changes

## Steps
1. For each cycle 2-10: write tests (RED) → implement (GREEN) → verify PBT
2. Refactor
3. Final: `npm test` — all unit tests and PBT must pass
4. Commit: "feat: implement normalizeClaudeText with TDD"
```

---

## Phase 3: VSCode Extension Integration

> ファイルパス: `./tmp/plans/paste-normalizer/phase3_extension_integration.md`

```markdown
# Phase 3: Extension Integration

## Goal
`normalizeClaudeText` をVSCodeコマンドとして登録。Extension Hostで動作確認。

## Files to Create

### src/extension.ts
```typescript
import * as vscode from "vscode";
import { normalizeClaudeText } from "./normalizer";

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    "pasteNormalizer.normalizeClaudeOutput",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor.");
        return;
      }
      const doc = editor.document;
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(doc.getText().length)
      );
      const normalized = normalizeClaudeText(doc.getText());
      await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, normalized);
      });
    }
  );
  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
```

## Steps
1. Create `src/extension.ts` above
2. Run: `npm run compile` → TypeScriptエラーがないことを確認
3. F5 (または launch.json "Run Extension") でExtension Hostを起動
4. 適当なテキストファイルを開く
5. コマンドパレット (Cmd+Shift+P) → "Normalize Pasted Claude Output" を実行
6. ドキュメント全体が正規化されることを確認
7. Ctrl+Z でアンドゥ → 1ステップで元に戻ることを確認
8. Commit: "feat: wire normalizeClaudeText into VSCode extension command"

## Design Notes
- `extension.ts` はロジックを持たない薄いアダプタ
- VSCode の `vscode` 名前空間のモック化は行わない（脆弱なテストになるため）
- 全ロジックは `normalizer.ts` にあり、Phase 2 で完全にテスト済み
- `TextEditor.edit` の単一 replace により、undo が1ステップになる
```

---

## Critical Files

| File | Purpose |
|------|---------|
| `src/normalizer.ts` | Core logic: state machine, predicates, helpers |
| `src/__tests__/normalizer.test.ts` | TDD unit tests (Cycles 2-10) |
| `src/__tests__/normalizer.pbt.test.ts` | PBT properties (idempotency, invariants) |
| `src/extension.ts` | Thin VSCode adapter |
| `package.json` | Extension manifest + test scripts |
| `tsconfig.json` | TypeScript config (commonjs, ES2022) |

## Verification

```bash
# Unit tests + PBT
npm test

# TypeScript compile check
npm run compile

# Extension Host: F5 in VSCode
# → Command palette → "Normalize Pasted Claude Output"
# → Verify document is normalized
# → Ctrl+Z → single undo step restores original
```
