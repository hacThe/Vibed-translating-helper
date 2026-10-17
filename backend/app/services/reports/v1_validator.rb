require "json"
require "json_schemer"

module Reports
  class V1Validator
    Validation = Data.define(:result, :errors) do
      def valid?
        errors.empty?
      end
    end

    SCHEMA = JSONSchemer.schema(
      JSON.parse(Rails.root.join("config/report_schemas/v1.json").read)
    )

    def initialize(translation_text:)
      @submitted_paragraphs = translation_text.split(/\r?\n[ \t]*\r?\n/)
    end

    def validate(candidate)
      result = parse(candidate)
      return Validation.new(nil, [ "Output is not valid JSON" ]) unless result.is_a?(Hash)

      errors = SCHEMA.validate(result).map { |error| schema_error(error) }
      return Validation.new(nil, errors) if errors.any?

      enriched = result.deep_dup
      errors = semantic_errors(enriched)
      Validation.new(errors.empty? ? enriched : nil, errors)
    rescue JSON::ParserError
      Validation.new(nil, [ "Output is not valid JSON" ])
    end

    private

    def parse(candidate)
      candidate.is_a?(String) ? JSON.parse(candidate) : candidate
    end

    def schema_error(error)
      location = error.fetch("data_pointer", "")
      "Schema violation at #{location.presence || "/"}: #{error.fetch("type")}"
    end

    def semantic_errors(result)
      paragraphs = result.fetch("paragraphs")
      errors = []
      errors << "Required strings cannot be blank" if contains_blank_string?(result)

      if paragraphs.length != @submitted_paragraphs.length
        errors << "Paragraph count must match the submitted translation"
        return errors
      end

      paragraphs.each_with_index do |paragraph, position|
        expected_index = position + 1
        errors << "Paragraph indexes must be sequential" unless paragraph.fetch("index") == expected_index
        if paragraph.fetch("translation_text") != @submitted_paragraphs.fetch(position)
          errors << "Paragraph #{expected_index} must exactly match the submitted translation"
          next
        end

        enrich_notes(paragraph, errors)
      end

      errors
    end

    def contains_blank_string?(value)
      case value
      when Hash
        value.values.any? { |child| contains_blank_string?(child) }
      when Array
        value.any? { |child| contains_blank_string?(child) }
      when String
        value.blank?
      else
        false
      end
    end

    def enrich_notes(paragraph, errors)
      ranges = []

      paragraph.fetch("notes").each do |note|
        character_offset = occurrence_offset(
          paragraph.fetch("translation_text"),
          note.fetch("original_text"),
          note.fetch("occurrence")
        )

        unless character_offset
          errors << "Requested occurrence does not exist in paragraph #{paragraph.fetch("index")}"
          next
        end

        text = paragraph.fetch("translation_text")
        start_offset = utf16_length(text[0...character_offset])
        end_offset = start_offset + utf16_length(note.fetch("original_text"))
        if ranges.any? { |start_at, end_at| start_offset < end_at && end_offset > start_at }
          errors << "Highlight ranges overlap in paragraph #{paragraph.fetch("index")}"
          next
        end

        ranges << [ start_offset, end_offset ]
        note["start_offset"] = start_offset
        note["end_offset"] = end_offset
      end
    end

    def occurrence_offset(text, needle, requested_occurrence)
      offset = 0
      found = nil

      requested_occurrence.times do
        found = text.index(needle, offset)
        return nil unless found

        offset = found + 1
      end

      found
    end

    def utf16_length(text)
      text.encode(Encoding::UTF_16LE).bytesize / 2
    end
  end
end
