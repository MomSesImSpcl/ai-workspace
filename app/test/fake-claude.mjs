// Stand-in for `claude -p --input-format stream-json` in tests: one process answers many turns.
// It keeps a turn counter in memory, so a reply shows whether the same process handled earlier turns.
// A message containing "slow" streams nothing until an interrupt arrives.
import { createInterface } from 'node:readline';

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
  out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: `turn ${turns} pid ${process.pid} effort ${effort}` } } });
  result(`turn ${turns}`);
}
