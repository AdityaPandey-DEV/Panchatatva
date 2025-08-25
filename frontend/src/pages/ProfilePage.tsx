import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User, Mail, Shield, Edit, Save, X } from 'lucide-react'

const ProfilePage = () => {
  const { user } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editedProfile, setEditedProfile] = useState({
    name: user?.profile?.name || '',
    role: user?.role || 'client'
  })

  if (!user) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-600 mb-4">User Not Found</h1>
        <p className="text-gray-600">Please log in to view your profile.</p>
      </div>
    )
  }

  const handleSave = () => {
    // TODO: Implement profile update API call
    setIsEditing(false)
    // Update local state with new values
  }

  const handleCancel = () => {
    setEditedProfile({
      name: user?.profile?.name || '',
      role: user?.role || 'client'
    })
    setIsEditing(false)
  }

  const getRoleDisplayName = (role: string) => {
    const roleMap: { [key: string]: string } = {
      client: 'Client',
      lawyer: 'Lawyer',
      judge: 'Judge',
      admin: 'Administrator'
    }
    return roleMap[role] || role
  }

  const getRoleDescription = (role: string) => {
    const descriptions: { [key: string]: string } = {
      client: 'Upload cases and track their progress through the legal system',
      lawyer: 'Manage assigned cases, set availability, and provide legal services',
      judge: 'Review priority queue, accept cases, and make legal decisions',
      admin: 'System administration and user management'
    }
    return descriptions[role] || 'User role in the system'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleSave} variant="default">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button onClick={handleCancel} variant="outline">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Overview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Personal Information
              </CardTitle>
              <CardDescription>Your account details and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  {isEditing ? (
                    <Input
                      value={editedProfile.name}
                      onChange={(e) => setEditedProfile(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter your full name"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 rounded-md">
                      {user.profile?.name || 'Not provided'}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                    {user.email}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  {isEditing ? (
                                          <select
                        value={editedProfile.role}
                        onChange={(e) => setEditedProfile(prev => ({ ...prev, role: e.target.value as 'client' | 'lawyer' | 'judge' | 'admin' }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                      <option value="client">Client</option>
                      <option value="lawyer">Lawyer</option>
                      <option value="judge">Judge</option>
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 rounded-md flex items-center">
                      <Shield className="h-4 w-4 mr-2 text-gray-400" />
                      {getRoleDisplayName(user.role)}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Account Status</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-md">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user.isVerified ? 'Verified' : 'Pending Verification'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Role Information */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Role Information
              </CardTitle>
              <CardDescription>What you can do with your current role</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    {getRoleDisplayName(user.role)}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {getRoleDescription(user.role)}
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <h5 className="font-medium text-gray-900 mb-2">Permissions</h5>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {user.role === 'client' && (
                      <>
                        <li>• Upload case documents</li>
                        <li>• Track case progress</li>
                        <li>• View case status</li>
                      </>
                    )}
                    {user.role === 'lawyer' && (
                      <>
                        <li>• View assigned cases</li>
                        <li>• Update case status</li>
                        <li>• Set availability</li>
                      </>
                    )}
                    {user.role === 'judge' && (
                      <>
                        <li>• Review case queue</li>
                        <li>• Accept/reject cases</li>
                        <li>• Make legal decisions</li>
                      </>
                    )}
                    {user.role === 'admin' && (
                      <>
                        <li>• Manage all users</li>
                        <li>• System configuration</li>
                        <li>• View analytics</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
          <CardDescription>Manage your account settings and security</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline">
              Change Password
            </Button>
            <Button variant="outline">
              Two-Factor Authentication
            </Button>
            <Button variant="outline">
              Notification Preferences
            </Button>
            <Button variant="outline" className="text-red-600 hover:text-red-700">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ProfilePage
