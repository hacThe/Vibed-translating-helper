require "test_helper"

class Reports::V1ValidatorTest < ActiveSupport::TestCase
  test "validates exact occurrences and derives highlight offsets" do
    candidate = valid_candidate

    validation = Reports::V1Validator.new(
      translation_text: "The road is busy. The road is blocked."
    ).validate(candidate)

    assert validation.valid?, validation.errors.join("\n")
    note = validation.result.fetch("paragraphs").first.fetch("notes").first
    assert_equal 18, note.fetch("start_offset")
    assert_equal 26, note.fetch("end_offset")
  end

  test "rejects paragraph text that is not the submitted snapshot" do
    validation = validator.validate(valid_candidate.merge(
      "paragraphs" => [ valid_candidate.fetch("paragraphs").first.merge("translation_text" => "Changed text") ]
    ))

    assert_not validation.valid?
    assert_includes validation.errors, "Paragraph 1 must exactly match the submitted translation"
  end

  test "rejects missing occurrences and overlapping highlights" do
    missing = valid_candidate
    missing.fetch("paragraphs").first.fetch("notes").first["occurrence"] = 3
    missing_validation = validator.validate(missing)

    assert_not missing_validation.valid?
    assert_includes missing_validation.errors, "Requested occurrence does not exist in paragraph 1"

    overlapping = valid_candidate
    overlapping.fetch("paragraphs").first.fetch("notes") << {
      "original_text" => "road is",
      "occurrence" => 2,
      "correction" => "street is",
      "category" => "meaning",
      "explanation_en" => "Use the intended noun.",
      "note_vi" => "Dùng danh từ đúng nghĩa."
    }
    overlap_validation = validator.validate(overlapping)

    assert_not overlap_validation.valid?
    assert_includes overlap_validation.errors, "Highlight ranges overlap in paragraph 1"
  end

  test "enforces schema categories and array limits" do
    candidate = valid_candidate
    candidate.fetch("paragraphs").first.fetch("notes").first["category"] = "style"

    validation = validator.validate(candidate)

    assert_not validation.valid?
    assert validation.errors.any? { |error| error.include?("enum") }
  end

  test "rejects required strings containing only whitespace" do
    candidate = valid_candidate.merge("revised_title" => "   ")

    validation = validator.validate(candidate)

    assert_not validation.valid?
    assert_includes validation.errors, "Required strings cannot be blank"
  end

  test "locates overlapping textual occurrences before range validation" do
    candidate = valid_candidate
    paragraph = candidate.fetch("paragraphs").first
    paragraph["translation_text"] = "aaa"
    paragraph["revised_text"] = "aa"
    paragraph["notes"] = [ paragraph.fetch("notes").first.merge(
      "original_text" => "aa",
      "occurrence" => 2
    ) ]
    candidate["revised_article"] = "aa"

    validation = Reports::V1Validator.new(translation_text: "aaa").validate(candidate)

    assert validation.valid?, validation.errors.join("\n")
    note = validation.result.fetch("paragraphs").first.fetch("notes").first
    assert_equal 1, note.fetch("start_offset")
    assert_equal 3, note.fetch("end_offset")
  end

  test "derives browser-compatible UTF-16 offsets" do
    candidate = valid_candidate
    paragraph = candidate.fetch("paragraphs").first
    paragraph["translation_text"] = "🙂 very clear"
    paragraph["revised_text"] = "🙂 crystal clear"
    paragraph["notes"] = [ paragraph.fetch("notes").first.merge(
      "original_text" => "very",
      "occurrence" => 1
    ) ]
    candidate["revised_article"] = "🙂 crystal clear"

    validation = Reports::V1Validator.new(translation_text: "🙂 very clear").validate(candidate)

    assert validation.valid?, validation.errors.join("\n")
    note = validation.result.fetch("paragraphs").first.fetch("notes").first
    assert_equal 3, note.fetch("start_offset")
    assert_equal 7, note.fetch("end_offset")
  end

  private

  def validator
    Reports::V1Validator.new(translation_text: "The road is busy. The road is blocked.")
  end

  def valid_candidate
    {
      "schema_version" => "v1",
      "revised_title" => "Clearer roads",
      "paragraphs" => [
        {
          "index" => 1,
          "translation_text" => "The road is busy. The road is blocked.",
          "revised_text" => "The road is busy and blocked.",
          "notes" => [
            {
              "original_text" => "The road",
              "occurrence" => 2,
              "correction" => "It",
              "category" => "diction",
              "explanation_en" => "A pronoun avoids repetition.",
              "note_vi" => "Đại từ giúp tránh lặp từ."
            }
          ]
        }
      ],
      "revised_article" => "The road is busy and blocked.",
      "key_lessons" => [
        { "title" => "Avoid repetition", "explanation" => "Use pronouns when clear.", "example" => "The road… It…" }
      ],
      "editing_checklist" => [
        { "title" => "Repetition", "description" => "Check repeated noun phrases." }
      ]
    }
  end
end
