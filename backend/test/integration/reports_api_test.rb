require "test_helper"

class ReportsApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = User.create!(email: "learner@example.com", password: "correct password")
    @csrf_token = log_in(@user, "correct password")
  end

  test "authenticated user can submit a queued report for background generation" do
    assert_enqueued_with(job: GenerateReportJob) do
      post api_reports_url,
        params: {
          report: {
            title: "A morning in Hanoi",
            source_url: "https://example.com/article",
            source_text: "Một buổi sáng ở Hà Nội.",
            translation_text: "A morning in Hanoi."
          }
        },
        headers: { "X-CSRF-Token" => @csrf_token },
        as: :json
    end

    assert_response :created
    body = response.parsed_body
    assert_kind_of Integer, body.fetch("id")
    assert_equal "A morning in Hanoi", body.fetch("title")
    assert_equal "queued", body.fetch("status")
    assert_equal "fake", body.fetch("provider")
    assert_equal "fake-v1", body.fetch("model")
    assert_equal "v1", body.fetch("prompt_version")
    assert_equal "v1", body.fetch("schema_version")
  end

  test "report history is private, newest-first, metadata-only, and paginated" do
    reports = 21.times.map do |index|
      @user.reports.create!(
        title: "Report #{index}",
        source_text: "Vietnamese source #{index}",
        translation_text: "English translation #{index}",
        provider: "fake",
        model: "fake-v1",
        prompt_version: "v1",
        schema_version: "v1",
        created_at: Time.utc(2026, 1, 1) + index.minutes
      )
    end
    another_user = User.create!(email: "other@example.com", password: "correct password")
    another_user.reports.create!(
      title: "Private report",
      source_text: "Không được hiển thị.",
      translation_text: "Must not appear.",
      provider: "fake",
      model: "fake-v1",
      prompt_version: "v1",
      schema_version: "v1"
    )

    get api_reports_url, params: { page: 1 }

    assert_response :success
    body = response.parsed_body
    assert_equal reports.reverse.first(20).map(&:id), body.fetch("reports").map { |report| report.fetch("id") }
    assert_not body.fetch("reports").first.key?("source_text")
    assert_equal(
      {
        "page" => 1,
        "per_page" => 20,
        "total_count" => 21,
        "total_pages" => 2,
        "has_previous" => false,
        "has_next" => true
      },
      body.fetch("pagination")
    )

    get api_reports_url, params: { page: 2 }

    assert_response :success
    assert_equal [ reports.first.id ], response.parsed_body.fetch("reports").map { |report| report.fetch("id") }
  end

  test "report detail reveals content only when completed and never crosses users" do
    queued = create_report(@user, title: "Queued report")
    completed = create_report(
      @user,
      title: "Completed report",
      status: "completed",
      result: { "schema_version" => "v1", "revised_title" => "A better title" },
      completed_at: Time.utc(2026, 1, 2)
    )
    failed = create_report(
      @user,
      title: "Failed report",
      status: "failed",
      error_message: "provider secret diagnostic",
      failed_at: Time.utc(2026, 1, 3)
    )
    another_user = User.create!(email: "private@example.com", password: "correct password")
    private_report = create_report(another_user, title: "Someone else's report")

    get api_report_url(queued)

    assert_response :success
    assert_equal "queued", response.parsed_body.fetch("status")
    assert_not response.parsed_body.key?("source_text")

    get api_report_url(completed)

    assert_response :success
    assert_equal "Một bài báo.", response.parsed_body.fetch("source_text")
    assert_equal "An article.", response.parsed_body.fetch("translation_text")
    assert_equal "v1", response.parsed_body.fetch("result").fetch("schema_version")

    get api_report_url(failed)

    assert_response :success
    assert_not response.parsed_body.key?("error_message")

    get api_report_url(private_report)

    assert_response :not_found
    assert_equal({ "error" => "Report not found" }, response.parsed_body)
  end

  test "failed report can be retried once and re-enqueued" do
    report = create_report(
      @user,
      status: "failed",
      started_at: Time.utc(2026, 1, 2),
      failed_at: Time.utc(2026, 1, 3),
      error_message: "safe diagnostic"
    )

    assert_enqueued_with(job: GenerateReportJob, args: [ report ]) do
      post "/api/reports/#{report.id}/retry",
        headers: { "X-CSRF-Token" => @csrf_token },
        as: :json
    end

    assert_response :accepted
    assert_equal "queued", response.parsed_body.fetch("status")
    report.reload
    assert_predicate report, :queued?
    assert_nil report.started_at
    assert_nil report.failed_at
    assert_nil report.error_message

    assert_no_enqueued_jobs do
      post "/api/reports/#{report.id}/retry",
        headers: { "X-CSRF-Token" => @csrf_token },
        as: :json
    end
    assert_response :unprocessable_entity
  end

  test "cannot retry another user's failed report" do
    another_user = User.create!(email: "retry-private@example.com", password: "correct password")
    report = create_report(another_user, status: "failed", failed_at: Time.utc(2026, 1, 3))

    assert_no_enqueued_jobs do
      post "/api/reports/#{report.id}/retry",
        headers: { "X-CSRF-Token" => @csrf_token },
        as: :json
    end

    assert_response :not_found
  end

  private

  def log_in(user, password)
    get api_session_url
    csrf_token = response.parsed_body.fetch("csrf_token")

    post api_session_url,
      params: { email: user.email, password: password },
      headers: { "X-CSRF-Token" => csrf_token },
      as: :json

    response.parsed_body.fetch("csrf_token")
  end

  def create_report(user, attributes = {})
    user.reports.create!({
      title: "Report",
      source_url: "https://example.com/article",
      source_text: "Một bài báo.",
      translation_text: "An article.",
      provider: "fake",
      model: "fake-v1",
      prompt_version: "v1",
      schema_version: "v1"
    }.merge(attributes))
  end
end

class ReportsAuthorizationTest < ActionDispatch::IntegrationTest
  setup do
    get api_session_url
    @csrf_token = response.parsed_body.fetch("csrf_token")
  end

  test "report endpoints require authentication" do
    get api_reports_url
    assert_response :unauthorized

    post api_reports_url,
      params: { report: { title: "No access", source_text: "Nguồn", translation_text: "Source" } },
      headers: { "X-CSRF-Token" => @csrf_token },
      as: :json
    assert_response :unauthorized

    get api_report_url(123_456)
    assert_response :unauthorized

    post "/api/reports/123456/retry",
      headers: { "X-CSRF-Token" => @csrf_token },
      as: :json
    assert_response :unauthorized
  end
end
