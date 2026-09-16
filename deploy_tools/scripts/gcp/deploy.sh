#!/bin/bash

gcloud run deploy $GCP_CLOUD_RUN_SERVICE \
  --image $GCP_IMAGE_URI \
  --region $GCP_REGION \
  --project $GCP_PROJECT_ID \
  --platform=managed \
  --allow-unauthenticated
