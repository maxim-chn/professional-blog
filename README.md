# professional-blog

A personal engineering blog and experimental platform for exploring modern software development, tools, and small engineering projects.

## Approved v0_1 Stack

| Concern              | Decision                      |
| -------------------- | ----------------------------- |
| Site framework       | Astro                         |
| Language             | TypeScript                    |
| Content              | Published HTML / static MDX   |
| Executable artifacts | Independent HTML + JavaScript |
| Artifact execution   | Isolated browser sandbox      |
| Runtime/build        | Node.js                       |
| Packaging            | Docker                        |
| Hosting              | Google Cloud Run              |
| Source/deployment    | GitHub                        |
| Database             | Filesystem-backed posts       |
| CMS                  | None for v0_1                 |
| Authentication       | None for v0_1                 |

## GCP Deployment

Deployment tools live in `deploy_tools/scripts/gcp/`. They use Docker to build and push an image to Google Artifact Registry, and the Google Cloud CLI (`gcloud`) to deploy it to Cloud Run and retrieve its URL.

Prerequisites: a running Docker engine, an authenticated Google Cloud CLI with access to the target project, Docker authentication for the target Artifact Registry, and an existing Artifact Registry repository. Review `init_env.sh` for the project, region, repository, image name/tag, and Cloud Run service settings. It exports these settings and the derived `GCP_IMAGE_URI`; it does not provision resources or authenticate the tools.

From the `professional-blog` repository root, run the following in order, continuing only after each command succeeds:

```sh
source deploy_tools/scripts/gcp/init_env.sh
npm run quality
bash deploy_tools/scripts/gcp/build_deployable_image.sh
bash deploy_tools/scripts/gcp/deploy.sh
bash deploy_tools/scripts/gcp/get_url.sh
```

Source `init_env.sh` in the same shell before running any of the GCP scripts, including the optional utilities below. Executing it with `bash` instead of sourcing it will not retain its exported variables in the calling shell. Repeat the source command when starting a new shell or changing the settings.

1. `build_deployable_image.sh` builds a `linux/amd64` image from the repository's Dockerfile, pushes it to `GCP_IMAGE_URI`, and prints its OS/architecture. It currently changes directory to `~/personal-blog-workspace/professional-blog/`, so the checkout must be available there.
2. `deploy.sh` deploys that image to the configured managed Cloud Run service with unauthenticated access enabled.
3. `get_url.sh` prints the deployed service URL.

To inspect stored images after sourcing the environment:

```sh
bash deploy_tools/scripts/gcp/list_images.sh
```

`undeploy.sh` is optional, reserved for future use when the Cloud Run service should be removed. It is not part of the normal deployment sequence and does not delete the Artifact Registry images or repository. After sourcing the environment, run it only when service removal is intended:

```sh
bash deploy_tools/scripts/gcp/undeploy.sh
```

## Architectural Boundary

The blog owns composition, navigation, content, and surrounding presentation. Executable artifacts remain independent units and must not be required to use Astro or another blog-framework component model.

Blog posts contain persisted publication-ready HTML and images. Playground pages present independently authored HTML + JavaScript applications in a sandbox. Application code and Playground descriptions remain outside blog persistence.

## Non-Functional Requirement: Sandbox-Renderable Executable Artifacts

The platform supports Playground pages that incorporate independently developed executable artifacts scoped to HTML + JavaScript.

The artifact is an independent unit. The Playground page provides its description and sandbox through `ArtifactSandbox.astro`.

Implications for stack selection:

- A Playground page combines descriptive content with an independently built HTML + JavaScript application.
- The application may originate as a standalone project and later be incorporated into Playground as an interactive demo.
- The publishing/build flow must be able to carry the artifact into the deployed site and make it available to the sandbox.
- Isolation/sandboxing is a first-class architectural requirement. The current integration uses an iframe with `sandbox="allow-scripts"`.
- Framework choice must not require executable artifacts to be rewritten as framework-native components.

Future changes requiring separate design:

- replacing the iframe sandbox mechanism or changing its permissions
- changing the artifact packaging convention or build orchestration
- inter-process/message APIs
- security policy

These decisions should follow from architecture/design work rather than be embedded in the requirement.

## Product Strategy

Professional Blog builds gradual rapport with human and autonomous visitors by giving them access to useful material, clear context about the author, and a path from public work to deeper artifacts.

The core principle is that premium is temporal, not hierarchical. Payment primarily provides earlier access to selected high-effort artifacts and supports continued creation; over time those artifacts join the public knowledge base.

## Primary Use Cases

