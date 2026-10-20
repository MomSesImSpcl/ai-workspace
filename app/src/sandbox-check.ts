// Start-up check for Codex on Windows (#21): a program the user's Codex hooks call must be runnable inside Codex's
// sandbox, or the commands the hooks rewrite (for example `git` into `rtk git`) fail there. Decided from the file
// itself (a link, or no read-and-execute for the sandbox's users), never from error text, which depends on the
// Windows language. The app only reports; the user fixes permissions.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { delimiter, isAbsolute, join } from 'node:path';

/** One access-control entry of a file, as read by `readAcls`. */
export interface Ace { name: string; sid: string; rights: number; allow: boolean }

/** A program a hook calls that Codex's sandbox cannot run, and why. */
export interface Problem { file: string; reason: 'link' | 'acl'; target?: string }

/** A command's words, quote-aware ('...' and "..."), without PowerShell's call operator `&`. */
function words(command: string): string[] {
  const out: string[] = [];
  for (const m of command.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)) out.push(m[1] ?? m[2] ?? m[3]!);
  return out[0] === '&' ? out.slice(1) : out;
}

/** A hook matcher that targets Codex's shell tool, alone or in a `|` list. */
const SHELL_MATCHER = /(^|\|)\s*(bash|shell|local_shell|exec)\s*($|\|)/i;

/**
 * The programs of the hooks in a Codex `hooks.json` that can change shell commands: `PreToolUse` hooks whose matcher
 * targets the shell (user, 2026-10-20). Hooks run outside the sandbox; only the commands they rewrite run inside it,
 * so a program like `rtk` (which turns `git` into `rtk git`) must run there, while other hooks' programs need not.
 * Each command's first word and any `.exe` among its arguments count.
 */
export function hookPrograms(hooksJson: unknown): string[] {
  const out = new Set<string>();
  const pre = (hooksJson as { hooks?: { PreToolUse?: { matcher?: string; hooks?: { type?: string; command?: string }[] }[] } } | undefined)?.hooks?.PreToolUse ?? [];
  for (const group of pre.filter((g) => typeof g.matcher === 'string' && SHELL_MATCHER.test(g.matcher))) {
    for (const h of group.hooks ?? []) {
      if (h.type !== 'command' || typeof h.command !== 'string') continue;
      const [first, ...rest] = words(h.command);
      if (first) out.add(first);
      for (const w of rest) if (/\.exe$/i.test(w) && /[\\/]/.test(w)) out.add(w);
    }
  }
  return [...out];
}

/** The file a program name runs: a path as is, a bare name searched in `path` with the `pathext` endings. */
export function resolveProgram(name: string, path: string, pathext = '.COM;.EXE;.BAT;.CMD'): string | undefined {
  // PATHEXT spells endings in capitals. Lower case first: files are named so, and a system that ignores case
  // (Windows, macOS) then reports the name as it is.
  const exts = ['', ...new Set(pathext.split(';').filter(Boolean).flatMap((e) => [e.toLowerCase(), e]))];
  const isFile = (f: string) => { try { return statSync(f).isFile(); } catch { return false; } };
  const candidates = isAbsolute(name) || /[\\/]/.test(name) ? exts.map((e) => name + e) : path.split(delimiter).filter(Boolean).flatMap((d) => exts.map((e) => join(d, name + e)));
  return candidates.find((f) => existsSync(f) && isFile(f));
}

// Who Codex's sandbox runs as: its own group, and the built-in groups its users belong to (Users, by the user's
// test: git.exe runs through it; Authenticated Users and Everyone, assumed). By SID or, for the sandbox's own
// group, its name, which Windows does not translate.
const SANDBOX_SIDS = new Set(['S-1-5-32-545', 'S-1-5-11', 'S-1-1-0']);
const forSandbox = (a: Ace) => SANDBOX_SIDS.has(a.sid) || /(^|\\)CodexSandboxUsers$/i.test(a.name);

/** Whether rights allow reading and running a file: read data and execute, or the generic all, or generic read and execute. */
function readExecute(rights: number): boolean {
  const r = rights >>> 0;
  return (r & 0x21) === 0x21 || (r & 0x10000000) !== 0 || ((r & 0x20000000) !== 0 && (r & 0x80000000) !== 0);
}

/** Whether a file's access list lets Codex's sandbox read and run it; a deny for the sandbox wins. */
export function aclAllowsSandbox(aces: Ace[]): boolean {
  const mine = aces.filter(forSandbox);
  if (mine.some((a) => !a.allow && ((a.rights >>> 0) & 0x21) !== 0)) return false;
  return mine.some((a) => a.allow && readExecute(a.rights));
}

