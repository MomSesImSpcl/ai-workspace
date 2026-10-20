import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { home } from '../store.ts';
import { GUARD_MARK, guardFor } from '../worktrees.ts';
import { forget, guardServer, guardToken } from '../guard.ts';
import { MERGE_NOTE } from '../merge.ts';
import { commandFile, DELEGATE, minimalPrompt, runSetup, saveInventory, setupApplies, WORKSPACE_RULES, type SetupItem } from '../setup.ts';
import { addUsage, fingerprint, type AgentProcess, type Body, type Catalog, type Session, type SessionAgent, type TurnEnd, type TurnInput, type Usage, ORCHESTRATION, orchestratorNote, ORCHESTRATOR_TOOLS, ownInstructions, READ_REPO_NOTE, TASK_NOTE } from '../sessions.ts';

// Claude Code with its own tools, settings and permission rules (ADR 0004). Its "ask" prompts go to the
// workspace server, which shows them as approval cards (sessions-019) and offers tasks `delegate`.

interface ClaudeResult {
  subtype: string;
  is_error: boolean;
  result?: string;
  session_id: string;
  total_cost_usd?: number;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
}

type ClaudeUsage = NonNullable<ClaudeResult['usage']>;
const tokens = (u: ClaudeUsage): Usage => ({
  inputTokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
  outputTokens: u.output_tokens ?? 0,
  cachedInputTokens: u.cache_read_input_tokens ?? 0,
  cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
});

export function parseResult(line: string): { text?: string; error?: string; usage: Usage } {
  const r = JSON.parse(line) as ClaudeResult;
  const usage = { ...tokens(r.usage ?? {}), costUsd: r.total_cost_usd };
  if (r.is_error || r.subtype !== 'success') return { error: r.result || r.subtype, usage };
  return { text: r.result, usage };
}

const workspaceServer = fileURLToPath(new URL('../approval-server.ts', import.meta.url));
const repeatHook = fileURLToPath(new URL('../repeat-hook.ts', import.meta.url));
const guardHook = fileURLToPath(new URL('../guard-hook.ts', import.meta.url));

const outsideRoot = (root: string, p: string) => {
  const r = relative(root, resolve(root, p));
  return r.startsWith('..') || isAbsolute(r);
};
const rel = (root: string, p: string) => (outsideRoot(root, p) ? p : relative(root, resolve(root, p)).replaceAll('\\', '/'));
// Long enough to show in full on hover; the page cuts each step to one line.
const short = (s: string, n = 400) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// A readable label for one tool call, for the live activity list (sessions-007).
export function activityLabel(name: string, input: Record<string, unknown>, root: string): { label: string; outside?: boolean } {
  const path = (input.file_path ?? input.notebook_path) as string | undefined;
  const s = (k: string) => short(String(input[k] ?? ''));
  if (path && ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(name)) return { label: `Editing \`${rel(root, path)}\``, outside: outsideRoot(root, path) || undefined };
  if (path && name === 'Read') return { label: `Reading \`${rel(root, path)}\`` };
  if (name === 'Bash' || name === 'PowerShell') return { label: `Running \`${s('command')}\`` }; // PowerShell: Claude Code's shell tool on Windows
  if (name === 'Grep') return { label: `Searching for \`${s('pattern')}\`` };
  if (name === 'Glob') return { label: `Finding \`${s('pattern')}\`` };
  if (name === 'WebFetch') return { label: `Fetching ${s('url')}` };
  if (name === 'WebSearch') return { label: `Searching the web: ${s('query')}` };
  if (name === 'Task' || name === 'Agent') return { label: `Delegating: ${s('description')}` };
  if (name === 'TodoWrite') return { label: 'Updating the to-do list' };
  if (name === 'mcp__aiws__delegate') return { label: `Subtask: ${s('goal')}` };
  if (name === 'mcp__aiws__start_task') return { label: `Starting task: ${s('goal')}` };
  // Any other tool: its name and the first text it was given, so the step says what it worked on.
  const first = Object.values(input).find((v) => typeof v === 'string' && v.trim());
  return { label: `Using ${name.replace(/^mcp__/, '').replaceAll('__', ' ')}${first ? `: ${short(first as string)}` : ''}` };
}

