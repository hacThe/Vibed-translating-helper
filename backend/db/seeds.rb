email = ENV.fetch("SEED_USER_EMAIL", "").strip.downcase
password = ENV.fetch("SEED_USER_PASSWORD", "")

if email.blank? || password.blank?
  raise "SEED_USER_EMAIL and SEED_USER_PASSWORD must both be set"
end

user = User.find_or_initialize_by(email: email)
user.password = password
user.save!

puts "Seeded user #{user.email}"
