require "test_helper"

class ReportTest < ActiveSupport::TestCase
  test "submitted input snapshots cannot be edited" do
    user = User.create!(email: "learner@example.com", password: "correct password")
    report = user.reports.create!(
      title: "Original title",
      source_url: "https://example.com/original",
      source_text: "Văn bản gốc.",
      translation_text: "Original translation.",
      provider: "fake",
      model: "fake-v1",
      prompt_version: "v1",
      schema_version: "v1"
    )

    assert_not report.update(
      title: "Changed title",
      source_text: "Đã thay đổi.",
      translation_text: "Changed translation."
    )
    assert_includes report.errors[:base], "Submitted report inputs cannot be changed"
    assert_equal "Original title", report.reload.title
  end

  test "submission fields, status, and correction count are validated" do
    user = User.create!(email: "learner@example.com", password: "correct password")
    report = user.reports.build(
      title: "x" * 201,
      source_text: "x" * 30_001,
      translation_text: "",
      status: "unknown",
      provider: "unsupported",
      model: "",
      prompt_version: "v1",
      schema_version: "v1",
      corrections_count: -1
    )

    assert_not report.valid?
    assert report.errors.of_kind?(:title, :too_long)
    assert report.errors.of_kind?(:source_text, :too_long)
    assert report.errors.of_kind?(:translation_text, :blank)
    assert report.errors.of_kind?(:status, :inclusion)
    assert report.errors.of_kind?(:provider, :inclusion)
    assert report.errors.of_kind?(:model, :blank)
    assert report.errors.of_kind?(:corrections_count, :greater_than_or_equal_to)
  end

  test "only allows queued to processing to completed or failed transitions" do
    user = User.create!(email: "learner@example.com", password: "correct password")
    report = user.reports.create!(
      title: "Transition test",
      source_text: "Văn bản.",
      translation_text: "Text.",
      provider: "fake",
      model: "fake-v1",
      prompt_version: "v1",
      schema_version: "v1"
    )

    assert_not report.update(status: :completed)
    assert_includes report.errors[:status], "cannot transition from queued to completed"
    report.reload
    assert report.mark_processing!
    assert report.mark_completed!(result: { "schema_version" => "v1" }, corrections_count: 0)
    assert_not report.mark_failed!(diagnostic: "too late")
    assert_predicate report, :completed?
  end
end
