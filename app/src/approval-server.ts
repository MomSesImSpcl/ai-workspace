// Stdio MCP server of the workspace for one session or task. `approve` is Claude Code's
// --permission-prompt-tool: every "ask" becomes an approval card in the chat, and the user's answer goes
// back to the agent (sessions-019, runtime-002). A top-level task also gets `delegate` (runtime-001), a chat
// session gets `start_task` (sessions-002).
// Usage: node src/approval-server.ts <sessionId>. One server serves all turns of a long-lived agent process.
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { awaitAnswer, emit, fingerprint, loadSession, readEvents, repeatsFor, turns } from './sessions.ts';
import { delegate, startFromSession } from './tasks.ts';

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

const task = loadSession(sessionId).task;
if (task && !task.parentId) {
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
  server.registerTool(
    'start_task',
    {
      description: 'Starts a background task in this project with the agent assigned to a workspace role (default Implementation), and returns at once. The task stops at its token budget. Its approval cards, replies and result appear in this chat; the user answers them there.',
      inputSchema: {
        goal: z.string().describe('Self-contained instructions for the task'),
        tokenBudget: z.number().int().positive().describe('Token cap at real cost; the task stops when it is reached'),
        role: z.string().optional(),
        permissionMode: z.string().optional().describe("One of the role's agent's own permission modes; omit for the agent's settings"),
      },
    },
    async (a) => {
      try {
        const t = startFromSession(sessionId, { goal: a.goal, role: a.role ?? 'Implementation', tokenBudget: a.tokenBudget, permissionMode: a.permissionMode });
        return { content: [{ type: 'text' as const, text: `task ${t.id} started (${t.integration}); it runs in the background and shows in this chat` }] };
      } catch (e) {
        return { content: [{ type: 'text' as const, text: (e as Error).message }], isError: true };
      }
    },
  );
}

await server.connect(new StdioServerTransport());
