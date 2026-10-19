#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { getRoles, setRole } from './roles.ts';
import { cacheTokens, loadSession, used, readEvents, turnRunning, turns, type Session } from './sessions.ts';
import { cancelTask, createTask, listTasks, migrateTasks, resumeTask, taskStatus, taskUsed, usageOf } from './tasks.ts';
import { getProject, getWorkspaceRoot, listProjects, migrateStorage, registerProject, setWorkspaceRoot } from './store.ts';

function budget(value: string | undefined, fallback: number): number {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid --budget: ${value}`);
  return n;
}

const usage = `Usage:
  ws project add <path> [--id <id>]
  ws project list
  ws run <goal> --project <id> [--role Implementation] [--budget <tokens>] [--mode <permission mode>]
  ws resume <taskId> [--budget <tokens>]
  ws status [taskId]
  ws cancel <taskId>
  ws ui [--port 4317]
  ws roles [<role> <integration> [model]]`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    project: { type: 'string' },
    role: { type: 'string', default: 'Implementation' },
    budget: { type: 'string' },
    mode: { type: 'string' },
    port: { type: 'string', default: '4317' },
  },
});

function show(s: Session): void {
  const ts = turns(readEvents(s.id), turnRunning(s.id));
  const u = usageOf(s.id);
  const tokens = u.inputTokens + u.outputTokens;
  const cached = cacheTokens(u);
  const last = ts.at(-1);
  const cost = u.costUsd === undefined ? '' : ` cost≈$${u.costUsd.toFixed(4)} (provider-reported)`;
  console.log(`${s.id} ${taskStatus(s, ts)}${last?.marker ? ` (${last.marker})` : ''} tokens=${taskUsed(s)}/${s.task!.tokenBudget} at real cost (own ${used(u)}: work=${tokens - cached}, prompt cache=${cached} counted at its price)${cost} integration=${s.integration}`);
  if (last?.text) console.log(last.text);
}

// Runs the task's pending turn in this process, so the terminal shows it to the end.
async function run(id: string): Promise<void> {
  const { runTurn } = await import('./turn.ts');
  await runTurn(id);
  const s = loadSession(id);
  show(s);
  if (taskStatus(s, turns(readEvents(id), false)) === 'failed') process.exitCode = 1;
}

const [cmd, ...rest] = positionals;
migrateStorage();
migrateTasks();
try {
  if (cmd === 'project' && rest[0] === 'add' && rest[1]) {
    const p = registerProject(resolve(rest[1]), values.id);
    console.log(`project ${p.id} -> ${p.root}`);
  } else if (cmd === 'project' && rest[0] === 'list') {
    for (const p of listProjects()) console.log(`${p.id} ${p.root}`);
  } else if (cmd === 'run' && rest[0] && values.project) {
    getProject(values.project);
    await run(createTask({ projectId: values.project, goal: rest.join(' '), role: values.role, tokenBudget: budget(values.budget, 200000), permissionMode: values.mode }).id);
  } else if (cmd === 'resume' && rest[0]) {
    resumeTask(rest[0], values.budget ? budget(values.budget, 0) : undefined);
    await run(rest[0]);
  } else if (cmd === 'status') {
    if (rest[0]) show(loadSession(rest[0]));
    else for (const s of listTasks()) show(s);
  } else if (cmd === 'cancel' && rest[0]) {
    show(cancelTask(rest[0]));
  } else if (cmd === 'turn' && rest[0]) {
    const { hostSession } = await import('./turn.ts');
    await hostSession(rest[0]);
  } else if (cmd === 'ui') {
    const { serve } = await import('./ui.ts');
    // First start from a source checkout: the repository is the workspace folder until the user picks another.
    // A packaged app has no checkout and starts without one.
    const repo = fileURLToPath(new URL('../..', import.meta.url));
    if (!getWorkspaceRoot() && existsSync(join(repo, '.git'))) setWorkspaceRoot(resolve(repo));
    // Run from a checkout, the workspace develops itself: its repository is a project, worked on in worktrees (selfdev-001).
    (await import('./worktrees.ts')).addAppProject();
    // Merged branches are removed at start and once a day, so forgotten ones cannot pile up.
    const { cleanupBranches } = await import('./branches.ts');
    const cleanup = () => { try { const gone = cleanupBranches(); if (gone.length) console.log(`Removed merged branches: ${gone.join(', ')}`); } catch (e) { console.error(`Branch cleanup failed: ${(e as Error).message}`); } };
    cleanup();
    setInterval(cleanup, 24 * 60 * 60 * 1000).unref();
    const server = serve(Number(values.port));
    server.on('listening', () => console.log(`Workspace UI: http://127.0.0.1:${(server.address() as { port: number }).port}/ (Ctrl+C stops the UI; tasks keep running)`));
  } else if (cmd === 'roles') {
    if (rest[0] && rest[1]) setRole(rest[0], { integration: rest[1], model: rest[2] });
    for (const [role, a] of Object.entries(getRoles())) console.log(`${role} -> ${a.integration}${a.model ? ` (${a.model})` : ''}`);
  } else {
    console.log(usage);
    process.exitCode = 2;
  }
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
