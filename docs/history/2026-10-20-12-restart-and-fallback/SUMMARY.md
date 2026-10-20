# Restart onto new code and fall back (selfdev-005/006)

"Update and restart" brings the app's checkout up to date with `main` and restarts. A restart hands over only after the new instance passes a basic startup check; on a failure the app shows why and offers the last working version, a copy of the last `main` commit that passed, kept in storage. Built and tested with real Electron on Linux and on Windows (in a throwaway clone, including the 90 s timeout); two findings from the Windows test fixed. [Details](DETAILS.md).
