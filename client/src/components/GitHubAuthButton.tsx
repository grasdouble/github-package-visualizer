import { GitBranch, LogOut, LogIn } from 'lucide-react';

interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

interface Props {
  user: GitHubUser | null;
  loading: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function GitHubAuthButton({ user, loading, onLogin, onLogout }: Props) {
  if (loading) {
    return (
      <div className="auth-btn auth-btn--loading">
        <span className="spinner" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="auth-user">
        <img src={user.avatar_url} alt={user.login} className="auth-avatar" />
        <span className="auth-username">{user.login}</span>
        <button className="auth-btn auth-btn--logout" onClick={onLogout} title="Se déconnecter">
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  return (
    <button className="auth-btn auth-btn--login" onClick={onLogin}>
      <GitBranch size={15} />
      Login with GitHub
      <LogIn size={14} />
    </button>
  );
}
