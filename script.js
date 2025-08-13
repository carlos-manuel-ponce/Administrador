const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
let nodes = [];
let connections = [];
let tasks = [];
let draggingNode = null;
let offsetX, offsetY;
let connectingNode = null;
let centralNode = null;
let selectingParentRoom = false;
let selectedParentRoom = null;

// Variables para paneo y zoom
let viewOffsetX = 0;
let viewOffsetY = 0;
let zoomLevel = 1;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let lastMouseX = 0;
let lastMouseY = 0;

// Variables para gestión de tareas
let currentNode = null;
let selectedTasks = [];
let editingTask = null;

// Variables para animación de indicadores
let animationTime = 0;
let animationLoop = null;

// Función para obtener el estado de las tareas de un nodo (excepto el central)
function getTaskStatus(node) {
  // El nodo central no tiene indicador
  if (node.isCenter) {
    return null;
  }
  
  // Si no hay tareas, no mostrar indicador
  if (!node.tasks || node.tasks.length === 0) {
    return null;
  }
  
  // Verificar si hay tareas pendientes
  const pendingTasks = node.tasks.filter(task => !task.completed);
  if (pendingTasks.length > 0) {
    return 'pending'; // Rojo - hay tareas pendientes
  }
  
  return 'completed'; // Verde - todas las tareas completadas
}

