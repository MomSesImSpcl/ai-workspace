// Stand-in for `codex app-server` in tests (JSON-RPC lines over stdio). Turn text controls it:
// "ask" requests approval for a command first, "slow" waits for turn/interrupt, "spend" reports usage
// and then waits, anything else runs `echo hi` and replies.
import { createInterface } from 'node:readline';

const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const thread = 'thread-1';
let turnNo = 0;
let total = { totalTokens: 0, inputTokens: 0, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 };
let waiting = null; // the turn waiting for an interrupt
const answers = new Map();
let started = {}; // the last thread/start params, shown by an "args" turn
let aiws; // the workspace server's start-up status, shown by an "args" turn

function spend(turnId, input, output) {
  const last = { totalTokens: input + output, inputTokens: input, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: output, reasoningOutputTokens: 0 };
  total = { ...total, totalTokens: total.totalTokens + input + output, inputTokens: total.inputTokens + input, outputTokens: total.outputTokens + output };
  out({ method: 'thread/tokenUsage/updated', params: { threadId: thread, turnId, tokenUsage: { total, last, modelContextWindow: null } } });
}
const completed = (turnId, status) => out({ method: 'turn/completed', params: { threadId: thread, turn: { id: turnId, items: [], status, error: null } } });

async function run(turnId, text) {
  out({ method: 'turn/started', params: { threadId: thread, turn: { id: turnId, items: [], status: 'inProgress' } } });
  const command = text.includes('repeat') ? 'echo repeat' : 'echo hi';
  let status = 'completed';
  if (text.includes('ask')) {
    const decision = await new Promise((resolve) => {
      answers.set(99, resolve);
      out({ id: 99, method: 'item/commandExecution/requestApproval', params: { threadId: thread, turnId, itemId: 'cmd-1', command, startedAtMs: Date.now() } });
    });
    if (decision !== 'accept') status = 'declined';
  }
  out({ method: 'item/started', params: { threadId: thread, turnId, item: { type: 'commandExecution', id: `cmd-${turnId}`, command, status: 'inProgress' } } });
  if (text.includes('slow') || text.includes('spend') || text.includes('repeat')) {
    if (text.includes('spend')) spend(turnId, 600, 50);
    waiting = turnId;
    return;
  }
  out({ method: 'item/completed', params: { threadId: thread, turnId, item: { type: 'commandExecution', id: `cmd-${turnId}`, command, status, exitCode: status === 'completed' ? 0 : null } } });
  out({ method: 'item/agentMessage/delta', params: { threadId: thread, turnId, itemId: 'm1', delta: `codex turn ${turnNo}` } });
  out({ method: 'item/agentMessage/delta', params: { threadId: thread, turnId, itemId: 'm1', delta: ` pid ${process.pid}` } });
  out({ method: 'item/completed', params: { threadId: thread, turnId, item: { type: 'agentMessage', id: 'm1', text: `codex turn ${turnNo} pid ${process.pid}` } } });
  spend(turnId, 10, 2);
  completed(turnId, 'completed');
}

for await (const line of createInterface({ input: process.stdin })) {
  const m = JSON.parse(line);
  if (m.id !== undefined && !m.method) { answers.get(m.id)?.(m.result?.decision); continue; }
  if (m.method === 'initialize') out({ id: m.id, result: { userAgent: 'fake' } });
  else if (m.method === 'thread/start' || m.method === 'thread/resume') {
    if (m.method === 'thread/resume' && m.params.threadId !== thread) { out({ id: m.id, error: { message: 'no thread' } }); continue; }
    started = m.params;
    // Like Codex, the workspace server connects in the background after the thread starts.
    if (m.params.config?.['mcp_servers.aiws']) {
      aiws = 'starting';
      out({ method: 'mcpServer/startupStatus/updated', params: { name: 'aiws', status: 'starting' } });
      setTimeout(() => { aiws = 'ready'; out({ method: 'mcpServer/startupStatus/updated', params: { name: 'aiws', status: 'ready' } }); }, 300);
    }
    out({ id: m.id, result:{ thread: { id: thread }, model: m.params.model ?? 'fake-model', approvalPolicy: m.params.approvalPolicy ?? 'on-request', sandbox: { type: m.params.sandbox ?? 'workspaceWrite' }, instructionSources: ['AGENTS.md'] } });
  } else if (m.method === 'turn/start') {
    turnNo++;
    const turnId = `turn-${turnNo}`;
    out({ id: m.id, result: { turn: { id: turnId, items: [], status: 'inProgress' } } });
    if (m.params.input[0].text.includes('args')) {
      const text = JSON.stringify({ config: started.config, developerInstructions: started.developerInstructions, disabledPluginIds: m.params.disabledPluginIds, aiws });
      out({ method: 'item/completed', params: { threadId: thread, turnId, item: { type: 'agentMessage', id: 'm1', text } } });
      completed(turnId, 'completed');
    } else void run(turnId, m.params.input[0].text);
  } else if (m.method === 'turn/interrupt') {
    out({ id: m.id, result: {} });
    if (waiting) { completed(waiting, 'interrupted'); waiting = null; }
  } else if (m.method === 'plugin/list') out({ id: m.id, result: { marketplaces: [{ plugins: [{ id: 'demo@market', name: 'demo', installed: true, enabled: true, interface: { displayName: 'Demo', shortDescription: 'A demo plugin' } }] }] } });
  else if (m.method === 'config/read') out({ id: m.id, result: { config: { mcp_servers: { tools: { command: 'tools-server' } } } } });
  else if (m.method === 'skills/list') out({ id: m.id, result: { data: [{ skills: [{ name: 'own', path: '/skills/own/SKILL.md', enabled: true, pluginId: null }, { name: 'demo-skill', path: '/p/SKILL.md', enabled: true, pluginId: 'demo@market' }] }] } });
  else if (m.id !== undefined) out({ id: m.id, result: {} });
}
