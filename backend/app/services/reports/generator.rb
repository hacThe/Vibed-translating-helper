module Reports
  class Generator
    def initialize(report, adapter: nil)
      @report = report
      @adapter = adapter
    end

    def call
      return @report.result if @report.reload.completed?

      @report.mark_processing! if @report.queued?
      return unless @report.processing?

      adapter = @adapter || ProviderFactory.build(@report)
      candidate = adapter.generate_report(**provider_input)
      validation = validator.validate(candidate)

      unless validation.valid?
        candidate = adapter.repair_report(
          **provider_input,
          previous_output: candidate,
          validation_errors: validation.errors
        )
        validation = validator.validate(candidate)
      end

      raise InvalidResultError, validation.errors.join("; ") unless validation.valid?

      correction_count = validation.result.fetch("paragraphs").sum do |paragraph|
        paragraph.fetch("notes").length
      end
      @report.mark_completed!(result: validation.result, corrections_count: correction_count)
      validation.result
    end

    private

    def provider_input
      {
        source_text: @report.source_text,
        translation_text: @report.translation_text,
        title: @report.title,
        schema_version: @report.schema_version,
        prompt_version: @report.prompt_version
      }
    end

    def validator
      @validator ||= ReportDefinition.for(@report.schema_version).validator(
        translation_text: @report.translation_text
      )
    end
  end
end
