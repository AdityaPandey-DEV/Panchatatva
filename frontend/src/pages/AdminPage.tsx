
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, FileText, BarChart3, Settings, Shield, Activity } from 'lucide-react'

const AdminPage = () => {
  const { user } = useAuthStore()

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-gray-600">You don't have permission to access the admin panel.</p>
      </div>
    )
  }

  const adminStats = [
    {
      title: 'Total Users',
      value: '0',
      description: 'Registered users in the system',
      icon: Users,
      color: 'text-blue-600'
    },
    {
      title: 'Total Cases',
      value: '0',
      description: 'Cases in the system',
      icon: FileText,
      color: 'text-green-600'
    },
    {
      title: 'Active Sessions',
      value: '0',
      description: 'Currently active users',
      icon: Activity,
      color: 'text-purple-600'
    },
    {
      title: 'System Health',
      value: 'Good',
      description: 'Overall system status',
      icon: Shield,
      color: 'text-emerald-600'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          System Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {adminStats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              User Management
            </CardTitle>
            <CardDescription>Manage system users and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button className="w-full" variant="outline">
                View All Users
              </Button>
              <Button className="w-full" variant="outline">
                Manage Roles
              </Button>
              <Button className="w-full" variant="outline">
                User Analytics
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              System Analytics
            </CardTitle>
            <CardDescription>Monitor system performance and usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button className="w-full" variant="outline">
                Performance Metrics
              </Button>
              <Button className="w-full" variant="outline">
                Usage Reports
              </Button>
              <Button className="w-full" variant="outline">
                Error Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent System Activity</CardTitle>
          <CardDescription>Latest administrative actions and system events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No recent activity to display</p>
            <p className="text-sm">System monitoring will show activity here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminPage
