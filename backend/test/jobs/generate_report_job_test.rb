require "test_helper"

class GenerateReportJobTest < ActiveJob::TestCase
  test "fake provider completes a queued report through the validated result path" do
    user = User.create!(email: "learner@example.com", password: "correct password")
    report = user.reports.create!(
      title: "Traffic in the city",
      mode: "vn_en",
      source_text: "Ùn tắc giao thông rất lớn.",
      translation_text: "The traffic jam is very big.",
      provider: "fake",
      model: "fake-v1",
      prompt_version: "vn_en_v1",
      schema_version: "vn_en_v1"
    )

    GenerateReportJob.perform_now(report)

    report.reload
    assert_predicate report, :completed?
    assert report.started_at
    assert report.completed_at
    assert_equal 1, report.corrections_count
    assert_equal "vn_en_v1", report.result.fetch("schema_version")
    note = report.result.fetch("paragraphs").first.fetch("notes").first
    assert_equal "very big", note.fetch("original_text")
    assert_equal 19, note.fetch("start_offset")
    assert_equal 27, note.fetch("end_offset")
  end

  test "fake provider completes a simplified Chinese report with correction pinyin" do
    user = User.create!(email: "chinese-learner@example.com", password: "correct password")
    report = user.reports.create!(
      title: "Giao thông thành phố",
      mode: "vn_zh_cn",
      source_text: "Giao thông ngày càng quan trọng.",
      translation_text: "交通变得很重要。",
      provider: "fake",
      model: "fake-v1",
      prompt_version: "vn_zh_cn_v1",
      schema_version: "vn_zh_cn_v1"
    )

    GenerateReportJob.perform_now(report)

    assert_predicate report.reload, :completed?
    note = report.result.fetch("paragraphs").first.fetch("notes").first
    assert_equal "sentence_structure", note.fetch("category")
    assert_equal "越来越重要", note.fetch("correction")
    assert_equal "yuè lái yuè zhòng yào", note.fetch("correction_pinyin")
    assert_equal "Cấu trúc 越来越… diễn tả mức độ tăng dần tự nhiên hơn.", note.fetch("explanation_vi")
  end

  test "repairs one invalid candidate before completing" do
    report = build_report(model: "fake-repair-v1")

    GenerateReportJob.perform_now(report)

    assert_predicate report.reload, :completed?
    assert report.result.fetch("paragraphs").first.key?("notes")
  end

  test "fails safely when output remains invalid after repair" do
    report = build_report(model: "fake-invalid-v1")

    GenerateReportJob.perform_now(report)

    assert_predicate report.reload, :failed?
    assert_equal "Report output failed validation after repair", report.error_message
    assert_nil report.result
  end

  test "transient provider errors retry twice and then fail" do
    report = build_report(model: "fake-transient-v1")
    clear_enqueued_jobs

    perform_enqueued_jobs do
      GenerateReportJob.perform_later(report)
    end

    assert_predicate report.reload, :failed?
    assert_equal "Provider request failed after three attempts", report.error_message
  end

  test "unavailable providers fail immediately with a safe diagnostic" do
    report = build_report(provider: "openai", model: "not-configured")

    assert_no_enqueued_jobs do
      GenerateReportJob.perform_now(report)
    end

    assert_predicate report.reload, :failed?
    assert_equal "Provider rejected the report request", report.error_message
  end

  test "does not regenerate a completed report" do
    report = build_report
    GenerateReportJob.perform_now(report)
    report.reload
    original_result = report.result.deep_dup
    original_updated_at = report.updated_at

    travel 1.minute do
      GenerateReportJob.perform_now(report)
    end

    assert_equal original_result, report.reload.result
    assert_equal original_updated_at, report.updated_at
  end

  private

  def build_report(provider: "fake", model: "fake-v1")
    user = User.create!(email: "learner-#{SecureRandom.hex(4)}@example.com", password: "correct password")
    user.reports.create!(
      title: "Traffic in the city",
      mode: "vn_en",
      source_text: "Ùn tắc giao thông rất lớn.",
      translation_text: "The traffic jam is very big.",
      provider: provider,
      model: model,
      prompt_version: "v1",
      schema_version: "v1"
    )
  end
end
