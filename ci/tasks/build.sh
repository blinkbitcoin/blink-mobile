#!/bin/zsh

set -eu
export CI_ROOT="$(pwd)"

export PATH=$(cat /Users/m1/concourse/path)
export PUBLIC_VERSION=$(cat $VERSION_FILE)

# Make sure ssh agent is running - to access GaloyMoney ios keystore from github
echo "    --> Setting up ssh agent"
eval "$(ssh-agent -s)"
cat <<EOF > id_rsa
$GITHUB_SSH_KEY
EOF
chmod 600 id_rsa && ssh-add ./id_rsa && rm id_rsa

echo "    --> Setting up WWDR certificate"
tmpfile=$(mktemp /tmp/wwdr-cert.cer.XXXXXXXXX) || true
curl -f -o $tmpfile https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer && security import $tmpfile ~/Library/Keychains/login.keychain-db || true

# Checkout correct commit
GIT_REF=$(cat repo/.git/ref)

pushd repo

echo "    --> Checking out $GIT_REF"
git checkout $GIT_REF

echo "    --> Installing dependencies"
nix develop -c yarn install
echo "    --> Installing Android dependencies"
nix develop -c sh -c 'cd android && bundle install'
echo "    --> Installing iOS dependencies"
nix develop -c sh -c 'cd ios && bundle install'

echo "    --> Starting metro"
lsof -ti:8080,8081 | xargs kill -9 || true
(nix develop -c yarn start) &
until lsof -ti:8080,8081; do sleep 1; echo "waiting for metro to come up..." ; done

echo "    --> Building Android"
# Android Build
export BUILD_NUMBER=$(cat ${CI_ROOT}/build-number-android/android)
sed -i'' -e "s/versionCode .*$/versionCode $BUILD_NUMBER/g" android/app/build.gradle

echo $ANDROID_KEYSTORE | base64 -d > android/app/release.keystore
nix develop -c sh -c 'cd android && bundle exec fastlane android build --verbose'

echo "    --> Building iOS"
# iOS Build
export BUILD_NUMBER=$(cat ${CI_ROOT}/build-number-ios/ios)
sed -i'' -e "s/MARKETING_VERSION.*/MARKETING_VERSION = $PUBLIC_VERSION;/g" ios/GaloyApp.xcodeproj/project.pbxproj

nix develop -c sh -c 'cd ios && bundle exec fastlane ios build --verbose'

echo "    --> Stopping metro"
lsof -ti:8080,8081 | xargs kill -9 || true
popd

echo "    --> Copying artifacts"
mkdir -p artifacts/android/app/build/outputs
cp -r repo/android/app/build/outputs/* artifacts/android/app/build/outputs

mkdir -p artifacts/ios
cp repo/ios/Blink.ipa artifacts/ios
echo "    --> Done"
