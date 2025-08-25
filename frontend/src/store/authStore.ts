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
        set({ loading: true })
        try {
          await authService.sendOTP(email)
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
          // Verify token is still valid
          authService.verifyToken()
            .then((response) => {
              set({ user: response.data.user })
            })
            .catch(() => {
              set({ user: null, tokens: null })
            })
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
