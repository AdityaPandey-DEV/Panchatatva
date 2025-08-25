import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const authService = {
  sendOTP: async (email: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/send-otp`, { email })
    return response.data
  },

  verifyOTP: async (email: string, otp: string) => {
    const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, { email, otp })
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
