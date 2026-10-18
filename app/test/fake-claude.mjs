// Stand-in for `claude -p --input-format stream-json` in tests: one process answers many turns.
// It keeps a turn counter in memory, so a reply shows whether the same process handled earlier turns.
// A message containing "slow" streams nothing until an interrupt arrives; "delay" answers after a second;
// "args" answers with its arguments.
import { createInterface } from 'node:readline';

// The setup inventory (onboarding-010): one plugin and one MCP server, then exit.
if (process.argv[2] === 'plugin') { console.log(JSON.stringify([{ id: 'demo@market', enabled: true }, { id: 'old@market', enabled: false }])); process.exit(0); }
if (process.argv[2] === 'mcp') { console.log('Checking MCP server health…\n\nclaude.ai github: https://example.test/mcp - ✔ Connected'); process.exit(0); }

let turns = 0;
const effort = process.argv.includes('--effort') ? process.argv[process.argv.indexOf('--effort') + 1] : 'default';
let waiting = null;
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');
const result = (text) => out({ type: 'result', subtype: 'success', is_error: false, result: text, session_id: 'fake-session', usage: { input_tokens: 10, output_tokens: 2 } });

for await (const line of createInterface({ input: process.stdin })) {
  const msg = JSON.parse(line);
  if (msg.type === 'control_request' && msg.request?.subtype === 'interrupt') {
    out({ type: 'control_response', response: { subtype: 'success', request_id: msg.request_id } });
    if (waiting) { waiting = null; result(''); }
    continue;
  }
  if (msg.type !== 'user') continue;
  turns++;
  const text = msg.message.content[0].text;
  out({ type: 'system', subtype: 'init', session_id: 'fake-session', permissionMode: 'default', plugins: [], mcp_servers: [] });
  if (text.includes('slow')) { waiting = true; continue; }
  if (text.includes('delay')) await new Promise((r) => setTimeout(r, 1000));
  out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: text.includes('args') ? JSON.stringify(process.argv.slice(2)) : `turn ${turns} pid ${process.pid} effort ${effort}` } } });
  result(`turn ${turns}`);
}
