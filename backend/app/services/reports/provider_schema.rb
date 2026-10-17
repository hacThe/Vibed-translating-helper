require "json"

module Reports
  class ProviderSchema
    UNSUPPORTED_CONSTRAINTS = %w[minLength maxLength minimum maximum minItems maxItems].freeze

    def self.v1
      schema = JSON.parse(Rails.root.join("config/report_schemas/v1.json").read)
      schema.delete("$schema")
      simplify(schema)
    end

    def self.simplify(value)
      case value
      when Hash
        UNSUPPORTED_CONSTRAINTS.each { |key| value.delete(key) }
        if value["properties"].is_a?(Hash)
          value["properties"].delete("start_offset")
          value["properties"].delete("end_offset")
        end
        value.each_value { |child| simplify(child) }
      when Array
        value.each { |child| simplify(child) }
      end
      value
    end
    private_class_method :simplify
  end
end
