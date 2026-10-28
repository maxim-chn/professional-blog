# professional-blog

A personal engineering blog and experimental platform for exploring modern software development, tools, and small engineering projects.

## Product Strategy

Professional Blog builds gradual rapport with human and autonomous visitors through useful material, clear context about the author, and opportunities to explore related work.

Blog posts provide readable engineering material. Playground pages let visitors interact with sandboxed application demos, including JavaScript demo-clones of applications planned for future development.

Coffee Access is an entirely optional “Buy me a Coffee” support option intended to be available across the blog's material. Contributions support continued creation without changing access to material. The product does not require premium content, early-access periods, payment-based permissions, or entitlement tracking.

### Primary Use Cases

- **Public Discovery:** Visitors discover, read, and share useful blog posts and other public material, building the author's professional reputation.
- **Author Context:** Visitors understand the author's work, interests, and reasoning, establishing context and trust.
- **Related Artifacts:** Material connects visitors to guides, engineering resources, and related projects for deeper exploration.
- **Playground Interaction:** Visitors experience application demos directly in their browsers through dedicated sandboxed pages.
- **Coffee Access:** Visitors can optionally support the author through “Buy me a Coffee,” independently of access to material.
- **Returning Access:** Visitors return to discover newly published material and developments in the author's projects.
- **Agent Access:** Autonomous visitors can discover, understand, and reference material meaningfully.
- **Low-Friction Publishing:** The author can publish useful material with little platform administration.

## Architectural Boundary

The blog owns composition, navigation, content, and surrounding presentation. Executable artifacts remain independent units and must not be required to use Astro or another blog-framework component model.

Blog posts contain persisted publication-ready HTML and images, retrieved at request time. Playground pages present independently authored HTML + JavaScript applications in a sandbox. Application code and Playground descriptions remain outside blog persistence and are packaged with the site.

## Non-Functional Requirement: Sandbox-Renderable Executable Artifacts

The platform supports Playground pages containing independently developed HTML + JavaScript applications.

The application is an independent unit. Its Playground page supplies descriptive content and integrates the sandbox through `ArtifactSandbox.astro`.

- An application may originate as a standalone project and later be incorporated into Playground as an interactive demo.
- The build and deployment flow carries its assets into the deployed site.
- Isolation is a first-class architectural requirement. The current integration uses an iframe with `sandbox="allow-scripts"`.
- Executable artifacts must not need to be rewritten as framework-native components.

## Technology Stack

- **Site framework:** Astro with the Node adapter.
- **Application language:** TypeScript.
- **Blog content:** Persisted publication-ready HTML and images.
- **Playground descriptions:** Static Markdown/MDX.
- **Executable artifacts:** Independent HTML + JavaScript.
- **Artifact execution:** Sandboxed browser iframe.
- **Persistence:** Shared adapter contract with a filesystem implementation.
- **Runtime and build:** Node.js.
- **Browser testing:** Playwright with project-local Chromium.
- **Code checks:** Astro/type checking, ESLint, and Prettier.
- **Packaging:** Docker.
- **Hosting:** Google Cloud Run, with images stored in Google Artifact Registry.
- **Source repository:** GitHub.

No CMS or authentication system is currently implemented.

## Runtime Routes and Configuration

- `/` always displays the first catalogue page, ignoring pagination query parameters.
- `/blog-post-catalogue/` displays the first catalogue page.
- `/blog-post/<post-id>/` retrieves a persisted blog post.
- `/media/<post-id>/<media-id>` serves validated image bytes belonging to that post.
- `/playground/<demo-app-name>/` presents a sandboxed application and its description.

Catalogue pages use `next_page` for the current cursor and repeated `prev_page` parameters for earlier cursors. For example, the second page has `?next_page=A`; the third has `?next_page=B&prev_page=A`. Cursors are Registry timestamps in canonical UTC with milliseconds.

