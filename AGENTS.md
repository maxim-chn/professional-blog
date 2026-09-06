# Repository Instructions

Before considering any implementation task complete, run:

```sh
npm run quality
```

The quality gate must pass without formatting, linting, Astro/type-checking, or production build failures.

## Python Task Environment

Use a project-local Python virtual environment when task execution needs custom Python scripts or third-party Python packages.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install <package>
.venv/bin/python <script>
```

Do not install task-specific Python packages into the system Python environment. Do not commit `.venv/` or generated Python cache files.

## Repository Semantic Map

### Technology Stack

| Concern                      | Repository choice             |
| ---------------------------- | ----------------------------- |
| Site framework               | Astro                         |
| Application language         | TypeScript                    |
| Authored content             | Markdown / MDX                |
| Executable artifacts         | Independent HTML + JavaScript |
| App/build runtime            | Node.js                       |
| Production package           | Docker container              |
| Production runtime target    | Google Cloud Run              |
| Source and deployment origin | GitHub                        |

v0_1 intentionally excludes databases, CMS infrastructure, authentication, and
application state infrastructure. Do not add any of these unless the task
explicitly requires it.

### System Responsibilities

The repository has two separate execution domains:

| Domain              | Owns                                                                                                                                                                                 | Must not own                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Blog Platform       | Site structure, navigation, authored posts, author/context information, content metadata, post-artifact relationships, artifact-boundary presentation, publication/build integration | The internal implementation of executable artifacts                       |
| Executable Artifact | Its HTML, JavaScript behavior, artifact-specific assets, and browser-side execution                                                                                                  | Blog routing, content metadata, Astro components, or publication workflow |

Architectural invariant: the blog owns composition, not executable-artifact
implementation. Do not require an executable artifact to become an Astro
component or otherwise adopt the blog framework.

### Astro Application

`src/` contains the Astro application. Treat Astro pages, components, content
configuration, and TypeScript modules as Blog Platform code.

| Responsibility        | What to trace                                            |
| --------------------- | -------------------------------------------------------- |
| Route resolution      | How a URL maps to a page or content entry                |
| Content lookup        | How collections/configuration locate an entry            |
| Content rendering     | How the resolved entry becomes page output               |
| Page composition      | How layouts, components, and content assemble            |
| Metadata              | How page/content metadata is produced and consumed       |
| Navigation            | How pages expose links and hierarchy                     |
| Artifact presentation | How the blog frames or references an executable artifact |

When investigating Astro code, identify the responsibility first; do not infer
behavior from file location alone.

### Authored Content

Markdown / MDX is authored content: data consumed by the Blog Platform, not
application routing or executable-artifact implementation.

| Content concern    | Responsibility                              |
| ------------------ | ------------------------------------------- |
| Entry              | The Markdown / MDX document and frontmatter |
| Collection/config  | Describes and validates content             |
| Route/lookup logic | Locates the intended entry                  |
| Rendering logic    | Renders the resolved entry                  |

For rendering failures, trace the full lifecycle from discovery through lookup
to rendering before blaming the document itself.

### Executable Artifacts

Executable artifacts stay outside the Astro component model. They may currently
live under `public/artifacts/<artifact-name>/`.

| Contents                                                        | Constraint                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `index.html`, JavaScript, CSS, images, and other browser assets | Keep it authorable and understandable without Astro-specific implementation |

The current layout is an implementation detail, not a permanent packaging
contract unless a later task explicitly establishes one.

### Artifact Sandbox Boundary

`src/components/ArtifactSandbox.astro` is the Blog Platform side of the
executable-artifact boundary. Treat it as integration, not ownership:

    Post / Blog Platform
            |
            v
    ArtifactSandbox
            |
       isolation boundary
            |
            v
    independent HTML + JavaScript artifact

Sandboxing/isolation is a first-class architectural requirement.

| Not yet a permanent contract in v0_1               |
| -------------------------------------------------- |
| Sandbox permissions                                |
| iframe versus another execution mechanism          |
| Artifact messaging APIs                            |
| Artifact metadata format                           |
| Build orchestration between artifacts and the blog |
| Security policy                                    |

Do not silently establish any of these while solving an unrelated task.

### Runtime Boundaries

Keep these contexts separate:

| Context                      | Command/source                                      | Validates                                                                                           | Does not prove                                          |
| ---------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Development runtime          | `npm run dev`                                       | Astro behavior in the host Node.js environment for local development and diagnosis                  | Production container behavior                           |
| Application validation       | `npm run quality`                                   | Formatting, linting, Astro/type checking, and production build validation                           | That the production container starts and serves traffic |
| Production packaging/runtime | `Dockerfile` -> container image -> Google Cloud Run | Cloud Run-compatible runtime assumptions, including port configuration and external network binding | Local development behavior                              |

Before considering an implementation task complete, `npm run quality` must pass
unless the task explicitly sets a different completion condition. Do not weaken,
bypass, or remove quality checks to make a change pass.

### Dependency Reasoning

| Direction               | Meaning                     |
| ----------------------- | --------------------------- |
| Downstream dependencies | What the artifact relies on |
| Upstream dependents     | What relies on the artifact |

Prefer the smallest responsible change boundary. For planned changes, start
with artifacts that have fewer upstream dependents and move toward broader
exposure unless there is a concrete reason not to.

Infer dependency direction from imports, references, runtime flow,
configuration, content relationships, and observed behavior; never from
directory hierarchy alone.

### Diagnosis Guidelines

Prioritize evidence in this order:

| Rank | Evidence                                       |
| ---- | ---------------------------------------------- |
| 1    | Autonomous reproduction                        |
| 2    | Error messages and stack traces                |
| 3    | Relevant logs                                  |
| 4    | Directly observable runtime behavior           |
| 5    | Targeted diagnostic commands or existing tests |
| 6    | Source/configuration inspection                |
| 7    | Theoretical reasoning from source alone        |

Source inspection should explain observed evidence, not replace reproduction
when reproduction is practical. Separate observed facts, supported deductions,
hypotheses, and unresolved uncertainty. Do not modify code only because a
plausible explanation exists.

When a task invokes the repository's troubleshooting skill, follow that skill's
stricter procedure and output/approval requirements.

### Change Discipline

Prefer minimal changes that preserve architectural boundaries. Avoid
opportunistic refactoring while addressing unrelated work.

| Do not introduce prematurely                |
| ------------------------------------------- |
| Database infrastructure                     |
| Authentication                              |
| CMS infrastructure                          |
| Caching                                     |
| Messaging infrastructure                    |
| A design system                             |
| Framework coupling for executable artifacts |
| Generalized artifact protocols              |

Add abstractions, dependencies, framework features, services, or persistent
infrastructure only when the task actually requires them. v0_1 exists to keep a
small, understandable end-to-end foundation.

### Agent Explanation Guidelines

When explaining repository behavior, prefer semantic descriptions over source
transcription.

| Explain                     | Purpose                                   |
| --------------------------- | ----------------------------------------- |
| Artifact and responsibility | Clarifies the ownership boundary          |
| Relevant symbols            | Grounds the explanation when names matter |
| Dependencies and dependents | Shows both directions of impact           |
| Runtime/data flow           | Explains how behavior happens             |
| Supporting evidence         | Separates facts from inference            |

Avoid large code excerpts unless exact syntax is the point. A useful explanation
lets the reader understand artifact responsibilities and interactions without
reconstructing the architecture from individual source lines.
