require "json"

module Reports
  class OpenAICompatibleAdapter
    def initialize(provider:, model:, api_key:, base_url:, timeout:, transport: HttpTransport.new)
      raise PermanentProviderError, "Missing API key for #{provider}" if api_key.blank?

      @provider = provider
      @model = model
      @api_key = api_key
      @base_url = base_url.to_s.delete_suffix("/")
      @timeout = timeout
      @transport = transport
    end

    def generate_report(**input)
      request(PromptV1.generation(**input))
    end

    def repair_report(previous_output:, validation_errors:, **input)
      request(PromptV1.repair(
        previous_output: previous_output,
        validation_errors: validation_errors,
        **input
      ))
    end

    private

    def request(user_prompt)
      return request_deepseek(user_prompt) if @provider == "deepseek"

      request_openai(user_prompt)
    end

    def request_openai(user_prompt)
      response = post(
        url: endpoint("responses", versioned: true),
        headers: { "Authorization" => "Bearer #{@api_key}" },
        body: {
          model: @model,
          input: [
            { role: "system", content: PromptV1.system },
            { role: "user", content: user_prompt }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "translation_report_v1",
              strict: true,
              schema: ProviderSchema.v1
            }
          }
        }
      )
      envelope = parse_envelope(response.body)
      unless envelope["status"] == "completed"
        raise PermanentProviderError, "OpenAI response did not complete"
      end

      text = envelope.fetch("output", []).filter_map do |item|
        item.fetch("content", []) if item["type"] == "message"
      end.flatten.find { |content| content["type"] == "output_text" }&.fetch("text", nil)
      raise PermanentProviderError, "OpenAI response contained no output text" if text.blank?

      parse_candidate(text)
    end

    def request_deepseek(user_prompt)
      response = post(
        url: endpoint("chat/completions"),
        headers: { "Authorization" => "Bearer #{@api_key}" },
        body: {
          model: @model,
          messages: [
            {
              role: "system",
              content: "#{PromptV1.system}\nSchema:\n#{JSON.generate(ProviderSchema.v1)}"
            },
            { role: "user", content: user_prompt }
          ],
          response_format: { type: "json_object" }
        }
      )
      envelope = parse_envelope(response.body)
      choice = envelope.fetch("choices", []).first
      raise PermanentProviderError, "DeepSeek response contained no choice" unless choice
      unless choice["finish_reason"] == "stop"
        raise PermanentProviderError, "DeepSeek response did not complete"
      end

      text = choice.dig("message", "content")
      raise TransientProviderError, "DeepSeek response contained no output text" if text.blank?

      parse_candidate(text)
    end

    def endpoint(path, versioned: false)
      prefix = versioned && !@base_url.end_with?("/v1") ? "/v1" : ""
      "#{@base_url}#{prefix}/#{path}"
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
