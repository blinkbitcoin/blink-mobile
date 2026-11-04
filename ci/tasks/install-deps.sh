#!/bin/bash

set -eu

# Concourse passes the token for the task's whole life; only the yarn install below gets it,
# so neither git nor tar inherits it.
github_packages_token_for_install="${GITHUB_PACKAGES_TOKEN:-}"
unset GITHUB_PACKAGES_TOKEN

tar_out="$(pwd)/bundled-deps"
github_packages_auth="$(pwd)/pipeline-tasks/ci/tasks/with-github-packages-auth.sh"
# Outside deps, which is tarred whole into the bundle below.
github_packages_npmrc="$(pwd)/github-packages.npmrc"

pushd deps
GITHUB_PACKAGES_TOKEN="$github_packages_token_for_install" \
  "$github_packages_auth" "$github_packages_npmrc" yarn install
git log --pretty=format:'%h' -n 1 > gitref

tar -zcvf "${tar_out}/bundled-deps-v$(cat ../deps-version/number)-$(cat gitref).tgz" . > /dev/null

popd
