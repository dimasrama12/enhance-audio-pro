# Enhance Audio Pro — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Phase 1 scaffold: Tauri v2 app shell, drag-and-drop file ingestion into a SQLite queue, queue data grid UI, settings panel, setup wizard, and Python FastAPI sidecar with health check.

**Architecture:** Three-process desktop app — React frontend calls Tauri `invoke` → Rust core manages SQLite and spawns a PyInstaller-compiled Python FastAPI sidecar. Real-time events will flow Python → Tauri event bus → React in Phase 2; Phase 1 wires the channel structure with no live processing.

**Tech Stack:** Tauri v2, React 18, TypeScript 5 (strict), Vite 5, Tailwind CSS v3, Framer Motion v11, Zustand v4, lucide-react, rusqlite (bundled), FastAPI, Uvicorn, Vitest, Pytest

---

## Prerequisites

Before starting any task:
- **Install Rust:** `winget install Rustlang.Rustup` → restart terminal → verify `rustc --version` and `cargo --version`
- Node.js v24+ and npm v11+ confirmed present
- Python 3.11 confirmed present

---

## File Map

```
[root]/
├── package.json
├── tsconfig.json / tsconfig.node.json
├── vite.config.ts
├── index.html
├── tailwind.config.js / postcss.config.js
│
├── src/
│   ├── main.tsx / App.tsx / index.css / vite-env.d.ts
│   ├── types/
│   │   ├── ipc.ts          — IpcResponse<T>
│   │   ├── queue.ts        — QueueJob, MediaType, JobStatus
│   │   └── settings.ts     — AppSettings, DEFAULT_SETTINGS
│   ├── stores/
│   │   ├── useQueueStore.ts
│   │   ├── useSettingsStore.ts
│   │   └── __tests__/useQueueStore.test.ts, useSettingsStore.test.ts
│   ├── lib/
│   │   ├── ipc.ts          — typed invoke wrappers
│   │   ├── fileValidation.ts
│   │   └── __tests__/fileValidation.test.ts
│   └── components/
│       ├── TitleBar.tsx / Sidebar.tsx
│       ├── DropZone.tsx
│       ├── QueueGrid.tsx / QueueToolbar.tsx
│       ├── SettingsPanel.tsx
│       └── SetupWizard.tsx
│
├── src-tauri/
│   ├── Cargo.toml / build.rs / tauri.conf.json
│   ├── capabilities/default.json
│   └── src/
│       ├── main.rs / lib.rs
│       ├── commands/mod.rs, queue.rs, settings.rs
│       ├── db/mod.rs, migrations.rs, queue.rs
│       └── sidecar/mod.rs, manager.rs
│
└── backend/
    ├── main.py
    ├── requirements.txt / requirements-dev.txt
    ├── pyproject.toml
    ├── backend.spec
    ├── routers/__init__.py, health.py, queue.py
    └── tests/__init__.py, test_health.py
```

---

## Task 1: Project Scaffold (Config Files + npm install)

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `tailwind.config.js`, `postcss.config.js`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "enhance-audio-pro",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "lint": "eslint . --ext ts,tsx",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-shell": "^2",
    "@tauri-apps/plugin-store": "^2",
    "clsx": "^2",
    "framer-motion": "^11",
    "lucide-react": "^0.441.0",
    "react": "^18",
    "react-dom": "^18",
    "tailwind-merge": "^2",
    "zustand": "^4"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@vitejs/plugin-react": "^4",
    "autoprefixer": "^10",
    "jsdom": "^24",
    "postcss": "^8",
    "tailwindcss": "^3",
    "typescript": "^5",
    "vite": "^5",
    "vitest": "^1"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Write tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Write vite.config.ts**

```typescript
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
});
```

- [ ] **Step 5: Write index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Enhance Audio Pro</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 7: Write postcss.config.js**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 8: Install dependencies**

```bash
npm install
```

Expected: node_modules created, no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts index.html tailwind.config.js postcss.config.js
git commit -m "chore: scaffold Vite + React + TypeScript + Tailwind project config"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/ipc.ts`, `src/types/queue.ts`, `src/types/settings.ts`

- [ ] **Step 1: Create src/types/ipc.ts**

```typescript
export interface IpcResponse<T = null> {
  success: boolean;
  data: T | null;
  error: string | null;
}
```

- [ ] **Step 2: Create src/types/queue.ts**

```typescript
export type MediaType = 'audio' | 'video';
export type JobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface QueueJob {
  id: string;
  filename: string;
  filepath: string;
  destination: string;
  size_bytes: number;
  media_type: MediaType;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: Create src/types/settings.ts**

```typescript
export interface AppSettings {
  theme: 'dark' | 'light';
  outputFolder: string;
  language: string;
  setupComplete: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  outputFolder: '',
  language: 'en',
  setupComplete: false,
};
```

- [ ] **Step 4: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript types for IPC, queue, and settings"
```

---

## Task 3: File Validation Utility + Tests

**Files:**
- Create: `src/lib/fileValidation.ts`, `src/lib/__tests__/fileValidation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/fileValidation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateFile, getFilename } from '../fileValidation';

