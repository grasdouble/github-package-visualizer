import { useState } from 'react';
import { Search, GitBranch, Package } from 'lucide-react';

interface Props {
  onSearch: (name: string, registry: 'npm' | 'github') => void;
  loading: boolean;
  isAuthenticated: boolean;
}

export function SearchBar({ onSearch, loading, isAuthenticated }: Props) {
  const [name, setName] = useState('');
  const [registry, setRegistry] = useState<'npm' | 'github'>('github');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) { onSearch(name.trim(), registry); }
  };

  return (
    <form onSubmit={handleSubmit} className="search-bar">
      <div className="search-registry">
        <button
          type="button"
          className={`registry-btn ${registry === 'github' ? 'active' : ''}`}
          onClick={() => setRegistry('github')}
        >
          <GitBranch size={14} />
          GitHub
        </button>
        <button
          type="button"
          className={`registry-btn ${registry === 'npm' ? 'active' : ''}`}
          onClick={() => setRegistry('npm')}
        >
          <Package size={14} />
          npm
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
          autoFocus
        />
        <button type="submit" className="search-btn" disabled={loading || !name.trim()}>
          {loading ? <span className="spinner" /> : <Search size={16} />}
        </button>
      </div>

      {registry === 'github' && !isAuthenticated && (
        <p className="auth-hint">
          Connexion GitHub requise pour les packages privés — VSCode vous demandera de vous authentifier.
        </p>
      )}
    </form>
  );
}
