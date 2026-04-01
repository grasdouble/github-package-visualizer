import type { PackageMetadata } from '../types';

interface Props {
  metadata: PackageMetadata;
  selectedVersion: string;
  onVersionChange: (v: string) => void;
  onDownload: () => void;
  downloading: boolean;
}

export function VersionPicker({ metadata, selectedVersion, onVersionChange, onDownload, downloading }: Props) {
  return (
    <div className="version-picker">
      <div className="package-header">
        <h2 className="package-name">{metadata.name}</h2>
        {metadata.description && (
          <p className="package-description">{metadata.description}</p>
        )}
        <span className="registry-badge">{metadata.registry}</span>
      </div>

      <div className="version-select-row">
        <label htmlFor="version-select">Version :</label>
        <select
          id="version-select"
          value={selectedVersion}
          onChange={e => onVersionChange(e.target.value)}
          className="version-select"
        >
          {metadata.versions.map(v => (
            <option key={v} value={v}>
              {v}{v === metadata.latestVersion ? ' (latest)' : ''}
            </option>
          ))}
        </select>
        <button
          className="download-btn"
          onClick={onDownload}
          disabled={downloading}
        >
          {downloading ? <><span className="spinner" /> Téléchargement...</> : 'Visualiser'}
        </button>
      </div>
    </div>
  );
}