// Función para dibujar el efecto de resplandor titilante del nodo
function drawNodeGlow(ctx, node, animationTime) {
  const status = getTaskStatus(node);
  
  if (!status) {
    return; // No dibujar resplandor si no hay tareas o es el nodo central
  }
  
  // Calcular si la luz está encendida o apagada (on/off)
  const pulseSpeed = 0.6; // Velocidad más lenta del encendido/apagado
  const isOn = Math.sin(animationTime * pulseSpeed) > 0; // true = encendida, false = apagada
  
  if (!isOn) {
    return; // Si está apagada, no dibujar nada
  }
  
  // Intensidad fija cuando está encendida
  const intensity = 0.8;
  
  // Color según el estado
  let glowColor;
  if (status === 'pending') {
    glowColor = `rgba(239, 68, 68, ${intensity})`; // Rojo para tareas pendientes
  } else if (status === 'completed') {
    glowColor = `rgba(16, 185, 129, ${intensity})`; // Verde para todas completadas
  }
  
  // Configurar el resplandor fuerte
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20; // Resplandor constante y fuerte
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Dibujar el borde del nodo con resplandor
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 3; // Borde grueso constante
  
  const borderRadius = node.isCenter ? 8 : node.isSubroom ? 6 : 8;
  strokeRoundedRect(ctx, node.x - 1, node.y - 1, node.width + 2, node.height + 2, borderRadius);
  
  // Resetear sombra
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

// Función de animación continua para los indicadores
function animate() {
  // Actualizar tiempo de animación
  animationTime = Date.now() * 0.001; // Convertir a segundos
  
  // Verificar si hay nodos que necesitan animación (que tengan tareas)
  const hasAnimatedNodes = nodes.some(node => {
    const status = getTaskStatus(node);
    return status !== null; // Solo animar si hay indicador que mostrar
  });
  
  if (hasAnimatedNodes) {
    draw();
    animationLoop = requestAnimationFrame(animate);
  } else {
    // Si no hay nodos que necesiten animación, parar el loop
    animationLoop = null;
  }
}

// Función para iniciar la animación si es necesaria
function startAnimationIfNeeded() {
  if (!animationLoop) {
    animate();
  }
}

// Función para dibujar el círculo indicador de estado
function drawStatusIndicator(ctx, node, animationTime) {
  const status = getTaskStatus(node);
  
  if (status === 'no-tasks') {
    // Sin tareas - círculo verde parpadeante
    const pulse = 0.3 + 0.7 * Math.abs(Math.sin(animationTime * 0.003));
    const scale = 0.8 + 0.4 * Math.abs(Math.sin(animationTime * 0.003));
    
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#10b981'; // Verde
    ctx.beginPath();
    ctx.arc(
      node.x + node.width - 8, 
      node.y + 8, 
      4 * scale, 
      0, 
      2 * Math.PI
    );
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (status === 'has-pending') {
    // Tareas pendientes - círculo rojo parpadeante
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(animationTime * 0.004));
    const scale = 0.9 + 0.4 * Math.abs(Math.sin(animationTime * 0.004));
    
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ef4444'; // Rojo
    ctx.beginPath();
    ctx.arc(
      node.x + node.width - 8, 
      node.y + 8, 
      4 * scale, 
      0, 
      2 * Math.PI
    );
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (status === 'all-completed') {
    // Todas las tareas completadas - círculo azul estático
    ctx.fillStyle = '#3b82f6'; // Azul
    ctx.beginPath();
    ctx.arc(
      node.x + node.width - 8, 
      node.y + 8, 
      3, 
      0, 
      2 * Math.PI
    );
    ctx.fill();
  }
}

// Función para redimensionar el canvas
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  
  // Configurar canvas para alta resolución (HiDPI/Retina)
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = canvas.offsetWidth;
  const displayHeight = canvas.offsetHeight;
  
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  
  // Escalar el contexto para compensar la densidad de píxeles
  ctx.scale(dpr, dpr);
  
  // Configurar para renderizado de alta calidad
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.textRenderingOptimization = 'optimizeQuality';
  
  // Crear o reposicionar el nodo central
  if (!centralNode) {
    const centerSize = calculateNodeSize('ADMINISTRADOR DE TAREAS', true, false);
    centralNode = { 
      x: -centerSize.width / 2, 
      y: -centerSize.height / 2, 
      label: 'ADMINISTRADOR DE TAREAS', 
      width: centerSize.width, 
      height: centerSize.height,
      isCenter: true,
      isSubroom: false,
      tasks: []
    };
    nodes.push(centralNode);
  }
  
  draw();
  startAnimationIfNeeded();
  
  // Forzar un redibujado adicional para asegurar que el nodo central sea visible
  setTimeout(() => {
    draw();
  }, 100);
}

// Redimensionar canvas al cargar la página
window.addEventListener('load', async () => {
  resizeCanvas();
  
  // Inicializar estado de conexión con Supabase
  if (typeof initializeConnectionStatus === 'function') {
    await initializeConnectionStatus();
  }
  
  // Cargar datos desde Supabase
  if (typeof dbManager !== 'undefined') {
    console.log('🚀 Cargando datos desde Supabase...');
    try {
      const appData = await dbManager.initializeApp();
      
      if (appData.nodes && appData.nodes.length > 0) {
        // Limpiar datos locales
        nodes.length = 0;
        connections.length = 0;
        tasks.length = 0;
        
        // Cargar nodos desde Supabase
        nodes.push(...appData.nodes);
        
        // Actualizar referencia del nodo central
        centralNode = nodes.find(node => node.isCenter) || null;
        if (centralNode) {
          console.log('✅ Nodo central encontrado:', centralNode.label);
        }
        
        // Cargar conexiones desde Supabase
        const rawConnections = appData.connections;
        
        // Convertir conexiones de IDs a referencias de objetos
        for (const conn of rawConnections) {
          const fromNode = nodes.find(n => n.id == conn.fromNodeId);
          const toNode = nodes.find(n => n.id == conn.toNodeId);
          
          if (fromNode && toNode) {
            connections.push({
              id: conn.id,
              fromNodeId: conn.fromNodeId,
              toNodeId: conn.toNodeId,
              from: fromNode,
              to: toNode
            });
          } else {
            console.warn('⚠️ Conexión inválida encontrada:', conn);
          }
        }
        
        // Cargar tareas desde Supabase
        for (const node of appData.nodes) {
          if (node.tasks && node.tasks.length > 0) {
            tasks.push(...node.tasks);
          }
        }
        
        console.log(`✅ Datos cargados: ${nodes.length} nodos, ${connections.length} conexiones, ${tasks.length} tareas`);
        
        // Configurar vista según el mapa cargado
        if (appData.map) {
          viewOffsetX = appData.map.view_offset_x || canvas.width / 2 / zoomLevel;
          viewOffsetY = appData.map.view_offset_y || canvas.height / 2 / zoomLevel;
          zoomLevel = appData.map.zoom_level || 1;
        }
      } else {
        console.log('📋 No hay datos en Supabase, inicializando con nodo central');
        createCenterNode();
      }
    } catch (error) {
      console.error('❌ Error cargando datos desde Supabase:', error);
      createCenterNode();
    }
  } else {
    console.log('📋 Modo local - creando nodo central');
    createCenterNode();
  }
  
  draw();
});

// Función para crear el nodo central por defecto
function createCenterNode() {
  // Centrar vista en el nodo central
  viewOffsetX = canvas.width / 2 / zoomLevel;
  viewOffsetY = canvas.height / 2 / zoomLevel;
  
  // Solo crear si no existe un nodo central
  const centerExists = nodes.some(node => node.isCenter);
  if (!centerExists) {
    const centerNode = {
      id: Date.now().toString(),
      label: 'ADMINISTRADOR DE TAREAS',
      x: 0,
      y: 0,
      width: 200,
      height: 42,
      isCenter: true,
      isSubroom: false,
      tasks: []
    };
    nodes.push(centerNode);
    centralNode = centerNode; // Actualizar la variable global
    console.log('✅ Nodo central creado en modo local');
  } else {
    // Si ya existe, actualizar la referencia
    centralNode = nodes.find(node => node.isCenter);
  }
}
window.addEventListener('resize', resizeCanvas);

// Inicializar canvas
resizeCanvas();

// Función para calcular el tamaño óptimo del nodo basado en el texto
function calculateNodeSize(label, isCenter, isSubroom) {
  // Crear un canvas temporal para medir el texto
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  
  // Configurar la fuente según el tipo de nodo
  if (isCenter) {
    tempCtx.font = '600 13px Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  } else if (isSubroom) {
    tempCtx.font = '500 11px Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  } else {
    tempCtx.font = '500 12px Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  }
  
  // Medir el ancho del texto
  const textMetrics = tempCtx.measureText(label);
  const textWidth = textMetrics.width;
  
  // Calcular dimensiones con padding apropiado
  let width, height;
  
  if (isCenter) {
    width = Math.max(textWidth + 24, 85); // Mínimo 85px, padding 24px
    height = 42;
  } else if (isSubroom) {
    width = Math.max(textWidth + 18, 55); // Mínimo 55px, padding 18px
    height = 32;
  } else {
    width = Math.max(textWidth + 20, 65); // Mínimo 65px, padding 20px
    height = 42;
  }
  
  return { width: Math.ceil(width), height };
}

document.getElementById('addNode').addEventListener('click', () => {
  const label = prompt('Nombre de la sala:');
  if (label && label.trim()) {
    // Calcular el tamaño óptimo del nodo
    const nodeSize = calculateNodeSize(label.trim(), false, false);
    
    // Encontrar la primera posición disponible automáticamente
    const distance = 150;
    const directions = [
      { name: 'derecha', x: distance - nodeSize.width / 2, y: -nodeSize.height / 2 },
      { name: 'abajo', x: -nodeSize.width / 2, y: distance - nodeSize.height / 2 },
      { name: 'izquierda', x: -distance - nodeSize.width / 2, y: -nodeSize.height / 2 },
      { name: 'arriba', x: -nodeSize.width / 2, y: -distance - nodeSize.height / 2 }
    ];
    
    let finalPosition = null;
    
    // Buscar la primera dirección disponible
    for (let i = 0; i < directions.length; i++) {
      const dir = directions[i];
      let x = dir.x;
      let y = dir.y;
      
      // Verificar si hay salas en esta dirección y ajustar posición
      const existingInDirection = nodes.filter(node => 
        !node.isCenter && !node.isSubroom && 
        isInSameDirection(node, x, y, 0, 0)
      );
      
      if (existingInDirection.length > 0) {
        // Calcular offset para múltiples salas en la misma dirección
        const offset = existingInDirection.length * 90;
        switch (dir.name) {
          case 'arriba':
            y -= offset;
            break;
          case 'derecha':
            x += offset;
            break;
          case 'abajo':
            y += offset;
            break;
          case 'izquierda':
            x -= offset;
            break;
        }
      }
      
      finalPosition = { x, y, direction: dir.name };
      break; // Usar la primera dirección encontrada
    }
    
    if (finalPosition) {
      const newNode = {
        x: finalPosition.x,
        y: finalPosition.y,
        label: label.trim(),
        width: nodeSize.width,
        height: nodeSize.height,
        isCenter: false,
        isSubroom: false,
        direction: finalPosition.direction,
        tasks: []
      };
      
      // Guardar en Supabase si está disponible
      if (typeof dbManager !== 'undefined') {
        dbManager.createNode(newNode).then(savedNode => {
          if (savedNode && savedNode.id) {
            // Actualizar con el ID de Supabase
            newNode.id = savedNode.id;
            console.log('✅ Nodo guardado en Supabase:', savedNode);
            
            // Crear conexión después de que el nodo tenga ID
            if (centralNode && centralNode.id) {
              const connection = { 
                fromNodeId: centralNode.id, 
                toNodeId: newNode.id,
                from: centralNode, 
                to: newNode 
              };
              connections.push(connection);
              
              // Guardar conexión en Supabase
              dbManager.createConnection(centralNode.id, newNode.id).then(() => {
                console.log('✅ Conexión guardada en Supabase');
              }).catch(error => {
                console.error('❌ Error guardando conexión:', error);
              });
            }
          }
        }).catch(error => {
          console.error('❌ Error guardando nodo:', error);
        });
      } else {
        // Modo local
        newNode.id = Date.now().toString();
        
        // Crear conexión inmediatamente en modo local
        if (centralNode) {
          const connection = { 
            fromNodeId: centralNode.id, 
            toNodeId: newNode.id,
            from: centralNode, 
            to: newNode 
          };
          connections.push(connection);
        }
      }
      
      nodes.push(newNode);
      
      draw();
    }
  }
});

// Función auxiliar para verificar si un nodo está en la misma dirección
function isInSameDirection(node, newX, newY, centerX, centerY) {
  const nodeDirection = getNodeDirection(node, centerX, centerY);
  const newDirection = getNodeDirection({x: newX, y: newY}, centerX, centerY);
  return nodeDirection === newDirection;
}

// Función auxiliar para obtener la dirección de un nodo
function getNodeDirection(node, centerX, centerY) {
  const deltaX = (node.x + node.width / 2) - centerX;
  const deltaY = (node.y + node.height / 2) - centerY;
  
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0 ? 'derecha' : 'izquierda';
  } else {
    return deltaY > 0 ? 'abajo' : 'arriba';
  }
}

// Botón para añadir subsala
document.getElementById('addSubroom').addEventListener('click', () => {
  if (selectingParentRoom) {
    // Cancelar selección
    selectingParentRoom = false;
    selectedParentRoom = null;
    updateButtonText();
    draw();
    return;
  }
  
  selectingParentRoom = true;
  selectedParentRoom = null;
  updateButtonText();
  alert('Ahora haz clic en la sala padre donde quieres añadir la subsala. Click en "Añadir Subsala" otra vez para cancelar.');
});

// Función para actualizar el texto del botón
function updateButtonText() {
  const button = document.getElementById('addSubroom');
  if (selectingParentRoom) {
    button.textContent = 'Cancelar Subsala';
    button.style.backgroundColor = '#dc3545';
  } else {
    button.textContent = 'Añadir Subsala';
    button.style.backgroundColor = '#007bff';
  }
}

canvas.addEventListener('mousedown', (e) => {
  const { offsetX: mx, offsetY: my } = e;
  const worldPos = screenToWorld(mx, my);
  
  // Check if middle button (wheel) is pressed for panning
  if (e.button === 1 || e.ctrlKey) {
    isPanning = true;
    lastMouseX = mx;
    lastMouseY = my;
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
    return;
  }
  
  // Check for node interaction
  let nodeClicked = false;
  for (let node of nodes) {
    if (worldPos.x > node.x && worldPos.x < node.x + node.width && 
        worldPos.y > node.y && worldPos.y < node.y + node.height) {
      
      nodeClicked = true;
      
      // Si estamos seleccionando sala padre para subsala
      if (selectingParentRoom && !node.isCenter) {
        selectedParentRoom = node;
        const subroomName = prompt('Nombre de la subsala:');
        if (subroomName && subroomName.trim()) {
          // Crear subsala automáticamente en la primera posición disponible
          createSubroomAuto(selectedParentRoom, subroomName.trim());
        }
        selectingParentRoom = false;
        selectedParentRoom = null;
        updateButtonText();
        draw();
        return;
      }
      
      if (e.shiftKey) {
        if (!connectingNode) {
          connectingNode = node;
        } else {
          connections.push({ 
            id: `local_${Date.now()}`,
            fromNodeId: connectingNode.id,
            toNodeId: node.id,
            from: connectingNode, 
            to: node 
          });
          connectingNode = null;
        }
      } else {
        // Solo permitir arrastrar nodos que no sean el central
        if (!node.isCenter) {
          draggingNode = node;
          offsetX = worldPos.x - node.x;
          offsetY = worldPos.y - node.y;
          canvas.style.cursor = 'grabbing';
        }
        
        // Guardar posición inicial para detectar si fue un clic o arrastre
        node.dragStartX = node.x;
        node.dragStartY = node.y;
      }
      draw();
      return;
    }
  }
  
  // Si no se hizo click en ningún nodo, permitir paneo
  if (!nodeClicked) {
    // Si click en área vacía mientras selecciona sala padre, cancelar
    if (selectingParentRoom) {
      selectingParentRoom = false;
      selectedParentRoom = null;
      updateButtonText();
      draw();
    } else {
      // Iniciar paneo en área vacía
      isPanning = true;
      lastMouseX = mx;
      lastMouseY = my;
      canvas.style.cursor = 'grabbing';
    }
  }
});

// Función para crear subsala automáticamente
function createSubroomAuto(parentRoom, subroomName) {
  const distance = 90; // Distancia fija de la sala padre
  
  // Calcular el tamaño óptimo de la subsala
  const subroomSize = calculateNodeSize(subroomName, false, true);
  
  const parentCenterX = parentRoom.x + parentRoom.width / 2;
  const parentCenterY = parentRoom.y + parentRoom.height / 2;
  
  // Definir posiciones preferidas (derecha, abajo, arriba, izquierda)
  const positions = [
    {
      name: 'derecha',
      x: parentRoom.x + parentRoom.width + distance - subroomSize.width / 2,
      y: parentCenterY - subroomSize.height / 2
    },
    {
      name: 'abajo',
      x: parentCenterX - subroomSize.width / 2,
      y: parentRoom.y + parentRoom.height + distance - subroomSize.height / 2
    },
    {
      name: 'arriba',
      x: parentCenterX - subroomSize.width / 2,
      y: parentRoom.y - distance - subroomSize.height / 2
    },
    {
      name: 'izquierda',
      x: parentRoom.x - distance - subroomSize.width / 2,
      y: parentCenterY - subroomSize.height / 2
    }
  ];
  
  // Encontrar la primera posición disponible o con menor número de subsalas
  let bestPosition = positions[0];
  let minSubrooms = Infinity;
  
  for (const pos of positions) {
    const existingInDirection = nodes.filter(node => 
      node.isSubroom && 
      node.parentRoom === parentRoom && 
      isSubroomInSameDirection(node, pos.x, pos.y, parentCenterX, parentCenterY)
    );
    
    if (existingInDirection.length < minSubrooms) {
      minSubrooms = existingInDirection.length;
      bestPosition = pos;
    }
  }
  
  // Ajustar posición si ya hay subsalas en esa dirección
  let finalX = bestPosition.x;
  let finalY = bestPosition.y;
  
  if (minSubrooms > 0) {
    const offset = minSubrooms * 70;
    switch (bestPosition.name) {
      case 'arriba':
        finalY -= offset;
        break;
      case 'derecha':
        finalY += (minSubrooms % 2 === 0 ? offset : -offset);
        break;
      case 'abajo':
        finalY += offset;
        break;
      case 'izquierda':
        finalY += (minSubrooms % 2 === 0 ? offset : -offset);
        break;
    }
  }
  
  const newSubroom = {
    x: finalX,
    y: finalY,
    label: subroomName,
    width: subroomSize.width,
    height: subroomSize.height,
    isCenter: false,
    isSubroom: true,
    parentRoom: parentRoom,
    direction: bestPosition.name,
    tasks: []
  };
  
  nodes.push(newSubroom);
  
  // Conectar subsala con sala padre
  connections.push({ 
    id: `local_${Date.now()}_1`,
    fromNodeId: parentRoom.id,
    toNodeId: newSubroom.id,
    from: parentRoom, 
    to: newSubroom 
  });
}

// Función para crear subsala
function createSubroom(parentRoom, subroomName, direction) {
  const distance = 90; // Distancia fija de la sala padre
  
  // Calcular el tamaño óptimo de la subsala
  const subroomSize = calculateNodeSize(subroomName, false, true);
  
  const parentCenterX = parentRoom.x + parentRoom.width / 2;
  const parentCenterY = parentRoom.y + parentRoom.height / 2;
  
  let x, y;
  
  switch (direction) {
    case '1': // Arriba
      x = parentCenterX - subroomSize.width / 2;
      y = parentRoom.y - distance - subroomSize.height / 2;
      break;
    case '2': // Derecha
      x = parentRoom.x + parentRoom.width + distance - subroomSize.width / 2;
      y = parentCenterY - subroomSize.height / 2;
      break;
    case '3': // Abajo
      x = parentCenterX - subroomSize.width / 2;
      y = parentRoom.y + parentRoom.height + distance - subroomSize.height / 2;
      break;
    case '4': // Izquierda
      x = parentRoom.x - distance - subroomSize.width / 2;
      y = parentCenterY - subroomSize.height / 2;
      break;
    default:
      // Si no se especifica dirección, usar posición aleatoria (compatibilidad)
      const angle = Math.random() * 2 * Math.PI;
      x = parentCenterX + Math.cos(angle) * distance - subroomSize.width / 2;
      y = parentCenterY + Math.sin(angle) * distance - subroomSize.height / 2;
  }
  
  // Verificar si ya hay subsalas en esa dirección y ajustar posición
  const existingSubroomsInDirection = nodes.filter(node => 
    node.isSubroom && 
    node.parentRoom === parentRoom && 
    isSubroomInSameDirection(node, x, y, parentCenterX, parentCenterY)
  );
  
  if (existingSubroomsInDirection.length > 0) {
    const offset = existingSubroomsInDirection.length * 70;
    switch (direction) {
      case '1': // Arriba
        y -= offset;
        break;
      case '2': // Derecha
        y += (existingSubroomsInDirection.length % 2 === 0 ? offset : -offset);
        break;
      case '3': // Abajo
        y += offset;
        break;
      case '4': // Izquierda
        y += (existingSubroomsInDirection.length % 2 === 0 ? offset : -offset);
        break;
    }
  }
  
  const newSubroom = {
    x: x,
    y: y,
    label: subroomName,
    width: subroomSize.width,
    height: subroomSize.height,
    isCenter: false,
    isSubroom: true,
    parentRoom: parentRoom,
    direction: direction,
    tasks: []
  };
  
  nodes.push(newSubroom);
  
  // Conectar subsala con sala padre
  connections.push({ 
    id: `local_${Date.now()}_2`,
    fromNodeId: parentRoom.id,
    toNodeId: newSubroom.id,
    from: parentRoom, 
    to: newSubroom 
  });
}

// Función auxiliar para verificar si una subsala está en la misma dirección
function isSubroomInSameDirection(subroom, newX, newY, parentCenterX, parentCenterY) {
  const subroomDirection = getSubroomDirection(subroom, parentCenterX, parentCenterY);
  const newDirection = getSubroomDirection({x: newX, y: newY}, parentCenterX, parentCenterY);
  return subroomDirection === newDirection;
}

// Función auxiliar para obtener la dirección de una subsala respecto a su padre
function getSubroomDirection(subroom, parentCenterX, parentCenterY) {
  const deltaX = (subroom.x + subroom.width / 2) - parentCenterX;
  const deltaY = (subroom.y + subroom.height / 2) - parentCenterY;
  
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0 ? 'derecha' : 'izquierda';
  } else {
    return deltaY > 0 ? 'abajo' : 'arriba';
  }
}

