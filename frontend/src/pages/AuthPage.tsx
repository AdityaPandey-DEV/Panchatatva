import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import LoadingSpinner from '@/components/ui/loading-spinner'
import { Scale, Mail, KeyRound, UserPlus, Lock, ArrowLeft } from 'lucide-react'

const AuthPage = () => {
  console.log('AuthPage rendering...')
  
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>('signin')
  const [step, setStep] = useState<'email' | 'otp' | 'profile'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'client' | 'lawyer' | 'judge'>('client')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [countdown, setCountdown] = useState(0)
  
  const { sendOTP, verifyOTP, registerUser, loading } = useAuthStore()
  
    console.log('AuthPage state:', { mode, step, email, loading })
  
  useEffect(() => {
    console.log('AuthPage mounted, current mode:', mode)
  }, [mode])
  
  const handleSendOTP = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    
    try {
      setError('')
      setSuccess('')
      
      console.log('Sending OTP to:', email, 'Mode:', mode)
      await sendOTP(email)
      console.log('OTP sent successfully')
      
      setStep('otp')
      setCountdown(300) // 5 minutes
      
      if (mode === 'register') {
        setSuccess('Account created! Please verify your email with the OTP sent.')
      } else {
        setSuccess('OTP sent to your email address.')
      }
      
      // Start countdown
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err: any) {
      console.error('OTP send error:', err)
      const errorMsg = err.response?.data?.message || 'Failed to send OTP'
      setError(errorMsg)
      setSuccess('')
    }
  }

  const handleVerifyOTP = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    
    try {
      setError('')
      setSuccess('')
      
      console.log('Verifying OTP:', { email, otp, mode, name, role })
      
      if (mode === 'register') {
        console.log('Registering user...')
        await registerUser(email, otp, name, role)
        console.log('Registration successful')
        setSuccess('Registration successful! Redirecting to dashboard...')
      } else {
        console.log('Verifying OTP for signin...')
        await verifyOTP(email, otp)
        console.log('Signin successful')
        setSuccess('Sign-in successful! Redirecting to dashboard...')
      }
      
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err: any) {
      console.error('OTP verification error:', err)
      const errorMsg = err.response?.data?.message || 'Invalid OTP'
      setError(errorMsg)
      setSuccess('')
    }
  }

  const handleForgotPassword = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    
    try {
      setError('')
      await sendOTP(email)
      setStep('otp')
      setSuccess('Password reset OTP sent to your email.')
      setCountdown(300)
      
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send reset OTP')
    }
  }

  const resetForm = () => {
    setStep('email')
    setEmail('')
    setOtp('')
    setName('')
    setRole('client')
    setError('')
    setSuccess('')
    setCountdown(0)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getTitle = () => {
    if (mode === 'register') return 'Create Account'
    if (mode === 'forgot') return 'Reset Password'
    return 'Sign In'
  }

  const getDescription = () => {
    if (step === 'otp') {
      return `Enter the 6-digit code sent to ${email}`
    }
    if (mode === 'register') {
      return 'Create your account to access the justice automation system'
    }
    if (mode === 'forgot') {
      return 'Enter your email to receive a password reset code'
    }
    return 'Enter your email address to receive an OTP'
  }

  const getIcon = () => {
    if (step === 'otp') return <KeyRound className="h-5 w-5" />
    if (mode === 'register') return <UserPlus className="h-5 w-5" />
    if (mode === 'forgot') return <Lock className="h-5 w-5" />
    return <Mail className="h-5 w-5" />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary rounded-full p-3">
              <Scale className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Panchtatva</h1>
          <p className="text-gray-600 mt-2">Justice Automation System</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getIcon()}
                <CardTitle>{getTitle()}</CardTitle>
              </div>
              {(mode !== 'signin' || step !== 'email') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (step === 'otp') {
                      setStep('email')
                      setOtp('')
                      setError('')
                      setSuccess('')
                    } else {
                      setMode('signin')
                      resetForm()
                    }
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
            </div>
            <CardDescription>{getDescription()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {step === 'email' ? (
              <>
                {mode === 'register' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Full Name</label>
                      <Input
                        type="text"
                        placeholder="Enter your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'client' | 'lawyer' | 'judge')}
                        disabled={loading}
                      >
                        <option value="client">Client</option>
                        <option value="lawyer">Lawyer</option>
                        <option value="judge">Judge</option>
                      </select>
                      <p className="text-xs text-gray-500">
                        {role === 'client' && 'Upload cases and track their progress'}
                        {role === 'lawyer' && 'Manage assigned cases and set availability'}
                        {role === 'judge' && 'Review priority queue and accept cases'}
                      </p>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <Button 
                  type="button"
                  onClick={(e) => {
                    console.log('Button clicked!', { mode, email, name })
                    e.preventDefault()
                    e.stopPropagation()
                    
                    if (mode === 'forgot') {
                      handleForgotPassword(e)
                    } else {
                      handleSendOTP(e)
                    }
                  }} 
                  disabled={!email || (mode === 'register' && !name) || loading}
                  className="w-full"
                >
                  {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                  {mode === 'register' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Code' : 'Send OTP'}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={loading}
                    className="text-center text-lg tracking-widest"
                  />
                </div>
                
                {countdown > 0 && (
                  <p className="text-sm text-gray-500 text-center">
                    OTP expires in {formatTime(countdown)}
                  </p>
                )}
                
                <Button 
                  type="button"
                  onClick={(e) => {
                    console.log('Verify button clicked!', { mode, otp })
                    e.preventDefault()
                    e.stopPropagation()
                    handleVerifyOTP(e)
                  }} 
                  disabled={otp.length !== 6 || loading}
                  className="w-full"
                >
                  {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                  {mode === 'forgot' ? 'Reset Password' : 'Verify & Continue'}
                </Button>
                
                {countdown === 0 && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={mode === 'forgot' ? handleForgotPassword : handleSendOTP}
                    disabled={loading}
                    className="w-full text-sm"
                  >
                    Resend OTP
                  </Button>
                )}
              </>
            )}

            {step === 'email' && (
              <div className="space-y-3 pt-4 border-t">
                {mode === 'signin' && (
                  <>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => {
                        setMode('register')
                        resetForm()
                      }}
                      className="w-full text-sm"
                    >
                      Don't have an account? Create one
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => {
                        setMode('forgot')
                        resetForm()
                      }}
                      className="w-full text-sm"
                    >
                      Forgot your password?
                    </Button>
                  </>
                )}
                
                {mode === 'register' && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setMode('signin')
                      resetForm()
                    }}
                    className="w-full text-sm"
                  >
                    Already have an account? Sign in
                  </Button>
                )}
                
                {mode === 'forgot' && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setMode('signin')
                      resetForm()
                    }}
                    className="w-full text-sm"
                  >
                    Remember your password? Sign in
                  </Button>
                )}
              </div>
            )}
            
            <div className="text-xs text-gray-500 text-center mt-4">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-gray-600">
          <p>AI-powered legal case management</p>
          <p className="mt-1 font-medium">Triage • Classify • Assign</p>
        </div>
      </div>
    </div>
  )
}

export default AuthPage