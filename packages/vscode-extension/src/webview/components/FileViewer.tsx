import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { postMessage, onMessage } from '../vscode-bridge';

// Shiki — importé statiquement pour fonctionner dans un webview VSCode (pas de workers)
import { createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import getWasm from 'shiki/wasm';
import langTs from 'shiki/langs/typescript.mjs';
import langTsx from 'shiki/langs/tsx.mjs';
import langJs from 'shiki/langs/javascript.mjs';
import langJsx from 'shiki/langs/jsx.mjs';
import langJson from 'shiki/langs/json.mjs';
import langCss from 'shiki/langs/css.mjs';
import langHtml from 'shiki/langs/html.mjs';
import langYaml from 'shiki/langs/yaml.mjs';
import langBash from 'shiki/langs/bash.mjs';
import langMarkdown from 'shiki/langs/markdown.mjs';
import langPython from 'shiki/langs/python.mjs';
import langRust from 'shiki/langs/rust.mjs';
import langGo from 'shiki/langs/go.mjs';
import langDockerfile from 'shiki/langs/dockerfile.mjs';
import langToml from 'shiki/langs/toml.mjs';
import themeDark from 'shiki/themes/github-dark.mjs';
import type { HighlighterCore } from 'shiki/core';

interface Props {
  packageKey: string;
  filePath: string;
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  jsx: 'jsx', json: 'json', jsonc: 'json', json5: 'json', md: 'markdown', mdx: 'markdown',
  css: 'css', yml: 'yaml', yaml: 'yaml', sh: 'bash', bash: 'bash', zsh: 'bash',
  toml: 'toml', rs: 'rust', py: 'python', go: 'go',
  html: 'html', htm: 'html', txt: 'text', env: 'bash', gitignore: 'bash', dockerfile: 'dockerfile', lock: 'text',
};

const BINARY_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'mp4', 'zip', 'gz', 'tgz', 'tar',
]);

function getLanguage(filePath: string): string {
  const fileName = filePath.split('/').pop()?.toLowerCase() ?? '';
  if (fileName === 'dockerfile') { return 'dockerfile'; }
  if (['.gitignore', '.npmignore', '.eslintignore'].includes(fileName)) { return 'bash'; }
  if (fileName === '.env' || fileName.startsWith('.env.')) { return 'bash'; }
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (fileName.startsWith('.') && !fileName.slice(1).includes('.')) { return 'json'; }
  return LANG_MAP[ext] ?? 'text';
}

function isBinary(filePath: string): boolean {
  return BINARY_EXTS.has(filePath.split('.').pop()?.toLowerCase() ?? '');
}

// Singleton — initialisé une fois, en mode statique (pas de workers)
let highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [themeDark],
      langs: [
        langTs, langTsx, langJs, langJsx, langJson, langCss, langHtml,
        langYaml, langBash, langMarkdown, langPython, langRust, langGo,
        langDockerfile, langToml,
      ],
      engine: createOnigurumaEngine(getWasm),
    });
  }
  return highlighterPromise;
}

export function FileViewer({ packageKey, filePath }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileName = filePath.split('/').pop() ?? filePath;
  const lang = getLanguage(filePath);

  useEffect(() => {
    if (!filePath || isBinary(filePath)) { return; }
    setLoading(true);
    setError(null);
    setContent(null);
    setHighlighted(null);

    postMessage({ type: 'readFile', packageKey, filePath });

    const unlisten = onMessage(msg => {
      if (msg.type === 'fileContent' && msg.filePath === filePath) {
        setContent(msg.content);
        setLoading(false);
        unlisten();
      } else if (msg.type === 'fileError' && msg.filePath === filePath) {
        setError(msg.error);
        setLoading(false);
        unlisten();
      }
    });

    return unlisten;
  }, [packageKey, filePath]);

  useEffect(() => {
    if (!content || lang === 'markdown' || lang === 'text') { return; }
    let cancelled = false;
    getHighlighter().then(hl => {
      if (cancelled) { return; }
      try {
        const html = hl.codeToHtml(content, { lang, theme: 'github-dark' });
        setHighlighted(html);
      } catch {
        setHighlighted(null);
      }
    }).catch(() => setHighlighted(null));
    return () => { cancelled = true; };
  }, [content, lang]);

  return (
    <div className="file-viewer">
      <div className="file-viewer__header">
        <span className="file-viewer__path">{filePath}</span>
        <span className="file-viewer__lang">{lang}</span>
        {content !== null && !isBinary(filePath) && (
          <button
            className="file-viewer__open-btn"
            title="Ouvrir dans l'éditeur VSCode"
            onClick={() => postMessage({ type: 'openInEditor', filePath, content })}
          >
            Ouvrir dans l'éditeur
          </button>
        )}
      </div>
      <div className="file-viewer__body">
        {loading && <div className="file-viewer__loading">Chargement...</div>}
        {error && <div className="file-viewer__error">{error}</div>}
        {isBinary(filePath) && (
          <div className="file-viewer__binary">Fichier binaire ({fileName})</div>
        )}
        {content !== null && lang === 'markdown' && (
          <div className="markdown-body">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
        {content !== null && lang !== 'markdown' && highlighted && (
          <div className="shiki-wrapper" dangerouslySetInnerHTML={{ __html: highlighted }} />
        )}
        {content !== null && lang !== 'markdown' && !highlighted && (
          <pre className="code-block">
            {content.split('\n').map((line, i) => (
              <div key={i} className="code-line">
                <span className="code-line__num">{i + 1}</span>
                <span>{line}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
