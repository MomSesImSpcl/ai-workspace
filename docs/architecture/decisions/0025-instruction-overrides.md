# ADR 0025: Instruction defaults and user overrides in every build

## Status

accepted 2026-11-23 (user); not implemented. Amends [ADR 0022](0022-agent-instructions-catalog.md) (the tab is no longer development-only; copies are replaced by the registry of [agent-interface-007](../../features/agent-interface/SPEC.md#requirements)).

## Context

Every agent instruction is now defined once, in the instruction registry. The user wants the Agent instructions tab to become the place where all default instructions live and where any of them can be changed, with the original always kept as a fallback, in released builds as well as development.

## Decision

- **Three modes per text:** Default (the registry text), Override (the user's text replaces it entirely) and Append (the user's text follows the default). Every text form of an entry (the main text, each variant, each tool parameter description) has its own mode.
- **Override is unrestricted:** it may say anything, including the opposite of the default; making it work is the user's responsibility. Behavior the workspace enforces in code is not text and is not changed by an override.
- **Placeholders:** an override or append may use only the entry's placeholders, since others cannot be filled; leaving placeholders out is allowed.
- **Fallback:** the registry text is never changed by an override; switching back to Default restores it, and app updates keep updating it.
- **Every build:** the tab ships in released builds.
- **One place for user instructions:** the Instructions fields of Settings → Agents become one "Your instructions" entry per role in this tab (empty default, Append).
- Overrides go to every agent, like defaults ([ADR 0023](0023-one-agent-interface.md)).

## Rejected alternatives

- Overrides that must keep the default's meaning or placeholders: the user wants full control; Append covers additions.
- Editing the registry file itself: lost on update and impossible in a released build.

## Consequences

- Turning rules into code ([agent-interface-008](../../features/agent-interface/SPEC.md#requirements)) comes before editing, so users do not override texts that are about to become code.
