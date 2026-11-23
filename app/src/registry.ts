// The one registry of every fixed text the workspace sends an agent (agent-interface-007): one note per role, the
// fixed parts of the messages it receives, each workspace tool with its parameters and its replies, and the
// refusals. Code sends these only through `agentText`, `composeText` and `toolParam`, and the places that hand text
// to an agent (role notes, tool replies, refusals) accept only their `AgentText` or `asData`, so no text can reach an
// agent without being listed here; the Agent instructions tab (app/src/instructions.ts) lists exactly this. What a
// model writes (a task's goal, a reply) is not here: it differs every time and shows per chat and task. This module
// imports nothing from the app, so every module can use it.

/** The roles an entry can go to: plain chats, orchestrator chats and tasks (the Implementer role, whatever role a task started with). */
export const ROLES = ['Chat', 'Orchestrator', 'Implementer'] as const;
export type Role = (typeof ROLES)[number];
/** Purpose groups, in list order. */
export const GROUPS = ['Role notes', 'Messages', 'Workspace tools and their replies', 'Refusals'] as const;

/** Capabilities an entry can need (`Capabilities` in app/src/sessions.ts); only agents that report it get the entry. */
type Need = 'approvalTool' | 'refusalText';

export interface Entry {
  group: (typeof GROUPS)[number];
  title: string;
  description: string; // what it is for and when it is sent, shown under the title
  textBecause: string; // why this is instruction text and not code (agent-interface-008)
  toCode?: string; // what of it could become a tool schema, default, check or fixed output instead
  text: string; // `{name}` marks a value filled in when it is sent, explained in `placeholders`
  variants?: Record<string, { label: string; text: string }>; // sections, other forms and replies, each with when it is used
  params?: Record<string, string>; // a workspace tool's parameter descriptions, as the agent sees them
  roles: readonly Role[];
  placeholders?: Record<string, string>;
  needs?: Need;
}

const ALL = ROLES;
const CHATS = ['Chat', 'Orchestrator'] as const;
const TOOL_WHY = 'A tool description is how the agent learns what a workspace tool does and when to call it; its replies give the outcome and, for a refusal, what to change.';

/** Opens every write guard refusal; the chat recognises a guard notice by it. */
export const GUARD_MARK = 'Blocked by the write guard (selfdev-002)';

// Sections more than one role note has; each note lists them, so editing one role's note leaves the others alone.
const EFFORT = "AI Workspace: effort level {effort}. This note is always current: when the user changes the level in the workspace's composer, the agent is restarted with the new level and an updated note.";
const READ_REPO = 'For commit history, pull requests, checks and issues of a workspace project, use the workspace tool read_repo.';
const OWN = { label: "The user's own instructions for this role (Settings → Agents), when not empty", text: "The user's own instructions for you, which take precedence over the notes above where they conflict: {instructions}" };
const MERGE = { label: "In the app project's own worktrees (not for subtasks)", text: "This session works in its own git worktree and branch of the workspace's own repository. Writes outside this worktree are blocked: keep your shell in this folder (elsewhere only read, e.g. ls, cat, grep, git log), write file contents with your edit tools rather than shell heredocs or scripts, and keep merge commands out of shell command text, even as quoted data. To merge into main, commit your work and call the workspace tool request_merge (with a title and body if the branch has no pull request yet); it runs typecheck and tests itself and merges after the user approves. Keep this worktree on its branch: request_merge publishes only this session's branch." };
const RULES = { label: "In a project inside the workspace folder, when its AGENTS.md is not empty; it comes last", text: "The workspace's own rules (its AGENTS.md), which apply to every project in it:\n{rules}" };
const NOTE_PLACEHOLDERS = { effort: 'the session\'s effort level, or "not set by the workspace (the agent\'s own default)"', instructions: "the text of the role's Instructions field (Settings → Agents)", rules: "the workspace folder's AGENTS.md, as it is when the agent starts" };

