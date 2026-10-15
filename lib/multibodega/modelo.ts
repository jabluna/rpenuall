/**
 * Modelo base de inventario multibodega.
 * Fase 1: funciones puras. No altera PROVEEDORES/STOCK ni escribe en Firebase.
 *
 * Identidad del insumo: proveedorId + productoId (no solo nombre/código).
 * Una orden puede reservar insumos de diferentes bodegas.
 */
export const BODEGA_PRINCIPAL_ID = "BOD-001" as const;

export type Bodega = {
  id: string;
  codigo: string;
  nombre: string;
  ubicacion?: string;
  responsableUid?: string;
  activa: boolean;
  principal: boolean;
  creadaEn: number;
};

export type InsumoRef = {
  proveedorId: string;
  productoId: string;
};

export type ExistenciaBodega = {
  stockFisico: number;
  reservado: number;
  actualizadoEn?: number;
};

export type AsignacionInsumoPedido = InsumoRef & {
  bodegaId: string;
  cantidadRequerida: number;
  cantidadReservada: number;
  cantidadConsumida: number;
};

export type TipoMovimientoInventario =
  | "recepcion_compra"
  | "reserva"
  | "liberacion_reserva"
  | "consumo"
  | "ajuste_entrada"
  | "ajuste_salida";

export type MovimientoInventario = {
  id: string;
  bodegaId: string;
  insumo: InsumoRef;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  documentoTipo: "compra" | "pedido" | "ajuste" | "migracion";
  documentoId: string;
  operacionId: string; // Clave de idempotencia: evita aplicar dos veces la misma recepción.
  usuarioUid: string;
  fecha: number;
};

export type UmbralBodega = {
  minimo: number;
  objetivo?: number;
};

export type EstadoAlerta = "sin_existencias" | "critico" | "normal";

export function validarCantidad(cantidad: number): number {
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    throw new Error("La cantidad debe ser un número finito no negativo.");
  }
  return cantidad;
}

export function disponible(existencia: ExistenciaBodega): number {
  const fisico = validarCantidad(existencia.stockFisico);
  const reservado = validarCantidad(existencia.reservado);
  if (reservado > fisico) {
    throw new Error("Inventario inconsistente: reservado supera stock físico.");
  }
  return fisico - reservado;
}

export function puedeReservar(
  existencia: ExistenciaBodega,
  cantidad: number,
): boolean {
  return validarCantidad(cantidad) <= disponible(existencia);
}

export function estadoAlerta(
  existencia: ExistenciaBodega,
  umbral: UmbralBodega,
): EstadoAlerta {
  const actual = disponible(existencia);
  const minimo = validarCantidad(umbral.minimo);
  if (actual === 0) return "sin_existencias";
  return actual < minimo ? "critico" : "normal";
}

export function consolidarExistencias(
  existencias: readonly ExistenciaBodega[],
): ExistenciaBodega & { disponible: number } {
  const total = existencias.reduce(
    (acumulado, item) => ({
      stockFisico: acumulado.stockFisico + validarCantidad(item.stockFisico),
      reservado: acumulado.reservado + validarCantidad(item.reservado),
    }),
    { stockFisico: 0, reservado: 0 },
  );
  return { ...total, disponible: disponible(total) };
}

/**
 * Clave estable sin separadores ambiguos, apta como clave RTDB.
 * No se debe usar un nombre editable para identificar un producto.
 */
export function claveInsumo({ proveedorId, productoId }: InsumoRef): string {
  if (!proveedorId.trim() || !productoId.trim()) {
    throw new Error("Proveedor y producto son obligatorios.");
  }
  // Hex UTF-8: reversible y sin caracteres prohibidos en claves RTDB.
  const bytes = new TextEncoder().encode(JSON.stringify([proveedorId, productoId]));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validarAsignaciones(
  asignaciones: readonly AsignacionInsumoPedido[],
): void {
  const ids = new Set<string>();
  for (const item of asignaciones) {
    if (!item.bodegaId.trim()) throw new Error("Cada insumo requiere bodega.");
    validarCantidad(item.cantidadRequerida);
    validarCantidad(item.cantidadReservada);
    validarCantidad(item.cantidadConsumida);
    if (item.cantidadReservada + item.cantidadConsumida > item.cantidadRequerida) {
      throw new Error("Reservas y consumos exceden lo requerido.");
    }
    const id = JSON.stringify([item.bodegaId, item.proveedorId, item.productoId]);
    if (ids.has(id)) throw new Error("Asignación de insumo duplicada en la misma bodega.");
    ids.add(id);
  }
}
