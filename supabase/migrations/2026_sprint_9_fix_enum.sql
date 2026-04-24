-- ═══════════════════════════════════════════════════════════════
-- Sprint 9 · FIX · Corrección del enum sender_type
--
-- sender_type es un ENUM PostgreSQL, no text libre.
-- Necesitamos ALTER TYPE ADD VALUE (no CHECK constraint).
--
-- IMPORTANTE: ALTER TYPE ADD VALUE debe correr FUERA de una transacción
-- para garantizar que los nuevos valores estén disponibles inmediatamente.
-- Por eso este script NO tiene BEGIN/COMMIT.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 0. PRIMERO: limpiar si se creó el CHECK constraint erróneo
-- ─────────────────────────────────────────────────────────────
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_type_check;


-- ─────────────────────────────────────────────────────────────
-- 1. Agregar los 2 valores nuevos al enum sender_type
-- Cada uno debe ejecutarse como statement independiente.
-- ─────────────────────────────────────────────────────────────
ALTER TYPE sender_type ADD VALUE IF NOT EXISTS 'whisper';
ALTER TYPE sender_type ADD VALUE IF NOT EXISTS 'system';


-- ─────────────────────────────────────────────────────────────
-- Verificación: ver los valores actuales del enum
-- ─────────────────────────────────────────────────────────────
SELECT
  'sender_type_values' AS check_,
  string_agg(enumlabel, ', ' ORDER BY enumsortorder) AS values_
FROM pg_enum
WHERE enumtypid = 'sender_type'::regtype;

-- Esperado: contact, agent, bot, whisper, system
