module Reports
  class ReportDefinition
    PROMPTS = {
      "v1" => PromptV1,
      "vn_en_v1" => PromptVnEnV1,
      "vn_zh_cn_v1" => PromptVnZhCnV1
    }.freeze

    def self.for(version)
      new(version, PROMPTS.fetch(version))
    rescue KeyError
      raise PermanentProviderError, "Unsupported report version"
    end

    attr_reader :version, :prompt

    def initialize(version, prompt)
      @version = version
      @prompt = prompt
    end

    def provider_schema
      ProviderSchema.for(version)
    end

    def validator(translation_text:)
      V1Validator.new(translation_text:, schema_version: version)
    end
  end
end