interface StreamLine {
  type: string;
  subtype?: string;
  session_id?: string;
  permissionMode?: string;
  memory_paths?: unknown;
  model?: string;
  content?: string;
  level?: string;
  prevent_continuation?: boolean;
  plugins?: { name: string; path?: string }[];
  mcp_servers?: { name: string; status: string }[];
  skills?: unknown[];
  event?: { type: string; delta?: { type: string; text?: string } };
  message?: { id?: string; usage?: ClaudeUsage; content?: { type: string; id?: string; name?: string; input?: Record<string, unknown>; tool_use_id?: string; is_error?: boolean; content?: string | { type: string; text?: string }[] }[] };
}

// Maps one stream-json line to contract events; text arrives as deltas (--include-partial-messages).
// `usage` is one assistant message's usage so far (later lines of the same message supersede it).
export function sessionEvents(line: string, root: string): { events: Body[]; sessionId?: string; result?: ReturnType<typeof parseResult>; usage?: { id: string; usage: Usage } } {
  if (!line.startsWith('{')) return { events: [] };
  const e = JSON.parse(line) as StreamLine;
  if (e.type === 'system' && e.subtype === 'init') {
    const paths = Array.isArray(e.memory_paths) ? e.memory_paths : e.memory_paths && typeof e.memory_paths === 'object' ? Object.values(e.memory_paths) : [];
    const ruleFiles = paths.map((p) => (typeof p === 'string' ? p : String((p as { path?: string }).path ?? JSON.stringify(p))));
    // Built-in plugins ship with Claude Code; the workspace's own server (aiws) is not the user's. Claude Code drops a server named "workspace".
    const plugins = e.plugins?.filter((p) => p.path !== 'builtin').map((p) => p.name);
    const mcp = e.mcp_servers?.filter((m) => m.name !== 'aiws').map(({ name, status }) => ({ name, status }));
    return { events: [{ type: 'init', model: e.model, permissionMode: e.permissionMode, ruleFiles, plugins, mcp, skills: e.skills?.length }], sessionId: e.session_id };
  }
  // Warnings Claude Code shows in its own UI, for example a plugin hook that dropped the prompt.
  if (e.type === 'system' && e.subtype === 'informational' && e.content) return { events: [{ type: 'notice', text: e.content, blocked: e.prevent_continuation || undefined }] };
  if (e.type === 'stream_event' && e.event?.type === 'content_block_delta' && e.event.delta?.type === 'text_delta') return { events: [{ type: 'text', text: e.event.delta.text ?? '' }] };
  if (e.type === 'assistant') {
    const events = (e.message?.content ?? []).filter((b) => b.type === 'tool_use' && b.id)
      .map((b) => ({ type: 'activity' as const, id: b.id!, ...activityLabel(b.name ?? '', b.input ?? {}, root), fp: fingerprint(b.name ?? '', b.input ?? {}) }));
    return { events, usage: e.message?.id && e.message.usage ? { id: e.message.id, usage: tokens(e.message.usage) } : undefined };
  }
  if (e.type === 'user') {
    const results = (e.message?.content ?? []).filter((b) => b.type === 'tool_result' && b.tool_use_id);
    const events: Body[] = results.map((b) => ({ type: 'activity-done' as const, id: b.tool_use_id!, error: b.is_error || undefined }));
    // A write the guard hook denied is also shown to the user (selfdev-002): the first paragraph of its reason.
    for (const b of results.filter((r) => r.is_error)) {
      const text = typeof b.content === 'string' ? b.content : (b.content ?? []).map((c) => c.text ?? '').join('');
      const at = text.indexOf(GUARD_MARK);
      if (at >= 0) events.push({ type: 'notice', text: text.slice(at).split('\n\n')[0]! });
    }
    return { events };
  }
  if (e.type === 'result') return { events: [], result: parseResult(line), sessionId: e.session_id };
  return { events: [] };
}

