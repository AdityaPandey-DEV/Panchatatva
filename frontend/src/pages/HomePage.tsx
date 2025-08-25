import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Scale, Brain, Users, Shield, FileText, Gavel } from 'lucide-react'

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const features = [
    {
      icon: <Brain className="h-8 w-8 text-blue-600" />,
      title: "AI-Powered Classification",
      description: "Intelligent case categorization and urgency assessment using advanced AI"
    },
    {
      icon: <Users className="h-8 w-8 text-green-600" />,
      title: "Smart Assignment",
      description: "Automated judge and lawyer matching based on expertise and availability"
    },
    {
      icon: <FileText className="h-8 w-8 text-purple-600" />,
      title: "Document Processing",
      description: "Advanced PDF text extraction with OCR fallback for scanned documents"
    },
    {
      icon: <Shield className="h-8 w-8 text-red-600" />,
      title: "Secure & Compliant",
      description: "Enterprise-grade security with audit logging and data encryption"
    },
    {
      icon: <Gavel className="h-8 w-8 text-amber-600" />,
      title: "Legal Workflow",
      description: "Streamlined case management from intake to assignment"
    },
    {
      icon: <Scale className="h-8 w-8 text-indigo-600" />,
      title: "Justice Automation",
      description: "Reducing delays and improving efficiency in legal proceedings"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Scale className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Panchtatva Justice</h1>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-sm text-gray-600">Welcome, {user.profile?.name || user.email}</span>
                <Button onClick={() => navigate('/dashboard')} variant="default">
                  Dashboard
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => navigate('/auth')} variant="outline">
                  Login
                </Button>
                <Button onClick={() => navigate('/auth')} variant="default">
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            AI-Powered Legal Case
            <span className="text-blue-600 block">Management System</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Revolutionizing legal workflows with intelligent case intake, automated classification, 
            and smart assignment of judges and lawyers. Built for efficiency, security, and justice.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!user && (
              <Button size="lg" onClick={() => navigate('/auth')} className="text-lg px-8 py-3">
                Start Managing Cases
              </Button>
            )}
            {user && (
              <Button size="lg" onClick={() => navigate('/dashboard')} className="text-lg px-8 py-3">
                Go to Dashboard
              </Button>
            )}
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 py-3"
              onClick={() => document.getElementById('learn-more')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Powerful Features for Modern Legal Practice
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    {feature.icon}
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Learn More Section */}
      <section id="learn-more" className="py-20 px-4">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12 text-gray-900">
            How Panchtatva Justice Works
          </h3>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h4 className="text-2xl font-semibold mb-6 text-gray-800">Complete Case Management Workflow</h4>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">1</div>
                  <div>
                    <h5 className="font-semibold text-gray-800">Case Upload & Processing</h5>
                    <p className="text-gray-600">Clients upload case documents in PDF format. Our AI processes and extracts text with OCR fallback.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">2</div>
                  <div>
                    <h5 className="font-semibold text-gray-800">AI Classification & Analysis</h5>
                    <p className="text-gray-600">Advanced AI analyzes case content, determines urgency, and categorizes by legal domain.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-semibold">3</div>
                  <div>
                    <h5 className="font-semibold text-gray-800">Smart Assignment</h5>
                    <p className="text-gray-600">Intelligent matching algorithm assigns cases to qualified judges and lawyers based on expertise.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-semibold">4</div>
                  <div>
                    <h5 className="font-semibold text-gray-800">Case Management & Tracking</h5>
                    <p className="text-gray-600">Complete workflow management with real-time updates, notifications, and progress tracking.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-8 rounded-2xl">
              <h4 className="text-xl font-semibold mb-4 text-gray-800">Key Benefits</h4>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Reduced case processing time by 75%</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>AI-powered accuracy of 99% in case classification</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Automated assignment reduces manual workload</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>24/7 system availability with real-time updates</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Enterprise-grade security and compliance</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">99%</div>
              <div className="text-gray-600">Accuracy Rate</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-600 mb-2">75%</div>
              <div className="text-gray-600">Time Reduction</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600 mb-2">24/7</div>
              <div className="text-gray-600">System Availability</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-red-600 mb-2">100%</div>
              <div className="text-gray-600">Secure & Compliant</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-blue-600 text-white">
        <div className="container mx-auto text-center">
          <h3 className="text-3xl font-bold mb-6">
            Ready to Transform Your Legal Practice?
          </h3>
          <p className="text-xl mb-8 opacity-90">
            Join the future of legal case management with Panchtatva Justice Automation
          </p>
          {!user && (
            <Button size="lg" variant="secondary" onClick={() => navigate('/auth')} className="text-lg px-8 py-3">
              Get Started Today
            </Button>
          )}
          {user && (
            <Button size="lg" variant="secondary" onClick={() => navigate('/dashboard')} className="text-lg px-8 py-3">
              Access Your Dashboard
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-gray-900 text-white">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Scale className="h-6 w-6" />
            <span className="text-lg font-semibold">Panchtatva Justice Automation</span>
          </div>
          <p className="text-gray-400">
            Empowering legal professionals with AI-driven efficiency and security
          </p>
        </div>
      </footer>
    </div>
  )
}
