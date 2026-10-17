class ApplicationController < ActionController::API
  include ActionController::Cookies
  include ActionController::RequestForgeryProtection

  protect_from_forgery with: :exception

  rescue_from ActionController::InvalidAuthenticityToken do
    render json: { error: "Invalid authenticity token" }, status: :unprocessable_entity
  end

  private

  def current_user
    @current_user ||= User.find_by(id: session[:user_id])
  end

  def require_authentication
    return if current_user

    render json: { error: "Authentication required" }, status: :unauthorized
  end
end
