require "json"

module Reports
  class ProviderSchema
    UNSUPPORTED_CONSTRAINTS = %w[minLength maxLength minimum maximum minItems maxItems].freeze

    SCHEMA_FILES = {
      "v1" => "v1.json",
      "vn_en_v1" => "v1.json",
      "vn_zh_cn_v1" => "vn_zh_cn_v1.json"
    }.freeze

    def self.for(version)
      schema = JSON.parse(Rails.root.join("config/report_schemas", SCHEMA_FILES.fetch(version)).read)
      schema.dig("properties", "schema_version")["const"] = version
      schema.delete("$schema")
      simplify(schema)
    end

    def self.v1
      self.for("v1")
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
