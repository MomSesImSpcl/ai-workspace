// Read-only catalog of every instruction the workspace writes for agents (agent-instructions-001–005, ADR 0022), for
// the Settings tab "Agent Instructions" in a development environment only (`instructionsAvailable`). Its entries are
// the instruction registry (app/src/registry.ts, agent-interface-007), the only place such text is defined; this file
// adds who gets each entry and where the code sends it, found by searching app/src for the entry's id. It lists what
// can be sent and when, not what a particular session received.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeHome, fileOr } from './adapters/claude-code.ts';
import { userCodexHome } from './adapters/codex.ts';
import { getSettings, type Capabilities, type SessionAgent } from './sessions.ts';
import { sessionAgents } from './turn.ts';
import { getAgentSetup, RULE_ROLES } from './setup.ts';
import { getWorkspaceRoot } from './store.ts';
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
// Outside sources: some belong to one agent, which loads them itself.
const BOTH: Agent[] = CATALOG_AGENTS;
const ALL: Applies = { Chat: BOTH, Orchestrator: BOTH, Implementer: BOTH };
const CLAUDE: Agent[] = ['claude-code'];
const CODEX: Agent[] = ['codex'];

/** The catalog as the agents set up now get it: an entry that needs a capability goes only to agents that report it. */
export function withCapabilities(agents: Record<string, Pick<SessionAgent, 'capabilities'>> = sessionAgents): InstructionEntry[] {
  return CATALOG.map((e) => {
    const needs = e.needs;
    if (!needs) return e;
    const applies = Object.fromEntries(Object.entries(e.applies).map(([role, list]) => [role, list!.filter((a) => agents[a]?.capabilities[needs])]));
    return { ...e, applies };
  });
}

/** How much of an outside source the workspace can show. */
export type Inspectable = 'shown' | 'file' | 'hidden' | 'unknown';

/** An instruction source the workspace does not write: the user's own text, rule files, the agents' own prompts. */
export interface ExternalSource {
  id: string;
  title: string;
  purpose: string;
  inspectable: Inspectable;
  applies: Applies;
  when: string;
  path?: string; // a file or folder on this computer, when known
  exists?: boolean;
  text?: string; // only for text the workspace holds itself (the Instructions fields)
}

/**
 * The sources agents also load, read now on this computer: paths, whether they exist and the Instructions fields. It
 * names what can load; it does not know what a running session loaded (each run records the rule files its agent
 * reported, `init.ruleFiles` in the session log).
 */
