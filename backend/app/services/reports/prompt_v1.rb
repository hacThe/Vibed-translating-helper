module Reports
  class PromptV1
    def self.system
      <<~PROMPT
        You are an expert Vietnamese-to-English translation tutor. Return JSON only.
        Follow report schema v1 exactly. Preserve every submitted English paragraph
        verbatim in translation_text. Each note's original_text must be an exact
        substring, occurrence is one-based, and highlights must not overlap. Use only
        meaning, diction, grammar, or detail as categories. Do not add highlight offsets.
      PROMPT
    end

    def self.generation(title:, source_text:, translation_text:, **)
      <<~PROMPT
        Create the translation review as JSON matching the supplied schema.

        <title>#{title}</title>
        <vietnamese_source>#{source_text}</vietnamese_source>
        <submitted_english>#{translation_text}</submitted_english>
      PROMPT
    end

    def self.repair(previous_output:, validation_errors:, **input)
      <<~PROMPT
        Repair the previous JSON report. Return a complete replacement JSON object.

        Validation errors:
        #{validation_errors.join("\n")}

        Previous output:
        #{previous_output.is_a?(String) ? previous_output : JSON.generate(previous_output)}

        Original request:
        #{generation(**input)}
      PROMPT
    end
  end
end
