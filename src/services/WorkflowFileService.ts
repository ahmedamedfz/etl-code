import * as vscode from 'vscode';

export class WorkflowFileService {
  static async pickFile(
    title?: string,
    extensions?: string[]
  ): Promise<string | undefined> {
    const filters: Record<string, string[]> = {};

    if (extensions && extensions.length > 0) {
      filters['Files'] = extensions.map((ext) => (ext.startsWith('.') ? ext.slice(1) : ext));
    }

    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Select',
      title: title || 'Select file',
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    });

    return uris?.[0]?.fsPath;
  }

  static async readWorkflowJsonFile(): Promise<unknown | undefined> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Import',
      title: 'Import workflow JSON',
      filters: { JSON: ['json'] },
    });

    const uri = uris?.[0];
    if (!uri) {
      return undefined;
    }

    const raw = await vscode.workspace.fs.readFile(uri);
    const text = Buffer.from(raw).toString('utf8');
    return JSON.parse(text);
  }
}