// The file inside a folder when it exists, else the folder, so the user is shown what to look for.
export const fileOr = (dir: string, file: string) => (existsSync(join(dir, file)) ? join(dir, file) : dir);
export const claudeHome = () => process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
const readJsonFile = <T>(file: string): T | undefined => { try { return JSON.parse(readFileSync(file, 'utf8')) as T; } catch { return undefined; } };
type ClaudeSettings = { enabledPlugins?: Record<string, boolean>; hooks?: Record<string, unknown[]> } & Record<string, unknown>;

// CLAUDE_BIN may name a script (tests use a fake CLI), which runs with this Node.
function claudeCommand(): [string, string[]] {
  const bin = process.env.CLAUDE_BIN ?? 'claude';
  return /\.(m?js|ts)$/.test(bin) ? [process.execPath, [bin]] : [bin, []];
}

// MCP servers the user added for every project (`claude mcp add --scope user`); they load with the user source.
const userMcpServers = () => readJsonFile<{ mcpServers?: Record<string, unknown> }>(process.env.CLAUDE_CONFIG_DIR ? join(process.env.CLAUDE_CONFIG_DIR, '.claude.json') : join(homedir(), '.claude.json'))?.mcpServers ?? {};

// Claude Code's built-in tools that a background task can use (2.1.301). shortcut: a fixed list, since only a
// model run reports them; tools Claude Code adds later are not offered until they are added here.
const CLAUDE_TOOLS: Record<string, string> = {
  Read: 'Read a file', Write: 'Create or overwrite a file', Edit: 'Change part of a file', Glob: 'Find files by name pattern', Grep: 'Search file contents',
  Bash: 'Run shell commands: builds, tests, git, scripts', PowerShell: 'Run PowerShell commands on Windows', NotebookEdit: 'Edit Jupyter notebooks',
  WebFetch: 'Fetch a web page', WebSearch: 'Search the web', Task: 'Start a subagent for a self-contained part', Skill: 'Run a skill',
  ToolSearch: 'Load deferred tools', Monitor: 'Watch a long-running command', TaskStop: 'Stop a background command',
  EnterWorktree: 'Work in a git worktree', ExitWorktree: 'Leave a git worktree',
};

const subdirs = (dir: string) => { try { return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; } };
const readText = (file: string) => { try { return readFileSync(file, 'utf8'); } catch { return undefined; } };

