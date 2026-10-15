# Multibodega — fase 1 (preparación segura)

## Decisiones aprobadas
- Abastecimiento por compra directa a la bodega destino; no traslados en esta fase.
- Cada insumo de un pedido puede asignarse a una bodega diferente.
- Alertas por bodega y consolidado global.
- La bodega principal conservará las existencias actuales.

## Estado de implementación
- `lib/multibodega/modelo.ts` define tipos, identidad estable de insumos, disponibilidad, consolidado y validaciones.
- **Sin conexión a producción**: no se modifican pantallas, escrituras, rutas existentes ni datos de Firebase.
- Los nombres de nodos siguientes son una propuesta pendiente de migración, no datos existentes.

## Esquema RTDB previsto
```text
BODEGAS/{bodegaId}
INVENTARIO_BODEGAS/{bodegaId}/{claveInsumo}
MOVIMIENTOS_INVENTARIO/{movimientoId}
SEMAFORIZACIÓN/CONFIG_BODEGAS/{bodegaId}/{claveInsumo}
SEMAFORIZACIÓN/ALERTAS_BODEGAS/{bodegaId}/{claveInsumo}
ORDENES_PEDIDO/{pedidoId}/asignacionesInsumos/{asignacionId}
```

## Invariantes antes de habilitar escrituras
1. Cada producto se identifica por proveedor y producto, nunca solo por nombre.
2. Disponible = físico - reservado; no guardar un tercer saldo independiente.
3. Recepciones de compra incrementan stock **solo al confirmar recepción** y se protegen con idempotencia por operación.
4. Reservas, consumo y liberación se ejecutan en operaciones transaccionales autorizadas desde servidor. No permitir escrituras directas arbitrarias de clientes a los saldos.
5. Los consumos descuentan stock físico y liberan su reserva, sin doble descuento.
6. Una orden puede asignar insumos a múltiples bodegas; el desglose debe persistir en la orden.
7. Alertas locales no se ocultan aunque el consolidado global sea suficiente.
8. El stock existente en `PROVEEDORES` continúa siendo el oficial hasta que la migración y adaptación de **todos** los lectores/escritores esté verificada.
9. Crear respaldo separado de Realtime Database, conciliar stock/reservas y usar migración idempotente con ventana controlada; el respaldo Git solo protege código.
10. Mantener las rutas de etiquetas separadas hasta confirmar si deben participar del inventario multibodega.

## Siguientes entregables
1. Administración de bodegas y permisos (sin modificar stock heredado).
2. Adaptador de lectura de inventario y script de conciliación/migración con modo simulación.
3. Compras: destino obligatorio y recepción parcial/idempotente.
4. Pedidos: asignación por insumo, reserva/consumo/cancelación transaccional.
5. Semaforización por bodega y consolidado; pruebas de concurrencia.
