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

export interface DownloadResult {
  success: boolean;
  cacheKey: string;
  tree: FileNode;
}
