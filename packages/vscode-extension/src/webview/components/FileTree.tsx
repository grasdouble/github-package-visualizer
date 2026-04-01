import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, File } from 'lucide-react';
import type { FileNode } from '../../shared/types';

interface Props {
  node: FileNode;
  onFileSelect: (path: string) => void;
  selectedPath?: string;
  depth?: number;
}

function formatSize(bytes?: number): string {
  if (!bytes) { return ''; }
  if (bytes < 1024) { return `${bytes} B`; }
  if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TEXT_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'md', 'txt', 'css', 'html', 'yml', 'yaml', 'toml', 'sh',
]);

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_EXTS.has(ext)
    ? <FileText size={13} className="icon icon--file-text" />
    : <File size={13} className="icon icon--file" />;
}

export function FileTree({ node, onFileSelect, selectedPath, depth = 0 }: Props) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.type === 'file') {
    const isSelected = selectedPath === node.path;
    return (
      <div
        className={`tree-item tree-item--file${isSelected ? ' tree-item--selected' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onFileSelect(node.path)}
        title={node.path}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onFileSelect(node.path)}
      >
        <FileIcon name={node.name} />
        <span className="tree-item__name">{node.name}</span>
        {node.size !== undefined && (
          <span className="tree-item__size">{formatSize(node.size)}</span>
        )}
      </div>
    );
  }

  // Root node — render children directly without a row
  if (node.path === '.') {
    return (
      <div className="tree-root">
        {node.children?.map(child => (
          <FileTree
            key={child.path}
            node={child}
            onFileSelect={onFileSelect}
            selectedPath={selectedPath}
            depth={depth}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="tree-group">
      <div
        className="tree-item tree-item--dir"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => setExpanded(v => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setExpanded(v => !v)}
      >
        {expanded
          ? <ChevronDown size={12} className="icon icon--chevron" />
          : <ChevronRight size={12} className="icon icon--chevron" />}
        {expanded
          ? <FolderOpen size={13} className="icon icon--folder" />
          : <Folder size={13} className="icon icon--folder" />}
        <span className="tree-item__name">{node.name}</span>
      </div>
      {expanded && node.children?.map(child => (
        <FileTree
          key={child.path}
          node={child}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
