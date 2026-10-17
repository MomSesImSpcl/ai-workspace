# Details: Markdown, shell and batch in the code index

- Source mapping: langtext-004 became code-index-010 (with the parse-failure part of langtext-003); langtext-001–003 were already covered by code-index-001, 006, 007 and 009 and are referenced, not repeated. md-001–004 became code-index-011–014; shell-001 and 004 became 015; shell-002 became 016; shell-003 and batch-002 became 017; batch-001 and 003 became 018; batch-004 became 019.
- Priority: the user then added Markdown (code-index-011–014) to the first group with TypeScript/JavaScript and HTML/CSS, because the project relies heavily on Markdown docs, and then shell and batch, so the priority covers every source language in the repository (JSON and YAML config are not language-analyzed).
- Candidates (unified/remark, markdownlint, tree-sitter-bash, ShellCheck, shfmt, tree-sitter-batch) moved to the technology candidates table, as the working agreement requires.
- Checks: links in the new history entry and candidates row checked. No application code changed.
