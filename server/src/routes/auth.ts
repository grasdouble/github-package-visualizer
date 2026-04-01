import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

const router = Router();

const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const CALLBACK_URL = 'http://localhost:3001/api/auth/callback';
const CLIENT_APP_URL = 'http://localhost:5173';

// GET /api/auth/login — redirige vers GitHub OAuth
router.get('/login', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    scope: 'read:packages',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GET /api/auth/callback — GitHub redirige ici avec un `code`
router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query as { code?: string };

  if (!code) {
    res.redirect(`${CLIENT_APP_URL}?auth_error=missing_code`);
    return;
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: CALLBACK_URL,
      }),
    });

    const data = await tokenRes.json() as any;

    if (data.error || !data.access_token) {
      res.redirect(`${CLIENT_APP_URL}?auth_error=${data.error || 'unknown'}`);
      return;
    }

    // Redirige vers le client avec le token dans le fragment (#)
    // Le fragment n'est jamais envoyé au serveur = plus sûr
    res.redirect(`${CLIENT_APP_URL}#access_token=${data.access_token}`);
  } catch (err: any) {
    res.redirect(`${CLIENT_APP_URL}?auth_error=server_error`);
  }
});

// GET /api/auth/user — vérifie le token et retourne l'utilisateur
router.get('/user', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'No token' });
    return;
  }

  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!userRes.ok) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const user = await userRes.json() as any;
    res.json({ login: user.login, avatar_url: user.avatar_url, name: user.name });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
