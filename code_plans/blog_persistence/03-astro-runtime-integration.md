# Stage 3: Blog posts, catalogue navigation, and Playground

## Task

Connect Astro to the persistence service and the two blog posts already published in `local_database`.

Establish these public routes:

| Route | Responsibility |
| --- | --- |
| `/` | Homepage containing the first catalogue page and links to Playground |
| `/blog-post/<post-id>` | A complete persistence-backed blog post |
| `/blog-post-catalogue/` | First catalogue page |
| `/blog-post-catalogue/?next_page=<timestamp>` | A subsequent catalogue page |
| `/playground/<demo-app-name>` | A static page containing an interactive, sandboxed demo application |
| `/media/<post-id>/<media-id>` | An image belonging to a registered blog post |

Use **blog posts** for persistence-backed articles. Remove static blog-post serving.

Use **Playground** for pages whose primary purpose is interaction with a demo application. Their descriptions, graphics, sandbox presentation, and application code remain static and packaged with the site, outside blog persistence.

A newly published blog post must appear on homepage or first-catalogue-page refresh without rebuilding or restarting Astro.

Include the existing published baseline in the deployable image for E2E against pre-existing posts.

This stage excludes remote deployment, production database integration, publication UI, persistence-model changes, and legacy URL redirects. Browser E2E and shared-root restoration remain Stage 4 responsibilities.

All paths below are relative to the repository root. New locations are proposed.

## Affected Area

| Artifact | Planned responsibility |
| --- | --- |
| `src/lib/publication/visitor-url.ts` | Change the blog-post route pattern to `/blog-post/<post-id>` |
| `src/lib/server/persistence.ts` | Compose runtime configuration, adapter, and application service |
| `src/lib/server/post-rendering.ts` | Reconstruct stored bodies and resolve graphic references |
| `src/lib/server/catalogue.ts` | Load one catalogue page, validate cursor navigation, and construct navigation links |
| `config/astro-runtime.json` | Explicit runtime settings and configuration references |
| `tests/config/astro-runtime.json` | Independent runtime test settings |
| `src/content.config.ts` | Define Playground content separately from blog persistence |
| `src/content/playground/` | Static Playground descriptions and demo metadata |
| `src/content/blog/` | Retained migration sources, excluded from public static discovery |
| `src/layouts/PostLayout.astro` | Present persistence-backed blog posts |
| `src/layouts/PlaygroundLayout.astro` | Present static descriptions and sandboxed demo applications |
| `src/components/ArtifactSandbox.astro` | Preserve the existing sandbox integration |
| `src/pages/index.astro` | Load the first catalogue page and expose Playground links |
| `src/pages/blog-post-catalogue/index.astro` | Render one catalogue page and its navigation |
| `src/pages/blog-post/[postId].astro` | Retrieve a blog post at request time |
| `src/pages/playground/[demoAppName].astro` | Prerender Playground pages |
| `src/pages/media/[postId]/[mediaId].ts` | Serve stored image bytes |
| `src/pages/blog/[...slug].astro` | Remove the old static blog route |
| `src/layouts/BaseLayout.astro` and navigation components | Expose the agreed Blog and Playground destinations |
| `public/artifacts/` | Retain independently served demo applications and assets |
| `Dockerfile`, `.dockerignore` | Package the baseline and runtime configuration; exclude preparation manifests |
| `tests/runtime/` | Rendering, catalogue-navigation, and HTTP tests |
| `README.md`, `AGENTS.md`, `package.json` | Operating guidance and focused quality checks |

Validation belongs to the responsible modules. Do not introduce an independent validation module.

## Dependency View

Runtime composition depends on the existing persistence service and explicit configuration.

Catalogue navigation depends on `listPosts` and the agreed timestamp-cursor contract. Post rendering depends on `getPost` and the existing graphic-reference convention.

Page routes consume these responsibilities. The homepage and catalogue page share listing and navigation behavior.

