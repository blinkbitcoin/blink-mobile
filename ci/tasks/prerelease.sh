#!/bin/bash

set -eu

# ------------ CHANGELOG ------------

pushd repo

# First time
if [[ $(cat ../testflight-version/version) == "0.0.0" ]]; then
  git cliff --config ../pipeline-tasks/ci/config/vendor/git-cliff.toml > ../artifacts/gh-release-notes.md

# Fetch changelog from last ref
else
  export prev_ref=$(git rev-list -n 1 $(cat ../testflight-version/version))
  export new_ref=$(git rev-parse HEAD)

  git cliff --config ../pipeline-tasks/ci/config/vendor/git-cliff.toml $prev_ref..$new_ref > ../artifacts/gh-release-notes.md
fi

popd

# Generate Changelog
echo "CHANGELOG:"
echo "-------------------------------"
cat artifacts/gh-release-notes.md
echo "-------------------------------"

if [[ $(cat artifacts/gh-release-notes.md | wc -l) == "0" ]]; then
  echo "    --> Nothing to Release"
  exit 1
fi

# ------------ BUMP VERSION ------------

echo -n "    --> Prev Version: "
cat testflight-version/version
echo ""

cat testflight-version/version > testflight-version/testflight-version

# Initial Version
if [[ $(cat testflight-version/version) == "0.0.0" ]]; then
  echo "0.1.0" > testflight-version/testflight-version
# Figure out proper version to release
elif [[ $(cat artifacts/gh-release-notes.md | grep \*\*breaking\*\*) != '' ]]; then
  echo "    --> Breaking change / Feature Addition found, bumping minor version..."
  bump2version minor --current-version $(cat testflight-version/version) --allow-dirty testflight-version/testflight-version
else
  echo "    --> Only patches and fixes found - no breaking changes, bumping patch version..."
  bump2version patch --current-version $(cat testflight-version/version) --allow-dirty testflight-version/testflight-version
fi

echo -n "    --> Release Version: "
cat testflight-version/testflight-version
echo ""

cat testflight-version/testflight-version > testflight-version/version

# ------------ ARTIFACTS ------------

cat testflight-version/version > artifacts/gh-release-tag
echo "v$(cat testflight-version/version) Prerelease" > artifacts/gh-release-name
