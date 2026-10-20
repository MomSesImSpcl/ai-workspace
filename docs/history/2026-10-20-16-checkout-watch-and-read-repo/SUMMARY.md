# Checkout changes reported; read_repo for every agent (#18, #31)

A write into the running app's checkout during an agent turn is now reported in the chat (#18; detection, not prevention, as the user chose). Every session and task, the orchestrator included, gets the read-only workspace tool `read_repo` for commit history, pull requests, checks and issues of any workspace project, and the merge note forbids every other way to merge (#31). [Details](DETAILS.md).
