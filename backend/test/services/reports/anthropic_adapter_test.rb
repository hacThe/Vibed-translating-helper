require "test_helper"

class Reports::AnthropicAdapterTest < ActiveSupport::TestCase
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

  test "Messages API returns a parsed structured-output candidate" do
    transport = StubTransport.new(
      status: 200,
      body: {
        stop_reason: "end_turn",
        content: [ { type: "text", text: '{"schema_version":"v1"}' } ]
      }.to_json
    )
    adapter = Reports::AnthropicAdapter.new(
      model: "claude-test",
      api_key: "test-key",
      base_url: "https://api.anthropic.test",
      timeout: 12,
      transport: transport
    )

    candidate = adapter.generate_report(**provider_input)

    assert_equal({ "schema_version" => "v1" }, candidate)
    assert_equal "https://api.anthropic.test/v1/messages", transport.request.fetch(:url)
    headers = transport.request.fetch(:headers)
    assert_equal "test-key", headers.fetch("x-api-key")
    assert_equal "2023-06-01", headers.fetch("anthropic-version")
    body = transport.request.fetch(:body)
    assert_equal "claude-test", body.fetch(:model)
    assert_equal "json_schema", body.dig(:output_config, :format, :type)
    assert_equal Reports::ProviderSchema.v1, body.dig(:output_config, :format, :schema)
  end

  test "classifies overload as transient and invalid requests as permanent" do
    overloaded = build_adapter(
      StubTransport.new(status: 529, body: '{"error":{"message":"overloaded"}}')
    )
    invalid = build_adapter(
      StubTransport.new(status: 400, body: '{"error":{"message":"invalid"}}')
    )

    assert_raises(Reports::TransientProviderError) { overloaded.generate_report(**provider_input) }
    error = assert_raises(Reports::PermanentProviderError) do
      invalid.generate_report(**provider_input)
    end
    assert_equal "Provider HTTP 400", error.message
  end

  private

  def build_adapter(transport)
    Reports::AnthropicAdapter.new(
      model: "claude-test",
      api_key: "test-key",
      base_url: "https://api.anthropic.test",
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
