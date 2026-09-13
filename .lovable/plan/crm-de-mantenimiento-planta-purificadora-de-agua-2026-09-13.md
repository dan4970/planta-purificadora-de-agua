# CRM de Mantenimiento — Planta Purificadora de Agua

Sistema de gestión de mantenimiento (correctivo, preventivo y predictivo) para toda la línea de proceso y embotellado, con acceso por usuario y roles.

## Qué vas a tener

**1. Inventario de equipos**
Los 22 equipos que indicaste, cargados desde el inicio y agrupados por área:
- Tratamiento: bomba de agua cruda, filtro multimedia, filtro de carbón, suavizador, dosificadora de químicos, filtro pulidor, bomba de alta presión, ósmosis inversa, UV, ozonizador, tanques, bombas hidroneumáticas.
- Embotellado: cintas de entrada, lavador de bidones, enjuague final, llenadora, tapadora/selladora, codificadora, lámpara de inspección, cintas de salida, enfardadora, paletizadora.

Cada equipo tiene ficha con código, ubicación, criticidad, estado actual, horas de servicio e historial completo.

**2. Órdenes de trabajo (correctivo y preventivo)**
Alta de órdenes con equipo, tipo, prioridad, síntoma/falla, técnico asignado, repuestos usados, horas de paro, fechas y estado (abierta, en proceso, en espera de repuesto, cerrada). Tablero tipo lista con filtros y vista de detalle.

**3. Plan preventivo**
Tareas programadas por equipo con frecuencia (días o horas de operación), checklist de pasos, y calendario que marca lo vencido, lo próximo y lo cumplido. Al ejecutar una tarea se genera automáticamente la próxima.

**4. Módulo predictivo — análisis de vibración**
- Puntos de medición por equipo crítico (lado motor / lado carga, radial y axial).
- Recepción automática de lecturas desde tu servidor de sensores mediante un punto de entrada seguro con clave; además carga de archivo CSV y carga manual como respaldo.
- Gráficos de tendencia por punto (velocidad mm/s RMS, aceleración, temperatura, RPM).
- Diagnóstico automático por semáforo según límites configurables tipo ISO 10816 (Bueno / Aceptable / Alerta / Peligro), con alarma que puede generar una orden correctiva.
- Registro de diagnóstico del analista (desbalanceo, desalineación, rodamiento, holgura, cavitación) e historial por equipo.

**5. Panel principal**
Indicadores: equipos en alarma, órdenes abiertas y atrasadas, preventivos vencidos, tiempo medio entre fallas (MTBF) y de reparación (MTTR), disponibilidad, y equipos críticos por estado de vibración.

**6. Usuarios y roles**
Ingreso con correo y contraseña. Administrador (todo, incluye gestión de usuarios y límites), Supervisor (planifica, aprueba y cierra órdenes, ve reportes) y Técnico (ve sus órdenes, registra ejecución y mediciones).

## Detalles técnicos

- Backend con Lovable Cloud: base de datos, autenticación y funciones de servidor.
- Tablas: `assets` (con `criticality`, `area`), `asset_types`, `work_orders`, `work_order_parts`, `pm_plans`, `pm_tasks`, `pm_executions`, `measurement_points`, `vibration_readings`, `alarm_thresholds`, `diagnoses`, `profiles`, `user_roles` (+ enum `app_role`), `ingest_tokens`.
- Roles en tabla separada `user_roles` con función `has_role()` SECURITY DEFINER; RLS en todas las tablas con GRANT explícitos.
- Ingesta de sensores: server route pública en `src/routes/api/public/vibration-ingest.ts` que valida una clave (header) antes de escribir; acepta lote JSON de lecturas. La evaluación de umbrales y la creación de alarma se hacen en el servidor al insertar.
- Lecturas/escrituras de la app vía `createServerFn` con `requireSupabaseAuth`; rutas protegidas bajo `_authenticated/`.
- Gráficos de tendencia con Recharts. Datos iniciales (equipos, puntos de medición de los críticos y umbrales por defecto) incluidos como INSERT en la migración.

## Alcance de esta etapa

Se construye todo lo anterior con datos de ejemplo de vibración para que los gráficos y el semáforo se vean funcionando. La conexión real al servidor de sensores requiere que después me pases la dirección/formato de tu servidor o que configures el envío hacia el punto de entrada que se crea aquí.