export function externalSources(): ExternalSource[] {
  const settings = getSettings();
  const globalRules = getAgentSetup().globalRules ?? {};
  const ws = getWorkspaceRoot();
  const file = (path?: string) => (path ? { path, exists: existsSync(path) } : {});
  const own = (key: 'chatInstructions' | 'orchestratorInstructions' | 'implementationInstructions', role: string, applies: Applies) => ({
    id: `own.${key}`, title: `Your instructions: ${role}`, purpose: "Text you wrote in Settings → Agents. The workspace adds it with the wrapper for the user's own instructions.", inspectable: 'shown' as const, applies,
    when: 'From the next agent start, while the field is not empty.', text: settings[key]?.trim() || '',
  });
  const rulesSwitch = RULE_ROLES.map((r) => `${r === 'Implementation' ? 'Implementer' : 'Orchestrator'} ${globalRules[r] ? 'on' : 'off'}`).join(', ');
  return [
    own('chatInstructions', 'Chat', { Chat: BOTH }),
    own('orchestratorInstructions', 'Orchestrator', { Orchestrator: BOTH }),
    own('implementationInstructions', 'Implementer', { Implementer: BOTH }),
    { id: 'workspace.agents-md', title: "Workspace folder's AGENTS.md", purpose: 'Rules for every project in the workspace folder. The workspace adds the file after its heading (see "The workspace folder\'s AGENTS.md").', inspectable: 'file',
      applies: { Orchestrator: BOTH, Implementer: BOTH }, when: 'Orchestrator chats and tasks of a project inside the workspace folder; not plain chats.', ...file(ws ? join(ws, 'AGENTS.md') : undefined) },
    { id: 'project.rules', title: 'Project rule files', purpose: "The project's own AGENTS.md, CLAUDE.md and rules folders. The agent finds and loads them itself.", inspectable: 'file', applies: ALL,
      when: 'Every run in a project, as the agent loads them anywhere else. Each run records the files the agent reported loading in the session log; the chat does not show them yet (sessions-016).' },
    { id: 'claude.global-rules', title: 'Claude Code global rules', purpose: 'Your global CLAUDE.md and rules folder, loaded in every project.', inspectable: 'file', applies: { Chat: CLAUDE, Orchestrator: CLAUDE, Implementer: CLAUDE },
      when: `Plain chats always; orchestrator chats and tasks only while their role's global rules switch is on (Settings → Agent setup; now: ${rulesSwitch}).`, ...file(fileOr(claudeHome(), 'CLAUDE.md')) },
    { id: 'codex.global-agents', title: 'Codex global AGENTS.md', purpose: 'Your global Codex rules, loaded in every project.', inspectable: 'file', applies: { Chat: CODEX, Orchestrator: CODEX, Implementer: CODEX },
      when: 'Every Codex run; Codex has no switch for one run, so the global rules switch does not apply.', ...file(join(userCodexHome(), 'AGENTS.md')) },
    { id: 'claude.system-prompt', title: "Claude Code's own system prompt", purpose: 'How Claude Code works with its tools, git and the environment, plus its built-in tool descriptions. Written by Anthropic and part of Claude Code.', inspectable: 'hidden', applies: { Chat: CLAUDE, Orchestrator: CLAUDE, Implementer: CLAUDE },
      when: 'Plain chats always; other runs unless their "own instructions" setup item is off, when the short workspace prompt replaces it.' },
    { id: 'codex.base-instructions', title: "Codex's own base instructions", purpose: 'Coding conventions, editing and sandbox guidance and answer format, plus its tool descriptions. Written by OpenAI and part of Codex.', inspectable: 'hidden', applies: { Chat: CODEX, Orchestrator: CODEX, Implementer: CODEX },
      when: 'Plain chats always; other runs unless their "own instructions" setup item is off, when the short workspace prompt replaces it.' },
    { id: 'codex.memories', title: 'Codex memories', purpose: 'What Codex remembers across sessions (about 3.8k tokens per call).', inspectable: 'hidden', applies: { Chat: CODEX, Orchestrator: CODEX, Implementer: CODEX },
      when: 'While its Memories setup item is on for the run, and in plain chats when Codex has it on.' },
    { id: 'claude.other', title: 'Claude Code memory, output style and managed settings', purpose: 'Claude Code can also load auto memory, an output style and managed settings. The workspace does not list or read them.', inspectable: 'unknown', applies: { Chat: CLAUDE, Orchestrator: CLAUDE, Implementer: CLAUDE },
      when: 'As Claude Code loads them; which ones apply to a run is not known here.' },
    { id: 'agent.extensions', title: 'Plugins, skills, MCP servers and hooks', purpose: 'Their own instructions, skill texts, server instructions and hook output. They are listed and switched in Settings → Agent setup; their text is not shown here.', inspectable: 'unknown', applies: ALL,
      when: 'Plain chats load your whole setup; orchestrator chats and tasks load the items switched on for the run.' },
  ];
}

/**
 * The development-environment gate of the Agent Instructions tab (ADR 0022): the running app's code is in a git
 * checkout (`appRepo` in app/src/worktrees.ts), the same condition Update and restart needs. A packaged app has no
 * checkout. Whether a release shows the tab is not decided yet.
 */
export const instructionsAvailable = (repo = appRepo()) => !!repo;
