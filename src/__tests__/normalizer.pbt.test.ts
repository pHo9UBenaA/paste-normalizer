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

  // Cycle 2: CRLF PBT
  test("output never contains CRLF", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(normalizeClaudeText(s)).not.toMatch(/\r/);
      }),
      { numRuns: 500 }
    );
  });

  // Cycle 4: Code Block PBT
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

  // Cycle 6: Common Indent PBT
  test("normalization never increases line count", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(normalizeClaudeText(s).split("\n").length).toBeLessThanOrEqual(s.split("\n").length);
      }),
      { numRuns: 500 }
    );
  });

  // Cycle 7: Heading PBT
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

  // Cycle 8: Blank Line PBT
  test("output never has 4+ consecutive blank lines", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(normalizeClaudeText(s)).not.toMatch(/\n\n\n\n\n/);
      }),
      { numRuns: 500 }
    );
  });

  // Cycle 9: Trailing whitespace PBT
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
});
