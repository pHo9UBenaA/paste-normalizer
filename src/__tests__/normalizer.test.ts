import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeClaudeText } from "../normalizer";

describe("normalizeClaudeText", () => {
  test("returns already-normalized text unchanged", () => {
    const input = "Hello world.\n\nSecond paragraph.\n";
    expect(normalizeClaudeText(input)).toBe(input);
  });

  // Cycle 2: CRLF Normalization
  test("converts CRLF to LF", () => {
    expect(normalizeClaudeText("line1\r\nline2")).toBe("line1\nline2");
  });
  test("converts mixed CRLF and LF", () => {
    expect(normalizeClaudeText("a\r\nb\nc")).toBe("a\nb\nc");
  });

  // Cycle 3: Trailing Whitespace
  test("removes trailing whitespace from normal lines", () => {
    expect(normalizeClaudeText("hello   \nworld  ")).toBe("hello\nworld");
  });
  test("removes trailing whitespace from headings", () => {
    expect(normalizeClaudeText("# Title   ")).toBe("# Title");
  });

  // Cycle 4: Code Block Preservation
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

  // Cycle 5: ASCII Table Preservation
  test("preserves table block lines unchanged", () => {
    const table = "┌──┬──┐\n│a │b │\n└──┴──┘";
    expect(normalizeClaudeText(table)).toBe(table);
  });
  test("normalizes text surrounding a table block", () => {
    const input = "  intro\n┌──┐\n│x │\n└──┘\n  outro";
    expect(normalizeClaudeText(input)).toBe("intro\n┌──┐\n│x │\n└──┘\noutro");
  });

  // Cycle 6: Common Indentation Removal
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

  // Cycle 7: Heading Normalization
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

  // Cycle 8: Blank Line Normalization
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
  test("preserves 3 blank lines right after a heading", () => {
    expect(normalizeClaudeText("### Title\n\n\n\nbody")).toBe(
      "### Title\n\n\n\nbody"
    );
  });

  // Cycle 9: Paragraph Reflow
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

  // Cycle 10: Integration Test
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

  test("matches expected output for real markdown fixture in assets", () => {
    const input = readFileSync(
      join(__dirname, "assets", "real_case_input.md"),
      "utf8"
    );
    const expected = readFileSync(
      join(__dirname, "assets", "real_case_expected.md"),
      "utf8"
    );
    expect(normalizeClaudeText(input)).toBe(expected);
  });
});
