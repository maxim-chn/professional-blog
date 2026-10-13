# Stage 4: Browser E2E and quality integration

## Task

Add browser E2E coverage for the completed persistence, publication, and Astro integration.

Verify the tracked baseline through actual browser navigation. Then publish a new post through the CLI while the same Astro server remains running, refresh the homepage, and open the newly generated link.

After both successful and failed tests, restore designated E2E post data to its Git baseline. Restore all other storage data to its exact pre-run file set and contents, preserving pre-existing author changes.

Include these checks in `npm run quality` and finish repository documentation.

This stage excludes production deployment, production database integration, concurrent publication, and public delete or recovery operations.

All paths below are relative to the repository root. New file locations are proposed.

## Affected Area

| Artifact | Responsibility |
| --- | --- |
| `tests/support/storage-snapshot.ts` | Capture storage contents, restore protected data, and verify both restoration scopes |
| `tests/support/e2e-lifecycle.ts` | Coordinate snapshots, scoped Git restoration, server startup, fixture publication, and teardown |
| `tests/e2e/` | Browser navigation and live-publication scenarios |
| `tests/config/e2e.json` | Explicit E2E settings, dedicated post-data cleanup paths, and references to test runtime configuration |
| `tests/fixtures/publication/` | Reusable test publication inputs and expected results |
| `playwright.config.ts` | Browser-runner integration with explicit test configuration |
| `package.json` and dependency metadata | E2E commands, dependencies, and quality integration |
| `local_database/` | Tracked baseline and shared-root E2E target |
| `.gitignore` and relevant tool configuration | Generated test-output exclusions outside the storage root |
| `README.md`, `AGENTS.md` | Final operating instructions and required validation |
| `blog_persistence/requirements.md` | Reconcile the approved distinction between Git-restored E2E data and snapshot-restored author data |

The application operations and routes from Stages 1–3 remain the system under test. Tests must exercise those public entry points rather than introduce a separate publication path.

## Dependency View

Storage snapshot and restoration support comes first because subsequent tests mutate the tracked root.

Lifecycle orchestration depends on that support, explicit test configuration, the publication CLI, and the Astro runtime.

Browser scenarios depend on a populated baseline and the running server.

The canonical quality command depends on all earlier-stage tests and the new browser scenarios. Documentation describes the verified commands and behavior.

## Change Plan

### 1. Define independent E2E configuration

Store configurable E2E settings in test configuration files, without hardcoded fallback values.

Include:

- Runtime and publication configuration references.
- The tracked storage-root location.
- Explicit paths identifying dedicated E2E baseline post data and generated E2E post-data locations eligible for Git cleanup.
- Server host and port settings.
- Browser selection and execution settings.
- Timeouts.
- Fixture and expected-result locations.
- Snapshot, log, trace, and screenshot locations.

CLI publication and Astro must use the same selected root and visitor origin.

Use test settings appropriate to each scenario. Small configured limits remain suitable for exercising enforcement mechanisms. When reading the existing baseline, select settings compatible with those persisted records; do not rechunk or rewrite the baseline to accommodate test settings.

Keep test outputs and snapshots outside `local_database`.

### 2. Implement storage snapshots and scoped restoration

Before any shared-root mutation, capture:

- The complete file set.
- Exact contents of every file.
- Pre-existing modified and untracked files.
- The Git revision defining the dedicated E2E baseline and its explicitly designated paths.

Store the snapshot outside the root. Distinguish two restoration scopes: dedicated E2E post data uses the recorded Git baseline; all other storage data uses the pre-run snapshot.

Identify the tracked baseline files containing post data dedicated to E2E and expected to exist for every run. Restore those files from Git using path-scoped reset/restore operations, and use path-scoped Git clean only for generated post-data files within explicitly designated E2E locations. Never run repository-wide reset or clean. Test code, configuration, new test artifacts, and author-owned post data remain outside this cleanup scope, including when untracked.

Git is authoritative for the designated E2E data, so pre-run modifications to those designated files are discarded. Do not classify a whole shared storage directory as disposable merely because it also contains E2E posts.

A catalogue or cursor-state file shared by E2E and author posts belongs to snapshot restoration, not wholesale Git restoration. Capture the protected pre-run state after establishing the dedicated Git baseline if baseline preparation must reconcile shared catalogue entries. Preserve author entries and their values during that reconciliation.

Record which paths the test creates or changes. During teardown:

1. Stop test activity that could still write to the root.
2. Restore designated baseline post-data files from the recorded Git revision using scoped reset/restore operations.
3. Clean generated post-data files only within the explicitly designated E2E cleanup scope.
4. Remove other files created by this test invocation without removing pre-existing protected files.
5. Restore changed protected files to their exact prior bytes, including shared catalogue and cursor-state files.
6. Remove test-created staging files, temporary manifests, locks, and directories outside the Git cleanup scope through invocation-specific cleanup.
7. Compare designated baseline data against Git and all protected data against the applicable snapshot; verify the final file set contains no unintended additions or removals.

