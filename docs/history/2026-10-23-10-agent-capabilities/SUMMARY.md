# Capabilities in the shared agent interface

`SessionAgent`, the interface both agents already implement, now reports what an agent provides natively (`Capabilities`: approval tool, refusal text). The Agent instructions tab derives its "Not yet for" gaps from these instead of hand-written agent lists, and names the missing capability. A conformance test checks every agent. Typecheck clean, tests 116/116, browser-checked. The earlier work on this branch is in commit `3d0e7ca`.

[Details](DETAILS.md).
