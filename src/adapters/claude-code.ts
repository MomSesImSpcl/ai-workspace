import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { home } from '../store.ts';
import type { AgentAdapter, StepResult } from '../runtime.ts';

const mcpServer = fileURLToPath(new URL('../mcp-server.ts', import.meta.url));
const TURNS_PER_STEP = 8;

interface ClaudeResult {
  subtype: string;
  is_error: boolean;
  result?: string;
  session_id: string;
  total_cost_usd?: number;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
}

export function parseResult(stdout: string): StepResult {
  const r = JSON.parse(stdout) as ClaudeResult;
  const u = r.usage ?? {};
  const usage = {
    inputTokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    outputTokens: u.output_tokens ?? 0,
    costUsd: r.total_cost_usd,
  };
  const adapterState = { sessionId: r.session_id };
  if (r.subtype === 'error_max_turns') return { done: false, usage, adapterState };
  if (r.is_error || r.subtype !== 'success') return { done: false, error: r.result ?? r.subtype, usage, adapterState };
  return { done: true, text: r.result, usage, adapterState };
}

// Claude Code in print mode with every built-in tool disabled: file access only through the
// workspace MCP server, so the broker enforces scope and audits each call.
export const claudeCode: AgentAdapter = {
  step({ task, root }) {
    const mcpConfig = JSON.stringify({
      mcpServers: { ws: { command: process.execPath, args: [mcpServer, task.id], env: { AI_WORKSPACE_HOME: home() } } },
    });
    const sessionId = task.adapterState?.sessionId as string | undefined;
    const args = ['-p', sessionId ? 'Continue the task.' : task.goal, '--output-format', 'json', '--tools', '', '--mcp-config', mcpConfig, '--strict-mcp-config', '--allowedTools', 'mcp__ws', '--max-turns', String(TURNS_PER_STEP)];
    if (sessionId) args.push('--resume', sessionId);
    else args.push('--append-system-prompt', 'Use only the mcp__ws tools for file access. Paths are relative to the project root.');
    return new Promise((resolvePromise, reject) => {
      const child = spawn(process.env.CLAUDE_BIN ?? 'claude', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('error', reject);
      child.on('close', (code) => {
        try {
          resolvePromise(parseResult(out));
        } catch {
          reject(new Error(`claude exited ${code}: ${err.trim() || out.trim()}`));
        }
      });
    });
  },
};
