---
name: plancodechanges
description: Produce a concise, dependency-aware Markdown implementation plan for a requested code change. Use only for planning; do not implement changes.
---

# plancodechanges

## Purpose

Produce a concise, implementation-oriented Markdown plan for a code change.

The skill translates `TASK_CONTEXT` into an ordered set of proposed changes across relevant repository artifacts: modules, libraries, packages, files, classes, functions, methods, variables, data structures, configuration, responsibilities, interfaces, boundaries, dependencies, upstream consumers, and downstream dependencies.

The skill produces a plan only. It must not implement the proposed changes, include direct implementation code, modify source/configuration/tests/dependencies, refactor, create implementation artifacts, or commit changes. Repository inspection is read-only.

## Inputs

| Argument       | Required | Meaning                                                                                                                                                                                                                                  |
| -------------- | -------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TASK_CONTEXT` |      Yes | Authoritative implementation task to plan. It may include a feature request, bug description, acceptance criteria, constraints, diagnostic snapshot, `troubleshoot` output, product requirements, explicit boundaries, or a combination. |
| `OUTPUT_DIR`   |      Yes | Directory where the approved plan document must be written. Final path is `<OUTPUT_DIR>/<task_name>.md`.                                                                                                                                 |

Derive `task_name` from `TASK_CONTEXT` using a concise, filesystem-safe identifier with lowercase letters, digits, and hyphens.

If either mandatory argument is missing, ask for the missing value before repository inspection or writing.

## Planning Principle

Plan changes according to dependency direction. Begin with artifacts that have the fewest upstream dependents and progressively move toward artifacts exposed through more consumers or entry points.

| Conceptual order                    | Meaning                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Foundational or leaf responsibility | Internal helper, data shape, configuration, schema, or low-level behavior with minimal upstream exposure.    |
| Immediate consumer                  | Module or function directly relying on the foundational artifact.                                            |
| Intermediate integration            | Adapter, service, route logic, rendering boundary, or orchestration layer.                                   |
| Higher-level consumer               | Page, workflow, application surface, test harness, or broad user-facing behavior.                            |
| Entry point or surface              | External interface, route, CLI command, public API, UI screen, build process, or production-facing behavior. |

Derive ordering from repository evidence and task context rather than directory structure alone.

## Scope Rules

| May do                                                                                                                                                               | Must not do                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Inspect repository structure, relevant source files, configuration, dependency declarations, tests, and documentation that describes implementation contracts.       | Modify source code, configuration, dependencies, tests, documentation, generated implementation artifacts, or commits.         |
| Trace imports, references, function/method usage, data flow, responsibilities, upstream dependents, downstream dependencies, interfaces, and integration boundaries. | Perform refactoring, write direct implementation code, create patches for the planned change, or provide direct code snippets. |
| Consume diagnostic artifacts produced by `troubleshoot`.                                                                                                             | Treat diagnostic hypotheses as facts unless supplied context presents them as established conclusions.                         |
| Identify likely files, symbols, change responsibilities, dependency implications, upstream impacts, and validation implications.                                     | Expand scope to adjacent improvements not required by the requested change.                                                    |

## Procedure

| Stage                       | Required work                                                                                                                                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Understand requested change | Extract objective, expected behavior, motivation, constraints, acceptance criteria, explicit non-goals, and diagnostic conclusions when provided. Distinguish requirements from implementation assumptions.                                                            |
| Identify affected boundary  | Locate the smallest repository area capable of satisfying the task. Identify relevant modules, libraries, files, symbols, data structures, configuration, artifact responsibilities, and interfaces.                                                                   |
| Build dependency view       | For each affected artifact, identify downstream dependencies it relies on and upstream dependents that rely on it. Keep the view task-scoped; do not build an exhaustive repository graph unless required.                                                             |
| Determine change set        | Identify the smallest coherent set of changes expected to satisfy the task. For each proposed change, describe artifact, responsibility, relevant symbols, current role, planned responsibility, affected dependencies, upstream impact, and validation implications.  |
| Order changes               | Order implementation steps from least upstream dependency exposure toward greater upstream dependency exposure. When steps are independent, say so. When a higher-level change must precede a lower-level one for a concrete technical reason, document the exception. |
| Define validation           | Identify how downstream implementation should be validated at meaningful stages, including existing tests, runtime behavior, build checks, type checking, linting, quality gates, original-defect reproduction, HTTP checks, or UI smoke checks as relevant.           |
| Review coherence            | Verify every planned change supports the task, dependency direction is documented, ordering follows dependency reasoning, no unnecessary refactoring entered the plan, no implementation code is included, and acceptance criteria map to validation.                  |
| Prepare approval draft      | Produce the complete expected Markdown document in chat and ask the user for approval before writing it.                                                                                                                                                               |
| Write approved artifact     | After explicit user approval, write the approved Markdown plan to `<OUTPUT_DIR>/<task_name>.md`.                                                                                                                                                                       |

## User Approval Gate

Before writing the file, show the exact Markdown document expected to be written.

| Requirement           | Behavior                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Approval required     | Do not write `<OUTPUT_DIR>/<task_name>.md` until the user explicitly approves the displayed document. |
| User requests changes | Revise the displayed Markdown document and request approval again.                                    |
| User denies approval  | Do not write the artifact; summarize what remains unresolved.                                         |
| Approval scope        | Approval applies only to writing the plan document, not implementing code changes.                    |

## Markdown Document Structure

The plan document must use this structure, with concise prose and tables where they improve scanability.

| Section                | Required content                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Title                  | `# <task_name>` or a concise human-readable title derived from `TASK_CONTEXT`.                                                                               |
| Task                   | Summary, objective, constraints, and non-goals.                                                                                                              |
| Affected Area          | Smallest system boundary and relevant artifacts with current responsibilities and relevance.                                                                 |
| Dependency View        | Task-scoped downstream dependencies and upstream dependents for relevant artifacts, plus why each relationship matters.                                      |
| Change Plan            | Ordered implementation steps with artifact, relevant symbols, current responsibility, planned change, dependency reasoning, upstream impact, and validation. |
| Integration Validation | End-to-end or repository-level checks and acceptance-criteria mapping.                                                                                       |
| Risks                  | Implementation risks or uncertainties, affected areas, and mitigation guidance.                                                                              |
| Implementation Handoff | Starting point and completion condition for downstream implementation.                                                                                       |

