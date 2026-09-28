#!/bin/bash

set -euo pipefail

pushd ~/personal-blog-workspace/professional-blog/deploy_tools/scripts/gcp

IMAGE="me-west1-docker.pkg.dev/professional-blog-maximc/professional-blog/professional-blog"

if [[ -z "${1:-}" ]]; then
  echo "Usage: $0 \"sha256:ID1 sha256:ID2 ...\"" >&2
  exit 1
fi

read -r -a IMAGE_IDS <<< "$1"

for image_id in "${IMAGE_IDS[@]}"; do
  echo "Deleting ${IMAGE}@${image_id}"
  ./remove_image.sh "$IMAGE" "$image_id"
done

echo "List Left Images"
echo ""

./list_images.sh

popd