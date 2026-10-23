// A branch's test instance (selfdev-009): the worktree's own app code as a second window next to the main one, with
// its own storage and Electron data folder, so it never touches the main instance's projects, chats or tasks.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { electronIn } from './restart.ts';
import { home } from './store.ts';
import { testHome } from './worktrees.ts';

/** The branch a test instance runs, set in its environment; unset in the main instance. */
export const testBranch = () => process.env.AI_WORKSPACE_TEST_BRANCH || undefined;

/** The workspace settings a test instance starts with: roles, agent setup and instructions, workspace folder. */
export const SETTINGS_FILES = ['roles.json', 'agent-setup.json', 'settings.json', 'workspace.json'];

/** Whether every folder of the worktree with a `package-lock.json` has a finished install (npm writes `node_modules/.package-lock.json` last). */
export function installed(path: string): boolean {
  const dirs = [path, join(path, 'app')].filter((d) => existsSync(join(d, 'package-lock.json')));
  return dirs.length > 0 && dirs.every((d) => existsSync(join(d, 'node_modules', '.package-lock.json')));
}

/** What starts the test instance of `branch` from the worktree at `path`, without starting it. */
export function testInstancePlan(path: string, branch: string, running = fileURLToPath(new URL('..', import.meta.url))) {
  const app = join(path, 'app');
  // Worktrees skip Electron's binary (#26), so the running app's Electron starts the worktree's code.
  const electron = electronIn(app) ?? electronIn(running);
  if (!electron) throw new Error('No Electron to start the test instance with: run `npm ci` in the app folder.');
  const storage = testHome(branch);
  const env: NodeJS.ProcessEnv = { ...process.env, AI_WORKSPACE_HOME: storage, AI_WORKSPACE_TEST_BRANCH: branch };
  delete env.AI_WORKSPACE_FALLBACK;
  delete env.AI_WORKSPACE_REPO;
  return { electron, args: [app, `--user-data-dir=${join(storage, 'electron')}`], cwd: app, env, storage };
}

/**
 * Starts the test instance: copies the main instance's settings into its storage, then starts its Electron. A second
 * start with the same data folder finds the first one's lock and only brings its window to the front.
 */
export function startTestInstance(path: string, branch: string): void {
  if (testBranch()) throw new Error('A test instance cannot start another one.');
  if (!installed(path)) throw new Error(`The dependencies of ${branch} are not installed yet.`);
  const plan = testInstancePlan(path, branch);
  mkdirSync(plan.storage, { recursive: true });
  for (const f of SETTINGS_FILES) if (existsSync(join(home(), f))) copyFileSync(join(home(), f), join(plan.storage, f));
  spawn(plan.electron, plan.args, { cwd: plan.cwd, env: plan.env, detached: true, stdio: 'ignore' }).unref();
}
