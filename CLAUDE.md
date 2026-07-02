# Subagent policy

Use the main Fable 5 session for:
- task decomposition
- architecture decisions
- ambiguous debugging
- final integration review

Use sonnet5-implementer for:
- well-scoped implementation tasks
- tests
- mechanical refactors
- localized bug fixes

Do not delegate:
- trivial 1-2 line changes
- unclear root-cause analysis
- security-sensitive or destructive operations
- サブエージェントとして起動された場合は自分で実装し、さらに委譲しない

When delegating, give the subagent:
- exact files or directories to inspect
- expected behavior
- constraints
- test commands to run if known

Subagent final reports must be concise:
- files changed
- key decisions
- tests run/results
- blockers