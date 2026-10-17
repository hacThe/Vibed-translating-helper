module Reports
  class FakeAdapter
    def initialize(model:)
      @model = model
    end

    def generate_report(**input)
      case @model
      when "fake-repair-v1", "fake-invalid-v1"
        invalid_report
      when "fake-transient-v1"
        raise TransientProviderError, "Simulated temporary provider outage"
      else
        build_report(**input)
      end
    end

    def repair_report(previous_output:, validation_errors:, **input)
      @model == "fake-invalid-v1" ? invalid_report : build_report(**input)
    end

    private

    def invalid_report
      { "schema_version" => "v1" }
    end

    def build_report(title:, translation_text:, schema_version:, **)
      paragraphs = translation_text.split(/\r?\n[ \t]*\r?\n/)
      annotated = false

      report_paragraphs = paragraphs.each_with_index.map do |text, index|
        notes = []
        if !annotated && text.include?("very big")
          annotated = true
          notes << {
            "original_text" => "very big",
            "occurrence" => 1,
            "correction" => "severe",
            "category" => "diction",
            "explanation_en" => "“Severe” is more precise for serious congestion.",
            "note_vi" => "“Severe” tự nhiên và chính xác hơn khi mô tả ùn tắc nghiêm trọng."
          }
        end

        {
          "index" => index + 1,
          "translation_text" => text,
          "revised_text" => text.sub("very big", "severe"),
          "notes" => notes
        }
      end

      {
        "schema_version" => schema_version,
        "revised_title" => title,
        "paragraphs" => report_paragraphs,
        "revised_article" => report_paragraphs.map { |paragraph| paragraph.fetch("revised_text") }.join("\n\n"),
        "key_lessons" => annotated ? [
          {
            "title" => "Choose precise intensity words",
            "explanation" => "Specific adjectives make descriptions clearer and more natural.",
            "example" => "Use “severe congestion” instead of “very big congestion.”"
          }
        ] : [],
        "editing_checklist" => [
          {
            "title" => "Read for precision",
            "description" => "Replace broad intensifiers with words that fit the context."
          }
        ]
      }
    end
  end
end
