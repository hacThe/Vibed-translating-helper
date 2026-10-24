module Api
  class ReportsController < ApplicationController
    before_action :require_authentication

    PER_PAGE = 20

    def index
      page = [ params.fetch(:page, 1).to_i, 1 ].max
      scope = current_user.reports.order(created_at: :desc, id: :desc)
      total_count = scope.count
      reports = scope.offset((page - 1) * PER_PAGE).limit(PER_PAGE)
      total_pages = (total_count.to_f / PER_PAGE).ceil

      render json: {
        reports: reports.map { |report| metadata(report) },
        pagination: {
          page: page,
          per_page: PER_PAGE,
          total_count: total_count,
          total_pages: total_pages,
          has_previous: page > 1,
          has_next: page < total_pages
        }
      }
    end

    def create
      version = Report::MODE_VERSIONS[report_params[:mode]]
      report = current_user.reports.build(
        report_params.merge(
          status: :queued,
          provider: ENV.fetch("AI_PROVIDER", "fake"),
          model: ENV.fetch("AI_MODEL", "fake-v1"),
          prompt_version: version,
          schema_version: version
        )
      )

      if report.save
        render json: metadata(report), status: :created
      else
        render json: { errors: report.errors.to_hash }, status: :unprocessable_entity
      end
    end

    def show
      report = current_user.reports.find_by(id: params[:id])
      return render json: { error: "Report not found" }, status: :not_found unless report

      payload = metadata(report)
      if report.completed?
        payload.merge!(
          source_url: report.source_url,
          source_text: report.source_text,
          translation_text: report.translation_text,
          result: report.result
        )
      end

      render json: payload
    end

    def retry
      report = current_user.reports.find_by(id: params[:id])
      return render json: { error: "Report not found" }, status: :not_found unless report

      if report.retry_generation!
        render json: metadata(report), status: :accepted
      else
        render json: { error: "Only failed reports can be retried" }, status: :unprocessable_entity
      end
    end

    private

    def report_params
      params.expect(report: %i[mode title source_url source_text translation_text])
    end

    def metadata(report)
      {
        id: report.id,
        title: report.title,
        mode: report.mode,
        status: report.status,
        provider: report.provider,
        model: report.model,
        prompt_version: report.prompt_version,
        schema_version: report.schema_version,
        corrections_count: report.corrections_count,
        created_at: report.created_at,
        queued_at: report.queued_at,
        started_at: report.started_at,
        completed_at: report.completed_at,
        failed_at: report.failed_at
      }
    end
  end
end