Report restoration failures with affected paths. Preserve the snapshot and recorded baseline information when restoration fails so they can support explicit recovery.

This is test-only lifecycle support, not a public persistence delete or recovery operation.

### 3. Verify restoration before using the tracked root

Exercise the snapshot and Git restoration lifecycle against isolated temporary roots and a temporary Git repository first.

Cover:

- Successful execution.
- An intentionally failed assertion after mutation.
- Pre-existing changes to designated E2E data, which must return to the Git baseline.
- Generated data in designated E2E cleanup locations, which must be cleaned.
- Pre-existing modified and untracked author data, which must survive unchanged.
- New test logic and configuration artifacts, which must remain outside Git cleanup.
- A shared catalogue containing both baseline and author entries.
- Failure during setup after the snapshot exists.
- Failure during restoration.

Verify restoration against the correct authority for each scope and verify failure reporting.

An original assertion failure must remain visible if cleanup also fails. A cleanup failure must make the overall run fail even when assertions pass.

Use a controlled child run or equivalent arrangement to test intentional failures without making an expected failure indistinguishable from a broken parent test.

Abrupt process termination may prevent teardown. Do not describe that case as successfully restored; document recovery using the retained snapshot and recorded Git baseline.

### 4. Add serial server and browser orchestration

Run one shared-root E2E lifecycle at a time, with no overlapping author publication.

Establish the designated E2E Git baseline before browser checks, applying the scoped restoration rules and preserving protected data.

Start a controlled local Astro server using the selected test configuration. Do not silently reuse an existing server whose storage root or configuration is unknown.

Verify readiness before browser navigation. Use the actual running origin consistently for browser access and CLI visitor URL generation.

Keep the same server running throughout baseline verification, new-post publication, homepage refresh, and post navigation. Do not rebuild or restart it between these steps.

Ensure teardown runs after setup failures, assertion failures, and normal completion. Shut down only processes owned by the test lifecycle.

### 5. Verify the tracked baseline through the browser

Open the homepage and verify that the baseline entries appear with UUID-based visitor links.

Click the links for both illustrated posts and verify:

- Expected title, summary, and complete body text.
- Captions and alternative text.
- Images finish loading successfully.
- Image responses use the expected application media routes.
- Returned image bytes and MIME types match the baseline media.

Verify the artifact demonstration’s framing and sandbox attributes, and exercise its counter to confirm the independent artifact still runs.

Use fixture expectations independent of the rendering implementation. Do not compare the page only against values extracted from that same page.

Verify latest-first Registry ordering. Metadata dates must not determine catalogue order.

### 6. Exercise live publication through the CLI

Before writing, confirm that all fixture identities are absent from the selected store and that preparation will not overwrite existing author inputs.

If a collision exists, fail before publication. Do not delete an existing author post or accept a duplicate as proof of creation. Any cleanup of dedicated generated E2E data must have occurred under the explicit setup scope, not as ad hoc collision resolution.

While the server remains running:

1. Invoke the real publication CLI with reusable fixture inputs.
2. Require `created: true` and `duplicate: false`.
3. Capture the reported visitor URL.
4. Refresh the homepage.
5. Confirm the new entry appears in Registry order.
6. Click its generated link.
7. Verify its complete text and loaded images.
8. Confirm navigation matches the CLI-reported visitor URL.
9. Repeat the CLI invocation and require an identical duplicate skip.
10. Verify the retry leaves stored records and Registry timestamp unchanged.

Use controlled, well-separated timestamps for fixtures where required by the established publication assumption. Introduce no collision-handling or synthetic timestamp-increment mechanism.

### 7. Cover errors and failing-run restoration

Verify malformed and unknown post/media requests receive the responses specified in Stage 3.

Keep destructive corruption and I/O-failure scenarios in isolated roots, using earlier-stage tests where they already provide coverage.

Run the shared-root lifecycle with an intentionally failed assertion after publication and verify that teardown restores both scopes correctly. The controlled failing run must report failure; its supervising test verifies that failure and restoration occurred as expected.

After both successful and intentionally failing execution:

- Compare designated E2E baseline files against the recorded Git revision.
- Compare protected files and their bytes against the applicable pre-run snapshot.
- Verify generated E2E data and invocation-created artifacts are absent.
- Confirm pre-existing author changes and unrelated test artifacts remain intact.
- Confirm a previously Git-clean root remains clean.

Explicit file-set and byte comparisons are the primary restoration checks. Git status is supplementary and must not substitute for checking untracked files or protected modifications. The entire root need not match its original snapshot when dedicated E2E data had pre-run changes: those changes are intentionally replaced by the Git baseline.

### 8. Integrate browser tests into the quality gate

