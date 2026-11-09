'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { ApiClientError } from '@/lib/api-client'

export const LoginForm = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const { login, isLoading } = useAuthStore()
  const router = useRouter()

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!email) next.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email'
    if (!password) next.password = 'Password is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    try {
      await login(email, password)
      // Bug fix: this claimed to redirect to the workspace but actually
      // went to `/` — the public marketing homepage, which has no
      // awareness of auth state at all. See
      // apps/web/src/app/workspace/page.tsx for the full explanation.
      router.replace('/workspace')
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          setErrors({ form: 'Invalid email or password' })
        } else if (err.statusCode === 429) {
          setErrors({ form: 'Too many attempts. Try again later.' })
        } else {
          setErrors({ form: err.message })
        }
      } else {
        toast.error('Something went wrong', 'Please try again')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {errors.form && (
        <div className="border border-[var(--color-error)] bg-[var(--color-error-bg)] px-3 py-2">
          <p className="font-mono text-xs text-[var(--color-error)]">{errors.form}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="font-mono text-xs text-muted-foreground">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setErrors({}) }}
          error={errors.email}
          placeholder="you@company.com"
          disabled={isLoading}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="font-mono text-xs text-muted-foreground">
            Password
          </label>
          <Link
            href="/auth/forgot-password"
            className="font-mono text-xs text-accent hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setErrors({}) }}
          error={errors.password}
          placeholder="Minimum 8 characters"
          disabled={isLoading}
        />
      </div>

      <Button type="submit" className="w-full mt-2" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>

      <p className="font-mono text-xs text-center text-muted-foreground">
        No account?{' '}
        <Link href="/auth/register" className="text-accent hover:underline">
          Create one
        </Link>
      </p>
    </form>
  )
}
