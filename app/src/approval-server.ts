// Stdio MCP server for Claude Code's --permission-prompt-tool in a session: every "ask" becomes an
// approval card in the chat, and the user's answer goes back to the agent (sessions-019).
// Usage: node src/approval-server.ts <sessionId>. One server serves all turns of a long-lived agent process.
import { setTimeout as sleep } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { emit, readEvents, stopRequested } from './sessions.ts';

const [sessionId = ''] = process.argv.slice(2);
const currentTurn = () => readEvents(sessionId).findLast((e) => e.type === 'user')?.turn ?? 0;

// What the card shows: the command or path, else the input itself.
function approvalDetail(input: Record<string, unknown>): string {
  const d = input.command ?? input.file_path ?? input.notebook_path ?? input.url ?? input.pattern;
  return String(d ?? JSON.stringify(input)).slice(0, 400);
}

async function answer(id: string): Promise<boolean | null> {
  for (;;) {
    const a = readEvents(sessionId).find((e) => e.type === 'approval-answer' && e.id === id);
    if (a?.type === 'approval-answer') return a.allow;
    if (stopRequested(sessionId)) return null;
    await sleep(400);
  }
}

const server = new McpServer({ name: 'ai-workspace-approvals', version: '0.1.0' });
server.registerTool(
  'approve',
  { description: 'Asks the user in the workspace chat whether a tool call may run', inputSchema: { tool_name: z.string(), input: z.record(z.string(), z.unknown()), tool_use_id: z.string().optional() } },
  async (a) => {
    const id = a.tool_use_id ?? randomUUID();
    emit(sessionId, currentTurn(), { type: 'approval', id, tool: a.tool_name, detail: approvalDetail(a.input) });
    const allow = await answer(id);
    const reply = allow ? { behavior: 'allow', updatedInput: a.input } : { behavior: 'deny', message: allow === null ? 'The user stopped the turn.' : 'The user denied this in the workspace.' };
    return { content: [{ type: 'text' as const, text: JSON.stringify(reply) }] };
  },
);

await server.connect(new StdioServerTransport());
