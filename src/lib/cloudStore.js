import { isSupabaseEnabled, supabase } from './supabaseClient'

const TABLE = 'app_state'
let cloudDisabledForSession = false

const shouldDisableCloudForError = (error) => {
  const msg = String(error?.message || error || '').toLowerCase()
  if (!msg) return false
  return (
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed') ||
    msg.includes('name_not_resolved') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('timed out')
  )
}

export const CLOUD_KEYS = {
  orders: 'orders',
  tanks: 'tanks',
  bottles: 'bottles',
  productPrices: 'productPrices',
  adminAuth: 'adminAuth',
  users: 'users',
}

export const loadCloudState = async (key) => {
  if (!isSupabaseEnabled || !supabase || cloudDisabledForSession) return null
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('payload')
      .eq('key', key)
      .maybeSingle()
    if (error) {
      if (shouldDisableCloudForError(error)) cloudDisabledForSession = true
      return null
    }
    return data?.payload ?? null
  } catch (error) {
    if (shouldDisableCloudForError(error)) cloudDisabledForSession = true
    return null
  }
}

export const saveCloudState = async (key, payload) => {
  if (!isSupabaseEnabled || !supabase || cloudDisabledForSession) return false
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key, payload, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) {
      if (shouldDisableCloudForError(error)) cloudDisabledForSession = true
      return false
    }
    return true
  } catch (error) {
    if (shouldDisableCloudForError(error)) cloudDisabledForSession = true
    return false
  }
}

/**
 * Realtime subscription for `public.app_state`.
 * The callback receives the Supabase postgres_changes payload.
 * Returns an `unsubscribe()` function.
 */
export const subscribeToAppStateChanges = (onPayload) => {
  if (!isSupabaseEnabled || !supabase || cloudDisabledForSession) return () => {}

  const channel = supabase
    .channel('app_state_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        onPayload?.(payload)
      }
    )

  channel.subscribe((status, err) => {
    const s = String(status || '')
    if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
      if (shouldDisableCloudForError(err || s)) {
        cloudDisabledForSession = true
      }
      try {
        supabase.removeChannel(channel)
      } catch {
        // ignore
      }
    }
  })

  return () => {
    try {
      supabase.removeChannel(channel)
    } catch {
      // ignore
    }
  }
}

