import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { cache } from 'react'
import type { PostgrestError } from '@supabase/postgrest-js'
import type { Database } from '@/types/supabase'

type TableMap = Database['public']['Tables']
type TableRow<K extends keyof TableMap> = TableMap[K]['Row']
type TableInsert<K extends keyof TableMap> = TableMap[K]['Insert']
type TableUpdate<K extends keyof TableMap> = TableMap[K]['Update']

type QueryResult<T> = { data: T | null; error: PostgrestError | null; count: number | null }
type TableQuery<K extends keyof TableMap> = PromiseLike<QueryResult<TableRow<K>[]>> & {
  select(
    columns?: string,
    options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }
  ): TableQuery<K>
  eq(column: string, value: unknown): TableQuery<K>
  neq(column: string, value: unknown): TableQuery<K>
  lt(column: string, value: unknown): TableQuery<K>
  lte(column: string, value: unknown): TableQuery<K>
  gt(column: string, value: unknown): TableQuery<K>
  gte(column: string, value: unknown): TableQuery<K>
  is(column: string, value: null | boolean): TableQuery<K>
  not(column: string, operator: string, value: unknown): TableQuery<K>
  in(column: string, values: readonly unknown[]): TableQuery<K>
  ilike(column: string, pattern: string): TableQuery<K>
  or(filters: string): TableQuery<K>
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): TableQuery<K>
  limit(count: number): TableQuery<K>
  range(from: number, to: number): TableQuery<K>
  insert(values: TableInsert<K> | TableInsert<K>[]): TableQuery<K>
  update(values: TableUpdate<K>): TableQuery<K>
  upsert(
    values: TableInsert<K> | TableInsert<K>[],
    options?: { onConflict?: string }
  ): TableQuery<K>
  delete(): TableQuery<K>
  single(): PromiseLike<QueryResult<TableRow<K>>>
  maybeSingle(): PromiseLike<QueryResult<TableRow<K>>>
}

type TypedServerClient = Omit<SupabaseClient<Database>, 'from'> & {
  from<K extends keyof TableMap & string>(relation: K): TableQuery<K>
}

/**
 * Creates a Supabase client for use in server components and server actions.
 * Reads and writes session cookies via Next.js headers API.
 *
 * Must be called as an async function because `cookies()` is async in Next.js 15.
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return (await createSupabaseServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // setAll may be called from a Server Component where cookies cannot
            // be set. The middleware handles token refresh in that case.
          }
        },
      },
    }
  )) as unknown as TypedServerClient
}

/**
 * Verifies the signed-in user once per server render/request. Server components
 * in the same render can share this result instead of repeating an Auth call.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
})

/**
 * Creates a database-only client whose PostgREST requests use a verified
 * user's exact access token. This is useful when an action needs to keep the
 * database identity aligned with the user returned by the SSR Auth client.
 */
export function createAccessTokenDataClient(accessToken: string) {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { accessToken: async () => accessToken }
  ) as unknown as TypedServerClient
}
