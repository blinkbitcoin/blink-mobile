#!/bin/bash
set -eu

if [[ ! -f ./built-dev-apk/app-universal-release.apk ]]; then
  echo "APK not found"
  exit 1
fi

[[ "$(cat ./built-dev-apk/url)" =~ dev/android/galoy-mobile-.+-v(.+)/apk ]]
APK_COMMIT=${BASH_REMATCH[1]}
REPO_COMMIT=$(cat ./repo/.git/ref)

if [[ $APK_COMMIT != $REPO_COMMIT ]]; then
  echo "APK and Repo not from same commit, there should be a different build running!"
  exit 1
fi

export BROWSERSTACK_APP_ID=$(
  curl -u "$BROWSERSTACK_USER:$BROWSERSTACK_ACCESS_KEY" \
    -X POST "https://api-cloud.browserstack.com/app-automate/upload" \
    -F "file=@./built-dev-apk/app-universal-release.apk"\
    | jq -r '.app_url'
)

. pipeline-tasks/ci/tasks/helpers.sh

unpack_deps

pushd repo

# do browserstack test
yarn install

echo browserstack_app_id:$BROWSERSTACK_APP_ID
GALOY_TEST_TOKENS=$GALOY_TEST_TOKENS && GALOY_TOKEN_2=$GALOY_TOKEN_2 && MAILSLURP_API_KEY=$MAILSLURP_API_KEY && yarn test:browserstack:android | tee browserstack_output.log
error_code=$?
SESSION_ID=$(cat browserstack_output.log | grep sessionId | head -n1 | sed -n "s/^.*'\(.*\)'.*$/\1/ p")
echo "Session ID"
echo $SESSION_ID
echo "Browserstack URL"
echo "https://app-automate.browserstack.com/dashboard/v2/builds/$BROWSERSTACK_ANDROID_BUILD/sessions/$SESSION_ID"
VIDEO_URL=$(curl -s -u "$BROWSERSTACK_USER:$BROWSERSTACK_ACCESS_KEY" -X GET "https://api-cloud.browserstack.com/app-automate/sessions/$SESSION_ID.json" | jq -r '.automation_session.video_url')
echo "Video URL"
echo $VIDEO_URL
exit $error_code
