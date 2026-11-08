'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { ApiClientError } from '@/lib/api-client'

export const RegisterForm = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{
    name?: string; email?: string; password?: string; form?: string
  }>({})
  const { register, isLoading } = useAuthStore()
  const router = useRouter()

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Name is required'
    if (!email) next.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email'
    if (!password) next.password = 'Password is required'
    else if (password.length < 8) next.password = 'Password must be at least 8 characters'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    try {
      await register(name.trim(), email, password)
      // Bug fix: this used to go to `/` — the public marketing homepage,
      // not the app. See apps/web/src/app/workspace/page.tsx for the
      // full explanation. A fresh registration always has zero
      // workspaces, so this lands them in the onboarding wizard.
      router.replace('/workspace')
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setErrors({ email: 'An account with this email already exists' })
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
        <label htmlFor="name" className="font-mono text-xs text-muted-foreground">Name</label>
        <Input id="name" type="text" autoComplete="name" value={name}
          onChange={(e) => { setName(e.target.value); setErrors({}) }}
          error={errors.name} placeholder="Your full name" disabled={isLoading} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="font-mono text-xs text-muted-foreground">Email</label>
        <Input id="email" type="email" autoComplete="email" value={email}
          onChange={(e) => { setEmail(e.target.value); setErrors({}) }}
          error={errors.email} placeholder="you@company.com" disabled={isLoading} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="font-mono text-xs text-muted-foreground">Password</label>
        <Input id="password" type="password" autoComplete="new-password" value={password}
          onChange={(e) => { setPassword(e.target.value); setErrors({}) }}
          error={errors.password} placeholder="Minimum 8 characters" disabled={isLoading} />
      </div>

      <Button type="submit" className="w-full mt-2" disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Create account'}
      </Button>

      <p className="font-mono text-xs text-center text-muted-foreground">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-accent hover:underline">Sign in</Link>
      </p>
    </form>
  )
}
