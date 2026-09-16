#!/bin/bash

export GCP_BILLING_ACCOUNT_ID="01133C-585901-6EB01A"
export GCP_PROJECT_ID="professional-blog-maximc"
export GCP_REGION="me-west1"

export GCP_ARTIFACT_REPOSITORY="professional-blog"
export GCP_IMAGE_NAME="professional-blog"
export GCP_IMAGE_TAG="v0-1"
export GCP_IMAGE_URI="$GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/$GCP_ARTIFACT_REPOSITORY/$GCP_IMAGE_NAME:$GCP_IMAGE_TAG"

export GCP_CLOUD_RUN_SERVICE="professional-blog"
