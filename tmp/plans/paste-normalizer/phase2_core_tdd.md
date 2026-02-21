# Phase 2: Core Normalizer — TDD Red-Green Cycles

## Goal

`normalizeClaudeText` の全 8 要件を TDD（vertical slices）で実装する。
各サイクル: テスト追加(RED) → 最小実装(GREEN) → 繰り返し。
全 GREEN 後にリファクタ。

## Root directory

`~/Documents/git/personal/paste-normalizer`

## Pre-condition

Phase 1 完了済み。`npm test` が通る状態から始める。

## Algorithm: normalizeClaudeText

### State Machine States

- `"NORMAL"`: 通常テキスト処理中
- `"CODE_BLOCK"`: triple backtick ブロック内（内容を保持）
- `"TABLE_BLOCK"`: ASCII 表罫線文字を含む行ブロック内

### Helper Predicates (module-level functions)

```typescript
const TABLE_CHARS = /[┌┐└┘─│├┤┬┴┼]/;

function isCodeFence(line: string): boolean {
  return /^`{3,}/.test(line.trimStart());
}

function isTableLine(line: string): boolean {
  return TABLE_CHARS.test(line);
}

function isHeading(line: string): boolean {
  return /^\s*#{1,6}(\s|$)/.test(line);
}

function isListItem(line: string): boolean {
  return /^\s*[-*+]\s/.test(line) || /^\s*\d+[.)]\s/.test(line);
}

function isBlank(line: string): boolean {
  return line.trim() === "";
}

function endsWithBreak(line: string): boolean {
  return /[.,:!?]\s*$/.test(line.trimEnd());
}

