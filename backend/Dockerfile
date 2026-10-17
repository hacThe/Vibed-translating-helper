FROM ruby:4.0.1-bookworm

RUN apt-get update -qq \
  && apt-get install --no-install-recommends -y libpq-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .

EXPOSE 3000

CMD ["bin/rails", "server", "-b", "0.0.0.0"]
