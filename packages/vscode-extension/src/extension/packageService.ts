import * as https from 'https';
import * as http from 'http';
import * as zlib from 'zlib';
import * as path from 'path';
import { Readable } from 'stream';
import type { FileNode, PackageMetadata } from '../shared/types';

// ---------------------------------------------------------------------------
// Minimal fetch helper (uses Node built-in https — no node-fetch needed)
// ---------------------------------------------------------------------------

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
}

function fetchBuffer(url: string, options: FetchOptions = {}): Promise<{ status: number; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: options.method ?? 'GET', headers: options.headers ?? {} }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchBuffer(res.headers.location, options).then(resolve, reject);
        res.resume();
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, buffer: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<{ status: number; data: T }> {
  const { status, buffer } = await fetchBuffer(url, {
    ...options,
    headers: { 'Accept': 'application/json', ...(options.headers ?? {}) },
  });
  const text = buffer.toString('utf-8');
  try {
    return { status, data: JSON.parse(text) as T };
  } catch {
    throw new Error(`Invalid JSON from ${url} (status ${status}): ${text.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function fetchNpmMetadata(packageName: string): Promise<PackageMetadata> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
  const { status, data } = await fetchJson<any>(url);
  if (status !== 200) {
    throw new Error(`Package not found on npm: ${packageName} (${status})`);
  }
  const versions = Object.keys(data.versions || {}).reverse();
  const latestVersion: string = data['dist-tags']?.latest ?? versions[0];
  return {
    name: data.name,
    description: data.description ?? '',
    versions,
    latestVersion,
    registry: 'npm',
  };
}

export async function fetchGithubMetadata(packageName: string, token?: string): Promise<PackageMetadata> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'VSCode-PackageVisualizer/1.0',
  };
  if (token) { headers['Authorization'] = `Bearer ${token}`; }

  const normalized = packageName.startsWith('@') ? packageName.slice(1) : packageName;
  const [scope, pkg] = normalized.split('/');

  const tryUrl = async (url: string) => {
    const { status, data } = await fetchJson<any[]>(url, { headers });
    if (status === 200 && Array.isArray(data)) {
      return data.map((v: any) => v.name as string);
    }
    return null;
  };

  let versions =
    (await tryUrl(`https://api.github.com/orgs/${scope}/packages/npm/${pkg}/versions`)) ??
    (await tryUrl(`https://api.github.com/users/${scope}/packages/npm/${pkg}/versions`));

  if (!versions) {
    throw new Error(`Package not found on GitHub: ${packageName}`);
  }

  return {
    name: packageName,
    description: '',
    versions,
    latestVersion: versions[0],
    registry: 'github',
  };
}

// ---------------------------------------------------------------------------
// Tarball download + in-memory extraction
// ---------------------------------------------------------------------------

async function getTarballUrl(
  packageName: string,
  version: string,
  registry: 'npm' | 'github',
  token?: string
): Promise<{ tarballUrl: string; headers: Record<string, string> }> {
  const authHeaders: Record<string, string> = {
    'User-Agent': 'VSCode-PackageVisualizer/1.0',
  };
  if (token) { authHeaders['Authorization'] = `Bearer ${token}`; }

  if (registry === 'npm') {
    const { status, data } = await fetchJson<any>(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${version}`
    );
    if (status !== 200) { throw new Error(`Version ${version} not found for ${packageName}`); }
    return { tarballUrl: data.dist.tarball, headers: {} };
  } else {
    const normalized = packageName.startsWith('@') ? packageName : `@${packageName}`;
    const { status, data } = await fetchJson<any>(
      `https://npm.pkg.github.com/${normalized}`,
      { headers: authHeaders }
    );
    if (status !== 200) {
      throw new Error(`Package ${packageName} not found on GitHub registry (${status})`);
    }
    const tarballUrl: string | undefined = data.versions?.[version]?.dist?.tarball;
    if (!tarballUrl) {
      const available = Object.keys(data.versions ?? {}).slice(0, 5).join(', ');
      throw new Error(`No tarball for ${packageName}@${version}. Available: ${available}`);
    }
    return { tarballUrl, headers: authHeaders };
  }
}

// ---------------------------------------------------------------------------
// In-memory tar extraction using tar-stream
// ---------------------------------------------------------------------------

export interface InMemoryFile {
  path: string;
  content: Buffer;
  size: number;
}

async function extractTarGz(buffer: Buffer): Promise<InMemoryFile[]> {
  // Dynamically import tar-stream (bundled by esbuild)
  const tarStream = await import('tar-stream');

  return new Promise((resolve, reject) => {
    const files: InMemoryFile[] = [];
    const extract = tarStream.extract();

    extract.on('entry', (header: any, stream: any, next: () => void) => {
      if (header.type !== 'file') {
        stream.resume();
        next();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        const content = Buffer.concat(chunks);
        files.push({ path: header.name, content, size: content.length });
        next();
      });
      stream.on('error', reject);
    });

    extract.on('finish', () => resolve(files));
    extract.on('error', reject);

    // gunzip then pipe to tar extract
    const gunzip = zlib.createGunzip();
    gunzip.on('error', reject);

    const readable = Readable.from(buffer);
    readable.pipe(gunzip).pipe(extract);
  });
}

function normalizeFiles(files: InMemoryFile[]): InMemoryFile[] {
  // npm tarballs wrap everything in "package/" — strip that prefix if uniform
  const prefixes = new Set(files.map(f => f.path.split('/')[0]));
  const strip = prefixes.size === 1;
  if (!strip) { return files; }
  const prefix = [...prefixes][0] + '/';
  return files
    .map(f => ({ ...f, path: f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path }))
    .filter(f => f.path.length > 0);
}

function buildFileTree(files: InMemoryFile[]): FileNode {
  const root: FileNode = { name: '.', path: '.', type: 'directory', children: [] };
  const dirMap = new Map<string, FileNode>();
  dirMap.set('.', root);

  const ensureDir = (dirPath: string): FileNode => {
    if (dirMap.has(dirPath)) { return dirMap.get(dirPath)!; }
    const parentPath = dirPath.includes('/') ? dirPath.slice(0, dirPath.lastIndexOf('/')) : '.';
    const parent = ensureDir(parentPath);
    const node: FileNode = {
      name: path.basename(dirPath),
      path: dirPath,
      type: 'directory',
      children: [],
    };
    dirMap.set(dirPath, node);
    parent.children!.push(node);
    return node;
  };

  for (const file of files) {
    if (!file.path || file.path.endsWith('/')) { continue; }
    const dirPath = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : '.';
    const dir = ensureDir(dirPath);
    dir.children!.push({
      name: path.basename(file.path),
      path: file.path,
      type: 'file',
      size: file.size,
    });
  }

  // Sort: directories first, then alphabetically
  const sortNode = (node: FileNode) => {
    if (!node.children) { return; }
    node.children.sort((a, b) => {
      if (a.type !== b.type) { return a.type === 'directory' ? -1 : 1; }
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNode);
  };
  sortNode(root);

  return root;
}

// In-memory file cache: packageKey -> Map<filePath, content>
const fileCache = new Map<string, Map<string, string>>();

export function getCachedFile(packageKey: string, filePath: string): string | null {
  return fileCache.get(packageKey)?.get(filePath) ?? null;
}

export async function downloadAndExtractInMemory(
  packageName: string,
  version: string,
  registry: 'npm' | 'github',
  token?: string
): Promise<{ tree: FileNode; packageKey: string }> {
  const packageKey = `${packageName}@${version}`;

  // Return from cache if already extracted
  if (fileCache.has(packageKey)) {
    // Rebuild tree from cache
    const cache = fileCache.get(packageKey)!;
    const files: InMemoryFile[] = [...cache.entries()].map(([p, c]) => ({
      path: p,
      content: Buffer.from(c, 'utf-8'),
      size: Buffer.byteLength(c, 'utf-8'),
    }));
    return { tree: buildFileTree(files), packageKey };
  }

  const { tarballUrl, headers } = await getTarballUrl(packageName, version, registry, token);

  const { status, buffer } = await fetchBuffer(tarballUrl, { headers });
  if (status !== 200) {
    throw new Error(`Failed to download tarball (${status})`);
  }

  const rawFiles = await extractTarGz(buffer);
  const files = normalizeFiles(rawFiles);

  // Store text files in memory cache
  const pkgCache = new Map<string, string>();
  const BINARY_EXTS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'ico', 'woff', 'woff2',
    'ttf', 'eot', 'mp4', 'zip', 'gz', 'tgz', 'tar', 'bin',
  ]);

  for (const file of files) {
    const ext = file.path.split('.').pop()?.toLowerCase() ?? '';
    if (!BINARY_EXTS.has(ext) && file.size < 5 * 1024 * 1024) {
      pkgCache.set(file.path, file.content.toString('utf-8'));
    }
  }
  fileCache.set(packageKey, pkgCache);

  return { tree: buildFileTree(files), packageKey };
}
