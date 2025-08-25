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
  const navigate = useNavigate()
  const { sendOTP, verifyOTP, registerUser, loading } = useAuthStore()
  
  // State management
  const [currentStep, setCurrentStep] = useState<'email' | 'otp'>('email')
  const [authMode, setAuthMode] = useState<'signin' | 'register' | 'forgot'>('signin')
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    name: '',
    role: 'client' as 'client' | 'lawyer' | 'judge'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [countdown, setCountdown] = useState(0)

  // Clear form when mode changes
  useEffect(() => {
    setCurrentStep('email')
    setFormData({
      email: '',
      otp: '',
      name: '',
      role: 'client'
    })
    setError('')
    setSuccess('')
    setCountdown(0)
  }, [authMode])

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  // Send OTP
  const handleSendOTP = async () => {
    try {
      // Validation
      if (!formData.email) {
        setError('Please enter your email address')
        return
      }
      if (authMode === 'register' && !formData.name) {
        setError('Please enter your full name')
        return
      }

      setError('')
      setSuccess('')
      
      console.log('Sending OTP to:', formData.email)
      await sendOTP(formData.email)
      
      // Move to OTP step
      setCurrentStep('otp')
      setCountdown(300) // 5 minutes
      setSuccess('OTP sent! Please check your email and enter the 6-digit code.')
      
      console.log('OTP sent successfully, step changed to:', currentStep)
    } catch (err: any) {
      console.error('OTP send error:', err)
      setError(err.response?.data?.message || 'Failed to send OTP')
    }
  }

  // Verify OTP
  const handleVerifyOTP = async () => {
    try {
      if (!formData.otp || formData.otp.length !== 6) {
        setError('Please enter a valid 6-digit OTP')
        return
      }

      setError('')
      setSuccess('')

      if (authMode === 'register') {
        await registerUser(formData.email, formData.otp, formData.name, formData.role)
        setSuccess('Registration successful! Redirecting to dashboard...')
      } else {
        await verifyOTP(formData.email, formData.otp)
        setSuccess('Sign-in successful! Redirecting to dashboard...')
      }

      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err: any) {
      console.error('OTP verification error:', err)
      setError(err.response?.data?.message || 'Invalid OTP')
    }
  }

  // Resend OTP
  const handleResendOTP = () => {
    handleSendOTP()
  }

  // Format time for countdown
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get page title and description
  const getPageInfo = () => {
    if (currentStep === 'otp') {
      return {
        title: 'Enter OTP',
        description: `Enter the 6-digit code sent to ${formData.email}`,
        icon: <KeyRound className="h-5 w-5" />
      }
    }
    
    switch (authMode) {
      case 'register':
        return {
          title: 'Create Account',
          description: 'Create your account to access the justice automation system',
          icon: <UserPlus className="h-5 w-5" />
        }
      case 'forgot':
        return {
          title: 'Reset Password',
          description: 'Enter your email to receive a password reset code',
          icon: <Lock className="h-5 w-5" />
        }
      default:
        return {
          title: 'Sign In',
          description: 'Enter your email address to receive an OTP',
          icon: <Mail className="h-5 w-5" />
        }
    }
  }

  const pageInfo = getPageInfo()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary rounded-full p-3">
              <Scale className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Panchtatva</h1>
          <p className="text-gray-600 mt-2">Justice Automation System</p>
          
          {/* Debug info */}
          <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
            <p>Debug: Step = {currentStep}, Mode = {authMode}</p>
            <p>Email = {formData.email || 'empty'}</p>
            <button 
              onClick={() => {
                console.log('Test button clicked')
                setCurrentStep(currentStep === 'email' ? 'otp' : 'email')
              }}
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs"
            >
              Test: Toggle Step ({currentStep === 'email' ? 'email→otp' : 'otp→email'})
            </button>
          </div>
        </div>

        {/* Auth Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {pageInfo.icon}
                <CardTitle>{pageInfo.title}</CardTitle>
              </div>
              {currentStep === 'otp' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep('email')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
            </div>
            <CardDescription>{pageInfo.description}</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Error/Success Messages */}
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

            {/* Email Step */}
            {currentStep === 'email' && (
              <>
                {authMode === 'register' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Full Name</label>
                      <Input
                        type="text"
                        placeholder="Enter your full name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.role}
                        onChange={(e) => handleInputChange('role', e.target.value)}
                        disabled={loading}
                      >
                        <option value="client">Client</option>
                        <option value="lawyer">Lawyer</option>
                        <option value="judge">Judge</option>
                      </select>
                      <p className="text-xs text-gray-500">
                        {formData.role === 'client' && 'Upload cases and track their progress'}
                        {formData.role === 'lawyer' && 'Manage assigned cases and set availability'}
                        {formData.role === 'judge' && 'Review priority queue and accept cases'}
                      </p>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={loading}
                  />
                </div>

                <Button 
                  type="button"
                  onClick={handleSendOTP}
                  disabled={!formData.email || (authMode === 'register' && !formData.name) || loading}
                  className="w-full"
                >
                  {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                  {authMode === 'register' ? 'Create Account' : authMode === 'forgot' ? 'Send Reset Code' : 'Send OTP'}
                </Button>
              </>
            )}

            {/* OTP Step */}
            {currentStep === 'otp' && (
              <>
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={formData.otp}
                    onChange={(e) => handleInputChange('otp', e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                  onClick={handleVerifyOTP}
                  disabled={formData.otp.length !== 6 || loading}
                  className="w-full"
                >
                  {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                  {authMode === 'forgot' ? 'Reset Password' : 'Verify & Continue'}
                </Button>
                
                {countdown === 0 && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="w-full text-sm"
                  >
                    Resend OTP
                  </Button>
                )}
              </>
            )}

            {/* Navigation Links */}
            {currentStep === 'email' && (
              <div className="space-y-3 pt-4 border-t">
                {authMode === 'signin' && (
                  <>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setAuthMode('register')}
                      className="w-full text-sm"
                    >
                      Don't have an account? Create one
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setAuthMode('forgot')}
                      className="w-full text-sm"
                    >
                      Forgot your password?
                    </Button>
                  </>
                )}
                
                {authMode === 'register' && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setAuthMode('signin')}
                    className="w-full text-sm"
                  >
                    Already have an account? Sign in
                  </Button>
                )}
                
                {authMode === 'forgot' && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setAuthMode('signin')}
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
