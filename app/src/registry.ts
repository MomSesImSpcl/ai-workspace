// The one registry of every text the workspace sends an agent (agent-interface-007, ADR 0023): role notes, text in
// the messages it receives, workspace tool and parameter descriptions, and the tool replies and refusals that tell it
// what to do next. Code sends these only through `agentText` and `toolParam`, so no instruction exists outside this
// file, and the Agent instructions tab (app/src/instructions.ts) lists exactly what is here. Plain validation errors
// that only name a bad value are not instructions and stay in their code. This module imports nothing from the app,
// so every module can use it.

/** The roles an entry can go to: plain chats, orchestrator chats and tasks (the Implementer role, whatever role a task started with). */
export const ROLES = ['Chat', 'Orchestrator', 'Implementer'] as const;
export type Role = (typeof ROLES)[number];
/** Purpose groups, in list order. */
export const GROUPS = ['Role notes', 'Messages and continuation', 'Workspace tools', 'Tool replies and refusals'] as const;

/** Capabilities an entry can need (`Capabilities` in app/src/sessions.ts); only agents that report it get the entry. */
type Need = 'approvalTool' | 'refusalText';

export interface Entry {
  group: (typeof GROUPS)[number];
  title: string;
  description: string; // what it is for and when it is sent, shown under the title
  textBecause: string; // why this is instruction text and not code (agent-interface-008)
  toCode?: string; // what of it could become a tool schema, default, check or fixed output instead
  text: string; // `{name}` marks a value filled in when it is sent, explained in `placeholders`
  variants?: Record<string, { label: string; text: string }>; // other forms of the same message and when each is used
  params?: Record<string, string>; // a workspace tool's parameter descriptions, as the agent sees them
  roles: readonly Role[];
  placeholders?: Record<string, string>;
  needs?: Need;
}

const ALL = ROLES;
const CHATS = ['Chat', 'Orchestrator'] as const;
const WORKERS = ['Chat', 'Implementer'] as const; // plain chats and tasks

/** Opens every write guard refusal; the chat recognises a guard notice by it. */
export const GUARD_MARK = 'Blocked by the write guard (selfdev-002)';

