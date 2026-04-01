import type { WebviewToExtensionMessage, ExtensionToWebviewMessage } from '../../shared/types';

// VSCode webview API injected by the extension host
declare const acquireVsCodeApi: () => {
  postMessage: (message: WebviewToExtensionMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

// Singleton — acquireVsCodeApi() can only be called once
let _vscode: ReturnType<typeof acquireVsCodeApi> | null = null;
function getVscode() {
  if (!_vscode) { _vscode = acquireVsCodeApi(); }
  return _vscode;
}

export function postMessage(message: WebviewToExtensionMessage) {
  getVscode().postMessage(message);
}

type Listener = (message: ExtensionToWebviewMessage) => void;
const listeners: Listener[] = [];

window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as ExtensionToWebviewMessage;
  listeners.forEach(l => l(message));
});

export function onMessage(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) { listeners.splice(idx, 1); }
  };
}
