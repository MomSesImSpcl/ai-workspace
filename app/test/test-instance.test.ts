// A branch's test instance (selfdev-009): when it may start, and how it is isolated from the main instance.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installed, startTestInstance, testInstancePlan } from '../src/test-instance.ts';
import { testHome } from '../src/worktrees.ts';

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ws-test-instance-'));
  process.env.AI_WORKSPACE_HOME = join(dir, 'home');
  delete process.env.AI_WORKSPACE_TEST_BRANCH;
});

const lock = (d: string, done: boolean) => {
  mkdirSync(join(d, 'node_modules'), { recursive: true });
  writeFileSync(join(d, 'package-lock.json'), '{}');
  if (done) writeFileSync(join(d, 'node_modules', '.package-lock.json'), '{}');
};
// An app folder with an Electron binary, laid out as the electron package does.
const electronApp = (d: string) => {
  mkdirSync(join(d, 'node_modules', 'electron', 'dist'), { recursive: true });
  writeFileSync(join(d, 'node_modules', 'electron', 'path.txt'), 'electron.exe');
  writeFileSync(join(d, 'node_modules', 'electron', 'dist', 'electron.exe'), '');
};

test('installed needs a finished install in every folder with a package-lock.json', () => {
  const wt = join(dir, 'wt');
  mkdirSync(join(wt, 'app'), { recursive: true });
  assert.equal(installed(wt), false, 'nothing to install is not an installed app');
  lock(join(wt, 'app'), true);
  assert.equal(installed(wt), true);
  lock(wt, false); // the root's npm ci still running
  assert.equal(installed(wt), false);
});

test('the plan runs the worktree code with its own storage, data folder and branch', () => {
  const wt = join(dir, 'wt'), running = join(dir, 'running');
  electronApp(running);
  process.env.AI_WORKSPACE_FALLBACK = 'abc';
  const plan = testInstancePlan(wt, 'aiws/feature x', running);
  delete process.env.AI_WORKSPACE_FALLBACK;
  assert.equal(plan.electron, join(running, 'node_modules', 'electron', 'dist', 'electron.exe'), "the running app's Electron when the worktree has none");
  assert.equal(plan.storage, testHome('aiws/feature x'));
  assert.equal(plan.storage, join(dir, 'home', 'test', 'aiws_feature_x'));
  assert.deepEqual(plan.args, [join(wt, 'app'), `--user-data-dir=${join(plan.storage, 'electron')}`]);
  assert.equal(plan.env.AI_WORKSPACE_HOME, plan.storage);
  assert.equal(plan.env.AI_WORKSPACE_TEST_BRANCH, 'aiws/feature x');
  assert.equal(plan.env.AI_WORKSPACE_FALLBACK, undefined);
  electronApp(join(wt, 'app'));
  assert.equal(testInstancePlan(wt, 'b', running).electron, join(wt, 'app', 'node_modules', 'electron', 'dist', 'electron.exe'));
  assert.throws(() => testInstancePlan(join(dir, 'none'), 'b', join(dir, 'none')), /No Electron/);
});

test('a test instance is refused before install and inside another test instance', () => {
  const wt = join(dir, 'wt');
  mkdirSync(join(wt, 'app'), { recursive: true });
  assert.throws(() => startTestInstance(wt, 'b'), /not installed/);
  process.env.AI_WORKSPACE_TEST_BRANCH = 'other';
  assert.throws(() => startTestInstance(wt, 'b'), /cannot start another/);
});
