class GenerateReportJob < ApplicationJob
  queue_as :default

  retry_on Reports::TransientProviderError, wait: :polynomially_longer, attempts: 3 do |job, _error|
    report = job.arguments.first
    report.mark_failed!(diagnostic: "Provider request failed after three attempts")
  end

  def perform(report)
    Reports::Generator.new(report).call
  rescue Reports::TransientProviderError
    raise
  rescue Reports::InvalidResultError
    report.mark_failed!(diagnostic: "Report output failed validation after repair")
  rescue Reports::PermanentProviderError
    report.mark_failed!(diagnostic: "Provider rejected the report request")
  rescue StandardError => error
    Rails.logger.error("GenerateReportJob failed for report #{report.id}: #{error.class}: #{error.message}")
    report.mark_failed!(diagnostic: "Unexpected report generation failure")
  end
end