/**
 * The access lists of `files` (Windows): one PowerShell call, with each entry's SID and rights as a number, so
 * nothing depends on the system's language. A file that cannot be read is left out.
 */
export function readAcls(files: string[]): Record<string, Ace[]> {
  return files.length ? parseAcls(runAclScript(files).stdout) : {};
}

// UTF-8 without a byte-order mark, so the output is plain JSON.
const ACL_SCRIPT = `[Console]::OutputEncoding=New-Object Text.UTF8Encoding $false; $o=@{}; foreach($f in (ConvertFrom-Json $env:AIWS_FILES)){ try { $o[$f]=@((Get-Acl -LiteralPath $f).Access | ForEach-Object { $s=''; try { $s=$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch {}; @{ name=[string]$_.IdentityReference.Value; sid=$s; rights=[int64]$_.FileSystemRights; allow=($_.AccessControlType -eq 'Allow') } }) } catch { [Console]::Error.WriteLine("$f : $_") } }; $o | ConvertTo-Json -Depth 4 -Compress`;

/** Runs the access-list script for `files` with Windows PowerShell; its errors go to stderr. Under a second on a desktop; CI runners can take far longer. */
export function runAclScript(files: string[], timeout = 20_000): { stdout: string; stderr: string } {
  // Started from PowerShell 7, Windows PowerShell inherits its module path and cannot load Get-Acl.
  const { PSModulePath: _, ...env } = process.env;
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ACL_SCRIPT], { env: { ...env, AIWS_FILES: JSON.stringify(files) }, encoding: 'utf8', windowsHide: true, timeout });
  return { stdout: r.stdout ?? '', stderr: `${r.stderr ?? ''}${r.error ? r.error.message : ''}` };
}

/** The script's output as access lists; anything before the JSON (a byte-order mark) is skipped. */
export function parseAcls(stdout: string): Record<string, Ace[]> {
  const at = stdout.indexOf('{');
  try { return at < 0 ? {} : JSON.parse(stdout.slice(at)) as Record<string, Ace[]>; } catch { return {}; }
}

/** The problems of the programs `programs` (from `hookPrograms`), found with `path`; `acls` reads access lists. */
export function sandboxProblems(programs: string[], path: string, acls: (files: string[]) => Record<string, Ace[]> = readAcls, pathext?: string): Problem[] {
  const problems: Problem[] = [];
  const files: string[] = [];
  for (const p of programs) {
    const file = resolveProgram(p, path, pathext);
    if (!file) continue; // not found: the hook fails outside the sandbox too, which is not this check's to report
    let link = false;
    try { link = lstatSync(file).isSymbolicLink(); } catch { /* gone */ }
    if (link) {
      let target: string | undefined;
      try { target = realpathSync(file); } catch { /* broken */ }
      problems.push({ file, reason: 'link', target });
      if (target) files.push(target);
    } else files.push(file);
  }
  const read = acls([...new Set(files)]);
  for (const f of new Set(files)) if (read[f] && !aclAllowsSandbox(read[f]!)) problems.push({ file: f, reason: 'acl' });
  return problems;
}

/** The chat notice for one problem, with the command that fixes it. */
export function problemNotice(p: Problem): string {
  if (p.reason === 'link') {
    return `Codex's sandbox cannot run ${p.file}, which a Codex hook calls: it is a link${p.target ? ` to ${p.target}` : ''}, and the sandbox cannot run programs through links. Change the hook to call ${p.target ?? 'the real file'} instead.`;
  }
  return `Codex's sandbox cannot run ${p.file}, which a Codex hook calls: the sandbox's users (CodexSandboxUsers) have no permission to read and run it, so commands the hook changes fail inside the sandbox. Run this once in a terminal to let the file take its folder's permissions (read and run only; it may be needed again after the program updates): icacls "${p.file}" /reset`;
}

const seen = new Map<string, string[]>(); // hooks.json content -> notices, once per process

/** The notices for the user's Codex hooks on Windows (empty elsewhere), checked once per process and hooks file. */
export function codexHookNotices(codexHome: string, path: string): string[] {
  if (process.platform !== 'win32') return [];
  let text: string;
  try { text = readFileSync(join(codexHome, 'hooks.json'), 'utf8'); } catch { return []; }
  const key = `${path}\n${text}`;
  if (!seen.has(key)) {
    let programs: string[] = [];
    try { programs = hookPrograms(JSON.parse(text)); } catch { /* not JSON: Codex reports it */ }
    seen.set(key, sandboxProblems(programs, path, readAcls, process.env.PATHEXT).map(problemNotice));
  }
  return seen.get(key)!;
}
