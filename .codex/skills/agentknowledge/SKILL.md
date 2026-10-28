---
name: agentknowledge
description: Maintain agent-facing knowledge artifacts such as AGENTS.md through targeted updates driven by a required CHANGE_TRIGGER. Map affected business/domain areas to relevant code, auxiliary artifacts, and investigation starting points.
---

# Agent Knowledge

Maintain concise navigation knowledge that helps an agent identify
artifacts relevant to its task and starting points for investigation
or learning.

The consuming agent is responsible for inspecting current artifacts
and deriving up-to-date knowledge and reasoning.

## Required input: <CHANGE_TRIGGER>

Invocation:

$agentknowledge <CHANGE_TRIGGER>

<CHANGE_TRIGGER> describes the changes that created the need to update
agent knowledge. It must identify the affected business/domain areas
and provide enough detail or references to investigate the changes.

If the argument is missing or insufficient to establish scope, request
the missing details before editing. Do not assume a project-wide scope.

## Change-driven scope

Use <CHANGE_TRIGGER> to determine which existing artifacts and sections
need updating. Inspect relevant implementation and supporting artifacts
to establish the actual consequences of the described changes.

Make targeted additions, corrections, relocations, or removals within
the affected business/domain areas and their directly affected
technical navigation guidance.

Never regenerate agent knowledge in its entirety. Preserve unaffected
content and organization. Create a missing artifact only when needed
to navigate an area affected by the trigger.

Follow dependencies beyond the named locations only when necessary
to capture a direct consequence of the trigger. Leave unrelated gaps
and stale content unchanged; report them separately if useful.

## Content

- Map tasks or concerns to relevant code, configuration, tests,
  documentation, diagnostics, and other auxiliary artifacts.
- Provide verified paths, entry symbols, or useful search terms,
  with brief context explaining their relevance.
- Include relationships only when they help select the next
  artifact to inspect.
- Keep detailed documentation, implementation explanations,
  and stored investigative reasoning out of this navigation layer.
  Link to explanatory documentation where useful.

## Maintenance

Inspect existing guidance and relevant artifacts before editing.
Verify responsibilities against their contents rather than inferring
them solely from filenames or directory structure.

Update the closest appropriate agent-facing artifact. Keep broad
entry points at the project level and local guidance near its subject,
following existing conventions.

Within the trigger's scope, replace stale pointers, consolidate
duplication, and add missing starting points. Avoid exhaustive inventories.

Preserve operational instructions already present in AGENTS.md;
their purpose is distinct from navigation knowledge.

Use projectdocs when the requested work also requires maintaining
explanations, carrying forward the same <CHANGE_TRIGGER>.

## Verification

Verify referenced paths, symbols, and links. Check that each changed
entry helps an agent decide where to begin or continue investigation.

Verify that every edit is traceable to <CHANGE_TRIGGER>.
Report changed artifacts, their connection to the trigger,
and unresolved gaps.
