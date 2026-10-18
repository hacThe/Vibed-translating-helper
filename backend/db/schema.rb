# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_18_000000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "reports", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "title", null: false
    t.string "source_url"
    t.text "source_text", null: false
    t.text "translation_text", null: false
    t.string "status", default: "queued", null: false
    t.string "provider", null: false
    t.string "model", null: false
    t.string "prompt_version", default: "v1", null: false
    t.string "schema_version", default: "v1", null: false
    t.jsonb "result"
    t.integer "corrections_count", default: 0, null: false
    t.text "error_message"
    t.datetime "started_at"
    t.datetime "completed_at"
    t.datetime "failed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "mode", null: false
    t.index ["status"], name: "index_reports_on_status"
    t.index ["user_id", "created_at"], name: "index_reports_on_user_id_and_created_at", order: { created_at: :desc }
    t.index ["user_id"], name: "index_reports_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", null: false
    t.string "password_digest", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "reports", "users"
end
