import { createServerClient as createSupabaseServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
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
  is(column: string, value: null | boolean): TableQuery<K>
  not(column: string, operator: string, value: unknown): TableQuery<K>
  in(column: string, values: readonly unknown[]): TableQuery<K>
  ilike(column: string, pattern: string): TableQuery<K>
  or(filters: string): TableQuery<K>
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): TableQuery<K>
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
