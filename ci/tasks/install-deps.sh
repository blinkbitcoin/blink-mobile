#!/bin/bash

set -eu

tar_out="$(pwd)/bundled-deps"
github_packages_auth="$(pwd)/pipeline-tasks/ci/tasks/with-github-packages-auth.sh"
# Outside deps, which is tarred whole into the bundle below.
github_packages_npmrc="$(pwd)/github-packages.npmrc"

pushd deps
"$github_packages_auth" "$github_packages_npmrc" yarn install
git log --pretty=format:'%h' -n 1 > gitref

tar -zcvf "${tar_out}/bundled-deps-v$(cat ../deps-version/number)-$(cat gitref).tgz" . > /dev/null

popd
