---
name: changecode
description: Implement an approved code-change plan in the Professional Blog repository and write a concise JSON implementation report. Use after diagnosis and planning, not for open-ended redesign.
metadata:
  short-description: Execute approved repo code-change plans
---

# changecode

## Purpose

Implement a previously prepared code-change plan against the current Professional Blog repository.

This skill converts `TASK_CONTEXT` and `CHANGE_PLAN` into the smallest coherent set of repository changes required to satisfy the approved plan. Its responsibility is execution, validation, and handoff reporting, not diagnosis, architectural exploration, or product reinterpretation.

## Inputs

| Argument       | Required | Meaning                                                                                                                                                                          |
| -------------- | -------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TASK_CONTEXT` |      Yes | Authoritative context for the requested implementation, including original task, acceptance criteria, diagnostics, constraints, product context, and explicit non-goals.         |
| `CHANGE_PLAN`  |      Yes | The approved implementation plan to execute. This may be an inline plan or a path to a plan artifact; treat the plan as authoritative unless repository evidence invalidates it. |
| `OUTPUT_DIR`   |      Yes | Directory where the implementation report must be written. Final path is `<OUTPUT_DIR>/<task_name>.json`.                                                                        |
| `REPRODUCTION` |       No | Known reproduction command, route, request, test, or sequence for an existing defect.                                                                                            |
| `VALIDATION`   |       No | Additional validation requirements beyond the plan and repository instructions.                                                                                                  |

If any mandatory input is missing, ask for it before editing files. Derive `task_name` from the supplied plan or task context using lowercase letters, digits, and hyphens.

## Core Principle

Implement what was planned.

Do not silently redesign the task while implementing it. Preserve the intent, dependency order, constraints, architectural boundaries, and validation requirements established by the supplied plan.

If repository evidence shows that the plan is materially incorrect, incomplete, unsafe, or no longer applicable, stop instead of inventing a replacement plan. Write a blocked implementation report when `OUTPUT_DIR` is available.

## Repository Requirements

Before changing code, read and obey repository-local instructions that apply to the files being changed, including `AGENTS.md`, nested `AGENTS.md` files, quality-gate instructions, and relevant local contribution or skill guidance.

For this repository, every completed implementation must run:

```sh
npm run quality
```

The quality gate must pass unless an unrelated pre-existing failure is clearly documented in the report. Do not weaken, bypass, or remove quality checks to make the task pass.

Preserve the Professional Blog architecture:

- Blog Platform code owns Astro structure, routing, content lookup, rendering, navigation, metadata, and artifact presentation.
- Executable artifacts own their independent HTML, JavaScript behavior, artifact-specific assets, and browser-side execution.
- `src/components/ArtifactSandbox.astro` is an integration boundary, not ownership transfer into Astro.
- Do not introduce databases, authentication, CMS infrastructure, caching, messaging infrastructure, generalized artifact protocols, framework coupling for executable artifacts, or broad refactors unless explicitly required by the approved plan.

## Scope

The skill may modify source files, configuration, tests, dependencies, and files only when required by the plan. It may inspect surrounding code, run repository tooling, run targeted tests, reproduce behavior before and after a change, and run build, type, lint, format, and quality validation.

The skill must not perform unrelated refactoring, expand feature scope, reinterpret product requirements, introduce unplanned architecture, change unrelated dependencies, suppress validation failures, weaken quality gates, overwrite unrelated user changes, or silently diverge from the supplied plan.

## Workflow

### 1. Load Context

Read `TASK_CONTEXT`, `CHANGE_PLAN`, repository instructions, and the affected artifacts identified by the plan. Confirm that planned files, modules, routes, symbols, responsibilities, and intentionally new artifacts exist or can reasonably be created as specified.

### 2. Establish Baseline

Before editing:

- inspect the working tree and identify pre-existing changes;
- avoid overwriting or discarding unrelated user work;
- reproduce the original defect or behavior when `REPRODUCTION` is supplied or practical for a bug fix;
- run narrow baseline validation when it materially clarifies the implementation.

### 3. Validate Plan Applicability

Compare each planned step to the current repository.

Verify that:

- the artifact still owns the described responsibility;
- required symbols, data shapes, and boundaries still exist or are intentionally new;
- dependency direction remains materially correct;
- implementing the step would preserve current architecture and task scope.

Minor implementation detail differences are acceptable when they do not change the plan's meaning, such as a local symbol name differing slightly or an existing helper satisfying a planned responsibility.

A material mismatch requires stopping. Examples include an artifact no longer owning the planned responsibility, false required assumptions, incorrect dependency direction, architecture violations, or required changes outside explicit scope.

When stopped, do not independently redesign the solution. Report the mismatch, supporting repository evidence, affected plan steps, and whether a revised `plancodechanges` run is recommended.

### 4. Implement in Planned Order

Execute the `CHANGE_PLAN` steps in dependency-aware order, normally moving from artifacts with fewer upstream dependents toward broader consumers and entry points.

For every step:

1. inspect directly relevant code;
2. make the minimum required change;
3. preserve existing interfaces unless the plan explicitly changes them;
4. avoid nearby cleanup unrelated to the plan;
5. run targeted validation when useful before continuing upward.

Prefer changing the artifact that owns the behavior rather than compensating in a higher-level consumer.

### 5. Classify Discoveries

Proceed only for implementation details required to realize the approved plan without changing its meaning.

Stop for material plan deviations that alter what should be modified, the dependency model, architecture, interfaces, expected behavior, or task scope. Recommend returning to planning instead of improvising.

### 6. Validate

Run the narrowest useful validations first, such as targeted tests, affected routes, reproduction commands, type checks, or local build commands.

For bug fixes, rerun the original reproduction after implementation whenever practical. The exact originally observed failure should no longer occur.

Then run the repository quality gate:

```sh
npm run quality
```

Finally, run any additional integration, runtime, Docker, HTTP, or other validation required by `CHANGE_PLAN`, `TASK_CONTEXT`, `VALIDATION`, or repository instructions. A successful quality gate does not substitute for explicitly required runtime validation.

### 7. Review Final Diff

Before completion, inspect the resulting changes. Verify that every changed artifact is explained by the task, no planned requirement was omitted, no unrelated changes or temporary diagnostics were introduced, no debug output remains, and no quality checks were weakened.

### 8. Write Report

Write a concise valid JSON implementation report to:

```text
<OUTPUT_DIR>/<task_name>.json
```

The report should describe implementation semantically rather than reproduce source code, complete diffs, complete source files, long logs, or exhaustive command output. Prefer descriptions of changed artifacts, previous and implemented responsibilities, dependency effects, validation results, remaining issues, and recommended handoff action.

## Report Schema

```json
{
  "task": {
    "name": "filesystem-safe task identifier",
    "summary": "implemented change",
    "status": "completed | blocked | partial"
  },
  "plan_execution": {
    "plan_source": "identifier or path of supplied change plan",
    "steps_total": 0,
    "steps_completed": 0,
    "deviations": [
      {
        "step": 0,
        "type": "implementation_detail | material_deviation",
        "summary": "what differed from the plan",
        "resolution": "how it was handled"
      }
    ]
  },
  "changes": [
    {
      "artifact": "file/module/library/configuration",
      "symbols": ["relevant symbols"],
      "responsibility": "responsibility affected",
      "change": "semantic description of implemented change",
      "upstream_impact": ["affected consumers"],
      "downstream_impact": ["affected dependencies"]
    }
  ],
  "validation": {
    "baseline": [
      {
        "check": "baseline reproduction or validation",
        "result": "pass | fail | not_run",
        "summary": "concise result"
      }
    ],
    "targeted": [
      {
        "check": "targeted validation",
        "result": "pass | fail",
        "summary": "concise result"
      }
    ],
    "quality_gate": {
      "command": "npm run quality",
      "result": "pass | fail | not_run",
      "summary": "concise result"
    },
    "integration": [
      {
        "check": "runtime/integration/container/etc.",
        "result": "pass | fail | not_run",
        "summary": "concise result"
      }
    ]
  },
  "files_changed": ["repository-relative paths"],
  "remaining_issues": ["known unresolved issue or uncertainty"],
  "handoff": {
    "implementation_complete": true,
    "recommended_next_action": "review, validation, deployment, replanning, etc."
  }
}
```

For blocked reports, set `task.status` to `blocked`, `handoff.implementation_complete` to `false`, include the blocking evidence in `remaining_issues`, and make `recommended_next_action` concrete, such as `replanning`.

## Completion Criteria

The skill is complete only when repository instructions have been read and followed, the plan has been validated against the current codebase, planned changes have been implemented in dependency-aware order without material unapproved deviations, relevant reproduction and targeted validation pass, `npm run quality` passes or an unrelated pre-existing failure is documented, additional required validation has run, the final diff has been reviewed for scope, no temporary artifacts remain, and the JSON implementation report exists at `<OUTPUT_DIR>/<task_name>.json`.
