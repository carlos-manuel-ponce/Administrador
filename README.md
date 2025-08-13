# 📋 Administrador de Tareas - Mapa Conceptual

Una aplicación web interactiva para gestionar tareas mediante un mapa conceptual visual con nodos conectados.

## ✨ Características

- **🎯 Nodo Central**: "Administrador de Tareas" como punto central del mapa
- **🏢 Salas**: Crea salas principales conectadas al nodo central
- **🏠 Subsalas**: Añade subsalas a las salas principales
- **📝 Gestión de Tareas**: Cada nodo puede contener múltiples tareas
- **🔗 Conexiones Visuales**: Líneas punteadas que conectan los nodos
- **🎨 Interfaz Moderna**: Diseño oscuro con alta calidad visual
- **💾 Base de Datos**: Integración con Supabase para persistencia
- **🔍 Navegación**: Zoom, paneo y controles intuitivos

## 🚀 Tecnologías

- **Frontend**: HTML5 Canvas, CSS3, JavaScript ES6+
- **Base de Datos**: Supabase
- **Estilos**: Fuentes Inter, gradientes CSS
- **Renderizado**: Alta resolución (HiDPI/Retina ready)

## 🎮 Controles

- **Click**: Seleccionar nodos y abrir tareas
- **Arrastrar**: Mover nodos (excepto el central)
- **Rueda del ratón**: Hacer zoom
- **Click medio/Ctrl+Click**: Paneo de la vista
- **R**: Resetear vista
- **0**: Ajustar vista a todos los nodos
- **+/-**: Zoom in/out

## 📱 Funcionalidades

### Gestión de Nodos
- Crear salas automáticamente posicionadas
- Añadir subsalas a salas existentes
- Conexiones automáticas entre nodos

### Sistema de Tareas
- Crear, editar y eliminar tareas
- Marcar tareas como completadas
- Indicadores visuales de estado
- Gestión por nodo individual

### Interfaz Visual
- Fondo negro con patrón de puntos
- Nodos con gradientes y sombras
- Líneas de conexión punteadas
- Puntos de conexión visibles
- Animaciones suaves

## 🔧 Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/carlos-manuel-ponce/Notas.git
cd Notas
```

2. Configura Supabase (opcional):
   - Crea una cuenta en [Supabase](https://supabase.com)
   - Obtén tu URL y clave pública
   - Actualiza las credenciales en `supabase.js`

3. Ejecuta un servidor local:
```bash
python3 -m http.server 8000
# o
npx http-server
```

4. Abre `http://localhost:8000` en tu navegador

## 🗃️ Estructura del Proyecto

```
├── index.html          # Estructura principal
├── styles.css          # Estilos y diseño
├── script.js           # Lógica principal de la aplicación
├── supabase.js         # Integración con base de datos
└── README.md           # Documentación
```

## 🎨 Diseño

- **Tema**: Oscuro con acentos coloridos
- **Tipografía**: Inter (Google Fonts)
- **Colores**:
  - Fondo: Negro (#000000)
  - Nodo Central: Rojo gradiente
  - Salas: Azul gradiente
  - Subsalas: Gris gradiente
  - Texto: Blanco con sombras

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Añade nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.

## 🔗 Demo

[Ver Demo en Vivo](https://carlos-manuel-ponce.github.io/Notas/)

---

Desarrollado con ❤️ para una gestión visual de tareas
