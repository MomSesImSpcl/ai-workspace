import { mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, writeFileSync, appendFileSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

// Workspace state lives outside projects: project content is untrusted for privilege decisions.
export function home(): string {
  return process.env.AI_WORKSPACE_HOME ?? join(homedir(), '.ai-workspace');
}

export function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
}

// Write to a temp file then rename, so a crash never leaves half-written state.
export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  // Windows refuses to replace a file another process has open for a moment (a poller reading it): retry briefly.
  for (let i = 0; ; i++) {
    try { return renameSync(tmp, path); } catch (e) {
      if (i >= 50 || !['EPERM', 'EACCES', 'EBUSY'].includes((e as NodeJS.ErrnoException).code ?? '')) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
}

export function appendJsonl(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(value) + '\n');
}

// Storage mirrors the workspace, so a person can find things by hand:
//   projects/<project name>/{sessions,tasks}/<id>.*  and  global/sessions/<id>.*
// Files are found by id; the folder only groups them.
export type StorageKind = 'tasks' | 'sessions';

// A project name as a folder name on every OS (Windows forbids these characters and device names).
export function folderName(name: string): string {
  let n = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '');
  if (!n || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(n)) n += '_';
  return n;
}

// '' is the global space (no project).
export const projectStorage = (projectId: string) => (projectId === '' ? join(home(), 'global') : join(home(), 'projects', folderName(projectId)));

const located = new Map<string, string>();
const locatedKey = (kind: StorageKind, id: string) => `${home()}|${kind}|${id}`;

// The folder for a new item of a project.
export function placeIn(kind: StorageKind, id: string, projectId: string): string {
  const dir = join(projectStorage(projectId), kind);
  located.set(locatedKey(kind, id), dir);
  return dir;
}

// Every folder that can hold items of a kind, including the flat folder used before this layout.
export function storageDirs(kind: StorageKind): string[] {
  const dirs = [join(home(), 'global', kind)];
  const projects = join(home(), 'projects');
  if (existsSync(projects)) for (const e of readdirSync(projects, { withFileTypes: true })) if (e.isDirectory()) dirs.push(join(projects, e.name, kind));
  dirs.push(join(home(), kind));
  return dirs.filter((d) => existsSync(d));
}

// The folder that holds an existing item.
export function storageDir(kind: StorageKind, id: string): string {
  const key = locatedKey(kind, id);
  const known = located.get(key);
  if (known) return known;
  const found = storageDirs(kind).find((d) => existsSync(join(d, `${id}.json`)));
  if (found) located.set(key, found);
  return found ?? join(home(), kind);
}

function pidAlive(pidFile: string): boolean {
  if (!existsSync(pidFile)) return false;
  try {
    process.kill(Number(readFileSync(pidFile, 'utf8')), 0);
    return true;
  } catch {
    return false;
  }
}

// Moves items from the flat tasks/ and sessions/ folders into their project's folder. Safe to run
// at every start and from several processes: an item whose runner is alive waits for a later run,
// and a file already moved by another process is skipped.
export function migrateStorage(): void {
  for (const kind of ['tasks', 'sessions'] as const) {
    const old = join(home(), kind);
    if (!existsSync(old)) continue;
    const files = readdirSync(old);
    for (const f of files.filter((name) => /^[^.]+\.json$/.test(name))) {
      const id = f.slice(0, -5);
      let record: { projectId?: unknown } | null;
      try { record = readJson<{ projectId?: unknown } | null>(join(old, f), null); } catch { continue; }
      if (typeof record?.projectId !== 'string' || pidAlive(join(old, `${id}.pid`))) continue;
      const target = placeIn(kind, id, record.projectId);
      mkdirSync(target, { recursive: true });
      for (const name of files.filter((g) => g.startsWith(`${id}.`))) {
        try { if (!existsSync(join(target, name))) renameSync(join(old, name), join(target, name)); } catch { /* moved by another process */ }
      }
    }
    try { if (readdirSync(old).length === 0) rmdirSync(old); } catch { /* still in use */ }
  }
}

export interface Project {
  id: string;
  root: string;
  archived?: boolean; // hidden from the workspace; its folder and workspace data are untouched
}

const projectsPath = () => join(home(), 'projects.json');

export function listProjects(): Project[] {
  return readJson<Project[]>(projectsPath(), []);
}

export function addProject(project: Project): void {
  const projects = listProjects().filter((p) => p.id !== project.id);
  writeJson(projectsPath(), [...projects, project]);
}

// Registers an existing directory as a project; the id defaults to the folder name.
export function registerProject(root: string, id = basename(root)): Project {
  if (!isAbsolute(root)) throw new Error(`Project path must be absolute: ${root}`);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);
  if (!id.trim()) throw new Error('Project id is required');
  const project = { id: id.trim(), root };
  addProject(project);
  return project;
}

// The workspace's root folder: where its projects usually live (identity-projects 1.4). Optional;
// projects outside it stay allowed.
const workspacePath = () => join(home(), 'workspace.json');
export const getWorkspaceRoot = (): string | undefined => readJson<{ root?: string }>(workspacePath(), {}).root;

export function setWorkspaceRoot(root: string): string {
  if (!isAbsolute(root)) throw new Error(`Workspace folder must be absolute: ${root}`);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);
  writeJson(workspacePath(), { root });
  return root;
}

// Archive is the only removal: the workspace never deletes a project folder or its history.
export function setProjectArchived(id: string, archived: boolean): Project {
  const project = { ...getProject(id), archived: archived || undefined };
  addProject(project);
  return project;
}

// Removes only the workspace's reference to a project. Its folder and the sessions, tasks and logs
// stored under its id stay; adding the folder again with the same name brings them back.
export function removeProject(id: string): void {
  getProject(id);
  writeJson(projectsPath(), listProjects().filter((p) => p.id !== id));
}

// Subfolders of the workspace folder that are not projects yet (hidden folders left out).
export function unaddedFolders(): string[] {
  const root = getWorkspaceRoot();
  if (!root || !existsSync(root)) return [];
  const known = new Set(listProjects().map((p) => resolve(p.root).toLowerCase()));
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => join(root, e.name))
    .filter((f) => !known.has(resolve(f).toLowerCase()));
}

export function getProject(id: string): Project {
  const project = listProjects().find((p) => p.id === id);
  if (!project) throw new Error(`Unknown project: ${id}`);
  return project;
}

// shortcut: audit is an append-only file, not tamper-proof; upgrade when multi-user (ARCHITECTURE 3.3, issue #5).
export function audit(event: Record<string, unknown>): void {
  appendJsonl(join(home(), 'audit.jsonl'), { at: new Date().toISOString(), ...event });
}
