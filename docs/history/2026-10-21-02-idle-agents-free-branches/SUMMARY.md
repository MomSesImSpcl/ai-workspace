# Idle agents no longer keep merged branches

A chat's agent stays alive, idle, for 30 minutes after each turn; Settings counted that as running, so a merged branch stayed and Remove was disabled ("Stop its agent first"). Now only an agent working on a turn blocks removal; Remove and the start-up cleanup end idle agents first. [Details](DETAILS.md).
