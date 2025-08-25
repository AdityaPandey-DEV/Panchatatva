import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, Upload, Download, Eye, Edit, Save, X, Clock, CheckCircle, XCircle } from 'lucide-react'

interface Case {
  id: string
  title: string
  description: string
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'rejected'
  priority: 'LOW' | 'MODERATE' | 'URGENT'
  category: string
  documents: Array<{
    id: string
    name: string
    type: string
    uploadedAt: string
  }>
  assignedTo?: {
    id: string
    name: string
    role: string
  }
  createdAt: string
  updatedAt: string
}

const CasePage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedCase, setEditedCase] = useState<Partial<Case>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch case data from API
    // For now, create mock data
    const mockCase: Case = {
      id: id || '1',
      title: 'Sample Legal Case',
      description: 'This is a sample legal case for demonstration purposes. It involves contract dispute resolution.',
      status: 'pending',
      priority: 'MODERATE',
      category: 'Contract Law',
      documents: [
        {
          id: '1',
          name: 'contract.pdf',
          type: 'application/pdf',
          uploadedAt: '2025-01-25T10:00:00Z'
        },
        {
          id: '2',
          name: 'evidence.pdf',
          type: 'application/pdf',
          uploadedAt: '2025-01-25T10:30:00Z'
        }
      ],
      createdAt: '2025-01-25T09:00:00Z',
      updatedAt: '2025-01-25T10:30:00Z'
    }
    
    setCaseData(mockCase)
    setEditedCase(mockCase)
    setLoading(false)
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className="text-gray-600">Loading case details...</p>
        </div>
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Case Not Found</h1>
        <p className="text-gray-600">The requested case could not be found.</p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      assigned: 'text-blue-600 bg-blue-50 border-blue-200',
      in_progress: 'text-purple-600 bg-purple-50 border-purple-200',
      completed: 'text-green-600 bg-green-50 border-green-200',
      rejected: 'text-red-600 bg-red-50 border-red-200'
    }
    return colors[status as keyof typeof colors] || colors.pending
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      LOW: 'text-green-600 bg-green-50 border-green-200',
      MODERATE: 'text-orange-600 bg-orange-50 border-orange-200',
      URGENT: 'text-red-600 bg-red-50 border-red-200'
    }
    return colors[priority as keyof typeof colors] || colors.LOW
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'assigned':
        return <Eye className="h-4 w-4" />
      case 'in_progress':
        return <Edit className="h-4 w-4" />
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'rejected':
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const handleSave = () => {
    // TODO: Implement case update API call
    setCaseData(prev => prev ? { ...prev, ...editedCase } : null)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedCase(caseData)
    setIsEditing(false)
  }

  const canEdit = user?.role === 'admin' || user?.role === 'lawyer' || user?.role === 'judge'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Case Details</h1>
          <p className="text-gray-600">Case ID: {caseData.id}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && !isEditing && (
            <Button onClick={() => setIsEditing(true)} variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit Case
            </Button>
          )}
          {isEditing && (
            <>
              <Button onClick={handleSave} variant="default">
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
              <Button onClick={handleCancel} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Case Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Case Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Case Title</label>
                  {isEditing ? (
                    <Input
                      value={editedCase.title || ''}
                      onChange={(e) => setEditedCase(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter case title"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 rounded-md">
                      {caseData.title}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  {isEditing ? (
                    <Input
                      value={editedCase.category || ''}
                      onChange={(e) => setEditedCase(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="Enter case category"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 rounded-md">
                      {caseData.category}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(caseData.status)}`}>
                      {getStatusIcon(caseData.status)}
                      <span className="ml-1 capitalize">{caseData.status.replace('_', ' ')}</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(caseData.priority)}`}>
                      {caseData.priority}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                {isEditing ? (
                  <textarea
                    value={editedCase.description || ''}
                    onChange={(e) => setEditedCase(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter case description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 rounded-md min-h-[100px]">
                    {caseData.description}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Case-related documents and evidence</CardDescription>
            </CardHeader>
            <CardContent>
              {caseData.documents.length > 0 ? (
                <div className="space-y-3">
                  {caseData.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No documents uploaded yet</p>
                </div>
              )}
              
              <Button className="mt-4" variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Case Details Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Case Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Created</label>
                <p className="text-sm">{new Date(caseData.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Last Updated</label>
                <p className="text-sm">{new Date(caseData.updatedAt).toLocaleDateString()}</p>
              </div>
              {caseData.assignedTo && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Assigned To</label>
                  <p className="text-sm font-medium">{caseData.assignedTo.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{caseData.assignedTo.role}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {user?.role === 'judge' && caseData.status === 'pending' && (
                <Button className="w-full" variant="default">
                  Accept Case
                </Button>
              )}
              {user?.role === 'lawyer' && caseData.status === 'assigned' && (
                <Button className="w-full" variant="default">
                  Start Working
                </Button>
              )}
              <Button className="w-full" variant="outline">
                Add Comment
              </Button>
              <Button className="w-full" variant="outline">
                Request Information
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default CasePage
