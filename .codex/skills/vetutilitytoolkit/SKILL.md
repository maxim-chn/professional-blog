---
name: vetutilitytoolkit
description: Inspect existing code for repeated logic or definitions and plan their consolidation into a single shared implementation in an appropriate utility or domain module. Identify purpose, nature, proposed interface, and consumers without copying implementations or performing refactoring.
---

# Vet Utility Toolkit

Inspect the existing codebase for repeated implementations or
definitions of the same responsibility. Plan a single authoritative
implementation that consumers invoke or reference instead of
reimplementing or redefining it.

Produce a plan only. Do not implement the consolidation or modify
source code, configuration, tests, dependencies, or runtime behavior.

## Scope

Inspect the project codebase unless the user specifies a narrower area.
Report the inspected scope and any coverage limitations.

Identify repetition by meaning and behavior, not merely by similar
syntax, names, or matching values. Trace relevant callers, inputs,
outputs, dependencies, configuration, and tests to establish whether
occurrences represent the same responsibility.

Distinguish genuine duplication from intentionally independent rules,
coincidentally equal values, and similar operations with different
contracts. Do not force these into a shared abstraction.

## Ownership and reuse

For each confirmed opportunity, plan one implementation or definition
in the module that naturally owns the responsibility.

- Use a utility module for domain-independent behavior.
- Use a domain module for business rules and domain-specific behavior.
- Preserve configuration ownership and required environment boundaries.
- Prefer an existing suitable implementation or module over creating
  another one.
- Have consumers invoke or reference the shared function, method,
  module, object, variable, or configuration rather than retaining
  their own equivalent implementation or definition.

Respect repository architectural boundaries and dependency direction.
Do not create a general utility merely because code appears in
multiple locations.

## Required plan content

For each reuse opportunity, include:

### Purpose

Explain the responsibility and intended behavior in concise prose.
State why the identified occurrences should share one implementation.

Copying the actual implementation or definition into the plan is
explicitly forbidden. Do not include source excerpts, function bodies,
object literals, configuration values, or implementation pseudocode.

File paths, symbol names, and declaration-only interface proposals
are permitted.

### Nature

Identify whether the repeated logic is a function, method, object,
variable, constant, configuration, module, or another kind of artifact.

Describe any contract differences that must be resolved before reuse.
Keep uncertain equivalence explicit rather than presenting it as
confirmed duplication.

### Proposed shared interface and owner

Identify the proposed owning utility or domain module and explain
why it owns the responsibility.

Provide a potential function signature or module interface:
name, inputs, outputs, relevant types, and behavioral obligations.
For non-callable artifacts, describe the exported name, type or
shape, and access contract without reproducing its definition.

Describe errors, side effects, mutability, or lifecycle only where
they affect safe reuse. Keep the interface provisional when evidence
does not resolve an important design choice.

### Existing occurrences and consumer migration

List every identified occurrence within the inspected scope using
its repository-relative path and enclosing module, function, method,
or symbol.

For each occurrence, explain:

- Its current responsibility.
- Which shared artifact it should invoke or reference.
- Any necessary adaptation at the consumer boundary.
- Which local implementation or definition becomes redundant.

Distinguish an existing implementation selected as authoritative from
consumers that will migrate to it. Do not claim exhaustive coverage
beyond the inspected scope.

### Implementation order and validation

Order the proposed work by dependency: establish or select the shared
owner, migrate consumers, then remove redundant implementations or
definitions.

Identify existing tests and meaningful checks that would establish
behavior preservation, including relevant differences between
consumers. Describe validation to perform during implementation;
do not execute the refactoring.

## Plan organization

Use a concise Markdown document containing:

1. Scope and inspection coverage.
2. Confirmed reuse opportunities, each with the required content above.
3. Candidates excluded or unresolved, with brief reasons.
4. Dependency-aware implementation order and validation.

When no justified reuse opportunity is found, report that result.
Do not invent consolidation work to populate the plan.

## Review and output

Show the complete proposed plan in chat before writing it.
Write only after explicit approval, using the approved destination.

Unless the user specifies another location, propose:
code_plans/<descriptive-task-name>.md

Approval to write the plan does not authorize implementing it.

## Completion check

Verify that every proposed consolidation has evidence of a shared
responsibility, an appropriate owner, a potential interface, and
identified consumers.

Ensure the plan contains no copied implementation or definition,
preserves architectural boundaries, and distinguishes verified
findings from unresolved assumptions.
