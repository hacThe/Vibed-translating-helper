require "json"

module Reports
  class AnthropicAdapter
    MAX_OUTPUT_TOKENS = 8_192

    def initialize(model:, api_key:, base_url:, timeout:, transport: HttpTransport.new)
      raise PermanentProviderError, "Missing API key for anthropic" if api_key.blank?

      @model = model
      @api_key = api_key
      @base_url = base_url.to_s.delete_suffix("/")
      @timeout = timeout
      @transport = transport
    end

    def generate_report(**input)
      request_for(input) { |prompt| prompt.generation(**input) }
    end

    def repair_report(previous_output:, validation_errors:, **input)
      request_for(input) do |prompt|
        prompt.repair(
          previous_output: previous_output,
          validation_errors: validation_errors,
          **input
        )
      end
    end

    private

    def request_for(input)
      prompt = ReportDefinition.for(input.fetch(:prompt_version)).prompt
      schema_version = input.fetch(:schema_version)
      request(yield(prompt), system_prompt: prompt.system, schema_version:)
    end

    def request(user_prompt, system_prompt:, schema_version:)
      response = post(
        url: "#{@base_url}/v1/messages",
        headers: {
          "x-api-key" => @api_key,
          "anthropic-version" => "2023-06-01"
        },
        body: {
          model: @model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: system_prompt,
          messages: [ { role: "user", content: user_prompt } ],
          output_config: {
            format: {
              type: "json_schema",
              schema: ProviderSchema.for(schema_version)
            }
          }
        }
      )
      envelope = parse_envelope(response.body)
      unless envelope["stop_reason"] == "end_turn"
        raise PermanentProviderError, "Anthropic response did not complete"
      end

      text = envelope.fetch("content", []).find { |block| block["type"] == "text" }&.fetch("text", nil)
      raise PermanentProviderError, "Anthropic response contained no output text" if text.blank?

      parse_candidate(text)
    end

    def post(url:, headers:, body:)
      response = @transport.post(url: url, headers: headers, body: body, timeout: @timeout)
      classify_status!(response.status)
      response
    rescue Timeout::Error, IOError, SystemCallError, SocketError => error
      raise TransientProviderError, error.class.name
    end

    def classify_status!(status)
      return if status.between?(200, 299)
      raise TransientProviderError, "Provider HTTP #{status}" if status == 408 || status == 409 || status == 429 || status >= 500

      raise PermanentProviderError, "Provider HTTP #{status}"
    end

    def parse_envelope(body)
      JSON.parse(body)
    rescue JSON::ParserError => error
      raise TransientProviderError, "Invalid provider response: #{error.class}"
    end

    def parse_candidate(text)
      JSON.parse(text)
    rescue JSON::ParserError
      text
    end
  end
end
