# Library implementation

This document describes the shared persistence responsibilities, publication flow, and Astro integration, followed by the current filesystem implementation. See the [project README](../../README.md) for the application overview.

## Module responsibilities

- `persistence/config.ts` loads explicit persistence settings.
- `persistence/contract.ts` defines the adapter interface, complete post bundle, and creation/listing results.
- `persistence/models/` defines one logical model per file and its record constraints.
- `persistence/service.ts` checks relationships across a complete post and assigns its Registry timestamp before calling the adapter.
- `publication/` prepares reusable inputs and publishes saved manifests.
- `server/` connects runtime configuration, catalogue navigation, post rendering, and HTTP responses.
- `utilities/` contains shared string, array, object, binary, and MIME helpers.

Storage adapters implement the shared contract. The current implementation is `persistence/filesystem.ts`.

## Configuration and construction

The runtime loads its selected Astro configuration, then the referenced publication configuration, then the referenced persistence configuration. Referenced paths resolve relative to the containing configuration file. All required settings are explicit; missing or invalid values fail.

Application and test configurations are independent. Tests can use different operational settings, including smaller content limits, while exercising the same enforcement mechanisms.

Construction connects a storage adapter to `PersistenceService`, using consistent persistence settings and an explicit application clock.

Currently, `createRuntimePersistence` constructs `FileSystemAdapter` and `PersistenceService`. The publication entry point constructs the same pair for its selected store. Each adapter operates only on its own store.

A future database adapter must implement the shared contract. Its configuration and construction will require integration work; the current factories explicitly construct the filesystem adapter.

## Persistence contract and models

`PersistenceAdapter` exposes three operations:

- `create(bundle, registry)` publishes a complete post and its Registry association.
- `listPosts(limit, cursor)` returns catalogue entries and a continuation cursor.
- `getPost(postId)` returns a complete post bundle.

`PostBundle` contains the Post, Metadata, Content records, and Media records. The Post identifies its ordered content and associated media. Metadata supplies presentation information. Registry associates a published Post with its Metadata and records the publication timestamp used for catalogue ordering.

`PersistenceService.createPost` checks the complete bundle and its relationships, assigns the Registry timestamp using the supplied clock, and calls the adapter. Listing and retrieval delegate to the adapter.

An identical publication retry returns `created: false, duplicate: true` and preserves the original Registry timestamp and stored data. Conflicting data under an existing identity raises `ID_CONFLICT`. Content order and exact payload bytes matter when comparing publications.

## Content, media, and retrieval

Content chunks preserve their text and are reconstructed in `content_ids` order without separators. Chunk boundaries may split HTML or graphic tokens. Text limits count Unicode code points.

The reserved `{{graphic:identifier}}` token resolves through the owning Post's media mapping. The runtime substitutes absolute media URLs in the rendered body without modifying stored text.

Supported binary formats are PNG, JPEG, GIF, and WebP. Checks compare signatures, allowed MIME types, and SHA-256 checksums. Signature checks are not full image decoding.

`listPosts` returns posts ordered solely by Registry timestamp descending, selecting entries strictly older than the supplied cursor. Listing requires only Registry and Metadata information, not post content or media. A nonempty result returns the final item's timestamp, even on the last populated page; the runtime probes for another item before displaying an Older link.

`getPost` returns the complete published bundle. Unknown posts produce `NOT_FOUND`; missing or corrupt data belonging to a registered post produces `STORAGE_INTEGRITY`. Other error codes include `INVALID_INPUT`, `ID_CONFLICT`, and `IO_FAILURE`.

HTTP routes translate errors to public responses without exposing internal paths.

## Preparing and publishing inputs

`preparePublication` creates a complete bundle with stable identifiers and chunks text according to the selected configuration. `savePreparedInputs` writes that bundle into a new directory with content files, media files, and a manifest. Reuse the saved inputs for retries rather than generating new identities.

The publication CLI loads the files referenced by a manifest, validates the bundle, publishes it through the persistence service, and prints the creation or duplicate result with its visitor URL.

Command-line paths resolve from the working directory; paths inside configurations and manifests resolve from their containing files.

Publication uses prepared inputs. Playground applications remain separate from persisted blog posts.

## Filesystem persistence

### Local configuration and publication

`config/persistence.json` selects `local_database` and defines content, title, summary, and media limits. `PERSISTENCE_ROOT` supplies an explicit absolute root override. Tests select independent configurations and temporary roots where appropriate.

The tracked `local_database` contains two complete posts and is included in the runtime image. Publication manifests and prepared inputs live separately under the ignored `blogpost_manifests/` directory.

Publish an existing prepared manifest from the repository root:

```sh
npm run publish:post -- \
  --config config/publication.json \
  --manifest blogpost_manifests/reading_design_patterns_with_some_code_behind_you/manifest.json
```

The CLI's optional `--root <directory>` argument explicitly overrides the filesystem storage root.

### Storage layout

Within the configured root:

- `catalogue.json` contains Registry associations and the Metadata projection used for listing.
- `records/<uuid>.json` stores typed Post, Metadata, Content, and Media envelopes. Media envelopes contain descriptors and checksums, not binary payloads.
- `media/<uuid>.bin` stores exact image bytes.
- Private `.stage-*` directories and `.catalogue-*` files support publication and are not publicly discoverable posts.

### Publication and committed visibility

The filesystem adapter supports one writer per root. Readers may remain active during publication.

Creation validates the complete bundle, stages records privately, installs them without overwriting existing files, and atomically replaces the catalogue last. Readers enter through the committed catalogue, so partial staged data is not a visible post.

A handled failure before commit preserves the prior catalogue and attempts to remove only that invocation's files. Cleanup failures are reported with the original error. Abrupt termination can leave invisible orphan files; the adapter does not provide automatic recovery or guarantee durability across power loss.

### Read implementation

`listPosts` reads only `catalogue.json`; it does not scan record or media files.

`getPost` resolves committed membership through the catalogue before reading and checking the complete records and media files.

Reads observe current committed storage without an application catalogue cache.

### E2E restoration

Shared-root tests capture the Git revision and initial storage bytes before mutation. Only the dedicated paths listed in `tests/config/e2e-baseline.json` are restored from Git, intentionally replacing edits to those baseline files.

Setup reconciles the selected baseline catalogue entries while preserving author entries, then captures the prepared snapshot used for teardown. Other files, including untracked author data, are protected by snapshots. Generated post data is cleaned only through paths recorded before publication.

Both successful and intentionally failing runs verify restoration. Recovery snapshots, journals, and logs remain outside storage under the configured test-output directories. Interrupted restoration can leave a lock; preserve recovery records and verify restoration before releasing it. Never substitute a blanket Git reset or clean operation.

See [Browser E2E](../../README.md#browser-e2e) for commands, serial execution requirements, and recovery guidance.
