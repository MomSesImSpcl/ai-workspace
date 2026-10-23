// Static, read-only catalog of every instruction the workspace itself writes for agents (agent-instructions-001–005,
// ADR 0022): role notes in the system or developer prompt, the text it puts into messages (history, markers,
// continuations), its MCP tool descriptions and the tool replies and refusals that tell an agent what to do next. The
// Settings tab "Agent Instructions" shows it in a development environment only (`instructionsAvailable`). It lists
// what can be sent and when, not what a particular session received; the role notes are assembled once for every
// agent by `agentInstructions` in app/src/prompt.ts (ADR 0023), and the adapters only deliver them.
// Fidelity: entries with `from: 'definition'` show the exported definition the adapters use; entries with
// `from: 'copy'` repeat text written inline in the code, and app/test/instructions.test.ts fails when a copy no longer
// matches its source file, the arguments the agents get or the tools the workspace server lists.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { claudeHome, fileOr } from './adapters/claude-code.ts';
import { userCodexHome } from './adapters/codex.ts';
import { MERGE_NOTE } from './merge.ts';
import { getSettings, ORCHESTRATOR_NOTE, READ_REPO_NOTE, setupContinue, TASK_NOTE, type Capabilities, type SessionAgent } from './sessions.ts';
import { sessionAgents } from './turn.ts';
import { getAgentSetup, RULE_ROLES, WORKSPACE_RULES } from './setup.ts';
import { getWorkspaceRoot } from './store.ts';
import { appRepo, guardNotice } from './worktrees.ts';

/** The roles the catalog tells apart: plain chats, orchestrator chats and tasks (the Implementer role, whatever role a task started with). Tasks do not start tasks (ADR 0024). */
export const CATALOG_ROLES = ['Chat', 'Orchestrator', 'Implementer'] as const;
export type CatalogRole = (typeof CATALOG_ROLES)[number];
/** The agent integrations an entry can apply to, as named in `sessionAgents` (app/src/turn.ts). */
export const CATALOG_AGENTS = ['claude-code', 'codex'] as const;
type Agent = (typeof CATALOG_AGENTS)[number];
/** Which agents get the entry in each role; a role that is missing gets it with no agent. */
type Applies = Partial<Record<CatalogRole, Agent[]>>;

/** One workspace-authored instruction: what it is for, when it is sent, to whom, and its exact text. */
export interface InstructionEntry {
  id: string; // stable, for links and tests
  group: string; // purpose group in the list
  title: string;
  purpose: string;
  text: string; // exact text; `{name}` marks a value filled in at run time, explained in `placeholders`
  params?: { name: string; text: string }[]; // a tool's parameter descriptions, as the agent sees them
  variants?: { label: string; text: string }[]; // other forms of the same message, each with when it is used
  applies: Applies;
  when: string; // the condition that includes it
  channel: string; // how it reaches the agent
  sources: { file: string; symbol: string }[]; // repository-relative file and the definition in it
  placeholders?: Record<string, string>;
  from: 'definition' | 'copy'; // shown from the exported definition, or a copy checked by app/test/instructions.test.ts
  needs?: keyof Capabilities; // only agents with this capability get it (`withCapabilities`)
}

const BOTH: Agent[] = ['claude-code', 'codex'];
const CLAUDE: Agent[] = ['claude-code'];
const CODEX: Agent[] = ['codex'];
const ALL: Applies = { Chat: BOTH, Orchestrator: BOTH, Implementer: BOTH };
// The workspace server (aiws) is configured for every chat and task.
const SERVER: Applies = { Chat: BOTH, Orchestrator: BOTH, Implementer: BOTH };
const CHATS: Applies = { Chat: BOTH, Orchestrator: BOTH };

const BOTH_PROMPT = "The agent's system instructions";
const MESSAGE = 'Part of the user message the agent receives';
const TOOL = "Tool description in the workspace tools, listed with the agent's tools";
const REPLY = 'Tool result the agent reads after calling the tool';
const CLAUDE_FILE = 'app/src/adapters/claude-code.ts';
const CODEX_FILE = 'app/src/adapters/codex.ts';
const SERVER_FILE = 'app/src/approval-server.ts';
const PROMPT_FILE = 'app/src/prompt.ts';

