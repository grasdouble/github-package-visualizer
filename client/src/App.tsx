import { useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { VersionPicker } from './components/VersionPicker';
import { FileTree } from './components/FileTree';
import { FileViewer } from './components/FileViewer';
import { GitHubAuthButton } from './components/GitHubAuthButton';
import { useGitHubAuth } from './hooks/useGitHubAuth';
import { fetchMetadata, downloadPackage } from './api';
import type { PackageMetadata, FileNode } from './types';
import './App.css';

type Step = 'search' | 'version' | 'explore';

function App() {
  const { token, user, loading: authLoading, login, logout } = useGitHubAuth();

  const [step, setStep] = useState<Step>('search');
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [metadata, setMetadata] = useState<PackageMetadata | null>(null);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [registry, setRegistry] = useState<'npm' | 'github'>('github');
  const [manualToken, setManualToken] = useState<string | undefined>();

  const [tree, setTree] = useState<FileNode | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Utilise le token OAuth en priorité, sinon le token manuel saisi
  const effectiveToken = token ?? manualToken;

  const handleSearch = async (name: string, reg: 'npm' | 'github', tok?: string) => {
    setLoadingMeta(true);
    setError(null);
    setRegistry(reg);
    setManualToken(tok);
    try {
      const meta = await fetchMetadata(name, reg, tok ?? effectiveToken);
      setMetadata(meta);
      setSelectedVersion(meta.latestVersion);
      setStep('version');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingMeta(false);
    }
  };

  const handleDownload = async () => {
    if (!metadata) return;
    setDownloading(true);
    setError(null);
    try {
      const result = await downloadPackage(metadata.name, selectedVersion, registry, effectiveToken);
      setTree(result.tree);
      setSelectedFile(null);
      setStep('explore');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleReset = () => {
    setStep('search');
    setMetadata(null);
    setTree(null);
    setSelectedFile(null);
    setError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <span className="title-icon">📦</span>
            Package Visualizer
          </h1>
          <div className="header-right">
            {step !== 'search' && (
              <button className="back-btn" onClick={handleReset}>
                ← Nouvelle recherche
              </button>
            )}
            <GitHubAuthButton
              user={user}
              loading={authLoading}
              onLogin={login}
              onLogout={logout}
            />
          </div>
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {step === 'search' && (
          <div className="search-page">
            <p className="search-subtitle">
              Explorez le contenu d'un package npm ou GitHub Registry
            </p>
            <SearchBar onSearch={handleSearch} loading={loadingMeta} isAuthenticated={!!token} />
          </div>
        )}

        {step === 'version' && metadata && (
          <div className="version-page">
            <VersionPicker
              metadata={metadata}
              selectedVersion={selectedVersion}
              onVersionChange={setSelectedVersion}
              onDownload={handleDownload}
              downloading={downloading}
            />
          </div>
        )}

        {step === 'explore' && metadata && tree && (
          <div className="explorer">
            <aside className="explorer-sidebar">
              <div className="sidebar-header">
                <span className="sidebar-pkg">{metadata.name}</span>
                <span className="sidebar-version">v{selectedVersion}</span>
              </div>
              <div className="sidebar-tree">
                <FileTree
                  node={tree}
                  onFileSelect={setSelectedFile}
                  selectedPath={selectedFile ?? undefined}
                />
              </div>
            </aside>
            <div className="explorer-content">
              {selectedFile ? (
                <FileViewer
                  packageName={metadata.name}
                  version={selectedVersion}
                  filePath={selectedFile}
                />
              ) : (
                <div className="explorer-placeholder">
                  Sélectionnez un fichier dans l'arborescence
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