export const REGISTRY = {
  // --- Role notes: the system or developer instructions each role starts with, one per role (agentInstructions, app/src/prompt.ts).
  'note.chat': { group: 'Role notes', title: 'Chat note', description: 'Everything a plain chat is told at its start: its effort level, that background work goes to start_task, read_repo, and the sections below when they apply.',
    textBecause: "The effort level is read by the agent's own rules; when work is self-contained enough for a task, and trying read_repo (#31), are judgment the tools cannot make.",
    text: `${EFFORT} To run self-contained work in the background as a task, use the workspace start_task tool. ${READ_REPO}`,
    variants: { own: OWN, merge: MERGE }, roles: ['Chat'], placeholders: NOTE_PLACEHOLDERS },
  'note.orchestrator': { group: 'Role notes', title: 'Orchestrator note', description: "Everything an orchestrator chat is told at its start: its effort level and how it routes every message (reply to a running task, start a new task, or answer itself), and the sections below when they apply.",
    textBecause: "Routing a message, sizing a task's goal, choosing effort, when a cap or an earlier task applies and when to ask back are judgment; start_task enforces the rest.",
    text: `${EFFORT} You are the workspace orchestrator. You never do the work yourself; you cannot edit files, and any command you run may only read. For every message, apply this rule: (1) It changes or corrects the work of a task of this chat that is still running (task_status): send it to that task with reply_task. (2) It asks for anything to be done (create, change, fix, run, set up, write or research something), including more work like a finished task's, or a correction of a finished task: start a new task with start_task, and tell the user it is a new task. When an earlier task of this chat is related, pass its id as basedOn, so the new task starts with that task's goal and result. Size the goal to the task: one or two sentences for a simple, clear request; add acceptance criteria only when the outcome is not obvious; never ask the task to read rule files or to verify more than the request needs. Pass tokenBudget only when the user asked for a cap or accepted your suggestion of one, and in setup only the items the goal needs. (3) It only asks a question (about the code, a task's state or why it failed): answer it yourself, reading files, task_status, search_history for earlier chats and tasks, and read_repo for commit history, pull requests, checks and issues of any workspace project. Ask back only when you cannot name both what to change and the expected outcome, or when a message could either change a running task or be new work. Choosing each task's effort is your job: do not stop to suggest or confirm an effort level.`,
    variants: { own: OWN, rules: RULES }, roles: ['Orchestrator'], placeholders: NOTE_PLACEHOLDERS },
  'note.task': { group: 'Role notes', title: 'Task note', description: 'Everything a background task is told at its start: its effort level, that nobody answers until it ends, read_repo, and the sections below when they apply.',
    textBecause: "The effort level and \"nobody answers\" counter the user's own rules (an effort check that waits for an answer), which only text reaches; trying read_repo is the agent's choice (#31).",
    text: `${EFFORT} This is a background task: nobody answers until it ends, and its effort level is set by the workspace. Do not stop to suggest an effort level or ask to confirm one; do the work. ${READ_REPO}`,
    variants: { own: OWN, merge: MERGE, rules: RULES }, roles: ['Implementer'], placeholders: NOTE_PLACEHOLDERS },
  'minimal-prompt': { group: 'Role notes', title: "Short system prompt instead of the agent's own", description: "A short system prompt that replaces the agent's own when that setup item is off for an orchestrator chat or a task, about 3k to 4k tokens less per call.", textBecause: "The agent needs its folder, system and date; these are facts only text delivers.",
    text: 'You are a coding agent working in {root} on {platform}. Today is {date}.', roles: ['Orchestrator', 'Implementer'],
    placeholders: { root: 'the folder the agent runs in', platform: 'the operating system (win32, darwin, linux)', date: "today's date, YYYY-MM-DD" } },

  // --- Messages: the fixed parts of what the agent receives as a message.
  'message.task-start': { group: 'Messages', title: 'Task start', description: "The message a task starts with: the goal the chat's agent wrote, and the earlier task's goal and last reply when it was started with basedOn.", textBecause: 'The goal is what the task is for; the earlier context is content it cannot see otherwise.',
    text: '{goal}', variants: { basedOn: { label: 'Started with basedOn', text: '{goal}\n\nContext from an earlier related task ({task}, {status}).\nIts goal: {earlierGoal}\nIts last reply: {reply}' } },
    roles: ['Implementer'], placeholders: { goal: "the goal the chat's agent wrote", task: 'the earlier task id', status: 'its status (completed, failed, …)', earlierGoal: 'its own goal, without the context it carried, up to 4,000 characters', reply: 'the end of its last reply, up to 4,000 characters, or "(no reply yet)"' } },
  'message.history': { group: 'Messages', title: 'Earlier conversation', description: 'Gives an agent that cannot resume its own conversation the conversation so far (after an agent switch, in a continued chat, or when its own session is gone); each earlier turn is written in the forms below, joined by a blank line.', textBecause: 'Conversation content the agent cannot see otherwise, not a rule.',
    text: 'Earlier in this conversation:\n\n{history}\n\nUser: {message}',
    variants: { turn: { label: "Each earlier turn: the user's message", text: 'User: {message}' }, reply: { label: "…the agent's reply, when there is one", text: 'You: {reply}' }, marker: { label: '…how it ended, when it did not finish', text: '[{marker}]' } },
    roles: ALL, placeholders: { history: 'the earlier turns in the forms below', message: 'the message of that turn, or the new one', reply: "the agent's reply", marker: 'the unfinished-turn marker (Messages: Turn notes)' } },
  'message.turn': { group: 'Messages', title: 'Turn notes', description: "Put before the next message: that the previous turn did not finish and where it stopped, and what the user wrote directly to one of the chat's tasks since the agent's last reply.", textBecause: 'Facts about earlier turns the agent cannot see otherwise; what to check before repeating is judgment (repeated tool calls are also caught in code, runtime-004).',
    text: '[{marker}. Check the current project state before repeating anything.]',
    variants: {
      step: { label: 'The marker: where it stopped', text: '{outcome} after step {n}: {step}' },
      first: { label: 'The marker, when no step finished', text: '{outcome} before the first step' },
      reason: { label: 'The marker, when the workspace stopped it (a token budget, a possible repeat, paused)', text: '{marker} ({reason})' },
      relay: { label: "What the user wrote to one of the chat's tasks", text: '[Since your last reply the user wrote directly to task {task}: "{text}"]' },
    }, roles: ALL,
    placeholders: { marker: 'the marker in one of the forms below', outcome: 'Interrupted, Stopped or Failed', n: 'the number of finished steps', step: 'the last finished step, as the activity list shows it', reason: 'why the workspace stopped it', task: 'the task id', text: 'what the user wrote' } },
  'message.continue': { group: 'Messages', title: 'Continue a task', description: 'The message that continues a paused, interrupted or finished task, or one that asked for setup items with request_setup.', textBecause: 'A turn needs a message; it names what changed.',
    text: 'Continue the task.', variants: { setup: { label: 'After request_setup, in a new process with the items', text: 'The workspace enabled {ids}. Continue the task.' } },
    roles: ['Implementer'], placeholders: { ids: 'the setup item ids it asked for' } },

  // --- Workspace tools with their parameters and their replies (app/src/approval-server.ts).
  'tool.approve': { group: 'Workspace tools and their replies', title: 'approve', description: 'The permission tool an agent calls for every ask; it shows an approval card and waits for the user.', textBecause: TOOL_WHY,
    text: 'Asks the user in the workspace chat whether a tool call may run', roles: ALL, needs: 'approvalTool',
    variants: { denied: { label: 'Reply: the user denied the card', text: 'The user denied this in the workspace.' }, stopped: { label: 'Reply: the turn was stopped while the card waited', text: 'The user stopped the turn.' } } },
  'tool.read_repo': { group: 'Workspace tools and their replies', title: 'read_repo', description: "Reads a project's commits, branches, status, pull requests, checks and issues without changing anything; its result is git's and gh's output.", textBecause: TOOL_WHY,
    text: "Reads a workspace project's repository without changing it: commits, branches, status, pull requests with their checks, and issues.",
    params: {
      action: 'log: recent commits · show: one commit with its diff · branches: every local and remote branch with its worktree and ahead/behind counts against main · status: git status --short of the project checkout or of one of its worktrees · prs, issues: lists · pr: one pull request with its checks · issue: one issue with its comments',
      project: "A workspace project id; default: this session's project",
      ref: 'Branch or commit (log, show)',
      path: 'A file or folder (log), or a worktree of the project (status)',
      limit: 'How many, 1 to 100, default 20 (log, prs, issues)',
      number: 'Pull request or issue number (pr, issue)',
      state: 'Which ones, default open (prs, issues)',
      logs: 'Also the failed lines of failed checks (pr)',
    }, variants: { global: { label: 'Reply: called in a global chat without project', text: 'This is a global session: name a project. Projects: {projects}' } },
    roles: ALL, placeholders: { projects: 'the ids of the workspace projects' } },
  'tool.search_history': { group: 'Workspace tools and their replies', title: 'search_history', description: 'Lets the orchestrator find earlier chats and tasks by their text, so it answers questions about past work itself; its result is the matching messages as data.', textBecause: TOOL_WHY,
    text: "Searches the workspace's chat and task histories for a text and returns the matching messages with their chat or task, turn and an excerpt, newest first.",
    params: { query: 'Text to find, any case', project: "A workspace project id; default: this chat's project", all: 'Search every project and the global chats' }, roles: ['Orchestrator'] },
  'tool.request_setup': { group: 'Workspace tools and their replies', title: 'request_setup', description: 'Lets a task ask for setup items it is missing and continue with them in a new process.', textBecause: TOOL_WHY,
    text: 'Asks the workspace to enable built-in tools or setup items this task is missing, then continues the task with them in a new process; the current turn ends when the call returns. Ids: {ids}',
    params: { reason: 'One line: why the task needs them' },
    variants: {
      ok: { label: 'Reply: added', text: 'Enabled {ids}. The workspace ends this turn and continues the task with them.' },
      unknown: { label: 'Reply: ids the agent does not list (also when start_task gets them)', text: 'Unknown setup items for {agent}: {ids}' },
      off: { label: 'Reply: items the user switched off for the role', text: 'The user switched these off for this role: {ids}' },
    }, roles: ['Implementer', 'Orchestrator'], placeholders: { ids: "the setup item ids (in the description: every id listed for the task's agent)", agent: "the task's agent" } },
  'tool.start_task': { group: 'Workspace tools and their replies', title: 'start_task', description: 'Starts a background task from a chat on the implementer set in Settings; the orchestrator uses it for all work.', textBecause: TOOL_WHY,
    text: 'Starts a background task in this project on the implementer set in Settings (list_agents) and returns at once. The task runs uncapped unless tokenBudget is given or the chat has a cap. Its approval cards, replies and result appear in this chat; the user answers them there.',
    params: {
      title: 'A short title of what the task does, a few words',
      goal: 'Self-contained instructions for the task',
      model: "One of the implementer's models (list_agents); omit for the one set in Settings",
      effort: "One of the model's effort levels (list_agents)",
      reason: 'One line: why this model, effort and setup items',
      tokenBudget: 'Token cap at real cost; only when the user asked for one',
      basedOn: 'Id of an earlier related task; the new task starts with its goal and result',
      permissionMode: "One of the agent's own permission modes; omit for the agent's settings",
      setup: "Ids from list_agents' setup list that the task needs; setupStatus shows always-on items and whether a built-in tool must be selected",
    },
    variants: {
      ok: { label: 'Reply: started', text: 'task {task} started ({choice}); it runs in the background and shows in this chat' },
      noTool: { label: 'Reply: the implementer lists built-in tools and none is on or picked', text: 'No built-in tool picked for this task: pass in setup the tools the goal needs (ids from setupStatus.builtInTools in list_agents)' },
      fromTask: { label: 'Reply: a task called it', text: 'Tasks do not start tasks: name the follow-up work in your result, and the chat starts it' },
    }, roles: CHATS, placeholders: { task: 'the new task id', choice: 'its agent, model and effort' } },
  'tool.reply_task': { group: 'Workspace tools and their replies', title: 'reply_task', description: 'Sends a change or correction to a running task of the chat.', textBecause: TOOL_WHY,
    text: 'Sends a change or correction to a running task of this chat; it gets the message when its current step ends. A finished task is not continued this way: start a new one with basedOn.',
    variants: { ok: { label: 'Reply: sent', text: 'sent to task {task}' }, finished: { label: 'Reply: the task is not running, waiting or paused', text: 'Task {task} is {status}; start a new task with basedOn: {task}' } },
    roles: CHATS, placeholders: { task: 'the task id', status: 'its status' } },
  'tool.task_status': { group: 'Workspace tools and their replies', title: 'task_status', description: "Lists the chat's tasks with their state and last reply; its result is that list as data.", textBecause: TOOL_WHY,
    text: 'Lists the tasks started in this chat: goal, status, agent, tokens used and the last reply.', roles: CHATS },
  'tool.rename_task': { group: 'Workspace tools and their replies', title: 'rename_task', description: 'Renames a task of the chat.', textBecause: TOOL_WHY,
    text: 'Changes the title of a task started in this chat, as the workspace lists it.',
    variants: { ok: { label: 'Reply: renamed', text: 'task {task} is now titled "{title}"' } }, roles: CHATS, placeholders: { task: 'the task id', title: 'the new title, up to 200 characters' } },
  'tool.list_agents': { group: 'Workspace tools and their replies', title: 'list_agents', description: 'The implementer set in Settings with its catalog and setup items, so the orchestrator can choose model, effort and setup for a task; its result is data.', textBecause: TOOL_WHY,
    text: 'The implementer set in Settings (agent, model, default effort, its models with their effort levels, its permission modes), its decidable setup items and setupStatus (alwaysOn ids, requiresBuiltInTool, builtInTools).',
    roles: CHATS },
  'tool.request_merge': { group: 'Workspace tools and their replies', title: 'request_merge', description: "Publishes the session's branch after the user approves one card; the replies say what happened and what to do next.", textBecause: TOOL_WHY,
    text: "Merges this session's branch into main: runs typecheck and tests in the worktree, then, after the user approves a card in the chat, pushes the branch, opens its pull request if there is none (then title, and optionally body, are needed), and squash-merges it once the required checks pass. Commit first; uncommitted work is refused. Blocks until the user answers.",
    params: { title: 'Pull request title, if the branch has none yet', body: 'Pull request description, if the branch has none yet' },
    variants: {
      ok: { label: 'Reply: pushed, auto-merge on', text: 'Pushed {branch}; auto-merge is on for #{number} ({url}): GitHub squash-merges it into main when the required checks pass. If a check fails, nothing is merged: fix it, commit, and call request_merge again.' },
      alreadyMerged: { label: "Reply: the branch's pull request already merged (before the card or after Allow)", text: 'Pull request #{number} of branch {branch} is already merged ({url}), and this branch contains its commits, so nothing more can be published from it. Do not switch this worktree to another branch to publish: request_merge publishes only this session\'s branch. Tell the user to continue the conversation in a new chat ("Continue in a new chat" in the workspace), on a new branch from origin/main or on an existing branch they pick.' },
      noTitle: { label: 'Reply: no open pull request and no title given', text: 'Branch {branch} has no open pull request. Call request_merge again with a title (and a body) for it.' },
      uncommitted: { label: 'Reply: the worktree has uncommitted changes', text: 'This worktree has uncommitted changes ({files}); nothing was checked, pushed or merged. Commit them, then call request_merge again.' },
      checksFailed: { label: 'Reply: typecheck or tests failed', text: '{check} failed in the worktree; nothing was pushed or merged. Fix it, commit, and call request_merge again. Output:\n{output}' },
      stopped: { label: 'Reply: the turn was stopped while the card waited', text: 'The user stopped the turn; nothing was pushed or merged.' },
      denied: { label: 'Reply: the user denied the card', text: 'The user did not approve the merge; nothing was pushed or merged. Ask the user what to change.' },
      stale: { label: 'Reply: the binding changed while the card waited', text: 'Nothing was pushed or merged: the binding changed while the card waited. {binding}' },
      mergedMeanwhile: { label: 'Reply: the pull request merged while the card waited', text: 'Nothing was pushed or merged. {merged}' },
      fetch: { label: 'Reply: fetching main failed', text: 'Fetching main failed; nothing was pushed or merged: {output}' },
      conflict: { label: 'Reply: main does not merge into the branch', text: 'Bringing {branch} up to date with main failed (a merge conflict, most likely); nothing was pushed or merged. Merge origin/main into the branch yourself, resolve the conflicts, run the checks again, commit, and call request_merge again. Git said: {output}' },
      push: { label: 'Reply: pushing failed', text: 'Pushing branch {branch} failed; nothing was merged: {output}' },
      create: { label: 'Reply: opening the pull request failed', text: 'Opening the pull request failed; nothing was merged: {output}' },
      unreadable: { label: 'Reply: the new pull request cannot be read', text: 'The pull request was opened but cannot be read; nothing was merged.' },
      autoMerge: { label: 'Reply: auto-merge could not be turned on', text: 'Turning on auto-merge for #{number} failed: {output}' },
    }, roles: ['Chat', 'Implementer'],
    placeholders: { branch: "the session's branch", files: 'the uncommitted files', check: 'typecheck or npm test', binding: 'the binding refusal (Refusals)', merged: 'the already-merged reply above', output: "git's, gh's or npm's output", number: 'the pull request number', url: 'its address' } },

  // --- Refusals that are not one tool's reply.
  'refusal.binding': { group: 'Refusals', title: 'Binding refusal', description: "Why the workspace will not run or publish from a session whose worktree and branch no longer match git, and how to go on; in request_merge's reply, or shown to the user instead of running the turn.", textBecause: 'Explains a refusal the agent has to pass on to the user, with the way on.',
    text: '{reason} {who} {id} of project {project} is bound to branch {branch} in {path}. {kept} {next}', variants: {
      kept: { label: 'Kept work', text: 'Its worktree keeps {files} and {commits} on no remote branch, untouched.' },
      unreadable: { label: 'Kept work, when git cannot read the worktree', text: 'Its worktree could not be read; nothing in it was touched.' },
      removed: { label: 'Reason: the project was removed', text: 'Project {project} is no longer in the workspace.' },
      notApp: { label: 'Reason: not the app project', text: 'Project {project} is not the app project, the only one whose sessions work in worktrees.' },
      foreign: { label: 'Reason: a foreign folder', text: 'The folder {path} is not a worktree the workspace keeps for project {project}.' },
      gone: { label: 'Reason: the worktree is gone', text: "This session's worktree is gone ({path}, branch {branch})." },
      notWorktree: { label: 'Reason: not a worktree of the repository', text: 'The folder {path} is not a worktree of the repository {repo}.' },
      otherBranch: { label: 'Reason: another branch or a detached HEAD', text: 'The worktree has {checkedOut} checked out (HEAD {head}), not the bound branch {branch}.{branchGone}' },
      branchGone: { label: 'Added when the bound branch no longer exists', text: ' Branch {branch} no longer exists.' },
      merged: { label: 'Reason: its pull request merged', text: 'Pull request #{number} ({url}) of branch {branch} is already merged, and the branch contains its commits: its work is published.' },
      nextChat: { label: 'Next, for a chat', text: 'The workspace runs no agent and publishes nothing for this chat until the binding matches; it switched, reset and deleted nothing. To keep working, continue this conversation in a new chat ("Continue in a new chat" below), on a new branch from freshly fetched origin/main or on an existing branch you pick.' },
      nextTask: { label: 'Next, for a task', text: 'The workspace runs no agent and publishes nothing for it until the binding matches; continue the work from its chat.' },
    }, roles: ['Chat', 'Implementer'],
    placeholders: { reason: 'one of the reasons below', who: 'Chat or Task', id: 'the session id', project: 'the project id', branch: 'the stored branch', path: 'the stored worktree folder', kept: 'one of the kept-work sentences below, or nothing when the folder is gone', files: 'the uncommitted files, for example "2 uncommitted files"', commits: 'the commits on no remote branch, for example "1 commit"', next: 'the next step below for a chat or a task', repo: "the project's repository folder", checkedOut: 'the branch or "a detached HEAD"', branchGone: 'the sentence below when the bound branch is gone, else nothing', head: 'the short commit id', number: 'the pull request number', url: 'its address' } },
  'refusal.guard': { group: 'Refusals', title: 'Write guard refusal', description: "Why the write guard refused an edit or command in the running app's checkout or the workspace storage, and what to do instead; for agents whose refusals carry text (others get the request declined), and the first paragraph is also the chat's notice.", textBecause: 'The reason for a refusal the guard enforces in code; how to get the work done another way is judgment.',
    text: `${GUARD_MARK}: writing {file} would change {folder}.`, variants: {
      command: { label: 'A command instead of a file', text: `${GUARD_MARK}: the command \`{command}\` would run in or name {folder}. If it only reads, add its program to the read list (\`READERS\` or \`GIT_READERS\` in app/src/worktrees.ts).` },
      instead: { label: 'After either, in the same refusal', text: "The running app's checkout and the workspace's storage must stay untouched. Work in {worktree}; to only read there, use the Read tool or a command that only reads (such as ls, cat, grep, git log or git diff, without writing output to a file)." },
      merge: { label: "A command that would merge a pull request, in an app-project worktree", text: `${GUARD_MARK}: \`{command}\` would merge without the user's approval.\n\nMerging goes through the workspace tool request_merge.` },
    }, roles: ['Chat', 'Implementer'], needs: 'refusalText',
    placeholders: { file: 'the file it would write', folder: 'the guarded folder', command: 'the command', worktree: 'the folder the session works in' } },
  'refusal.failed': { group: 'Refusals', title: 'A workspace tool failed', description: "Frames any other error a workspace tool hits (a value it does not accept, a project or task it does not know, a failing git call), so that the error's own message reaches the agent only as data.", textBecause: 'The agent needs to know the call failed and why, to correct it.',
    text: 'The workspace could not do this: {error}', roles: ALL, placeholders: { error: "the error's message, as the code wrote it" } },
} as const satisfies Record<string, Entry>;

