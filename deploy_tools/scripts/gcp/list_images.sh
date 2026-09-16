#!/bin/bash

gcloud artifacts docker images list \
  "$GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/$GCP_ARTIFACT_REPOSITORY" \
  --project="$GCP_PROJECT_ID"
