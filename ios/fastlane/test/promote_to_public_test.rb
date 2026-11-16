require "minitest/autorun"
require "fastlane"

# What fastlane's command line does before it runs a lane
Fastlane.load_actions

# Runs the real promote_to_public lane with App Store Connect replaced: the two actions it
# calls and the Spaceship lookups record what they were asked, so the lane's order and
# arguments are checked without credentials or a network.
class PromoteToPublicTest < Minitest::Test
  IOS_DIR = File.expand_path("../..", __dir__)

  FakeBuild = Struct.new(:id, :version, :app_version)

  class FakeAppStoreVersion
    attr_reader :version_string

    def initialize(version_string, events)
      @version_string = version_string
      @events = events
    end

    def select_build(build_id:)
      @events << [:select_build, build_id]
    end
  end

  class FakeApp
    def initialize(editable_version, events)
      @editable_version = editable_version
      @events = events
    end

    def id
      "app-1"
    end

    def get_edit_app_store_version(platform:)
      @events << [:editable_version, platform]
      @editable_version
    end
  end

  PROMOTION_ENV = {
    "VERSION" => "3.0.46",
    "BUILD_NUMBER" => "873",
    "CHANGELOG" => "Fixes",
    "APPSTORE_API_KEY_ID" => "key-id",
    "APPSTORE_ISSUER_ID" => "issuer-id",
    "APPSTORE_API_KEY" => "a2V5"
  }.freeze

  BUILD_873 = FakeBuild.new("build-873", "873", "3.0.46")

  BUILD_FILTERS = {
    app_id: "app-1", version: "3.0.46", build_number: "873", platform: "IOS", processing_states: "VALID"
  }.freeze

  def setup
    @events = []
  end

  def test_attaches_the_recorded_build_after_writing_the_metadata
    promote(env: PROMOTION_ENV, builds: [BUILD_873], editable_version: "3.0.46")

    assert_equal(
      [
        [:api_key],
        [:find_app, "io.galoy.bitcoinbeach"],
        [:find_build, BUILD_FILTERS],
        [:upload, "3.0.46", "873"],
        [:editable_version, "IOS"],
        [:select_build, "build-873"]
      ],
      @events
    )
  end

  def test_refuses_to_promote_without_a_build_number
    error = assert_raises(FastlaneCore::Interface::FastlaneError) do
      promote(env: PROMOTION_ENV.merge("BUILD_NUMBER" => nil), builds: [BUILD_873], editable_version: "3.0.46")
    end

    assert_equal("BUILD_NUMBER is not set, refusing to promote", error.message)
    assert_equal([[:api_key]], @events)
  end

  def test_writes_nothing_when_the_recorded_build_is_missing
    error = assert_raises(FastlaneCore::Interface::FastlaneError) do
      promote(env: PROMOTION_ENV, builds: [], editable_version: "3.0.46")
    end

    assert_equal("No processed build 3.0.46 (873) on App Store Connect", error.message)
    assert_equal([:find_build, BUILD_FILTERS], @events.last)
  end

  def test_attaches_nothing_to_another_editable_version
    error = assert_raises(FastlaneCore::Interface::FastlaneError) do
      promote(env: PROMOTION_ENV, builds: [BUILD_873], editable_version: "3.0.47")
    end

    assert_equal("The editable App Store version is 3.0.47, expected 3.0.46", error.message)
    assert_equal([:editable_version, "IOS"], @events.last)
  end

  private

  def promote(env:, builds:, editable_version:)
    events = @events
    app = FakeApp.new(FakeAppStoreVersion.new(editable_version, events), events)
    replacements = {
      [Fastlane::Actions::AppStoreConnectApiKeyAction, :run] => ->(_config) { events << [:api_key] },
      [Fastlane::Actions::UploadToAppStoreAction, :run] => lambda do |config|
        events << [:upload, config[:app_version], config[:build_number]]
      end,
      [Spaceship::ConnectAPI::App, :find] => lambda do |bundle_id|
        events << [:find_app, bundle_id]
        app
      end,
      [Spaceship::ConnectAPI::Build, :all] => lambda do |**filters|
        events << [:find_build, filters]
        builds
      end
    }

    with_env(env) do
      replacing(replacements) do
        Dir.chdir(IOS_DIR) { Fastlane::FastFile.new("fastlane/Fastfile").runner.execute(:promote_to_public, :ios) }
      end
    end
  end

  def with_env(values)
    previous = values.keys.map { |key| [key, ENV[key]] }.to_h
    values.each { |key, value| ENV[key] = value }
    yield
  ensure
    previous.each { |key, value| ENV[key] = value }
  end

  def replacing(replacements)
    originals = replacements.keys.map { |owner, name| [owner, name, owner.method(name)] }
    replacements.each { |(owner, name), replacement| owner.define_singleton_method(name, &replacement) }
    yield
  ensure
    originals.each { |owner, name, original| owner.define_singleton_method(name, original) }
  end
end
