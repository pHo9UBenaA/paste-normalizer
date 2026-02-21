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
  return /[.,:!?。！？：]\s*$/.test(line.trimEnd());
}

function startsWithLowercase(line: string): boolean {
  return /^[a-z]/.test(line.trimStart());
}

function leadingIndentWidth(line: string): number {
  return line.match(/^[ \t]*/)?.[0].length ?? 0;
}

function shouldJoinWithoutSpace(previous: string, next: string): boolean {
  const prevTrimmed = previous.trimEnd();
  return (
    /[、。！？：]/.test(prevTrimmed) &&
    /[A-Za-z0-9]$/.test(prevTrimmed) &&
    /^[A-Za-z0-9]/.test(next)
  );
}

function computeCommonIndent(lines: string[]): number {
  let inCode = false;
  let min = Infinity;
  for (const line of lines) {
    if (isCodeFence(line)) { inCode = !inCode; continue; }
    if (inCode || isTableLine(line) || isBlank(line)) continue;
    const leading = line.match(/^( *)/)?.[1].length ?? 0;
    if (leading < min) min = leading;
  }
  return min === Infinity ? 0 : min;
}

function removeIndent(line: string, count: number): string {
  let i = 0, removed = 0;
  while (i < line.length && removed < count) {
    if (line[i] === " " || line[i] === "\t") { removed++; i++; }
    else break;
  }
  return line.slice(i);
}

function collapseBlankLines(lines: string[]): string[] {
  const result: string[] = [];
  let blanks = 0;
  let previousNonBlank = "";
  for (const line of lines) {
    if (line === "") {
      blanks++;
      const maxBlanks = isHeading(previousNonBlank) ? 3 : 2;
      if (blanks <= maxBlanks) result.push("");
    } else {
      blanks = 0;
      previousNonBlank = line;
      result.push(line);
    }
  }
  return result;
}

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
  let tableIndent = 0;
  const outputLines: string[] = [];

  for (const raw of rawLines) {
    // --- CODE_BLOCK ---
    if (state === "CODE_BLOCK") {
      const trimmed = raw.trimStart();
      // Exit when we see the closing fence (starts with openFence, rest is only whitespace)
      if (trimmed.startsWith(openFence) && /^`+\s*$/.test(trimmed)) {
        // Closing fence: dedent like normal, don't preserve raw
        outputLines.push(removeIndent(raw, commonIndent).trimEnd());
        state = "NORMAL";
        openFence = "";
      } else {
        outputLines.push(raw); // preserve as-is (including trailing whitespace)
      }
      continue;
    }

    // --- TABLE_BLOCK ---
    if (state === "TABLE_BLOCK") {
      if (isTableLine(raw)) {
        const tableLine = removeIndent(raw, commonIndent).trimEnd();
        outputLines.push(removeIndent(tableLine, tableIndent));
        continue;
      }
      state = "NORMAL";
      tableIndent = 0; // fall through
    }

    // --- NORMAL ---
    if (isCodeFence(raw)) {
      const trimmed = raw.trimStart();
      const m = trimmed.match(/^(`{3,})/);
      openFence = m ? m[1] : "```";
      outputLines.push(removeIndent(raw, commonIndent).trimEnd());
      state = "CODE_BLOCK";
      continue;
    }

    if (isTableLine(raw)) {
      const tableLine = removeIndent(raw, commonIndent).trimEnd();
      tableIndent = tableLine.match(/^[ \t]*/)?.[0].length ?? 0;
      outputLines.push(removeIndent(tableLine, tableIndent));
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
    const processedForJoin = processed.trimStart();

    // Reflow: join with previous output line if conditions met
    const lastIdx = outputLines.length - 1;
    const indentWidth = leadingIndentWidth(processed);
    const looksIndentedContinuation =
      indentWidth >= 4 ||
      (indentWidth > 0 &&
        (outputLines[lastIdx]?.includes(" ") || outputLines[lastIdx]?.length >= 20));
    if (
      lastIdx >= 0 &&
      !isBlank(outputLines[lastIdx]) &&
      !isHeading(outputLines[lastIdx]) &&
      !isListItem(outputLines[lastIdx]) &&
      !isCodeFence(outputLines[lastIdx]) &&
      !endsWithBreak(outputLines[lastIdx]) &&
      (
        (startsWithLowercase(processedForJoin) &&
          outputLines[lastIdx].includes(" ")) ||
        looksIndentedContinuation
      ) &&
      !isHeading(processedForJoin) &&
      !isListItem(processedForJoin)
    ) {
      const separator = shouldJoinWithoutSpace(
        outputLines[lastIdx],
        processedForJoin
      )
        ? ""
        : " ";
      outputLines[lastIdx] += separator + processedForJoin;
    } else {
      const prev = outputLines[lastIdx];
      const isParagraphStart =
        lastIdx < 0 ||
        isBlank(prev) ||
        isHeading(prev) ||
        isCodeFence(prev) ||
        isTableLine(prev);
      outputLines.push(isParagraphStart ? processed.trimStart() : processed);
    }
  }

  // Step 3: collapse blank lines
  return collapseBlankLines(outputLines).join("\n");
}
