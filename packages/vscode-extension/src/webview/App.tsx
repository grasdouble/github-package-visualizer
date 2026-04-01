import { useState, useEffect } from 'react';
import { SearchBar } from './components/SearchBar';
import { VersionPicker } from './components/VersionPicker';
import { FileTree } from './components/FileTree';
import { postMessage, onMessage } from './vscode-bridge';
import type { PackageMetadata, FileNode } from '../shared/types';

type Step = 'search' | 'version' | 'explore';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [step, setStep] = useState<Step>('search');
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [metadata, setMetadata] = useState<PackageMetadata | null>(null);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [currentRegistry, setCurrentRegistry] = useState<'npm' | 'github'>('github');

  const [tree, setTree] = useState<FileNode | null>(null);
  const [packageKey, setPackageKey] = useState('');

  useEffect(() => {
    const unlisten = onMessage(msg => {
      switch (msg.type) {
        case 'authStatus':
          setIsAuthenticated(msg.isAuthenticated);
          break;
        case 'metadataResult':
          setMetadata(msg.metadata);
          setSelectedVersion(msg.metadata.latestVersion);
          setStep('version');
          setLoadingMeta(false);
          break;
        case 'metadataError':
          setError(msg.error);
          setLoadingMeta(false);
          break;
        case 'downloadResult':
          setTree(msg.tree);
          setPackageKey(msg.packageKey);
          setStep('explore');
          setDownloading(false);
          break;
        case 'downloadError':
          setError(msg.error);
          setDownloading(false);
          break;
        case 'fileContent':
          // Received file content — forward to extension host to open in editor
          postMessage({ type: 'openInEditor', filePath: msg.filePath, content: msg.content });
          setOpeningFile(null);
          break;
        case 'fileError':
          setError(msg.error);
          setOpeningFile(null);
          break;
      }
    });

    postMessage({ type: 'ready' });
    return unlisten;
  }, []);

  const handleSearch = (name: string, registry: 'npm' | 'github') => {
    setLoadingMeta(true);
    setError(null);
    setCurrentRegistry(registry);
    postMessage({ type: 'fetchMetadata', name, registry });
  };

  const handleDownload = () => {
    if (!metadata) { return; }
    setDownloading(true);
    setError(null);
    postMessage({ type: 'downloadPackage', name: metadata.name, version: selectedVersion, registry: currentRegistry });
  };

  const handleFileSelect = (filePath: string) => {
    setOpeningFile(filePath);
    setError(null);
    postMessage({ type: 'readFile', packageKey, filePath });
  };

  const handleReset = () => {
    setStep('search');
    setMetadata(null);
    setTree(null);
    setError(null);
    setOpeningFile(null);
  };

  return (
    <div className="app">
      {error && (
        <div className="app__error-banner">
          <span>{error}</span>
          <button className="app__error-close" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="app__content">
        {step === 'search' && (
          <div className="search-page">
            <p className="search-page__subtitle">
              Explorez le contenu d'un package npm ou GitHub Registry
            </p>
            <SearchBar
              onSearch={handleSearch}
              loading={loadingMeta}
              isAuthenticated={isAuthenticated}
            />
          </div>
        )}

        {step === 'version' && metadata && (
          <div className="version-page">
            <div className="version-page__back">
              <button className="app__back-btn" onClick={handleReset}>← Nouvelle recherche</button>
            </div>
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
          <div className="explorer explorer--sidebar">
            <div className="explorer__sidebar-header">
              <div className="explorer__pkg-info">
                <span className="explorer__pkg-name">{metadata.name}</span>
                <span className="explorer__version">v{selectedVersion}</span>
              </div>
              <button className="app__back-btn" onClick={handleReset} title="Nouvelle recherche">←</button>
            </div>
            <div className="explorer__tree">
              <FileTree
                node={tree}
                onFileSelect={handleFileSelect}
                selectedPath={openingFile ?? undefined}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