describe('validateFile', () => {
  it('accepts mp3 as audio', () => {
    const result = validateFile('my-track.mp3');
    expect(result.valid).toBe(true);
    expect(result.mediaType).toBe('audio');
    expect(result.error).toBeNull();
  });

  it('accepts mp4 as video', () => {
    const result = validateFile('clip.mp4');
    expect(result.valid).toBe(true);
    expect(result.mediaType).toBe('video');
  });

  it('rejects unsupported extensions', () => {
    const result = validateFile('document.pdf');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('.pdf');
    expect(result.mediaType).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(validateFile('track.MP3').valid).toBe(true);
    expect(validateFile('clip.MOV').valid).toBe(true);
  });

  it('handles files without extension', () => {
    expect(validateFile('noextension').valid).toBe(false);
  });
});

describe('getFilename', () => {
  it('extracts filename from Windows path', () => {
    expect(getFilename('C:\\Users\\User\\Music\\track.mp3')).toBe('track.mp3');
  });

  it('extracts filename from Unix path', () => {
    expect(getFilename('/home/user/music/track.mp3')).toBe('track.mp3');
  });

  it('returns input unchanged when no separator', () => {
    expect(getFilename('track.mp3')).toBe('track.mp3');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../fileValidation'`

- [ ] **Step 3: Create src/lib/fileValidation.ts**

```typescript
import type { MediaType } from '@/types/queue';

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma', 'aiff', 'ape',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', 'ts', 'mts', 'm2ts',
]);

export interface ValidationResult {
  valid: boolean;
  mediaType: MediaType | null;
  error: string | null;
}

export function validateFile(filename: string): ValidationResult {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (AUDIO_EXTENSIONS.has(ext)) return { valid: true, mediaType: 'audio', error: null };
  if (VIDEO_EXTENSIONS.has(ext)) return { valid: true, mediaType: 'video', error: null };
  return { valid: false, mediaType: null, error: `Unsupported format: .${ext || '(none)'}` };
}

export function getFilename(filepath: string): string {
  return filepath.split(/[\\/]/).pop() ?? filepath;
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm test
```

Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/
git commit -m "feat: add file validation utility with tests"
```

---

## Task 4: Zustand Stores + Tests

**Files:**
- Create: `src/stores/useQueueStore.ts`, `src/stores/useSettingsStore.ts`, `src/stores/__tests__/useQueueStore.test.ts`, `src/stores/__tests__/useSettingsStore.test.ts`

- [ ] **Step 1: Write failing useQueueStore test**

Create `src/stores/__tests__/useQueueStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useQueueStore } from '../useQueueStore';
import type { QueueJob } from '@/types/queue';

const makeJob = (overrides: Partial<QueueJob> = {}): QueueJob => ({
  id: 'test-id',
  filename: 'test.mp3',
  filepath: '/tmp/test.mp3',
  destination: '',
  size_bytes: 1024,
  media_type: 'audio',
  status: 'pending',
  created_at: '2026-05-20T00:00:00Z',
  updated_at: '2026-05-20T00:00:00Z',
  ...overrides,
});

describe('useQueueStore', () => {
  beforeEach(() => {
    useQueueStore.setState({ jobs: [], filter: 'all', searchQuery: '' });
  });

  it('adds jobs', () => {
    useQueueStore.getState().addJobs([makeJob()]);
    expect(useQueueStore.getState().jobs).toHaveLength(1);
  });

  it('filters by status', () => {
    useQueueStore.setState({
      jobs: [makeJob({ id: '1', status: 'pending' }), makeJob({ id: '2', status: 'done' })],
      filter: 'done',
    });
    const results = useQueueStore.getState().filteredJobs();
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('done');
  });

  it('filters by search query', () => {
    useQueueStore.setState({
      jobs: [makeJob({ id: '1', filename: 'podcast.mp3' }), makeJob({ id: '2', filename: 'music.wav' })],
      searchQuery: 'podcast',
    });
    expect(useQueueStore.getState().filteredJobs()).toHaveLength(1);
  });

  it('clears queue', () => {
    useQueueStore.setState({ jobs: [makeJob()] });
    useQueueStore.getState().clearQueue();
    expect(useQueueStore.getState().jobs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../useQueueStore'`

- [ ] **Step 3: Create src/stores/useQueueStore.ts**

```typescript
import { create } from 'zustand';
import type { QueueJob } from '@/types/queue';

interface QueueState {
  jobs: QueueJob[];
  filter: string;
  searchQuery: string;
  setJobs: (jobs: QueueJob[]) => void;
  addJobs: (jobs: QueueJob[]) => void;
  setFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
  clearQueue: () => void;
  filteredJobs: () => QueueJob[];
}

export const useQueueStore = create<QueueState>((set, get) => ({
  jobs: [],
  filter: 'all',
  searchQuery: '',
  setJobs: (jobs) => set({ jobs }),
  addJobs: (newJobs) => set((s) => ({ jobs: [...s.jobs, ...newJobs] })),
  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clearQueue: () => set({ jobs: [] }),
  filteredJobs: () => {
    const { jobs, filter, searchQuery } = get();
    return jobs
      .filter((j) => filter === 'all' || j.status === filter)
      .filter((j) => !searchQuery || j.filename.toLowerCase().includes(searchQuery.toLowerCase()));
  },
}));
```

- [ ] **Step 4: Write failing useSettingsStore test**

Create `src/stores/__tests__/useSettingsStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../useSettingsStore';
import { DEFAULT_SETTINGS } from '@/types/settings';

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, initialized: false });
  });

  it('has dark theme by default', () => {
    expect(useSettingsStore.getState().theme).toBe('dark');
  });

  it('sets theme', () => {
    useSettingsStore.getState().setTheme('light');
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('marks setup complete', () => {
    useSettingsStore.getState().markSetupComplete();
    expect(useSettingsStore.getState().setupComplete).toBe(true);
  });

  it('sets output folder', () => {
    useSettingsStore.getState().setOutputFolder('D:\\Output');
    expect(useSettingsStore.getState().outputFolder).toBe('D:\\Output');
  });
});
```

- [ ] **Step 5: Create src/stores/useSettingsStore.ts**

```typescript
import { create } from 'zustand';
import type { AppSettings } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

interface SettingsState extends AppSettings {
  initialized: boolean;
  setSettings: (s: AppSettings) => void;
  setTheme: (theme: AppSettings['theme']) => void;
  setOutputFolder: (folder: string) => void;
  setLanguage: (language: string) => void;
  markSetupComplete: () => void;
  setInitialized: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  initialized: false,
  setSettings: (s) => set({ ...s }),
  setTheme: (theme) => set({ theme }),
  setOutputFolder: (outputFolder) => set({ outputFolder }),
  setLanguage: (language) => set({ language }),
  markSetupComplete: () => set({ setupComplete: true }),
  setInitialized: (initialized) => set({ initialized }),
}));
```

- [ ] **Step 6: Run all tests — verify they pass**

```bash
npm test
```

Expected: PASS — all tests green.

- [ ] **Step 7: Commit**

```bash
git add src/stores/
git commit -m "feat: add Zustand queue and settings stores with tests"
```

---

## Task 5: IPC Wrappers + App Entry Files

**Files:**
- Create: `src/lib/ipc.ts`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`

- [ ] **Step 1: Create src/lib/ipc.ts**

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { IpcResponse } from '@/types/ipc';
import type { QueueJob } from '@/types/queue';
import type { AppSettings } from '@/types/settings';

export async function invokeAddFiles(paths: string[]): Promise<IpcResponse<QueueJob[]>> {
  return invoke<IpcResponse<QueueJob[]>>('add_files', { paths });
}

export async function invokeGetQueue(): Promise<IpcResponse<QueueJob[]>> {
  return invoke<IpcResponse<QueueJob[]>>('get_queue');
}

export async function invokeGetSettings(): Promise<IpcResponse<AppSettings>> {
  return invoke<IpcResponse<AppSettings>>('get_settings');
}

export async function invokeSaveSettings(settings: AppSettings): Promise<IpcResponse<null>> {
  return invoke<IpcResponse<null>>('save_settings', { settings });
}
```

- [ ] **Step 2: Create src/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 3: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  -webkit-user-select: none;
  user-select: none;
}

input,
textarea {
  -webkit-user-select: text;
  user-select: text;
}

body {
  margin: 0;
  background: #0a0a0a;
}
```

- [ ] **Step 4: Create src/main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 5: Create src/App.tsx**

```typescript
import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useQueueStore } from '@/stores/useQueueStore';
import { invokeGetSettings, invokeGetQueue } from '@/lib/ipc';
import SetupWizard from '@/components/SetupWizard';
import TitleBar from '@/components/TitleBar';
import Sidebar from '@/components/Sidebar';
import DropZone from '@/components/DropZone';
import QueueToolbar from '@/components/QueueToolbar';
import QueueGrid from '@/components/QueueGrid';

export default function App(): JSX.Element {
  const { theme, setupComplete, setSettings, setInitialized } = useSettingsStore();
  const { setJobs } = useQueueStore();

  useEffect(() => {
    async function init(): Promise<void> {
      const [settingsRes, queueRes] = await Promise.all([
        invokeGetSettings(),
        invokeGetQueue(),
      ]);
      if (settingsRes.success && settingsRes.data) setSettings(settingsRes.data);
      if (queueRes.success && queueRes.data) setJobs(queueRes.data);
      setInitialized(true);
    }
    init();
  }, [setSettings, setJobs, setInitialized]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  if (!setupComplete) return <SetupWizard />;

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-white overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-col flex-1 overflow-hidden p-4 gap-3">
          <DropZone />
          <QueueToolbar />
          <QueueGrid />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/ipc.ts src/main.tsx src/App.tsx src/index.css src/vite-env.d.ts
git commit -m "feat: add IPC wrappers and React app entry"
```

---

## Task 6: UI Components

**Files:**
- Create: `src/components/TitleBar.tsx`, `src/components/Sidebar.tsx`, `src/components/DropZone.tsx`, `src/components/QueueToolbar.tsx`, `src/components/QueueGrid.tsx`, `src/components/SettingsPanel.tsx`, `src/components/SetupWizard.tsx`

- [ ] **Step 1: Create src/components/TitleBar.tsx**

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings } from '@/lib/ipc';
import type { AppSettings } from '@/types/settings';

export default function TitleBar(): JSX.Element {
  const store = useSettingsStore();
  const win = getCurrentWindow();

  const toggleTheme = async (): Promise<void> => {
    const next = store.theme === 'dark' ? 'light' : 'dark';
    store.setTheme(next);
    const settings: AppSettings = {
      theme: next,
      outputFolder: store.outputFolder,
      language: store.language,
      setupComplete: store.setupComplete,
    };
    await invokeSaveSettings(settings);
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-10 px-4 bg-neutral-950 select-none shrink-0"
    >
      <span className="text-sm font-semibold text-white/70" data-tauri-drag-region>
        Enhance Audio Pro
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="text-white/40 hover:text-white text-xs w-6 h-6 flex items-center justify-center transition-colors"
        >
          {store.theme === 'dark' ? '☀' : '☾'}
        </button>
        <button onClick={() => win.minimize()} className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors">
          <Minus size={12} />
        </button>
        <button onClick={() => win.toggleMaximize()} className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors">
          <Square size={12} />
        </button>
        <button onClick={() => win.close()} className="p-1.5 rounded hover:bg-red-500 text-white/50 hover:text-white transition-colors">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create src/components/SettingsPanel.tsx**

```typescript
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings } from '@/lib/ipc';
import type { AppSettings } from '@/types/settings';

interface Props { open: boolean; onClose: () => void; }

const LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'id', label: 'Indonesian' },
  { code: 'zh', label: 'Chinese' }, { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },  { code: 'fr', label: 'French' },
  { code: 'ja', label: 'Japanese' },
];

export default function SettingsPanel({ open, onClose }: Props): JSX.Element {
  const store = useSettingsStore();

  const save = async (patch: Partial<AppSettings>): Promise<void> => {
    const next: AppSettings = {
      theme: store.theme, outputFolder: store.outputFolder,
      language: store.language, setupComplete: store.setupComplete, ...patch,
    };
    store.setSettings(next);
    await invokeSaveSettings(next);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40"
          />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-80 bg-neutral-900 border-l border-white/10 z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-semibold">Settings</h2>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
              <section>
                <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">Appearance</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Theme</span>
                  <div className="flex rounded-lg overflow-hidden border border-white/20">
                    {(['dark', 'light'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => save({ theme: t })}
                        className={`px-3 py-1 text-xs capitalize transition-colors ${store.theme === t ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white'}`}
                      >{t}</button>
                    ))}
                  </div>
                </div>
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">Output</h3>
                <label className="text-sm block mb-2">Default Output Folder</label>
                <input
                  type="text" readOnly value={store.outputFolder || 'Not set'}
                  className="w-full px-3 py-1.5 bg-white/10 rounded-lg text-sm text-white/60 outline-none"
                />
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase text-white/40 mb-3">Language</h3>
                <select
                  value={store.language}
                  onChange={(e) => save({ language: e.target.value })}
                  className="w-full bg-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-neutral-800">{l.label}</option>
                  ))}
                </select>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Create src/components/Sidebar.tsx**

```typescript
import { useState } from 'react';
import { Music, Video, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import SettingsPanel from '@/components/SettingsPanel';

type Tab = 'audio' | 'video';

export default function Sidebar(): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('audio');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tabs: { id: Tab; label: string; Icon: typeof Music }[] = [
    { id: 'audio', label: 'Audio', Icon: Music },
    { id: 'video', label: 'Video', Icon: Video },
  ];

  return (
    <>
      <aside className="flex flex-col w-16 bg-neutral-950 items-center py-4 gap-2 shrink-0">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              'flex flex-col items-center gap-1 p-2 rounded-lg w-12 transition-colors',
              activeTab === id ? 'bg-violet-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
            )}
          >
            <Icon size={18} />
            <span className="text-[9px] font-medium">{label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Settings size={18} />
        </button>
      </aside>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
```

- [ ] **Step 4: Create src/components/DropZone.tsx**

```typescript
import { useEffect, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { validateFile, getFilename } from '@/lib/fileValidation';
import { invokeAddFiles } from '@/lib/ipc';
import { useQueueStore } from '@/stores/useQueueStore';

interface FileDropPayload { paths: string[]; }

export default function DropZone(): JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addJobs } = useQueueStore();

  const handleFiles = useCallback(async (paths: string[]): Promise<void> => {
    const valid = paths.filter((p) => validateFile(getFilename(p)).valid);
    const skipped = paths.length - valid.length;

    if (valid.length === 0) {
      setError('No supported audio or video files found.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const res = await invokeAddFiles(valid);
    if (res.success && res.data) {
      addJobs(res.data);
      if (skipped > 0) {
        setError(`${skipped} unsupported file(s) skipped.`);
        setTimeout(() => setError(null), 3000);
      }
    } else {
      setError(res.error ?? 'Failed to add files.');
      setTimeout(() => setError(null), 3000);
    }
  }, [addJobs]);

  useEffect(() => {
    const cleanup: (() => void)[] = [];
    Promise.all([
      listen<FileDropPayload>('tauri://file-drop', async (e) => {
        setIsDragging(false);
        await handleFiles(e.payload.paths);
      }),
      listen('tauri://file-drop-hover', () => setIsDragging(true)),
      listen('tauri://file-drop-cancelled', () => setIsDragging(false)),
    ]).then((fns) => cleanup.push(...fns));
    return () => cleanup.forEach((fn) => fn());
  }, [handleFiles]);

  return (
    <div className={clsx(
      'flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed transition-colors shrink-0',
      isDragging ? 'border-violet-400 bg-violet-500/10' : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
    )}>
      <motion.div
        animate={{ scale: isDragging ? 1.1 : 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className="flex flex-col items-center gap-2 text-white/50"
      >
        <Upload size={24} />
        <span className="text-sm">Drop audio or video files here</span>
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-xs text-red-400 mt-2">{error}</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 5: Create src/components/QueueToolbar.tsx**

```typescript
import { Search, Trash2 } from 'lucide-react';
import { useQueueStore } from '@/stores/useQueueStore';

const FILTERS = [
  { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' }, { value: 'done', label: 'Done' },
  { value: 'error', label: 'Error' },
];

export default function QueueToolbar(): JSX.Element {
  const { filter, searchQuery, setFilter, setSearchQuery, clearQueue } = useQueueStore();

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className="relative flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-white/10 rounded-lg text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-violet-500 transition"
        />
      </div>
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="bg-white/10 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-violet-500 transition"
      >
        {FILTERS.map((f) => (
          <option key={f.value} value={f.value} className="bg-neutral-800">{f.label}</option>
        ))}
      </select>
      <button
        onClick={clearQueue}
        title="Clear queue"
        className="p-2 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Create src/components/QueueGrid.tsx**

```typescript
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useQueueStore } from '@/stores/useQueueStore';
import type { QueueJob, JobStatus } from '@/types/queue';

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: 'text-yellow-400',
  processing: 'text-blue-400',
  done: 'text-green-400',
  error: 'text-red-400',
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function JobRow({ job, index }: { job: QueueJob; index: number }): JSX.Element {
  return (
    <motion.tr
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: index * 0.03 }}
      className="border-b border-white/5 hover:bg-white/5 transition-colors"
    >
      <td className="px-4 py-2 text-white/30 text-xs w-10">{index + 1}</td>
      <td className="px-4 py-2 text-sm text-white truncate max-w-[200px]">{job.filename}</td>
      <td className="px-4 py-2 text-xs text-white/50 truncate max-w-[160px]">{job.destination || '—'}</td>
      <td className="px-4 py-2 text-xs text-white/50 w-24">{formatBytes(job.size_bytes)}</td>
      <td className="px-4 py-2 text-xs uppercase text-white/40 w-20">{job.media_type}</td>
      <td className={clsx('px-4 py-2 text-xs font-medium capitalize w-28', STATUS_COLORS[job.status])}>
        {job.status}
      </td>
    </motion.tr>
  );
}

export default function QueueGrid(): JSX.Element {
  const jobs = useQueueStore((s) => s.filteredJobs());

  return (
    <div className="flex-1 overflow-auto rounded-xl bg-white/5">
      <table className="w-full text-left table-fixed">
        <thead>
          <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wider sticky top-0 bg-neutral-900/80 backdrop-blur">
            <th className="px-4 py-2 w-10">#</th>
            <th className="px-4 py-2">Filename</th>
            <th className="px-4 py-2">Destination</th>
            <th className="px-4 py-2 w-24">Size</th>
            <th className="px-4 py-2 w-20">Type</th>
            <th className="px-4 py-2 w-28">Status</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-white/30 text-sm">
                  No files in queue. Drop audio or video files above to get started.
                </td>
              </tr>
            ) : (
              jobs.map((job, i) => <JobRow key={job.id} job={job} index={i} />)
            )}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: Create src/components/SetupWizard.tsx**

```typescript
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { invokeSaveSettings } from '@/lib/ipc';

export default function SetupWizard(): JSX.Element {
  const [loading, setLoading] = useState(false);
  const store = useSettingsStore();

  const handleStart = async (): Promise<void> => {
    setLoading(true);
    // Phase 2: replace with real model download + progress events from Python
    await new Promise<void>((r) => setTimeout(r, 600));
    store.markSetupComplete();
    await invokeSaveSettings({
      theme: store.theme,
      outputFolder: store.outputFolder,
      language: store.language,
      setupComplete: true,
    });
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-neutral-900 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 max-w-sm w-full text-center px-4"
      >
        <div className="p-4 rounded-2xl bg-violet-600/20">
          <Wand2 size={40} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">Welcome to Enhance Audio Pro</h1>
          <p className="text-white/50 text-sm">AI-powered audio enhancement — fully offline.</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 w-full text-left">
          <h3 className="text-sm font-semibold mb-3">Required AI Models</h3>
          <div className="flex flex-col gap-2 text-xs text-white/60">
            <div className="flex justify-between"><span>DeepFilterNet (noise removal)</span><span>~200 MB</span></div>
            <div className="flex justify-between"><span>Demucs htdemucs (stem separation)</span><span>~83 MB</span></div>
          </div>
          <p className="text-xs text-white/30 mt-3">Model download wires up in Phase 2.</p>
        </div>
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? 'Setting up…' : 'Get Started'}
        </button>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/
git commit -m "feat: add all Phase 1 UI components"
```

---

## Task 7: Tauri v2 Rust Scaffold

**Files:**
- Create: `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/db/mod.rs`, `src-tauri/src/sidecar/mod.rs`

**Prerequisite:** Rust must be installed before this task. Verify: `rustc --version`

- [ ] **Step 1: Create src-tauri/Cargo.toml**

```toml
[package]
name = "enhance-audio-pro"
version = "0.1.0"
description = "Enhance Audio Pro"
authors = []
license = ""
repository = ""
default-run = "enhance-audio-pro"
edition = "2021"
rust-version = "1.77.2"

[lib]
name = "enhance_audio_pro_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-store = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }

[profile.dev]
incremental = true

[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
```

- [ ] **Step 2: Create src-tauri/build.rs**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 3: Create src-tauri/tauri.conf.json**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Enhance Audio Pro",
  "version": "0.1.0",
  "identifier": "com.enhanceaudiopro.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "Enhance Audio Pro",
        "width": 1200,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "decorations": false,
        "fileDrop": {
          "enabled": true
        }
      }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "externalBin": ["binaries/backend"]
  }
}
```

- [ ] **Step 4: Create src-tauri/capabilities/default.json**

```json
{
  "$schema": "https://schema.tauri.app/schema/capabilities/2.json",
  "identifier": "default",
  "description": "Default app capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-spawn",
    "shell:allow-kill",
    "dialog:allow-open",
    "store:allow-get",
    "store:allow-set",
    "store:allow-save",
    "store:allow-load"
  ]
}
```

- [ ] **Step 5: Create src-tauri/src/main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    enhance_audio_pro_lib::run()
}
```

- [ ] **Step 6: Create module stubs**

Create `src-tauri/src/commands/mod.rs`:
```rust
pub mod queue;
pub mod settings;
```

Create `src-tauri/src/db/mod.rs`:
```rust
pub mod migrations;
pub mod queue;
```

Create `src-tauri/src/sidecar/mod.rs`:
```rust
pub mod manager;
```

- [ ] **Step 7: Create src-tauri/src/lib.rs**

```rust
use tauri::Manager;

mod commands;
mod db;
mod sidecar;

use commands::queue::{add_files, get_queue};
use commands::settings::{get_settings, save_settings};

pub struct AppState {
    pub db: std::sync::Mutex<rusqlite::Connection>,
    pub backend_port: u16,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;

            let db_path = data_dir.join("app.db");
            let conn = rusqlite::Connection::open(&db_path)
                .map_err(|e| e.to_string())?;
            db::migrations::run_migrations(&conn)
                .map_err(|e| e.to_string())?;

            let port = sidecar::manager::available_port();
            sidecar::manager::spawn(app.handle(), port)?;

            app.manage(AppState {
                db: std::sync::Mutex::new(conn),
                backend_port: port,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            add_files,
            get_queue,
            get_settings,
            save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 8: Verify Cargo compiles (no icons needed yet)**

```bash
cd src-tauri && cargo check
```

Expected: Errors about missing `commands/queue.rs` etc. — that's fine, those come in Task 8. If you get dependency fetch errors, check your internet connection.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/
git commit -m "chore: add Tauri v2 Rust project scaffold"
```

---

## Task 8: SQLite Database Layer

**Files:**
- Create: `src-tauri/src/db/migrations.rs`, `src-tauri/src/db/queue.rs`

- [ ] **Step 1: Create src-tauri/src/db/migrations.rs**

```rust
use rusqlite::{Connection, Result};

pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS queue_jobs (
            id          TEXT PRIMARY KEY,
            filename    TEXT NOT NULL,
            filepath    TEXT NOT NULL,
            destination TEXT NOT NULL DEFAULT '',
            size_bytes  INTEGER NOT NULL DEFAULT 0,
            media_type  TEXT NOT NULL,
            status      TEXT NOT NULL DEFAULT 'pending',
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );",
    )
}
```

- [ ] **Step 2: Create src-tauri/src/db/queue.rs**

```rust
use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueueJob {
    pub id: String,
    pub filename: String,
    pub filepath: String,
    pub destination: String,
    pub size_bytes: i64,
    pub media_type: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

pub fn insert_job(conn: &Connection, job: &QueueJob) -> Result<()> {
    conn.execute(
        "INSERT INTO queue_jobs
         (id, filename, filepath, destination, size_bytes, media_type, status, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            job.id, job.filename, job.filepath, job.destination,
            job.size_bytes, job.media_type, job.status,
            job.created_at, job.updated_at,
        ],
    )?;
    Ok(())
}

pub fn get_all_jobs(conn: &Connection) -> Result<Vec<QueueJob>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, filepath, destination, size_bytes, media_type, status, created_at, updated_at
         FROM queue_jobs ORDER BY created_at ASC",
    )?;
    stmt.query_map([], |row| Ok(QueueJob {
        id: row.get(0)?,
        filename: row.get(1)?,
        filepath: row.get(2)?,
        destination: row.get(3)?,
        size_bytes: row.get(4)?,
        media_type: row.get(5)?,
        status: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    }))?.collect()
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/db/
git commit -m "feat: add SQLite migrations and queue CRUD"
```

---

## Task 9: Tauri Commands

**Files:**
- Create: `src-tauri/src/commands/queue.rs`, `src-tauri/src/commands/settings.rs`

- [ ] **Step 1: Create src-tauri/src/commands/queue.rs**

```rust
use tauri::State;
use serde::Serialize;
use std::fs;
use uuid::Uuid;
use chrono::Utc;
use crate::AppState;
use crate::db::queue::{QueueJob, insert_job, get_all_jobs};

#[derive(Serialize)]
pub struct IpcResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T: Serialize> IpcResponse<T> {
    pub fn ok(data: T) -> Self {
        IpcResponse { success: true, data: Some(data), error: None }
    }
    pub fn err(msg: impl Into<String>) -> Self {
        IpcResponse { success: false, data: None, error: Some(msg.into()) }
    }
}

const AUDIO_EXT: &[&str] = &["mp3","wav","flac","aac","m4a","ogg","opus","wma","aiff","ape"];
const VIDEO_EXT: &[&str] = &["mp4","mov","avi","mkv","wmv","flv","webm","m4v","ts","mts","m2ts"];

fn detect_media_type(path: &str) -> Option<&'static str> {
    let ext = std::path::Path::new(path).extension()?.to_str()?.to_lowercase();
    if AUDIO_EXT.iter().any(|e| *e == ext) { return Some("audio"); }
    if VIDEO_EXT.iter().any(|e| *e == ext) { return Some("video"); }
    None
}

#[tauri::command]
pub fn add_files(paths: Vec<String>, state: State<'_, AppState>) -> IpcResponse<Vec<QueueJob>> {
    let conn = match state.db.lock() {
        Ok(c) => c,
        Err(_) => return IpcResponse::err("DB lock failed"),
    };
    let now = Utc::now().to_rfc3339();
    let mut added = Vec::new();

    for path in &paths {
        let Some(media_type) = detect_media_type(path) else { continue };
        let Ok(meta) = fs::metadata(path) else { continue };
        let filename = std::path::Path::new(path)
            .file_name().and_then(|n| n.to_str()).unwrap_or(path).to_string();

        let job = QueueJob {
            id: Uuid::new_v4().to_string(),
            filename,
            filepath: path.clone(),
            destination: String::new(),
            size_bytes: meta.len() as i64,
            media_type: media_type.to_string(),
            status: "pending".to_string(),
            created_at: now.clone(),
            updated_at: now.clone(),
        };

        if insert_job(&conn, &job).is_ok() {
            added.push(job);
        }
    }
    IpcResponse::ok(added)
}

#[tauri::command]
pub fn get_queue(state: State<'_, AppState>) -> IpcResponse<Vec<QueueJob>> {
    match state.db.lock() {
        Ok(conn) => match get_all_jobs(&conn) {
            Ok(jobs) => IpcResponse::ok(jobs),
            Err(e) => IpcResponse::err(e.to_string()),
        },
        Err(_) => IpcResponse::err("DB lock failed"),
    }
}
```

- [ ] **Step 2: Create src-tauri/src/commands/settings.rs**

```rust
use tauri::{AppHandle, State};
use tauri_plugin_store::StoreExt;
use serde::{Deserialize, Serialize};
use crate::AppState;
use super::queue::IpcResponse;

const STORE_FILE: &str = "settings.json";

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    pub output_folder: String,
    #[serde(default = "default_language")]
    pub language: String,
    pub setup_complete: bool,
}

fn default_theme() -> String { "dark".into() }
fn default_language() -> String { "en".into() }

#[tauri::command]
pub fn get_settings(app: AppHandle, _state: State<'_, AppState>) -> IpcResponse<AppSettings> {
    let store = match app.store(STORE_FILE) {
        Ok(s) => s,
        Err(_) => return IpcResponse::ok(AppSettings::default()),
    };
    let settings: AppSettings = store
        .get("settings")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    IpcResponse::ok(settings)
}

#[tauri::command]
pub fn save_settings(settings: AppSettings, app: AppHandle, _state: State<'_, AppState>) -> IpcResponse<bool> {
    let store = match app.store(STORE_FILE) {
        Ok(s) => s,
        Err(e) => return IpcResponse::err(e.to_string()),
    };
    let value = match serde_json::to_value(&settings) {
        Ok(v) => v,
        Err(e) => return IpcResponse::err(e.to_string()),
    };
    if let Err(e) = store.set("settings", value) {
        return IpcResponse::err(e.to_string());
    }
    if let Err(e) = store.save() {
        return IpcResponse::err(e.to_string());
    }
    IpcResponse::ok(true)
}
```

- [ ] **Step 3: Verify Rust compiles**

```bash
cd src-tauri && cargo check
```

Expected: Only missing sidecar/manager.rs errors remain.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/
git commit -m "feat: add Tauri commands for queue and settings"
```

---

## Task 10: Sidecar Manager

**Files:**
- Create: `src-tauri/src/sidecar/manager.rs`

- [ ] **Step 1: Create src-tauri/src/sidecar/manager.rs**

```rust
use std::net::TcpListener;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

pub fn available_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
        .unwrap_or(8765)
}

pub fn spawn(app: &AppHandle, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    app.shell()
        .sidecar("backend")
        .map_err(|e| e.to_string())?
        .env("BACKEND_PORT", port.to_string())
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 2: Full Rust compile check**

```bash
cd src-tauri && cargo check
```

Expected: Compiles clean (warnings about unused imports are OK, errors are not).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/sidecar/
git commit -m "feat: add Python sidecar lifecycle manager"
```

---

## Task 11: Python FastAPI Backend

**Files:**
- Create: `backend/main.py`, `backend/routers/__init__.py`, `backend/routers/health.py`, `backend/routers/queue.py`, `backend/requirements.txt`, `backend/requirements-dev.txt`, `backend/pyproject.toml`, `backend/tests/__init__.py`, `backend/tests/test_health.py`, `backend/backend.spec`

- [ ] **Step 1: Create backend/requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
```

- [ ] **Step 2: Create backend/requirements-dev.txt**

```
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2
pyinstaller==6.10.0
```

- [ ] **Step 3: Create backend/pyproject.toml**

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = ["."]
```

- [ ] **Step 4: Install Python dependencies**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
```

Expected: Packages install without errors.

- [ ] **Step 5: Write failing Python test**

Create `backend/tests/__init__.py` (empty file).

Create `backend/tests/test_health.py`:

```python
import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_health_returns_ok():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_process_returns_501():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/queue/process")
    assert response.status_code == 501
```

- [ ] **Step 6: Run test — verify it fails**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 7: Create backend/routers/__init__.py** (empty file)

- [ ] **Step 8: Create backend/routers/health.py**

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 9: Create backend/routers/queue.py**

```python
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/queue")


@router.post("/process")
async def process_job() -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={"detail": "Audio processing available in Phase 2."},
    )
```

- [ ] **Step 10: Create backend/main.py**

```python
import os
import uvicorn
from fastapi import FastAPI
from routers import health, queue

app = FastAPI(title="Enhance Audio Pro Backend", version="0.1.0")
app.include_router(health.router)
app.include_router(queue.router)

if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
```

- [ ] **Step 11: Run tests — verify they pass**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: PASS — 2 tests green.

- [ ] **Step 12: Create backend/backend.spec** (PyInstaller — for Phase 5 packaging)

```python
# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        'uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto',
        'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan', 'uvicorn.lifespan.on',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='backend',
    debug=False,
    strip=False,
    upx=True,
    console=False,
    target_arch=None,
)
```

- [ ] **Step 13: Commit**

```bash
git add backend/
git commit -m "feat: add Python FastAPI sidecar with health and queue placeholder endpoints"
```

---

## Task 12: App Icons (Placeholder)

Tauri requires icon files to build. Generate or place placeholder icons before running `tauri dev`.

- [ ] **Step 1: Generate placeholder icons using Tauri CLI**

```bash
npx tauri icon public/icon.png
```

If you don't have a `public/icon.png`, create a 1024×1024 PNG (any color) and run the command. This generates all required sizes into `src-tauri/icons/`.

Alternatively, download the Tauri default icons:
```bash
npx tauri icon https://tauri.app/img/tauri.png
```

- [ ] **Step 2: Verify icons exist**

```bash
ls src-tauri/icons/
```

Expected: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`

- [ ] **Step 3: Create binaries/ placeholder directory**

The sidecar path `binaries/backend` must exist for `cargo check` but the `.exe` is only needed for `tauri build`. For `tauri dev`, Tauri looks for the sidecar relative to the project.

```bash
mkdir -p src-tauri/binaries
```

Add a note file:
```bash
echo "Place compiled backend.exe here for production builds." > src-tauri/binaries/README.txt
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/icons/ src-tauri/binaries/
git commit -m "chore: add app icons and sidecar binaries directory"
```

---

## Task 13: First Dev Run + Integration Test

- [ ] **Step 1: Run frontend tests one final time**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run Python tests**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: 2 tests pass.

- [ ] **Step 3: Run Tauri dev (requires Rust installed)**

```bash
npm run tauri dev
```

Expected: Vite dev server starts on port 1420, Tauri window opens. First run downloads Rust crates (~2–5 min).

- [ ] **Step 4: Manual integration checklist**

Run through each item in the running app:

- [ ] Window opens without native title bar (custom TitleBar visible)
- [ ] Setup Wizard screen appears on first launch (setupComplete = false)
- [ ] Click "Get Started" → main app loads
- [ ] Dark mode active by default; theme toggle in TitleBar works
- [ ] Sidebar shows Audio / Video tabs; active tab highlights
- [ ] Settings panel slides in from right when ⚙ icon clicked
- [ ] Theme toggle in Settings panel updates UI instantly
- [ ] Drop a `.mp3` or `.mp4` file onto the DropZone → row appears in QueueGrid with correct filename and size
- [ ] Drop a `.pdf` file → error message "No supported audio or video files found"
- [ ] Search bar filters queue rows by filename
- [ ] Status filter dropdown filters by job status
- [ ] Trash icon clears the queue grid

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 complete — app shell, queue grid, drag-drop ingestion, settings, setup wizard"
git push origin master
```

---

## Self-Review: Spec Coverage Check

| Spec requirement | Covered by task |
|---|---|
| App shell: titlebar, sidebar, tab layout | Tasks 6, 13 |
| Dark/light mode toggle, persisted | Tasks 6, 9 |
| Setup Wizard UI | Task 6 |
| Drag-and-drop DropZone with file-type validation | Tasks 3, 6 |
| `add_files` Tauri command + SQLite insert | Tasks 8, 9 |
| Queue data grid: columns, filter, search | Tasks 4, 6 |
| Settings panel: theme, output folder, language | Tasks 6, 9 |
| Python FastAPI sidecar with `/health` | Task 11 |
| Rust sidecar lifecycle (spawn) | Task 10 |
| SQLite migration runner on first launch | Tasks 7, 8 |

All 10 Phase 1 deliverables are covered. ✓
