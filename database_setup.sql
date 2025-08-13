-- =====================================================
-- SCRIPT SQL PARA ADMINISTRADOR DE TAREAS
-- Ejecuta este script en Supabase SQL Editor
-- =====================================================

-- 1. Tabla para almacenar mapas conceptuales
CREATE TABLE IF NOT EXISTS mapas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL DEFAULT 'Mapa Principal',
    view_offset_x REAL DEFAULT 0,
    view_offset_y REAL DEFAULT 0,
    zoom_level REAL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Tabla para almacenar nodos (salas y subsalas)
CREATE TABLE IF NOT EXISTS nodos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mapa_id UUID REFERENCES mapas(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL DEFAULT 150,
    height REAL NOT NULL DEFAULT 80,
    is_center BOOLEAN DEFAULT FALSE,
    is_subroom BOOLEAN DEFAULT FALSE,
    parent_node_id UUID REFERENCES nodos(id) ON DELETE CASCADE,
    direction VARCHAR(20) DEFAULT 'right',
    color VARCHAR(7) DEFAULT '#4a90e2',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Tabla para almacenar conexiones entre nodos
CREATE TABLE IF NOT EXISTS conexiones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mapa_id UUID REFERENCES mapas(id) ON DELETE CASCADE,
    from_node_id UUID REFERENCES nodos(id) ON DELETE CASCADE,
    to_node_id UUID REFERENCES nodos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(from_node_id, to_node_id)
);

-- 4. Tabla para almacenar tareas
CREATE TABLE IF NOT EXISTS tareas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nodo_id UUID REFERENCES nodos(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'medium',
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_nodos_mapa_id ON nodos(mapa_id);
CREATE INDEX IF NOT EXISTS idx_nodos_parent_id ON nodos(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_conexiones_mapa_id ON conexiones(mapa_id);
CREATE INDEX IF NOT EXISTS idx_conexiones_from_node ON conexiones(from_node_id);
CREATE INDEX IF NOT EXISTS idx_conexiones_to_node ON conexiones(to_node_id);
CREATE INDEX IF NOT EXISTS idx_tareas_nodo_id ON tareas(nodo_id);
CREATE INDEX IF NOT EXISTS idx_tareas_completed ON tareas(completed);

-- 6. Triggers para actualizar timestamps automáticamente
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_mapas
    BEFORE UPDATE ON mapas
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_nodos
    BEFORE UPDATE ON nodos
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_tareas
    BEFORE UPDATE ON tareas
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- 7. Insertar datos de ejemplo
INSERT INTO mapas (nombre, view_offset_x, view_offset_y, zoom_level) 
VALUES ('Mapa Principal', 0, 0, 1) 
ON CONFLICT DO NOTHING;

-- Obtener el ID del mapa principal
DO $$
DECLARE
    mapa_id UUID;
    admin_id UUID;
    sala1_id UUID;
    sala2_id UUID;
    subsala1_id UUID;
    subsala2_id UUID;
BEGIN
    -- Obtener ID del mapa
    SELECT id INTO mapa_id FROM mapas WHERE nombre = 'Mapa Principal' LIMIT 1;
    
    -- Insertar nodo central (Administrador de Tareas)
    INSERT INTO nodos (mapa_id, label, x, y, width, height, is_center, color)
    VALUES (mapa_id, 'Administrador de Tareas', 0, 0, 200, 100, TRUE, '#2d3748')
    RETURNING id INTO admin_id;
    
    -- Insertar salas principales
    INSERT INTO nodos (mapa_id, label, x, y, width, height, is_center, color)
    VALUES (mapa_id, 'Proyectos Activos', 300, -100, 150, 80, FALSE, '#4a90e2')
    RETURNING id INTO sala1_id;
    
    INSERT INTO nodos (mapa_id, label, x, y, width, height, is_center, color)
    VALUES (mapa_id, 'Tareas Pendientes', 300, 100, 150, 80, FALSE, '#e53e3e')
    RETURNING id INTO sala2_id;
    
    -- Insertar subsalas
    INSERT INTO nodos (mapa_id, label, x, y, width, height, is_subroom, parent_node_id, direction, color)
    VALUES (mapa_id, 'Frontend', 500, -150, 120, 60, TRUE, sala1_id, 'right', '#38a169')
    RETURNING id INTO subsala1_id;
    
    INSERT INTO nodos (mapa_id, label, x, y, width, height, is_subroom, parent_node_id, direction, color)
    VALUES (mapa_id, 'Backend', 500, -50, 120, 60, TRUE, sala1_id, 'right', '#805ad5')
    RETURNING id INTO subsala2_id;
    
    -- Insertar conexiones
    INSERT INTO conexiones (mapa_id, from_node_id, to_node_id)
    VALUES 
        (mapa_id, admin_id, sala1_id),
        (mapa_id, admin_id, sala2_id),
        (mapa_id, sala1_id, subsala1_id),
        (mapa_id, sala1_id, subsala2_id)
    ON CONFLICT DO NOTHING;
    
    -- Insertar tareas de ejemplo
    INSERT INTO tareas (nodo_id, title, description, completed, priority)
    VALUES 
        (subsala1_id, 'Diseñar interfaz de usuario', 'Crear mockups y wireframes para la nueva interfaz', FALSE, 'high'),
        (subsala1_id, 'Implementar responsive design', 'Asegurar que la app funcione en móviles', FALSE, 'medium'),
        (subsala2_id, 'Configurar base de datos', 'Configurar Supabase y crear tablas', TRUE, 'high'),
        (subsala2_id, 'Implementar API REST', 'Crear endpoints para CRUD de tareas', FALSE, 'medium'),
        (sala2_id, 'Revisar documentación', 'Actualizar README con nuevas funcionalidades', FALSE, 'low');
        
END $$;

-- 8. Verificar que todo se creó correctamente
SELECT 
    'Tablas creadas:' as info,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('mapas', 'nodos', 'conexiones', 'tareas')) as tablas_creadas;

SELECT 
    'Datos insertados:' as info,
    (SELECT COUNT(*) FROM mapas) as mapas,
    (SELECT COUNT(*) FROM nodos) as nodos,
    (SELECT COUNT(*) FROM conexiones) as conexiones,
    (SELECT COUNT(*) FROM tareas) as tareas;

-- ¡LISTO! Tu base de datos está configurada 🎉
