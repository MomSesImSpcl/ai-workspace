// The Codex hook check for Windows (#21): which programs the hooks call, and whether the sandbox can run them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { shellEnvArgs } from '../src/adapters/codex.ts';
import { aclAllowsSandbox, codexHookNotices, hookPrograms, parseAcls, problemNotice, readAcls, resolveProgram, runAclScript, sandboxProblems, type Ace } from '../src/sandbox-check.ts';

const RX = 0x200a9; // ReadAndExecute
const FULL = 0x1f01ff; // FullControl
const owner: Ace[] = [
  { name: 'PC\\someone', sid: 'S-1-5-21-1-2-3-1001', rights: FULL, allow: true },
  { name: 'BUILTIN\\Administratoren', sid: 'S-1-5-32-544', rights: FULL, allow: true },
  { name: 'NT-AUTORITÄT\\SYSTEM', sid: 'S-1-5-18', rights: FULL, allow: true },
];

test('the programs of a Codex hooks.json that can rewrite shell commands: PreToolUse hooks on the shell only', () => {
  const hooks = { hooks: {
    PreToolUse: [
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'rtk hook codex' }] },
      { hooks: [{ type: 'command', command: "& 'C:/tools/.caveman/bin/caveman-proxy.exe' native-hook codex --adapter 'C:/x/hook.js' --node 'C:/Program Files/nodejs/node.EXE'" }] },
    ],
    SessionStart: [{ hooks: [{ type: 'command', command: "powershell -NoProfile -File 'C:/tools/sync.ps1'", timeout: 30 }] }],
    Stop: [{ hooks: [{ type: 'prompt', command: 'ignored' }] }],
  } };
  // Only shell-rewriting hooks count (user, 2026-10-20): caveman's hook has no matcher, sync runs at SessionStart.
  assert.deepEqual(hookPrograms(hooks), ['rtk']);
  const shell = { hooks: { PreToolUse: [
    { matcher: 'Edit|shell', hooks: [{ type: 'command', command: "& 'C:/tools/wrap.exe' run --with 'C:/tools/helper.exe'" }] },
    { matcher: 'Bashful', hooks: [{ type: 'command', command: 'not-a-shell-matcher' }] },
    { matcher: 'apply_patch', hooks: [{ type: 'command', command: 'patcher' }] },
  ] } };
  assert.deepEqual(hookPrograms(shell), ['C:/tools/wrap.exe', 'C:/tools/helper.exe'], 'a shell in a list, its .exe arguments; whole words only');
  assert.deepEqual(hookPrograms(undefined), []);
});

test('the sandbox may run a file when it, Users, Authenticated Users or Everyone can read and run it; a deny wins', () => {
  assert.equal(aclAllowsSandbox(owner), false, 'only the owner, administrators and SYSTEM (rtk.exe before the fix)');
  assert.equal(aclAllowsSandbox([...owner, { name: 'PC\\CodexSandboxUsers', sid: 'S-1-5-21-1-2-3-1009', rights: RX, allow: true }]), true, 'after icacls /reset');
  assert.equal(aclAllowsSandbox([...owner, { name: 'VORDEFINIERT\\Benutzer', sid: 'S-1-5-32-545', rights: RX, allow: true }]), true, 'Users, in any language (git.exe)');
  assert.equal(aclAllowsSandbox([{ name: 'Jeder', sid: 'S-1-1-0', rights: -1610612736, allow: true }]), true, 'generic read and execute');
  assert.equal(aclAllowsSandbox([{ name: 'X\\CodexSandboxUsers', sid: '', rights: 0x1, allow: true }]), false, 'read only');
  assert.equal(aclAllowsSandbox([{ name: 'X\\CodexSandboxUsers', sid: '', rights: 0x20, allow: false }, { name: 'B\\Users', sid: 'S-1-5-32-545', rights: RX, allow: true }]), false, 'deny');
});

