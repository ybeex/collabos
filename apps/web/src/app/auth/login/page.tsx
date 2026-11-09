import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'
import { AuthCard } from '@/components/auth/auth-card'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <AuthCard heading="Sign in" subheading="Welcome back to your workspace">
      <LoginForm />
    </AuthCard>
  )
}
