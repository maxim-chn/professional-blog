# Stage 3: Astro runtime integration

## Task

Connect the local Astro application to the persistence service and populated store delivered by Stages 1 and 2.

The homepage must show committed posts, newest Registry timestamp first. Each generated visitor link must resolve to a complete post with its stored images.

A post published through the CLI must become visible on homepage refresh without rebuilding or restarting Astro.

This stage excludes production database integration, deployment, publication UI, and changes to the persistence models. Automated browser E2E and tracked-root restoration belong to Stage 4.

All paths below are relative to the repository root. New file locations are proposed.

## Affected Area

| Artifact | Current responsibility | Planned responsibility |
| --- | --- | --- |
| `src/pages/index.astro` | Lists static collection entries | Lists committed posts through `listPosts` |
| `src/pages/blog/[...slug].astro` | Prerenders collection entries | Replaced by request-time UUID route |
| `src/pages/blog/[postId].astro` | New | Retrieves and renders a registered post |
| `src/pages/media/[postId]/[mediaId].ts` | New | Serves media belonging to a registered post |
| `src/layouts/PostLayout.astro` | Accepts an Astro collection entry | Accepts persistence-backed presentation data |
| `src/lib/server/persistence.ts` | New | Server-only composition of configuration, adapter, and application service |
| `src/lib/server/post-rendering.ts` | New | Complete-body reconstruction and graphic-reference resolution |
| `src/lib/publication/visitor-url.ts` | Stage 2 visitor URL construction | Shared by CLI and homepage |
| `config/astro-runtime.json` | New | Explicit runtime settings and configuration references |
| `tests/config/astro-runtime.json` | New | Independent runtime test settings |
| `tests/runtime/` | New | Rendering and HTTP integration tests |
| `astro.config.mjs` | Server output with Node adapter | Retains existing runtime foundation |
| `src/content.config.ts`, `src/content/blog/` | Static collection schema and authored sources | Retained source tooling, no longer the public catalogue |
| `README.md`, `AGENTS.md`, `package.json` | Operating guidance and checks | Runtime documentation and focused test integration |

## Dependency View

Server composition depends on Stage 1’s application service and explicit configuration.

Post rendering depends on the complete records returned by `getPost` and the graphic-reference convention used by Stage 2 preparation.

The layout depends on presentation data rather than Astro collection types.

Post and media routes consume these responsibilities. The homepage consumes `listPosts` and the existing visitor URL builder.

Stage 2’s populated baseline must exist before public discovery switches. After the switch, the registry is the sole authority for published-post membership.

## Change Plan

### 1. Configure the server-side persistence service

Introduce server-only composition that loads configuration and constructs the filesystem-backed application service.

Runtime configuration references the existing persistence and publication configurations rather than duplicating storage-root or visitor-origin values.

Put all configurable runtime values in configuration files, including the listing batch size. Application and test settings remain independent, with no hardcoded fallback defaults.

Validate configuration within the module responsible for loading it. Reject missing or invalid required values.

CLI and Astro must select the same storage root for local publication verification. Configuration paths resolve according to the established configuration-file rules.

Service instances may be reused, but operations must read current committed state. Do not retain a startup-only catalogue snapshot.

Keep filesystem access and storage configuration out of browser bundles.

### 2. Implement stored-body rendering

Use `getPost` results to reconstruct the complete body by concatenating Content records in their returned order.

Preserve text exactly during reconstruction. Resolve graphic references only after reconstruction because chunk boundaries may occur inside tags or attributes.

For each explicit graphic reference:

- Resolve its symbolic identifier through the Post’s media map.
- Associate it with the owning Post and Media UUID.
- Generate an application media URL.
- Preserve captions, alternative text, styles, and other presentation attributes.

Perform substitutions in the rendered representation only. Do not rewrite stored Content or Media records.

Use the convention established by Stages 1 and 2. Missing or inconsistent mappings are integrity failures, not an invitation to fall back to legacy image paths.

Render the publication-ready HTML produced during preparation. Do not execute stored MDX or require client-side JavaScript to supply essential post content.

Preserve the prepared executable-artifact framing and sandbox behavior without adding another copy of the artifact to the page.

### 3. Adapt the post layout

Replace the `CollectionEntry<'blog'>` dependency in `PostLayout.astro` with explicit persistence-backed presentation inputs.

Map:

| Persistence value | Presentation |
| --- | --- |
| Metadata `title` | Page title and post heading |
| Metadata `summary` | Page description and displayed summary |
| Metadata `created_at` | Displayed post date |
| Reconstructed, resolved body | Post body content |

Preserve the existing page structure and styling.

Registry timestamps determine listing order only. Do not substitute them for the displayed Metadata date.

Remove the layout’s dependency on legacy `post.data.artifact` for migrated posts. Stage 2’s prepared presentation carries the demonstration forward through the established artifact boundary.

### 4. Add the media endpoint

Introduce `/media/<post_id>/<media_id>` as the application endpoint for stored image bytes.

The endpoint must:

1. Check request identifiers.
2. Resolve the Post through committed Registry membership.
3. Confirm the requested Media belongs to that Post and is referenced by its media map.
4. Return exact stored bytes with the recorded MIME type.

Initially reuse `getPost` rather than introducing another public persistence operation.

Return:

- HTTP 400 for malformed identifiers.
- HTTP 404 for unknown/unregistered posts or media not belonging to the requested post.
- HTTP 500 for missing or corrupt records that a registered post references, or storage I/O failures.

