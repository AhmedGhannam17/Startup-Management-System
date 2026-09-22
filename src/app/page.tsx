import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Root route — redirect based on auth state.
 * Authenticated users go to the dashboard.
 * Unauthenticated users go to the login page.
 */
export default async function RootPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
