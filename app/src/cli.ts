#!/usr/bin/env node
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { adapterFor, getRoles, newRoleTask, setRole } from './roles.ts';
import { cancelTask, listTasks, loadTask, runTask, saveTask, type Task } from './runtime.ts';
import { getProject, listProjects, registerProject } from './store.ts';

function budget(value: string | undefined, fallback: number): number {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid --budget: ${value}`);
  return n;
}

const usage = `Usage:
  ws project add <path> [--id <id>]
  ws project list
  ws run <goal> --project <id> [--role Implementation] [--budget <tokens>] [--write]
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
    write: { type: 'boolean', default: false },
    port: { type: 'string', default: '4317' },
  },
});

function show(task: Task): void {
  const tokens = task.usage.inputTokens + task.usage.outputTokens;
  const cached = task.usage.cachedInputTokens ?? 0;
  const cost = task.usage.costUsd === undefined ? '' : ` cost≈$${task.usage.costUsd.toFixed(4)} (provider-reported)`;
  console.log(`${task.id} ${task.status}${task.reason ? ` (${task.reason})` : ''} steps=${task.steps} tokens=${tokens}/${task.tokenBudget} (work=${tokens - cached} cached=${cached})${cost} integration=${task.integration}`);
  if (task.result) console.log(task.result);
}

async function run(task: Task): Promise<void> {
  const result = await runTask(task.id, adapterFor(task.integration), getProject(task.projectId).root);
  show(result);
  if (result.status === 'failed') process.exitCode = 1;
}

const [cmd, ...rest] = positionals;
try {
  if (cmd === 'project' && rest[0] === 'add' && rest[1]) {
    const p = registerProject(resolve(rest[1]), values.id);
    console.log(`project ${p.id} -> ${p.root}`);
  } else if (cmd === 'project' && rest[0] === 'list') {
    for (const p of listProjects()) console.log(`${p.id} ${p.root}`);
  } else if (cmd === 'run' && rest[0] && values.project) {
    await run(newRoleTask({ projectId: values.project, goal: rest.join(' '), role: values.role, write: values.write, tokenBudget: budget(values.budget, 200000) }));
  } else if (cmd === 'resume' && rest[0]) {
    const task = loadTask(rest[0]);
    if (values.budget) task.tokenBudget = budget(values.budget, task.tokenBudget);
    saveTask(task);
    await run(task);
  } else if (cmd === 'status') {
    if (rest[0]) show(loadTask(rest[0]));
    else for (const task of listTasks()) show(task);
  } else if (cmd === 'cancel' && rest[0]) {
    show(cancelTask(rest[0]));
  } else if (cmd === 'ui') {
    const { serve } = await import('./ui.ts');
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
