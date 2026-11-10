require "minitest/autorun"
require "spaceship"
require_relative "../promoted_build"

# The other tests stand fakes in for these Spaceship models, so this pins the fakes to the
# installed fastlane: a model or keyword it drops fails here instead of on a release.
class SpaceshipContractTest < Minitest::Test
  def keywords(method)
    method.parameters.select { |type, _| %i[key keyreq].include?(type) }.map(&:last)
  end

  def test_builds_are_filtered_with_the_keywords_find_passes
    accepted = keywords(Spaceship::ConnectAPI::Build.method(:all))

    assert_empty(%i[app_id version build_number platform processing_states] - accepted)
  end

  def test_the_processed_state_is_the_one_spaceship_names
    assert_equal(Spaceship::ConnectAPI::Build::ProcessingState::VALID, PromotedBuild::PROCESSED)
  end

  def test_a_build_carries_what_the_lane_reads
    %i[id version app_version].each do |name|
      assert(Spaceship::ConnectAPI::Build.method_defined?(name), "Build##{name} is gone")
    end
  end

  def test_an_app_is_found_by_its_bundle_id
    assert_equal(:req, Spaceship::ConnectAPI::App.method(:find).parameters.first.first)
    assert(Spaceship::ConnectAPI::App.method_defined?(:id), "App#id is gone")
  end

  def test_the_editable_version_is_read_per_platform
    accepted = keywords(Spaceship::ConnectAPI::App.instance_method(:get_edit_app_store_version))

    assert_includes(accepted, :platform)
  end

  def test_a_build_is_selected_on_the_version_by_id
    accepted = keywords(Spaceship::ConnectAPI::AppStoreVersion.instance_method(:select_build))

    assert_includes(accepted, :build_id)
    assert(Spaceship::ConnectAPI::AppStoreVersion.method_defined?(:version_string), "AppStoreVersion#version_string is gone")
  end

  def test_the_lane_promotes_on_ios
    assert_equal("IOS", Spaceship::ConnectAPI::Platform::IOS)
  end
end
