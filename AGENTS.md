# Repository Instructions

## Working approach

Use this file as an overview and navigation guide. Read the references relevant to the task, then inspect the implementation, configuration, callers, and tests before drawing conclusions. Documentation provides context; verify detailed behavior against current code and observed execution. Report discrepancies rather than silently choosing an interpretation.

For defects, reproduce the behavior when practical and use errors, logs, and targeted tests to guide investigation. Distinguish verified facts from hypotheses. Explain responsibilities, dependencies, and runtime flow with supporting evidence instead of transcribing source.

Keep changes within the requested scope. Infer dependencies from imports, references, configuration, and runtime behavior, not directory hierarchy. Change underlying artifacts before their dependents. Avoid unrelated refactoring or infrastructure additions.

Follow explicitly invoked repository skills, including their review requirements:
[planning](.codex/skills/plancodechanges/SKILL.md),
[implementation](.codex/skills/changecode/SKILL.md), and
[troubleshooting](.codex/skills/troubleshoot/SKILL.md).

## Architectural boundaries

- Blog posts use persistence-backed discovery and request-time rendering. Do not reintroduce static blog sources or legacy ingestion. Publication is explicit, never a build or startup side effect.
- Playground descriptions and executable applications remain outside blog persistence. The blog owns composition and sandbox integration; applications remain independent HTML + JavaScript.
- Preserve sandbox isolation. Changes to permissions, messaging, packaging, or execution mechanisms require explicit task scope.
- Models own record constraints, the persistence service owns cross-record relationships, and adapters own storage behavior. Do not introduce an independent validation module.
- Operational settings belong in configuration files without hardcoded fallbacks. Application and test configurations remain independent.
- Preserve timestamp-only, newest-first Registry ordering. Publication assumes sequential, well-separated timestamps; do not introduce collision handling or synthetic production timestamps.

## Where to investigate

- **Product, stack, and ownership:** Read [Product Strategy](README.md#product-strategy), [Technology Stack](README.md#technology-stack), and [Architectural Boundary](README.md#architectural-boundary).

- **Routes, navigation, and rendering:** Start with [Runtime Routes and Configuration](README.md#runtime-routes-and-configuration). Inspect `src/pages/`, `src/lib/server/`, and `src/components/PostCatalogue.astro`.

- **Playground and sandbox:** Read the [sandbox requirement](README.md#non-functional-requirement-sandbox-renderable-executable-artifacts). Inspect `src/content.config.ts`, `src/content/playground/`, `src/components/ArtifactSandbox.astro`, and `public/artifacts/`.

- **Persistence and publication:** Read [Persistence Mechanism](README.md#persistence-mechanism) and [Library implementation](src/lib/README.md). Start implementation tracing at `src/lib/persistence/contract.ts`, `src/lib/persistence/service.ts`, and `src/lib/publication/`.

- **Filesystem storage:** Read [Filesystem persistence](src/lib/README.md#filesystem-persistence). Inspect `src/lib/persistence/filesystem.ts` and `config/persistence.json`.

- **Tests and recovery:** Read [Browser E2E](README.md#browser-e2e). Inspect `tests/config/`, `tests/support/`, and `tests/e2e/`.

- **Packaging and deployment:** Read [Deployment tools](deploy_tools/README.md). Inspect `Dockerfile` and `deploy_tools/scripts/gcp/`.

Use [Project Structure](README.md#project-structure) for the broader repository map. Follow imports and call sites beyond these entry points as the task requires.

## Verification and data protection

Before considering an implementation complete, run `npm run quality`. It must pass unless the task explicitly sets a different completion condition. Report failures accurately; never weaken or bypass checks to obtain a passing result. Commands are defined in `package.json`; prerequisites and test scope are described under [Related checks](README.md#related-checks).

Before running shared-storage E2E, read [Storage ownership and recovery](README.md#storage-ownership-and-recovery). Use project-local Chromium and serial execution without overlapping author publication. Git restoration is limited to designated E2E post data; protect author data and unrelated artifacts. Retain recovery evidence when restoration fails.

Keep development checks, application tests, container verification, and deployed-service verification distinct. Success in one does not establish success in another. Container verification must work without mounting the host repository. Follow the [deployment sequence](deploy_tools/README.md#deployment-sequence) when deployment is requested.

For Python tooling, use a project-local `.venv`; do not install task dependencies into system Python or commit environments and caches.

## Maintaining this guide

Keep durable instructions and entry points here. Put detailed procedures and implementation explanations in the relevant README or owning artifact, and update pointers when those locations change.

Use [agentknowledge](.codex/skills/agentknowledge/SKILL.md) when changes affect agent-facing navigation knowledge, including relevant artifacts and investigation starting points in `AGENTS.md`. Invoke it as `$agentknowledge <CHANGE_TRIGGER>`.

Use [projectdocs](.codex/skills/projectdocs/SKILL.md) when changes require updates to business/domain or technical explanations in `README.md` or focused documentation. Invoke it as `$projectdocs <CHANGE_TRIGGER>`; substantial themes belong in dedicated documents linked from higher-level explanations.

Both skills require `<CHANGE_TRIGGER>` to describe the changes prompting the update and identify the affected business/domain areas. Keep edits scoped to those changes and their direct consequences; never regenerate documentation or agent knowledge in its entirety.
