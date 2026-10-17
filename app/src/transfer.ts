// Export and import of workspace storage between computers (workspace-transfer, part 1).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { addProject, getWorkspaceRoot, home, listProjects, type Project } from './store.ts';

const VERSION = 1;
const TREES = ['projects', 'global', 'tasks', 'sessions']; // per-project layout, plus the old flat folders
const TOP = ['projects.json', 'roles.json', 'workspace.json', 'audit.jsonl'];
// Only meaningful while something runs on this computer (transfer-002).
const RUNTIME = /\.(pid|stop|cancel|budget-stop|tmp)$|\.live\.json$/;

interface Bundle { format: 'ai-workspace'; version: number; exportedAt: string; files: Record<string, string> }

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

// Storage paths in the bundle always use '/'.
const storagePath = (full: string) => relative(home(), full).split(sep).join('/');

export function exportStorage(target: string): { files: number } {
  const files: Record<string, string> = {};
  for (const name of TOP) if (existsSync(join(home(), name))) files[name] = readFileSync(join(home(), name)).toString('base64');
  for (const tree of TREES) for (const f of walk(join(home(), tree))) if (!RUNTIME.test(f)) files[storagePath(f)] = readFileSync(f).toString('base64');
  const bundle: Bundle = { format: 'ai-workspace', version: VERSION, exportedAt: new Date().toISOString(), files };
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, gzipSync(JSON.stringify(bundle)));
  return { files: Object.keys(files).length };
}

// An entry may only land in workspace storage (transfer-005).
function safe(path: string): boolean {
  const parts = path.split('/');
  if (isAbsolute(path) || /^[a-zA-Z]:/.test(path) || parts.some((p) => p === '..' || p === '' || p === '.' || p.includes('\\'))) return false;
  return parts.length === 1 ? TOP.includes(path) : TREES.includes(parts[0]!) && !RUNTIME.test(path);
}

export interface ProjectResult { id: string; root: string; outcome: 'present' | 'original folder' | 'found in workspace folder' | 'folder missing (archived)' }

export function importStorage(source: string): { sessions: number; tasks: number; projects: ProjectResult[] } {
  let bundle: Bundle;
  try { bundle = JSON.parse(gunzipSync(readFileSync(source)).toString('utf8')) as Bundle; } catch { throw new Error('Import failed: not an AI Workspace export file'); }
  if (bundle?.format !== 'ai-workspace' || bundle.version !== VERSION || typeof bundle.files !== 'object') throw new Error(`Import failed: unsupported export format (version ${bundle?.version})`);
  const unsafe = Object.keys(bundle.files).filter((p) => !safe(p));
  if (unsafe.length) throw new Error(`Import failed: entries outside workspace storage: ${unsafe.slice(0, 3).join(', ')}`);

  // Merge by id: an existing file is never overwritten, so a second import adds nothing.
  let sessions = 0;
  let tasks = 0;
  for (const [path, data] of Object.entries(bundle.files)) {
    if (!path.includes('/')) continue;
    const full = join(home(), ...path.split('/'));
    if (existsSync(full)) continue;
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, Buffer.from(data, 'base64'));
    if (/\/sessions\/[^/.]+\.json$|^sessions\/[^/.]+\.json$/.test(path)) sessions++;
    if (/\/tasks\/[^/.]+\.json$|^tasks\/[^/.]+\.json$/.test(path)) tasks++;
  }

  // Projects: link each to a folder on this computer, or keep it archived until its folder is added (transfer-004).
  const imported = bundle.files['projects.json'] ? (JSON.parse(Buffer.from(bundle.files['projects.json'], 'base64').toString('utf8')) as Project[]) : [];
  const local = new Set(listProjects().map((p) => p.id));
  const wsRoot = getWorkspaceRoot();
  const projects = imported.filter((p) => typeof p?.id === 'string' && typeof p.root === 'string').map((p): ProjectResult => {
    if (local.has(p.id)) return { id: p.id, root: p.root, outcome: 'present' };
    const nearby = wsRoot ? join(wsRoot, basename(p.root.replace(/[\\/]+$/, ''))) : undefined;
    const [root, outcome]: [string, ProjectResult['outcome']] = existsSync(p.root) ? [p.root, 'original folder']
      : nearby && existsSync(nearby) ? [nearby, 'found in workspace folder'] : [p.root, 'folder missing (archived)'];
    addProject({ id: p.id, root, archived: outcome === 'folder missing (archived)' || p.archived || undefined });
    return { id: p.id, root, outcome };
  });
  return { sessions, tasks, projects };
}
