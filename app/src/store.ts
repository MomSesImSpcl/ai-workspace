import { mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

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

export function getProject(id: string): Project {
  const project = listProjects().find((p) => p.id === id);
  if (!project) throw new Error(`Unknown project: ${id}`);
  return project;
}

// shortcut: audit is an append-only file, not tamper-proof; upgrade when multi-user (ARCHITECTURE 3.3).
export function audit(event: Record<string, unknown>): void {
  appendJsonl(join(home(), 'audit.jsonl'), { at: new Date().toISOString(), ...event });
}
