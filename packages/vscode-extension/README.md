# Package Visualizer — VSCode Extension

Browse npm and GitHub Registry package contents directly inside VSCode, without leaving your editor.

## Features

- Search any **npm** package or **GitHub Registry** package (`@scope/name`)
- Browse the full file tree of any published version
- Click a file to open it **read-only** in the VSCode editor with native syntax highlighting and your active theme
- GitHub authentication via your existing VSCode GitHub account — no PAT needed
- In-memory extraction — no files written to disk except when opening in the editor

---

## Usage

1. Click the **package icon** in the activity bar (left sidebar)
2. Choose registry — **npm** or **GitHub**
3. Type a package name (e.g. `react` or `@grasdouble/lufa_design-system`)
4. Select a version and click **Télécharger**
5. Click any file in the tree — it opens read-only in the editor

Alternatively, open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:
```
Package Visualizer: Open
```

---

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Install dependencies

```bash
# From the repo root
pnpm install
```

### Run in dev mode (F5)

Open `packages/vscode-extension/` as the workspace root in VSCode, then press **F5**. This will:
1. Build the extension host (`dist/extension.js`) and the webview bundle (`dist/webview.js`)
2. Launch a new Extension Development Host window with the extension loaded

Or run the build manually:

```bash
cd packages/vscode-extension
node esbuild.mjs          # extension host
node esbuild.webview.mjs  # React webview bundle
```

### Watch mode

```bash
cd packages/vscode-extension
node esbuild.mjs --watch &
node esbuild.webview.mjs --watch
```

---

## Install locally (without publishing)

### 1. Build and package

```bash
cd packages/vscode-extension
node esbuild.mjs && node esbuild.webview.mjs
npx vsce package --no-dependencies
```

This produces `github-package-visualizer-vscode-0.1.0.vsix`.

### 2. Install in VSCode

```bash
code --install-extension github-package-visualizer-vscode-0.1.0.vsix
```

Then reload VSCode (`Ctrl+Shift+P` → **Reload Window**).

### Update

Bump the `version` in `package.json`, rebuild, repackage and reinstall:

```bash
# edit package.json version first, then:
node esbuild.mjs && node esbuild.webview.mjs
npx vsce package --no-dependencies
code --install-extension github-package-visualizer-vscode-<version>.vsix
```

---

## Architecture

```
packages/vscode-extension/
├── package.json                  # VSCode extension manifest
├── esbuild.mjs                   # build script — extension host (CJS, Node 18)
├── esbuild.webview.mjs           # build script — webview React app (IIFE, browser)
├── dist/                         # compiled output (gitignored)
│   ├── extension.js              # ~94 KB — extension host bundle
│   ├── webview.js                # ~276 KB — React + lucide-react
│   └── webview.css               # ~13 KB — inlined into HTML at runtime
└── src/
    ├── shared/
    │   └── types.ts              # message contract between host ↔ webview
    ├── extension/
    │   ├── extension.ts          # activate, WebviewViewProvider, message routing
    │   └── packageService.ts     # npm/GitHub fetch + in-memory tar extraction
    └── webview/
        ├── index.tsx             # React entry point
        ├── App.tsx               # search → version → file tree wizard
        ├── app.css               # VSCode CSS variables (--vscode-*)
        ├── vscode-bridge.ts      # postMessage / onMessage wrapper
        └── components/
            ├── SearchBar.tsx
            ├── VersionPicker.tsx
            └── FileTree.tsx
```

### How it works

1. The extension registers a **WebviewViewProvider** on the activity bar sidebar
2. The webview (React) sends `postMessage` requests to the extension host
3. The extension host fetches npm/GitHub APIs directly using Node's `https` module — no backend server needed
4. Package tarballs are decompressed in memory with `zlib` + `tar-stream`
5. File content is cached in a `Map` for the session
6. When a file is clicked, the content is written to a temp file and opened via `vscode.workspace.openTextDocument` — read-only, with VSCode's native editor

### Message protocol

| Direction | Message type | Description |
|---|---|---|
| webview → host | `ready` | Webview mounted, request auth status |
| webview → host | `fetchMetadata` | Fetch package versions |
| webview → host | `downloadPackage` | Download + extract tarball |
| webview → host | `readFile` | Read a file from in-memory cache |
| webview → host | `openInEditor` | Open file content in VSCode editor |
| host → webview | `authStatus` | GitHub auth state |
| host → webview | `metadataResult` | Package versions list |
| host → webview | `downloadResult` | File tree after extraction |
| host → webview | `fileContent` | File content from cache |

---

## Known limitations

- Binary files (images, fonts, etc.) are not extracted or displayed
- Files larger than 5 MB are skipped from the cache
- GitHub Registry packages require a GitHub account connected in VSCode with the `read:packages` scope
- The temp files written for editor display are cleaned up when the extension deactivates
