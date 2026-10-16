import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { cancelRequested, liveUsage, loadTask, markBudgetStop, used } from './runtime.ts';
import { appendJsonl, audit, home } from './store.ts';

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

// Committed usage (incl. delegated children) plus the running step's streamed usage.
function budgetExhausted(taskId: string): boolean {
  const task = loadTask(taskId);
  const exhausted = used(task.usage) + used(liveUsage(taskId)) >= task.tokenBudget;
  if (exhausted) markBudgetStop(taskId);
  return exhausted;
}

// Every tool call passes here: cancel and budget first, then scope and write grant.
export function authorize(scope: Scope, tool: string, path?: string, needsWrite = false): string {
  const full = path === undefined ? '' : resolve(scope.root, path);
  const reason = cancelRequested(scope.taskId)
    ? 'task cancelled; stop now'
    : budgetExhausted(scope.taskId)
    ? 'token budget exhausted; stop and report progress'
    : path !== undefined && !inside(scope.root, full) ? 'outside project' : needsWrite && !scope.write ? 'write not granted' : null;
  audit({ kind: 'tool', taskId: scope.taskId, tool, path, allowed: reason === null, reason });
  if (reason) throw new DeniedError(`${tool} denied${path === undefined ? '' : ` for ${path}`}: ${reason}`);
  return full;
}

// Effect ledger: a side effect is keyed by task step, tool, input and its occurrence number within the
// attempt. A re-run of an interrupted step finds its committed effects and skips them, in order.
const occurrences = new Map<string, number>();
export const newAttempt = () => occurrences.clear(); // one MCP server process = one attempt; tests reset here
const ledgerPath = (taskId: string) => join(home(), 'tasks', `${taskId}.effects.jsonl`);

function committed(taskId: string): Map<string, string> {
  const path = ledgerPath(taskId);
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean) : [];
  return new Map(lines.map((l) => JSON.parse(l) as { key: string; result: string }).map((e) => [e.key, e.result]));
}

// fn throws to signal failure; failures are not recorded, so they are retried.
export async function once(scope: Scope, tool: string, input: unknown, fn: () => string | Promise<string>): Promise<string> {
  const id = `${loadTask(scope.taskId).steps}:${tool}:${createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16)}`;
  const n = (occurrences.get(id) ?? 0) + 1;
  occurrences.set(id, n);
  const key = `${id}:${n}`;
  const prior = committed(scope.taskId).get(key);
  if (prior !== undefined) {
    audit({ kind: 'tool', taskId: scope.taskId, tool, replayed: true, key });
    return `${prior} (already done before an interruption; not repeated)`;
  }
  const result = await fn();
  appendJsonl(ledgerPath(scope.taskId), { key, tool, result });
  return result;
}

export function listDir(scope: Scope, path: string): string[] {
  const full = authorize(scope, 'list_dir', path, false);
  return readdirSync(full, { withFileTypes: true }).map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
}

export function readFile(scope: Scope, path: string): string {
  return readFileSync(authorize(scope, 'read_file', path, false), 'utf8');
}

export function writeFile(scope: Scope, path: string, content: string): Promise<string> {
  const full = authorize(scope, 'write_file', path, true);
  return once(scope, 'write_file', { path, content }, () => {
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
    return `wrote ${path}`;
  });
}
