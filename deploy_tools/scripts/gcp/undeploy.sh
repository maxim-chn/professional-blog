#!/bin/bash

gcloud run services delete "$GCP_CLOUD_RUN_SERVICE" \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT_ID"
