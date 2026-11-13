# The public promotion attaches the build recorded in `ios-builds/<version>`, the one that
# went through beta. deliver only picks a build when it submits for review, which the lane
# leaves to a person, so without this nothing is attached and the build is picked by hand.
# That is how 3.0.46 went out as build 874, the 3.0.47 build, instead of 873.
#
# Plain Ruby that takes the App Store Connect models as arguments, so it is tested without
# fastlane or a network.
module PromotedBuild
  Error = Class.new(StandardError)

  # Spaceship::ConnectAPI::Build::ProcessingState::VALID: only a processed build can be attached
  PROCESSED = "VALID".freeze

  module_function

  def target(env)
    version = env["VERSION"].to_s
    build_number = env["BUILD_NUMBER"].to_s
    raise Error, "VERSION is not set, refusing to promote" if version.empty?
    raise Error, "BUILD_NUMBER is not set, refusing to promote" if build_number.empty?

    [version, build_number]
  end

  def app(apps:, bundle_id:)
    apps.find(bundle_id) || raise(Error, "No app #{bundle_id} on App Store Connect")
  end

  def find(builds:, app_id:, version:, build_number:, platform:)
    build = builds.all(
      app_id: app_id,
      version: version,
      build_number: build_number,
      platform: platform,
      processing_states: PROCESSED
    ).first
    raise Error, "No processed build #{version} (#{build_number}) on App Store Connect" unless build

    build
  end

  def attach(app:, build:, version:, platform:)
    app_store_version = app.get_edit_app_store_version(platform: platform)
    raise Error, "No editable App Store version to attach build #{build.version} to" unless app_store_version

    unless app_store_version.version_string == version
      raise Error, "The editable App Store version is #{app_store_version.version_string}, expected #{version}"
    end

    app_store_version.select_build(build_id: build.id)
  end
end
