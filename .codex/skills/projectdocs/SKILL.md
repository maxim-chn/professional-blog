---
name: projectdocs
description: Maintain explanatory project artifacts such as README.md through targeted updates driven by a required CHANGE_TRIGGER. Cover affected business/domain and technological aspects, organizing substantial themes into dedicated, linked documentation.
---

# Project Documentation

Maintain succinct explanations of the project's purpose, business
and domain concepts, workflows, and technology.

Explain what relevant parts do, how they work, and why documented
choices matter, at the depth appropriate to the requested task.

## Required input: <CHANGE_TRIGGER>

Invocation:

$projectdocs <CHANGE_TRIGGER>

<CHANGE_TRIGGER> describes the changes that created the need to update
project documentation. It must identify the affected business/domain
areas and provide enough detail or references to investigate the changes.

If the argument is missing or insufficient to establish scope, request
the missing details before editing. Do not assume a project-wide scope.

## Change-driven scope

Use <CHANGE_TRIGGER> to determine which existing artifacts and sections
need updating. Inspect relevant implementation and supporting artifacts
to establish the actual consequences of the described changes.

Make targeted additions, corrections, relocations, or removals within
the affected business/domain areas and their directly affected
technical documentation.

Never regenerate project documentation in its entirety. Preserve
unaffected content and organization. Create a missing artifact only
when needed to document an area affected by the trigger.

Follow dependencies beyond the named locations only when necessary
to capture a direct consequence of the trigger. Leave unrelated gaps
and stale content unchanged; report them separately if useful.

## Content

Inspect existing documentation and relevant implementation,
configuration, tests, and domain or decision artifacts before writing.

Ground current-behavior descriptions in current evidence. Distinguish
implemented behavior from intentions and proposals. Do not invent
business rationale or silently resolve uncertain domain rules.

Connect domain concepts to supporting technical behavior where useful.
Define unfamiliar project terms and use examples when they materially
improve understanding.

## Organization

Keep higher-level documents focused on orientation and succinct
explanations.

When a theme affected by <CHANGE_TRIGGER> accumulates substantial
documentation, move its detail into a dedicated area of the codebase.
Related themes may be grouped where they form a coherent explanation.

Follow existing conventions, such as focused documents under docs/
or a component README beside its code.

Leave a short explanation and descriptive link in the higher-level
document. Preserve useful content, repair affected links and anchors,
and avoid competing copies of the same explanation.

Choose boundaries by subject and reader needs rather than an arbitrary
word limit. Avoid unnecessary fragmentation and unrelated reorganization.

## Maintenance and verification

Reconcile affected explanations with current evidence and correct
stale claims within the trigger's scope. Preserve useful context and
established project conventions.

Keep agent investigation maps in agent-facing artifacts. Use
agentknowledge when those maps also need maintenance, carrying
forward the same <CHANGE_TRIGGER>.

Check factual consistency, referenced paths, links, and affected
anchors. Verify command examples against project configuration.

Verify that every edit is traceable to <CHANGE_TRIGGER>.
Report documents changed, content relocated, their connection
to the trigger, and unresolved gaps.
