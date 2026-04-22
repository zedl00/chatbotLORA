// Ruta: /src/directives/can.ts
import type { Directive, DirectiveBinding } from 'vue'
import { usePermissionsStore } from '@/stores/permissions.store'
import type { PermissionScope } from '@/types/rbac.types'

/**
 * Directiva v-can para mostrar/ocultar elementos según permisos.
 *
 * Formas de uso:
 *
 *   1) String simple (scope='own' por defecto):
 *      <button v-can="'conversations.assign'">Asignar</button>
 *
 *   2) Con scope:
 *      <button v-can="['conversations.delete', 'all']">Eliminar</button>
 *
 *   3) Cualquiera de varios (lógica OR):
 *      <button v-can.any="['contacts.create', 'contacts.update']">Editar</button>
 *
 *   4) Todos (lógica AND):
 *      <div v-can.all="['reports.view', 'reports.export']">Exportar</div>
 *
 *   5) Inverso (mostrar solo si NO tiene):
 *      <div v-can.not="'billing.manage'">Actualizar plan</div>
 *
 * Si el usuario no tiene el permiso, el nodo se elimina del DOM (comment placeholder).
 */

type CanValue =
  | string
  | [string, PermissionScope]
  | string[]

function evaluate(binding: DirectiveBinding<CanValue>): boolean {
  const store = usePermissionsStore()
  const { value, modifiers } = binding

  let result: boolean

  if (modifiers.any && Array.isArray(value)) {
    result = store.canAny(value as string[])
  } else if (modifiers.all && Array.isArray(value)) {
    result = store.canAll(value as string[])
  } else if (Array.isArray(value) && value.length === 2 && typeof value[1] === 'string' && ['own', 'team', 'all'].includes(value[1])) {
    result = store.can(value[0] as string, value[1] as PermissionScope)
  } else if (typeof value === 'string') {
    result = store.can(value)
  } else {
    console.warn('[v-can] Uso inválido. Ejemplos: v-can="\'key\'", v-can="[\'key\',\'all\']", v-can.any="[...]"')
    result = false
  }

  return modifiers.not ? !result : result
}

export const vCan: Directive<HTMLElement, CanValue> = {
  mounted(el, binding) {
    if (!evaluate(binding)) {
      el.style.display = 'none'
      el.setAttribute('data-hidden-by', 'v-can')
    }
  },
  updated(el, binding) {
    if (evaluate(binding)) {
      el.style.display = ''
      el.removeAttribute('data-hidden-by')
    } else {
      el.style.display = 'none'
      el.setAttribute('data-hidden-by', 'v-can')
    }
  }
}
