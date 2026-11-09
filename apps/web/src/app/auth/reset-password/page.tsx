import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { AuthCard } from '@/components/auth/auth-card'

export const metadata: Metadata = { title: 'New password' }

export default function ResetPasswordPage() {
  return (
    <AuthCard heading="Choose a new password" subheading="Almost there">
      {/* Bug fix (found via a real `next build`): ResetPasswordForm
          reads the reset token via useSearchParams(), which forces
          Next's App Router to bail out of static prerendering unless
          wrapped in Suspense — this page would have failed to build in
          any real deployment, not just this sandbox. */}
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  )
}
