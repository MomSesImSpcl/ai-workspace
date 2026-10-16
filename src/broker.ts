import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { audit } from './store.ts';

export interface Scope {
  taskId: string;
  root: string;
  write: boolean;
}

export class DeniedError extends Error {}

// Resolve through symlinks of the nearest existing ancestor, so links cannot escape the root.
function realish(path: string): string {
  let existing = path;
  while (!existsSync(existing)) existing = dirname(existing);
  return resolve(realpathSync(existing), relative(existing, path));
}

function inside(root: string, path: string): boolean {
  const rel = relative(realpathSync(root), realish(path));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function check(scope: Scope, tool: string, path: string, needsWrite: boolean): string {
  const full = resolve(scope.root, path);
  const reason = !inside(scope.root, full) ? 'outside project' : needsWrite && !scope.write ? 'write not granted' : null;
  audit({ kind: 'tool', taskId: scope.taskId, tool, path, allowed: reason === null, reason });
  if (reason) throw new DeniedError(`${tool} denied for ${path}: ${reason}`);
  return full;
}

export function listDir(scope: Scope, path: string): string[] {
  const full = check(scope, 'list_dir', path, false);
  return readdirSync(full, { withFileTypes: true }).map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
}

export function readFile(scope: Scope, path: string): string {
  return readFileSync(check(scope, 'read_file', path, false), 'utf8');
}

export function writeFile(scope: Scope, path: string, content: string): void {
  const full = check(scope, 'write_file', path, true);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}
