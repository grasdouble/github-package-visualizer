import { useState, useEffect, useCallback } from 'react';

interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

const TOKEN_KEY = 'gh_access_token';

export function useGitHubAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [loading, setLoading] = useState(false);

  // Au chargement, vérifie si un token arrive dans le fragment (#access_token=...)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#access_token=')) {
      const t = hash.slice('#access_token='.length);
      localStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      // Nettoie l'URL
      window.history.replaceState(null, '', window.location.pathname);
    }

    // Vérifie si une erreur OAuth est dans les query params
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      console.error('OAuth error:', authError);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Quand le token change, fetch l'utilisateur GitHub
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    setLoading(true);
    fetch('/api/auth/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('Invalid token');
        return res.json();
      })
      .then((data: GitHubUser) => setUser(data))
      .catch(() => {
        // Token invalide ou expiré
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(() => {
    window.location.href = 'http://localhost:3001/api/auth/login';
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return { token, user, loading, login, logout };
}
