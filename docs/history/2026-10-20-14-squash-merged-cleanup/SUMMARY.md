# Branch cleanup takes squash-merged branches (#24)

The automatic cleanup now removes squash-merged branches and archives their chats: a branch counts as merged when a test merge into `main` would change nothing. It runs only at app start; the daily run is gone (user's choice). npm no longer triggers Node's `DEP0190` warning on Windows. [Details](DETAILS.md).
