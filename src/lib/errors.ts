import type { PostgrestError } from '@supabase/supabase-js'

/** Convert database failures into actionable messages without exposing SQL details. */
export function getUserFriendlyDatabaseError(
  error: Pick<PostgrestError, 'code'> | null | undefined,
  fallback = 'We couldn’t save your changes. Please try again.'
): string {
  switch (error?.code) {
    case '42501':
    case 'PGRST301':
      return 'You don’t have permission to make this change. Check your organization role or project access.'
    case '23503':
      return 'A related record is no longer available. Refresh the page and try again.'
    case '23505':
      return 'A record with these details already exists.'
    case '23514':
    case '22P02':
    case '22023':
      return 'Some information is invalid. Review the fields and try again.'
    case 'P0002':
      return 'That record could not be found. Refresh the page and try again.'
    case 'PGRST116':
      return 'This record could not be found. It may have been removed or you may no longer have access.'
    case 'P0001':
      return 'This change could not be completed. The record may have changed or may no longer be available.'
    default:
      return fallback
  }
}
