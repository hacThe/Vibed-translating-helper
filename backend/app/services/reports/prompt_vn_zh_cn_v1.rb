module Reports
  class PromptVnZhCnV1
    def self.system
      <<~PROMPT
        You are an expert Vietnamese-to-Simplified Chinese translation tutor. Return JSON only.
        Use natural modern written Mandarin and preserve the source register. Follow report schema
        vn_zh_cn_v1 exactly. Preserve every submitted Chinese paragraph verbatim in
        translation_text. Each note's original_text must be an exact substring, occurrence is
        one-based, and highlights must not overlap. Use only meaning, diction, grammar, detail,
        or sentence_structure as categories. Every correction must include correction_pinyin
        with tone marks. Write explanation_vi, key-lesson titles and explanations, and editing
        checklist titles and descriptions in Vietnamese. Write revised_title, corrections,
        revisions, and examples in Simplified Chinese. Do not add highlight offsets.
      PROMPT
    end

    def self.generation(title:, source_text:, translation_text:, **)
      <<~PROMPT
        Create the translation review as JSON matching the supplied schema.

        <title>#{title}</title>
        <vietnamese_source>#{source_text}</vietnamese_source>
        <submitted_simplified_chinese>#{translation_text}</submitted_simplified_chinese>
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
