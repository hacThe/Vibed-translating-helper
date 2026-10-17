module Api
  class SessionsController < ApplicationController
    def show
      render json: session_payload
    end

    def create
      user = User.find_by(email: params[:email].to_s.strip.downcase)

      unless user&.authenticate(params[:password])
        return render json: { error: "Invalid email or password" }, status: :unauthorized
      end

      reset_session
      session[:user_id] = user.id

      render json: session_payload(user)
    end

    def destroy
      reset_session
      render json: session_payload(nil)
    end

    private

    def session_payload(user = current_user)
      {
        authenticated: user.present?,
        user: user && { id: user.id, email: user.email },
        csrf_token: form_authenticity_token
      }
    end
  end
end
