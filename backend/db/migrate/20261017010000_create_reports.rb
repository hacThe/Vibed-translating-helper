class CreateReports < ActiveRecord::Migration[8.1]
  def change
    create_table :reports do |t|
      t.references :user, null: false, foreign_key: true
      t.string :title, null: false
      t.string :source_url
      t.text :source_text, null: false
      t.text :translation_text, null: false
      t.string :status, null: false, default: "queued"
      t.string :provider, null: false
      t.string :model, null: false
      t.string :prompt_version, null: false, default: "v1"
      t.string :schema_version, null: false, default: "v1"
      t.jsonb :result
      t.integer :corrections_count, null: false, default: 0
      t.text :error_message
      t.datetime :started_at
      t.datetime :completed_at
      t.datetime :failed_at

      t.timestamps
    end

    add_index :reports, %i[user_id created_at], order: { created_at: :desc }
    add_index :reports, :status
  end
end
