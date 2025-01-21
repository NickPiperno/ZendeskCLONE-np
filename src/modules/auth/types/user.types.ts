export type UserRole = 'admin' | 'agent' | 'user'

export interface User {
  id: string
  created_at: string
  email: string
  full_name: string
  role: UserRole
}

export interface UserInsert {
  id?: string
  created_at?: string
  email: string
  full_name: string
  role?: UserRole
}

export interface UserUpdate {
  id?: string
  created_at?: string
  email?: string
  full_name?: string
  role?: UserRole
} 