| Name                    | Description                                                                                                                           | Business Significance                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Public Discovery        | Visitors can access useful blog posts and other open material without friction.                                                       | Builds reputation by making useful work easy to find, read, and share.                                                    |
| Author Context          | Visitors can understand what the author works on, how they think, and why the material exists.                                        | Builds a recognizable professional name and creates trust with like-minded software enthusiasts.                          |
| Related Artifacts       | Public material can lead visitors to deeper artifacts such as guides, theme-oriented e-books, boilerplates, or engineering resources. | Converts attention into deeper engagement while showing the breadth and practical value of the author's work.             |
| Coffee Access           | Visitors can acquire a premium artifact at a predictable "coffee" price.                                                              | Creates lightweight side income while keeping the relationship approachable and aligned with the author's creation model. |
| Returning Access        | Returning visitors gain broader access over time as premium artifacts progressively become freely accessible.                         | Encourages repeat visits and reinforces the long-term public knowledge base.                                              |
| Agent Access            | Autonomous visitors can discover, understand, and reference material meaningfully.                                                    | Extends reach beyond visual browsing and makes the work easier for agents to cite, connect, and reuse.                    |
| Public Transition       | Premium artifacts become public while preserving identity, references, history, and relationships.                                    | Keeps earlier work valuable over time and supports the principle that premium is temporal, not hierarchical.              |
| Low-Friction Publishing | New valuable artifacts can be added and connected with little platform administration.                                                | Keeps the author's effort focused on creating useful material rather than operating the platform.                         |

## Project Structure

- `src/pages/` owns route composition.
- `src/layouts/` owns separate blog-post and Playground presentation.
- `src/content/blog/` retains migration sources without exposing static blog routes.
- `src/content/playground/` stores static demo descriptions and explicit artifact metadata.
- `src/content.config.ts` defines the Playground collection.
- `src/lib/server/` owns runtime composition, catalogue navigation, and stored-body rendering.
- `local_database/` contains the tracked two-post baseline.
- `src/components/ArtifactSandbox.astro` is the single blog-owned artifact boundary.
- `public/artifacts/` stores independently authored HTML + JavaScript artifacts that are copied into the deployed site as static files.

## Local persistence

Astro retrieves blog posts from the filesystem persistence service at request time. The publication CLI and tracked two-post baseline are available. Preparation manifests live in the ignored `blogpost_manifests/` directory. Browser E2E remains a separate stage.

`src/lib/persistence/models/` contains one module per logical model. Each owns its record constraints; the application service owns complete-bundle relationships, and the filesystem adapter owns stored-record integrity and visibility. There is no independent validation pipeline. Shared catalogue, stored-record envelope, stored-media shape, and Registry-association checks live in `service.ts`; the adapter delegates to them and classifies stored-data errors. Summaries must be nonblank. `isNonEmptyString` accepts nonzero-length content, including whitespace-only chunks, while `isNonEmpty` checks trimmed nonblank text.

### Configuration and application entry point

Load `config/persistence.json` using `loadPersistenceConfig` with an explicit absolute file path or a file URL. All operational settings are in the file, including explanations in its `settings` object. The configured root resolves relative to that file, to repository `local_database`, not to the process working directory. An explicitly supplied absolute root override is supported. Missing or invalid settings fail; no settings fall back to hardcoded values.

Construct `FileSystemAdapter` and `PersistenceService` with the same loaded configuration. Supply the application clock explicitly, such as a function returning the current Date. The service exposes `createPost(post, metadata, contents, media)`, `listPosts(limit, cursor)`, and `getPost(postId)`. Identifiers must be canonical lowercase UUID v4 strings generated by the caller. Metadata timestamps are canonical UTC strings with seconds or milliseconds; the service assigns Registry timestamps with milliseconds. It never generates replacement record IDs or Metadata dates.

Tests load `tests/config/persistence.json` independently and supply temporary roots explicitly. Application/test values can differ across all settings. Small test limits verify limit enforcement without repeating the same boundary at the application's configured size.

### Publication and storage

Only one writer may publish to a root at a time. Readers may remain active during publication. Each root is independent; no operation queries another adapter or store.

- `catalogue.json` contains Registry mappings and the complete Metadata projection used for listing.
- `records/<uuid>.json` contains a typed envelope for each Post, Metadata, Content, or Media record. Media envelopes omit binary data.
- `media/<uuid>.bin` contains exact Media bytes, returned as `data` by the read interface.
- Private `.stage-*` and `.catalogue-*` files are inaccessible through public reads and are not resumable publications.

Creation validates the entire bundle, writes privately, installs records with exclusive links, and finally atomically replaces the catalogue on the same filesystem. The catalogue is the visibility boundary. A successful creation returns `created: true, duplicate: false`; identical retries return `created: false, duplicate: true` without changing any records or Registry time. Different values under existing IDs produce `ID_CONFLICT` and are never overwritten. Logical map key order and input child order do not affect duplicate detection; Post content order and exact bytes do.

