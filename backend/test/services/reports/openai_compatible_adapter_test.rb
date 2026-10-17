require "test_helper"

class Reports::OpenAICompatibleAdapterTest < ActiveSupport::TestCase
  class StubTransport
    attr_reader :request

    def initialize(status:, body:)
      @response = Reports::HttpTransport::Response.new(status, body)
    end

    def post(**request)
      @request = request
      @response
    end
  end

  class RaisingTransport
    def post(**)
      raise Timeout::Error
    end
  end

  test "OpenAI Responses API returns a parsed schema candidate" do
    transport = StubTransport.new(
      status: 200,
      body: {
        status: "completed",
        output: [
          { type: "message", content: [ { type: "output_text", text: '{"schema_version":"v1"}' } ] }
        ]
      }.to_json
    )
    adapter = Reports::OpenAICompatibleAdapter.new(
      provider: "openai",
      model: "gpt-test",
      api_key: "test-key",
      base_url: "https://api.openai.test",
      timeout: 12,
      transport: transport
    )

    candidate = adapter.generate_report(**provider_input)

    assert_equal({ "schema_version" => "v1" }, candidate)
    assert_equal "https://api.openai.test/v1/responses", transport.request.fetch(:url)
    assert_equal "Bearer test-key", transport.request.fetch(:headers).fetch("Authorization")
    body = transport.request.fetch(:body)
    assert_equal "gpt-test", body.fetch(:model)
    assert_equal "json_schema", body.dig(:text, :format, :type)
    assert_equal true, body.dig(:text, :format, :strict)
    assert_equal "string", body.dig(:text, :format, :schema, "properties", "schema_version", "type")
    assert_includes body.fetch(:input).last.fetch(:content), "The traffic jam is very big."
  end

  test "DeepSeek chat completions requests JSON and returns a parsed candidate" do
    transport = StubTransport.new(
      status: 200,
      body: {
        choices: [
          { finish_reason: "stop", message: { content: '{"schema_version":"v1"}' } }
        ]
      }.to_json
    )
    adapter = build_adapter(provider: "deepseek", transport: transport)

    candidate = adapter.generate_report(**provider_input)

    assert_equal({ "schema_version" => "v1" }, candidate)
    assert_equal "https://api.deepseek.test/chat/completions", transport.request.fetch(:url)
    body = transport.request.fetch(:body)
    assert_equal({ type: "json_object" }, body.fetch(:response_format))
    assert_includes body.fetch(:messages).first.fetch(:content), "JSON"
    assert_includes body.fetch(:messages).first.fetch(:content), '"schema_version"'
  end

  test "repair prompt includes validation feedback and the previous output" do
    transport = StubTransport.new(
      status: 200,
      body: {
        choices: [
          { finish_reason: "stop", message: { content: '{"schema_version":"v1"}' } }
        ]
      }.to_json
    )
    adapter = build_adapter(provider: "deepseek", transport: transport)

    adapter.repair_report(
      **provider_input,
      previous_output: '{"bad":true}',
      validation_errors: [ "summary is required" ]
    )

    prompt = transport.request.fetch(:body).fetch(:messages).last.fetch(:content)
    assert_includes prompt, "summary is required"
    assert_includes prompt, '{"bad":true}'
  end

  test "retryable HTTP and network failures are transient" do
    [ 429, 500 ].each do |status|
      adapter = build_adapter(
        provider: "deepseek",
        transport: StubTransport.new(status: status, body: "{}")
      )

      assert_raises(Reports::TransientProviderError) { adapter.generate_report(**provider_input) }
    end

    adapter = build_adapter(provider: "deepseek", transport: RaisingTransport.new)
    assert_raises(Reports::TransientProviderError) { adapter.generate_report(**provider_input) }
  end

  test "non-retryable HTTP failures are permanent without exposing the response body" do
    adapter = build_adapter(
      provider: "deepseek",
      transport: StubTransport.new(status: 401, body: '{"secret":"provider detail"}')
    )

    error = assert_raises(Reports::PermanentProviderError) do
      adapter.generate_report(**provider_input)
    end

    assert_equal "Provider HTTP 401", error.message
  end

  private

  def build_adapter(provider:, transport:)
    Reports::OpenAICompatibleAdapter.new(
      provider: provider,
      model: "test-model",
      api_key: "test-key",
      base_url: "https://api.#{provider}.test",
      timeout: 12,
      transport: transport
    )
  end

  def provider_input
    {
      title: "Traffic",
      source_text: "Ùn tắc giao thông rất lớn.",
      translation_text: "The traffic jam is very big.",
      schema_version: "v1",
      prompt_version: "v1"
    }
  end
end