test('linked programs and programs without permission are reported with their fix; unreadable lists are not', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ws-sandbox-'));
  const links = join(dir, 'Links'), pkg = join(dir, 'Packages', 'rtk'), bin = join(dir, 'bin');
  for (const d of [links, pkg, bin]) mkdirSync(d, { recursive: true });
  for (const f of [join(pkg, 'rtk.exe'), join(bin, 'ok.exe'), join(bin, 'unread.exe'), join(bin, 'proxy.exe')]) writeFileSync(f, '');
  const path = [pkg, links, bin].join(delimiter);
  assert.equal(resolveProgram('rtk', path, '.EXE'), join(pkg, 'rtk.exe'), 'a bare name, first match on the PATH');
  assert.equal(resolveProgram('missing', path, '.EXE'), undefined);
  const fakeAcls = (files: string[]) => Object.fromEntries(files.filter((f) => !f.endsWith('unread.exe')).map((f) => [f, f.endsWith('ok.exe') ? [{ name: 'B\\Users', sid: 'S-1-5-32-545', rights: RX, allow: true }] : owner]));
  assert.deepEqual(sandboxProblems(['rtk', join(bin, 'ok.exe'), join(bin, 'unread.exe'), 'missing'], path, fakeAcls, '.EXE'), [{ file: join(pkg, 'rtk.exe'), reason: 'acl' }]);
  const notice = problemNotice({ file: join(pkg, 'rtk.exe'), reason: 'acl' });
  assert.ok(notice.includes(`icacls "${join(pkg, 'rtk.exe')}" /reset`) && notice.includes('CodexSandboxUsers'));
  try { symlinkSync(join(bin, 'proxy.exe'), join(links, 'proxy.exe')); } catch { t.skip('no permission to make links here'); return; }
  const real = realpathSync(join(bin, 'proxy.exe'));
  const linked = sandboxProblems([join(links, 'proxy.exe')], path, fakeAcls, '.EXE');
  assert.deepEqual(linked, [{ file: join(links, 'proxy.exe'), reason: 'link', target: real }, { file: real, reason: 'acl' }], 'a link, and its target is checked too');
  assert.match(problemNotice(linked[0]!), /is a link to .*Change the hook to call/);
});

test('the access-list output is read past a byte-order mark; broken output reads as nothing', () => {
  assert.deepEqual(parseAcls('\uFEFF{"C:\\\\a.exe":[{"name":"B\\\\Users","sid":"S-1-5-32-545","rights":131241,"allow":true}]}'), { 'C:\\a.exe': [{ name: 'B\\Users', sid: 'S-1-5-32-545', rights: 131241, allow: true }] });
  assert.deepEqual(parseAcls(''), {});
  assert.deepEqual(parseAcls('error {'), {});
});

test('no check outside Windows', () => {
  if (process.platform === 'win32') return;
  assert.deepEqual(codexHookNotices(mkdtempSync(join(tmpdir(), 'ws-codex-')), ''), []);
});

test('on Windows the access list of a real file is read as SIDs and numbers, in any system language', () => {
  if (process.platform !== 'win32') return;
  const raw = runAclScript([process.execPath]);
  const aces = parseAcls(raw.stdout)[process.execPath];
  assert.ok(aces && aces.length, `node.exe has an access list; PowerShell said: ${JSON.stringify(raw)}`);
  assert.deepEqual(readAcls([process.execPath])[process.execPath], aces);
  assert.ok(aces.every((a) => typeof a.rights === 'number' && typeof a.allow === 'boolean'));
  assert.ok(aces.some((a) => /^S-1-/.test(a.sid)), 'SIDs, not only translated names');
});

test('Codex on Windows gets CLAUDE_CONFIG_DIR for its shell, unless the user sets it; nothing elsewhere (#21)', () => {
  const dir = 'C:\\tools\\.claude';
  assert.deepEqual(shellEnvArgs('win32', dir, ''), ['-c', 'shell_environment_policy.set.CLAUDE_CONFIG_DIR="C:\\\\tools\\\\.claude"'], 'a TOML string, backslashes escaped');
  assert.deepEqual(shellEnvArgs('linux', dir, ''), []);
  assert.deepEqual(shellEnvArgs('darwin', dir, ''), []);
  for (const own of ['[shell_environment_policy.set]\nCLAUDE_CONFIG_DIR = "x"', 'shell_environment_policy.set.CLAUDE_CONFIG_DIR = "x"', '[shell_environment_policy]\nset = { CLAUDE_CONFIG_DIR = "x" }']) {
    assert.deepEqual(shellEnvArgs('win32', dir, own), [], own);
  }
  assert.equal(shellEnvArgs('win32', dir, '# CLAUDE_CONFIG_DIR = "x"\nmodel = "y"').length, 2, 'a comment does not count');
});
