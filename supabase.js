// ============== CONFIGURACIÓN DE SUPABASE ==============
// CONFIGURADO CON TU PROYECTO SUPABASE
// Proyecto: wkaslorgbudrxyhgniaa.supabase.co

const SUPABASE_URL = 'https://wkaslorgbudrxyhgniaa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrYXNsb3JnYnVkcnh5aGduaWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NzU3MTQsImV4cCI6MjA2ODI1MTcxNH0.hYQmy4etUV3k0EGrpUOI67kFSuhAlWiwGqLXNVDaj9E';

// Verificar si Supabase está configurado
const isSupabaseConfigured = () => {
  return SUPABASE_URL !== 'https://TU_PROYECTO.supabase.co' && 
         SUPABASE_ANON_KEY !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.TU_CLAVE_PUBLICA_ANONIMA';
};

// Crear cliente de Supabase solo si está configurado
let supabaseClient = null;
if (isSupabaseConfigured()) {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Cliente Supabase inicializado');
} else {
  console.warn('⚠️ Supabase no está configurado. La aplicación funcionará en modo local.');
}

// ============== GESTOR DE BASE DE DATOS ==============
class DatabaseManager {
  constructor() {
    this.currentMapId = 1; // ID del mapa principal
  }

  // ======= MAPAS =======
  async loadMap() {
    if (!supabaseClient) return this.loadLocalMap();
    
    try {
      console.log('📋 Cargando mapa desde Supabase...');
      const { data, error } = await supabaseClient
        .from('mapas')
        .select('*')
        .eq('id', this.currentMapId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No existe el mapa, usar el primero disponible
          const { data: firstMap, error: firstError } = await supabaseClient
            .from('mapas')
            .select('*')
            .limit(1)
            .single();
          
          if (firstError || !firstMap) {
            console.log('📋 No hay mapas, funcionando en modo local');
            return this.loadLocalMap();
          }
          
          this.currentMapId = firstMap.id;
          return firstMap;
        }
        throw error;
      }
      
      console.log('✅ Mapa cargado:', data);
      return data;
    } catch (error) {
      console.error('❌ Error cargando mapa:', error);
      return this.loadLocalMap();
    }
  }

  loadLocalMap() {
    return {
      id: 'local',
      nombre: 'ADMINISTRADOR DE TAREAS',
      view_offset_x: 0,
      view_offset_y: 0,
      zoom_level: 1
    };
  }

  async saveMapView(viewOffsetX, viewOffsetY, zoomLevel) {
    if (!supabaseClient) return;
    
    try {
      console.log('💾 Guardando vista del mapa...');
      const { error } = await supabaseClient
        .from('mapas')
        .update({
          view_offset_x: viewOffsetX,
          view_offset_y: viewOffsetY,
          zoom_level: zoomLevel
        })
        .eq('id', this.currentMapId);
      
      if (error) throw error;
      console.log('✅ Vista del mapa guardada');
    } catch (error) {
      console.error('❌ Error guardando vista:', error);
    }
  }

  // ======= NODOS =======
  async loadNodes() {
    if (!supabaseClient) return this.loadLocalNodes();
    
    try {
      console.log('🎯 Cargando nodos desde Supabase...');
      const { data, error } = await supabaseClient
        .from('nodos')
        .select('*')
        .eq('mapa_id', this.currentMapId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      console.log(`✅ ${data.length} nodos cargados:`, data);
      return data.map(this.convertSupabaseNodeToLocal);
    } catch (error) {
      console.error('❌ Error cargando nodos:', error);
      return this.loadLocalNodes();
    }
  }

  loadLocalNodes() {
    console.log('📋 Cargando nodos en modo local');
    return [];
  }

  async createNode(nodeData) {
    if (!supabaseClient) return this.createLocalNode(nodeData);
    
    try {
      console.log('➕ Creando nodo:', nodeData);
      
      const supabaseData = {
        mapa_id: this.currentMapId,
        label: nodeData.label,
        x: nodeData.x,
        y: nodeData.y,
        width: nodeData.width,
        height: nodeData.height,
        is_center: nodeData.isCenter || false,
        is_subroom: nodeData.isSubroom || false,
        parent_node_id: nodeData.parentNodeId || null,
        direction: nodeData.direction || null
      };
      
      const { data, error } = await supabaseClient
        .from('nodos')
        .insert([supabaseData])
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Nodo creado:', data);
      return this.convertSupabaseNodeToLocal(data);
    } catch (error) {
      console.error('❌ Error creando nodo:', error);
      return this.createLocalNode(nodeData);
    }
  }

  createLocalNode(nodeData) {
    const localNode = {
      id: Date.now().toString(),
      ...nodeData
    };
    console.log('📋 Nodo local creado:', localNode);
    return localNode;
  }

  async updateNode(nodeId, nodeData) {
    if (!supabaseClient) return;
    
    try {
      console.log('✏️ Actualizando nodo:', nodeId, nodeData);
      
      const supabaseData = {
        label: nodeData.label,
        x: nodeData.x,
        y: nodeData.y,
        width: nodeData.width,
        height: nodeData.height,
        direction: nodeData.direction
      };
      
      const { error } = await supabaseClient
        .from('nodos')
        .update(supabaseData)
        .eq('id', nodeId);
      
      if (error) throw error;
      console.log('✅ Nodo actualizado');
    } catch (error) {
      console.error('❌ Error actualizando nodo:', error);
    }
  }

  async deleteNode(nodeId) {
    if (!supabaseClient) return;
    
    try {
      console.log('🗑️ Eliminando nodo:', nodeId);
      const { error } = await supabaseClient
        .from('nodos')
        .delete()
        .eq('id', nodeId);
      
      if (error) throw error;
      console.log('✅ Nodo eliminado');
    } catch (error) {
      console.error('❌ Error eliminando nodo:', error);
    }
  }

  // ======= CONEXIONES =======
  async loadConnections() {
    if (!supabaseClient) return [];
    
    try {
      console.log('🔗 Cargando conexiones desde Supabase...');
      const { data, error } = await supabaseClient
        .from('conexiones')
        .select('*')
        .eq('mapa_id', this.currentMapId);
      
      if (error) throw error;
      
      console.log(`✅ ${data.length} conexiones cargadas:`, data);
      return data.map(conn => ({
        id: conn.id,
        fromNodeId: conn.from_node_id,
        toNodeId: conn.to_node_id
      }));
    } catch (error) {
      console.error('❌ Error cargando conexiones:', error);
      return [];
    }
  }

  async createConnection(fromNodeId, toNodeId) {
    if (!supabaseClient) return;
    
    try {
      console.log('🔗 Creando conexión:', fromNodeId, '->', toNodeId);
      const { error } = await supabaseClient
        .from('conexiones')
        .insert([{
          mapa_id: this.currentMapId,
          from_node_id: fromNodeId,
          to_node_id: toNodeId
        }]);
      
      if (error) throw error;
      console.log('✅ Conexión creada');
    } catch (error) {
      console.error('❌ Error creando conexión:', error);
    }
  }

  async deleteConnection(fromNodeId, toNodeId) {
    if (!supabaseClient) return;
    
    try {
      console.log('🔗 Eliminando conexión:', fromNodeId, '->', toNodeId);
      const { error } = await supabaseClient
        .from('conexiones')
        .delete()
        .eq('from_node_id', fromNodeId)
        .eq('to_node_id', toNodeId);
      
      if (error) throw error;
      console.log('✅ Conexión eliminada');
    } catch (error) {
      console.error('❌ Error eliminando conexión:', error);
    }
  }

  // ======= TAREAS =======
  async loadTasks(nodeId) {
    if (!supabaseClient) return [];
    
    try {
      console.log('✅ Cargando tareas del nodo:', nodeId);
      const { data, error } = await supabaseClient
        .from('tareas')
        .select('*')
        .eq('nodo_id', nodeId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      console.log(`✅ ${data.length} tareas cargadas para nodo ${nodeId}`);
      return data.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        completed: task.completed,
        nodeId: task.nodo_id
      }));
    } catch (error) {
      console.error('❌ Error cargando tareas:', error);
      return [];
    }
  }

  async createTask(nodeId, taskData) {
    if (!supabaseClient) return this.createLocalTask(nodeId, taskData);
    
    try {
      console.log('📝 Creando tarea:', taskData);
      const { data, error } = await supabaseClient
        .from('tareas')
        .insert([{
          nodo_id: nodeId,
          title: taskData.title,
          description: taskData.description || '',
          completed: false
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Tarea creada:', data);
      return {
        id: data.id,
        title: data.title,
        description: data.description,
        completed: data.completed,
        nodeId: data.nodo_id
      };
    } catch (error) {
      console.error('❌ Error creando tarea:', error);
      return this.createLocalTask(nodeId, taskData);
    }
  }

  createLocalTask(nodeId, taskData) {
    return {
      id: Date.now().toString(),
      title: taskData.title,
      description: taskData.description || '',
      completed: false,
      nodeId: nodeId
    };
  }

  async updateTask(taskId, taskData) {
    if (!supabaseClient) return;
    
    try {
      console.log('✏️ Actualizando tarea:', taskId, taskData);
      const { error } = await supabaseClient
        .from('tareas')
        .update({
          title: taskData.title,
          description: taskData.description,
          completed: taskData.completed
        })
        .eq('id', taskId);
      
      if (error) throw error;
      console.log('✅ Tarea actualizada');
    } catch (error) {
      console.error('❌ Error actualizando tarea:', error);
    }
  }

  async deleteTask(taskId) {
    if (!supabaseClient) return;
    
    try {
      console.log('🗑️ Eliminando tarea:', taskId);
      const { error } = await supabaseClient
        .from('tareas')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
      console.log('✅ Tarea eliminada');
    } catch (error) {
      console.error('❌ Error eliminando tarea:', error);
    }
  }

  async toggleTaskCompleted(taskId, completed) {
    if (!supabaseClient) return;
    
    try {
      console.log('🔄 Cambiando estado de tarea:', taskId, 'a', completed);
      const { error } = await supabaseClient
        .from('tareas')
        .update({ completed: completed })
        .eq('id', taskId);
      
      if (error) throw error;
      console.log('✅ Estado de tarea actualizado');
    } catch (error) {
      console.error('❌ Error cambiando estado de tarea:', error);
    }
  }

  // ======= FUNCIONES DE UTILIDAD =======
  convertSupabaseNodeToLocal(supabaseNode) {
    return {
      id: supabaseNode.id,
      label: supabaseNode.label,
      x: supabaseNode.x,
      y: supabaseNode.y,
      width: supabaseNode.width,
      height: supabaseNode.height,
      isCenter: supabaseNode.is_center,
      isSubroom: supabaseNode.is_subroom,
      parentNodeId: supabaseNode.parent_node_id,
      direction: supabaseNode.direction,
      tasks: []
    };
  }

  async initializeApp() {
    console.log('🚀 Inicializando aplicación...');
    
    try {
      // Cargar mapa
      const map = await this.loadMap();
      
      // Cargar nodos
      const nodes = await this.loadNodes();
      
      // Cargar conexiones
      const connections = await this.loadConnections();
      
      // Cargar tareas para cada nodo
      for (let node of nodes) {
        node.tasks = await this.loadTasks(node.id);
      }
      
      console.log('✅ Aplicación inicializada correctamente');
      return { map, nodes, connections };
    } catch (error) {
      console.error('❌ Error inicializando aplicación:', error);
      return { map: this.loadLocalMap(), nodes: [], connections: [] };
    }
  }
}

// Crear instancia global
const dbManager = new DatabaseManager();

// ============== FUNCIONES DE DIAGNÓSTICO ==============

// Verificar conexión con Supabase
async function testSupabaseConnection() {
  console.log('🔍 Iniciando prueba de conexión con Supabase...');
  
  if (!isSupabaseConfigured()) {
    console.log('⚠️ Supabase no está configurado');
    updateConnectionStatus('offline', 'Modo Local');
    return false;
  }
  
  console.log('✅ Credenciales configuradas');
  console.log('📡 URL:', SUPABASE_URL);
  console.log('🔑 Clave configurada:', SUPABASE_ANON_KEY ? 'Sí' : 'No');
  
  try {
    console.log('🚀 Intentando conectar con Supabase...');
    
    const { data, error } = await supabaseClient
      .from('mapas')
      .select('count', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.error('❌ Error de Supabase:', error);
      throw error;
    }
    
    console.log('✅ Conexión con Supabase exitosa');
    console.log('📊 Respuesta de prueba:', data);
    updateConnectionStatus('connected', 'Supabase Online');
    return true;
  } catch (error) {
    console.error('❌ Error conectando con Supabase:', error.message);
    console.error('📋 Detalles del error:', error);
    updateConnectionStatus('offline', 'Error: ' + error.message);
    return false;
  }
}

// Actualizar indicador de estado de conexión
function updateConnectionStatus(status, text) {
  const statusElement = document.getElementById('dbStatus');
  if (!statusElement) return;
  
  const iconElement = statusElement.querySelector('.status-icon');
  const textElement = statusElement.querySelector('.status-text');
  
  // Limpiar clases anteriores
  statusElement.classList.remove('connected', 'offline', 'checking');
  
  switch (status) {
    case 'connected':
      statusElement.classList.add('connected');
      iconElement.textContent = '🟢';
      textElement.textContent = text || 'Supabase Online';
      break;
    case 'offline':
      statusElement.classList.add('offline');
      iconElement.textContent = '🔴';
      textElement.textContent = text || 'Modo Local';
      break;
    default:
      statusElement.classList.add('checking');
      iconElement.textContent = '🟡';
      textElement.textContent = text || 'Verificando...';
  }
}

// Función para inicializar el estado de la conexión
async function initializeConnectionStatus() {
  updateConnectionStatus('checking', 'Verificando...');
  const isConnected = await testSupabaseConnection();
  
  if (isConnected) {
    console.log('🔍 Verificando estructura de base de datos...');
    await verifyDatabaseStructure();
  }
}

// Verificar que las tablas necesarias existan
async function verifyDatabaseStructure() {
  const tablesToCheck = ['mapas', 'nodos', 'conexiones', 'tareas'];
  
  for (const table of tablesToCheck) {
    try {
      console.log(`🔍 Verificando tabla: ${table}`);
      const { data, error } = await supabaseClient
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`❌ Error en tabla ${table}:`, error.message);
        updateConnectionStatus('offline', `Error: Tabla ${table} no existe`);
        return false;
      }
      
      console.log(`✅ Tabla ${table} verificada`);
    } catch (error) {
      console.error(`❌ Error verificando tabla ${table}:`, error);
      updateConnectionStatus('offline', `Error: ${error.message}`);
      return false;
    }
  }
  
  console.log('🎉 Todas las tablas verificadas correctamente');
  updateConnectionStatus('connected', 'Supabase Online');
  return true;
}

// Exportar para uso global
window.dbManager = dbManager;
window.testSupabaseConnection = testSupabaseConnection;
window.initializeConnectionStatus = initializeConnectionStatus;
window.updateConnectionStatus = updateConnectionStatus;
window.verifyDatabaseStructure = verifyDatabaseStructure;

// Función de prueba para insertar datos
window.testDataInsertion = async function() {
  console.log('🧪 Iniciando prueba de inserción de datos...');
  
  try {
    // Probar insertar un nodo de prueba
    const testNode = await dbManager.createNode({
      label: 'Nodo de Prueba',
      x: 500,
      y: 500,
      width: 150,
      height: 80,
      isCenter: false,
      isSubroom: false
    });
    
    if (!testNode) {
      console.error('❌ No se pudo crear el nodo de prueba');
      return false;
    }
    
    console.log('✅ Nodo de prueba creado:', testNode);
    
    // Eliminar el nodo de prueba
    if (testNode.id !== 'local') {
      await dbManager.deleteNode(testNode.id);
      console.log('🧹 Nodo de prueba eliminado');
    }
    
    console.log('🎉 Prueba de inserción exitosa');
    return true;
    
  } catch (error) {
    console.error('❌ Error en prueba de inserción:', error);
    return false;
  }
};