export type InstructionId = keyof typeof REGISTRY;
type Values = Record<string, string | number>;

/** Text built from the registry: the only kind the places that hand text to an agent accept. */
export type AgentText = string & { readonly __agentText: true };
/** Text that is data (git output, a JSON result), handed to an agent as is. */
export type AgentData = string & { readonly __agentData: true };
export const asData = (text: string) => text as AgentData;
/** An error whose message is registry text, so a workspace tool can hand it to the agent as is. */
export class AgentError extends Error {
  constructor(message: AgentText) { super(message); }
}

const fill = (id: string, text: string, values: Values) => text.replace(/\{(\w+)\}/g, (_, k: string) => {
  if (!(k in values)) throw new Error(`${id}: no value for {${k}}`);
  return String(values[k]);
});

const form = (id: InstructionId, variant?: string) => {
  const e: Entry = REGISTRY[id];
  const v = variant === undefined ? e.text : e.variants?.[variant]?.text;
  if (v === undefined) throw new Error(`${id}: no variant ${variant}`);
  return v;
};

/** The text of a registry entry, or one of its variants, with its placeholders filled in. A missing value throws. */
export function agentText(id: InstructionId, values: Values = {}, variant?: string): AgentText {
  return fill(id, form(id, variant), values) as AgentText;
}

/** An entry's text followed by the named sections (variants), each filled in, joined by a blank line: a role note. */
export function composeText(id: InstructionId, values: Values, sections: string[]): AgentText {
  return [undefined, ...sections].map((v) => fill(id, form(id, v), values)).join('\n\n') as AgentText;
}

/** A workspace tool's parameter description. */
export function toolParam(tool: Extract<InstructionId, `tool.${string}`>, name: string): AgentText {
  const p = (REGISTRY[tool] as Entry).params?.[name];
  if (p === undefined) throw new Error(`${tool}: no parameter ${name}`);
  return p as AgentText;
}

/** Whether `text` is this entry's text (or variant) with any values filled in, for code that recognises its own message. */
export function isAgentText(id: InstructionId, text: string, variant?: string): boolean {
  const parts = form(id, variant).split(/\{\w+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${parts.join('.+')}$`, 's').test(text);
}
