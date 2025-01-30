import { UserProfile, UserRole } from '@/modules/auth/types/user.types';

export const createMockProfile = (overrides?: Partial<UserProfile>): UserProfile => ({
  id: 'user_' + Math.random().toString(36).substr(2, 9),
  created_at: new Date().toISOString(),
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'user',
  is_active: true,
  ...overrides
});

export const mockAuthContext = {
  // Mock profiles for different roles
  agentProfile: createMockProfile({ role: 'agent' }),
  userProfile: createMockProfile({ role: 'user' }),
  adminProfile: createMockProfile({ role: 'admin' }),

  // Mock auth states
  authenticated: {
    isAuthenticated: true,
    profile: createMockProfile({ role: 'agent' }),
    loading: false,
    error: null
  },

  unauthenticated: {
    isAuthenticated: false,
    profile: null,
    loading: false,
    error: null
  },

  loading: {
    isAuthenticated: false,
    profile: null,
    loading: true,
    error: null
  },

  error: {
    isAuthenticated: false,
    profile: null,
    loading: false,
    error: 'Authentication failed'
  }
}; 
