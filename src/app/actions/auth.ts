'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validations/auth'

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string }

/**
 * Sign in with email and password.
 * Redirects to /dashboard on success.
 */
export async function signIn(formData: FormData): Promise<ActionResult> {
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const parsed = loginSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // Do not expose internal Supabase error details directly
    if (error.message.toLowerCase().includes('invalid login credentials')) {
      return { success: false, error: 'Invalid email or password. Please try again.' }
    }
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return {
        success: false,
        error: 'Please verify your email address before signing in.',
      }
    }
    return { success: false, error: 'Unable to sign in. Please try again.' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * Create a new user account.
 * Redirects to /dashboard on success (Supabase may send a confirmation email).
 */
export async function signUp(formData: FormData): Promise<ActionResult> {
  const rawData = {
    fullName: formData.get('fullName') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }

  const parsed = registerSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
      },
      // Supabase will send confirmation email; callback will redirect to /dashboard
      emailRedirectTo: `${(await headers()).get('origin')}/auth/callback`,
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return {
        success: false,
        error: 'An account with this email already exists. Please sign in instead.',
      }
    }
    return { success: false, error: 'Unable to create account. Please try again.' }
  }

  // If email confirmation is disabled in Supabase, user is immediately signed in
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * Sign out the current user.
 * Redirects to /login.
 */
export async function signOut(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Send a password recovery email.
 */
export async function forgotPassword(formData: FormData): Promise<ActionResult> {
  const rawData = {
    email: formData.get('email') as string,
  }

  const parsed = forgotPasswordSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const supabase = await createServerClient()
  const origin = (await headers()).get('origin')

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  if (error) {
    return { success: false, error: 'Unable to send reset email. Please try again.' }
  }

  // Always return success to avoid email enumeration
  return {
    success: true,
    message: 'If an account with that email exists, you will receive a password reset link.',
  }
}

/**
 * Update the user's password after clicking the recovery link.
 */
export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const rawData = {
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }

  const parsed = resetPasswordSchema.safeParse(rawData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return { success: false, error: 'Unable to update password. Please try again.' }
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=password_updated')
}