// What Claude Code loads besides its own prompt and tools (onboarding-010), read from its own CLI without a model
// call: enabled plugins, MCP servers including claude.ai connectors, standalone skills as one item, the user's hooks.
export function claudeInventory(root: string): SetupItem[] {
  const [cmd, pre] = claudeCommand();
  const run = (args: string[]) => spawnSync(cmd, [...pre, ...args], { cwd: root, encoding: 'utf8', env: agentEnv(process.env), windowsHide: true, timeout: 60000 }).stdout ?? '';
  const items: SetupItem[] = [];
  let plugins: { id: string; enabled?: boolean; installPath?: string }[] = [];
  try { plugins = JSON.parse(run(['plugin', 'list', '--json'])); } catch { /* none listed */ }
  for (const p of plugins.filter((p) => p.enabled)) {
    const manifest = p.installPath ? readJsonFile<{ description?: string }>(join(p.installPath, '.claude-plugin', 'plugin.json')) : undefined;
    items.push({ id: `plugin:${p.id}`, kind: 'plugin', title: p.id.split('@')[0], description: manifest?.description, path: p.installPath });
  }
  // Lines read "<name>: <command or URL> - <status>".
  for (const line of run(['mcp', 'list']).split('\n')) {
    const m = /^(.+?): (.+) - \S+ \w/.exec(line.trim());
    if (m && m[1] !== 'aiws') items.push({ id: `mcp:${m[1]}`, kind: 'mcp', title: m[1], description: m[1].startsWith('claude.ai ') ? 'claude.ai connector' : `MCP server: ${m[2].trim()}`, path: commandFile(m[2]) });
  }
  const skills = subdirs(join(claudeHome(), 'skills'));
  // Some plugins also copy their skills into the user's skills folder; such a copy loads on its own, so it stays
  // listed, marked by its identical SKILL.md rather than by its folder name.
  const pluginSkills = new Map<string, string>();
  for (const p of items.filter((i) => i.kind === 'plugin' && i.path)) for (const s of subdirs(join(p.path!, 'skills'))) pluginSkills.set(readText(join(p.path!, 'skills', s, 'SKILL.md')) ?? '', p.title);
  pluginSkills.delete('');
  const label = (name: string) => { const from = pluginSkills.get(readText(join(claudeHome(), 'skills', name, 'SKILL.md')) ?? ''); return from ? `${name} (copy of the ${from} plugin's skill)` : name; };
  if (skills.length) items.push({ id: 'skills', kind: 'skills', title: 'Standalone skills', description: `Skills not from a plugin, switched together: ${skills.map(label).join(', ')}`, parts: skills.map((name) => ({ name: label(name), path: fileOr(join(claudeHome(), 'skills', name), 'SKILL.md') })) });
  for (const [name, description] of Object.entries(CLAUDE_TOOLS)) items.push({ id: `tool:${name}`, kind: 'tool', title: name, description });
  items.push(DELEGATE);
  items.push({ id: 'prompt', kind: 'prompt', title: "Claude Code's own instructions", description: 'Its system prompt: how to work with tools, git and commits, and the environment. Off: a short workspace prompt, about 3k tokens less per call' });
  const hooks = Object.keys(readJsonFile<ClaudeSettings>(join(claudeHome(), 'settings.json'))?.hooks ?? {});
  if (hooks.length) items.push({ id: 'hooks', kind: 'hooks', title: 'Your hooks', description: `Hooks in your Claude Code settings: ${hooks.join(', ')}`, path: join(claudeHome(), 'settings.json') });
  return items;
}

// Allow/ask/deny rules are not in the stream, so they are read from the settings files (user,
// project, local; later wins for the mode). shortcut: managed (enterprise) settings are not read.
export function claudePermissions(root: string): { line: string; warn?: string } {
  const files = [join(claudeHome(), 'settings.json'), join(root, '.claude', 'settings.json'), join(root, '.claude', 'settings.local.json')];
  let mode = 'default';
  const rules: Record<'allow' | 'ask' | 'deny', string[]> = { allow: [], ask: [], deny: [] };
  for (const f of files) {
    if (!existsSync(f)) continue;
    type Perms = { defaultMode?: string; allow?: string[]; ask?: string[]; deny?: string[] };
    let p: Perms | undefined;
    try { p = (JSON.parse(readFileSync(f, 'utf8')) as { permissions?: Perms }).permissions; } catch { continue; }
    if (p?.defaultMode) mode = p.defaultMode;
    for (const k of ['allow', 'ask', 'deny'] as const) rules[k].push(...(p?.[k] ?? []));
  }
  const list = (k: 'ask' | 'deny') => (rules[k].length ? `${k}: ${short(rules[k].join(', '), 60)}` : null);
  const line = ['Claude Code', `mode ${mode}`, list('deny'), list('ask'), rules.allow.length ? `${rules.allow.length} allow rules` : null].filter(Boolean).join(' · ');
  return { line, warn: mode === 'bypassPermissions' ? 'Claude Code skips all permission checks (bypassPermissions)' : undefined };
}

