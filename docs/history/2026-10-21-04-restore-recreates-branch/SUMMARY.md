# Unarchiving a chat of a removed branch makes the branch again

After a merge, the start-up cleanup removes the branch and archives its chats, so the chat that asked for the merge could not continue (M1 exit criterion 5). Unarchiving it now makes its branch again under the same name from `main` at its next message. [Details](DETAILS.md).