export const REGISTRY = {
  // --- Role notes: the system or developer prompt each role starts with (built by agentInstructions, app/src/prompt.ts).
  'session-note': { group: 'Role notes', title: 'Effort level note', description: "Opens every chat's and task's instructions with its effort level, so rules that depend on the level can read it.", textBecause: "The agent's own rules (for example an effort check) read the level from its instructions; only text reaches them.",
    text: "AI Workspace {kind}: effort level {effort}. This note is always current: when the user changes the level in the workspace's composer, the agent is restarted with the new level and an updated note.",
    roles: ALL,
    placeholders: { kind: '"task" for tasks, "session" for chats', effort: 'the session\'s effort level, or "not set by the workspace (the agent\'s own default)"' } },
  'chat.start-task': { group: 'Role notes', title: 'Start tasks from a chat', description: "Tells a plain chat it can hand self-contained work to a background task.", textBecause: "Whether work is self-contained enough for a task is judgment; it is the only line that tells a plain chat the tool is for background work.",
    text: 'To run self-contained work in the background as a task, use the workspace start_task tool.', roles: ['Chat'] },
  'task.note': { group: 'Role notes', title: 'Background task note', description: "Tells a task that nobody answers until it ends, so it does the work instead of asking about effort.", textBecause: "It counters the user's own rules (an effort check that waits for an answer), which only text can reach.",
    text: 'This is a background task: nobody answers until it ends, and its effort level is set by the workspace. Do not stop to suggest an effort level or ask to confirm one; do the work.',
    roles: ['Implementer'] },
  'read-repo.note': { group: 'Role notes', title: 'Use read_repo', description: "Points plain chats and tasks to read_repo for commits, pull requests, checks and issues.", textBecause: "The agent picks its own tools: with read_repo only in the tool list, an agent did not try it (#31), so the hint stays.",
    text: 'For commit history, pull requests, checks and issues of a workspace project, use the workspace tool read_repo.',
    roles: WORKERS },
  'orchestrator.note': { group: 'Role notes', title: 'Orchestrator rules', description: "The orchestrator's routing rule: reply to a running task, start a new task or answer a question itself, and how it picks agent, model, effort and setup.", textBecause: "Routing a message, sizing a task\'s goal, choosing effort, when a cap or an earlier task applies and when to ask back are judgment; the rest is enforced by start_task.",
    text: "You are the workspace orchestrator. You never do the work yourself; you cannot edit files, and any command you run may only read. For every message, apply this rule: (1) It changes or corrects the work of a task of this chat that is still running (task_status): send it to that task with reply_task. (2) It asks for anything to be done (create, change, fix, run, set up, write or research something), including more work like a finished task's, or a correction of a finished task: start a new task with start_task, and tell the user it is a new task. When an earlier task of this chat is related, pass its id as basedOn, so the new task starts with that task's goal and result. Size the goal to the task: one or two sentences for a simple, clear request; add acceptance criteria only when the outcome is not obvious; never ask the task to read rule files or to verify more than the request needs. Pass tokenBudget only when the user asked for a cap or accepted your suggestion of one, and in setup only the items the goal needs. (3) It only asks a question (about the code, a task's state or why it failed): answer it yourself, reading files, task_status, search_history for earlier chats and tasks, and read_repo for commit history, pull requests, checks and issues of any workspace project. Ask back only when you cannot name both what to change and the expected outcome, or when a message could either change a running task or be new work. Choosing each task's effort is your job: do not stop to suggest or confirm an effort level.",
    roles: ['Orchestrator'] },
  'own-instructions': { group: 'Role notes', title: "Wrapper for the user's own instructions", description: "Adds the role's own instructions from Settings and says they outrank the notes before them.", textBecause: "Text the user writes for the agent.",
    text: "The user's own instructions for you, which take precedence over the notes above where they conflict: {instructions}", roles: ALL,
    placeholders: { instructions: "the text of the role's Instructions field (Settings → Agents)" } },
  'merge.note': { group: 'Role notes', title: 'Worktree and merge rules', description: "Tells chats and tasks in the app's own worktrees to stay in their worktree, run the checks and merge only through request_merge.", textBecause: "Where to keep the shell and how to write files is working practice; the write guard can only refuse afterwards.",
    text: "This session works in its own git worktree and branch of the workspace's own repository. Writes outside this worktree are blocked: keep your shell in this folder (elsewhere only read, e.g. ls, cat, grep, git log), write file contents with your edit tools rather than shell heredocs or scripts, and keep merge commands out of shell command text, even as quoted data. To merge into main, commit your work and call the workspace tool request_merge (with a title and body if the branch has no pull request yet); it runs typecheck and tests itself and merges after the user approves. Keep this worktree on its branch: request_merge publishes only this session's branch.",
    roles: WORKERS },
  'workspace-rules': { group: 'Role notes', title: "The workspace folder's AGENTS.md", description: "Adds the workspace folder's own AGENTS.md, which agents do not load above a project's git root.", textBecause: "The user's own rules, delivered as text.",
    text: "The workspace's own rules (its AGENTS.md), which apply to every project in it:\n{rules}", roles: ['Orchestrator', 'Implementer'],
    placeholders: { rules: "the workspace folder's AGENTS.md, as it is when the agent starts" } },
  'minimal-prompt': { group: 'Role notes', title: "Short system prompt instead of the agent's own", description: "A short system prompt that replaces the agent's own when that setup item is off, about 3k to 4k tokens less per call.", textBecause: "The agent needs its folder, system and date; these are facts only text delivers.",
    text: 'You are a coding agent working in {root} on {platform}. Today is {date}.', roles: ['Orchestrator', 'Implementer'],
    placeholders: { root: 'the folder the agent runs in', platform: 'the operating system (win32, darwin, linux)', date: "today's date, YYYY-MM-DD" } },

  // --- Messages and continuation: text the workspace puts into the message the agent receives.
  'history.prefix': { group: 'Messages and continuation', title: 'Earlier conversation', description: "Gives an agent that cannot resume its own conversation the conversation so far.", textBecause: "Conversation content the agent cannot see otherwise, not a rule.",
    text: 'Earlier in this conversation:\n\n{history}\n\nUser: {message}', roles: ALL,
    placeholders: { history: 'the earlier turns, written as the transcript entry shows', message: 'the new message' } },
  'history.transcript': { group: 'Messages and continuation', title: 'Transcript of a turn', description: "How each earlier turn is written inside the earlier conversation.", textBecause: "Conversation content the agent cannot see otherwise, not a rule.",
    text: 'User: {message}', variants: { reply: { label: 'The reply, when the turn has one', text: 'You: {reply}' }, marker: { label: 'How it ended, when it did not finish', text: '[{marker}]' } },
    roles: ALL,
    placeholders: { message: "the user's message of that turn", reply: "the agent's reply", marker: 'the unfinished-turn marker' } },
  'turn.marker': { group: 'Messages and continuation', title: 'Unfinished-turn marker', description: "Says where an unfinished turn stopped, so the user and the agent see the same last step.", textBecause: "A fact about the last turn that the agent cannot see otherwise.",
    text: '{outcome} after step {n}: {step}', variants: { first: { label: 'No step finished', text: '{outcome} before the first step' }, reason: { label: 'The workspace stopped it (a token budget, a possible repeat, paused)', text: '{marker} ({reason})' } },
    roles: ALL,
    placeholders: { outcome: 'Interrupted, Stopped or Failed', n: 'the number of finished steps', step: 'the last finished step, as the activity list shows it', marker: 'the marker above', reason: 'why the workspace stopped it' } },
  'turn.unfinished': { group: 'Messages and continuation', title: 'Check before repeating', description: "Before the next message, says the last turn did not finish and asks the agent to check the project before repeating work.", textBecause: "What to check before repeating is judgment; repeated tool calls are also caught in code (runtime-004).",
    text: '[{marker}. Check the current project state before repeating anything.]', roles: ALL,
    placeholders: { marker: 'the unfinished-turn marker of the previous turn' } },
  'turn.relay': { group: 'Messages and continuation', title: 'What the user wrote to a task', description: "Tells a chat's agent what the user wrote directly to one of its tasks since its last reply.", textBecause: "Conversation content the agent cannot see otherwise, not a rule.",
    text: '[Since your last reply the user wrote directly to task {task}: "{text}"]', roles: CHATS,
    placeholders: { task: 'the task id', text: 'what the user wrote' } },
  'task.resume': { group: 'Messages and continuation', title: 'Resume', description: "The message that continues a paused, interrupted or finished task.", textBecause: "A turn needs a message; it names what changed.",
    text: 'Continue the task.', roles: ['Implementer'] },
  'task.setup-continue': { group: 'Messages and continuation', title: 'Continue after request_setup', description: "Continues a task in a new process with the setup items it asked for.", textBecause: "A turn needs a message; it names what changed.",
    text: 'The workspace enabled {ids}. Continue the task.', roles: ['Implementer'],
    placeholders: { ids: 'the setup item ids it asked for' } },
  'task.based-on': { group: 'Messages and continuation', title: 'Context from an earlier task', description: "Gives a new task the goal and last reply of the earlier task it is based on.", textBecause: "Conversation content the agent cannot see otherwise, not a rule.",
    text: 'Context from an earlier related task ({task}, {status}).\nIts goal: {goal}\nIts last reply: {reply}', roles: ['Implementer'],
    placeholders: { task: 'the earlier task id', status: 'its status (completed, failed, …)', goal: 'its first message', reply: 'its last reply, or "(no reply yet)"' } },

  // --- Workspace tools: descriptions the agent reads in its tool list (app/src/approval-server.ts).
  'tool.approve': { group: 'Workspace tools', title: 'approve', description: "The permission tool an agent calls for every ask; it shows an approval card and waits for the user.", textBecause: "A tool description is how the agent learns what a workspace tool does and when to call it.",
    text: 'Asks the user in the workspace chat whether a tool call may run', roles: ALL, needs: 'approvalTool',
    },
  'tool.read_repo': { group: 'Workspace tools', title: 'read_repo', description: "Reads a project's commits, branches, status, pull requests, checks and issues without changing anything.", textBecause: "A tool description is how the agent learns what a workspace tool does and when to call it.",
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
    }, roles: ALL },
  'tool.search_history': { group: 'Workspace tools', title: 'search_history', description: "Lets the orchestrator find earlier chats and tasks by their text, so it answers questions about past work itself.", textBecause: "A tool description is how the agent learns what a workspace tool does and when to call it.",
    text: "Searches the workspace's chat and task histories for a text and returns the matching messages with their chat or task, turn and an excerpt, newest first.",
    params: { query: 'Text to find, any case', project: "A workspace project id; default: this chat's project", all: 'Search every project and the global chats' }, roles: ['Orchestrator'] },
  'tool.request_setup': { group: 'Workspace tools', title: 'request_setup', description: "Lets a task ask for setup items it is missing and continue with them in a new process.", textBecause: "A tool description is how the agent learns what a workspace tool does and when to call it.",
    text: 'Asks the workspace to enable built-in tools or setup items this task is missing, then continues the task with them in a new process; the current turn ends when the call returns. Ids: {ids}',
    params: { reason: 'One line: why the task needs them' }, roles: ['Implementer'], placeholders: { ids: "every setup item id listed for the task's agent" } },
  'tool.start_task': { group: 'Workspace tools', title: 'start_task', description: "Starts a background task from a chat; the orchestrator uses it for all work.", textBecause: "A tool description is how the agent learns what a workspace tool does and when to call it.",
    text: "Starts a background task in this project on the implementer set in Settings (list_agents) and returns at once. The task runs uncapped unless tokenBudget is given or the chat has a cap. Its approval cards, replies and result appear in this chat; the user answers them there.",
    params: {
      title: 'A short title of what the task does, a few words',
      goal: 'Self-contained instructions for the task',
      model: "One of the implementer's models (list_agents); omit for the one set in Settings",
      effort: "One of the model's effort levels (list_agents)",
      reason: 'One line: why this model, effort and setup items',
      tokenBudget: 'Token cap at real cost; only when the user asked for one',
      basedOn: 'Id of an earlier related task; the new task starts with its goal and result',
      permissionMode: "One of the agent's own permission modes; omit for the agent's settings",
      setup: "Ids from the selected agent's list_agents setup list that the task needs; setupStatus shows always-on items and whether a built-in tool must be selected. Never use another agent's ids",
    }, roles: CHATS },
  'tool.reply_task': { group: 'Workspace tools', title: 'reply_task', description: "Sends a change or correction to a running task of the chat.", textBecause: "A tool description is how the agent learns what a workspace tool does and when to call it.",
    text: 'Sends a change or correction to a running task of this chat; it gets the message when its current step ends. A finished task is not continued this way: start a new one with basedOn.', roles: CHATS },
  'tool.task_status': { group: 'Workspace tools', title: 'task_status', description: "Lists the chat's tasks with their state and last reply.", textBecause: "A tool description is how the agent learns what a workspace tool does and when to call it.",
    text: 'Lists the tasks started in this chat: goal, status, agent, tokens used and the last reply.', roles: CHATS },
  'tool.rename_task': { group: 'Workspace tools', title: 'rename_task', description: "Renames a task of the chat.", textBecause: "A tool description is how the agent learns what a workspace tool does and when to call it.",
    text: 'Changes the title of a task started in this chat, as the workspace lists it.', roles: CHATS },
  'tool.list_agents': { group: 'Workspace tools', title: 'list_agents', description: "The implementer set in Settings with its catalog and setup items, so the orchestrator can choose model, effort and setup for a task.", textBecause: "A tool description is how the agent learns what a workspace tool does and when to call it.",
    text: "The implementer set in Settings (agent, model, default effort, its models with their effort levels, its permission modes), its decidable setup items and setupStatus (alwaysOn ids, requiresBuiltInTool, builtInTools).",
    roles: CHATS },
  'tool.request_merge': { group: 'Workspace tools', title: 'request_merge', description: "Publishes the session's branch after the user approves one card.", textBecause: "A tool description is how the agent learns what a workspace tool does and when to call it.",
    text: "Merges this session's branch into main: runs typecheck and tests in the worktree, then, after the user approves a card in the chat, pushes the branch, opens its pull request if there is none (then title, and optionally body, are needed), and squash-merges it once the required checks pass. Commit first; uncommitted work is refused. Blocks until the user answers.",
    params: {
      title: 'Pull request title, if the branch has none yet',
      body: 'Pull request description, if the branch has none yet',
    }, roles: WORKERS },

  // --- Tool replies and refusals that tell the agent what to do next.
  'reply.approve': { group: 'Tool replies and refusals', title: 'Approval answered', description: "What the agent is told when the user denies an approval card or stops the turn.", textBecause: "A tool result: the agent needs the outcome to go on, and for a refusal what to change.",
    text: 'The user denied this in the workspace.', variants: { stopped: { label: 'The turn was stopped while the card waited', text: 'The user stopped the turn.' } },
    roles: ALL, needs: 'approvalTool' },
  'reply.start_task': { group: 'Tool replies and refusals', title: 'start_task replies', description: "Confirms a started task, or says what is missing.", textBecause: "A tool result: the agent needs the outcome to go on, and for a refusal what to change.",
    text: 'task {task} started ({choice}); it runs in the background and shows in this chat', variants: {
      noTool: { label: 'Refused: the chosen agent lists built-in tools and none is on or picked', text: 'No built-in tool picked for this task: pass in setup the tools the goal needs (ids from setupStatus.builtInTools in list_agents)' },
      fromTask: { label: 'Refused: a task called it', text: 'Tasks do not start tasks: name the follow-up work in your result, and the chat starts it' },
    }, roles: CHATS, placeholders: { task: 'the new task id', choice: 'its agent, model and effort' } },
  'reply.reply_task': { group: 'Tool replies and refusals', title: 'reply_task replies', description: "Confirms a sent reply, or points to basedOn for a finished task.", textBecause: "A tool result: the agent needs the outcome to go on, and for a refusal what to change.",
    text: 'sent to task {task}', variants: { finished: { label: 'Refused: the task is not running, waiting or paused', text: 'Task {task} is {status}; start a new task with basedOn: {task}' } },
    roles: CHATS, placeholders: { task: 'the task id', status: 'its status' } },
  'reply.rename_task': { group: 'Tool replies and refusals', title: 'rename_task reply', description: "Confirms a new task title.", textBecause: "A tool result: the agent needs the outcome to go on, and for a refusal what to change.",
    text: 'task {task} is now titled "{title}"', roles: CHATS, placeholders: { task: 'the task id', title: 'the new title, up to 200 characters' } },
  'reply.request_setup': { group: 'Tool replies and refusals', title: 'request_setup replies', description: "Confirms the added items before the workspace continues the task with them, or says why they cannot be added.", textBecause: "A tool result: the agent needs the outcome to go on, and for a refusal what to change.",
    text: 'Enabled {ids}. The workspace ends this turn and continues the task with them.', variants: {
      unknown: { label: 'Refused: ids the agent does not list', text: 'Unknown setup items for {agent}: {ids}' },
      off: { label: 'Refused: items the user switched off for the role', text: 'The user switched these off for this role: {ids}' },
    }, roles: ['Implementer'], placeholders: { ids: 'the setup item ids', agent: "the task's agent" } },
  'reply.read_repo': { group: 'Tool replies and refusals', title: 'read_repo in a global session', description: "Asks a session outside any project to name one.", textBecause: "A tool result: the agent needs the outcome to go on, and for a refusal what to change.",
    text: 'This is a global session: name a project. Projects: {projects}', roles: ALL,
    placeholders: { projects: 'the ids of the workspace projects' } },
  'reply.request_merge': { group: 'Tool replies and refusals', title: 'request_merge replies', description: "What happened with a merge request and what to do next.", textBecause: "A tool result: the agent needs the outcome to go on, and for a refusal what to change.",
    text: 'Pushed {branch}; auto-merge is on for #{number} ({url}): GitHub squash-merges it into main when the required checks pass. If a check fails, nothing is merged: fix it, commit, and call request_merge again.', variants: {
      noTitle: { label: 'No open pull request and no title given', text: 'Branch {branch} has no open pull request. Call request_merge again with a title (and a body) for it.' },
      uncommitted: { label: 'The worktree has uncommitted changes', text: 'This worktree has uncommitted changes ({files}); nothing was checked, pushed or merged. Commit them, then call request_merge again.' },
      checksFailed: { label: 'Typecheck or tests failed', text: '{check} failed in the worktree; nothing was pushed or merged. Fix it, commit, and call request_merge again. Output:\n{output}' },
      stopped: { label: 'The turn was stopped while the card waited', text: 'The user stopped the turn; nothing was pushed or merged.' },
      denied: { label: 'The user denied the card', text: 'The user did not approve the merge; nothing was pushed or merged. Ask the user what to change.' },
      stale: { label: 'The binding changed while the card waited', text: 'Nothing was pushed or merged: the binding changed while the card waited. {binding}' },
      mergedMeanwhile: { label: 'The pull request merged while the card waited', text: 'Nothing was pushed or merged. {merged}' },
      fetch: { label: 'Fetching main failed', text: 'Fetching main failed; nothing was pushed or merged: {output}' },
      conflict: { label: 'Main does not merge into the branch', text: 'Bringing {branch} up to date with main failed (a merge conflict, most likely); nothing was pushed or merged. Merge origin/main into the branch yourself, resolve the conflicts, run the checks again, commit, and call request_merge again. Git said: {output}' },
      push: { label: 'Pushing failed', text: 'Pushing branch {branch} failed; nothing was merged: {output}' },
      create: { label: 'Opening the pull request failed', text: 'Opening the pull request failed; nothing was merged: {output}' },
      unreadable: { label: 'The new pull request cannot be read', text: 'The pull request was opened but cannot be read; nothing was merged.' },
      autoMerge: { label: 'Auto-merge could not be turned on', text: 'Turning on auto-merge for #{number} failed: {output}' },
    }, roles: WORKERS,
    placeholders: { branch: "the session's branch", files: 'the uncommitted files', check: 'typecheck or npm test', binding: 'the binding refusal', merged: 'the branch-already-merged reply', output: "git's or gh's output", number: 'the pull request number', url: 'its address' } },
  'reply.merged-pr': { group: 'Tool replies and refusals', title: 'Branch already merged', description: "Stops publishing from a branch whose pull request already merged and points to continuing in a new chat.", textBecause: "Explains a refusal the agent has to pass on to the user, with the way on.",
    text: 'Pull request #{number} of branch {branch} is already merged ({url}), and this branch contains its commits, so nothing more can be published from it. Do not switch this worktree to another branch to publish: request_merge publishes only this session\'s branch. Tell the user to continue the conversation in a new chat ("Continue in a new chat" in the workspace), on a new branch from origin/main or on an existing branch they pick.',
    roles: WORKERS,
    placeholders: { number: 'the pull request number', branch: "the session's branch", url: 'its address' } },
  'reply.binding': { group: 'Tool replies and refusals', title: 'Binding refusal', description: "Why the workspace will not publish from a session whose worktree and branch no longer match git, and how to go on.", textBecause: "Explains a refusal the agent has to pass on to the user, with the way on.",
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
    }, roles: WORKERS,
    placeholders: { reason: 'one of the reasons below', who: 'Chat or Task', id: 'the session id', project: 'the project id', branch: 'the stored branch', path: 'the stored worktree folder', kept: 'one of the kept-work sentences below, or nothing when the folder is gone', files: 'the uncommitted files, for example "2 uncommitted files"', commits: 'the commits on no remote branch, for example "1 commit"', next: 'the next step below for a chat or a task', repo: "the project's repository folder", checkedOut: 'the branch or "a detached HEAD"', branchGone: 'the sentence below when the bound branch is gone, else nothing', head: 'the short commit id', number: 'the pull request number', url: 'its address' } },
  'guard.notice': { group: 'Tool replies and refusals', title: 'Write guard refusal', description: "Why a write into the running app's checkout or the workspace storage was refused; also the chat's notice.", textBecause: "The reason for a refusal the guard already enforces in code.",
    text: `${GUARD_MARK}: writing {file} would change {folder}.`, variants: { command: { label: 'A command', text: `${GUARD_MARK}: the command \`{command}\` would run in or name {folder}. If it only reads, add its program to the read list (\`READERS\` or \`GIT_READERS\` in app/src/worktrees.ts).` } },
    roles: WORKERS, needs: 'refusalText',
    placeholders: { file: 'the file it would write', folder: 'the guarded folder', command: 'the command' } },
  'guard.instead': { group: 'Tool replies and refusals', title: 'Write guard: what to do instead', description: "Tells the agent where to work and how to only read after a refused write.", textBecause: "How to get the work done another way is judgment.",
    text: "The running app's checkout and the workspace's storage must stay untouched. Work in {worktree}; to only read there, use the Read tool or a command that only reads (such as ls, cat, grep, git log or git diff, without writing output to a file).",
    roles: WORKERS, needs: 'refusalText', placeholders: { worktree: 'the folder the session works in' } },
  'guard.merge': { group: 'Tool replies and refusals', title: 'Merge command refused', description: "Sends a merge attempt in a command back to request_merge.", textBecause: "The reason for a refusal the guard already enforces in code, with the way on.",
    text: `${GUARD_MARK}: \`{command}\` would merge without the user's approval.\n\nMerging goes through the workspace tool request_merge.`,
    roles: WORKERS, needs: 'refusalText', placeholders: { command: 'the command' } },
} as const satisfies Record<string, Entry>;

