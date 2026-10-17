import { mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';

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
  renameSync(tmp, path);
}

export function appendJsonl(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(value) + '\n');
}

export interface Project {
  id: string;
  root: string;
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

export function getProject(id: string): Project {
  const project = listProjects().find((p) => p.id === id);
  if (!project) throw new Error(`Unknown project: ${id}`);
  return project;
}

// shortcut: audit is an append-only file, not tamper-proof; upgrade when multi-user (ARCHITECTURE 3.3, issue #5).
export function audit(event: Record<string, unknown>): void {
  appendJsonl(join(home(), 'audit.jsonl'), { at: new Date().toISOString(), ...event });
}
