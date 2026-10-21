// Stdio MCP server of the workspace for one session or task. `approve` is Claude Code's
// --permission-prompt-tool: every "ask" becomes an approval card in the chat, and the user's answer goes
// back to the agent (sessions-019, runtime-002). A top-level task also gets `delegate` (runtime-001), a chat
// session gets `start_task` (sessions-002) and the orchestrator's `reply_task`, `task_status`, `list_agents` (orchestrator-006);
// an app-project chat or top-level task gets `request_merge` (selfdev-004); every session and task gets the read-only
// `read_repo` (#31).
// Usage: node src/approval-server.ts <sessionId>. One server serves all turns of a long-lived agent process.
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { awaitAnswer, emit, fingerprint, loadSession, ORCHESTRATION, readEvents, repeatsFor, turns } from './sessions.ts';
import { getRoles } from './roles.ts';
import { decidable, getAgentSetup, itemOn, setupStatus } from './setup.ts';
import { delegate, requestSetup, renameTask, replyFromSession, startedIn, startFromSession, taskStatus, taskUsed } from './tasks.ts';
import { sessionAgents } from './turn.ts';
import { requestMerge } from './merge.ts';
import { readRepo } from './repo-read.ts';
import { getProject, listProjects } from './store.ts';

const [sessionId = ''] = process.argv.slice(2);
const currentTurn = () => readEvents(sessionId).findLast((e) => e.type === 'user')?.turn ?? 0;

// What the card shows: the command or path, else the input itself.
function approvalDetail(input: Record<string, unknown>): string {
  const d = input.command ?? input.file_path ?? input.notebook_path ?? input.url ?? input.pattern;
  return String(d ?? JSON.stringify(input)).slice(0, 400);
}

const server = new McpServer({ name: 'ai-workspace', version: '0.1.0' });
server.registerTool(
  'approve',
  { description: 'Asks the user in the workspace chat whether a tool call may run', inputSchema: { tool_name: z.string(), input: z.record(z.string(), z.unknown()), tool_use_id: z.string().optional() } },
  async (a) => {
    const id = a.tool_use_id ?? randomUUID();
    const repeat = repeatsFor(turns(readEvents(sessionId), true)).get(fingerprint(a.tool_name, a.input));
    emit(sessionId, currentTurn(), { type: 'approval', id, tool: a.tool_name, detail: approvalDetail(a.input), repeat });
    const allow = await awaitAnswer(sessionId, id);
    const reply = allow ? { behavior: 'allow', updatedInput: a.input } : { behavior: 'deny', message: allow === null ? 'The user stopped the turn.' : 'The user denied this in the workspace.' };
    return { content: [{ type: 'text' as const, text: JSON.stringify(reply) }] };
  },
);

const session = loadSession(sessionId);
const task = session.task;

// Commit history, pull requests, checks and issues of any project in the workspace, read only (#31): the orchestrator
// cannot run commands, and Codex's worktree shells have no gh login.
server.registerTool(
  'read_repo',
  {
    description: "Reads a workspace project's repository, never changes it: log (recent commits; ref, path, limit), show (one commit with its diff; ref), branches (every local and remote branch with its worktree and ahead/behind counts against main), status (git status --short of the project checkout, or of a worktree of the project given as path), prs and issues (lists; state, limit), pr (one pull request with its checks; number, logs for the failed lines of failed checks), issue (one issue with comments; number). project defaults to this session's project.",
    inputSchema: {
      action: z.enum(['log', 'show', 'branches', 'status', 'prs', 'pr', 'issues', 'issue']),
      project: z.string().optional().describe('A workspace project id; default: this session\'s project'),
      ref: z.string().optional(), path: z.string().optional(), limit: z.number().int().optional(), number: z.number().int().optional(),
      state: z.enum(['open', 'closed', 'merged', 'all']).optional(), logs: z.boolean().optional(),
    },
  },
  async (a) => {
    try {
      const id = a.project ?? session.projectId;
      if (!id) throw new Error(`This is a global session: name a project. Projects: ${listProjects().map((p) => p.id).join(', ')}`);
      return { content: [{ type: 'text' as const, text: await readRepo(getProject(id).root, a) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: (e as Error).message }], isError: true };
    }
  },
);
if (task) {
  // A task that finds an item missing asks for it and continues with it (orchestrator-005).
  const ids = (getAgentSetup().inventory?.[session.integration] ?? []).map((i) => i.id);
  server.registerTool(
    'request_setup',
    {
      description: `Asks the workspace to enable built-in tools or setup items this task is missing, then continues the task with them in a new process. End your turn right after calling it. Ids: ${ids.join(', ')}`,
      inputSchema: { items: z.array(z.string()), reason: z.string().describe('One line: why the task needs them') },
    },
    async (a) => {
      try { return { content: [{ type: 'text' as const, text: requestSetup(sessionId, a.items, a.reason) }] }; }
      catch (e) { return { content: [{ type: 'text' as const, text: (e as Error).message }], isError: true }; }
    },
  );
}
if (task && !task.parentId && itemOn(session, 'delegate')) {
  server.registerTool(
    'delegate',
    {
      description: 'Runs a self-contained subtask with the agent assigned to a workspace role (default Implementation) in this project, and returns its final reply. Blocks until the subtask ends. The subtask gets at most the remaining token budget.',
      inputSchema: { goal: z.string().describe('Self-contained instructions for the subtask'), role: z.string().optional() },
    },
    async (a) => {
      try {
        return { content: [{ type: 'text' as const, text: await delegate(sessionId, a.goal, a.role) }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: (e as Error).message }], isError: true };
      }
    },
  );
}

