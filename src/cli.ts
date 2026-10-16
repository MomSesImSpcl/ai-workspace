#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { adapterFor, assignmentFor, getRoles, setRole } from './roles.ts';
import { createTask, loadTask, runTask, saveTask, type Task } from './runtime.ts';
import { addProject, getProject, home, listProjects } from './store.ts';

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
  ws roles [<role> <integration>]`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    project: { type: 'string' },
    role: { type: 'string', default: 'Implementation' },
    budget: { type: 'string' },
    write: { type: 'boolean', default: false },
  },
});

function show(task: Task): void {
  const tokens = task.usage.inputTokens + task.usage.outputTokens;
  const cost = task.usage.costUsd === undefined ? '' : ` cost≈$${task.usage.costUsd.toFixed(4)} (provider-reported)`;
  console.log(`${task.id} ${task.status}${task.reason ? ` (${task.reason})` : ''} steps=${task.steps} tokens=${tokens}/${task.tokenBudget}${cost} integration=${task.integration}`);
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
    const root = resolve(rest[1]);
    if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);
    addProject({ id: values.id ?? basename(root), root });
    console.log(`project ${values.id ?? basename(root)} -> ${root}`);
  } else if (cmd === 'project' && rest[0] === 'list') {
    for (const p of listProjects()) console.log(`${p.id} ${p.root}`);
  } else if (cmd === 'run' && rest[0] && values.project) {
    getProject(values.project);
    const { integration } = assignmentFor(values.role);
    adapterFor(integration); // fail before creating a task that cannot run
    const task = createTask({ projectId: values.project, goal: rest.join(' '), role: values.role, integration, write: values.write, tokenBudget: budget(values.budget, 200000) });
    await run(task);
  } else if (cmd === 'resume' && rest[0]) {
    const task = loadTask(rest[0]);
    if (values.budget) task.tokenBudget = budget(values.budget, task.tokenBudget);
    saveTask(task);
    await run(task);
  } else if (cmd === 'status') {
    if (rest[0]) show(loadTask(rest[0]));
    else for (const f of readdirSync(join(home(), 'tasks')).filter((f) => f.endsWith('.json'))) show(loadTask(f.slice(0, -5)));
  } else if (cmd === 'roles') {
    if (rest[0] && rest[1]) setRole(rest[0], { integration: rest[1] });
    for (const [role, a] of Object.entries(getRoles())) console.log(`${role} -> ${a.integration}`);
  } else {
    console.log(usage);
    process.exitCode = 2;
  }
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