// Started from inside a Claude Code host (e.g. the Claude desktop app), the host's own variables
// (ANTHROPIC_BASE_URL, CLAUDE_CODE_*) would override the user's settings `env` (proxy, model), so the
// session would not behave like the user's Claude Code elsewhere. Drop them; a normal launch is untouched.
export function agentEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (!env.CLAUDECODE) return env;
  return Object.fromEntries(Object.entries(env).filter(([k]) => !/^(CLAUDECODE$|CLAUDE_|ANTHROPIC_)/.test(k)));
}

// Hook commands run in a shell; forward slashes and quotes work in cmd, PowerShell and sh alike.
const shellPath = (p: string) => `"${p.replaceAll('\\', '/')}"`;

// One Claude Code process for a whole session: messages go in over stdin as stream-json, so plugins
// and hooks keep their in-memory state between turns, as in an interactive Claude Code (issue #15).
export class ClaudeProcess implements AgentProcess {
  private child?: ChildProcessWithoutNullStreams;
  private onLine?: (line: string) => void;
  private onExit?: (code: number | null) => void;
  private err = '';
  fresh = true; // started without --resume: the next prompt must carry the earlier conversation
  readonly effort?: string; // what this process was started with; a change needs a new process
  readonly model?: string;
  readonly permissionMode?: string;
  readonly setup?: string;
  sessionId?: string;

  private session: Session;
  private root: string;
  private guardUrl?: string | false; // this process's guard server; false: it could not start (command hook)
  private guardTok?: string; // the latest run's token

  constructor(session: Session, root: string) {
    this.session = session;
    this.root = root;
    this.effort = session.effort;
    this.model = session.model;
    this.permissionMode = session.permissionMode;
    this.setup = session.task?.setup?.join(',');
  }

  get alive() {
    return !!this.child && this.child.exitCode === null;
  }

