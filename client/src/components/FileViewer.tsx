import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { createHighlighter, type Highlighter } from 'shiki';
import { fetchFileContent } from '../api';

interface Props {
  packageName: string;
  version: string;
  filePath: string;
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  md: 'markdown',
  mdx: 'markdown',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  vue: 'vue',
  svelte: 'svelte',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  toml: 'toml',
  rs: 'rust',
  py: 'python',
  go: 'go',
  rb: 'ruby',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  xml: 'xml',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  txt: 'text',
  env: 'bash',
  gitignore: 'bash',
  dockerfile: 'dockerfile',
  lock: 'text',
};

const BINARY_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'woff', 'woff2',
  'ttf', 'eot', 'mp4', 'zip', 'gz', 'tgz', 'tar',
]);

function getLanguage(filePath: string): string {
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';
  // Handle files without extension or dotfiles (e.g. Dockerfile, .gitignore)
  if (fileName === 'dockerfile') return 'dockerfile';
  if (fileName === '.gitignore' || fileName === '.npmignore' || fileName === '.eslintignore') return 'bash';
  if (fileName === '.env' || fileName.startsWith('.env.')) return 'bash';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  // For dotfiles like ".babelrc", ext will be "babelrc" — treat as json
  if (fileName.startsWith('.') && !fileName.slice(1).includes('.')) return 'json';
  return LANG_MAP[ext] || 'text';
}

function isBinary(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return BINARY_EXTS.has(ext);
}

// Singleton highlighter — initialisé une seule fois
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    const langs = [...new Set(Object.values(LANG_MAP).filter(l => l !== 'text'))];
    highlighterPromise = createHighlighter({
      themes: ['github-dark'],
      langs,
    });
  }
  return highlighterPromise;
}

export function FileViewer({ packageName, version, filePath }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileName = filePath.split('/').pop() || filePath;
  const lang = getLanguage(filePath);

  // Fetch file content
  useEffect(() => {
    if (!filePath || isBinary(filePath)) return;
    setLoading(true);
    setError(null);
    setContent(null);
    setHighlighted(null);

    fetchFileContent(packageName, version, filePath)
      .then(setContent)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [packageName, version, filePath]);

  // Highlight when content is ready
  useEffect(() => {
    if (!content || lang === 'markdown' || lang === 'text') return;
    let cancelled = false;

    getHighlighter().then(hl => {
      if (cancelled) return;
      try {
        const html = hl.codeToHtml(content, {
          lang,
          theme: 'github-dark',
        });
        setHighlighted(html);
      } catch {
        // Langue non supportée → fallback plain text
        setHighlighted(null);
      }
    });

    return () => { cancelled = true; };
  }, [content, lang]);

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <span className="file-viewer-path">{filePath}</span>
        <span className="file-viewer-lang">{lang}</span>
      </div>

      <div className="file-viewer-body">
        {loading && <div className="file-viewer-loading">Chargement...</div>}
        {error && <div className="file-viewer-error">{error}</div>}

        {isBinary(filePath) && (
          <div className="file-viewer-binary">Fichier binaire ({fileName})</div>
        )}

        {content !== null && lang === 'markdown' && (
          <div className="markdown-body">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}

        {content !== null && lang !== 'markdown' && highlighted && (
          <div
            className="shiki-wrapper"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        )}

        {content !== null && lang !== 'markdown' && !highlighted && (
          <pre className="code-block">
            {content.split('\n').map((line, i) => (
              <div key={i} className="code-line">
                <span className="code-line-num">{i + 1}</span>
                <span>{line}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
