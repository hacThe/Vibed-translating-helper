class Report < ApplicationRecord
  STATUSES = %w[queued processing completed failed].freeze
  PROVIDERS = %w[fake openai deepseek anthropic].freeze
  MODES = %w[vn_en vn_zh_cn].freeze
  MODE_VERSIONS = {
    "vn_en" => "vn_en_v1",
    "vn_zh_cn" => "vn_zh_cn_v1"
  }.freeze

  belongs_to :user

  enum :status, STATUSES.index_by(&:itself), validate: true

  after_create_commit :enqueue_generation

  validates :title, presence: true, length: { maximum: 200 }
  validates :source_text, :translation_text, presence: true, length: { maximum: 30_000 }
  validates :provider, inclusion: { in: PROVIDERS }
  validates :mode, inclusion: { in: MODES }
  validates :model, :prompt_version, :schema_version, presence: true
  validates :corrections_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :input_snapshots_are_immutable, on: :update
  validate :status_transition_is_valid, on: :update
  validate :versions_match_mode

  def mark_processing!
    with_lock do
      return false unless queued?

      update!(status: :processing, started_at: Time.current, failed_at: nil, error_message: nil)
    end
  end

  def mark_completed!(result:, corrections_count:)
    with_lock do
      return false unless processing?

      update!(
        status: :completed,
        result: result,
        corrections_count: corrections_count,
        completed_at: Time.current,
        failed_at: nil,
        error_message: nil
      )
    end
  end

  def mark_failed!(diagnostic:)
    with_lock do
      return false unless processing?

      update!(status: :failed, failed_at: Time.current, error_message: diagnostic.to_s.first(500))
    end
  end

  def retry_generation!
    retried = with_lock do
      next false unless failed?

      update!(
        status: :queued,
        result: nil,
        corrections_count: 0,
        started_at: nil,
        completed_at: nil,
        failed_at: nil,
        error_message: nil
      )
      true
    end
    GenerateReportJob.perform_later(self) if retried
    retried
  end

  private

  def enqueue_generation
    GenerateReportJob.perform_later(self)
  end

  def input_snapshots_are_immutable
    snapshot_fields = %w[user_id mode title source_url source_text translation_text]
    return unless snapshot_fields.any? { |field| will_save_change_to_attribute?(field) }

    errors.add(:base, "Submitted report inputs cannot be changed")
  end

  def status_transition_is_valid
    change = status_change_to_be_saved
    return unless change

    allowed = {
      "queued" => [ "processing" ],
      "processing" => %w[completed failed],
      "failed" => [ "queued" ]
    }
    return if allowed.fetch(change.first, []).include?(change.last)

    errors.add(:status, "cannot transition from #{change.first} to #{change.last}")
  end

  def versions_match_mode
    expected = MODE_VERSIONS[mode]
    return unless expected

    allowed = mode == "vn_en" ? [ "v1", expected ] : [ expected ]
    errors.add(:prompt_version, "does not match mode #{mode}") unless allowed.include?(prompt_version)
    errors.add(:schema_version, "does not match mode #{mode}") unless allowed.include?(schema_version)
  end
end
