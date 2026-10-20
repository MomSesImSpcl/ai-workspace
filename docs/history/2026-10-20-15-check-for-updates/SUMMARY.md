# Check for updates instead of background checks

The app no longer checks GitHub by itself. A "Check for updates" button in the toolbar fetches `main` when clicked and turns into "Update and restart", waits for a pull request with auto-merge to merge, or says why the checkout cannot update. Non-default states pulse. [Details](DETAILS.md).
