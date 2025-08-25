import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import LoadingSpinner from '@/components/ui/loading-spinner'
import { Scale, Mail, KeyRound } from 'lucide-react'

const AuthPage = () => {
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  
  const { sendOTP, verifyOTP, loading } = useAuthStore()

  const handleSendOTP = async () => {
    try {
      setError('')
      await sendOTP(email)
      setStep('otp')
      setCountdown(300) // 5 minutes
      
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
      setError(err.response?.data?.message || 'Failed to send OTP')
    }
  }

  const handleVerifyOTP = async () => {
    try {
      setError('')
      await verifyOTP(email, otp)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
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
            <CardTitle className="flex items-center gap-2">
              {step === 'email' ? <Mail className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
              {step === 'email' ? 'Sign In' : 'Verify OTP'}
            </CardTitle>
            <CardDescription>
              {step === 'email' 
                ? 'Enter your email address to receive an OTP'
                : `Enter the 6-digit code sent to ${email}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 'email' ? (
              <>
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <Button 
                  onClick={handleSendOTP} 
                  disabled={!email || loading}
                  className="w-full"
                >
                  {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                  Send OTP
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
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep('email')
                      setOtp('')
                      setError('')
                    }}
                    disabled={loading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleVerifyOTP} 
                    disabled={otp.length !== 6 || loading}
                    className="flex-1"
                  >
                    {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                    Verify
                  </Button>
                </div>
                
                {countdown === 0 && (
                  <Button
                    variant="link"
                    onClick={handleSendOTP}
                    disabled={loading}
                    className="w-full text-sm"
                  >
                    Resend OTP
                  </Button>
                )}
              </>
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
