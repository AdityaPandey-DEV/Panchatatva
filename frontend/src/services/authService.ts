import axios from 'axios'

const API_BASE_URL = 'http://localhost:5001/api'

export const authService = {
  sendOTP: async (email: string) => {
    console.log('AuthService: Sending OTP to:', email)
    const response = await axios.post(`${API_BASE_URL}/auth/send-otp`, { email })
    console.log('AuthService: OTP response:', response.data)
    return response.data
  },

  verifyOTP: async (email: string, otp: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, { email, otp })
    return response.data
  },

  register: async (email: string, otp: string, name: string, role: string) => {
    console.log('AuthService: Registering user:', { email, name, role })
    const response = await axios.post(`${API_BASE_URL}/auth/register`, { 
      email, 
      otp, 
      profile: { name, role } 
    })
    console.log('AuthService: Registration response:', response.data)
    return response.data
  },

  resetPassword: async (email: string, otp: string, newPassword: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/reset-password`, { 
      email, 
      otp, 
      newPassword 
    })
    return response.data
  },

  logout: async () => {
    const response = await axios.post(`${API_BASE_URL}/auth/logout`)
    return response.data
  },

  verifyToken: async () => {
    const response = await axios.get(`${API_BASE_URL}/users/profile`)
    return response.data
  },

  refreshToken: async (refreshToken: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
    return response.data
  }
}
