# Deployment tools

The scripts in `scripts/gcp/` build and publish the application image to Google Artifact Registry, deploy it to Google Cloud Run, and retrieve the service URL.

## Prerequisites

- A running Docker engine.
- An authenticated Google Cloud CLI (`gcloud`).
- Access to the target Google Cloud project and Cloud Run service.
- Docker authentication for the target Artifact Registry.
- An existing Artifact Registry repository.
- Project dependencies and project-local Chromium installed for `npm run quality`.

Review `scripts/gcp/init_env.sh` for the project, region, repository, image name/tag, and Cloud Run service settings. It exports these settings and the derived `GCP_IMAGE_URI`; it does not provision resources or authenticate the tools.

## Deployment sequence

Run these commands from the `professional-blog` repository root, continuing only after each step succeeds:

```sh
source deploy_tools/scripts/gcp/init_env.sh
npm run quality
bash deploy_tools/scripts/gcp/build_deployable_image.sh
bash deploy_tools/scripts/gcp/deploy.sh
bash deploy_tools/scripts/gcp/get_url.sh
```

Source `init_env.sh` in the same shell before running any GCP script. Executing it with `bash` instead of sourcing it will not retain its exported variables in the calling shell. Repeat the source command when starting a new shell or changing settings.

1. `build_deployable_image.sh` builds a `linux/amd64` image from the repository's Dockerfile, pushes it to `GCP_IMAGE_URI`, and prints its OS/architecture. It currently changes directory to `~/personal-blog-workspace/professional-blog/`, so the checkout must be available there. Check the build and push output before proceeding.
2. `deploy.sh` deploys that image to the configured managed Cloud Run service with unauthenticated access enabled.
3. `get_url.sh` prints the deployed service URL. It does not verify application behavior.

The quality command validates the application and its local tests. It does not establish that the deployed container is healthy; verify the deployed service separately.

## Runtime configuration

The Docker image includes the built application, runtime configuration, and the existing `local_database`. It excludes preparation manifests and does not publish posts during build or startup.

Set `VISITOR_ORIGIN` to the externally reachable service origin in the Cloud Run configuration. The packaged publication configuration uses `http://localhost:4321`; the deployment script does not set or override `VISITOR_ORIGIN`. Visitor links depend on this setting.

## Inspect published images

After sourcing the environment:

```sh
bash deploy_tools/scripts/gcp/list_images.sh
```

## Remove the Cloud Run service

`undeploy.sh` is an optional maintenance operation, outside the deployment sequence. It deletes the configured Cloud Run service, not the stored images or Artifact Registry repository.

Run it only when service removal is intended, after sourcing the environment:

```sh
bash deploy_tools/scripts/gcp/undeploy.sh
```

See the [project README](../README.md) for application architecture, runtime routes, and verification commands.
