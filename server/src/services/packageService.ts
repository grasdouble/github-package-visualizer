import fetch from 'node-fetch';
import * as tar from 'tar';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CACHE_DIR = path.join(os.tmpdir(), 'pkg-visualizer-cache');

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

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export async function fetchNpmMetadata(packageName: string): Promise<PackageMetadata> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Package not found on npm: ${packageName}`);
  const data = await res.json() as any;

  const versions = Object.keys(data.versions || {}).reverse();
  const latestVersion = data['dist-tags']?.latest || versions[0];

  return {
    name: data.name,
    description: data.description || '',
    versions,
    latestVersion,
    registry: 'npm',
  };
}

export async function fetchGithubMetadata(packageName: string, token?: string): Promise<PackageMetadata> {
  // packageName format: @scope/package or owner/package
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Normalize: @scope/package -> scope/package for GitHub
  const normalized = packageName.startsWith('@') ? packageName.slice(1) : packageName;
  const [scope, pkg] = normalized.split('/');

  const url = `https://api.github.com/orgs/${scope}/packages/npm/${pkg}/versions`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    // Try user packages
    const userUrl = `https://api.github.com/users/${scope}/packages/npm/${pkg}/versions`;
    const userRes = await fetch(userUrl, { headers });
    if (!userRes.ok) throw new Error(`Package not found on GitHub: ${packageName}`);
    const data = await userRes.json() as any[];
    const versions = data.map((v: any) => v.name);
    return {
      name: packageName,
      description: '',
      versions,
      latestVersion: versions[0],
      registry: 'github',
    };
  }

  const data = await res.json() as any[];
  const versions = data.map((v: any) => v.name);
  return {
    name: packageName,
    description: '',
    versions,
    latestVersion: versions[0],
    registry: 'github',
  };
}

export async function downloadAndExtract(
  packageName: string,
  version: string,
  registry: 'npm' | 'github',
  token?: string
): Promise<string> {
  ensureCacheDir();

  const safeName = packageName.replace(/[/@]/g, '-').replace(/^-/, '');
  const extractDir = path.join(CACHE_DIR, `${safeName}@${version}`);

  if (fs.existsSync(extractDir) && fs.readdirSync(extractDir).length > 0) {
    return extractDir;
  }

  // Clean up potentially empty dir from a previous failed attempt
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }

  fs.mkdirSync(extractDir, { recursive: true });

  let tarballUrl: string;
  const headers: Record<string, string> = {};

  try {
    if (registry === 'npm') {
      const metaUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${version}`;
      const res = await fetch(metaUrl);
      if (!res.ok) throw new Error(`Version ${version} not found for ${packageName}`);
      const data = await res.json() as any;
      tarballUrl = data.dist.tarball;
    } else {
      // GitHub registry: fetch full package metadata (without version) to get tarball URL
      const normalized = packageName.startsWith('@') ? packageName : `@${packageName}`;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const metaUrl = `https://npm.pkg.github.com/${normalized}`;
      console.log(`[GitHub] fetching metadata: ${metaUrl}, hasToken=${!!token}`);
      const metaRes = await fetch(metaUrl, { headers });
      console.log(`[GitHub] metadata status: ${metaRes.status}`);
      if (!metaRes.ok) {
        const body = await metaRes.text();
        throw new Error(`Package ${packageName} not found on GitHub registry (${metaRes.status}): ${body.slice(0, 200)}`);
      }
      const metaData = await metaRes.json() as any;
      tarballUrl = metaData.versions?.[version]?.dist?.tarball;
      console.log(`[GitHub] tarball URL for ${version}: ${tarballUrl}`);
      if (!tarballUrl) {
        const availableVersions = Object.keys(metaData.versions || {});
        throw new Error(`No tarball URL found for ${packageName}@${version}. Available: ${availableVersions.slice(0, 5).join(', ')}`);
      }
    }

    console.log(`[download] fetching tarball: ${tarballUrl}`);
    const tarballRes = await fetch(tarballUrl, { headers });
    console.log(`[download] tarball status: ${tarballRes.status}`);
    if (!tarballRes.ok) throw new Error(`Failed to download tarball for ${packageName}@${version} (${tarballRes.status})`);

    const tarballPath = path.join(extractDir, 'package.tgz');
    const fileStream = fs.createWriteStream(tarballPath);

    await new Promise<void>((resolve, reject) => {
      tarballRes.body!.pipe(fileStream);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    // Detect strip level: npm tarballs have a single "package/" root dir → strip: 1
    const topLevelDirs = new Set<string>();
    await tar.list({
      file: tarballPath,
      onentry: (entry: any) => {
        const top = entry.path.split('/')[0];
        if (top) topLevelDirs.add(top);
      },
    });
    const strip = topLevelDirs.size === 1 ? 1 : 0;
    console.log(`[extract] topLevel dirs: ${[...topLevelDirs].slice(0,5).join(', ')}, strip=${strip}`);

    await tar.extract({
      file: tarballPath,
      cwd: extractDir,
      strip,
    });

    fs.unlinkSync(tarballPath);
    console.log(`[extract] done, files: ${fs.readdirSync(extractDir).length}`);
  } catch (err) {
    // Cleanup on failure so next attempt doesn't hit the empty dir
    fs.rmSync(extractDir, { recursive: true, force: true });
    throw err;
  }

  return extractDir;
}

export function buildFileTree(dirPath: string, relativeTo: string = dirPath): FileNode {
  const name = path.basename(dirPath);
  const stat = fs.statSync(dirPath);

  if (!stat.isDirectory()) {
    return {
      name,
      path: path.relative(relativeTo, dirPath),
      type: 'file',
      size: stat.size,
    };
  }

  const entries = fs.readdirSync(dirPath).sort((a, b) => {
    const aIsDir = fs.statSync(path.join(dirPath, a)).isDirectory();
    const bIsDir = fs.statSync(path.join(dirPath, b)).isDirectory();
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  const children: FileNode[] = entries.map(entry =>
    buildFileTree(path.join(dirPath, entry), relativeTo)
  );

  return {
    name,
    path: path.relative(relativeTo, dirPath) || '.',
    type: 'directory',
    children,
  };
}

export function readFile(extractDir: string, filePath: string): string {
  const fullPath = path.join(extractDir, filePath);
  const resolved = path.resolve(fullPath);

  // Security: prevent path traversal
  if (!resolved.startsWith(path.resolve(extractDir))) {
    throw new Error('Path traversal detected');
  }

  const stat = fs.statSync(resolved);
  if (stat.size > 5 * 1024 * 1024) {
    throw new Error('File too large (> 5MB)');
  }

  return fs.readFileSync(resolved, 'utf-8');
}

export function listCachedPackages(): string[] {
  ensureCacheDir();
  return fs.readdirSync(CACHE_DIR);
}