Posts appear newest first. Older and Newer links preserve navigation state across reloads and shared URLs. The final populated page has no Older link; an empty later page retains navigation back.

`config/astro-runtime.json` selects publication configuration and the shared homepage/catalogue page size. Publication configuration supplies the visitor origin and persistence configuration reference. Referenced paths resolve relative to their containing configuration files.

`npm run dev`, `npm run preview`, and `npm start` explicitly select the application's runtime configuration. For a different configuration, launch the server directly with an absolute `ASTRO_RUNTIME_CONFIG` path. `VISITOR_ORIGIN` overrides the HTTP(S) origin used in visitor links.

For example, after building:

```sh
ASTRO_RUNTIME_CONFIG="$PWD/config/astro-runtime.json" \
VISITOR_ORIGIN="http://localhost:8080" \
HOST=127.0.0.1 PORT=8080 \
node dist/server/entry.mjs
```

Malformed post/media identifiers and catalogue cursors return HTTP 400. Unknown posts, media ownership mismatches, and missing Playground pages return 404. Corrupt stored data and configuration failures return 500 without exposing internal paths or error details.

Filesystem configuration and root overrides are described in the [library documentation](src/lib/README.md#filesystem-persistence).

## Project Structure

The following paths are listed alphabetically:

- `blogpost_manifests/` holds ignored prepared publication inputs.
- `config/` contains application runtime, publication, and persistence settings.
- `deploy_tools/` contains deployment documentation and GCP scripts.
- `local_database/` contains the tracked two-post baseline.
- `public/artifacts/` contains independently authored application assets packaged with the site.
- `scripts/publish-post.ts` provides the publication CLI.
- `src/components/ArtifactSandbox.astro` implements the blog-owned sandbox integration boundary.
- `src/components/PostCatalogue.astro` renders catalogue entries and navigation.
- `src/content/playground/` stores static demo descriptions and artifact metadata.
- `src/layouts/` owns blog-post and Playground presentation.
- `src/lib/persistence/` contains persistence models, the contract, service, and filesystem adapter.
- `src/lib/publication/` prepares and publishes post inputs.
- `src/lib/server/` connects persistence to runtime routes, catalogue navigation, and rendering.
- `src/lib/utilities/` contains shared utility functions and constants.
- `src/pages/` owns route composition.
- `tests/config/` contains independent test settings.
- `tests/e2e/` contains browser scenarios and the intentional-failure supervisor.
- `tests/fixtures/` contains test inputs and expected results.
- `tests/persistence/` tests persistence behavior.
- `tests/runtime/` tests rendering, navigation, and HTTP integration.
- `tests/support/` contains test infrastructure and its verification.

## Browser E2E

Browser E2E verifies visitor-facing behavior across the site. Current coverage includes complete baseline posts and images, live publication, duplicate retries, catalogue navigation, invalid requests, and Playground sandbox interaction. This suite can expand as other platform capabilities develop.

After installing project dependencies, install Chromium within this project's `node_modules`:

```sh
npm run test:e2e:install
```

The command uses `PLAYWRIGHT_BROWSERS_PATH=0`, keeping the browser installation local to this project. Reinstall Chromium after replacing `node_modules` or upgrading Playwright.

For a standalone browser run:

```sh
npm run build
npm run test:e2e
```

The E2E command runs the regular browser scenarios and then a separate failure supervisor. The supervisor requires its child browser run to fail at an intentional assertion after publication, then verifies storage restoration. An unexpected browser failure, wrong failure reason, or cleanup failure makes the command fail.

`tests/config/e2e.json` selects independent runtime configurations, timeouts, browser settings, output paths, and pagination fixture count. Shared-root scenarios use settings compatible with the tracked posts; isolated catalogue scenarios use smaller limits and temporary databases.

Run only one E2E command at a time, without overlapping author publication. Browser workers and support tests run serially. The suite starts and stops its own servers instead of reusing an existing application server.

### Storage ownership and recovery

Shared-root setup restores only the dedicated post-data paths listed in `tests/config/e2e-baseline.json` from the captured Git revision. Pre-existing edits to those designated files are intentionally replaced. Other files, including untracked author data, are protected by byte snapshots.

Setup reconciles baseline catalogue entries while preserving author entries. Teardown restores the resulting prepared snapshot and removes only recorded generated post data. Isolated scenarios remove their own temporary databases. See the [filesystem restoration documentation](src/lib/README.md#e2e-restoration) for implementation details.

Recovery records and server logs remain under `test-results/e2e/`. Regular browser artifacts use `test-results/e2e/browser/`; intentional-failure artifacts use `test-results/e2e/browser-failure/`. The HTML browser report is in `playwright-report/`. These generated directories are ignored by Git, Prettier, and ESLint.

Interrupted or failed restoration can leave a lock in the configured snapshot directory. Stop test processes and other writers before recovery. Preserve the matching `run-*` directory and inspect `baseline.json`, initial/prepared snapshots, publication journals, and `cleanup.json` when available.

The `restoreStorage` helper in `tests/support/storage-teardown.ts` accepts the captured baseline, selected snapshot, and recorded cleanup paths. If interruption prevented a complete cleanup record, review the publication journals and current file set before selecting cleanup paths. Do not use blanket Git reset/clean commands or delete unknown files. Release the matching lock only after restoration and byte/file-set verification succeed.

### Related checks

- `npm run test:persistence` runs isolated persistence contract and failure tests.
- `npm run test:runtime` runs rendering, navigation, and HTTP integration tests.
- `npm run test:support` verifies E2E infrastructure and restoration serially.
- `npm run quality` runs formatting, linting, Astro/type checks, the production build, and all four test groups, including browser E2E.

Standalone runtime, support, and browser tests require a current build. Server tests require permission to listen on localhost. TypeScript tests run through Node's native type stripping and test runner.

## Persistence Mechanism

Persistence separates the application-facing service and logical data model from the underlying storage implementation.

Configuration loading follows the runtime-to-publication-to-persistence references. Required operational values are explicit in configuration files, without hardcoded fallbacks. Application and test configurations are independent; differing values exercise the same configured behavior.

`PersistenceService` receives an adapter, persistence settings, and an explicit clock. It exposes `createPost`, `listPosts`, and `getPost`. Models own record constraints; the service checks complete-post relationships and assigns Registry publication timestamps.

`PersistenceAdapter` defines the storage contract: create a complete post with its Registry association, list catalogue entries, and retrieve a complete post bundle. Current construction uses `FileSystemAdapter`; a future database implementation must satisfy the same contract and be integrated into configuration and construction.

A complete post bundle contains the Post, Metadata, ordered Content records, and Media records. Registry associates the published Post with its Metadata and supplies the timestamp used for newest-first catalogue ordering.

Publication prepares reusable inputs with stable identifiers, then publishes through the service. Identical retries preserve stored data and the original Registry timestamp; conflicting data under an existing identity is rejected. Publishing is explicit and does not run during builds or server startup.

At request time, Astro lists catalogue metadata or retrieves a complete post. Rendering reconstructs content in its declared order and resolves graphic references into media URLs without changing stored text.

See the [library documentation](src/lib/README.md) for the contract, configuration and construction flow, publication inputs, and the current filesystem implementation.

## GCP Deployment

Deployment scripts build a Docker image, push it to Google Artifact Registry, and deploy it to Google Cloud Run.

The image includes the built application, runtime configuration, Playground assets, and the existing local post database. Preparation manifests remain outside the image.

Configure `VISITOR_ORIGIN` with the externally reachable service origin so visitor links resolve correctly. The packaged configuration uses `http://localhost:4321`.

See the [deployment README](deploy_tools/README.md) for prerequisites, the exact deployment sequence, runtime settings, and maintenance commands.
