// Ruta: /src/stores/auth.store.ts
// ═══════════════════════════════════════════════════════════════
// MODIFICADO en RBAC sprint:
//   - Tras cargar el perfil, se cargan los permisos efectivos.
//   - Al cerrar sesión, se limpia el store de permisos.
//   - mustChangePassword se expone como getter para forzar redirect.
// ═══════════════════════════════════════════════════════════════
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/services/supabase.client'
import { usePermissionsStore } from './permissions.store'
import type { User, UserRole } from '@/types/user.types'

export const useAuthStore = defineStore('auth', () => {
  // ── STATE ──────────────────────────────────────────────
  const user = ref<User | null>(null)
  const initialized = ref(false)
  const loading = ref(false)

  // ── GETTERS ────────────────────────────────────────────
  const isAuthenticated = computed(() => user.value !== null)
  const role = computed<UserRole | null>(() => user.value?.role ?? null)
  const organizationId = computed(() => user.value?.organizationId ?? null)
  const mustChangePassword = computed(() => {
    return user.value?.preferences?.must_change_password === true
  })

  // ── ACTIONS ────────────────────────────────────────────
  async function initialize() {
    if (initialized.value) return
    loading.value = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await loadProfile(session.user.id)
      }

      // Escuchar cambios de sesión
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (event === 'SIGNED_OUT' || !newSession?.user) {
          user.value = null
          usePermissionsStore().clear()
          return
        }

        if (newSession?.user && !user.value) {
          await loadProfile(newSession.user.id)
        }
      })
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  async function loadProfile(authUserId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle()

    if (error) {
      console.error('[auth.store] Error cargando perfil:', error)
      user.value = null
      return
    }

    if (!data) {
      console.warn('[auth.store] Usuario autenticado pero sin perfil en tabla users')
      user.value = null
      return
    }

    user.value = {
      id: data.id,
      organizationId: data.organization_id,
      email: data.email,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      phone: data.phone,
      role: data.role,
      active: data.active,
      lastSeenAt: data.last_seen_at,
      preferences: data.preferences ?? {},
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }

    // 🆕 RBAC: cargar permisos efectivos tras el login
    try {
      await usePermissionsStore().load(data.id)
    } catch (e) {
      console.error('[auth.store] Error cargando permisos:', e)
    }
  }

  async function signIn(email: string, password: string) {
    loading.value = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.user) await loadProfile(data.user.id)
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    loading.value = true
    try {
      await supabase.auth.signOut()
      user.value = null
      usePermissionsStore().clear()
    } finally {
      loading.value = false
    }
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })
    if (error) throw error
  }

  /**
   * Actualiza la contraseña del usuario autenticado.
   * Usado en el flujo de "must change password" para usuarios creados
   * con contraseña temporal.
   */
  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error

    // Limpiar el flag de must_change_password
    if (user.value) {
      const newPrefs = { ...user.value.preferences, must_change_password: false }
      await supabase
        .from('users')
        .update({ preferences: newPrefs })
        .eq('id', user.value.id)

      user.value.preferences = newPrefs
    }
  }

  /**
   * Refresca los permisos del usuario (útil tras cambios de rol).
   */
  async function refreshPermissions() {
    if (user.value) {
      await usePermissionsStore().load(user.value.id)
    }
  }

  return {
    // state
    user,
    initialized,
    loading,
    // getters
    isAuthenticated,
    role,
    organizationId,
    mustChangePassword,
    // actions
    initialize,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
    refreshPermissions
  }
})
