# professional-blog

A personal engineering blog and experimental platform for exploring modern software development, tools, and small engineering projects.

## Approved v0_1 Stack

| Concern              | Decision                      |
| -------------------- | ----------------------------- |
| Site framework       | Astro                         |
| Language             | TypeScript                    |
| Content              | Markdown / MDX                |
| Executable artifacts | Independent HTML + JavaScript |
| Artifact execution   | Isolated browser sandbox      |
| Runtime/build        | Node.js                       |
| Packaging            | Docker                        |
| Hosting              | Google Cloud Run              |
| Source/deployment    | GitHub                        |
| Database             | None for v0_1                 |
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

Acceptance criterion: the stack must permit a blog post to render an independently authored HTML + JavaScript artifact within an isolated browser context without requiring that artifact to use the blog's application framework.

## Non-Functional Requirement: Sandbox-Renderable Executable Artifacts

The platform must support blog content that incorporates an independently developed executable artifact scoped to HTML + JavaScript.

The artifact should be treated as an independent unit rather than as a natural/native component of the blog framework. The blog provides a sandbox in which the artifact is rendered and executed as part of the surrounding post experience.

Implications for stack selection:

- A post may combine ordinary authored content with an independently built HTML + JavaScript artifact.
- The artifact may originate as a small standalone project and later be incorporated into a post as a runnable demo.
- The publishing/build flow must be able to carry the artifact into the deployed site and make it available to the sandbox.
- Isolation/sandboxing is a first-class architectural requirement; the implementation mechanism is deliberately not selected yet.
- Framework choice must not require executable artifacts to be rewritten as framework-native components.

Deliberate non-decisions:

- iframe vs another sandbox mechanism
- sandbox permissions
- artifact packaging convention
- build orchestration
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

## Initial Project Structure

- `src/pages/` owns route composition.
- `src/layouts/` owns shared page and post presentation.
- `src/content/blog/` stores authored Markdown / MDX posts.
- `src/content.config.ts` defines typed frontmatter, including optional artifact references.
- `src/components/ArtifactSandbox.astro` is the single blog-owned artifact boundary.
- `public/artifacts/` stores independently authored HTML + JavaScript artifacts that are copied into the deployed site as static files.
