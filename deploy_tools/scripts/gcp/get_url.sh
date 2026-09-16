#!/bin/bash

gcloud run services describe "$GCP_CLOUD_RUN_SERVICE" \
  --region "$GCP_REGION" \
  --project "$GCP_PROJECT_ID" \
  --format='value(status.url)'
