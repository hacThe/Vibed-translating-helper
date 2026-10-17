module Reports
  class ProviderFactory
    DEFAULT_TIMEOUT = 120

    def self.build(report)
      case report.provider
      when "fake"
        FakeAdapter.new(model: report.model)
      when "openai"
        OpenAICompatibleAdapter.new(
          provider: report.provider,
          model: report.model,
          api_key: ENV["OPENAI_API_KEY"],
          base_url: ENV["OPENAI_BASE_URL"].presence || "https://api.openai.com",
          timeout: request_timeout
        )
      when "deepseek"
        OpenAICompatibleAdapter.new(
          provider: report.provider,
          model: report.model,
          api_key: ENV["DEEPSEEK_API_KEY"],
          base_url: ENV["DEEPSEEK_BASE_URL"].presence || "https://api.deepseek.com",
          timeout: request_timeout
        )
      when "anthropic"
        AnthropicAdapter.new(
          model: report.model,
          api_key: ENV["ANTHROPIC_API_KEY"],
          base_url: ENV["ANTHROPIC_BASE_URL"].presence || "https://api.anthropic.com",
          timeout: request_timeout
        )
      else
        raise PermanentProviderError, "Provider is not available"
      end
    end

    def self.request_timeout
      timeout = Integer(ENV.fetch("AI_REQUEST_TIMEOUT_SECONDS", DEFAULT_TIMEOUT.to_s), 10)
      raise ArgumentError unless timeout.positive?

      timeout
    rescue ArgumentError
      raise PermanentProviderError, "Invalid AI request timeout"
    end

    private_class_method :request_timeout
  end
end
