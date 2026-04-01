import { useState } from 'react';
import { Search, GitBranch, Package } from 'lucide-react';

interface Props {
  onSearch: (name: string, registry: 'npm' | 'github', token?: string) => void;
  loading: boolean;
  isAuthenticated?: boolean;
}

export function SearchBar({ onSearch, loading, isAuthenticated = false }: Props) {
  const [name, setName] = useState('');
  const [registry, setRegistry] = useState<'npm' | 'github'>('github');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSearch(name.trim(), registry, token || undefined);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="search-bar">
      <div className="search-registry">
        <button
          type="button"
          className={`registry-btn ${registry === 'github' ? 'active' : ''}`}
          onClick={() => setRegistry('github')}
        >
          <GitBranch size={16} /> GitHub
        </button>
        <button
          type="button"
          className={`registry-btn ${registry === 'npm' ? 'active' : ''}`}
          onClick={() => setRegistry('npm')}
        >
          <Package size={16} /> npm
        </button>
      </div>

      <div className="search-input-row">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={registry === 'github' ? '@scope/package-name' : 'package-name'}
          className="search-input"
          disabled={loading}
        />
        <button type="submit" className="search-btn" disabled={loading || !name.trim()}>
          {loading ? <span className="spinner" /> : <Search size={18} />}
        </button>
      </div>

      {registry === 'github' && !isAuthenticated && (
        <div className="token-row">
          <button
            type="button"
            className="token-toggle"
            onClick={() => setShowToken(v => !v)}
          >
            {showToken ? 'Hide' : 'GitHub token (optionnel)'}
          </button>
          {showToken && (
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_..."
              className="token-input"
            />
          )}
        </div>
      )}
    </form>
  );
}
