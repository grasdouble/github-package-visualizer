import type { PackageMetadata, DownloadResult } from '../types';

const BASE = '/api/package';

export async function fetchMetadata(
  name: string,
  registry: 'npm' | 'github',
  token?: string
): Promise<PackageMetadata> {
  const params = new URLSearchParams({ name, registry });
  if (token) params.set('token', token);
  const res = await fetch(`${BASE}/metadata?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch metadata');
  return data;
}

export async function downloadPackage(
  name: string,
  version: string,
  registry: 'npm' | 'github',
  token?: string
): Promise<DownloadResult> {
  const res = await fetch(`${BASE}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, version, registry, token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to download package');
  return data;
}

export async function fetchFileContent(
  name: string,
  version: string,
  filePath: string
): Promise<string> {
  const params = new URLSearchParams({ name, version, path: filePath });
  const res = await fetch(`${BASE}/file?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to read file');
  return data.content;
}