function startsWithLowercase(line: string): boolean {
  return /^[a-z]/.test(line.trimStart());
}
```

### Two-Pass Approach

1. **Pre-scan**: `computeCommonIndent(rawLines)` — コードブロック・表・空行を除く行の先頭スペース数の最小値
2. **State-machine pass**: 各行を状態に基づき変換して `outputLines` に積む
3. **Post-process**: `collapseBlankLines(outputLines)` — 3+連続空行 →2

### Helper Functions

```typescript
function computeCommonIndent(lines: string[]): number {
  let inCode = false;
  let min = Infinity;
  for (const line of lines) {
    if (isCodeFence(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode || isTableLine(line) || isBlank(line)) continue;
    const leading = line.match(/^( *)/)?.[1].length ?? 0;
    if (leading < min) min = leading;
  }
  return min === Infinity ? 0 : min;
}

function removeIndent(line: string, count: number): string {
  let i = 0,
    removed = 0;
  while (i < line.length && removed < count) {
    if (line[i] === " " || line[i] === "\t") {
      removed++;
      i++;
    } else break;
  }
  return line.slice(i);
}

function collapseBlankLines(lines: string[]): string[] {
  const result: string[] = [];
  let blanks = 0;
  for (const line of lines) {
    if (line === "") {
      blanks++;
      if (blanks <= 2) result.push("");
    } else {
      blanks = 0;
      result.push(line);
    }
  }
  return result;
}
```

### Full normalizeClaudeText Implementation

````typescript
export function normalizeClaudeText(input: string): string {
  // Step 0: CRLF → LF
  const text = input.replace(/\r\n/g, "\n");
  const rawLines = text.split("\n");

  // Step 1: pre-scan for common indent
  const commonIndent = computeCommonIndent(rawLines);

  // Step 2: state-machine pass
  type State = "NORMAL" | "CODE_BLOCK" | "TABLE_BLOCK";
  let state: State = "NORMAL";
  let openFence = "";
  const outputLines: string[] = [];

  for (const raw of rawLines) {
    // --- CODE_BLOCK ---
    if (state === "CODE_BLOCK") {
      outputLines.push(raw); // preserve as-is
      const trimmed = raw.trimStart();
      if (trimmed.startsWith(openFence) && /^`+\s*$/.test(trimmed)) {
        state = "NORMAL";
        openFence = "";
      }
      continue;
    }

    // --- TABLE_BLOCK ---
    if (state === "TABLE_BLOCK") {
      if (isTableLine(raw)) {
        outputLines.push(raw.trimEnd());
        continue;
      }
      state = "NORMAL"; // fall through
    }

    // --- NORMAL ---
    if (isCodeFence(raw)) {
      const trimmed = raw.trimStart();
      const m = trimmed.match(/^(`{3,})/);
      openFence = m ? m[1] : "```";
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

    // Normal text: remove common indent + trailing WS
    const processed = removeIndent(raw, commonIndent).trimEnd();

    // Reflow: join with previous output line if conditions met
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
````

## TDD Cycles (Vertical Slices)

Execute each cycle in order: write tests → RED → implement → GREEN → run `npm test`.

### Cycle 2: CRLF Normalization

Add to `src/__tests__/normalizer.test.ts`:

```typescript
test("converts CRLF to LF", () => {
  expect(normalizeClaudeText("line1\r\nline2")).toBe("line1\nline2");
});
test("converts mixed CRLF and LF", () => {
  expect(normalizeClaudeText("a\r\nb\nc")).toBe("a\nb\nc");
});
```

Add to `src/__tests__/normalizer.pbt.test.ts`:

```typescript
test("output never contains CRLF", () => {
  fc.assert(
    fc.property(fc.string(), (s) => {
      expect(normalizeClaudeText(s)).not.toMatch(/\r/);
    }),
    { numRuns: 500 }
  );
});
```

### Cycle 3: Trailing Whitespace

Add to `src/__tests__/normalizer.test.ts`:

```typescript
test("removes trailing whitespace from normal lines", () => {
  expect(normalizeClaudeText("hello   \nworld  ")).toBe("hello\nworld");
});
test("removes trailing whitespace from headings", () => {
  expect(normalizeClaudeText("# Title   ")).toBe("# Title");
});
```

### Cycle 4: Code Block Preservation

Add to `src/__tests__/normalizer.test.ts`:

````typescript
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
````

Add to `src/__tests__/normalizer.pbt.test.ts`:

````typescript
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
````

### Cycle 5: ASCII Table Preservation

Add to `src/__tests__/normalizer.test.ts`:

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

Add to `src/__tests__/normalizer.test.ts`:

````typescript
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
````

Add to `src/__tests__/normalizer.pbt.test.ts`:

```typescript
test("normalization never increases line count", () => {
  fc.assert(
    fc.property(fc.string(), (s) => {
      expect(normalizeClaudeText(s).split("\n").length).toBeLessThanOrEqual(
        s.split("\n").length
      );
    }),
    { numRuns: 500 }
  );
});
```

### Cycle 7: Heading Normalization

Add to `src/__tests__/normalizer.test.ts`:

````typescript
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
````

Add to `src/__tests__/normalizer.pbt.test.ts`:

````typescript
test("no heading in output starts with whitespace", () => {
  const noFenceArb = fc.string().filter((s) => !s.includes("```"));
  fc.assert(
    fc.property(noFenceArb, (s) => {
      for (const line of normalizeClaudeText(s).split("\n")) {
        if (/^#{1,6}(\s|$)/.test(line.trimStart())) {
          expect(line).not.toMatch(/^\s/);
        }
      }
    }),
    { numRuns: 300 }
  );
});
````

### Cycle 8: Blank Line Normalization

Add to `src/__tests__/normalizer.test.ts`:

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

Add to `src/__tests__/normalizer.pbt.test.ts`:

```typescript
test("output never has 3+ consecutive blank lines", () => {
  fc.assert(
    fc.property(fc.string(), (s) => {
      expect(normalizeClaudeText(s)).not.toMatch(/\n\n\n/);
    }),
    { numRuns: 500 }
  );
});
```

### Cycle 9: Paragraph Reflow

Add to `src/__tests__/normalizer.test.ts`:

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

Add to `src/__tests__/normalizer.pbt.test.ts`:

````typescript
test("no trailing whitespace outside code blocks", () => {
  const noFenceArb = fc.string().filter((s) => !s.includes("```"));
  fc.assert(
    fc.property(noFenceArb, (s) => {
      for (const line of normalizeClaudeText(s).split("\n")) {
        expect(line).toBe(line.trimEnd());
      }
    }),
    { numRuns: 300 }
  );
});
````

After this cycle, run ALL PBT tests (especially idempotency — reflow is the most error-prone).

### Cycle 10: Integration Test

Add to `src/__tests__/normalizer.test.ts`:

````typescript
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
````

## Refactor Phase (after all GREEN)

- Ensure all predicates and helpers are module-level named functions
- Run `npm test` after each refactor step
- No functional changes

## Steps

1. Execute Cycles 2-10 in order (write tests → RED → implement → GREEN)
2. Refactor
3. Run `npm test` — ALL tests and PBT must pass
4. Commit: `"feat: implement normalizeClaudeText with TDD"`

## Success Criteria

- `npm test` exits with code 0
- All unit tests (Cycles 2-10) pass
- All PBT properties pass
- idempotency PBT passes (most important invariant)
