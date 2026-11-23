# Short system prompt: folder and date only

Reviewing the registry with the user: the short prompt that replaces an agent's own system prompt (`minimal-prompt`) now says only `Project folder: {root}. Today is {date}.` The operating system was dropped because the path shows it; the date stays because the model cannot know it and the orchestrator has no shell to look it up.
