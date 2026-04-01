

# Sistema de Gestión de Nómina Administrativa Pro

## Visión General
Aplicación web de gestión de nómina quincenal con dashboard profesional en tonos azules/grises, persistencia local (localStorage), y cálculos en tiempo real.

## Arquitectura de Datos
- **Store global** con Zustand + persistencia en localStorage para empleados, configuración quincenal y historial
- **Modelo de Empleado**: ID, Nombre, Sueldo Base Mensual, Descuento por día faltado, KPI, Turno
- **Modelo de Nómina Quincenal**: período, empleadoId, días faltados, KPI aplicado, días extra, prima dominical, día festivo, bonos, total calculado

## Módulos

### 1. Layout con Sidebar
- Sidebar lateral con navegación: Dashboard, Empleados, Historial de Nómina
- Header con título del sistema
- Tema azul/gris profesional (personalización de CSS variables)

### 2. Dashboard
- Tarjetas resumen: Total nómina actual, número de empleados, promedio salarial
- Vista rápida de la nómina quincenal en curso

### 3. Gestión de Empleados
- Tabla interactiva con búsqueda por nombre/ID
- Carga masiva vía CSV (ID, Nombre, Sueldo, Descuento, KPI)
- Botón eliminar empleado con confirmación
- Columna con cálculo quincenal resumido
- Click en empleado abre perfil detallado

### 4. Perfil / Tarjeta de Configuración Salarial
- Campos editables: Sueldo Base, Descuento por día, KPI, Turno
- Sueldo diario calculado automáticamente (Base / 30)
- Controles de asistencia: días faltados (numérico), KPI (checkbox), días extra (selector), prima dominical (checkbox), día festivo (checkbox), bonos adicionales (input)
- **Cálculo en tiempo real**: Total = (Base/2) - (Faltados × Descuento) + KPI + (Extras × $1000) + Prima Dominical (25% diario) + Día Festivo (3× diario) + Bonos
- Desglose visual: Subtotal, Retenciones, Extras, Neto a Pagar
- Guardado inmediato con notificación toast

### 5. Historial y Reportes
- Lista de nóminas pasadas con filtro por período
- Botón "Cerrar Quincena" que guarda snapshot al historial
- Descarga PDF por empleado con desglose detallado (usando jsPDF)

## Diseño
- Shadcn/UI components con tema azul (#2563EB primary) y grises
- Notificaciones con Sonner para feedback de guardado
- Cálculos reactivos instantáneos al cambiar cualquier input

