import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { AuthCard } from '@/components/auth/auth-card'

export const metadata: Metadata = { title: 'Reset password' }

export default function ForgotPasswordPage() {
  return (
    <AuthCard heading="Reset your password" subheading="We'll email you a reset link">
      <ForgotPasswordForm />
    </AuthCard>
  )
}
