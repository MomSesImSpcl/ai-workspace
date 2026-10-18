import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { getWorkspaceRoot, home, readJson, writeJson } from './store.ts';
import { ORCHESTRATION, type Session } from './sessions.ts';

// What an agent loads (onboarding-010): each item can be switched on or off for one run. Skills that do not come
// from a plugin are one item, since Claude Code cannot switch them singly. `tool` is a built-in tool a task cannot
// work without (a task needs at least one), `feature` an optional built-in one, `prompt` the agent's own system prompt.
export type ItemKind = 'plugin' | 'mcp' | 'apps' | 'skills' | 'hooks' | 'tool' | 'feature' | 'prompt' | 'workspace';
// The workspace's own `delegate` tool for tasks: a task without it cannot hand work to a subtask.
export const DELEGATE: SetupItem = { id: 'delegate', kind: 'workspace', title: 'Delegate', description: "Hand a self-contained part to another workspace role's agent as a subtask" };
export interface SetupItem { id: string; kind: ItemKind; title: string; description?: string }
export type ItemState = 'on' | 'decide' | 'off';
export const SETUP_ROLES = [ORCHESTRATION, 'Implementation']; // roles whose agent runs with a chosen setup
export const RULE_ROLES = ['ArchitectureReasoning', ORCHESTRATION, 'Implementation']; // the global-rules switch per role

interface AgentSetup {
  inventory?: Record<string, SetupItem[]>; // per agent, as last listed
  states?: Record<string, Record<string, Record<string, ItemState>>>; // role -> agent -> item id -> state
  globalRules?: Record<string, boolean>; // role -> load the user's global rule files; unset: off
}
const path = () => join(home(), 'agent-setup.json');
export const getAgentSetup = (): AgentSetup => readJson<AgentSetup>(path(), {});
const update = (f: (s: AgentSetup) => void) => { const s = getAgentSetup(); f(s); writeJson(path(), s); };

export const saveInventory = (agent: string, items: SetupItem[]) => update((s) => { (s.inventory ??= {})[agent] = items; });
export function setItemState(role: string, agent: string, id: string, state: ItemState): void {
  if (!SETUP_ROLES.includes(role) || !['on', 'decide', 'off'].includes(state)) throw new Error(`Unknown role or state: ${role} ${state}`);
  update((s) => { ((s.states ??= {})[role] ??= {})[agent] = { ...s.states[role][agent], [id]: state }; });
}
export function setGlobalRules(role: string, on: boolean): void {
  if (!RULE_ROLES.includes(role)) throw new Error(`Unknown role: ${role}`);
  update((s) => { (s.globalRules ??= {})[role] = on; });
}

// The orchestrator starts with nothing extra; a task's items default to the orchestrator's choice (orchestrator-005).
export const stateOf = (setup: AgentSetup, role: string, agent: string, id: string): ItemState =>
  setup.states?.[role]?.[agent]?.[id] ?? (role === ORCHESTRATION ? 'off' : 'decide');

// Orchestrator chats and tasks run with a chosen setup; a plain chat keeps the user's full setup.
export const setupApplies = (s: Session) => !!s.task || s.role === ORCHESTRATION;

// What one run of this session loads. Items not listed stay on: only what the inventory names can be switched off.
export interface RunSetup { role: string; items: SetupItem[]; on: (item: SetupItem) => boolean; globalRules: boolean; workspaceRules?: string }
export const setupRole = (s: Pick<Session, 'task' | 'role'>) => (s.task ? (SETUP_ROLES.includes(s.role) ? s.role : 'Implementation') : s.role);
// Whether this run of the session loads the item: its role's state, or the orchestrator's pick. A task from the
// command line has no orchestrator to pick its items, so it gets every item the user allows.
export function itemOn(s: Session, id: string): boolean {
  const st = stateOf(getAgentSetup(), setupRole(s), s.integration, id);
  const all = !!s.task && !s.task.setup && !s.task.sessionId && !s.task.parentId;
  return st === 'on' || (st === 'decide' && (all || !!s.task?.setup?.includes(id)));
}

export function runSetup(s: Session, items: SetupItem[], root: string): RunSetup {
  const role = setupRole(s);
  const setup = getAgentSetup();
  const on = (i: SetupItem) => itemOn(s, i.id);
  return { role, items, on, globalRules: setup.globalRules?.[role] ?? false, workspaceRules: workspaceRules(root) };
}

// The workspace folder's own AGENTS.md, for a project inside it: neither agent loads a file above the project's
// git root (Claude Code reads a CLAUDE.md there but not its @-imports), so the workspace adds it.
export function workspaceRules(root: string): string | undefined {
  const ws = getWorkspaceRoot();
  if (!ws) return undefined;
  const rel = relative(ws, root);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return undefined;
  const file = join(ws, 'AGENTS.md');
  return existsSync(file) ? readFileSync(file, 'utf8').trim() || undefined : undefined;
}

// The items the orchestrator may add to a task of this agent, with what it needs to decide (list_agents).
export function decidable(agent: string, role = 'Implementation'): { id: string; title: string; description?: string }[] {
  const setup = getAgentSetup();
  return (setup.inventory?.[agent] ?? []).filter((i) => stateOf(setup, role, agent, i.id) === 'decide').map(({ id, title, description }) => ({ id, title, description }));
}

// The built-in tools a new task of this agent and role would get, or undefined when the agent lists none.
export function toolsFor(agent: string, role: string, picks: string[] = []): string[] | undefined {
  const setup = getAgentSetup();
  const tools = (setup.inventory?.[agent] ?? []).filter((i) => i.kind === 'tool');
  if (!tools.length) return undefined;
  return tools.filter((i) => { const st = stateOf(setup, role, agent, i.id); return st === 'on' || (st === 'decide' && picks.includes(i.id)); }).map((i) => i.id);
}

// A running task asks for items it is missing (orchestrator-005): they must be listed and not switched off by the user.
export function checkRequest(agent: string, role: string, ids: string[]): SetupItem[] {
  const setup = getAgentSetup();
  const items = ids.map((id) => (setup.inventory?.[agent] ?? []).find((i) => i.id === id) ?? id);
  const unknown = items.filter((i) => typeof i === 'string');
  if (unknown.length) throw new Error(`Unknown setup items for ${agent}: ${unknown.join(', ')}`);
  const off = ids.filter((id) => stateOf(setup, role, agent, id) === 'off');
  if (off.length) throw new Error(`The user switched these off for this role: ${off.join(', ')}`);
  return items as SetupItem[];
}

// A short system prompt for a run without the agent's own (the `prompt` item off).
export const minimalPrompt = (root: string) => `You are a coding agent working in ${root} on ${process.platform}. Today is ${new Date().toISOString().slice(0, 10)}.`;

export const WORKSPACE_RULES = "The workspace's own rules (its AGENTS.md), which apply to every project in it:";