Use exact file, module, class, function, method, variable, or configuration names when known and useful.

## Output Style

The plan should describe what must change and where while leaving implementation mechanics to a downstream implementation skill or human engineer.

Prefer responsibility-oriented descriptions such as "content route", "collection lookup responsibility", "artifact rendering boundary", "function responsible for resolving the requested entry", "configuration defining the content collection", or "consumer of the resolved content entry".

Avoid complete function implementations, direct code snippets, pseudocode that effectively specifies implementation syntax, copied source files, long source excerpts, unrelated architecture, speculative refactoring, and exhaustive dependency graphs.

## Ordering Invariant

The `Change Plan` section must be dependency-aware.

Unless a documented technical exception exists, each successive step should generally move from more foundational, less-consumed artifacts toward artifacts depended upon by, or exposed through, more of the system.

Explain dependency reasoning in each step rather than relying only on step numbering.

## Completion Criteria

|   # | Criterion                                                                                                                       |
| --: | ------------------------------------------------------------------------------------------------------------------------------- |
|   1 | `TASK_CONTEXT` is translated into an explicit objective and constraints.                                                        |
|   2 | The smallest relevant system boundary is identified.                                                                            |
|   3 | Relevant artifacts and responsibilities are identified.                                                                         |
|   4 | Downstream dependencies and upstream dependents are considered.                                                                 |
|   5 | The minimum coherent change set is identified.                                                                                  |
|   6 | Change steps are ordered from least upstream dependency exposure toward greater exposure unless an exception is documented.     |
|   7 | Relevant validation is attached to the plan.                                                                                    |
|   8 | Acceptance criteria are represented by validation activities.                                                                   |
|   9 | No source, configuration, dependency, test, documentation, or implementation changes are performed for the planned code change. |
|  10 | No direct implementation code snippets are included.                                                                            |
|  11 | The complete expected Markdown document is shown to the user and explicitly approved before writing.                            |
|  12 | A valid Markdown plan exists at `<OUTPUT_DIR>/<task_name>.md` after approval.                                                   |
|  13 | The artifact contains enough information for downstream implementation without repeating the planning analysis.                 |
