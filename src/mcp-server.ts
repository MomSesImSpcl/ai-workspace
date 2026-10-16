// Stdio MCP server exposing the broker's scoped file tools for one task.
// Usage: node src/mcp-server.ts <taskId>
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { authorize, listDir, once, readFile, writeFile, type Scope } from './broker.ts';
import { loadTask } from './runtime.ts';
import { delegate } from './delegate.ts';
import { getProject } from './store.ts';

const task = loadTask(process.argv[2] ?? '');
const scope: Scope = { taskId: task.id, root: getProject(task.projectId).root, write: task.write };

const server = new McpServer({ name: 'ai-workspace', version: '0.1.0' });

async function tool(fn: () => string | Promise<string>) {
  try {
    return { content: [{ type: 'text' as const, text: await fn() }] };
  } catch (e) {
    return { content: [{ type: 'text' as const, text: (e as Error).message }], isError: true };
  }
}

const path = z.string().describe('Path relative to the project root');

server.registerTool('list_dir', { description: 'List a project directory', inputSchema: { path } }, (a) => tool(() => listDir(scope, a.path).join('\n')));
server.registerTool('read_file', { description: 'Read a project file (UTF-8)', inputSchema: { path } }, (a) => tool(() => readFile(scope, a.path)));
server.registerTool(
  'write_file',
  { description: 'Create or overwrite a project file (needs write permission)', inputSchema: { path, content: z.string() } },
  (a) => tool(() => writeFile(scope, a.path, a.content)),
);
server.registerTool(
  'delegate',
  {
    description: 'Run a subtask with the agent assigned to a role (default Implementation) and return its result. Blocks until the subtask finishes.',
    inputSchema: { goal: z.string().describe('Self-contained instructions for the subtask'), role: z.string().optional() },
  },
  (a) =>
    tool(() => {
      authorize(scope, 'delegate');
      return once(scope, 'delegate', { goal: a.goal, role: a.role }, async () => {
        const child = await delegate(task.id, a.goal, a.role);
        const text = `subtask ${child.id} ${child.status}${child.reason ? ` (${child.reason})` : ''}\n${child.result ?? ''}`;
        if (child.status !== 'completed') throw new Error(text);
        return text;
      });
    }),

);

await server.connect(new StdioServerTransport());
