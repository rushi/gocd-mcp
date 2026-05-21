#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-eu-central-1}"
ECR_REGISTRY="${ECR_REGISTRY:-193950752404.dkr.ecr.eu-central-1.amazonaws.com}"
ECR_REPOSITORY="${ECR_REPOSITORY:-vialytics-development-apps/gocd-mcp}"

TAG="${1:-$(git rev-parse --short HEAD)}"
IMAGE="${ECR_REGISTRY}/${ECR_REPOSITORY}:${TAG}"

echo "==> Building linux/amd64 image: gocd-mcp"
docker buildx build --platform linux/amd64 -t gocd-mcp --load .

echo "==> Tagging image as ${IMAGE}"
docker tag gocd-mcp "${IMAGE}"

echo "==> Logging into ECR (${ECR_REGISTRY})"
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

echo "==> Pushing ${IMAGE}"
docker push "${IMAGE}"

echo "==> Done: ${IMAGE}"