// Función para dibujar grid infinito con puntos
function drawInfiniteGrid() {
  const baseGridSize = 20;
  const gridSize = baseGridSize * zoomLevel;
  
  // Solo mostrar grid si el zoom es suficiente para que sea visible
  if (gridSize < 8) return;
  
  // Calcular los offsets del grid basados en la posición de la vista
  const offsetX = (viewOffsetX * zoomLevel) % gridSize;
  const offsetY = (viewOffsetY * zoomLevel) % gridSize;
  
  // Configurar el estilo de los puntos
  const dotSize = Math.max(1, Math.min(2, zoomLevel * 0.8));
  const opacity = Math.min(0.3, zoomLevel * 0.15);
  
  ctx.fillStyle = `rgba(148, 163, 184, ${opacity})`; // Gris claro para modo oscuro
  
  // Dibujar puntos del grid
  for (let x = offsetX; x < canvas.width + gridSize; x += gridSize) {
    for (let y = offsetY; y < canvas.height + gridSize; y += gridSize) {
      if (x >= 0 && y >= 0 && x <= canvas.width && y <= canvas.height) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
  
  // Grid secundario más sutil (cada 5 puntos)
  if (zoomLevel > 0.5) {
    const largeGridSize = baseGridSize * 5 * zoomLevel;
    const largeOffsetX = (viewOffsetX * zoomLevel) % largeGridSize;
    const largeOffsetY = (viewOffsetY * zoomLevel) % largeGridSize;
    
    const largeDotSize = Math.max(1.5, Math.min(3, zoomLevel * 1.2));
    const largeOpacity = Math.min(0.2, zoomLevel * 0.1);
    
    ctx.fillStyle = `rgba(148, 163, 184, ${largeOpacity})`; // Gris claro para modo oscuro
    
    for (let x = largeOffsetX; x < canvas.width + largeGridSize; x += largeGridSize) {
      for (let y = largeOffsetY; y < canvas.height + largeGridSize; y += largeGridSize) {
        if (x >= 0 && y >= 0 && x <= canvas.width && y <= canvas.height) {
          ctx.beginPath();
          ctx.arc(x, y, largeDotSize, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
  }
}

// Función para transformar coordenadas del mundo a la pantalla
function worldToScreen(x, y) {
  return {
    x: (x + viewOffsetX) * zoomLevel,
    y: (y + viewOffsetY) * zoomLevel
  };
}

// Función para transformar coordenadas de la pantalla al mundo
function screenToWorld(x, y) {
  return {
    x: (x / zoomLevel) - viewOffsetX,
    y: (y / zoomLevel) - viewOffsetY
  };
}

// Función para actualizar el indicador de zoom
function updateZoomIndicator() {
  const zoomElement = document.getElementById('zoomValue');
  if (zoomElement) {
    const zoomPercentage = Math.round(zoomLevel * 100);
    zoomElement.textContent = `${zoomPercentage}%`;
  }
}

canvas.addEventListener('mousemove', (e) => {
  const currentMouseX = e.offsetX;
  const currentMouseY = e.offsetY;
  
  if (isPanning) {
    const deltaX = currentMouseX - lastMouseX;
    const deltaY = currentMouseY - lastMouseY;
    
    viewOffsetX += deltaX / zoomLevel;
    viewOffsetY += deltaY / zoomLevel;
    
    lastMouseX = currentMouseX;
    lastMouseY = currentMouseY;
    
    draw();
  } else if (draggingNode) {
    const worldPos = screenToWorld(currentMouseX, currentMouseY);
    draggingNode.x = worldPos.x - offsetX;
    draggingNode.y = worldPos.y - offsetY;
    draw();
  }
});

canvas.addEventListener('mouseup', (e) => {
  // Encontrar el nodo que se hizo clic (si existe)
  const { offsetX: mx, offsetY: my } = e;
  const worldPos = screenToWorld(mx, my);
  let clickedNode = null;
  
  for (let node of nodes) {
    if (worldPos.x > node.x && worldPos.x < node.x + node.width && 
        worldPos.y > node.y && worldPos.y < node.y + node.height) {
      clickedNode = node;
      break;
    }
  }
  
  // Si se estaba arrastrando un nodo, verificar si fue un clic o un arrastre
  if (draggingNode && clickedNode === draggingNode) {
    const dragThreshold = 5; // píxeles
    const dragDistance = Math.sqrt(
      Math.pow(draggingNode.x - (draggingNode.dragStartX || draggingNode.x), 2) +
      Math.pow(draggingNode.y - (draggingNode.dragStartY || draggingNode.y), 2)
    );
    
    // Si no se movió mucho, considerarlo un clic
    if (dragDistance < dragThreshold && !selectingParentRoom) {
      openTaskModal(draggingNode);
    }
  } else if (clickedNode && !draggingNode && !selectingParentRoom) {
    // Si se hizo clic en un nodo sin arrastrar (como el nodo central)
    openTaskModal(clickedNode);
  }
  
  // Limpiar propiedades de arrastre
  if (clickedNode) {
    delete clickedNode.dragStartX;
    delete clickedNode.dragStartY;
  }
  
  draggingNode = null;
  isPanning = false;
  canvas.style.cursor = 'crosshair';
});

// Event listener para zoom con la rueda del ratón
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  const mouseX = e.offsetX;
  const mouseY = e.offsetY;
  
  // Convertir posición del mouse a coordenadas del mundo antes del zoom
  const worldPosBeforeZoom = screenToWorld(mouseX, mouseY);
  
  // Calcular nuevo nivel de zoom con sensibilidad mejorada
  const sensitivity = 0.1; // Factor de sensibilidad
  const zoomFactor = e.deltaY > 0 ? (1 - sensitivity) : (1 + sensitivity);
  const newZoom = Math.max(0.1, Math.min(10, zoomLevel * zoomFactor));
  
  // Solo aplicar zoom si hay cambio significativo
  if (Math.abs(newZoom - zoomLevel) > 0.001) {
    // Actualizar zoom
    zoomLevel = newZoom;
    
    // Convertir la misma posición del mundo después del zoom
    const worldPosAfterZoom = screenToWorld(mouseX, mouseY);
    
    // Ajustar offset para mantener la posición del mouse fija
    viewOffsetX += worldPosAfterZoom.x - worldPosBeforeZoom.x;
    viewOffsetY += worldPosAfterZoom.y - worldPosBeforeZoom.y;
    
    draw();
  }
}, { passive: false });

// Prevenir el menú contextual en el canvas
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// Controles de teclado para navegación
document.addEventListener('keydown', (e) => {
  if (e.target.tagName.toLowerCase() === 'input') return; // No interceptar si se está escribiendo
  
  switch(e.key) {
    case 'r':
    case 'R':
      // Reset de vista - centrar y zoom 1:1
      viewOffsetX = 0;
      viewOffsetY = 0;
      zoomLevel = 1;
      draw();
      break;
    case '0':
      // Ajustar zoom para ver todos los nodos
      fitToView();
      break;
    case '+':
    case '=':
      // Zoom in
      zoomLevel = Math.min(5, zoomLevel * 1.2);
      draw();
      break;
    case '-':
    case '_':
      // Zoom out
      zoomLevel = Math.max(0.1, zoomLevel / 1.2);
      draw();
      break;
  }
});

// Función para ajustar la vista a todos los nodos
function fitToView() {
  if (nodes.length === 0) return;
  
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  // Encontrar límites de todos los nodos
  for (let node of nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x + node.width);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y + node.height);
  }
  
  // Agregar margen
  const margin = 50;
  minX -= margin;
  maxX += margin;
  minY -= margin;
  maxY += margin;
  
  // Calcular zoom para ajustar todo en pantalla
  const worldWidth = maxX - minX;
  const worldHeight = maxY - minY;
  const zoomX = canvas.width / worldWidth;
  const zoomY = canvas.height / worldHeight;
  zoomLevel = Math.min(zoomX, zoomY, 2); // Máximo zoom 2x
  
  // Centrar la vista
  const centerWorldX = (minX + maxX) / 2;
  const centerWorldY = (minY + maxY) / 2;
  viewOffsetX = (canvas.width / 2) / zoomLevel - centerWorldX;
  viewOffsetY = (canvas.height / 2) / zoomLevel - centerWorldY;
  
  draw();
}

function draw() {
  // Actualizar tiempo de animación
  animationTime = Date.now();
  
  // Actualizar indicador de zoom
  updateZoomIndicator();
  
  // Limpiar canvas con configuración de alta calidad
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Configurar para alta calidad de renderizado
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Dibujar grid infinito
  drawInfiniteGrid();
  
  // Aplicar transformaciones de zoom y paneo
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(zoomLevel * dpr, 0, 0, zoomLevel * dpr, viewOffsetX * zoomLevel * dpr, viewOffsetY * zoomLevel * dpr);
  
  // Dibujar conexiones con líneas punteadas de alta calidad
  ctx.lineWidth = 3 / zoomLevel; // Líneas más gruesas para mejor visibilidad
  ctx.strokeStyle = 'rgba(156, 163, 175, 0.9)'; // Gris más claro y visible
  ctx.setLineDash([6 / zoomLevel, 6 / zoomLevel]); // Puntos más grandes
  
  for (let conn of connections) {
    // Calcular puntos de conexión basados en la dirección
    let fromX, fromY, toX, toY;
    
    if (conn.from.isCenter) {
      // Desde el centro, calcular el punto de salida basado en la dirección de la sala destino
      const centerX = conn.from.x + conn.from.width / 2;
      const centerY = conn.from.y + conn.from.height / 2;
      const targetCenterX = conn.to.x + conn.to.width / 2;
      const targetCenterY = conn.to.y + conn.to.height / 2;
      
      // Determinar la dirección y punto de salida del centro
      const deltaX = targetCenterX - centerX;
      const deltaY = targetCenterY - centerY;
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Conexión horizontal
        if (deltaX > 0) {
          // Hacia la derecha
          fromX = conn.from.x + conn.from.width;
          fromY = centerY;
          toX = conn.to.x;
          toY = conn.to.y + conn.to.height / 2;
        } else {
          // Hacia la izquierda
          fromX = conn.from.x;
          fromY = centerY;
          toX = conn.to.x + conn.to.width;
          toY = conn.to.y + conn.to.height / 2;
        }
      } else {
        // Conexión vertical
        if (deltaY > 0) {
          // Hacia abajo
          fromX = centerX;
          fromY = conn.from.y + conn.from.height;
          toX = conn.to.x + conn.to.width / 2;
          toY = conn.to.y;
        } else {
          // Hacia arriba
          fromX = centerX;
          fromY = conn.from.y;
          toX = conn.to.x + conn.to.width / 2;
          toY = conn.to.y + conn.to.height;
        }
      }
    } else {
      // Conexiones normales (sala a subsala)
      fromX = conn.from.x + conn.from.width;
      fromY = conn.from.y + conn.from.height / 2;
      toX = conn.to.x;
      toY = conn.to.y + conn.to.height / 2;
      
      // Si la subsala está a la izquierda de la sala
      if (conn.to.x < conn.from.x) {
        fromX = conn.from.x;
        toX = conn.to.x + conn.to.width;
      }
      // Si la subsala está arriba o abajo
      else if (Math.abs((conn.to.y + conn.to.height/2) - (conn.from.y + conn.from.height/2)) > 
               Math.abs((conn.to.x + conn.to.width/2) - (conn.from.x + conn.from.width/2))) {
        if (conn.to.y < conn.from.y) {
          // Subsala arriba
          fromX = conn.from.x + conn.from.width / 2;
          fromY = conn.from.y;
          toX = conn.to.x + conn.to.width / 2;
          toY = conn.to.y + conn.to.height;
        } else {
          // Subsala abajo
          fromX = conn.from.x + conn.from.width / 2;
          fromY = conn.from.y + conn.from.height;
          toX = conn.to.x + conn.to.width / 2;
          toY = conn.to.y;
        }
      }
    }
    
    // Calcular puntos de control para curva bezier suave
    const controlOffset = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY)) * 0.4;
    let cp1x, cp1y, cp2x, cp2y;
    
    if (Math.abs(toX - fromX) > Math.abs(toY - fromY)) {
      // Conexión principalmente horizontal
      cp1x = fromX + (toX > fromX ? controlOffset : -controlOffset);
      cp1y = fromY;
      cp2x = toX + (toX > fromX ? -controlOffset : controlOffset);
      cp2y = toY;
    } else {
      // Conexión principalmente vertical
      cp1x = fromX;
      cp1y = fromY + (toY > fromY ? controlOffset : -controlOffset);
      cp2x = toX;
      cp2y = toY + (toY > fromY ? -controlOffset : controlOffset);
    }
    
    // Dibujar curva bezier punteada
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, toX, toY);
    ctx.stroke();
  }
  
  ctx.setLineDash([]); // Quitar línea punteada para nodos
  
  // Dibujar nodos con estilo de alta calidad
  for (let node of nodes) {
    const borderRadius = 8;
    
    // Dibujar resplandor titilante del nodo ANTES del nodo
    drawNodeGlow(ctx, node, animationTime);
    
    // Sombra más pronunciada para profundidad
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    drawRoundedRect(ctx, node.x + 3, node.y + 3, node.width, node.height, borderRadius);
    
    // Fondo del nodo con mejores colores y gradientes
    if (node.isCenter) {
      // Nodo central - Rojo brillante con gradiente
      const gradient = ctx.createLinearGradient(node.x, node.y, node.x, node.y + node.height);
      gradient.addColorStop(0, '#f87171'); // Rojo claro arriba
      gradient.addColorStop(1, '#dc2626'); // Rojo oscuro abajo
      ctx.fillStyle = gradient;
    } else if (node.isSubroom) {
      // Subsalas - Gris azulado con gradiente
      const gradient = ctx.createLinearGradient(node.x, node.y, node.x, node.y + node.height);
      gradient.addColorStop(0, '#9ca3af'); // Gris claro arriba
      gradient.addColorStop(1, '#6b7280'); // Gris oscuro abajo
      ctx.fillStyle = gradient;
    } else {
      // Salas - Azul con gradiente
      const gradient = ctx.createLinearGradient(node.x, node.y, node.x, node.y + node.height);
      gradient.addColorStop(0, '#60a5fa'); // Azul claro arriba
      gradient.addColorStop(1, '#3b82f6'); // Azul oscuro abajo
      ctx.fillStyle = gradient;
    }
    
    drawRoundedRect(ctx, node.x, node.y, node.width, node.height, borderRadius);
    
    // Borde brillante para mejor definición
    ctx.strokeStyle = node.isCenter ? 
      'rgba(255, 255, 255, 0.4)' : 
      'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    strokeRoundedRect(ctx, node.x, node.y, node.width, node.height, borderRadius);
    
    // Resaltar sala si está siendo seleccionada para subsala
    if (selectingParentRoom && !node.isCenter && !node.isSubroom) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 8;
      strokeRoundedRect(ctx, node.x - 1, node.y - 1, node.width + 2, node.height + 2, borderRadius + 1);
      ctx.shadowBlur = 0;
    }
    
    // Puntos de conexión mejorados con mejor visibilidad
    if (node.isCenter) {
      // Puntos de conexión del nodo central - más visibles
      const pointColor = '#e2e8f0';
      const pointRadius = 4;
      
      ctx.fillStyle = pointColor;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      
      // Arriba
      ctx.beginPath();
      ctx.arc(node.x + node.width / 2, node.y - 2, pointRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Derecha
      ctx.beginPath();
      ctx.arc(node.x + node.width + 2, node.y + node.height / 2, pointRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Abajo
      ctx.beginPath();
      ctx.arc(node.x + node.width / 2, node.y + node.height + 2, pointRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Izquierda
      ctx.beginPath();
      ctx.arc(node.x - 2, node.y + node.height / 2, pointRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(node.x - 1, node.y + node.height / 2, 3, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      // Puntos de conexión para salas y subsalas mejorados
      const pointColor = '#cbd5e1';
      const pointRadius = 3;
      
      ctx.fillStyle = pointColor;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      
      if (!node.isSubroom) {
        // Salas: puntos de conexión más visibles
        const centerX = 0;
        const centerY = 0;
        const nodeCenterX = node.x + node.width / 2;
        const nodeCenterY = node.y + node.height / 2;
        
        // Puntos de entrada y salida para salas
        const points = [
          { x: node.x + node.width + 2, y: node.y + node.height / 2 }, // Derecha
          { x: node.x - 2, y: node.y + node.height / 2 }, // Izquierda
          { x: node.x + node.width / 2, y: node.y - 2 }, // Arriba
          { x: node.x + node.width / 2, y: node.y + node.height + 2 } // Abajo
        ];
        
        points.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, pointRadius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        });
      } else {
        // Subsalas: solo punto de entrada mejorado
        ctx.beginPath();
        ctx.arc(node.x - 2, node.y + node.height / 2, pointRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    }
    
    // Texto del nodo con renderizado de alta calidad
    ctx.fillStyle = 'white';
    
    // Configurar fuente con mejor calidad
    const fontSize = node.isCenter ? 14 : node.isSubroom ? 12 : 13;
    const fontWeight = node.isCenter ? '700' : '600';
    ctx.font = `${fontWeight} ${fontSize}px "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Configurar renderizado de texto de alta calidad
    ctx.textRenderingOptimization = 'optimizeQuality';
    ctx.fontKerning = 'normal';
    ctx.fontVariantCaps = 'normal';
    
    // Texto con sombra más definida para mejor legibilidad
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    // Dibujar texto
    ctx.fillText(node.label, node.x + node.width / 2, node.y + node.height / 2);
    
    // Resetear sombra
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  
  // Mostrar instrucciones si está seleccionando sala padre
  if (selectingParentRoom) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    drawRoundedRect(ctx, 20, 20, 320, 80, 8);
    
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    strokeRoundedRect(ctx, 20, 20, 320, 80, 8);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 12px Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Selecciona una SALA para añadir subsala', 30, 40);
    ctx.fillText('Podrás elegir la dirección: ↑ ↓ ← →', 30, 55);
    ctx.fillText('Click "Cancelar Subsala" para cancelar', 30, 75);
  }
  
  // Restaurar el contexto
  ctx.restore();
}

// Función auxiliar para dibujar rectángulos redondeados
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

function strokeRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.stroke();
}

document.getElementById('saveMap').addEventListener('click', () => {
  const mapData = {
    nodes: nodes.filter(node => !node.isCenter), // No guardar el nodo central (se recrea automáticamente)
    connections: connections,
    centralNode: centralNode
  };
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(mapData, null, 2));
  const a = document.createElement('a');
  a.href = dataStr;
  a.download = 'administrador_tareas.json';
  a.click();
});

// ============== SISTEMA DE GESTIÓN DE TAREAS ==============

// Función para abrir el modal de tareas
function openTaskModal(node) {
  currentNode = node;
  selectedTasks = [];
  
  const modal = document.getElementById('taskModal');
  const modalTitle = document.getElementById('modalTitle');
  
  modalTitle.textContent = `Tareas - ${node.label}`;
  modal.style.display = 'block';
  
  renderTasks();
}

// Función para renderizar la lista de tareas
function renderTasks() {
  const container = document.getElementById('tasksContainer');
  
  if (!currentNode.tasks || currentNode.tasks.length === 0) {
    container.innerHTML = '<p class="no-tasks">No hay tareas. Haz clic en "Agregar Tarea" para crear una.</p>';
    return;
  }
  
  container.innerHTML = '';
  
  currentNode.tasks.forEach((task, index) => {
    const taskElement = document.createElement('div');
    taskElement.className = 'task-item';
    taskElement.dataset.index = index;
    
    if (task.completed) {
      taskElement.classList.add('completed');
    }
    
    if (selectedTasks.includes(index)) {
      taskElement.classList.add('selected');
    }
    
    taskElement.innerHTML = `
      <div class="task-header">
        <label class="task-checkbox">
          <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTaskCompletion(${index})">
          <span class="checkmark"></span>
        </label>
        <div class="task-title">${escapeHtml(task.title)}</div>
      </div>
      <div class="task-description">${escapeHtml(task.description)}</div>
      <div class="task-status">${task.completed ? '✅ Completada' : '⏳ Pendiente'}</div>
    `;
    
    taskElement.addEventListener('click', () => toggleTaskSelection(index));
    taskElement.addEventListener('dblclick', () => openTaskForm(task));
    container.appendChild(taskElement);
  });
}

// Función para alternar selección de tarea
function toggleTaskSelection(index) {
  const taskIndex = selectedTasks.indexOf(index);
  if (taskIndex > -1) {
    selectedTasks.splice(taskIndex, 1);
  } else {
    selectedTasks.push(index);
  }
  renderTasks();
}

// Función para cambiar el estado de completado de una tarea
function toggleTaskCompletion(taskIndex) {
  if (!currentNode.tasks || !currentNode.tasks[taskIndex]) {
    return;
  }
  
  // Cambiar el estado de completado
  currentNode.tasks[taskIndex].completed = !currentNode.tasks[taskIndex].completed;
  
  // Actualizar la visualización
  renderTasks();
  
  // Actualizar el indicador visual del nodo en el canvas
  draw();
}

// Función para escapar HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Función para abrir el formulario de tarea
function openTaskForm(task = null) {
  editingTask = task;
  const modal = document.getElementById('taskFormModal');
  const title = document.getElementById('taskFormTitle');
  const titleInput = document.getElementById('taskTitle');
  const descriptionInput = document.getElementById('taskDescription');
  const completedInput = document.getElementById('taskCompleted');
  
  if (task) {
    title.textContent = 'Editar Tarea';
    titleInput.value = task.title;
    descriptionInput.value = task.description;
    completedInput.checked = task.completed || false;
  } else {
    title.textContent = 'Agregar Nueva Tarea';
    titleInput.value = '';
    descriptionInput.value = '';
    completedInput.checked = false;
  }
  
  modal.style.display = 'block';
  titleInput.focus();
}

// Función para cerrar modales
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// Event listeners para los modales
document.getElementById('closeModal').addEventListener('click', () => {
  closeModal('taskModal');
});

document.getElementById('closeModalBtn').addEventListener('click', () => {
  closeModal('taskModal');
});

document.getElementById('closeTaskForm').addEventListener('click', () => {
  closeModal('taskFormModal');
});

document.getElementById('cancelTaskForm').addEventListener('click', () => {
  closeModal('taskFormModal');
});

// Cerrar modal al hacer clic fuera de él
window.addEventListener('click', (e) => {
  const taskModal = document.getElementById('taskModal');
  const formModal = document.getElementById('taskFormModal');
  
  if (e.target === taskModal) {
    closeModal('taskModal');
  }
  if (e.target === formModal) {
    closeModal('taskFormModal');
  }
});

// Event listener para agregar tarea
document.getElementById('addTask').addEventListener('click', () => {
  openTaskForm();
});

// Event listener para eliminar tareas seleccionadas
document.getElementById('deleteTask').addEventListener('click', () => {
  if (selectedTasks.length === 0) {
    alert('Selecciona al menos una tarea para eliminar.');
    return;
  }
  
  const confirmDelete = confirm(`¿Estás seguro de que quieres eliminar ${selectedTasks.length} tarea(s)?`);
  if (confirmDelete) {
    // Eliminar tareas en orden inverso para mantener índices válidos
    selectedTasks.sort((a, b) => b - a).forEach(index => {
      currentNode.tasks.splice(index, 1);
    });
    
    selectedTasks = [];
    renderTasks();
    startAnimationIfNeeded(); // Actualizar animación después de eliminar tareas
  }
});

// Event listener para el formulario de tarea
document.getElementById('taskForm').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDescription').value.trim();
  
  if (!title) {
    alert('El título es obligatorio.');
    return;
  }
  
  const taskData = {
    title: title,
    description: description,
    completed: document.getElementById('taskCompleted').checked,
    createdAt: new Date().toISOString()
  };
  
  if (editingTask) {
    // Editar tarea existente
    const taskIndex = currentNode.tasks.indexOf(editingTask);
    if (taskIndex > -1) {
      currentNode.tasks[taskIndex] = { ...editingTask, ...taskData };
    }
  } else {
    // Agregar nueva tarea
    if (!currentNode.tasks) {
      currentNode.tasks = [];
    }
    currentNode.tasks.push(taskData);
  }
  
  closeModal('taskFormModal');
  renderTasks();
  startAnimationIfNeeded(); // Iniciar animación para mostrar indicadores
  editingTask = null;
});

// Cerrar modales con la tecla Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal('taskModal');
    closeModal('taskFormModal');
  }
});