export type InstructionId = keyof typeof REGISTRY;
type Values = Record<string, string | number>;

const fill = (id: string, text: string, values: Values) => text.replace(/\{(\w+)\}/g, (_, k: string) => {
  if (!(k in values)) throw new Error(`${id}: no value for {${k}}`);
  return String(values[k]);
});

/** The text of a registry entry, or one of its variants, with its placeholders filled in. A missing value throws. */
export function agentText(id: InstructionId, values: Values = {}, variant?: string): string {
  const e: Entry = REGISTRY[id];
  const v = variant === undefined ? e.text : e.variants?.[variant]?.text;
  if (v === undefined) throw new Error(`${id}: no variant ${variant}`);
  return fill(id, v, values);
}

/** A workspace tool's parameter description. */
export function toolParam(tool: Extract<InstructionId, `tool.${string}`>, name: string): string {
  const p = (REGISTRY[tool] as Entry).params?.[name];
  if (p === undefined) throw new Error(`${tool}: no parameter ${name}`);
  return p;
}

/** Whether `text` is this entry's text with any values filled in, for code that recognises its own message. */
export function isAgentText(id: InstructionId, text: string): boolean {
  const parts = REGISTRY[id].text.split(/\{\w+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${parts.join('.+')}$`, 's').test(text);
}
