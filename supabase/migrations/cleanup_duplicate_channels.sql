-- ═══════════════════════════════════════════════════════════════
-- 🧹 Limpieza de canales duplicados vacíos
--
-- Elimina los 2 canales "Widget Web" que tienen 0 conversaciones.
-- Deja intacto "Widget Web (playground)" con sus 67 conversaciones.
-- ═══════════════════════════════════════════════════════════════

-- PASO 1: Verificar ANTES (debe mostrar 0 conversaciones en los duplicados)
SELECT 
  c.id, 
  c.name,
  c.created_at,
  (SELECT COUNT(*) FROM conversations WHERE channel_id = c.id) AS total_conversations
FROM channels c
WHERE c.id IN (
  '5b7bd769-c98a-4ce3-b13d-6165bc99332f',
  'ab96c07a-8555-4b6e-9ee4-85c05f7d9215'
);

-- ⚠️ VERIFICA que total_conversations = 0 en ambos antes de continuar.
-- Si cualquiera tiene > 0, NO ejecutes el DELETE (aborta y avísame).

-- PASO 2: Borrar los duplicados
-- (Usa CTE para hacer el delete condicional y seguro)
WITH safe_delete AS (
  SELECT id FROM channels
  WHERE id IN (
    '5b7bd769-c98a-4ce3-b13d-6165bc99332f',
    'ab96c07a-8555-4b6e-9ee4-85c05f7d9215'
  )
  AND NOT EXISTS (
    SELECT 1 FROM conversations WHERE conversations.channel_id = channels.id
  )
)
DELETE FROM channels
WHERE id IN (SELECT id FROM safe_delete)
RETURNING id, name;

-- PASO 3: Verificar DESPUÉS (debe quedar solo el "playground")
SELECT id, name, 
  (SELECT COUNT(*) FROM conversations WHERE channel_id = c.id) AS total
FROM channels c
WHERE type = 'web_widget'
ORDER BY created_at;