Playground has its own static collection and layout. It depends on the existing sandbox component, not on persistence.

Image packaging follows runtime integration so the final image contains the files that the runtime actually needs.

## Change Plan

### 1. Establish configuration and URL conventions

Update the shared visitor URL builder to use `/blog-post/<post-id>`. Keep route patterns in named constants and reuse the builder in CLI output and page links.

Define catalogue and Playground URL construction in their owning modules. Use URL APIs to encode query values correctly.

Introduce explicit runtime configuration that references the existing persistence and publication configuration files.

Define the catalogue page size in configuration. The homepage and catalogue route use the same page size so forward and backward navigation retain consistent boundaries.

Application and test settings remain independently configurable across all settings. No hardcoded configuration fallbacks.

Resolve configuration references relative to their containing files. Validate required settings in their owning modules.

**Validation:** URL generation, configuration-relative paths, independent test settings, and missing or invalid settings.

### 2. Separate Playground content from blog posts

Introduce a Playground collection and move the existing executable demonstration’s description and metadata into it.

Use `counter-demo` as the existing demonstration’s application name, producing `/playground/counter-demo`.

The Playground entry describes the page and references the independently packaged demo application. Keep application code and assets under their existing static location.

Preserve the description, configured frame height, sandbox permissions, and supporting presentation.

Stop discovering blog posts through the Astro static collection. Retain the two migrated ordinary source documents as migration sources without generating public routes from them.

Required Playground metadata must be explicit; do not introduce hidden defaults.

**Validation:** The demonstration belongs to the Playground collection; ordinary blog sources do not appear in static public discovery.

### 3. Compose the server-side persistence service

Create server-only composition that loads configuration and constructs the filesystem-backed application service.

CLI and Astro must use the same selected storage root for publication verification.

Service instances may be reused, but operations must read current committed state. Do not retain a startup-only catalogue snapshot.

Keep filesystem access and storage configuration out of browser bundles.

**Validation:** Shared storage selection, fresh reads, and server-only dependencies.

### 4. Implement catalogue pagination and URL state

Render one configured batch per request. Do not fetch the entire catalogue.

The homepage always calls `listPosts` without a cursor. Query parameters on the homepage do not change its catalogue page.

The catalogue route uses these parameters:

| Parameter | Meaning |
| --- | --- |
| `next_page` | The cursor passed to `listPosts` for the requested page |
| `prev_page` | A repeatable history of earlier page-start cursors, in traversal order |

Examples:

| URL | Requested page |
| --- | --- |
| `/blog-post-catalogue/` | First page, no cursor |
| `/blog-post-catalogue/?next_page=A` | Second page, using cursor A |
| `/blog-post-catalogue/?next_page=B&prev_page=A` | Third page, using cursor B |
| `/blog-post-catalogue/?next_page=C&prev_page=A&prev_page=B` | Fourth page, using cursor C |

Here A, B, and C represent actual Registry timestamps encountered while navigating toward older posts.

#### Older posts

Use the current result’s `next_cursor` as the destination’s `next_page`.

When leaving a page that already has a `next_page`, append that current cursor to the destination’s `prev_page` history.

The first page is represented by the absence of a cursor, so it adds no history entry.

Because the persistence contract returns a cursor even for the last populated page, probe with `listPosts(1, next_cursor)` before displaying **Older posts**.

This probe reads catalogue and metadata only. Do not change the persistence API or load post bodies.

#### Newer posts

When history is present, promote its last `prev_page` value to the destination’s `next_page` and remove that value from the history.

When the current page has a cursor but no history, link to `/blog-post-catalogue/`.

The first page has no **Newer posts** link.

#### Navigation behavior

Use ordinary server-rendered links. The URL preserves navigation state across refreshes, bookmarks, shared links, and browser Back/Forward. No browser-local state store is required.

The homepage’s **Older posts** link enters the catalogue route using its returned cursor. Provide a link to the first catalogue page independently of whether older posts exist.