Add a documented `test:e2e` command.

Make `npm run quality` actually execute:

- Formatting checks.
- Linting.
- Astro/type checking.
- Production build.
- Persistence tests.
- Publication and ingestion tests.
- Runtime integration tests.
- Browser E2E.

Preserve failure propagation and existing checks. Browser assertions, startup failures, and cleanup failures must all fail the quality command.

Run shared-root scenarios serially. Restore dedicated baseline data from Git rather than regenerating or re-ingesting it as part of quality.

Document browser installation and local execution prerequisites. Keep generated reports, traces, logs, and screenshots outside the tracked root and exclude them from version control where appropriate.

### 9. Reconcile final documentation

Update README and AGENTS against the implemented system.

Cover:

- Model and module responsibilities.
- Explicit application and independent test configuration.
- Storage location and tracked baseline ownership.
- Publication and ingestion commands, arguments, and examples.
- Stable identities and duplicate/conflict behavior.
- Request-time post and media retrieval.
- Latest-first Registry ordering and older-than pagination.
- First-page refresh for newly published posts.
- Visitor origin and URL construction.
- E2E serial-execution requirements.
- The exact dedicated E2E post-data paths eligible for Git restoration or cleanup.
- Intentional replacement of modifications to dedicated E2E data by the Git baseline.
- Snapshot preservation of author data, shared records, and unrelated test artifacts.
- Snapshot, cleanup, and failure-reporting behavior.
- Recovery guidance after interrupted teardown.
- Required verification commands.

Update the storage-lifecycle requirements to reflect the approved two-scope restoration contract instead of an unconditional prohibition on Git reset/clean or an unconditional whole-root pre-run equality requirement.

Preserve unrelated architectural guidance and distinguish implemented local filesystem behavior from future production database and deployment work.

Check that the requirements and model documents include the approved Stage 1 changes and that no stale ascending-pagination instructions remain.

## Integration Validation

| Area | Required evidence |
| --- | --- |
| Configuration | E2E uses explicit test settings without application-code fallback defaults |
| Baseline navigation | Browser clicks open both illustrated posts with complete text and loaded images |
| Artifact execution | The preserved demonstration renders within its sandbox and its counter works |
| Ordering | Homepage order follows Registry timestamps descending |
| Live publication | The real CLI creates a previously absent fixture while the same server runs |
| Refresh behavior | Homepage refresh exposes the new link without rebuild or restart |
| Visitor URL | CLI output and browser navigation identify the same post |
| Duplicate retry | Repeated publication skips the identical fixture without changing stored bytes or Registry time |
| HTTP errors | Malformed and unknown post/media requests receive the specified responses |
| Git restoration scope | Designated E2E post data returns to its recorded Git baseline; generated data is cleaned only in explicitly designated E2E locations |
| Protected data | Author data, shared records, and unrelated test logic/configuration artifacts remain outside Git reset/clean scope |
| Successful teardown | Baseline data matches Git, protected data matches its snapshot, and unintended generated files are absent |
| Failed-run teardown | An intentional assertion failure still produces the required restoration in both scopes |
| Author changes | Pre-existing modified and untracked author files survive unchanged |
| Cleanup failure | The run fails with affected paths and retains the original failure when applicable |
| Quality integration | `npm run quality` executes browser checks and propagates failures |
| Documentation | Commands and descriptions match the final implementation and approved contracts |

Run the complete quality workflow and report its result. Do not claim production deployment or container-runtime verification.

## Risks

- **Overlapping writers:** Author publication during E2E would invalidate the restoration assumptions. Enforce serial test execution and document the no-overlapping-publication rule.
- **Cleanup scope:** Broad Git path selection could remove author data or new test logic. Restrict reset/restore and clean to explicit dedicated post-data paths; shared catalogues require snapshot preservation.
- **Teardown interruption:** Forced termination may prevent restoration. Retain usable snapshots and baseline references and provide explicit recovery instructions.
- **Hidden cleanup failure:** Successful browser assertions do not make a run successful if storage restoration fails.
- **Weak browser assertions:** Checking only headings or image elements can miss truncated content or broken image loads. Verify complete expected content and actual image responses.
- **Server mismatch:** Reusing an unrelated server could test another root. Own server startup and verify its configuration.

## Implementation Handoff

Requires Stages 1–3 to be implemented and validated.

The milestone is complete when:

- The tracked baseline works through actual browser navigation.
- A new CLI publication becomes visible and readable on the already-running server.
- Duplicate retry behavior remains correct.
- Both successful and intentionally failed runs restore dedicated E2E post data to Git and protected data to its snapshot.
- Pre-existing author changes and unrelated test artifacts remain intact.
- Browser E2E executes within `npm run quality`.
- The complete quality gate passes.
- Repository guidance matches the implemented system.

The delivered milestone remains local and filesystem-backed. Production database integration and deployment require separate plans.
