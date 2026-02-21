# Paste Normalizer

Normalize pasted Claude (AI) output in the active editor.

## Features

### Remove Common Indentation

Pasted AI output often carries extra leading spaces introduced by the copy-paste context. The normalizer detects the minimum shared indentation across all non-code, non-table lines and strips it uniformly.

### Normalize Markdown Headings

Leading spaces before `#` headings are removed so headings render correctly in Markdown.

### Reflow Broken Paragraphs

Lines that were soft-wrapped by the AI output are rejoined: if a line does not end with `.`, `,`, `:`, `!`, `?` (plus Japanese `。`, `！`, `？`, `：`) and the next line looks like a wrapped continuation (lowercase start or residual indent), the two lines are joined with a single space.

### Preserve Fenced Code Blocks

Content inside triple-backtick fences is left completely untouched, including indentation and trailing whitespace.

### Preserve ASCII Table Blocks

Lines containing box-drawing characters (`┌ ┐ └ ┘ ─ │ ├ ┤ ┬ ┴ ┼`) are treated as a block and preserved as table text (including internal spacing), while shared leading indent for the table block is removed.

### Remove Trailing Whitespace

Trailing spaces and tabs are stripped from every non-code line.

### Normalize Blank Lines

Three or more consecutive blank lines are collapsed to two (except immediately after headings, where up to three blank lines are preserved).

### Normalize Line Endings

CRLF (`\r\n`) is converted to LF (`\n`).

## Commands

| Command | Description |
|---------|-------------|
| `Paste Normalizer: Normalize Pasted Claude Output` | Apply all normalizations to the entire active document |
