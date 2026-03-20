import { isSupabaseEnabled, supabase } from './supabaseClient'

const TABLE = 'app_state'

export const CLOUD_KEYS = {
  orders: 'orders',
  tanks: 'tanks',
  bottles: 'bottles',
  productPrices: 'productPrices',
  adminAuth: 'adminAuth',
}

export const loadCloudState = async (key) => {
  if (!isSupabaseEnabled || !supabase) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('payload')
    .eq('key', key)
    .maybeSingle()
  if (error) return null
  return data?.payload ?? null
}

export const saveCloudState = async (key, payload) => {
  if (!isSupabaseEnabled || !supabase) return false
  const { error } = await supabase
    .from(TABLE)
    .upsert({ key, payload, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  return !error
}

/**
 * Realtime subscription for `public.app_state`.
 * The callback receives the Supabase postgres_changes payload.
 * Returns an `unsubscribe()` function.
 */
export const subscribeToAppStateChanges = (onPayload) => {
  if (!isSupabaseEnabled || !supabase) return () => {}

  const channel = supabase
    .channel('app_state_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        onPayload?.(payload)
      }
    )

  channel.subscribe()

  return () => {
    try {
      supabase.removeChannel(channel)
    } catch {
      // ignore
    }
  }
}

