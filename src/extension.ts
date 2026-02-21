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
