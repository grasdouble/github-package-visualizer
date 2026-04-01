import { Router, Request, Response } from 'express';
import {
  fetchNpmMetadata,
  fetchGithubMetadata,
  downloadAndExtract,
  buildFileTree,
  readFile,
  listCachedPackages,
} from '../services/packageService';
import * as path from 'path';
import * as os from 'os';

const router = Router();
const CACHE_DIR = path.join(os.tmpdir(), 'pkg-visualizer-cache');

// GET /api/package/metadata?name=<pkg>&registry=npm|github&token=<optional>
router.get('/metadata', async (req: Request, res: Response) => {
  const { name, registry = 'npm', token } = req.query as Record<string, string>;

  if (!name) {
    res.status(400).json({ error: 'Missing package name' });
    return;
  }

  try {
    const metadata = registry === 'github'
      ? await fetchGithubMetadata(name, token)
      : await fetchNpmMetadata(name);

    res.json(metadata);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/package/download
// Body: { name, version, registry, token? }
router.post('/download', async (req: Request, res: Response) => {
  const { name, version, registry = 'npm', token } = req.body;

  if (!name || !version) {
    res.status(400).json({ error: 'Missing name or version' });
    return;
  }

  try {
    const extractDir = await downloadAndExtract(name, version, registry, token);
    const tree = buildFileTree(extractDir);
    res.json({ success: true, cacheKey: `${name}@${version}`, tree });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/package/file?name=<pkg>&version=<v>&path=<filepath>
router.get('/file', async (req: Request, res: Response) => {
  const { name, version, path: filePath } = req.query as Record<string, string>;

  if (!name || !version || !filePath) {
    res.status(400).json({ error: 'Missing name, version or path' });
    return;
  }

  const safeName = name.replace(/[/@]/g, '-').replace(/^-/, '');
  const extractDir = path.join(CACHE_DIR, `${safeName}@${version}`);

  try {
    const content = readFile(extractDir, filePath);
    res.json({ content });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/package/cache
router.get('/cache', (_req: Request, res: Response) => {
  const packages = listCachedPackages();
  res.json({ packages });
});

export default router;
