class AddModeToReports < ActiveRecord::Migration[8.1]
  def up
    add_column :reports, :mode, :string
    execute "UPDATE reports SET mode = 'vn_en' WHERE mode IS NULL"
    change_column_null :reports, :mode, false
  end

  def down
    remove_column :reports, :mode
  end
end