/** Purpose groups, in list order. */
export const GROUPS = ['Role notes', 'Messages and continuation', 'Workspace tools', 'Tool replies and refusals'] as const;

const tool = (name: string, title: string, purpose: string, text: string, applies: Applies, when: string, params: { name: string; text: string }[] = [], placeholders?: Record<string, string>): InstructionEntry =>
  ({ id: `tool.${name}`, group: 'Workspace tools', title, purpose, text, params, applies, when, channel: TOOL, sources: [{ file: SERVER_FILE, symbol: name }], placeholders, from: 'copy' });

/** Every workspace-authored agent-facing instruction. Order within a group is the order the list shows before sorting A–Z. */
export const CATALOG: InstructionEntry[] = [
  // --- Role notes: the system or developer prompt each role starts with.
  { id: 'session-note', group: 'Role notes', title: 'Effort level note', purpose: 'Opens the instructions of every chat and task: tells the agent its effort level, so rules that depend on it (such as an effort check) can read it, and that the note stays current.',
    text: "AI Workspace {kind}: effort level {effort}. This note is always current: when the user changes the level in the workspace's composer, the agent is restarted with the new level and an updated note.",
    applies: ALL, when: 'Every agent start; it opens the instructions.', channel: BOTH_PROMPT,
    sources: [{ file: PROMPT_FILE, symbol: 'agentInstructions' }], placeholders: { kind: '"task" for tasks, "session" for chats', effort: 'the session\'s effort level, or "not set by the workspace (the agent\'s own default)"' }, from: 'copy' },
  { id: 'chat.start-task', group: 'Role notes', title: 'Start tasks from a chat', purpose: 'Points a plain chat to start_task for background work.',
    text: 'To run self-contained work in the background as a task, use the workspace start_task tool.', applies: { Chat: BOTH }, when: 'Plain chats.', channel: BOTH_PROMPT, sources: [{ file: PROMPT_FILE, symbol: 'agentInstructions' }], from: 'copy' },
  { id: 'task.note', group: 'Role notes', title: 'Background task note', purpose: 'Tells a task that nobody answers until it ends, so it does the work instead of stopping to ask about effort.',
    text: TASK_NOTE, applies: { Implementer: BOTH }, when: 'Every task.', channel: BOTH_PROMPT, sources: [{ file: 'app/src/sessions.ts', symbol: 'TASK_NOTE' }], from: 'definition' },
  { id: 'read-repo.note', group: 'Role notes', title: 'Use read_repo', purpose: 'Makes chats and tasks try read_repo for history, pull requests, checks and issues (#31).',
    text: READ_REPO_NOTE, applies: { Chat: BOTH, Implementer: BOTH }, when: 'Plain chats and tasks; the orchestrator note names read_repo itself.', channel: BOTH_PROMPT,
    sources: [{ file: 'app/src/sessions.ts', symbol: 'READ_REPO_NOTE' }], from: 'definition' },
  { id: 'orchestrator.note', group: 'Role notes', title: 'Orchestrator rules', purpose: 'How the orchestrator routes every message: reply to a running task, start a new task, or answer a question itself; how it picks agent, model, effort and setup items.',
    text: ORCHESTRATOR_NOTE, applies: { Orchestrator: BOTH }, when: 'Every orchestrator chat. The workspace also blocks its edit tools in code (Claude Code: disallowed tools; Codex: read-only sandbox, no approvals), so this text is not the only guard.', channel: BOTH_PROMPT,
    sources: [{ file: 'app/src/sessions.ts', symbol: 'ORCHESTRATOR_NOTE' }], from: 'definition' },
  { id: 'orchestrator.storage', group: 'Role notes', title: 'Where past work is stored', purpose: 'Lets the orchestrator answer questions about past chats and tasks by reading storage itself instead of starting a task.',
    text: "Workspace storage, with every chat's and task's history (projects/<project>/sessions/*.jsonl, global/sessions for chats outside a project) and the audit log (audit.jsonl), is in {storage}; read it yourself to answer questions about past work.",
    applies: { Orchestrator: BOTH }, when: 'Every orchestrator chat, right after the orchestrator rules.', channel: BOTH_PROMPT, sources: [{ file: 'app/src/sessions.ts', symbol: 'orchestratorNote' }], placeholders: { storage: 'the workspace storage folder on this computer' }, from: 'copy' },
  { id: 'own-instructions', group: 'Role notes', title: "Wrapper for the user's own instructions", purpose: "Adds the role's Instructions field from Settings → Agents and says it outranks the notes before it.",
    text: "The user's own instructions for you, which take precedence over the notes above where they conflict: {instructions}", applies: ALL,
    when: 'The role\'s Instructions field is not empty: Chat for plain chats, Orchestrator for orchestrator chats, Implementer for tasks (whatever role they started with). It comes after the role notes; the merge note and the workspace rules still follow it.', channel: BOTH_PROMPT,
    sources: [{ file: 'app/src/sessions.ts', symbol: 'ownInstructions' }], placeholders: { instructions: 'the text of the role\'s Instructions field (Settings → Agents)' }, from: 'copy' },
  { id: 'merge.note', group: 'Role notes', title: 'Worktree and merge rules', purpose: 'Tells app-project sessions to stay in their worktree, run the checks and merge only through request_merge after the user approves (selfdev-002–004).',
    text: MERGE_NOTE, applies: { Chat: BOTH, Implementer: BOTH }, when: "Plain chats and top-level tasks in the app project's own worktrees; not orchestrator chats. The write guard and the blocked gh login enforce the same limits in code.", channel: BOTH_PROMPT,
    sources: [{ file: 'app/src/merge.ts', symbol: 'MERGE_NOTE' }], from: 'definition' },
  { id: 'workspace-rules', group: 'Role notes', title: "The workspace folder's AGENTS.md", purpose: "Adds the workspace folder's own rules, which neither agent loads by itself above a project's git root.",
    text: `${WORKSPACE_RULES}\n{rules}`, applies: { Orchestrator: BOTH, Implementer: BOTH }, when: 'Orchestrator chats and tasks of a project inside the workspace folder, when that folder has a non-empty AGENTS.md. Plain chats do not get it. It comes last.', channel: BOTH_PROMPT,
    sources: [{ file: 'app/src/setup.ts', symbol: 'WORKSPACE_RULES' }, { file: 'app/src/setup.ts', symbol: 'workspaceRules' }], placeholders: { rules: "the workspace folder's AGENTS.md, as it is when the agent starts" }, from: 'definition' },
  { id: 'minimal-prompt', group: 'Role notes', title: "Short system prompt instead of the agent's own", purpose: "Replaces the agent's own system prompt when it is switched off for a run, about 3k to 4k tokens less per call.",
    text: 'You are a coding agent working in {root} on {platform}. Today is {date}.', applies: { Orchestrator: BOTH, Implementer: BOTH },
    when: "The run's \"own instructions\" setup item (prompt) is off: the orchestrator's default, and tasks whose orchestrator did not pick it (Settings → Agent setup).", channel: "Replaces the agent's own system prompt",
    sources: [{ file: 'app/src/setup.ts', symbol: 'minimalPrompt' }], placeholders: { root: 'the folder the agent runs in', platform: 'the operating system (win32, darwin, linux)', date: "today's date, YYYY-MM-DD" }, from: 'copy' },

  // --- Messages and continuation: text the workspace puts into the message the agent receives.
  { id: 'history.prefix', group: 'Messages and continuation', title: 'Earlier conversation', purpose: 'Gives an agent that cannot resume its own conversation the conversation so far from workspace history.',
    text: 'Earlier in this conversation:\n\n{history}\n\nUser: {message}', applies: ALL,
    when: 'The agent starts without a conversation of its own to resume and the session has earlier turns: after an agent switch, in a chat continued in a new chat, or when the agent\'s own session or thread is gone.', channel: MESSAGE,
    sources: [{ file: CLAUDE_FILE, symbol: 'ClaudeProcess.turn' }, { file: CODEX_FILE, symbol: 'CodexProcess.turn' }], placeholders: { history: 'the earlier turns, written as the transcript entry shows', message: 'the new message' }, from: 'copy' },
  { id: 'history.transcript', group: 'Messages and continuation', title: 'Transcript of a turn', purpose: 'How each earlier turn is written in the earlier conversation.',
    text: 'User: {message}\n\nYou: {reply}\n\n[{marker}]', applies: ALL, when: 'Inside the earlier conversation; the reply and the marker only when the turn has them.', channel: MESSAGE,
    sources: [{ file: 'app/src/sessions.ts', symbol: 'transcript' }], placeholders: { message: "the user's message of that turn", reply: "the agent's reply", marker: 'how the turn ended, when it did not finish (see the unfinished-turn marker)' }, from: 'copy' },
  { id: 'turn.marker', group: 'Messages and continuation', title: 'Unfinished-turn marker', purpose: 'Says where an unfinished turn stopped, so user and agent see the same last step (sessions-008/009).',
    text: '{outcome} after step {n}: {step}', variants: [{ label: 'No step finished', text: '{outcome} before the first step' }], applies: ALL, when: 'A turn that was interrupted, stopped or failed; a reason the workspace stopped it (a token budget, a possible repeat, paused) is added in parentheses.', channel: MESSAGE,
    sources: [{ file: 'app/src/sessions.ts', symbol: 'marker' }], placeholders: { outcome: 'Interrupted, Stopped or Failed', n: 'the number of finished steps', step: 'the last finished step, as the activity list shows it' }, from: 'copy' },
  { id: 'turn.unfinished', group: 'Messages and continuation', title: 'Check before repeating', purpose: 'Asks the agent to check the project before it repeats work an unfinished turn may have done.',
    text: '[{marker}. Check the current project state before repeating anything.]', applies: ALL, when: 'The message after a turn that did not finish; it comes before the message.', channel: MESSAGE,
    sources: [{ file: 'app/src/sessions.ts', symbol: 'turnPrompt' }], placeholders: { marker: 'the unfinished-turn marker of the previous turn' }, from: 'copy' },
  { id: 'turn.relay', group: 'Messages and continuation', title: 'What the user wrote to a task', purpose: "Tells a chat's agent what the user wrote directly to one of its tasks since its last reply.",
    text: '[Since your last reply the user wrote directly to task {task}: "{text}"]', applies: CHATS, when: "The next chat message after the user used a task's reply field.", channel: MESSAGE,
    sources: [{ file: 'app/src/sessions.ts', symbol: 'turnPrompt' }], placeholders: { task: 'the task id', text: 'what the user wrote' }, from: 'copy' },
  { id: 'task.resume', group: 'Messages and continuation', title: 'Resume', purpose: 'The message that continues a paused, interrupted or finished task.',
    text: 'Continue the task.', applies: { Implementer: BOTH }, when: 'Resume on a task.', channel: MESSAGE,
    sources: [{ file: 'app/src/tasks.ts', symbol: 'RESUME' }], from: 'copy' },
  { id: 'task.setup-continue', group: 'Messages and continuation', title: 'Continue after request_setup', purpose: 'Continues a task in a new process with the setup items it asked for (orchestrator-005).',
    text: setupContinue(['{ids}']), applies: { Implementer: BOTH }, when: 'After a task called request_setup and its turn ended.', channel: MESSAGE,
    sources: [{ file: 'app/src/sessions.ts', symbol: 'setupContinue' }], placeholders: { ids: 'the setup item ids it asked for' }, from: 'definition' },
  { id: 'task.based-on', group: 'Messages and continuation', title: 'Context from an earlier task', purpose: "Gives a new task the goal and result of an earlier related one, not its whole conversation, so it skips rediscovering that work.",
    text: 'Context from an earlier related task ({task}, {status}).\nIts goal: {goal}\nIts last reply: {reply}', applies: { Implementer: BOTH },
    when: 'A task started with basedOn; it follows the goal after a blank line. The earlier goal is cut to its first and the reply to its last 4,000 characters.', channel: MESSAGE,
    sources: [{ file: 'app/src/tasks.ts', symbol: 'handoff' }], placeholders: { task: 'the earlier task id', status: 'its status (completed, failed, …)', goal: 'its first message', reply: 'its last reply, or "(no reply yet)"' }, from: 'copy' },

  // --- Workspace tools: descriptions the agent reads in its tool list.
  tool('approve', 'approve', 'The permission prompt Claude Code calls for every "ask"; it shows an approval card and waits for the user.', 'Asks the user in the workspace chat whether a tool call may run', SERVER,
    'Every session and task with the workspace server. Only Claude Code calls it (--permission-prompt-tool); Codex sends its approvals itself.'),
  tool('read_repo', 'read_repo', "Reads a workspace project's commits, branches, status, pull requests, checks and issues without changing anything.",
    "Reads a workspace project's repository, never changes it: log (recent commits; ref, path, limit), show (one commit with its diff; ref), branches (every local and remote branch with its worktree and ahead/behind counts against main), status (git status --short of the project checkout, or of a worktree of the project given as path), prs and issues (lists; state, limit), pr (one pull request with its checks; number, logs for the failed lines of failed checks), issue (one issue with comments; number). project defaults to this session's project.",
    SERVER, 'Every session and task with the workspace server.', [{ name: 'project', text: "A workspace project id; default: this session's project" }]),
  tool('request_setup', 'request_setup', 'Lets a task ask for setup items it is missing and continue with them in a new process (orchestrator-005).',
    'Asks the workspace to enable built-in tools or setup items this task is missing, then continues the task with them in a new process. End your turn right after calling it. Ids: {ids}',
    { Implementer: BOTH }, 'Every task.', [{ name: 'reason', text: 'One line: why the task needs them' }], { ids: "every setup item id listed for the task's agent" }),
  tool('start_task', 'start_task', 'Starts a background task from a chat (sessions-002); the orchestrator uses it for all work.',
    "Starts a background task in this project and returns at once. Agent, model and effort default to the role's assignment (default role Implementation); list_agents shows the choices. The task runs uncapped unless tokenBudget is given or the chat has a cap. Its approval cards, replies and result appear in this chat; the user answers them there.",
    CHATS, 'Plain chats and orchestrator chats.', [
      { name: 'title', text: 'A short title of what the task does, a few words' },
      { name: 'goal', text: 'Self-contained instructions for the task' },
      { name: 'agent', text: "Omit to use the role's configured agent; a different implementer requires an explicit user override" },
      { name: 'model', text: "Omit to use the role's configured model; change only for an explicit user override" },
      { name: 'effort', text: "One of the model's effort levels" },
      { name: 'reason', text: 'One line: why this agent, model and effort' },
      { name: 'tokenBudget', text: 'Token cap at real cost; only when the user asked for one' },
      { name: 'basedOn', text: 'Id of an earlier related task; the new task starts with its goal and result' },
      { name: 'permissionMode', text: "One of the agent's own permission modes; omit for the agent's settings" },
      { name: 'setup', text: "Ids from the selected agent's list_agents setup list that the task needs; setupStatus shows always-on items and whether a built-in tool must be selected. Never use another agent's ids" },
    ]),
  tool('reply_task', 'reply_task', 'Sends a change or correction to a running task of the chat (orchestrator-006).',
    'Sends a change or correction to a running task of this chat; it gets the message when its current step ends. A finished task is not continued this way: start a new one with basedOn.', CHATS, 'Plain chats and orchestrator chats.'),
  tool('task_status', 'task_status', "Lists the chat's tasks with their state and last reply.", 'Lists the tasks started in this chat: goal, status, agent, tokens used and the last reply.', CHATS, 'Plain chats and orchestrator chats.'),
  tool('rename_task', 'rename_task', 'Renames a task of the chat.', 'Changes the title of a task started in this chat, as the workspace lists it.', CHATS, 'Plain chats and orchestrator chats.'),
  tool('list_agents', 'list_agents', 'Role assignments, agent catalogs and decidable setup items, so the orchestrator can choose for a task.',
    "Current role assignments (agent, model, effort), each agent's catalog, decidable setup items and setupStatus (alwaysOn ids, requiresBuiltInTool). Use the configured Implementation agent and model unless the user explicitly overrides them. Setup lists are switches, not complete capability catalogs; a missing tool:* id is not a reason to switch agents.",
    CHATS, "Plain chats and orchestrator chats. Its result also carries each setup item's title and description: the workspace writes those of built-in tools, Codex features and the agents' own prompts; plugins and MCP servers report their own."),
  tool('request_merge', 'request_merge', "Publishes the session's branch after the user approves one card (selfdev-004, ADR 0017).",
    "Merges this session's branch into main after the user approves a card in the chat: pushes the branch, opens its pull request if there is none (then title, and optionally body, are needed), and squash-merges it once the required checks pass. Commit first; no need to push. Blocks until the user answers.",
    { Chat: BOTH, Implementer: BOTH }, "Plain chats and top-level tasks in the app project's own worktrees.", [
      { name: 'checks', text: 'Your typecheck and test results, in one or two lines (for example: typecheck clean; npm test 70/70)' },
      { name: 'title', text: 'Pull request title, if the branch has none yet' },
      { name: 'body', text: 'Pull request description, if the branch has none yet' },
    ]),

  // --- Tool replies and refusals that tell the agent what to do next. Plain validation errors that only name a bad value are not listed.
  { id: 'reply.approve', group: 'Tool replies and refusals', title: 'Approval answered', purpose: 'What Claude Code is told when the user denies an approval card or stops the turn.',
    text: 'The user denied this in the workspace.', variants: [{ label: 'The turn was stopped while the card waited', text: 'The user stopped the turn.' }],
    applies: { Chat: BOTH, Orchestrator: BOTH, Implementer: BOTH }, when: 'An approval card is denied, or the turn is stopped while it waits.', channel: REPLY,
    sources: [{ file: SERVER_FILE, symbol: 'approve' }], from: 'copy', needs: 'approvalTool' },
  { id: 'reply.start_task', group: 'Tool replies and refusals', title: 'start_task replies', purpose: 'Confirms a started task, or says what is missing.',
    text: 'task {task} started ({choice}); it runs in the background and shows in this chat', variants: [
      { label: 'Refused: the chosen agent lists built-in tools and none is on or picked', text: 'No built-in tool picked for this {agent} task: pass in setup the tools the goal needs (tool:… ids from list_agents)' },
      { label: 'Refused: a task called it', text: 'Tasks do not start tasks: name the follow-up work in your result, and the chat starts it' },
    ], applies: CHATS, when: 'After start_task.', channel: REPLY,
    sources: [{ file: SERVER_FILE, symbol: 'start_task' }, { file: 'app/src/tasks.ts', symbol: 'createTask' }, { file: 'app/src/tasks.ts', symbol: 'startFromSession' }], placeholders: { task: 'the new task id', choice: 'its agent, model and effort', agent: 'the chosen agent' }, from: 'copy' },
  { id: 'reply.reply_task', group: 'Tool replies and refusals', title: 'reply_task replies', purpose: 'Confirms a sent reply, or points to basedOn for a finished task.',
    text: 'sent to task {task}', variants: [{ label: 'Refused: the task is not running, waiting or paused', text: 'Task {task} is {status}; start a new task with basedOn: {task}' }], applies: CHATS, when: 'After reply_task.', channel: REPLY,
    sources: [{ file: SERVER_FILE, symbol: 'reply_task' }, { file: 'app/src/tasks.ts', symbol: 'replyFromSession' }], placeholders: { task: 'the task id', status: 'its status' }, from: 'copy' },
  { id: 'reply.rename_task', group: 'Tool replies and refusals', title: 'rename_task reply', purpose: 'Confirms a new task title.',
    text: 'task {task} is now titled "{title}"', applies: CHATS, when: 'After rename_task.', channel: REPLY, sources: [{ file: SERVER_FILE, symbol: 'rename_task' }], placeholders: { task: 'the task id', title: 'the new title, up to 200 characters' }, from: 'copy' },
  { id: 'reply.request_setup', group: 'Tool replies and refusals', title: 'request_setup replies', purpose: 'Tells the task to end its turn so it continues with the new items, or why they cannot be added.',
    text: 'Enabled {ids}. End your turn now in one line; the workspace continues the task with them.', variants: [
      { label: 'Refused: ids the agent does not list', text: 'Unknown setup items for {agent}: {ids}' },
      { label: 'Refused: items the user switched off for the role', text: 'The user switched these off for this role: {ids}' },
    ], applies: { Implementer: BOTH }, when: 'After request_setup.', channel: REPLY,
    sources: [{ file: 'app/src/tasks.ts', symbol: 'requestSetup' }, { file: 'app/src/setup.ts', symbol: 'checkRequest' }], placeholders: { ids: 'the setup item ids', agent: "the task's agent" }, from: 'copy' },
  { id: 'reply.read_repo', group: 'Tool replies and refusals', title: 'read_repo in a global session', purpose: 'Asks a session outside any project to name one.',
    text: 'This is a global session: name a project. Projects: {projects}', applies: SERVER, when: 'read_repo without project in a session outside any project.', channel: REPLY,
    sources: [{ file: SERVER_FILE, symbol: 'read_repo' }], placeholders: { projects: 'the ids of the workspace projects' }, from: 'copy' },
  { id: 'reply.request_merge', group: 'Tool replies and refusals', title: 'request_merge replies', purpose: 'What happened with a merge request and what to do next: retry with a title, ask the user, resolve a conflict, or fix a failing check.',
    text: 'Pushed {branch}; auto-merge is on for #{number} ({url}): GitHub squash-merges it into main when the required checks pass. If a check fails, nothing is merged: fix it, commit, and call request_merge again.', variants: [
      { label: 'No open pull request and no title given', text: 'Branch {branch} has no open pull request. Call request_merge again with a title (and a body) for it.' },
      { label: 'The turn was stopped while the card waited', text: 'The user stopped the turn; nothing was pushed or merged.' },
      { label: 'The user denied the card', text: 'The user did not approve the merge; nothing was pushed or merged. Ask the user what to change.' },
      { label: 'The binding changed while the card waited', text: 'Nothing was pushed or merged: the binding changed while the card waited. {binding}' },
      { label: 'Fetching main failed', text: 'Fetching main failed; nothing was pushed or merged: {output}' },
      { label: 'Main does not merge into the branch', text: 'Bringing {branch} up to date with main failed (a merge conflict, most likely); nothing was pushed or merged. Merge origin/main into the branch yourself, resolve the conflicts, run the checks again, commit, and call request_merge again. Git said: {output}' },
      { label: 'Pushing failed', text: 'Pushing branch {branch} failed; nothing was merged: {output}' },
      { label: 'Opening the pull request failed', text: 'Opening the pull request failed; nothing was merged: {output}' },
      { label: 'The new pull request cannot be read', text: 'The pull request was opened but cannot be read; nothing was merged.' },
      { label: 'Auto-merge could not be turned on', text: 'Turning on auto-merge for #{number} failed: {output}' },
    ], applies: { Chat: BOTH, Implementer: BOTH }, when: 'After request_merge; the main text is the success reply.', channel: REPLY,
    sources: [{ file: 'app/src/merge.ts', symbol: 'requestMerge' }], placeholders: { branch: "the session's branch", binding: 'the binding refusal', output: "git's or gh's output", number: 'the pull request number', url: 'its address' }, from: 'copy' },
  { id: 'reply.merged-pr', group: 'Tool replies and refusals', title: 'Branch already merged', purpose: 'Stops publishing from a branch whose pull request already merged and points to "Continue in a new chat" (#62).',
    text: 'Pull request #{number} of branch {branch} is already merged ({url}), and this branch contains its commits, so nothing more can be published from it. Do not switch this worktree to another branch to publish: request_merge publishes only this session\'s branch. Tell the user to continue the conversation in a new chat ("Continue in a new chat" in the workspace), on a new branch from origin/main or on an existing branch they pick.',
    applies: { Chat: BOTH, Implementer: BOTH }, when: 'request_merge on a branch whose merged pull request is in its history, before the card or after Allow (then it starts with "Nothing was pushed or merged.").', channel: REPLY,
    sources: [{ file: 'app/src/merge.ts', symbol: 'mergedText' }], placeholders: { number: 'the pull request number', branch: "the session's branch", url: 'its address' }, from: 'copy' },
  { id: 'reply.binding', group: 'Tool replies and refusals', title: 'Binding refusal', purpose: "Why the workspace will not publish from a session whose stored worktree and branch no longer match git, and how to go on (#62, ADR 0019).",
    text: '{reason} {Session} {id} of project {project} is bound to branch {branch} in {path}. {kept} {next}', variants: [
      { label: 'Kept work', text: 'Its worktree keeps {files} and {commits} on no remote branch, untouched.' },
      { label: 'Kept work, when git cannot read the worktree', text: 'Its worktree could not be read; nothing in it was touched.' },
      { label: 'Reason: the project was removed', text: 'Project {project} is no longer in the workspace.' },
      { label: 'Reason: not the app project', text: 'Project {project} is not the app project, the only one whose sessions work in worktrees.' },
      { label: 'Reason: a foreign folder', text: 'The folder {path} is not a worktree the workspace keeps for project {project}.' },
      { label: 'Reason: the worktree is gone', text: "This session's worktree is gone ({path}, branch {branch})." },
      { label: 'Reason: not a worktree of the repository', text: 'The folder {path} is not a worktree of the repository {repo}.' },
      { label: 'Reason: another branch or a detached HEAD', text: 'The worktree has {checkedOut} checked out (HEAD {head}), not the bound branch {branch}.{gone}' },
      { label: 'Reason: its pull request merged', text: 'Pull request #{number} ({url}) of branch {branch} is already merged, and the branch contains its commits: its work is published.' },
      { label: 'Next, for a chat', text: 'The workspace runs no agent and publishes nothing for this chat until the binding matches; it switched, reset and deleted nothing. To keep working, continue this conversation in a new chat ("Continue in a new chat" below), on a new branch from freshly fetched origin/main or on an existing branch you pick.' },
      { label: 'Next, for a task', text: 'The workspace runs no agent and publishes nothing for it until the binding matches; continue the work from its chat.' },
    ], applies: { Chat: BOTH, Implementer: BOTH },
    when: 'request_merge, before the card and again after Allow. A turn refused for the same reason shows it to the user instead; the agent does not run then.', channel: REPLY,
    sources: [{ file: 'app/src/binding.ts', symbol: 'bindingProblem' }, { file: 'app/src/binding.ts', symbol: 'keptWork' }],
    placeholders: { reason: 'one of the reasons below', Session: 'Chat or Task', id: 'the session id', project: 'the project id', branch: 'the stored branch', path: 'the stored worktree folder', kept: 'one of the kept-work sentences below', files: 'the uncommitted files, for example "2 uncommitted files"', commits: 'the commits on no remote branch, for example "1 commit"', next: 'the next step below for a chat or a task', repo: "the project's repository folder", checkedOut: 'the branch or "a detached HEAD"', gone: '" Branch <branch> no longer exists." when the bound branch is gone, else nothing', head: 'the short commit id', number: 'the pull request number', url: 'its address' }, from: 'copy' },
  { id: 'guard.notice', group: 'Tool replies and refusals', title: 'Write guard refusal', purpose: "Why a write into the running app's checkout or the workspace storage was refused (selfdev-002, ADR 0015).",
    text: guardNotice('{folder}', { file: '{file}' }), variants: [{ label: 'A command', text: guardNotice('{folder}', { command: '{command}' }) }], applies: { Chat: BOTH, Implementer: BOTH }, needs: 'refusalText',
    when: "A Claude Code edit or command that would write there; the first paragraph of the refusal is also shown in the chat. Codex's request is declined without text and the chat shows the notice.", channel: 'Reason of the write guard that refuses the call',
    sources: [{ file: 'app/src/worktrees.ts', symbol: 'guardNotice' }], placeholders: { file: 'the file it would write', folder: 'the guarded folder', command: 'the command' }, from: 'definition' },
  { id: 'guard.instead', group: 'Tool replies and refusals', title: 'Write guard: what to do instead', purpose: 'Tells the agent where to work and how to only read.',
    text: "The running app's checkout and the workspace's storage must stay untouched. Work in {worktree}; to only read there, use the Read tool or a command that only reads (such as ls, cat, grep, git log or git diff, without writing output to a file).",
    applies: { Chat: BOTH, Implementer: BOTH }, needs: 'refusalText', when: 'After the write guard refusal, in the same hook reason.', channel: 'Reason of the write guard that refuses the call',
    sources: [{ file: 'app/src/guard.ts', symbol: 'guardDecision' }], placeholders: { worktree: 'the folder the session works in' }, from: 'copy' },
  { id: 'guard.merge', group: 'Tool replies and refusals', title: 'Merge command refused', purpose: 'Sends a merge attempt in a command back to request_merge (selfdev-004).',
    text: "Blocked by the write guard (selfdev-002): `{command}` would merge without the user's approval.\n\nMerging goes through the workspace: report your typecheck and test results, then call the workspace tool request_merge.",
    applies: { Chat: BOTH, Implementer: BOTH }, needs: 'refusalText', when: "A Claude Code command in an app-project worktree that merges a pull request (gh pr merge or the merge API). Codex's request is declined without text.", channel: 'Reason of the write guard that refuses the call',
    sources: [{ file: 'app/src/guard.ts', symbol: 'guardDecision' }, { file: 'app/src/worktrees.ts', symbol: 'GUARD_MARK' }], placeholders: { command: 'the command' }, from: 'copy' },
];

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
