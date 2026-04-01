import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, File } from 'lucide-react';
import type { FileNode } from '../types';

interface Props {
  node: FileNode;
  onFileSelect: (path: string) => void;
  selectedPath?: string;
  depth?: number;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  const textExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'txt', 'css', 'html', 'yml', 'yaml', 'toml', 'sh'];
  if (textExts.includes(ext || '')) return <FileText size={14} />;
  return <File size={14} />;
}

export function FileTree({ node, onFileSelect, selectedPath, depth = 0 }: Props) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.type === 'file') {
    const isSelected = selectedPath === node.path;
    return (
      <div
        className={`file-node file ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onFileSelect(node.path)}
        title={node.path}
      >
        {getFileIcon(node.name)}
        <span className="file-name">{node.name}</span>
        {node.size !== undefined && (
          <span className="file-size">{formatSize(node.size)}</span>
        )}
      </div>
    );
  }

  if (node.path === '.') {
    return (
      <div className="file-tree-root">
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
    <div className="file-node-group">
      <div
        className="file-node directory"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => setExpanded(v => !v)}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
        <span className="file-name">{node.name}</span>
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
