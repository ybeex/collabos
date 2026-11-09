'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authApi, ApiClientError } from '@/lib/api-client'
import { CheckCircle } from 'lucide-react'

export const ResetPasswordForm = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({})
  const [loading, setLoading] = useState(false)

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!password) next.password = 'Password is required'
    else if (password.length < 8) next.password = 'Password must be at least 8 characters'
    if (!confirm) next.confirm = 'Please confirm your password'
    else if (password !== confirm) next.confirm = 'Passwords do not match'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    if (!token) { setErrors({ form: 'Invalid or missing reset token. Request a new link.' }); return }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
      setTimeout(() => router.replace('/auth/login'), 3000)
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) setErrors({ form: 'This reset link has expired or already been used.' })
        else setErrors({ form: err.message })
      }
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-bg)]">
          <CheckCircle className="h-6 w-6 text-[var(--color-success)]" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold">Password reset successfully</p>
          <p className="font-mono text-xs text-muted-foreground mt-1">Redirecting you to sign in...</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {errors.form && (
        <div className="border border-[var(--color-error)] bg-[var(--color-error-bg)] px-3 py-2">
          <p className="font-mono text-xs text-[var(--color-error)]">{errors.form}</p>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="font-mono text-xs text-muted-foreground">New password</label>
        <Input id="password" type="password" autoComplete="new-password" value={password}
          onChange={(e) => { setPassword(e.target.value); setErrors({}) }}
          error={errors.password} placeholder="Minimum 8 characters" disabled={loading} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="font-mono text-xs text-muted-foreground">Confirm password</label>
        <Input id="confirm" type="password" autoComplete="new-password" value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setErrors({}) }}
          error={errors.confirm} placeholder="Repeat your new password" disabled={loading} />
      </div>
      <Button type="submit" className="w-full mt-2" disabled={loading || !token}>
        {loading ? 'Resetting...' : 'Set new password'}
      </Button>
      <p className="font-mono text-xs text-center text-muted-foreground">
        <Link href="/auth/login" className="text-accent hover:underline">Back to sign in</Link>
      </p>
    </form>
  )
}
