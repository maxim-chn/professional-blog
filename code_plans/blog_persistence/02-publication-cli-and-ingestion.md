# Stage 2: Publication CLI and repeatable ingestion

## Task

Provide explicit commands for publishing complete local posts through the Stage 1 application service.

Provide a one-time ingestion path for existing ordinary blog posts and their media. Preserve reusable identities so repeated publication and ingestion skip identical posts.

Populate the tracked `local_database` baseline for subsequent Astro integration and browser E2E.

This stage excludes executable-post ingestion, public-route changes, automatic startup/request ingestion, updates to published posts, production databases, and remote deployment. Posts containing executables, their sandbox presentation, and executable code remain on the existing static, container-packaged path.

All paths below are relative to the repository root. New file locations are proposed.

## Affected Area

| Artifact | Responsibility |
| --- | --- |
| `src/lib/persistence/` | Stage 1 models, configuration, application service, and adapter |
| `src/lib/publication/manifest.ts` | Publication manifest loading and input-file resolution |
| `src/lib/publication/preparation.ts` | Complete model-bundle preparation and stable identity assignment |
| `src/lib/publication/legacy-ingestion.ts` | Existing source and metadata conversion |
| `src/lib/publication/visitor-url.ts` | Visitor URL construction |
| `scripts/publish-post.ts` | Publication CLI entry point |
| `scripts/ingest-posts.ts` | Explicit legacy ingestion entry point |
| `config/publication.json` | Application publication settings |
| `tests/config/publication.json` | Independent publication test settings |
| `blog_persistence/manifests/` | Reusable publication manifests and prepared inputs |
| `src/content/blog/` | Retained authored sources |
| `public/artifacts/blog/graphics/` | Retained source images |
| `src/components/ArtifactSandbox.astro` | Retained unchanged for static executable posts |
| `local_database/` | Tracked records, catalogue, and binary media |
| `tests/publication/` | Preparation, CLI, and ingestion tests |
| `package.json`, `README.md`, `AGENTS.md` | Commands, quality integration, and operating instructions |

Validation stays within the responsible modules and their artifacts. This stage introduces no independent validation module.

## Dependency View

Publication preparation depends on Stage 1 models, configuration, and the agreed graphic-reference convention.

The publication CLI depends on prepared inputs and the application `createPost` operation. It does not write storage records directly.

Legacy ingestion excludes executable posts before preparing publication inputs. It converts ordinary authored posts and uses the same publication path.

The tracked baseline is produced through that path. Stage 3 consumes the resulting catalogue and reuses visitor URL construction.

## Change Plan

### 1. Define publication configuration

Document all configurable publication settings and their values in configuration files. Do not introduce hardcoded fallback values.

Application and test configurations are independent across all supported settings. Publication configuration references the applicable persistence configuration instead of duplicating its settings.

Include the visitor origin and any configurable source/output locations. Define path resolution relative to the containing configuration file.

Tests explicitly supply temporary storage and preparation locations. Missing or invalid required settings fail clearly.

Command-line overrides, where supported, take precedence over file values and must be documented. They must not establish hidden defaults.

### 2. Define reusable publication manifests

A manifest identifies the Post, Metadata, ordered Content records, Media records, and their input files.

Define:

- The required fields and file formats.
- How content order is represented.
- How symbolic graphic references map to Media UUIDs and MIME types.
- How binary media files are referenced.
- How paths resolve relative to the manifest.

Application preparation generates UUID v4 identifiers once and records them before publication. Repeated invocations reuse those identifiers.

Prepared content and chunk boundaries must also remain stable across retries. Publishing an existing manifest must not silently regenerate IDs or split its content differently.

Manifests are reusable author inputs, not deferred-publication or resumption records.

### 3. Implement complete publication preparation

Load text and binary inputs and construct the Stage 1 model records.

Preparation owns input-file checks and transformation correctness. Model constraints remain in their model modules; cross-record consistency remains in the application service.

When preparing an unsplit body:

- Split by Unicode code points using the selected persistence configuration.
- Preserve every character and its order.
- Verify that concatenating the prepared chunks reproduces the prepared body exactly.
- Record generated Content identities and ordering in the reusable inputs.

Read image files as binary bytes and calculate checksums for new Media records. Use the Stage 1 Media model’s format and checksum checks.

Consume the graphic-reference convention established in Stage 1. Do not introduce a competing convention or infer references from arbitrary UUID-like prose.

### 4. Add visitor URL construction and the publication CLI

Construct visitor URLs from the configured origin and Post UUID using `/blog/<post_id>/`. Persist neither URLs nor slugs.

Expose a documented repository publication command accepting a manifest and configuration selection, with explicit overrides where supported.

The CLI must:

1. Load configuration and manifest inputs.
2. Construct the complete model bundle.
3. Call the shared application `createPost` operation.
4. Print its structured result and the configured visitor URL.

Creation and identical duplicate skips exit successfully. Invalid input, identity conflicts, and persistence failures exit nonzero with useful error context.

The CLI must not claim the server is running or the URL was visited. The UUID route becomes available in Stage 3.

### 5. Implement explicit legacy ingestion

Ingest the two existing ordinary blog posts:

- `reading_design_patterns_with_some_code_behind_you.md`
- `an_upgrade_to_version_controlled_financial_research.md`

Retain the original files and image sources unchanged.

Exclude `artifact-boundary.mdx` and other posts with executable-artifact metadata before generating identities, manifests, prepared content, or persistence records. Report their exclusion explicitly. Do not render their sandbox presentation into stored content.

Translate legacy metadata explicitly:

