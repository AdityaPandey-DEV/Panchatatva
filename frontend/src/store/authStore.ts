import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '@/services/authService'

export interface User {
  id: string
  email: string
  role: 'client' | 'lawyer' | 'judge' | 'admin'
  profile: any
  isVerified: boolean
  hasProfile: boolean
}

interface AuthState {
  user: User | null
  tokens: {
    accessToken: string
    refreshToken: string
  } | null
  loading: boolean
  sendOTP: (email: string) => Promise<void>
  verifyOTP: (email: string, otp: string) => Promise<void>
  registerUser: (email: string, otp: string, name: string, role: string) => Promise<void>
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      loading: false,

      sendOTP: async (email: string) => {
        console.log('AuthStore: Sending OTP to:', email)
        set({ loading: true })
        try {
          const result = await authService.sendOTP(email)
          console.log('AuthStore: OTP sent successfully:', result)
        } catch (error) {
          console.error('AuthStore: OTP send failed:', error)
          throw error
        } finally {
          set({ loading: false })
        }
      },

      verifyOTP: async (email: string, otp: string) => {
        set({ loading: true })
        try {
          const response = await authService.verifyOTP(email, otp)
          set({
            user: response.data.user,
            tokens: response.data.tokens,
            loading: false
          })
        } catch (error) {
          set({ loading: false })
          throw error
        }
      },

      registerUser: async (email: string, otp: string, name: string, role: string) => {
        console.log('AuthStore: Registering user:', { email, name, role })
        set({ loading: true })
        try {
          const response = await authService.register(email, otp, name, role)
          console.log('AuthStore: Registration successful:', response)
          set({
            user: response.data.user,
            tokens: response.data.tokens,
            loading: false
          })
        } catch (error) {
          console.error('AuthStore: Registration failed:', error)
          set({ loading: false })
          throw error
        }
      },

      resetPassword: async (email: string, otp: string, newPassword: string) => {
        set({ loading: true })
        try {
          await authService.resetPassword(email, otp, newPassword)
          set({ loading: false })
        } catch (error) {
          set({ loading: false })
          throw error
        }
      },

      logout: async () => {
        try {
          await authService.logout()
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({ user: null, tokens: null })
        }
      },

      checkAuth: () => {
        const { tokens } = get()
        if (tokens?.accessToken) {
          // For demo mode, just keep the existing user if tokens exist
          // In production, you would verify with the server
          console.log('Auth check: tokens exist, keeping user logged in')
        }
      },

      setUser: (user: User) => {
        set({ user })
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens
      })
    }
  )
)