Complete lookup and integrity checks before returning a successful response. Do not expose filesystem paths, partial bytes, or internal error details to visitors.

### 5. Replace prerendered post lookup

Replace `src/pages/blog/[...slug].astro` with `src/pages/blog/[postId].astro`.

Remove public-route use of:

- `prerender = true`
- `getStaticPaths`
- Static collection props
- `astro:content` rendering

Resolve the requested Post UUID through `getPost` at request time, prepare its rendered body, and supply the layout with Metadata and content.

Apply the same explicit HTTP distinction between malformed identifiers, unknown posts, and storage/integrity failures.

Complete retrieval and preparation before producing a successful post response. Never render a partial post with HTTP 200.

Retain the existing server output and Node adapter configuration unless implementation reveals a necessary adjustment.

### 6. Switch homepage discovery

Replace static collection discovery with `listPosts`.

Use the configured batch size and follow older-than cursors until an empty page, preserving the existing homepage behavior of displaying all published posts.

Maintain the order returned by the service:

- Registry timestamp descending.
- Newest posts first.
- No secondary ordering.
- No sorting by Metadata dates.

Construct visitor links from returned Post IDs through the shared Stage 2 URL builder. Display titles, summaries, and Metadata dates without retrieving post bodies or media.

Each homepage request starts without a cursor so refresh discovers newly published posts.

Provide a normal empty state for an empty catalogue. A storage failure must produce an explicit error response rather than being presented as an empty catalogue.

Avoid response caching that could hide newly committed posts.

### 7. Retire static discovery from the public flow

Retain authored source documents, source images, and preparation tooling.

Public homepage and post routes must not fall back to the static collection when persistence returns no result or an error.

Do not ingest source files during server startup or requests. Publication remains an explicit CLI operation.

Preserve independently served executable artifacts under `public/artifacts/`.

Legacy slug redirects are outside this stage. Visitor links use Post UUIDs.

### 8. Add runtime tests and update guidance

Add focused rendering and HTTP integration tests using independent test configuration and isolated storage roots.

Reuse the publication CLI when verifying that newly committed posts become visible to an already-running server.

Add the focused test command to `npm run quality` while preserving earlier-stage checks.

Update README and AGENTS to explain:

- Shared CLI/Astro storage selection.
- Explicit runtime configuration.
- Request-time post and media lookup.
- Latest-first Registry ordering and first-page refresh.
- Generated visitor URLs and configured origin.
- Error responses and empty-catalogue behavior.
- Retained source files and explicit ingestion.
- The local-only scope of this implementation.

Keep tracked-baseline checks read-only in this stage. Automated mutation and exact restoration of that root belong to Stage 4.

## Integration Validation

| Area | Required evidence |
| --- | --- |
| Configuration | Independent runtime test settings work; missing settings fail without hidden defaults |
| Homepage discovery | Only registered posts appear, using catalogue/metadata reads without loading bodies or media |
| Ordering | Posts appear by Registry timestamp descending, even when Metadata dates imply a different order |
| Pagination | A small configured batch size exercises multiple older-than pages without omissions or duplicates |
| Empty catalogue | The homepage displays a valid empty state |
| Storage failure | A failed catalogue read produces an error, not a misleading empty state |
| Post rendering | Complete text, whitespace, embedded styles, captions, and alternative text survive reconstruction and rendering |
| Chunk boundaries | Text split inside tags or graphic references renders correctly after full reconstruction |
| Media | Responses contain exact bytes and recorded MIME types |
| Ownership | Another post’s Media UUID cannot be retrieved through the requested Post |
| HTTP errors | Malformed IDs, unknown IDs, corrupt registered records, and I/O failures receive the specified responses |
| Fresh publication | Publish through the CLI while the same server runs; a fresh homepage request exposes the link and the post/media routes return complete content |
| URL construction | Homepage and CLI use the same Post UUID route and configured visitor origin |
| Artifact preservation | The baseline demonstration retains its prepared framing and sandbox attributes |
| Static-flow removal | Public routes no longer enumerate or render static collection entries |
| Baseline preservation | Runtime inspection leaves the tracked baseline unchanged |

Use controlled, well-separated timestamps for test fixtures.

Run focused tests and `npm run quality`. Actual browser navigation, image loading, and shared-root lifecycle coverage are completed in Stage 4.

## Risks

- **Residual static behavior:** Route-level prerendering or collection fallback could conceal missing runtime integration. Remove both from public post resolution.
- **Presentation changes:** Rewriting the entire body unnecessarily could alter styles or markup. Restrict rendering transformations to agreed references.
- **Duplicate artifact presentation:** Both prepared content and the old layout could render the demonstration. Keep one presentation path.
- **Origin mismatch:** A configured visitor origin may differ from the running server. Tests supply the actual origin explicitly; documentation explains how local operators align them.
- **Production assumptions:** The existing production image does not include the local store in its runtime stage. Local runtime validation does not establish production deployment readiness.

## Implementation Handoff

Requires Stages 1 and 2 to be implemented and validated.

This stage is complete when:

- Public discovery uses only the persisted registry.
- Posts and media resolve at request time through the application service.
- Homepage ordering follows the approved latest-first contract.
- A CLI publication becomes accessible on the already-running server.
- Existing post and artifact presentation is preserved.
- Runtime tests use independent configuration.
- README and AGENTS reflect the implemented flow.
- `npm run quality` passes.

The next stage adds browser E2E against the tracked root, guaranteed storage restoration, and final milestone verification.
