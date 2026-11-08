'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authApi, ApiClientError } from '@/lib/api-client'
import { CheckCircle } from 'lucide-react'

export const ForgotPasswordForm = () => {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required'); return }
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 429) {
        setError('Too many requests. Please wait before trying again.')
      } else {
        setSent(true) // Always show success to prevent enumeration
      }
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-bg)]">
          <CheckCircle className="h-6 w-6 text-[var(--color-success)]" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold">Check your email</p>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            If an account with <strong>{email}</strong> exists, a reset link has been sent.
          </p>
        </div>
        <Link href="/auth/login" className="font-mono text-xs text-accent hover:underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {error && (
        <div className="border border-[var(--color-error)] bg-[var(--color-error-bg)] px-3 py-2">
          <p className="font-mono text-xs text-[var(--color-error)]">{error}</p>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="font-mono text-xs text-muted-foreground">Email address</label>
        <Input id="email" type="email" autoComplete="email" value={email}
          onChange={(e) => { setEmail(e.target.value); setError('') }}
          placeholder="you@company.com" disabled={loading} />
      </div>
      <Button type="submit" className="w-full mt-2" disabled={loading}>
        {loading ? 'Sending...' : 'Send reset link'}
      </Button>
      <p className="font-mono text-xs text-center text-muted-foreground">
        Remember your password?{' '}
        <Link href="/auth/login" className="text-accent hover:underline">Sign in</Link>
      </p>
    </form>
  )
}