  private start(resume?: string): void {
    const { session } = this;
    const mcpServers: Record<string, unknown> = { aiws: { command: process.execPath, args: [workspaceServer, session.id], env: { AI_WORKSPACE_HOME: home() } } };
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-prompt-tool', 'mcp__aiws__approve'];
    const disallowed: string[] = [];
    const tools: string[] = session.role === ORCHESTRATION && !session.task ? ['Read', 'Glob', 'Grep'] : [];
    let settings: ClaudeSettings = {};
    if (this.model) args.push('--model', this.model);
    if (this.permissionMode) args.push('--permission-mode', this.permissionMode);
    // Orchestrator chats and tasks load only the chosen items, switched for this run only (orchestrator-005).
    const setup = setupApplies(session) ? runSetup(session, claudeInventory(this.root), this.root) : undefined;
    if (setup) {
      saveInventory('claude-code', setup.items);
      if (!setup.globalRules) {
        // The user source also loads the user's CLAUDE.md and rules; the rest of their settings (env, plugins,
        // hooks) and their user-scope MCP servers are passed on, since only the rule files are to go.
        // shortcut: passed with --settings they rank above the project's settings, not below; merge them per key if a project setting must win.
        args.push('--setting-sources', 'project,local');
        settings = readJsonFile<ClaudeSettings>(join(claudeHome(), 'settings.json')) ?? {};
        Object.assign(mcpServers, userMcpServers());
      }
      tools.push(...setup.items.filter((i) => i.kind === 'tool' && setup.on(i)).map((i) => i.title));
      // Without its own system prompt the agent gets a short one (about 3k tokens less per call).
      if (setup.items.some((i) => i.kind === 'prompt' && !setup.on(i))) args.push('--system-prompt', minimalPrompt(this.root));
      for (const i of setup.items.filter((i) => !setup.on(i))) {
        if (i.kind === 'plugin') settings.enabledPlugins = { ...settings.enabledPlugins, [i.id.slice('plugin:'.length)]: false };
        else if (i.kind === 'mcp') { disallowed.push(`mcp__${i.title.replace(/[^\w-]/g, '_')}`); delete mcpServers[i.title]; }
        // The flag drops every skill, also those of plugins and Claude Code's own. Standalone skills load only from
        // the user source, which is left out when global rules are off, and a plugin of this run keeps its skills.
        else if (i.kind === 'skills' && setup.globalRules && !setup.items.some((p) => p.kind === 'plugin' && setup.on(p) && p.path && existsSync(join(p.path, 'skills')))) args.push('--disable-slash-commands');
        else if (i.kind === 'hooks') delete settings.hooks; // shortcut: with global rules on, the user's hooks cannot be switched off for one run and stay on
      }
    }
    // The running app's checkout and storage stay untouched (selfdev-002): a hook, so no permission mode lifts it.
    // Asked over HTTP from this process, so no process starts per tool call; an unreachable server would let the
    // call through, so it runs here, where the agent's output is read, and ends with it.
    const g = { ...guardFor(this.root), merge: !!session.worktree };
    // App-project chats and top-level tasks merge through the workspace's request_merge (selfdev-004).
    const merges = !!session.worktree && session.role !== ORCHESTRATION && !session.task?.parentId;
    this.guardTok = this.guardUrl ? guardToken(g) : undefined;
    const guard = this.guardUrl ? { type: 'http', url: this.guardUrl, headers: { 'x-aiws-token': this.guardTok }, timeout: 30 }
      : { type: 'command', command: [process.execPath, guardHook, ...(g.merge ? ['--merge'] : []), g.allow, ...g.deny].map(shellPath).join(' '), timeout: 30 };
    settings.hooks = { ...settings.hooks, PreToolUse: [...(settings.hooks?.PreToolUse ?? []), { matcher: 'Edit|Write|MultiEdit|NotebookEdit|Bash|PowerShell', hooks: [guard] }] };
    if (session.task) {
      // A task's own `delegate` runs without a card; a call that repeats an interrupted attempt is held (runtime-004).
      args.push('--allowedTools', session.task.parentId ? 'mcp__aiws__request_setup,mcp__aiws__read_repo' : `mcp__aiws__delegate,mcp__aiws__request_setup,mcp__aiws__read_repo${merges ? ',mcp__aiws__request_merge' : ''}`);
      const hook = { type: 'command', command: `${shellPath(process.execPath)} ${shellPath(repeatHook)} ${session.id}`, timeout: 30 };
      settings.hooks = { ...settings.hooks, PreToolUse: [...(settings.hooks?.PreToolUse ?? []), { matcher: '*', hooks: [hook] }] };
    } else if (session.role === ORCHESTRATION) {
      // The orchestrator only reads and runs tasks, whatever agent the role uses (orchestrator-006). The unused
      // built-in tools cost about 24k prompt tokens per call, so it gets only the reading ones (`tools`).
      args.push('--allowedTools', ORCHESTRATOR_TOOLS.map((t) => `mcp__aiws__${t}`).join(','));
      disallowed.push('Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit');
    } else args.push('--allowedTools', [...ORCHESTRATOR_TOOLS, ...(merges ? ['request_merge'] : [])].map((t) => `mcp__aiws__${t}`).join(',')); // starting a task is the chat's job (ADR 0011); the task asks for its own actions
    if (setup) args.push('--tools', [...new Set(tools)].join(',')); // '' leaves the agent no built-in tool
    args.push('--mcp-config', JSON.stringify({ mcpServers }));
    if (disallowed.length) args.push('--disallowedTools', disallowed.join(','));
    if (Object.keys(settings).length) args.push('--settings', JSON.stringify(settings));
    // The agent is told its level, so rules that depend on it (for example an effort check) can read it.
    if (this.effort) args.push('--effort', this.effort);
    args.push('--append-system-prompt', `AI Workspace ${session.task ? 'task' : 'session'}: effort level ${this.effort ?? "not set by the workspace (the agent's own default)"}. This note is always current: when the user changes the level in the workspace's composer, the agent is restarted with the new level and an updated note.${session.task ? ` ${TASK_NOTE} ${READ_REPO_NOTE}` + (session.task.parentId || !(setup?.on(DELEGATE) ?? true) ? '' : ' To hand a self-contained part of the work to the agent of another workspace role, use the mcp__aiws__delegate tool.') + ownInstructions('implementationInstructions') : session.role === ORCHESTRATION ? ` ${orchestratorNote()}` : ` To run self-contained work in the background as a task, use the mcp__aiws__start_task tool. ${READ_REPO_NOTE}` + ownInstructions('chatInstructions')}${merges ? ` ${MERGE_NOTE}` : ''}${setup?.workspaceRules ? `\n\n${WORKSPACE_RULES}\n${setup.workspaceRules}` : ''}`);
    if (resume) args.push('--resume', resume);
    this.fresh = !resume;
    this.sessionId = resume;
    this.err = '';
    const [cmd, pre] = claudeCommand();
    // Approvals wait for the user without a time limit (runtime-002): the longest timeout Node allows.
    const child = spawn(cmd, [...pre, ...args], { cwd: this.root, env: { ...agentEnv(process.env), MCP_TOOL_TIMEOUT: '2147483647' }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let pending = '';
    child.stdout.on('data', (d) => {
      pending += d;
      const parts = pending.split('\n');
      pending = parts.pop() ?? '';
      for (const l of parts) if (l.trim()) this.onLine?.(l.trim());
    });
    child.stderr.on('data', (d) => (this.err = (this.err + d).slice(-4000)));
    child.on('error', (e) => (this.err += e.message));
    const tok = this.guardTok; // this run's guard ends with its process
    child.on('close', (code) => { forget(tok); this.onExit?.(code); });
    this.child = child;
  }

  private send(value: unknown): void {
    this.child?.stdin.write(JSON.stringify(value) + '\n');
  }

  // Ends the process and its subprocesses (commands, MCP servers).
  kill(): void {
    const child = this.child;
    this.child = undefined;
    if (!child || child.exitCode !== null) return;
    if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    else child.kill('SIGTERM');
  }

  // Lets the process finish what it writes, then ends it.
  close(): void {
    this.child?.stdin.end();
    const child = this.child;
    setTimeout(() => child && child.exitCode === null && this.kill(), 5000).unref();
  }

  // Runs one turn. Stop sends Claude Code's own interrupt; if it does not end the turn soon, the process is
  // ended. A 'kill' abort (task cancel, budget) ends the process tree at once (runtime-005).
  turn(input: TurnInput): Promise<TurnEnd> {
    if (!this.alive && this.guardUrl === undefined) return guardServer().then((url) => { this.guardUrl = url ?? false; return this.turn(input); });
    if (!this.alive) this.start(this.session.vendorSessionId);
    const { emit, signal } = input;
    const resumed = !this.fresh;
    const prompt = this.fresh && input.history ? `Earlier in this conversation:\n\n${input.history}\n\nUser: ${input.prompt}` : input.prompt;
    this.fresh = false;
    let text = '';
    let sawText = false;
    const messages = new Map<string, Usage>();
    const flush = () => {
      if (text) emit({ type: 'text', text });
      text = '';
    };
    return new Promise<TurnEnd>((resolve) => {
      const timer = setInterval(flush, 250); // batch deltas so the log holds chunks, not single tokens
      let killTimer: NodeJS.Timeout | undefined;
      const end = (r: TurnEnd) => {
        clearInterval(timer);
        clearTimeout(killTimer);
        signal.removeEventListener('abort', interrupt);
        this.onLine = undefined;
        this.onExit = undefined;
        flush();
        resolve({ vendorSessionId: this.sessionId, ...r });
      };
      const interrupt = () => {
        if (signal.reason === 'kill') {
          this.kill();
          emit({ type: 'usage', usage: [...messages.values()].reduce(addUsage, { inputTokens: 0, outputTokens: 0 }) });
          return end({});
        }
        this.send({ type: 'control_request', request_id: `stop-${Date.now()}`, request: { subtype: 'interrupt' } });
        killTimer = setTimeout(() => { this.kill(); end({}); }, 10000);
      };
      this.onLine = (line) => {
        let parsed;
        try { parsed = sessionEvents(line, this.root); } catch { return; }
        this.sessionId = parsed.sessionId ?? this.sessionId;
        for (const ev of parsed.events) {
          if (ev.type === 'text') { text += ev.text; sawText = true; continue; }
          flush();
          emit(ev);
        }
        if (parsed.usage) {
          messages.set(parsed.usage.id, parsed.usage.usage);
          input.live?.([...messages.values()].reduce(addUsage, { inputTokens: 0, outputTokens: 0 }));
        }
        if (parsed.result) {
          emit({ type: 'usage', usage: parsed.result.usage });
          end({ error: signal.aborted ? undefined : parsed.result.error });
        }
      };
      this.onExit = (code) => {
        this.child = undefined;
        const error = signal.aborted ? undefined : `claude exited ${code}: ${this.err.trim() || 'no result'}`;
        // An expired or unknown vendor session: the workspace history is the source, so start fresh from it.
        end({ error, staleHint: resumed && !sawText && /no conversation found/i.test(this.err) });
      };
      signal.addEventListener('abort', interrupt, { once: true });
      if (signal.aborted) return interrupt();
      this.send({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] } });
    });
  }
}

