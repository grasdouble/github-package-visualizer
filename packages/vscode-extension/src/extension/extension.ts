import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import {
  fetchNpmMetadata,
  fetchGithubMetadata,
  downloadAndExtractInMemory,
  getCachedFile,
} from './packageService';
import type {
  WebviewToExtensionMessage,
  ExtensionToWebviewMessage,
} from '../shared/types';

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function getGitHubToken(): Promise<string | undefined> {
  try {
    const session = await vscode.authentication.getSession(
      'github',
      ['read:packages'],
      { createIfNone: false }
    );
    return session?.accessToken;
  } catch {
    return undefined;
  }
}

async function ensureGitHubToken(): Promise<string | undefined> {
  try {
    const session = await vscode.authentication.getSession(
      'github',
      ['read:packages'],
      { createIfNone: true }
    );
    return session?.accessToken;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Temporary directory for read-only editor files
// ---------------------------------------------------------------------------

let tmpDir: string | undefined;

function getTmpDir(): string {
  if (!tmpDir) {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-visualizer-'));
  }
  return tmpDir;
}

// ---------------------------------------------------------------------------
// WebviewViewProvider — shown in the activity-bar sidebar panel
// ---------------------------------------------------------------------------

class PackageVisualizerViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'packageVisualizer.sidebar';

  private _view?: vscode.WebviewView;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this._context.extensionPath, 'dist')),
        vscode.Uri.file(path.join(this._context.extensionPath, 'media')),
      ],
    };

    webviewView.webview.html = getWebviewHtml(webviewView.webview, this._context);

    webviewView.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        await handleMessage(message, webviewView.webview, this._context);
      },
      undefined,
      this._context.subscriptions
    );
  }

  // Allow the open command to focus the view
  focus() {
    this._view?.show(true);
  }
}

// ---------------------------------------------------------------------------
// Message handler (shared logic)
// ---------------------------------------------------------------------------

async function handleMessage(
  message: WebviewToExtensionMessage,
  webview: vscode.Webview,
  _context: vscode.ExtensionContext
) {
  const send = (msg: ExtensionToWebviewMessage) => webview.postMessage(msg);

  switch (message.type) {
    case 'ready': {
      const token = await getGitHubToken();
      send({ type: 'authStatus', isAuthenticated: !!token });
      break;
    }

    case 'fetchMetadata': {
      try {
        let meta;
        if (message.registry === 'npm') {
          meta = await fetchNpmMetadata(message.name);
        } else {
          const token = await ensureGitHubToken();
          meta = await fetchGithubMetadata(message.name, token);
        }
        send({ type: 'metadataResult', metadata: meta });
      } catch (err: any) {
        send({ type: 'metadataError', error: err.message ?? String(err) });
      }
      break;
    }

    case 'downloadPackage': {
      try {
        let token: string | undefined;
        if (message.registry === 'github') {
          token = await ensureGitHubToken();
        }
        const { tree, packageKey } = await downloadAndExtractInMemory(
          message.name,
          message.version,
          message.registry,
          token
        );
        send({ type: 'downloadResult', tree, packageKey });
      } catch (err: any) {
        send({ type: 'downloadError', error: err.message ?? String(err) });
      }
      break;
    }

    case 'openInEditor': {
      try {
        const fileName = path.basename(message.filePath);
        const tmpPath = path.join(getTmpDir(), fileName);
        fs.writeFileSync(tmpPath, message.content, 'utf-8');
        const uri = vscode.Uri.file(tmpPath);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: false,
          preview: true,
        });
        // Make the document read-only via the editor decoration
        await vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `Package Visualizer: impossible d'ouvrir le fichier — ${err.message ?? err}`
        );
      }
      break;
    }

    case 'readFile': {
      try {
        const content = getCachedFile(message.packageKey, message.filePath);
        if (content === null) { throw new Error('File not found in cache'); }
        send({ type: 'fileContent', filePath: message.filePath, content });
      } catch (err: any) {
        send({ type: 'fileError', filePath: message.filePath, error: err.message ?? String(err) });
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Activate / deactivate
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext) {
  const provider = new PackageVisualizerViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PackageVisualizerViewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Keep the command so users can focus the panel from the command palette
  context.subscriptions.push(
    vscode.commands.registerCommand('packageVisualizer.open', () => {
      vscode.commands.executeCommand('packageVisualizer.sidebar.focus');
    })
  );
}

export function deactivate() {
  if (tmpDir) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// HTML shell
// ---------------------------------------------------------------------------

function getWebviewHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview.js'))
  );

  const cssPath = path.join(context.extensionPath, 'dist', 'webview.css');
  const inlineCss = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             script-src 'nonce-${nonce}';
             style-src 'unsafe-inline';
             img-src ${webview.cspSource} data: https:;
             font-src ${webview.cspSource};" />
  <title>Package Visualizer</title>
  <style>
    html, body, #root {
      height: 100%;
      width: 100%;
      max-width: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      color: var(--vscode-sideBar-foreground, var(--vscode-editor-foreground));
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    /* Prevent any child from blowing out the width */
    body { overflow-x: hidden; }
  </style>
  <style>${inlineCss}</style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