if (!task) {
  const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });
  const tool = <A,>(f: (a: A) => string) => async (a: A) => {
    try { return ok(f(a)); } catch (e) { return { ...ok((e as Error).message), isError: true }; }
  };
  server.registerTool(
    'start_task',
    {
      description: "Starts a background task in this project and returns at once. Agent, model and effort default to the role's assignment (default role Implementation); list_agents shows the choices. The task runs uncapped unless tokenBudget is given or the chat has a cap. Its approval cards, replies and result appear in this chat; the user answers them there.",
      inputSchema: {
        title: z.string().optional().describe('A short title of what the task does, a few words'),
        goal: z.string().describe('Self-contained instructions for the task'),
        agent: z.string().optional().describe("Omit to use the role's configured agent; a different implementer requires an explicit user override"),
        model: z.string().optional().describe("Omit to use the role's configured model; change only for an explicit user override"),
        effort: z.string().optional().describe("One of the model's effort levels"),
        reason: z.string().optional().describe('One line: why this agent, model and effort'),
        tokenBudget: z.number().int().positive().optional().describe('Token cap at real cost; only when the user asked for one'),
        basedOn: z.string().optional().describe('Id of an earlier related task; the new task starts with its goal and result'),
        role: z.string().optional(),
        permissionMode: z.string().optional().describe("One of the agent's own permission modes; omit for the agent's settings"),
        setup: z.array(z.string()).optional().describe("Ids from the selected agent's list_agents setup list that the task needs; setupStatus shows always-on items and whether a built-in tool must be selected. Never use another agent's ids"),
      },
    },
    tool((a: { title?: string; goal: string; agent?: string; model?: string; effort?: string; reason?: string; tokenBudget?: number; role?: string; permissionMode?: string; basedOn?: string; setup?: string[] }) => {
      const t = startFromSession(sessionId, { ...a, role: a.role ?? 'Implementation' });
      return `task ${t.id} started (${[t.integration, t.model, t.effort].filter(Boolean).join(', ')}); it runs in the background and shows in this chat`;
    }),
  );
  server.registerTool(
    'reply_task',
    { description: 'Sends a change or correction to a running task of this chat; it gets the message when its current step ends. A finished task is not continued this way: start a new one with basedOn.', inputSchema: { taskId: z.string(), text: z.string() } },
    tool((a: { taskId: string; text: string }) => `sent to task ${replyFromSession(sessionId, a.taskId, a.text).id}`),
  );
  server.registerTool(
    'task_status',
    { description: 'Lists the tasks started in this chat: goal, status, agent, tokens used and the last reply.', inputSchema: {} },
    tool(() => JSON.stringify(startedIn(sessionId).map((t) => {
      const ts = turns(readEvents(t.id), true);
      const last = ts.at(-1);
      return { id: t.id, goal: ts[0]?.user, status: taskStatus(t, ts), agent: t.integration, model: t.model, effort: t.effort, tokenBudget: t.task!.tokenBudget, used: taskUsed(t), stoppedAt: last?.marker, lastReply: last?.text.slice(-2000) };
    }))),
  );
  server.registerTool(
    'rename_task',
    { description: 'Changes the title of a task started in this chat, as the workspace lists it.', inputSchema: { taskId: z.string(), title: z.string() } },
    tool((a: { taskId: string; title: string }) => `task ${renameTask(sessionId, a.taskId, a.title).id} is now titled "${a.title.trim().slice(0, 200)}"`),
  );
  server.registerTool(
    'list_agents',
    { description: "Current role assignments (agent, model, effort), each agent's catalog, decidable setup items and setupStatus (alwaysOn ids, requiresBuiltInTool). Use the configured Implementation agent and model unless the user explicitly overrides them. Setup lists are switches, not complete capability catalogs; a missing tool:* id is not a reason to switch agents.", inputSchema: {} },
    tool(() => JSON.stringify({ roles: getRoles(), agents: Object.fromEntries(Object.entries(sessionAgents).map(([k, a]) => [k, a.catalog().models])), setup: Object.fromEntries(Object.keys(sessionAgents).map((k) => [k, decidable(k)])), setupStatus: Object.fromEntries(Object.keys(sessionAgents).map((k) => [k, setupStatus(k)])) })),
  );
}

// An app-project chat or top-level task merges its branch into main only through the workspace, after the user's
// approval (selfdev-004, ADR 0017); the app runs gh itself, outside any agent sandbox.
const wt = session.worktree;
if (wt && session.role !== ORCHESTRATION && !task?.parentId) {
  server.registerTool(
    'request_merge',
    {
      description: "Merges this session's branch into main after the user approves a card in the chat: pushes the branch, opens its pull request if there is none (then title, and optionally body, are needed), and squash-merges it once the required checks pass. Commit first; no need to push. Blocks until the user answers.",
      inputSchema: {
        checks: z.string().describe('Your typecheck and test results, in one or two lines (for example: typecheck clean; npm test 70/70)'),
        title: z.string().optional().describe('Pull request title, if the branch has none yet'),
        body: z.string().optional().describe('Pull request description, if the branch has none yet'),
      },
    },
    async (a) => {
      try {
        const text = await requestMerge(wt.branch, wt.path, a, async (detail) => {
          const id = randomUUID();
          emit(sessionId, currentTurn(), { type: 'approval', id, tool: 'Merge pull request', detail });
          return awaitAnswer(sessionId, id);
        });
        return { content: [{ type: 'text' as const, text }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: (e as Error).message }], isError: true };
      }
    },
  );
}

await server.connect(new StdioServerTransport());