// Claude Code's documented model aliases and permission modes (claude --help); the user's own defaults come from their settings.
const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
export function claudeCatalog(): Catalog {
  let own: string | undefined;
  try { own = (JSON.parse(readFileSync(join(claudeHome(), 'settings.json'), 'utf8')) as { model?: string }).model; } catch { /* no settings */ }
  const models = [['', `Default${own ? ` (${own})` : ''}`], ['fable', 'Fable'], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku']];
  return {
    models: models.map(([id, label]) => ({ id: id!, label: label!, efforts: CLAUDE_EFFORTS })),
    modes: [
      { id: '', label: "Claude Code's settings", hint: 'Your own Claude Code settings decide' },
      { id: 'manual', label: 'Manual', hint: 'Always ask before making changes' },
      { id: 'acceptEdits', label: 'Edit project files', hint: 'Change files in the project without asking; commands and anything outside still ask' },
      { id: 'auto', label: 'Auto', hint: "Claude Code's safety check decides each action" },
      { id: 'dontAsk', label: "Don't ask", hint: 'Only what your allow rules permit; the rest is denied without asking' },
      { id: 'bypassPermissions', label: 'Bypass permissions', hint: 'Never ask, no limits', warn: true },
      { id: 'plan', label: 'Plan', hint: 'Only read and plan; change nothing' },
    ],
  };
}

// A process whose resumed vendor session is gone starts again from the workspace history.
class ClaudeAgent implements AgentProcess {
  private proc: ClaudeProcess;
  private session: Session;
  private root: string;
  constructor(session: Session, root: string) {
    this.session = session;
    this.root = root;
    this.proc = new ClaudeProcess(session, root);
  }
  get model() { return this.proc.model; }
  get effort() { return this.proc.effort; }
  get permissionMode() { return this.proc.permissionMode; }
  get setup() { return this.proc.setup; }
  async turn(input: TurnInput): Promise<TurnEnd> {
    const r = await this.proc.turn(input);
    if (!r.staleHint) return r;
    this.session.vendorSessionId = undefined;
    this.proc.close();
    this.proc = new ClaudeProcess(this.session, this.root);
    return this.proc.turn(input);
  }
  close() { this.proc.close(); }
}

export const claudeSession: SessionAgent = {
  open: (session, root) => new ClaudeAgent(session, root),
  permissions: claudePermissions,
  catalog: claudeCatalog,
  inventory: async (root) => claudeInventory(root),
};
