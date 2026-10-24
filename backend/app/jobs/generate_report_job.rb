class GenerateReportJob < ApplicationJob
  MAX_DURATION = 5.minutes

  queue_as :default

  retry_on Reports::TransientProviderError, wait: :polynomially_longer, attempts: 3 do |job, _error|
    report = job.arguments.first
    report.mark_failed!(diagnostic: "Provider request failed after three attempts")
  end

  def perform(report)
    return if report.reload.completed? || report.failed?

    started_now = report.queued? && report.mark_processing!
    return unless report.reload.processing?

    schedule_timeout_watchdog(report) if started_now

    remaining_time = report.started_at + MAX_DURATION - Time.current
    raise Reports::GenerationTimeoutError if remaining_time <= 0

    Timeout.timeout(remaining_time, Reports::GenerationTimeoutError) do
      Reports::Generator.new(report).call
    end
  rescue Reports::GenerationTimeoutError
    report.mark_timed_out!(expected_started_at: report.reload.started_at)
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

  private

  def schedule_timeout_watchdog(report)
    deadline = report.started_at + MAX_DURATION
    ReportTimeoutJob.set(wait_until: deadline).perform_later(report.id, report.started_at.iso8601(6))
  end
end
