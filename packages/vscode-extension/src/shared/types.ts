// Types partagés entre extension host et webview
export interface PackageMetadata {
  name: string;
  description: string;
  versions: string[];
  latestVersion: string;
  registry: 'npm' | 'github';
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
}

// Messages webview → extension
export type WebviewToExtensionMessage =
  | { type: 'fetchMetadata'; name: string; registry: 'npm' | 'github' }
  | { type: 'downloadPackage'; name: string; version: string; registry: 'npm' | 'github' }
  | { type: 'readFile'; packageKey: string; filePath: string }
  | { type: 'openInEditor'; filePath: string; content: string }
  | { type: 'ready' };

// Messages extension → webview
export type ExtensionToWebviewMessage =
  | { type: 'metadataResult'; metadata: PackageMetadata }
  | { type: 'metadataError'; error: string }
  | { type: 'downloadResult'; tree: FileNode; packageKey: string }
  | { type: 'downloadError'; error: string }
  | { type: 'fileContent'; filePath: string; content: string }
  | { type: 'fileError'; filePath: string; error: string }
  | { type: 'authStatus'; isAuthenticated: boolean; username?: string };
