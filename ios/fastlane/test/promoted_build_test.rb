require "minitest/autorun"
require_relative "../promoted_build"

# The fakes answer like the Spaceship models they stand in for, which
# spaceship_contract_test.rb checks against the real ones.
class PromotedBuildTest < Minitest::Test
  FakeBuild = Struct.new(:id, :version, :app_version)

  class FakeBuilds
    attr_reader :filters

    def initialize(builds)
      @builds = builds
    end

    def all(**filters)
      @filters = filters
      @builds
    end
  end

  class FakeAppStoreVersion
    attr_reader :version_string, :selected_build_ids

    def initialize(version_string)
      @version_string = version_string
      @selected_build_ids = []
    end

    def select_build(build_id:)
      @selected_build_ids << build_id
    end
  end

  class FakeApp
    attr_reader :id, :requested_platform

    def initialize(id:, editable_version:)
      @id = id
      @editable_version = editable_version
    end

    def get_edit_app_store_version(platform:)
      @requested_platform = platform
      @editable_version
    end
  end

  class FakeApps
    def initialize(apps_by_bundle_id)
      @apps_by_bundle_id = apps_by_bundle_id
    end

    def find(bundle_id)
      @apps_by_bundle_id[bundle_id]
    end
  end

  BUILD_873 = FakeBuild.new("build-873", "873", "3.0.46")

  def test_target_reads_the_version_and_build_number
    assert_equal(["3.0.46", "873"], PromotedBuild.target("VERSION" => "3.0.46", "BUILD_NUMBER" => "873"))
  end

  def test_target_refuses_a_missing_or_empty_build_number
    [{ "VERSION" => "3.0.46" }, { "VERSION" => "3.0.46", "BUILD_NUMBER" => "" }].each do |env|
      error = assert_raises(PromotedBuild::Error) { PromotedBuild.target(env) }
      assert_equal("BUILD_NUMBER is not set, refusing to promote", error.message)
    end
  end

  def test_target_refuses_a_missing_or_empty_version
    [{ "BUILD_NUMBER" => "873" }, { "VERSION" => "", "BUILD_NUMBER" => "873" }].each do |env|
      error = assert_raises(PromotedBuild::Error) { PromotedBuild.target(env) }
      assert_equal("VERSION is not set, refusing to promote", error.message)
    end
  end

  def test_app_finds_the_app_by_bundle_id
    app = FakeApp.new(id: "app-1", editable_version: nil)

    assert_same(app, PromotedBuild.app(apps: FakeApps.new("io.galoy.bitcoinbeach" => app), bundle_id: "io.galoy.bitcoinbeach"))
  end

  def test_app_refuses_a_bundle_id_with_no_app
    error = assert_raises(PromotedBuild::Error) do
      PromotedBuild.app(apps: FakeApps.new({}), bundle_id: "io.galoy.bitcoinbeach")
    end
    assert_equal("No app io.galoy.bitcoinbeach on App Store Connect", error.message)
  end

  def test_find_asks_for_the_processed_build_with_that_version_and_number
    builds = FakeBuilds.new([BUILD_873])

    found = PromotedBuild.find(builds: builds, app_id: "app-1", version: "3.0.46", build_number: "873", platform: "IOS")

    assert_same(BUILD_873, found)
    assert_equal(
      { app_id: "app-1", version: "3.0.46", build_number: "873", platform: "IOS", processing_states: "VALID" },
      builds.filters
    )
  end

  def test_find_refuses_when_no_processed_build_matches
    error = assert_raises(PromotedBuild::Error) do
      PromotedBuild.find(builds: FakeBuilds.new([]), app_id: "app-1", version: "3.0.46", build_number: "873", platform: "IOS")
    end
    assert_equal("No processed build 3.0.46 (873) on App Store Connect", error.message)
  end

  def test_attach_selects_the_build_on_the_editable_version
    editable_version = FakeAppStoreVersion.new("3.0.46")
    app = FakeApp.new(id: "app-1", editable_version: editable_version)

    PromotedBuild.attach(app: app, build: BUILD_873, version: "3.0.46", platform: "IOS")

    assert_equal(["build-873"], editable_version.selected_build_ids)
    assert_equal("IOS", app.requested_platform)
  end

  def test_attach_refuses_when_no_version_is_editable
    app = FakeApp.new(id: "app-1", editable_version: nil)

    error = assert_raises(PromotedBuild::Error) do
      PromotedBuild.attach(app: app, build: BUILD_873, version: "3.0.46", platform: "IOS")
    end
    assert_equal("No editable App Store version to attach build 873 to", error.message)
  end

  def test_attach_leaves_another_editable_version_alone
    editable_version = FakeAppStoreVersion.new("3.0.47")
    app = FakeApp.new(id: "app-1", editable_version: editable_version)

    error = assert_raises(PromotedBuild::Error) do
      PromotedBuild.attach(app: app, build: BUILD_873, version: "3.0.46", platform: "IOS")
    end
    assert_equal("The editable App Store version is 3.0.47, expected 3.0.46", error.message)
    assert_empty(editable_version.selected_build_ids)
  end
end
