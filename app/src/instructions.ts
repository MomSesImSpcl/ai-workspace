// Read-only catalog of every instruction the workspace writes for agents (agent-instructions-001–005, ADR 0022), for
// the Settings tab "Agent Instructions" in a development environment only (`instructionsAvailable`). Its entries are
// the instruction registry (app/src/registry.ts, agent-interface-007), the only place such text is defined; this file
// adds who gets each entry and where the code sends it, found by searching app/src for the entry's id. It lists what
// can be sent and when, not what a particular session received.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Capabilities, type SessionAgent } from './sessions.ts';
import { sessionAgents } from './turn.ts';
import { appRepo } from './worktrees.ts';
import { GROUPS, REGISTRY, ROLES, type Entry } from './registry.ts';

export { GROUPS };
/** The roles the catalog tells apart: plain chats, orchestrator chats and tasks (the Implementer role, whatever role a task started with). Tasks do not start tasks (ADR 0024). */
export const CATALOG_ROLES = ROLES;
export type CatalogRole = (typeof CATALOG_ROLES)[number];
/** The agent integrations an entry can apply to: the registered adapters (`sessionAgents`, app/src/turn.ts), so a new agent needs no edit here. */
export const CATALOG_AGENTS = Object.keys(sessionAgents);
type Agent = string;
/** Which agents get the entry in each role; a role that is missing gets it with no agent. */
type Applies = Partial<Record<CatalogRole, Agent[]>>;

/** One workspace-authored instruction: what it is for, when it is sent, to whom, and its exact text. */
export interface InstructionEntry {
  id: string; // the registry id, for links and tests
  group: string; // purpose group in the list
  title: string;
  description: string; // what it is for and when it is sent
  textBecause: string; // why it is text and not code (agent-interface-008)
  toCode?: string; // what of it could become code
  text: string; // exact text; `{name}` marks a value filled in at run time, explained in `placeholders`
  params?: { name: string; text: string }[]; // a tool's parameter descriptions, as the agent sees them
  variants?: { label: string; text: string }[]; // other forms of the same message, each with when it is used
  applies: Applies;
  sources: { file: string; symbol: string }[]; // repository-relative file and the line that sends it
  placeholders?: Record<string, string>;
  needs?: keyof Capabilities; // only agents with this capability get it (`withCapabilities`)
}

const SRC = fileURLToPath(new URL('.', import.meta.url));
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith('.ts') ? [join(dir, d.name)] : []));

/** Where each registry id is sent from: every line of app/src outside the registry that names it in quotes. */
function sendSites(): Map<string, { file: string; symbol: string }[]> {
  const out = new Map<string, { file: string; symbol: string }[]>();
  for (const f of files(SRC).filter((f) => !/[\\/](registry|instructions)\.ts$/.test(f))) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const [, id] of line.matchAll(/'([\w.-]+)'/g)) {
        if (!(id! in REGISTRY)) continue;
        if (!out.has(id!)) out.set(id!, []);
        out.get(id!)!.push({ file: relative(REPO, f).replaceAll('\\', '/'), symbol: `line ${i + 1}` });
      }
    });
  }
  return out;
}

/** Every workspace-authored agent-facing instruction, as the registry defines it. */
export const CATALOG: InstructionEntry[] = (() => {
  const sites = sendSites();
  return Object.entries(REGISTRY as Record<string, Entry>).map(([id, e]) => ({
    id, group: e.group, title: e.title, description: e.description, textBecause: e.textBecause, toCode: e.toCode, text: e.text,
    params: e.params && Object.entries(e.params).map(([name, text]) => ({ name, text })),
    variants: e.variants && Object.values(e.variants),
    applies: Object.fromEntries(e.roles.map((r) => [r, CATALOG_AGENTS])) as Applies,
    sources: sites.get(id) ?? [], placeholders: e.placeholders, needs: e.needs,
  }));
})();

/** The catalog as the agents set up now get it: an entry that needs a capability goes only to agents that report it. */
export function withCapabilities(agents: Record<string, Pick<SessionAgent, 'capabilities'>> = sessionAgents): InstructionEntry[] {
  return CATALOG.map((e) => {
    const needs = e.needs;
    if (!needs) return e;
    const applies = Object.fromEntries(Object.entries(e.applies).map(([role, list]) => [role, list!.filter((a) => agents[a]?.capabilities[needs])]));
    return { ...e, applies };
  });
}

/**
 * The development-environment gate of the Agent Instructions tab (ADR 0022): the running app's code is in a git
 * checkout (`appRepo` in app/src/worktrees.ts), the same condition Update and restart needs. A packaged app has no
 * checkout. Whether a release shows the tab is not decided yet.
 */
export const instructionsAvailable = (repo = appRepo()) => !!repo;