| Legacy field | Persistence treatment |
| --- | --- |
| `title` | Metadata `title` |
| `description` | Metadata `summary` |
| `publishDate` | Metadata `created_at` |
| `draft` | Controls ingestion eligibility; no persisted draft field |
| `artifact` | Identifies an executable post excluded from persistence ingestion; retain the whole post on the static path |

For existing date-only `publishDate` values, use midnight UTC as a documented migration convention. Do not replace historical dates with ingestion time.

Registry timestamps remain assigned by the application service when it constructs each association. They are independent of historical Metadata dates.

### 6. Preserve ordinary post bodies and images

Prepare publication-ready HTML for the two ordinary blog posts.

For the two illustrated posts:

- Preserve body text, embedded styles, captions, alternative text, and presentation.
- Replace legacy image source references only as required by the shared graphic convention.
- Map those references to application-generated Media UUIDs.
- Preserve image bytes exactly.

Keep `artifact-boundary.mdx`, `ArtifactSandbox.astro`, and the counter executable under `public/artifacts/` unchanged. Their content, sandbox markup, and executable code do not enter the persistence store.

Record the prepared inputs and identities for repeatable ingestion. Verify intentional source-to-prepared transformations separately from exact prepared-to-stored reconstruction.

### 7. Populate the tracked baseline

Use the shared publication path to ingest the two ordinary blog posts into the application-configured `local_database` root.

Include complete records and binary media for both illustrated posts. The artifact demonstration has no manifest, prepared inputs, or records in this baseline.

Retain generated identities, prepared inputs, and committed Registry timestamps. Repeated ingestion must report identical skips without changing stored records.

If an input changes under an existing identity, report a conflict. Do not silently overwrite the post or generate new identities to avoid the conflict.

Keep baseline files and reusable manifests under version control. Do not add ignore rules for the storage root.

Publication remains sequential. Tests use controlled, well-separated timestamps; introduce no timestamp collision mechanism.

### 8. Add tests and operating documentation

Use independent test configuration and isolated roots for publication, ingestion, and failure tests.

Add a focused test command to `npm run quality` while preserving Stage 1 tests and existing checks.

Document:

- Exact commands, flags, manifest fields, and invocation examples.
- Configuration selection, precedence, and path resolution.
- Preparation versus publication responsibilities.
- Stable identities and duplicate/conflict behavior.
- Legacy metadata and body conversion.
- Exclusion of executable posts and their separate static, container-packaged lifecycle.
- Baseline ownership and storage location.
- Visitor URL construction and the pending Stage 3 route integration.

Normal quality runs must not regenerate or rewrite the tracked baseline. Shared-root browser mutation and restoration belong to Stage 4.

## Integration Validation

| Area | Required evidence |
| --- | --- |
| Configuration | Application and tests use independent settings; missing values fail without fallback defaults |
| Preparation | Small configured chunk limits are enforced; exact reconstruction includes whitespace and non-BMP characters |
| Identity stability | Repeated preparation/publication reuses recorded IDs and chunk ordering |
| CLI creation | A valid manifest creates a complete post and returns the expected structured result |
| CLI retry | Repeating the same manifest reports a duplicate and preserves all stored bytes and Registry timestamps |
| CLI failures | Invalid arguments, missing files, conflicting identities, invalid bundles, and I/O errors exit nonzero |
| Path resolution | Commands invoked from another working directory resolve configuration and manifest paths correctly |
| Visitor URLs | URLs use the configured origin and Post UUID without persisting either URL or slug |
| Metadata migration | Titles, summaries, and historical dates follow the documented mapping |
| Content migration | Prepared bodies preserve source text and presentation; retrieved bodies exactly match prepared bodies |
| Media migration | Retrieved image bytes and checksums match the source images |
| Executable-post exclusion | Ingestion reports the demonstration as excluded and creates no manifest, prepared inputs, or persistence records for it; its static source, component, and executable files remain unchanged |
| Repeatable ingestion | A second run skips identical entries without duplicating or modifying them |
| Baseline completeness | Both ordinary blog posts are retrievable with their complete stored media; the executable demonstration is absent from the persistence catalogue |
| Catalogue order | Listing follows Registry timestamps descending, independently of historical Metadata dates |
| Source preservation | Original authored documents and source assets remain unchanged |

Run focused tests and `npm run quality`. Browser rendering verification follows in the Astro and E2E stages.

## Risks

- **Unnecessary body transformations:** Broad HTML rewriting could alter existing presentation. Restrict changes to required conversion and graphic references.
- **Executable-post ingestion:** Treating executable posts as ordinary content would cross the static-program boundary. Exclude them before preparation and retain their existing static presentation and code.
- **Retry instability:** Regenerating identities or chunk boundaries would defeat duplicate detection. Reuse recorded prepared inputs.
- **Changed source content:** The initial model has no update operation. Changed publication inputs must produce a conflict rather than an implicit replacement.

## Implementation Handoff

Requires Stage 1 to be implemented and validated.

This stage is complete when:

- The publication CLI uses the shared application service.
- Configuration values reside in explicit application/test files.
- The two ordinary blog posts have reusable manifests and stable identities.
- Repeated ingestion skips identical posts.
- The tracked baseline contains the two complete illustrated posts.
- Executable posts remain outside persistence, with their static sources, sandbox presentation, and executable files unchanged.
- Source files remain intact.
- README and AGENTS describe the implemented workflow.
- `npm run quality` passes.

The next stage switches ordinary blog-post discovery and retrieval to the populated persistence store while preserving static executable-post discovery and routes.
