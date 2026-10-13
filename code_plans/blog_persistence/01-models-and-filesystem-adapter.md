# Stage 1: Models and filesystem adapter

## Task

Implement the persistence models and these application-facing operations:

- `createPost(thePost, postMetadata, postContents, postMedia)`
- `listPosts(limit, cursor)`
- `getPost(postId)`

Deliver a tested application service backed by a filesystem adapter. Later stages add publication commands, ingestion, Astro integration, and browser E2E.

This stage excludes public-route changes, migration, production databases, deployment, concurrent writers, updates, deletes, revisions, drafts, and publication resumption.

All paths are relative to the repository root. New file locations are proposed.

The approved plan introduces these changes to the existing specifications:

- Listing returns newest Registry timestamps first, without secondary ordering.
- Pagination proceeds toward older posts.
- Application and tests have separate configuration files covering all configurable settings. Their values may differ to suit their execution contexts.
- For example, the application may configure a content limit of 1,024 Unicode code points while tests configure 10. Both exercise the same limit-enforcement mechanism.

## Affected Area

| Artifact | Responsibility |
| --- | --- |
| `src/lib/persistence/models/post.ts` | Post model and its field/relationship constraints |
| `src/lib/persistence/models/post-content.ts` | Content model and its payload constraints |
| `src/lib/persistence/models/post-media.ts` | Media model, binary format, and checksum constraints |
| `src/lib/persistence/models/post-metadata.ts` | Metadata model and its field constraints |
| `src/lib/persistence/models/post-registry.ts` | Registry model and association constraints |
| `src/lib/persistence/errors.ts` | Typed errors |
| `src/lib/persistence/contract.ts` | Storage interface and operation inputs/results |
| `src/lib/persistence/service.ts` | Application operations, bundle consistency, and Registry construction |
| `src/lib/persistence/filesystem.ts` | Physical storage, committed reads, and atomic catalogue publication |
| `src/lib/persistence/config.ts` | Configuration loading and required-value checks |
| `config/persistence.json` | Explicit application configuration values |
| `tests/config/persistence.json` | Independent test configuration values |
| `tests/persistence/` | Contract and failure-path tests |
| `package.json` | Focused test command and quality integration |
| `blog_persistence/requirements.md`, `blog_persistence/models.md` | Specifications updated to reflect approved requirement changes |
| `README.md`, `AGENTS.md` | Documentation of the completed persistence boundary |

There is no independent validation module.

## Dependency View

Implementation proceeds from configuration and individual models toward storage and application operations:

1. Configuration files supply explicit settings.
2. Model modules enforce constraints belonging to their records.
3. The storage interface defines the boundary using those models.
4. The filesystem adapter implements storage and validates physical representations.
5. The application service checks complete-bundle relationships and constructs Registry associations.
6. Tests exercise these responsibilities before CLI and Astro consumers adopt them.

Validation belongs to the responsible artifact. It is not a separate pipeline of validation functions.

The application owns identifiers and timestamps. The adapter owns physical storage and publication visibility. Every operation targets one configured store.

## Change Plan

### 1. Reconcile the specifications

Update `requirements.md` and `models.md` to reflect the approved decisions before implementation:

- Registry timestamp descending is the sole listing order.
- Remove the metadata-ID secondary ordering.
- Replace newer-than pagination with older-than pagination.
- Document first-page refresh as the way to discover new publications.
- Describe independent application and test configuration across all supported settings. Content limits—such as 1,024 code points for the application and 10 for tests—are one example of values that may differ.
- Preserve the assumption that publications occur at well-separated timestamps.

Keep unrelated requirements unchanged.

### 2. Introduce explicit application and test configuration

Place all supported persistence configuration options and their values in configuration files. Do not supply fallback values in application code.

Maintain independent application and test configurations covering all configurable settings. Document the available settings and their meanings in those files. Values may differ according to each environment’s needs.

For example, application configuration identifies `local_database` as its storage root and sets the content payload limit to 1,024 Unicode code points. Test configuration uses a smaller content limit, such as 10, while test setup supplies an isolated temporary root explicitly.

These differences do not introduce separate behavior: both environments use the same implementation with their supplied configuration.

Document path resolution relative to the configuration file. The caller’s working directory must not determine the storage location.

The configuration loader must reject missing or invalid required settings. It must not silently substitute application configuration when test configuration is incomplete.

Only operational settings are configurable. Structural model invariants, such as ownership and UUID requirements, remain model constraints.

### 3. Define individual models, results, and errors

Create one module per model under `src/lib/persistence/models/`.

Preserve:

- Application-generated UUID v4 identifiers.
- Binary bytes in logical Media `data`.
- Authoritative ordering in `Post.content_ids`.
- One-to-one Post/Metadata Registry associations.
- Separate Metadata and Registry timestamps.
- The specified successful creation and duplicate flags.

Each model module owns its applicable record-level checks. For example, Content checks its payload against the supplied configuration, while Media checks its binary format and checksum.

Define distinct errors for invalid input, ID conflict, not found, corrupt stored data, and filesystem I/O failure. Include identifying context without dumping body text or binary payloads.

### 4. Establish complete-bundle consistency

Within the application service, enforce relationships that require multiple records:

- Unique identities and matching ownership.
- Exactly the Content and Media records referenced by the Post.
- At least one Content record.
- Unique graphic identifiers and matching MIME map keys.
- Complete graphic-reference mappings.
- Valid empty media collections for posts without graphics.

Establish an explicit graphic-reference convention shared with later producers and renderers. Check references against the fully reconstructed body; do not search arbitrary prose for UUID-like strings.

Do not normalize, truncate, or rewrite text.

Keep logical duplicate comparison within the publication responsibility. Ignore map-key serialization order and supplied child-record order, but preserve `content_ids` order, logical values, and exact media bytes.

