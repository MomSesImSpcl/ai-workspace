# Resizable chat, Claude-style colors, cache writes split from work

The chat column can be resized by dragging its right edge (or arrow keys on the handle), and the width is remembered. The pink theme is replaced with Claude-style warm grays and a clay accent. Token "work" no longer includes prompt-cache writes (the agent's fixed prompt written to the cache on a first call), which made tiny tasks look expensive; they now count as prompt cache.

[Details](DETAILS.md).
