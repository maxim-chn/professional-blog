#!/bin/bash

pushd ~/personal-blog-workspace/professional-blog/

docker build --platform linux/amd64 -t "$GCP_IMAGE_URI" .
docker push "$GCP_IMAGE_URI"
docker image inspect "$GCP_IMAGE_URI" --format '{{.Os}}/{{.Architecture}}'

popd