Handled pre-commit failures leave the old catalogue intact and attempt to remove only this invocation's files. Errors expose `code`, identifying `context`, original `cause`, and any `cleanupFailures` paths. Error codes are `INVALID_INPUT`, `ID_CONFLICT`, `NOT_FOUND`, `STORAGE_INTEGRITY`, and `IO_FAILURE`. Abrupt termination can leave invisible orphan files; automatic recovery and power-loss durability are not promised.

### Content and media convention

Content chunks contain 1 through the configured maximum Unicode code points. They are stored unchanged and reconstructed in Post order without separators. Chunk boundaries may split HTML or a graphic token.

A graphic reference is the explicit reserved token `{{graphic:identifier}}`, for example `<img src="{{graphic:cover}}">`. Its identifier starts with an ASCII letter/digit and then contains letters, digits, underscores, or hyphens. The owning Post maps it to a Media UUID under the correct MIME type. References are checked after reconstructing the whole body; arbitrary UUID-like prose is not interpreted. The runtime renderer substitutes absolute media URLs without modifying stored text.

Media format checks identify PNG, JPEG, GIF, and WebP signatures and compare the detected format with the configured allowed MIME types. They also verify SHA-256 over the actual bytes. This is format identification, not full image decoding. SVG and other formats are rejected. Captions, alt text, and styles remain in the content.

### Reads and validation

`listPosts` reads the catalogue only and orders by Registry time descending, with no secondary ordering. Limits are positive integers. A cursor is canonical UTC with milliseconds, for example `2026-10-04T10:00:00.000Z`; it selects strictly older entries. Nonempty pages return their last timestamp even on the final populated page; empty pages preserve the supplied cursor, or null initially. Refresh without a cursor to discover new posts. Publications are assumed to be well separated; there is no timestamp collision mechanism.

`getPost` first resolves committed Registry membership and then reads complete, validated records and bytes. An unknown/unregistered post is `NOT_FOUND`; a missing or corrupt registered record is `STORAGE_INTEGRITY`. Read I/O failures remain `IO_FAILURE`. All reads observe current committed state without a catalogue cache.

Run `npm run test:persistence` for isolated contract and failure tests. Run `npm run build` followed by `npm run test:runtime` for rendering, navigation, and HTTP integration tests. `npm run quality` runs formatting, linting, Astro/type checks, the production build, and both test suites. Tests use Node's native TypeScript stripping/test runner (Node 22.18 or later). HTTP tests require permission to listen on localhost. Each test cleans up its temporary database and server; the tracked baseline remains unchanged.

## Runtime routes and configuration

- `/` always displays the first catalogue page, ignoring pagination query parameters.
- `/blog-post-catalogue/` displays the first catalogue page.
- `/blog-post/<post-id>/` retrieves a persisted blog post.
- `/media/<post-id>/<media-id>` serves validated image bytes belonging to that post.
- `/playground/counter-demo/` presents the static counter demo.
- Old `/blog/` routes are removed without redirects.

Catalogue pages use `next_page` for the current page cursor and repeated `prev_page` parameters for earlier page cursors. For example, the second page has `?next_page=A`; the third has `?next_page=B&prev_page=A`. Cursors are Registry timestamps in canonical UTC with milliseconds. Older and Newer links preserve this state across reloads and shared URLs. The final populated page has no Older link; an empty later page retains navigation back.

`config/astro-runtime.json` selects publication configuration and the shared homepage/catalogue page size. Publication configuration supplies the visitor origin and persistence configuration reference. Referenced paths resolve relative to their containing configuration files.

`npm run dev`, `npm run preview`, and `npm start` explicitly select the application's runtime configuration. For a different configuration, launch the server directly with an absolute `ASTRO_RUNTIME_CONFIG` path. `PERSISTENCE_ROOT` overrides storage with an absolute path; `VISITOR_ORIGIN` overrides the HTTP(S) origin used in visitor links.

For example, after building:

```sh
ASTRO_RUNTIME_CONFIG="$PWD/config/astro-runtime.json" \
VISITOR_ORIGIN="http://localhost:8080" \
HOST=127.0.0.1 PORT=8080 \
node dist/server/entry.mjs
```

The final Docker image includes runtime configuration and the existing `local_database`. It excludes preparation manifests and does not publish posts during build or startup. Supply `VISITOR_ORIGIN` with the externally reachable origin when launching a container or configuring Cloud Run; the packaged application configuration uses `http://localhost:4321`.

Malformed post/media identifiers and catalogue cursors return HTTP 400. Unknown posts, media ownership mismatches, and missing Playground pages return 404. Corrupt stored data and configuration failures return 500 without internal paths or error details.
