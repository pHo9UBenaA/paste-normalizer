# Phase 3: Extension Integration

## Goal

`normalizeClaudeText` を VSCode コマンドとして登録。TypeScript コンパイルが通ることを確認する。

## Root directory

`~/Documents/git/personal/paste-normalizer`

## Pre-condition

Phase 2 完了済み。`npm test` が全テスト通る状態から始める。

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

1. Create `src/extension.ts` as above
2. Run: `npm run compile`
   - TypeScript エラーがないことを確認
   - `out/` ディレクトリに `extension.js` と `normalizer.js` が生成されることを確認
3. Run: `npm test` — 全テストが引き続きパスすることを確認
4. Commit: `"feat: wire normalizeClaudeText into VSCode extension command"`

## Design Notes

- `extension.ts` はロジックを持たない薄いアダプタ
- VSCode の `vscode` 名前空間のモック化は行わない（脆弱なテストになるため）
- 全ロジックは `normalizer.ts` にあり、Phase 2 で完全にテスト済み
- `TextEditor.edit` の単一 replace により、undo が 1 ステップになる
- Extension Host での手動動作確認はユーザーが行う（F5 でデバッグ起動）

## Success Criteria

- `npm run compile` exits with code 0
- `out/extension.js` と `out/normalizer.js` が生成される
- `npm test` exits with code 0 (全テスト通過)
