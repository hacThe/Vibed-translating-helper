require "test_helper"

class SeededUserTest < ActiveSupport::TestCase
  test "seed creates one normalized user and updates its password idempotently" do
    with_seed_credentials("  Tutor@Example.COM ", "first password") do
      Rails.application.load_seed
    end

    with_seed_credentials("tutor@example.com", "replacement password") do
      Rails.application.load_seed
    end

    assert_equal 1, User.where(email: "tutor@example.com").count

    user = User.find_by!(email: "tutor@example.com")
    assert user.authenticate("replacement password")
    assert_not user.authenticate("first password")
  end

  private

  def with_seed_credentials(email, password)
    previous_email = ENV["SEED_USER_EMAIL"]
    previous_password = ENV["SEED_USER_PASSWORD"]
    ENV["SEED_USER_EMAIL"] = email
    ENV["SEED_USER_PASSWORD"] = password
    yield
  ensure
    ENV["SEED_USER_EMAIL"] = previous_email
    ENV["SEED_USER_PASSWORD"] = previous_password
  end
end
