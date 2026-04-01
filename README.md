# GitHub Package Visualizer

A web app to browse the contents of npm or GitHub Registry packages — file tree, syntax-highlighted source files, README, and more.

## Stack

- **Client**: React + Vite + TypeScript
- **Server**: Express + TypeScript
- **Syntax highlighting**: Shiki (`github-dark` theme)
- **Auth**: GitHub OAuth (with manual token fallback)

---

## Getting started

### 1. Create a GitHub OAuth App

The app uses GitHub OAuth to authenticate users and access private GitHub Registry packages.

1. Go to **GitHub → Settings → Developer settings → OAuth Apps**
   (direct link: https://github.com/settings/developers)

2. Click **"New OAuth App"**

3. Fill in the form:

   | Field | Value |
   |---|---|
   | Application name | `GitHub Package Visualizer` (or anything you like) |
   | Homepage URL | `http://localhost:5173` |
   | Authorization callback URL | `http://localhost:3001/api/auth/callback` |

   > The callback URL must match exactly — it points to the Express server, not the Vite dev server.

4. Click **"Register application"**

5. On the next page, copy the **Client ID**.
   Then click **"Generate a new client secret"** and copy the secret immediately (it won't be shown again).

---

### 2. Configure the server

Create `server/.env`:

```env
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

---

### 3. Install dependencies and run

```bash
npm install
npm run dev
```

This starts both the Vite dev server (port `5173`) and the Express API (port `3001`) concurrently.

Open http://localhost:5173 in your browser.

---

## Authentication flow

1. The user clicks **"Se connecter avec GitHub"** in the UI.
2. The browser navigates to `http://localhost:3001/api/auth/login`, which redirects to GitHub's OAuth authorization page.
3. After the user grants access, GitHub redirects to `http://localhost:3001/api/auth/callback?code=...`.
4. The server exchanges the code for an access token and redirects back to the client with the token in the URL fragment (`#access_token=...`).
5. The client reads the token from the fragment, stores it in `localStorage` under the key `gh_access_token`, and uses it for all subsequent API calls.

> The token is passed in the URL fragment (not the query string) so it is never sent to the server by the browser.

---

## Manual token fallback

If you don't want to set up an OAuth app, you can use a personal access token directly:

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Generate a token with the `read:packages` scope
3. In the app's search page, click **"Utiliser un token manuellement"** and paste your token

---

## Project structure

```
github-package-visualizer/
├── package.json              # root — runs client + server with concurrently
├── client/                   # Vite + React + TypeScript
│   └── src/
│       ├── App.tsx
│       ├── api/index.ts
│       ├── hooks/useGitHubAuth.ts
│       └── components/
│           ├── SearchBar.tsx
│           ├── VersionPicker.tsx
│           ├── FileTree.tsx
│           ├── FileViewer.tsx
│           └── GitHubAuthButton.tsx
└── server/                   # Express + TypeScript
    ├── .env                  # GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET (not committed)
    └── src/
        ├── index.ts
        ├── routes/
        │   ├── auth.ts       # OAuth login / callback / user
        │   └── package.ts    # metadata / download / file / cache
        └── services/
            └── packageService.ts
```

## Notes

- Downloaded packages are cached in the OS temp directory (`os.tmpdir()/pkg-visualizer-cache/<name>@<version>/`). The cache is reused on subsequent loads as long as the directory is non-empty.
- The Vite dev server proxies `/api/*` requests to `http://localhost:3001`. The OAuth login redirect must point directly to the Express server (`http://localhost:3001/api/auth/login`) because browser redirects bypass the Vite proxy.
