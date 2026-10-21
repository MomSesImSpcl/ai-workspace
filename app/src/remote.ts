// Where a project's repository lives on the web, for "Open in GitHub" (or GitLab, Bitbucket…) in the project menu
// on the Projects page (`app/src/ui.html`). Read from the git remote; Perforce, SVN and folders without a remote
// have none.
import { spawnSync } from 'node:child_process';

/** A repository's web page and the name of the site that hosts it, as the menu item says it. */
export interface RepoWeb { url: string; site: string }

/** Site names of well-known hosts; any other host is named by itself. */
function siteOf(host: string): string {
  if (host === 'github.com') return 'GitHub';
  if (host === 'bitbucket.org') return 'Bitbucket';
  if (host === 'dev.azure.com' || host.endsWith('visualstudio.com')) return 'Azure DevOps';
  if (host === 'codeberg.org') return 'Codeberg';
  if (host === 'git.sr.ht') return 'SourceHut';
  if (host.includes('gitlab')) return 'GitLab';
  return host;
}

/**
 * The web page of a git remote address, or undefined for a local path or `file://`. SSH forms
 * (`git@host:owner/repo.git`, `ssh://git@host:22/owner/repo.git`) become https; sign-in data in an https address is
 * dropped, so a token never reaches the page; `.git` is cut. Azure DevOps SSH addresses
 * (`git@ssh.dev.azure.com:v3/org/project/repo`) map to `https://dev.azure.com/org/project/_git/repo`.
 */
export function webOf(remote: string): RepoWeb | undefined {
  let host: string, path: string;
  const scp = /^[\w.-]+@([\w.-]+):(?!\/\/)(.+)$/.exec(remote.trim());
  if (scp) [host, path] = [scp[1]!, scp[2]!];
  else {
    let u: URL;
    try { u = new URL(remote.trim()); } catch { return undefined; }
    if (!['https:', 'http:', 'ssh:', 'git:'].includes(u.protocol) || !u.hostname) return undefined;
    [host, path] = [u.hostname, u.pathname];
  }
  path = path.replace(/^\/+/, '').replace(/\.git\/?$/, '').replace(/\/+$/, '');
  if (!path) return undefined;
  if (host === 'ssh.dev.azure.com') {
    const [, org, project, repo] = /^v3\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(path) ?? [];
    if (!repo) return undefined;
    return { url: `https://dev.azure.com/${org}/${project}/_git/${repo}`, site: 'Azure DevOps' };
  }
  return { url: `https://${host}/${path}`, site: siteOf(host) };
}

/** The web page of the repository at `root`: its `origin`, else its first remote; undefined without git or a remote. */
export function projectWeb(root: string): RepoWeb | undefined {
  const git = (args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  let r = git(['remote', 'get-url', 'origin']);
  if (r.status !== 0) {
    const first = git(['remote']).stdout?.split('\n')[0]?.trim();
    if (!first) return undefined;
    r = git(['remote', 'get-url', first]);
  }
  return r.status === 0 ? webOf(r.stdout) : undefined;
}
