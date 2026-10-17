require "test_helper"

class Reports::ProviderFactoryTest < ActiveSupport::TestCase
  Report = Data.define(:provider, :model)

  test "builds each supported real provider from environment configuration" do
    with_environment(
      "OPENAI_API_KEY" => "openai-key",
      "DEEPSEEK_API_KEY" => "deepseek-key",
      "ANTHROPIC_API_KEY" => "anthropic-key"
    ) do
      assert_instance_of Reports::OpenAICompatibleAdapter, build("openai")
      assert_instance_of Reports::OpenAICompatibleAdapter, build("deepseek")
      assert_instance_of Reports::AnthropicAdapter, build("anthropic")
    end
  end

  test "missing credentials fail immediately and safely" do
    with_environment("OPENAI_API_KEY" => nil) do
      error = assert_raises(Reports::PermanentProviderError) { build("openai") }

      assert_equal "Missing API key for openai", error.message
    end
  end

  test "invalid request timeout fails as provider configuration" do
    with_environment("OPENAI_API_KEY" => "key", "AI_REQUEST_TIMEOUT_SECONDS" => "never") do
      error = assert_raises(Reports::PermanentProviderError) { build("openai") }

      assert_equal "Invalid AI request timeout", error.message
    end
  end

  private

  def build(provider)
    Reports::ProviderFactory.build(Report.new(provider, "test-model"))
  end

  def with_environment(values)
    original = values.to_h { |key, _| [ key, ENV[key] ] }
    values.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
    yield
  ensure
    original.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end
end
