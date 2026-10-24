class ReportTimeoutJob < ApplicationJob
  queue_as :default

  def perform(report_id, expected_started_at)
    report = Report.find_by(id: report_id)
    return unless report

    report.mark_timed_out!(expected_started_at: Time.iso8601(expected_started_at))
  end
end
