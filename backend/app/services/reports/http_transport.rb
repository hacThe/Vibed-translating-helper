require "json"
require "net/http"

module Reports
  class HttpTransport
    Response = Data.define(:status, :body)

    def post(url:, headers:, body:, timeout:)
      uri = URI(url)
      request = Net::HTTP::Post.new(uri)
      headers.each { |name, value| request[name] = value }
      request["Content-Type"] = "application/json"
      request.body = JSON.generate(body)

      response = Net::HTTP.start(
        uri.host,
        uri.port,
        use_ssl: uri.scheme == "https",
        open_timeout: timeout,
        read_timeout: timeout,
        write_timeout: timeout
      ) { |http| http.request(request) }

      Response.new(response.code.to_i, response.body.to_s)
    end
  end
end
