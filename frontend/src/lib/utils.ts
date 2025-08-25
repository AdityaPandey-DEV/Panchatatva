import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

export function getUrgencyColor(urgency: string) {
  switch (urgency) {
    case 'URGENT':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'MODERATE':
      return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'LOW':
      return 'text-green-600 bg-green-50 border-green-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'assigned':
      return 'text-blue-600 bg-blue-50 border-blue-200'
    case 'accepted':
      return 'text-green-600 bg-green-50 border-green-200'
    case 'in_progress':
      return 'text-purple-600 bg-purple-50 border-purple-200'
    case 'completed':
      return 'text-emerald-600 bg-emerald-50 border-emerald-200'
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}