Validate cursor values using the established ISO UTC timestamp format with milliseconds. Reject malformed values, multiple `next_page` values, history without a current cursor, and history that is not strictly descending toward the current cursor.

Treat history as navigation input, not evidence that the visitor previously visited those pages.

An empty result for a valid later-page URL is a normal empty page. Preserve navigation toward newer posts.

Every request to the first page reads the latest catalogue. Pagination is not a frozen snapshot; returning to the first page can reveal newly published posts.

**Validation:** Forward navigation, repeated backward navigation, URL reloads, direct links, invalid input, final-page probing, and empty-page recovery.

### 5. Implement stored-body rendering

Reconstruct each body in the Post’s authoritative `content_ids` order, preserving text exactly.

Resolve graphic references only after reconstruction because chunk boundaries may split tags or references.

For each reference:

- Resolve the symbolic identifier through the Post’s media map.
- Associate it with the owning Post and Media UUID.
- Construct an application media URL.
- Preserve surrounding markup, captions, alternative text, and styles.

Modify only the rendered representation. Do not rewrite stored Content or Media records.

Missing or inconsistent mappings are integrity failures. Do not fall back to legacy image paths.

Render publication-ready HTML. Do not execute stored MDX or add executable-demo presentation to blog posts.

**Validation:** Exact reconstruction, references spanning chunks, complete image mappings, and unchanged stored records.

### 6. Establish the two presentation layouts

Adapt `PostLayout.astro` to accept persistence-backed presentation inputs.

| Persistence value | Presentation |
| --- | --- |
| Metadata `title` | Page title and heading |
| Metadata `summary` | Page description and displayed summary |
| Metadata `created_at` | Displayed publication date |
| Reconstructed body | Post content |

Preserve existing blog-post structure and styling. Registry timestamps determine catalogue order, not the displayed publication date.

Move the static description-and-demo presentation responsibility into `PlaygroundLayout.astro`. Retain `ArtifactSandbox.astro` as its integration boundary.

Playground pages must not depend on Post, Content, Media, Metadata, or Registry records.

**Validation:** Blog-post presentation and independent Playground description, framing, and sandbox attributes.

### 7. Introduce routes and navigation

Implement request-time routes for blog posts, the catalogue, and stored media.

For blog-post and media requests:

- Return HTTP 400 for malformed identifiers.
- Return HTTP 404 for unknown posts or media not belonging to the requested post.
- Return HTTP 500 for corrupt or missing referenced records and storage I/O failures.
- Complete retrieval and validation before returning success.
- Keep internal filesystem paths and error details out of visitor responses.

The media endpoint initially reuses `getPost`, verifies ownership and membership, and returns exact bytes with the recorded MIME type.

Prerender Playground pages through their separate static collection.

Remove the old `/blog/` route. Do not create redirects or continue serving migrated static blog posts.

Update homepage and shared navigation:

- Link blog-post cards to `/blog-post/<post-id>`.
- Link the catalogue destination to `/blog-post-catalogue/`.
- Identify interactive content as **Playground**.
- Link the existing demo to `/playground/counter-demo`.

Maintain catalogue order exactly as returned by the service: Registry timestamp descending, without secondary ordering or Metadata-date sorting.

An empty catalogue receives a normal empty state. A failed storage read receives an explicit error response.

Avoid caching that hides freshly committed posts. Do not ingest sources during startup or requests.

**Validation:** All new destinations, removal of old static routes, HTTP errors, and fresh publication visibility.

### 8. Package the published baseline

Include the existing `local_database` catalogue, records, and binary media in the final deployable image.

Include required runtime configuration with working path references, plus compiled Playground pages and their static application assets.

Do not regenerate manifests, assign new identities, or publish posts during image build or startup.

Keep `blogpost_manifests/` ignored by Git and excluded from the Docker build context. Runtime pages must work without that directory.

Preserve baseline identities, Registry timestamps, content, and media bytes. Keep baseline data eligible for version control.

Build and run the image locally. Verify the catalogue, both blog posts, their images, and the Playground demonstration without mounting the host repository.

This does not perform remote deployment or establish a production database adapter.

**Validation:** Image contents and local container HTTP checks, independently of host development checks.

### 9. Integrate tests and documentation

Use independent test configuration and isolated storage roots for tests that publish data. Use small page sizes to exercise pagination.

Publish through the CLI while the same server remains running, then verify visibility from the homepage and first catalogue page.

Keep checks against the repository baseline read-only. Shared-root mutation and restoration remain Stage 4 responsibilities.

Add focused runtime tests to `npm run quality`, retaining existing checks.

Update requirements and operating documentation to reflect:

- Blog-post and Playground terminology.
- New routes and retirement of static blog-post serving.
- Catalogue query parameters and navigation semantics.
- Configuration selection and path resolution.
- Publication visibility without restart.
- Ignored preparation manifests and the repository-owned baseline.
- Image packaging and local container verification.
- The distinction between filesystem persistence and a future production database.

Reconcile the Stage 4 plan with the new routes and Playground boundary through its own review.

## Integration Validation

| Area | Required evidence |
| --- | --- |
| Configuration | Independent settings work; missing required values fail |
| Homepage | Always requests the first batch without a cursor |
| Catalogue reads | Loads one batch plus the optional one-item probe; never loads bodies or images |
| Ordering | Registry timestamps alone determine newest-first ordering |
| Forward navigation | Older-post links use the returned cursor and preserve history |
| Backward navigation | Newer-post links unwind history through multiple pages |
| URL persistence | Reloading or sharing a catalogue URL reproduces its requested position |
| Input handling | Malformed, duplicated, or inconsistent cursor parameters fail explicitly |
| Final page | No Older-post link appears when the probe finds no further posts |
| Empty page | A valid empty result retains navigation toward newer posts |
| Post rendering | Complete text, whitespace, styles, captions, and alternative text are preserved |
| Media | Responses match stored bytes and MIME types; ownership is enforced |
| HTTP errors | Invalid IDs, unknown records, corruption, and I/O failures receive the specified responses |
| Fresh publication | Homepage and first catalogue page reveal newly published posts without restart |
| Playground | Counter demo is served at its Playground route with existing sandbox behavior and no persistence records |
| Static blog removal | Old static blog routes no longer serve migrated posts |
| Packaging | The image serves the baseline and Playground without host mounts or manifests |
| Preservation | Validation does not modify baseline data or retained authoring sources |

Use controlled, well-separated Registry timestamps in fixtures.

Run focused tests and `npm run quality`. Verify local container behavior separately.

Browser interaction, actual image loading, demo-counter interaction, and shared-root restoration are completed in Stage 4.

## Risks

- **Cursor semantics:** Despite its name, `next_page` selects the current request’s page. Document and test this consistently.
- **Cursor history growth:** Each forward step adds a timestamp to the URL. This is accepted for the initial blog catalogue.
- **Fresh first-page reads:** Returning to the first page can show newly published posts; no snapshot guarantee is provided.
- **Residual static serving:** Retained source files must not remain publicly routed as blog posts.
- **Presentation changes:** Restrict body transformations to graphic-reference resolution.
- **Packaging omissions:** Verify configuration and baseline availability inside the running image.

## Implementation Handoff

Start with configuration and URL conventions, then implement catalogue behavior and content separation before changing public routes.

This stage is complete when:

- Blog posts are served exclusively through persistence.
- Playground pages remain static and independent of blog models.
- The agreed routes and navigation are implemented.
- Catalogue forward and backward navigation survive refresh and direct linking.
- New publications appear without rebuild or restart.
- Both existing posts and their images are available in the deployable image.
- Baseline records and retained ordinary authoring sources remain unchanged.
- Documentation and tests reflect the revised requirements.
- Focused checks, `npm run quality`, and local container verification pass.

Stage 4 adds browser E2E and shared-root restoration.
