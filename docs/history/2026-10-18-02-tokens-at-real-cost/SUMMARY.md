# Tokens counted at real cost

Task budgets and every token display now count prompt-cache reads at 10 % and cache writes at 125 % of an input token, so resending the agent's fixed prompt (about 90k tokens per call with the user's setup) no longer looks like 90k spent. See [details](DETAILS.md).
