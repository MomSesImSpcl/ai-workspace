// Stdio MCP server of the workspace for one session or task. `approve` is Claude Code's
// --permission-prompt-tool: every "ask" becomes an approval card in the chat, and the user's answer goes
// back to the agent (sessions-019, runtime-002). A top-level task also gets `delegate` (runtime-001), a chat
// session gets `start_task` (sessions-002) and the orchestrator's `reply_task`, `task_status`, `list_agents` (orchestrator-006).
// Usage: node src/approval-server.ts <sessionId>. One server serves all turns of a long-lived agent process.
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { awaitAnswer, emit, fingerprint, loadSession, readEvents, repeatsFor, turns } from './sessions.ts';
import { getRoles } from './roles.ts';
import { decidable, getAgentSetup, itemOn } from './setup.ts';
import { delegate, requestSetup, renameTask, replyFromSession, startedIn, startFromSession, taskStatus, taskUsed } from './tasks.ts';
import { sessionAgents } from './turn.ts';

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
        agent: z.string().optional().describe('An agent from list_agents'),
        model: z.string().optional().describe("One of the agent's models"),
        effort: z.string().optional().describe("One of the model's effort levels"),
        reason: z.string().optional().describe('One line: why this agent, model and effort'),
        tokenBudget: z.number().int().positive().optional().describe('Token cap at real cost; only when the user asked for one'),
        basedOn: z.string().optional().describe('Id of an earlier related task; the new task starts with its goal and result'),
        role: z.string().optional(),
        permissionMode: z.string().optional().describe("One of the agent's own permission modes; omit for the agent's settings"),
        setup: z.array(z.string()).optional().describe("Ids from list_agents' setup list of the plugins, MCP servers, skills or hooks the task needs; omit for none"),
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
    { description: "The agents a task can use, with their models and effort levels, each workspace role's assigned agent, and per agent the setup items (plugins, MCP servers, skills, hooks) a task may add with start_task's setup.", inputSchema: {} },
    tool(() => JSON.stringify({ roles: getRoles(), agents: Object.fromEntries(Object.entries(sessionAgents).map(([k, a]) => [k, a.catalog().models])), setup: Object.fromEntries(Object.keys(sessionAgents).map((k) => [k, decidable(k)])) })),
  );
}

await server.connect(new StdioServerTransport());
