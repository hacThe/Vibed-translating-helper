require "test_helper"

class SessionFlowTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email: "learner@example.com", password: "correct horse battery staple")
  end

  test "user can authenticate, inspect the session, and log out" do
    get api_session_url

    assert_response :success
    assert_equal false, response.parsed_body.fetch("authenticated")
    csrf_token = response.parsed_body.fetch("csrf_token")
    assert csrf_token.present?

    post api_session_url,
      params: { email: @user.email, password: "correct horse battery staple" },
      as: :json

    assert_response :unprocessable_entity
    assert_equal({ "error" => "Invalid authenticity token" }, response.parsed_body)

    post api_session_url,
      params: { email: @user.email, password: "correct horse battery staple" },
      headers: { "X-CSRF-Token" => csrf_token },
      as: :json

    assert_response :success
    assert_equal(
      { "id" => @user.id, "email" => "learner@example.com" },
      response.parsed_body.fetch("user")
    )

    get api_session_url

    assert_response :success
    assert_equal true, response.parsed_body.fetch("authenticated")

    delete api_session_url,
      headers: { "X-CSRF-Token" => response.parsed_body.fetch("csrf_token") },
      as: :json

    assert_response :success
    assert_equal false, response.parsed_body.fetch("authenticated")
    logged_out_csrf_token = response.parsed_body.fetch("csrf_token")

    get api_session_url

    assert_response :success
    assert_equal false, response.parsed_body.fetch("authenticated")

    post api_session_url,
      params: { email: @user.email, password: "correct horse battery staple" },
      headers: { "X-CSRF-Token" => logged_out_csrf_token },
      as: :json

    assert_response :success
  end

  test "invalid credentials return a safe error" do
    get api_session_url

    post api_session_url,
      params: { email: @user.email, password: "wrong password" },
      headers: { "X-CSRF-Token" => response.parsed_body.fetch("csrf_token") },
      as: :json

    assert_response :unauthorized
    assert_equal({ "error" => "Invalid email or password" }, response.parsed_body)
  end
end
