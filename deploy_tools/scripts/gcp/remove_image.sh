#!/bin/bash

if [[ -z "${1:-}" || -z "${2:-}" ]]; then
  echo "Error: Usage: $0 <arg1> <arg2>. both arguments are required and must be non-empty." >&2
  exit 1
fi

IMAGE=$1
IMAGE_ID=$2

gcloud artifacts docker images delete \
    "${IMAGE}@${IMAGE_ID}" \
    --delete-tags \
    --quiet
