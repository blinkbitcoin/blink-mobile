#!/bin/bash

set -eu

tar_out="$(pwd)/bundled-deps"

. pipeline-tasks/ci/tasks/helpers.sh

use_github_packages_auth

pushd deps
yarn install
git log --pretty=format:'%h' -n 1 > gitref

tar -zcvf "${tar_out}/bundled-deps-v$(cat ../deps-version/number)-$(cat gitref).tgz" . > /dev/null

popd
