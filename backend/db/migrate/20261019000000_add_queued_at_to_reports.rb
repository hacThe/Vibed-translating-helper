class AddQueuedAtToReports < ActiveRecord::Migration[8.1]
  def up
    add_column :reports, :queued_at, :datetime
    execute "UPDATE reports SET queued_at = created_at WHERE queued_at IS NULL"
    change_column_null :reports, :queued_at, false
  end

  def down
    remove_column :reports, :queued_at
  end
end
