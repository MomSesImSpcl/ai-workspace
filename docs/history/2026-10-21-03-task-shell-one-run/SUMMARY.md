# Codex tasks get the shell at start; a setup continue stays in its run

A Codex task started without its shell, asked for it with `request_setup` and was restarted, which showed as a reused task. Codex's shell tool now defaults to always on for implementation, and the continue after `request_setup` joins the run that asked. [Details](DETAILS.md).
