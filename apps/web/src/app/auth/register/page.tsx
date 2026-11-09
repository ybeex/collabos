import type { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/register-form'
import { AuthCard } from '@/components/auth/auth-card'

export const metadata: Metadata = { title: 'Create account' }

export default function RegisterPage() {
  return (
    <AuthCard heading="Create your workspace" subheading="Get your team set up in minutes">
      <RegisterForm />
    </AuthCard>
  )
}