The adapter must also check stored representations on reads. Malformed stored records produce integrity errors rather than being treated as valid model instances.

### 5. Define filesystem representation

Store structured records as UTF-8 JSON and media bytes in UUID-associated binary files. Validate identifiers before deriving paths.

Maintain a dedicated catalogue containing Registry mappings and the Metadata projection needed by `listPosts`. This projection is a storage detail, not a new domain model.

Keep the configured application storage root eligible for Git tracking. The ingestion stage creates the committed baseline.

### 6. Implement committed reads

Implement reads before publication so the visibility boundary is established first.

For `listPosts`:

- Read only the catalogue and metadata.
- Do not load Post relationship arrays, Content, or Media.
- Do not discover posts by scanning post directories.
- Sort solely by Registry timestamp descending: newest first, oldest last.
- Require a positive integer limit.
- Accept the specified UTC millisecond timestamp cursor.
- An omitted/null cursor starts with the newest committed post.
- With a cursor, select records whose Registry timestamp is strictly older than the cursor.
- For every nonempty page, return the timestamp of its last item as `next_cursor`.
- For an empty page, preserve the supplied cursor, or return null for an empty initial listing.
- Discover newly published posts by restarting from the first page.

A valid cursor need not identify an existing record. Compare timestamp values, not arbitrary date strings. Pagination reads current committed state rather than a frozen snapshot.

For `getPost`:

- Resolve Registry membership before reading records.
- Return complete Metadata, Post, ordered Content, and Media with actual bytes.
- Distinguish unknown/unregistered posts from missing or corrupt registered records.
- Never return a successful partial result.

Every call must observe current committed storage, including through separately opened adapter instances.

### 7. Implement publication and atomic visibility

The application service constructs the Registry association and assigns its creation timestamp. Identical retries preserve the committed timestamp.

Do not introduce timestamp collision handling, synthetic timestamp increments, or secondary ordering. Publications are assumed to occur at well-separated times.

The adapter must:

1. Check the complete bundle and identity conflicts within its configured store.
2. Recognize identical committed bundles as successful no-ops.
3. Stage new records and binary data privately.
4. Place all referenced records and bytes before catalogue publication.
5. Atomically replace the catalogue on the same filesystem.
6. Return creation success only after commit.

A handled failure before commit must preserve the previous catalogue. Clean only files created by that invocation where possible; report cleanup failures without exposing incomplete content.

Files left by abrupt termination remain inaccessible through public reads. Introduce no recovery jobs, resumable publication state, or implicit overwrite behavior.

### 8. Add tests and repository guidance

Add a TypeScript-compatible persistence test command and include it in `npm run quality`. Preserve existing formatting, linting, Astro/type checking, and build checks.

Tests load their own configuration and use isolated temporary roots. Verify configurable behavior using values suited to focused tests. For example, a content limit of 10 allows tests to establish acceptance at the boundary and rejection above it without repeating those checks at the application’s configured value.

Update README and AGENTS with model ownership, embedded validation responsibilities, configuration files, storage behavior, pagination, the single-writer restriction, and verification commands.

State that public routes retain their existing content flow until the Astro integration stage.

## Integration Validation

| Area | Required evidence |
| --- | --- |
| Configuration | Application and test configurations load independently; missing/invalid settings fail without hardcoded fallbacks |
| Round trip | Save, list, retrieve, and reopen; preserve values, text, chunk boundaries, and media bytes |
| Content ordering | Shuffled input records return in `content_ids` order |
| Configured limit enforcement | With test limit 10, accept 10 code points and reject 11; include non-BMP characters and empty chunks. Verify that changing the supplied limit changes the enforced boundary. |
| Bundle consistency | Reject missing/extra children, duplicate IDs, ownership errors, invalid references, metadata violations, MIME mismatches, and bad checksums without publishing |
| Media-free posts | Save and retrieve a valid post without graphics |
| Retry behavior | Correct result flags; identical retries leave stored records and Registry timestamps unchanged |
| Conflicts | Changed values under existing identities produce typed errors without overwriting |
| Listing boundary | Instrument reads to prove no payload, relationship-array, or post-directory discovery reads |
| Pagination | Verify descending order, strict older-than boundaries, cursor preservation, invalid inputs, and independence from Metadata dates |
| New publications | A first-page refresh includes new posts; continuing from an older cursor proceeds toward older posts |
| Integrity | Distinguish unknown posts, corrupt registered records, and I/O failures |
| Failed publication | Inject pre-commit failures; partial posts remain invisible and prior posts remain readable |
| Store isolation | Separate roots remain unaware of each other |
| Freshness | Existing reader instances observe newly committed state |

Use controlled, well-separated Registry timestamps in fixtures.

Run the focused tests and `npm run quality`.

## Risks

- **Specification mismatch:** Existing documents describe ascending/newer-than pagination. Update both documents consistently before implementation.
- **Partial filesystem writes:** Atomic catalogue replacement provides visibility consistency, not a hardware/power-failure durability guarantee.
- **Graphic-reference ambiguity:** Establish the explicit convention before completing bundle checks and carry it into later stages.
- **MIME support:** Document supported formats and reject unsupported formats explicitly.
- **Abrupt termination:** Leftover files must remain invisible and must not be silently overwritten by later publication.

## Implementation Handoff

Start by reconciling the specifications, defining configuration files, and implementing individual model modules.

This stage is complete when:

- The specifications reflect the approved ordering and configuration changes.
- All three application operations satisfy their contracts.
- The adapter passes isolated round-trip, integrity, pagination, and failure tests.
- Tests use independent configuration.
- README and AGENTS describe the implemented boundary.
- `npm run quality` passes.

The next stage adds publication CLI commands, repeatable ingestion, and the tracked baseline.
