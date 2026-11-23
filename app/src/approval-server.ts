// Stdio MCP server of the workspace for one session or task. `approve` is Claude Code's
// --permission-prompt-tool: every "ask" becomes an approval card in the chat, and the user's answer goes
// back to the agent (sessions-019, runtime-002). A chat session gets `start_task` (sessions-002) and the orchestrator's `reply_task`, `task_status`, `list_agents` (orchestrator-006);
// an app-project chat or top-level task gets `request_merge` (selfdev-004); every session and task gets the read-only
// `read_repo` (#31).
// Usage: node src/approval-server.ts <sessionId>. One server serves all turns of a long-lived agent process.
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { awaitAnswer, emit, fingerprint, loadSession, ORCHESTRATION, readEvents, repeatsFor, turns } from './sessions.ts';
import { getRoles } from './roles.ts';
import { decidable, getAgentSetup, setupStatus } from './setup.ts';
import { requestSetup, renameTask, replyFromSession, startedIn, startFromSession, taskStatus, taskUsed } from './tasks.ts';
import { sessionAgents } from './turn.ts';
import { requestMerge } from './merge.ts';
import { bindingProblem } from './binding.ts';
import { readRepo } from './repo-read.ts';
import { getProject, listProjects } from './store.ts';
import { agentText, toolParam } from './registry.ts';

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
  { description: agentText('tool.approve'), inputSchema: { tool_name: z.string(), input: z.record(z.string(), z.unknown()), tool_use_id: z.string().optional() } },
  async (a) => {
    const id = a.tool_use_id ?? randomUUID();
    const repeat = repeatsFor(turns(readEvents(sessionId), true)).get(fingerprint(a.tool_name, a.input));
    emit(sessionId, currentTurn(), { type: 'approval', id, tool: a.tool_name, detail: approvalDetail(a.input), repeat });
    const allow = await awaitAnswer(sessionId, id);
    const reply = allow ? { behavior: 'allow', updatedInput: a.input } : { behavior: 'deny', message: allow === null ? agentText('reply.approve', {}, 'stopped') : agentText('reply.approve') };
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
    description: agentText('tool.read_repo'),
    inputSchema: {
      action: z.enum(['log', 'show', 'branches', 'status', 'prs', 'pr', 'issues', 'issue']),
      project: z.string().optional().describe(toolParam('tool.read_repo', 'project')),
      ref: z.string().optional(), path: z.string().optional(), limit: z.number().int().optional(), number: z.number().int().optional(),
      state: z.enum(['open', 'closed', 'merged', 'all']).optional(), logs: z.boolean().optional(),
    },
  },
  async (a) => {
    try {
      const id = a.project ?? session.projectId;
      if (!id) throw new Error(agentText('reply.read_repo', { projects: listProjects().map((p) => p.id).join(', ') }));
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
      description: agentText('tool.request_setup', { ids: ids.join(', ') }),
      inputSchema: { items: z.array(z.string()), reason: z.string().describe(toolParam('tool.request_setup', 'reason')) },
    },
    async (a) => {
      try { return { content: [{ type: 'text' as const, text: requestSetup(sessionId, a.items, a.reason) }] }; }
      catch (e) { return { content: [{ type: 'text' as const, text: (e as Error).message }], isError: true }; }
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
      description: agentText('tool.start_task'),
      inputSchema: {
        title: z.string().optional().describe(toolParam('tool.start_task', 'title')),
        goal: z.string().describe(toolParam('tool.start_task', 'goal')),
        agent: z.string().optional().describe(toolParam('tool.start_task', 'agent')),
        model: z.string().optional().describe(toolParam('tool.start_task', 'model')),
        effort: z.string().optional().describe(toolParam('tool.start_task', 'effort')),
        reason: z.string().optional().describe(toolParam('tool.start_task', 'reason')),
        tokenBudget: z.number().int().positive().optional().describe(toolParam('tool.start_task', 'tokenBudget')),
        basedOn: z.string().optional().describe(toolParam('tool.start_task', 'basedOn')),
        role: z.string().optional(),
        permissionMode: z.string().optional().describe(toolParam('tool.start_task', 'permissionMode')),
        setup: z.array(z.string()).optional().describe(toolParam('tool.start_task', 'setup')),
      },
    },
    tool((a: { title?: string; goal: string; agent?: string; model?: string; effort?: string; reason?: string; tokenBudget?: number; role?: string; permissionMode?: string; basedOn?: string; setup?: string[] }) => {
      const t = startFromSession(sessionId, { ...a, role: a.role ?? 'Implementation' });
      return agentText('reply.start_task', { task: t.id, choice: [t.integration, t.model, t.effort].filter(Boolean).join(', ') });
    }),
  );
  server.registerTool(
    'reply_task',
    { description: agentText('tool.reply_task'), inputSchema: { taskId: z.string(), text: z.string() } },
    tool((a: { taskId: string; text: string }) => agentText('reply.reply_task', { task: replyFromSession(sessionId, a.taskId, a.text).id })),
  );
  server.registerTool(
    'task_status',
    { description: agentText('tool.task_status'), inputSchema: {} },
    tool(() => JSON.stringify(startedIn(sessionId).map((t) => {
      const ts = turns(readEvents(t.id), true);
      const last = ts.at(-1);
      return { id: t.id, goal: ts[0]?.user, status: taskStatus(t, ts), agent: t.integration, model: t.model, effort: t.effort, tokenBudget: t.task!.tokenBudget, used: taskUsed(t), stoppedAt: last?.marker, error: last?.error, lastReply: last?.text.slice(-2000) };
    }))),
  );
  server.registerTool(
    'rename_task',
    { description: agentText('tool.rename_task'), inputSchema: { taskId: z.string(), title: z.string() } },
    tool((a: { taskId: string; title: string }) => agentText('reply.rename_task', { task: renameTask(sessionId, a.taskId, a.title).id, title: a.title.trim().slice(0, 200) })),
  );
  server.registerTool(
    'list_agents',
    { description: agentText('tool.list_agents'), inputSchema: {} },
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
      description: agentText('tool.request_merge'),
      inputSchema: {
        checks: z.string().describe(toolParam('tool.request_merge', 'checks')),
        title: z.string().optional().describe(toolParam('tool.request_merge', 'title')),
        body: z.string().optional().describe(toolParam('tool.request_merge', 'body')),
      },
    },
    async (a) => {
      try {
        // The stored binding, checked against git before the card and again after Allow (#62); requestMerge asks gh about merged pull requests itself.
        const text = await requestMerge(wt.branch, wt.path, a, async (detail) => {
          const id = randomUUID();
          emit(sessionId, currentTurn(), { type: 'approval', id, tool: 'Merge pull request', detail });
          return awaitAnswer(sessionId, id);
        }, () => bindingProblem(loadSession(sessionId), { merged: false }));
        return { content: [{ type: 'text' as const, text }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: (e as Error).message }], isError: true };
      }
    },
  );
}

await server.connect(new StdioServerTransport());
