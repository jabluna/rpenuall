"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  ChevronRight,
  Building2,
  Home,
  ImageIcon,
  Loader2,
  LogOut,
  PackageSearch,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  Truck,
  UploadCloud,
  X,
  ChevronDown,
  ClipboardList,
  Eye,
  FileText,
  LayoutDashboard,
  Menu,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Tags,
  UserCog,
  Users,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { get, getDatabase, onValue, ref, set, update } from "firebase/database";
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth } from "@/lib/firebase";
import { useUserPermissions } from "@/lib/useUserPermissions";
import NoPermission from "@/components/NoPermission";

type ProviderData = {
  CODIGO: string;
  DIRECCION: string;
  HOJA: string;
  NIT: string | number;
  PROVEEDOR: string;
  TELEFONO: string | number;
};

type ProductData = {
  CODIGO: string;
  COSTO: string | number;
  HOJA_DETALLE: string;
  PRODUCTO: string;
  STOCK: string | number;
  UNIDAD_DE_EMPAQUE: string | number;
  MOCKUP_URL?: string;
  MOCKUP_PATH?: string;
};

type MovementData = {
  FECHA?: string;
  DESCRIPCION?: string;
  OBSERVACIONES?: string;
  INGRESO?: string | number;
  SALIDA?: string | number;
  SALDO?: string | number;
  STOCK_RESERVADO?: string | number;
  STOCK_DISPONIBLE?: string | number;
  STOCK_TEORICO?: string | number;
  ORDEN_FECHA?: number;
  CREATED_AT?: number;
  UPDATED_AT?: number;
};

type ProviderRow = {
  id: string;
  codigoNodo: string;
  nombreNodo: string;
  codigo: string;
  nombre: string;
  datos: ProviderData;
  productosRaw?: Record<string, any>;
};

type ProductRow = {
  id: string;
  codigo: string;
  producto: string;
  unidadEmpaque: string | number;
  costo: string | number;
  stock: string | number;
  hojaDetalle: string;
  mockupUrl: string;
  mockupPath: string;
  datos: ProductData;
  movimientosRaw?: Record<string, MovementData>;
};

type MovementRow = {
  id: string;
  fecha: string;
  descripcion: string;
  observaciones: string;
  ingreso: string | number;
  salida: string | number;
  saldo: string | number;
  stockReservado: string | number;
  stockDisponible: string | number;
  stockTeorico: string | number;
};

type SemaforizacionConfig = {
  stockDisponibleMinimo: number;
  stockTeoricoMinimo: number;
};

type SemaforizacionConfigMap = Record<string, SemaforizacionConfig>;

type SemaphoreStatus = "ok" | "warning" | "zero" | "negative";

type ProductSemaphoreRow = {
  codigoProveedor: string;
  nombreProveedor: string;
  codigoProducto: string;
  producto: string;
  stockReal: number;
  stockReservado: number;
  stockDisponible: number;
  stockTeorico: number;
  disponibleStatus: SemaphoreStatus;
  teoricoStatus: SemaphoreStatus;
};


type OrdenProduccionOption = {
  id: string;
  numero: string;
  cliente: string;
  fecha: string;
};

type ProviderSemaphoreSummary = {
  totalProductos: number;
  disponibleAlertas: number;
  teoricoAlertas: number;
  disponibleStatus: SemaphoreStatus;
  teoricoStatus: SemaphoreStatus;
};

const emptyProvider: ProviderData = {
  CODIGO: "",
  DIRECCION: "",
  HOJA: "",
  NIT: "",
  PROVEEDOR: "",
  TELEFONO: "",
};

const emptyMovement: MovementData = {
  FECHA: "",
  DESCRIPCION: "",
  OBSERVACIONES: "",
  INGRESO: "",
  SALIDA: "",
  SALDO: "",
  STOCK_RESERVADO: "",
  STOCK_DISPONIBLE: "",
  STOCK_TEORICO: "",
};

const emptyProduct: ProductData = {
  CODIGO: "",
  COSTO: "",
  HOJA_DETALLE: "",
  PRODUCTO: "",
  STOCK: "",
  UNIDAD_DE_EMPAQUE: "",
  MOCKUP_URL: "",
  MOCKUP_PATH: "",
};

const defaultSemaforizacionConfig: SemaforizacionConfig = {
  stockDisponibleMinimo: 10,
  stockTeoricoMinimo: 10,
};

function cleanKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[.#$/[\]]/g, "-");
}

function normalizeText(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function normalizeDateInput(value: unknown) {
  const clean = normalizeText(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return todayISO();

  const year = Number(clean.slice(0, 4));
  const currentYear = new Date().getFullYear();

  // Evita fechas accidentales muy futuras/pasadas por estados viejos del formulario.
  if (!Number.isFinite(year) || year < 2000 || year > currentYear + 1) {
    return todayISO();
  }

  return clean;
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;

  const clean = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, ".");

  const numberValue = Number(clean);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeMoney(value: unknown) {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return normalizeText(value) || "—";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function normalizeNumber(value: unknown) {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return normalizeText(value) || "—";

  return new Intl.NumberFormat("es-CO").format(numberValue);
}

function nextMovementKey(movementsRaw?: Record<string, MovementData>) {
  const usedNumbers = Object.keys(movementsRaw || {})
    .map((key) => Number(key.replace(/\D/g, "")))
    .filter((value) => !Number.isNaN(value));

  const nextNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
  return `MOV-${String(nextNumber).padStart(3, "0")}`;
}

function parseDateValue(value: string) {
  if (!value) return 0;

  const clean = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const safeDate = normalizeDateInput(clean);
    return new Date(`${safeDate}T00:00:00`).getTime();
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const [day, month, year] = clean.split("/").map(Number);
    const asIso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const safeDate = normalizeDateInput(asIso);
    return new Date(`${safeDate}T00:00:00`).getTime();
  }

  const parsed = Date.parse(clean);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getMovementNumericId(id: string) {
  const value = Number(id.replace(/\D/g, ""));
  return Number.isNaN(value) ? 0 : value;
}

function movementToRow(key: string, value: MovementData): MovementRow {
  const saldo = normalizeText(value.SALDO);
  const stockReservado = normalizeText(value.STOCK_RESERVADO);
  const stockDisponible = normalizeText(toNumber(saldo) - toNumber(stockReservado));
  // En la nueva lógica, el stock esperado es igual al stock disponible.
  const stockTeorico = stockDisponible;

  return {
    id: key,
    fecha: normalizeText(value.FECHA),
    descripcion: normalizeText(value.DESCRIPCION),
    observaciones: normalizeText(value.OBSERVACIONES),
    ingreso: normalizeText(value.INGRESO),
    salida: normalizeText(value.SALIDA),
    saldo,
    stockReservado,
    stockDisponible,
    stockTeorico,
  };
}

/*
  IMPORTANTE:
  El JSON histórico puede tener MOV-001 como movimiento reciente
  y MOV-060 como movimiento antiguo. Por eso NO calculamos por número MOV.
  La fuente de orden para saldo es:
  1. FECHA / ORDEN_FECHA
  2. CREATED_AT si existe
  3. número MOV solo como desempate visual
*/
function getMovementOrderValue(id: string, value: MovementData) {
  const fechaOrder =
    typeof value.ORDEN_FECHA === "number" && value.ORDEN_FECHA > 0
      ? value.ORDEN_FECHA
      : parseDateValue(normalizeText(value.FECHA));

  return {
    fechaOrder,
    createdAt:
      typeof value.CREATED_AT === "number" && value.CREATED_AT > 0
        ? value.CREATED_AT
        : getMovementNumericId(id),
    movNumber: getMovementNumericId(id),
  };
}

function sortMovementEntriesAsc(movementsRaw?: Record<string, MovementData>) {
  return Object.entries(movementsRaw || {}).sort(([idA, valueA], [idB, valueB]) => {
    const orderA = getMovementOrderValue(idA, valueA || {});
    const orderB = getMovementOrderValue(idB, valueB || {});

    if (orderA.fechaOrder !== orderB.fechaOrder) {
      return orderA.fechaOrder - orderB.fechaOrder;
    }

    if (orderA.createdAt !== orderB.createdAt) {
      return orderA.createdAt - orderB.createdAt;
    }

    return orderA.movNumber - orderB.movNumber;
  });
}

function sortMovementEntriesDesc(movementsRaw?: Record<string, MovementData>) {
  return [...sortMovementEntriesAsc(movementsRaw)].reverse();
}

function sortMovementRows(movementsRaw?: Record<string, MovementData>) {
  return sortMovementEntriesDesc(movementsRaw).map(([key, value]) =>
    movementToRow(key, value || {})
  );
}

function sortMovementRowsAsc(movementsRaw?: Record<string, MovementData>) {
  return sortMovementEntriesAsc(movementsRaw).map(([key, value]) =>
    movementToRow(key, value || {})
  );
}

function getBaseBalanceFromMovements(movementsRaw?: Record<string, MovementData>) {
  const ascRows = sortMovementRowsAsc(movementsRaw);

  if (ascRows.length === 0) return 0;

  const first = ascRows[0];

  return toNumber(first.saldo) - toNumber(first.ingreso) + toNumber(first.salida);
}

function getPreviousBalanceForMovement(
  movementsRaw: Record<string, MovementData> | undefined,
  movementId: string | null
) {
  if (!movementId) return null;

  /*
    La vista está ordenada de más reciente a más antiguo.
    La fórmula real es:
    saldo fila actual = saldo fila inferior + ingreso actual - salida actual.
    Por eso, al editar una fila, la base es el saldo de la fila de abajo.
  */
  const descRows = sortMovementRows(movementsRaw);
  const index = descRows.findIndex((item) => item.id === movementId);

  if (index < 0) return null;

  const rowBelow = descRows[index + 1];

  if (rowBelow) {
    return toNumber(rowBelow.saldo);
  }

  const current = descRows[index];
  return toNumber(current.saldo) - toNumber(current.ingreso) + toNumber(current.salida);
}

function extractProducts(provider: ProviderRow | null): ProductRow[] {
  if (!provider?.productosRaw) return [];

  return Object.entries(provider.productosRaw)
    .map(([productCode, productNode]) => {
      const datos = productNode?.DATOS_PRODUCTO || {};

      return {
        id: productCode,
        codigo: normalizeText(datos.CODIGO || productCode),
        producto: normalizeText(datos.PRODUCTO),
        unidadEmpaque: normalizeText(datos.UNIDAD_DE_EMPAQUE),
        costo: normalizeText(datos.COSTO),
        stock: normalizeText(datos.STOCK),
        hojaDetalle: normalizeText(datos.HOJA_DETALLE),
        mockupUrl: normalizeText(datos.MOCKUP_URL),
        mockupPath: normalizeText(datos.MOCKUP_PATH),
        datos: {
          CODIGO: normalizeText(datos.CODIGO || productCode),
          COSTO: normalizeText(datos.COSTO),
          HOJA_DETALLE: normalizeText(datos.HOJA_DETALLE),
          PRODUCTO: normalizeText(datos.PRODUCTO),
          STOCK: normalizeText(datos.STOCK),
          UNIDAD_DE_EMPAQUE: normalizeText(datos.UNIDAD_DE_EMPAQUE),
          MOCKUP_URL: normalizeText(datos.MOCKUP_URL),
          MOCKUP_PATH: normalizeText(datos.MOCKUP_PATH),
        },
        movimientosRaw: productNode?.MOVIMIENTOS || {},
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function getMovementOperation(value: string) {
  const clean = value.trim().toUpperCase();
  if (clean.startsWith("COMPRA-")) return "COMPRA";
  if (clean.startsWith("OP-")) return "OP";
  if (clean.startsWith("REINTEGRO-")) return "REINTEGRO";
  if (clean.startsWith("AJUSTE-")) return "AJUSTE";
  return "";
}

function getMovementConsecutive(value: string) {
  const clean = value.trim().toUpperCase();
  return clean.replace(/^(COMPRA|OP|REINTEGRO|AJUSTE)-?/, "");
}

function getLotBalances(movementsRaw?: Record<string, MovementData>) {
  const lots: Record<
    string,
    { lote: string; balance: number; firstOrder: number; lastOrder: number }
  > = {};

  /*
    El selector de lote debe mostrar el saldo real que ve el usuario en el
    historial, no una suma reconstruida desde cero. En este módulo el campo
    SALDO de cada movimiento ya viene recalculado y representa el saldo real
    del producto después de ese movimiento. Por eso, para cada lote tomamos el
    SALDO del movimiento más reciente de ese lote.
  */
  sortMovementEntriesAsc(movementsRaw).forEach(([key, movement], index) => {
    const lote = normalizeText(movement.OBSERVACIONES).trim().toUpperCase();
    if (!lote) return;

    const order = getMovementOrderValue(key, movement || {});
    const orderValue = order.fechaOrder || order.createdAt || index + 1;
    const saldoReal = toNumber(movement.SALDO);

    if (!lots[lote]) {
      lots[lote] = {
        lote,
        balance: saldoReal,
        firstOrder: orderValue,
        lastOrder: orderValue,
      };
      return;
    }

    lots[lote].firstOrder = Math.min(lots[lote].firstOrder, orderValue);

    if (orderValue >= lots[lote].lastOrder) {
      lots[lote].balance = saldoReal;
      lots[lote].lastOrder = orderValue;
    }
  });

  return Object.values(lots).sort((a, b) => a.firstOrder - b.firstOrder);
}

function getOldestLotWithBalance(movementsRaw?: Record<string, MovementData>) {
  return getLotBalances(movementsRaw).find((lot) => lot.balance > 0) || null;
}

function getLotsNewestFirst(movementsRaw?: Record<string, MovementData>) {
  return getLotBalances(movementsRaw)
    .filter((lot) => lot.lote)
    .sort((a, b) => b.lastOrder - a.lastOrder);
}

function discountReservedStockFromMovements(
  movementsRaw: Record<string, MovementData> | undefined,
  lote: string,
  quantityToDiscount: number,
  movementKeyToIgnore?: string | null
) {
  const adjustedMovements: Record<string, MovementData> = { ...(movementsRaw || {}) };
  let pending = Math.max(0, quantityToDiscount);
  const cleanLot = normalizeText(lote).trim().toUpperCase();

  if (!cleanLot || pending <= 0) {
    return { adjustedMovements, discounted: 0, pending };
  }

  const reservedEntries = sortMovementEntriesAsc(adjustedMovements).filter(
    ([movementId, movement]) =>
      movementId !== movementKeyToIgnore &&
      normalizeText(movement?.OBSERVACIONES).trim().toUpperCase() === cleanLot &&
      toNumber(movement?.STOCK_RESERVADO) > 0
  );

  let discounted = 0;

  for (const [movementId, movement] of reservedEntries) {
    if (pending <= 0) break;

    const currentReserved = toNumber(movement.STOCK_RESERVADO);
    const amount = Math.min(currentReserved, pending);
    const newReserved = currentReserved - amount;

    adjustedMovements[movementId] = {
      ...movement,
      STOCK_RESERVADO: newReserved > 0 ? newReserved : "",
    };

    pending -= amount;
    discounted += amount;
  }

  return { adjustedMovements, discounted, pending };
}

function getCurrentReservedForLot(
  movementsRaw: Record<string, MovementData> | undefined,
  lote: string,
  movementKeyToIgnore?: string | null
) {
  const cleanLot = normalizeText(lote).trim().toUpperCase();
  if (!cleanLot) return 0;

  const latestReservedMovement = sortMovementEntriesDesc(movementsRaw).find(
    ([movementId, movement]) =>
      movementId !== movementKeyToIgnore &&
      normalizeText(movement?.OBSERVACIONES).trim().toUpperCase() === cleanLot &&
      normalizeText(movement?.STOCK_RESERVADO) !== ""
  );

  return latestReservedMovement ? toNumber(latestReservedMovement[1]?.STOCK_RESERVADO) : 0;
}

function getNextReservedForLot(
  movementsRaw: Record<string, MovementData> | undefined,
  lote: string,
  selectedOperation: string,
  ingreso: number,
  salida: number,
  manualReserved: number,
  movementKeyToIgnore?: string | null
) {
  const currentReserved = getCurrentReservedForLot(movementsRaw, lote, movementKeyToIgnore);

  if (selectedOperation === "OP" && salida > 0) {
    return Math.max(0, currentReserved - salida);
  }

  if (manualReserved > 0) {
    return currentReserved + manualReserved;
  }

  return currentReserved;
}


function getSemaphoreStatus(value: number, minimum: number): SemaphoreStatus {
  if (value < 0) return "negative";
  if (value === 0) return "zero";
  if (value <= minimum) return "warning";
  return "ok";
}

function getStatusLabel(status: SemaphoreStatus) {
  if (status === "negative") return "Negativo";
  if (status === "zero") return "En cero";
  if (status === "warning") return "Bajo";
  return "OK";
}

function getStatusClasses(status: SemaphoreStatus) {
  if (status === "negative") return "bg-red-100 text-red-700 border-red-200";
  if (status === "zero") return "bg-orange-100 text-orange-700 border-orange-200";
  if (status === "warning") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function getWorstStatus(statuses: SemaphoreStatus[]): SemaphoreStatus {
  if (statuses.includes("negative")) return "negative";
  if (statuses.includes("zero")) return "zero";
  if (statuses.includes("warning")) return "warning";
  return "ok";
}

function getLatestProductStock(productNode: any) {
  const datos = productNode?.DATOS_PRODUCTO || {};
  // Se calcula únicamente con el último movimiento vigente.
  const latest = sortMovementRows(productNode?.MOVIMIENTOS || {})[0];
  const stockReal = latest ? toNumber(latest.saldo) : toNumber(datos.STOCK);
  const stockReservado = latest ? toNumber(latest.stockReservado) : toNumber(datos.STOCK_RESERVADO);
  const stockDisponible = stockReal - stockReservado;
  const stockTeorico = stockDisponible;

  return {
    producto: normalizeText(datos.PRODUCTO),
    stockReal,
    stockReservado,
    stockDisponible,
    stockTeorico,
  };
}

function getSemaforoKey(codigoProveedor: string, codigoProducto: string) {
  return cleanKey(`${codigoProveedor}_${codigoProducto}`);
}

function getProductSemaforoConfig(
  configMap: SemaforizacionConfigMap,
  codigoProveedor: string,
  codigoProducto: string
): SemaforizacionConfig {
  return configMap[getSemaforoKey(codigoProveedor, codigoProducto)] || defaultSemaforizacionConfig;
}


function getOrdenProduccionNumero(raw: any, id: string) {
  return (
    normalizeText(raw?.ordenPedido) ||
    normalizeText(raw?.ordenProduccion) ||
    normalizeText(raw?.numeroOrden) ||
    normalizeText(raw?.orden) ||
    normalizeText(raw?.consecutivo) ||
    id
  );
}

function getOrdenProduccionCliente(raw: any) {
  const cliente = raw?.cliente || raw?.datosCliente || raw?.clienteNombre;

  if (typeof cliente === "string" || typeof cliente === "number") {
    return normalizeText(cliente);
  }

  if (cliente && typeof cliente === "object") {
    return (
      normalizeText(cliente.nombre) ||
      normalizeText(cliente.cliente) ||
      normalizeText(cliente.clienteNombre) ||
      normalizeText(cliente.codigo_cliente) ||
      normalizeText(cliente.codigoCliente)
    );
  }

  return normalizeText(raw?.clienteNombre || raw?.nombreCliente);
}

function getProviderSemaphoreProducts(provider: ProviderRow, configMap: SemaforizacionConfigMap = {}): ProductSemaphoreRow[] {
  return Object.entries(provider.productosRaw || {}).map(([productCode, productNode]) => {
    const stock = getLatestProductStock(productNode);
    const codigoProducto = normalizeText((productNode as any)?.DATOS_PRODUCTO?.CODIGO || productCode);
    const productConfig = getProductSemaforoConfig(configMap, provider.codigoNodo, codigoProducto);

    return {
      codigoProveedor: provider.codigoNodo,
      nombreProveedor: provider.nombreNodo,
      codigoProducto,
      producto: stock.producto || normalizeText((productNode as any)?.DATOS_PRODUCTO?.PRODUCTO),
      stockReal: stock.stockReal,
      stockReservado: stock.stockReservado,
      stockDisponible: stock.stockDisponible,
      stockTeorico: stock.stockTeorico,
      disponibleStatus: getSemaphoreStatus(stock.stockDisponible, productConfig.stockDisponibleMinimo),
      teoricoStatus: getSemaphoreStatus(stock.stockTeorico, productConfig.stockTeoricoMinimo),
    };
  });
}

function getProviderSemaphoreSummary(provider: ProviderRow, configMap: SemaforizacionConfigMap = {}): ProviderSemaphoreSummary {
  const products = getProviderSemaphoreProducts(provider, configMap);
  const disponibleStatuses = products.map((item) => item.disponibleStatus);
  const teoricoStatuses = products.map((item) => item.teoricoStatus);

  return {
    totalProductos: products.length,
    disponibleAlertas: disponibleStatuses.filter((status) => status !== "ok").length,
    teoricoAlertas: teoricoStatuses.filter((status) => status !== "ok").length,
    disponibleStatus: getWorstStatus(disponibleStatuses),
    teoricoStatus: getWorstStatus(teoricoStatuses),
  };
}


type SidebarMenuItem = {
  title: string;
  icon: any;
  href: string;
};

type SidebarMenuSection = {
  title: string;
  icon: any;
  items: SidebarMenuItem[];
};

const sidebarMenuSections: SidebarMenuSection[] = [
  {
    title: "Usuarios",
    icon: Users,
    items: [
      { title: "Crear / ver roles", icon: ShieldCheck, href: "/panel/roles" },
      { title: "Crear / ver usuarios", icon: UserCog, href: "/panel/usuarios" },
    ],
  },
  {
    title: "Bodega",
    icon: Boxes,
    items: [
      {
        title: "Listado / movimiento de proveedores",
        icon: Truck,
        href: "/panel/proveedores-bodega",
      },
    ],
  },
  {
    title: "Comercial",
    icon: Users,
    items: [
      { title: "Crear / ver clientes", icon: Users, href: "/panel/clientes" },
      {
        title: "Crear orden de pedido",
        icon: ClipboardList,
        href: "/panel/pedidos",
      },
      {
        title: "Ver órdenes de pedido",
        icon: Eye,
        href: "/panel/ordenes_creadas",
      },
      {
        title: "Generar orden de muestra",
        icon: FileText,
        href: "/panel/muestra",
      },
    ],
  },
  {
    title: "Producción",
    icon: Building2,
    items: [
      {
        title: "Ver órdenes de pedido",
        icon: Eye,
        href: "/panel/ordenes_creadas",
      },
      {
        title: "Producción x Planta",
        icon: Building2,
        href: "/panel/produccionxplanta",
      },
    ],
  },
  {
    title: "Compras",
    icon: ShoppingCart,
    items: [
      {
        title: "Crear órdenes de compra",
        icon: PlusCircle,
        href: "/panel/compras2",
      },
      {
        title: "Ver órdenes de compra",
        icon: Eye,
        href: "/panel/gestion-compras2",
      },
      {
        title: "Crear proveedor",
        icon: PackagePlus,
        href: "/panel/crear-proveedor",
      },
    ],
  },
  {
    title: "Etiquetas",
    icon: Tag,
    items: [
      {
        title: "Lista etiquetas",
        icon: Tags,
        href: "/panel/inventario-etiquetas",
      },
      {
        title: "Crear orden de compra etiquetas",
        icon: FileText,
        href: "/panel/compra-etiqueta",
      },
      {
        title: "Ver órdenes de compra etiquetas",
        icon: Eye,
        href: "/panel/gestion-etiquetas",
      },
    ],
  },
];


export default function ProveedoresBodegaPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ Bodega: true });
  const realtimeDb = getDatabase(auth.app);
  const storage = getStorage(auth.app);

  const {
    authUser,
    profile,
    loading: loadingPermissions,
    isActive,
    can,
  } = useUserPermissions();

  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);

  const [form, setForm] = useState<ProviderData>(emptyProvider);
  const [productForm, setProductForm] = useState<ProductData>(emptyProduct);
  const [movementForm, setMovementForm] = useState<MovementData>(emptyMovement);
  const [mockupFile, setMockupFile] = useState<File | null>(null);
  const [mockupPreview, setMockupPreview] = useState("");
  const [selectedMockup, setSelectedMockup] = useState("");
  const [operationType, setOperationType] = useState("");
  const [operationConsecutive, setOperationConsecutive] = useState("");
  const [ordenesProduccionOptions, setOrdenesProduccionOptions] = useState<OrdenProduccionOption[]>([]);
  const [loadingOrdenesProduccion, setLoadingOrdenesProduccion] = useState(false);
  const [adjustmentApproved] = useState(false);

  const [editingProvider, setEditingProvider] = useState<ProviderRow | null>(
    null
  );
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [movementPage, setMovementPage] = useState(1);

  const [selectedProvider, setSelectedProvider] = useState<ProviderRow | null>(
    null
  );
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(
    null
  );

  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [movementSearch, setMovementSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [semaforoConfigs, setSemaforoConfigs] = useState<SemaforizacionConfigMap>({});
  const [semaforoForm, setSemaforoForm] = useState<SemaforizacionConfig>(defaultSemaforizacionConfig);
  const [savingSemaforo, setSavingSemaforo] = useState(false);
  const [semaforoModalOpen, setSemaforoModalOpen] = useState(false);
  const [selectedSemaforoProduct, setSelectedSemaforoProduct] = useState<ProductRow | null>(null);

  const userName = useMemo(() => {
    return (
      profile?.nombre ||
      authUser?.displayName ||
      authUser?.email?.split("@")[0] ||
      "Administrador"
    );
  }, [profile, authUser]);

  const isMaster = useMemo(() => {
    const roleText = `${(profile as any)?.rolNombre || ""} ${(profile as any)?.role || ""} ${(profile as any)?.rol || ""}`.toLowerCase();
    return roleText.includes("master");
  }, [profile]);

  const filteredProviders = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    if (!cleanSearch) return providers;

    return providers.filter((item) => {
      return (
        item.codigo.toLowerCase().includes(cleanSearch) ||
        item.nombre.toLowerCase().includes(cleanSearch) ||
        normalizeText(item.datos.NIT).toLowerCase().includes(cleanSearch) ||
        normalizeText(item.datos.TELEFONO).toLowerCase().includes(cleanSearch) ||
        normalizeText(item.datos.DIRECCION).toLowerCase().includes(cleanSearch)
      );
    });
  }, [providers, search]);

  const products = useMemo(() => {
    return extractProducts(selectedProvider);
  }, [selectedProvider]);

  const filteredProducts = useMemo(() => {
    const cleanSearch = productSearch.trim().toLowerCase();

    if (!cleanSearch) return products;

    return products.filter((item) => {
      return (
        item.codigo.toLowerCase().includes(cleanSearch) ||
        item.producto.toLowerCase().includes(cleanSearch) ||
        normalizeText(item.unidadEmpaque).toLowerCase().includes(cleanSearch) ||
        normalizeText(item.hojaDetalle).toLowerCase().includes(cleanSearch)
      );
    });
  }, [products, productSearch]);

  const movementRows = useMemo(() => {
    return sortMovementRows(selectedProduct?.movimientosRaw);
  }, [selectedProduct]);

  const lotOptions = useMemo(() => {
    return getLotsNewestFirst(selectedProduct?.movimientosRaw);
  }, [selectedProduct]);

  const mustSelectExistingLot = useMemo(() => {
    return operationType === "OP" || operationType === "REINTEGRO" || operationType === "AJUSTE";
  }, [operationType]);

  const canCreateLotFromMovement = useMemo(() => {
    return mustSelectExistingLot && lotOptions.length === 0 && !editingMovementId;
  }, [mustSelectExistingLot, lotOptions.length, editingMovementId]);

  const filteredMovements = useMemo(() => {
    const cleanSearch = movementSearch.trim().toLowerCase();

    if (!cleanSearch) return movementRows;

    return movementRows.filter((item) => {
      return (
        item.fecha.toLowerCase().includes(cleanSearch) ||
        item.descripcion.toLowerCase().includes(cleanSearch) ||
        item.observaciones.toLowerCase().includes(cleanSearch) ||
        normalizeText(item.ingreso).toLowerCase().includes(cleanSearch) ||
        normalizeText(item.salida).toLowerCase().includes(cleanSearch) ||
        normalizeText(item.saldo).toLowerCase().includes(cleanSearch)
      );
    });
  }, [movementRows, movementSearch]);

  const movementTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredMovements.length / 10));
  }, [filteredMovements.length]);

  const paginatedMovements = useMemo(() => {
    const start = (movementPage - 1) * 10;
    return filteredMovements.slice(start, start + 10);
  }, [filteredMovements, movementPage]);

  const currentBalance = useMemo(() => {
    const firstMovement = movementRows[0];
    return toNumber(firstMovement?.saldo || selectedProduct?.stock || 0);
  }, [movementRows, selectedProduct]);

  const movementBaseBalance = useMemo(() => {
    const previousBalance = getPreviousBalanceForMovement(
      selectedProduct?.movimientosRaw,
      editingMovementId
    );

    return previousBalance === null ? currentBalance : previousBalance;
  }, [selectedProduct, editingMovementId, currentBalance]);

  const calculatedBalance = useMemo(() => {
    const ingreso = toNumber(movementForm.INGRESO);
    const salida = toNumber(movementForm.SALIDA);

    return movementBaseBalance + ingreso - salida;
  }, [movementBaseBalance, movementForm.INGRESO, movementForm.SALIDA]);

  useEffect(() => {
    setMovementPage(1);
  }, [selectedProduct, movementSearch]);

  const totalStock = useMemo(() => {
    return products.reduce((acc, item) => {
      const value = Number(item.stock);
      return Number.isNaN(value) ? acc : acc + value;
    }, 0);
  }, [products]);

  const totalValorInventario = useMemo(() => {
    return products.reduce((acc, item) => {
      const stock = Number(item.stock);
      const costo = Number(item.costo);

      if (Number.isNaN(stock) || Number.isNaN(costo)) return acc;

      return acc + stock * costo;
    }, 0);
  }, [products]);

  const totalValorInventarioGeneral = useMemo(() => {
    return providers.reduce((providerAcc, provider) => {
      const providerProducts = extractProducts(provider);

      return providerAcc + providerProducts.reduce((productAcc, product) => {
        const latest = getLatestProductStock({
          DATOS_PRODUCTO: product.datos,
          MOVIMIENTOS: product.movimientosRaw || {},
        });
        const stock = latest.stockReal;
        const costo = toNumber(product.costo);

        return productAcc + stock * costo;
      }, 0);
    }, 0);
  }, [providers]);

  const productSemaphoreMap = useMemo(() => {
    if (!selectedProvider) return new Map<string, ProductSemaphoreRow>();

    return new Map(
      getProviderSemaphoreProducts(selectedProvider, semaforoConfigs).map((item) => [
        item.codigoProducto,
        item,
      ])
    );
  }, [selectedProvider, semaforoConfigs]);

  useEffect(() => {
    if (!loadingPermissions && !authUser) {
      router.replace("/");
    }
  }, [loadingPermissions, authUser, router]);

  useEffect(() => {
    if (loadingPermissions || !authUser) return;

    setLoadingOrdenesProduccion(true);

    const ordenesRef = ref(realtimeDb, "ORDENES_PEDIDO");

    const unsubscribe = onValue(
      ordenesRef,
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() || {} : {};

        const ordenes = Object.entries(data)
          .map(([id, raw]: [string, any]) => ({
            id,
            numero: getOrdenProduccionNumero(raw, id),
            cliente: getOrdenProduccionCliente(raw),
            fecha: normalizeText(raw?.fecha || raw?.creadoAt || raw?.createdAt),
          }))
          .filter((orden) => orden.numero)
          .sort((a, b) => {
            const fechaCompare = b.fecha.localeCompare(a.fecha);
            if (fechaCompare !== 0) return fechaCompare;
            return b.numero.localeCompare(a.numero);
          });

        setOrdenesProduccionOptions(ordenes);
        setLoadingOrdenesProduccion(false);
      },
      (err) => {
        console.warn("No fue posible cargar órdenes de producción para OP.", err);
        setOrdenesProduccionOptions([]);
        setLoadingOrdenesProduccion(false);
      }
    );

    return () => unsubscribe();
  }, [loadingPermissions, authUser, realtimeDb]);

  useEffect(() => {
    if (loadingPermissions || !authUser) return;

    const configRef = ref(realtimeDb, "SEMAFORIZACIÓN/CONFIG_PRODUCTOS");

    const unsubscribe = onValue(configRef, (snapshot) => {
      const data = snapshot.exists() ? snapshot.val() || {} : {};
      const nextConfigs: SemaforizacionConfigMap = {};

      Object.entries(data).forEach(([key, value]) => {
        const item = value as any;
        nextConfigs[key] = {
          stockDisponibleMinimo: toNumber(item.stockDisponibleMinimo ?? defaultSemaforizacionConfig.stockDisponibleMinimo),
          stockTeoricoMinimo: toNumber(item.stockTeoricoMinimo ?? defaultSemaforizacionConfig.stockTeoricoMinimo),
        };
      });

      setSemaforoConfigs(nextConfigs);
    });

    return () => unsubscribe();
  }, [loadingPermissions, authUser, realtimeDb]);

  async function syncSemaforizacionAlerts(configsToUse = semaforoConfigs, providersToUse = providers) {
    const alerts: Record<string, any> = {};
    const now = new Date().toISOString();

    providersToUse.forEach((provider) => {
      getProviderSemaphoreProducts(provider, configsToUse).forEach((product) => {
        const hasDisponibleAlert = product.disponibleStatus !== "ok";
        const hasTeoricoAlert = product.teoricoStatus !== "ok";

        if (!hasDisponibleAlert && !hasTeoricoAlert) return;

        const alertKey = getSemaforoKey(product.codigoProveedor, product.codigoProducto);
        const productConfig = getProductSemaforoConfig(configsToUse, product.codigoProveedor, product.codigoProducto);
        alerts[`SEMAFORIZACIÓN/ALERTAS/${alertKey}`] = {
          activo: true,
          codigoProveedor: product.codigoProveedor,
          nombreProveedor: provider.nombre,
          proveedorNodo: product.nombreProveedor,
          codigoProducto: product.codigoProducto,
          producto: product.producto,
          stockDisponible: product.stockDisponible,
          stockTeorico: product.stockTeorico,
          stockDisponibleMinimo: productConfig.stockDisponibleMinimo,
          stockTeoricoMinimo: productConfig.stockTeoricoMinimo,
          estadoDisponible: product.disponibleStatus,
          estadoTeorico: product.teoricoStatus,
          alertaDisponible: hasDisponibleAlert,
          alertaTeorico: hasTeoricoAlert,
          updatedAt: now,
        };
      });
    });

    await set(ref(realtimeDb, "SEMAFORIZACIÓN/ALERTAS"), {});

    if (Object.keys(alerts).length > 0) {
      await update(ref(realtimeDb), alerts);
    }
  }

  const handleSaveSemaforizacion = async () => {
    setError("");
    setMessage("");

    const nextConfig = {
      stockDisponibleMinimo: Math.max(0, toNumber(semaforoForm.stockDisponibleMinimo)),
      stockTeoricoMinimo: Math.max(0, toNumber(semaforoForm.stockTeoricoMinimo)),
    };

    setSavingSemaforo(true);

    try {
      if (!selectedSemaforoProduct || !selectedProvider) {
        throw new Error("Selecciona un producto para configurar la alerta.");
      }

      const semaforoKey = getSemaforoKey(selectedProvider.codigoNodo, selectedSemaforoProduct.codigo);
      const nextConfigs = {
        ...semaforoConfigs,
        [semaforoKey]: nextConfig,
      };

      await set(ref(realtimeDb, `SEMAFORIZACIÓN/CONFIG_PRODUCTOS/${semaforoKey}`), {
        ...nextConfig,
        codigoProveedor: selectedProvider.codigoNodo,
        nombreProveedor: selectedProvider.nombre,
        proveedorNodo: selectedProvider.nombreNodo,
        codigoProducto: selectedSemaforoProduct.codigo,
        producto: selectedSemaforoProduct.producto,
        updatedAt: new Date().toISOString(),
        updatedByUid: authUser?.uid || null,
        updatedByEmail: authUser?.email || null,
      });

      setSemaforoConfigs(nextConfigs);
      await syncSemaforizacionAlerts(nextConfigs, providers);
      setSemaforoModalOpen(false);
      setSelectedSemaforoProduct(null);
      setMessage("Semaforización del producto guardada y alertas actualizadas correctamente.");
    } catch (err: any) {
      setError(`No fue posible guardar la semaforización del producto. ${err?.message || ""}`);
    } finally {
      setSavingSemaforo(false);
    }
  };

  useEffect(() => {
    if (loadingPermissions || !authUser || loadingProviders || providers.length === 0) return;

    const timer = window.setTimeout(() => {
      syncSemaforizacionAlerts(semaforoConfigs, providers).catch((err) => {
        console.warn("No fue posible sincronizar alertas de semaforización.", err);
      });
    }, 600);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers, semaforoConfigs, loadingPermissions, authUser, loadingProviders]);

  async function reloadProviders() {
    setLoadingProviders(true);
    setError("");

    try {
      const snapshot = await get(ref(realtimeDb, "PROVEEDORES"));

      if (!snapshot.exists()) {
        setProviders([]);
        setLoadingProviders(false);
        return;
      }

      const rawProviders = snapshot.val() || {};
      const rows: ProviderRow[] = [];

      Object.entries(rawProviders).forEach(([providerCode, providerNode]) => {
        const providerNames = providerNode as Record<string, any>;

        Object.entries(providerNames || {}).forEach(
          ([providerName, providerContent]) => {
            const datos = providerContent?.DATOS || {};

            rows.push({
              id: `${providerCode}/${providerName}`,
              codigoNodo: providerCode,
              nombreNodo: providerName,
              codigo: normalizeText(datos.CODIGO || providerCode),
              nombre: normalizeText(datos.PROVEEDOR || providerName),
              datos: {
                CODIGO: normalizeText(datos.CODIGO || providerCode),
                DIRECCION: normalizeText(datos.DIRECCION),
                HOJA: normalizeText(datos.HOJA),
                NIT: normalizeText(datos.NIT),
                PROVEEDOR: normalizeText(datos.PROVEEDOR || providerName),
                TELEFONO: normalizeText(datos.TELEFONO),
              },
              productosRaw: providerContent?.PRODUCTOS || {},
            });
          }
        );
      });

      rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setProviders(rows);

      if (selectedProvider) {
        const updatedSelected = rows.find((item) => item.id === selectedProvider.id);
        setSelectedProvider(updatedSelected || null);

        if (selectedProduct && updatedSelected) {
          const updatedProduct = extractProducts(updatedSelected).find(
            (item) => item.id === selectedProduct.id
          );
          setSelectedProduct(updatedProduct || null);
        }
      }
    } catch (err: any) {
      setError(`No fue posible cargar proveedores. ${err?.message || ""}`);
    } finally {
      setLoadingProviders(false);
    }
  }

  useEffect(() => {
    if (loadingPermissions) return;

    if (!authUser) {
      setLoadingProviders(false);
      return;
    }

    if (!can("proveedoresBodega", "ver")) {
      setLoadingProviders(false);
      return;
    }

    setLoadingProviders(true);
    setError("");

    const proveedoresRef = ref(realtimeDb, "PROVEEDORES");

    const unsubscribe = onValue(
      proveedoresRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setProviders([]);
          setSelectedProvider(null);
          setSelectedProduct(null);
          setLoadingProviders(false);
          return;
        }

        const rawProviders = snapshot.val() || {};
        const rows: ProviderRow[] = [];

        Object.entries(rawProviders).forEach(([providerCode, providerNode]) => {
          const providerNames = providerNode as Record<string, any>;

          Object.entries(providerNames || {}).forEach(
            ([providerName, providerContent]) => {
              const datos = providerContent?.DATOS || {};

              rows.push({
                id: `${providerCode}/${providerName}`,
                codigoNodo: providerCode,
                nombreNodo: providerName,
                codigo: normalizeText(datos.CODIGO || providerCode),
                nombre: normalizeText(datos.PROVEEDOR || providerName),
                datos: {
                  CODIGO: normalizeText(datos.CODIGO || providerCode),
                  DIRECCION: normalizeText(datos.DIRECCION),
                  HOJA: normalizeText(datos.HOJA),
                  NIT: normalizeText(datos.NIT),
                  PROVEEDOR: normalizeText(datos.PROVEEDOR || providerName),
                  TELEFONO: normalizeText(datos.TELEFONO),
                },
                productosRaw: providerContent?.PRODUCTOS || {},
              });
            }
          );
        });

        rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setProviders(rows);

        setSelectedProvider((currentProvider) => {
          if (!currentProvider) return null;

          const updatedProvider = rows.find((item) => item.id === currentProvider.id);

          if (!updatedProvider) {
            setSelectedProduct(null);
            return null;
          }

          setSelectedProduct((currentProduct) => {
            if (!currentProduct) return null;

            return (
              extractProducts(updatedProvider).find(
                (item) => item.id === currentProduct.id
              ) || null
            );
          });

          return updatedProvider;
        });

        setLoadingProviders(false);
      },
      (err) => {
        setError(`No fue posible escuchar proveedores en tiempo real. ${err.message}`);
        setLoadingProviders(false);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingPermissions, authUser, realtimeDb, can]);

  const resetForm = () => {
    setForm(emptyProvider);
    setEditingProvider(null);
    setError("");
    setMessage("");
  };

  const resetMovementForm = () => {
    const today = todayISO();
    setMovementForm({
      ...emptyMovement,
      FECHA: today,
      SALDO: calculatedBalance,
    });
  };

  const handleChange = (field: keyof ProviderData, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleProductChange = (field: keyof ProductData, value: string) => {
    setProductForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleMovementChange = (field: keyof MovementData, value: string) => {
    setMovementForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleEdit = (provider: ProviderRow) => {
    if (!can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para editar proveedores.");
      return;
    }

    setEditingProvider(provider);
    setForm(provider.datos);
    setSelectedProvider(null);
    setSelectedProduct(null);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetProductForm = () => {
    setProductForm(emptyProduct);
    setMockupFile(null);
    setMockupPreview("");
    setEditingProduct(null);
    setError("");
    setMessage("");
  };

  const handleMockupChange = (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen válida para el mockup.");
      return;
    }

    setMockupFile(file);
    setMockupPreview(URL.createObjectURL(file));
  };

  const removeMockup = () => {
    setMockupFile(null);
    setMockupPreview("");
    setProductForm((current) => ({
      ...current,
      MOCKUP_URL: "",
      MOCKUP_PATH: "",
    }));
  };

  const uploadMockupIfNeeded = async (
    providerCode: string,
    providerName: string,
    productCode: string
  ) => {
    if (!mockupFile) {
      return {
        MOCKUP_URL: productForm.MOCKUP_URL || "",
        MOCKUP_PATH: productForm.MOCKUP_PATH || "",
      };
    }

    const extension = mockupFile.name.split(".").pop() || "jpg";
    const path = `proveedores/${providerCode}/${providerName}/productos/${productCode}/mockup.${extension}`;
    const fileRef = storageRef(storage, path);

    await uploadBytes(fileRef, mockupFile);
    const url = await getDownloadURL(fileRef);

    return {
      MOCKUP_URL: url,
      MOCKUP_PATH: path,
    };
  };

  const handleOpenProvider = (provider: ProviderRow) => {
    setSelectedProvider(provider);
    setSelectedProduct(null);
    setProductForm(emptyProduct);
    setEditingProduct(null);
    setProductSearch("");
    setMovementSearch("");
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEditProduct = (product: ProductRow) => {
    if (!can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para editar productos.");
      return;
    }

    setEditingProduct(product);
    setProductForm(product.datos);
    setMockupFile(null);
    setMockupPreview(product.mockupUrl || "");
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenProduct = (product: ProductRow) => {
    setSelectedProduct(product);
    setMovementSearch("");
    const today = todayISO();

    setMovementForm({
      FECHA: today,
      DESCRIPCION: "",
      OBSERVACIONES: "",
      INGRESO: "",
      SALIDA: "",
      SALDO: "",
      STOCK_RESERVADO: "",
      STOCK_DISPONIBLE: "",
      STOCK_TEORICO: "",
    });
    setOperationType("");
    setOperationConsecutive("");
    setEditingMovementId(null);
    setMovementPage(1);

    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToProviders = () => {
    setSelectedProvider(null);
    setSelectedProduct(null);
    setProductSearch("");
    setMovementSearch("");
    setError("");
    setMessage("");
  };

  const handleBackToProducts = () => {
    setSelectedProduct(null);
    setMovementSearch("");
    setError("");
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (editingProvider && !can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para editar proveedores.");
      return;
    }

    if (!editingProvider && !can("proveedoresBodega", "crear")) {
      setError("Tu rol no tiene permiso para crear proveedores.");
      return;
    }

    const codigo = cleanKey(form.CODIGO);
    const proveedor = form.PROVEEDOR.trim().toUpperCase();

    if (!codigo) {
      setError("El código del proveedor es obligatorio.");
      return;
    }

    if (!proveedor) {
      setError("El nombre del proveedor es obligatorio.");
      return;
    }

    setSaving(true);

    try {
      const providerPath = `PROVEEDORES/${codigo}/${proveedor}`;
      const datos: ProviderData = {
        CODIGO: codigo,
        PROVEEDOR: proveedor,
        NIT: form.NIT,
        DIRECCION: form.DIRECCION,
        TELEFONO: form.TELEFONO,
        HOJA: form.HOJA,
      };

      if (editingProvider) {
        const oldPath = `PROVEEDORES/${editingProvider.id}`;

        if (editingProvider.id !== `${codigo}/${proveedor}`) {
          const oldSnapshot = await get(ref(realtimeDb, oldPath));
          const oldData = oldSnapshot.exists() ? oldSnapshot.val() : {};

          await set(ref(realtimeDb, providerPath), {
            ...oldData,
            DATOS: datos,
          });

          await set(ref(realtimeDb, oldPath), null);
        } else {
          await update(ref(realtimeDb, providerPath), {
            DATOS: datos,
          });
        }

        setMessage("Proveedor actualizado correctamente.");
      } else {
        const providerSnapshot = await get(ref(realtimeDb, providerPath));

        if (providerSnapshot.exists()) {
          setError("Ya existe un proveedor con ese código y nombre.");
          setSaving(false);
          return;
        }

        await set(ref(realtimeDb, providerPath), {
          DATOS: datos,
          PRODUCTOS: {},
        });

        setMessage("Proveedor creado correctamente.");
      }

      resetForm();
      // La escucha en tiempo real de PROVEEDORES actualiza la vista automáticamente.
    } catch (err: any) {
      setError(`No fue posible guardar el proveedor. ${err?.message || ""}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!selectedProvider) {
      setError("Selecciona primero un proveedor.");
      return;
    }

    if (editingProduct && !can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para editar productos.");
      return;
    }

    if (!editingProduct && !can("proveedoresBodega", "crear")) {
      setError("Tu rol no tiene permiso para crear productos.");
      return;
    }

    const codigo = cleanKey(productForm.CODIGO);

    if (!codigo) {
      setError("El código del producto es obligatorio.");
      return;
    }

    if (!productForm.PRODUCTO.trim()) {
      setError("El nombre del producto es obligatorio.");
      return;
    }

    setSavingProduct(true);

    try {
      const providerPath = `PROVEEDORES/${selectedProvider.codigoNodo}/${selectedProvider.nombreNodo}`;
      const oldProductPath = `${providerPath}/PRODUCTOS/${editingProduct?.id || codigo}`;
      const newProductPath = `${providerPath}/PRODUCTOS/${codigo}`;

      const mockupData = await uploadMockupIfNeeded(
        selectedProvider.codigoNodo,
        selectedProvider.nombreNodo,
        codigo
      );

      const datos: ProductData = {
        CODIGO: codigo,
        PRODUCTO: productForm.PRODUCTO.trim().toUpperCase(),
        UNIDAD_DE_EMPAQUE: productForm.UNIDAD_DE_EMPAQUE,
        COSTO: productForm.COSTO,
        STOCK: productForm.STOCK,
        HOJA_DETALLE: productForm.HOJA_DETALLE,
        MOCKUP_URL: mockupData.MOCKUP_URL,
        MOCKUP_PATH: mockupData.MOCKUP_PATH,
      };

      if (editingProduct && editingProduct.id !== codigo) {
        const oldSnapshot = await get(ref(realtimeDb, oldProductPath));
        const oldData = oldSnapshot.exists() ? oldSnapshot.val() : {};

        await set(ref(realtimeDb, newProductPath), {
          ...oldData,
          DATOS_PRODUCTO: datos,
        });

        await set(ref(realtimeDb, oldProductPath), null);
      } else {
        await update(ref(realtimeDb, newProductPath), {
          DATOS_PRODUCTO: datos,
        });

        const productSnapshot = await get(ref(realtimeDb, newProductPath));
        if (!productSnapshot.exists()) {
          await set(ref(realtimeDb, newProductPath), {
            DATOS_PRODUCTO: datos,
            MOVIMIENTOS: {},
          });
        }
      }

      setMessage(editingProduct ? "Producto actualizado correctamente." : "Producto creado correctamente.");
      resetProductForm();
      // La escucha en tiempo real de PROVEEDORES actualiza la vista automáticamente.
    } catch (err: any) {
      setError(`No fue posible guardar el producto. ${err?.message || ""}`);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleEditMovement = (movement: MovementRow) => {
    if (!can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para editar movimientos.");
      return;
    }

    setEditingMovementId(movement.id);
    setMovementForm({
      FECHA: movement.fecha,
      DESCRIPCION: movement.descripcion,
      OBSERVACIONES: movement.observaciones,
      INGRESO: movement.ingreso,
      SALIDA: movement.salida,
      SALDO: movement.saldo,
      STOCK_RESERVADO: movement.stockReservado,
      STOCK_DISPONIBLE: movement.stockDisponible,
      STOCK_TEORICO: movement.stockTeorico,
    });
    setOperationType(getMovementOperation(movement.descripcion));
    setOperationConsecutive(getMovementConsecutive(movement.descripcion));
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelMovementEdit = () => {
    setEditingMovementId(null);
    setOperationType("");
    setOperationConsecutive("");
    setMovementForm({
      FECHA: todayISO(),
      DESCRIPCION: "",
      OBSERVACIONES: "",
      INGRESO: "",
      SALIDA: "",
      SALDO: "",
      STOCK_RESERVADO: "",
      STOCK_DISPONIBLE: "",
      STOCK_TEORICO: "",
    });
  };

  const saveNewMovementWithoutRecalculatingHistory = async (
    productPath: string,
    movementsRaw: Record<string, MovementData>,
    movementKeyToSave: string,
    movementToSave: MovementData,
    currentProductBalance: number,
    lote: string,
    salidaValue: number,
    selectedOperation: string
  ) => {
    const rawMovements = movementsRaw || {};
    const ingresoValue = toNumber(movementToSave.INGRESO);
    const cleanSalidaValue = toNumber(movementToSave.SALIDA);
    const manualReserved = toNumber(movementToSave.STOCK_RESERVADO);
    const newestBalance = currentProductBalance + ingresoValue - cleanSalidaValue;

    const remainingReservedForLot = getNextReservedForLot(
      rawMovements,
      lote,
      selectedOperation,
      ingresoValue,
      cleanSalidaValue,
      manualReserved,
      movementKeyToSave
    );

    const stockDisponible = newestBalance - remainingReservedForLot;
    const stockTeorico = stockDisponible;

    await update(ref(realtimeDb, productPath), {
      [`MOVIMIENTOS/${movementKeyToSave}`]: {
        ...movementToSave,
        INGRESO: ingresoValue > 0 ? ingresoValue : "",
        SALIDA: cleanSalidaValue > 0 ? cleanSalidaValue : "",
        SALDO: newestBalance,
        STOCK_RESERVADO: remainingReservedForLot > 0 ? remainingReservedForLot : "",
        STOCK_DISPONIBLE: stockDisponible,
        STOCK_TEORICO: stockTeorico,
      },
      "DATOS_PRODUCTO/STOCK": newestBalance,
    });

    return {
      newestBalance,
      remainingReservedForLot,
      stockTeorico,
    };
  };

  const recalculateAndSaveMovements = async (
    productPath: string,
    movementsRaw: Record<string, MovementData>,
    movementKeyToSave: string,
    movementToSave: MovementData
  ) => {
    const updatedMovements: Record<string, MovementData> = {
      ...(movementsRaw || {}),
      [movementKeyToSave]: movementToSave,
    };

    /*
      Recalcula siempre desde el movimiento más antiguo al más reciente.
      Fórmula única y segura:
      nuevo saldo = saldo anterior + ingreso - salida.

      Esto evita el error donde una salida se terminaba sumando por el orden
      descendente de la tabla o por fechas futuras accidentales.
    */
    const ascEntries = sortMovementEntriesAsc(updatedMovements);

    if (ascEntries.length === 0) {
      throw new Error("No hay movimientos para recalcular.");
    }

    const [firstRowId] = ascEntries[0];
    const originalFirst = movementsRaw?.[firstRowId];

    let runningBalance = originalFirst
      ? toNumber(originalFirst.SALDO) -
        toNumber(originalFirst.INGRESO) +
        toNumber(originalFirst.SALIDA)
      : 0;

    const updates: Record<string, any> = {};

    ascEntries.forEach(([rowId, rowValue]) => {
      const ingresoValue = toNumber(rowValue?.INGRESO);
      const salidaValue = toNumber(rowValue?.SALIDA);

      runningBalance = runningBalance + ingresoValue - salidaValue;

      const stockReservado = toNumber(rowValue?.STOCK_RESERVADO);
      const stockDisponible = runningBalance - stockReservado;
      const stockTeorico = stockDisponible;

      if (rowId === movementKeyToSave) {
        updates[`MOVIMIENTOS/${rowId}`] = {
          ...movementToSave,
          INGRESO: ingresoValue > 0 ? ingresoValue : "",
          SALIDA: salidaValue > 0 ? salidaValue : "",
          SALDO: runningBalance,
          STOCK_DISPONIBLE: stockDisponible,
          STOCK_TEORICO: stockTeorico,
        };
      } else {
        updates[`MOVIMIENTOS/${rowId}/SALDO`] = runningBalance;
        updates[`MOVIMIENTOS/${rowId}/STOCK_DISPONIBLE`] = stockDisponible;
        updates[`MOVIMIENTOS/${rowId}/STOCK_TEORICO`] = stockTeorico;

        const normalizedReserved = toNumber(rowValue?.STOCK_RESERVADO);
        if (normalizeText(rowValue?.STOCK_RESERVADO) !== "") {
          updates[`MOVIMIENTOS/${rowId}/STOCK_RESERVADO`] =
            normalizedReserved > 0 ? normalizedReserved : "";
        }
      }
    });

    updates["DATOS_PRODUCTO/STOCK"] = runningBalance;

    await update(ref(realtimeDb, productPath), updates);

    return runningBalance;
  };

  const saveInventoryAlertIfNeeded = async (
    productPath: string,
    productCode: string,
    productName: string,
    lote: string,
    saldo: number,
    stockReservado: number,
    stockTeorico: number
  ) => {
    const alerts: Record<string, any> = {};
    const now = Date.now();
    const safeLote = cleanKey(lote || "SIN-LOTE");

    if (saldo < 0) {
      alerts[`ALERTAS_BODEGA/SALDO_NEGATIVO/${productCode}_${safeLote}`] = {
        tipo: "SALDO_NEGATIVO",
        productoCodigo: productCode,
        producto: productName,
        lote,
        saldo,
        stockReservado,
        stockTeorico,
        productPath,
        activo: true,
        createdAt: now,
        updatedAt: now,
      };
    }

    if (stockTeorico < 0) {
      alerts[`ALERTAS_BODEGA/STOCK_TEORICO_NEGATIVO/${productCode}_${safeLote}`] = {
        tipo: "STOCK_TEORICO_NEGATIVO",
        productoCodigo: productCode,
        producto: productName,
        lote,
        saldo,
        stockReservado,
        stockTeorico,
        productPath,
        activo: true,
        createdAt: now,
        updatedAt: now,
      };
    }

    if (Object.keys(alerts).length > 0) {
      await update(ref(realtimeDb), alerts);
    }
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!selectedProvider || !selectedProduct) {
      setError("Selecciona un proveedor y un producto.");
      return;
    }

    if (!can("proveedoresBodega", "crear") && !can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para crear movimientos.");
      return;
    }

    const ingreso = toNumber(movementForm.INGRESO);
    const salida = toNumber(movementForm.SALIDA);

    const movementDate = normalizeDateInput(movementForm.FECHA);

    if (!movementDate) {
      setError("La fecha del movimiento es obligatoria.");
      return;
    }

    const selectedOperation = operationType.trim().toUpperCase();
    const operationSuffix = operationConsecutive.trim().toUpperCase();
    const lote = normalizeText(movementForm.OBSERVACIONES).trim().toUpperCase();

    if (!selectedOperation) {
      setError("Selecciona la operación del movimiento.");
      return;
    }

    if (!operationSuffix) {
      setError("Digita el consecutivo o referencia de la operación.");
      return;
    }

    if (!lote) {
      setError("El lote es obligatorio.");
      return;
    }

    if ((selectedOperation === "OP" || selectedOperation === "REINTEGRO" || selectedOperation === "AJUSTE") && !editingMovementId && lotOptions.length > 0) {
      const loteExiste = lotOptions.some((item) => item.lote === lote);
      if (!loteExiste) {
        setError("Para OP, REINTEGRO o AJUSTE debes seleccionar un lote existente de la lista. Si el producto no tiene lotes, puedes digitar uno nuevo.");
        return;
      }
    }

    if (selectedOperation === "AJUSTE" && !isMaster && !adjustmentApproved) {
      setError("La operación AJUSTE está bloqueada hasta aprobación del usuario master.");
      return;
    }

    if (ingreso > 0 && salida > 0) {
      setError("Un movimiento no debe tener ingreso y salida al mismo tiempo.");
      return;
    }

    if (ingreso <= 0 && salida <= 0) {
      setError("Debes registrar un ingreso o una salida.");
      return;
    }

    if ((selectedOperation === "COMPRA" || selectedOperation === "REINTEGRO") && salida > 0) {
      setError(`${selectedOperation} solo permite ingreso.`);
      return;
    }

    if (selectedOperation === "OP" && ingreso > 0) {
      setError("OP solo permite salida.");
      return;
    }

    if (selectedOperation !== "AJUSTE") {
      const oldestLot = getOldestLotWithBalance(selectedProduct.movimientosRaw);
      if (salida > 0 && oldestLot && oldestLot.lote !== lote) {
        setError(
          `Primero debes dejar en cero el lote ${oldestLot.lote}. Tiene ${normalizeNumber(oldestLot.balance)} disponibles antes de usar otro lote.`
        );
        return;
      }
    }

    setSavingMovement(true);

    try {
      const movimientoKey =
        editingMovementId || nextMovementKey(selectedProduct.movimientosRaw);
      const providerPath = `PROVEEDORES/${selectedProvider.codigoNodo}/${selectedProvider.nombreNodo}`;
      const productPath = `${providerPath}/PRODUCTOS/${selectedProduct.id}`;

      const now = Date.now();

      const stockReservado = toNumber(movementForm.STOCK_RESERVADO);
      const operationCode = `${selectedOperation}-${operationSuffix}`;

      const movimiento: MovementData = {
        FECHA: movementDate,
        DESCRIPCION: operationCode,
        OBSERVACIONES: lote,
        INGRESO: ingreso > 0 ? ingreso : "",
        SALIDA: salida > 0 ? salida : "",
        SALDO: 0,
        STOCK_RESERVADO: stockReservado || "",
        STOCK_DISPONIBLE: 0,
        STOCK_TEORICO: 0,
        ORDEN_FECHA: parseDateValue(movementDate),
        ...(editingMovementId ? { UPDATED_AT: now } : { CREATED_AT: now }),
      };

      const rawMovements = selectedProduct.movimientosRaw || {};

      const saveResult = editingMovementId
        ? (() => null)()
        : await saveNewMovementWithoutRecalculatingHistory(
            productPath,
            rawMovements,
            movimientoKey,
            movimiento,
            currentBalance,
            lote,
            salida,
            selectedOperation
          );

      let newestBalance = saveResult?.newestBalance ?? 0;
      let remainingReservedForLot = saveResult?.remainingReservedForLot ?? 0;
      let stockTeorico = saveResult?.stockTeorico ?? 0;

      if (editingMovementId) {
        newestBalance = await recalculateAndSaveMovements(
          productPath,
          rawMovements,
          movimientoKey,
          movimiento
        );

        remainingReservedForLot = getNextReservedForLot(
          rawMovements,
          lote,
          selectedOperation,
          ingreso,
          salida,
          stockReservado,
          editingMovementId
        );

        stockTeorico = newestBalance - remainingReservedForLot;

        await update(ref(realtimeDb, `${productPath}/MOVIMIENTOS/${movimientoKey}`), {
          STOCK_RESERVADO: remainingReservedForLot > 0 ? remainingReservedForLot : "",
          STOCK_DISPONIBLE: stockTeorico,
          STOCK_TEORICO: stockTeorico,
        });
      }

      try {
        await saveInventoryAlertIfNeeded(
          productPath,
          selectedProduct.codigo,
          selectedProduct.producto,
          lote,
          newestBalance,
          remainingReservedForLot,
          stockTeorico
        );
      } catch (alertErr) {
        console.warn("El movimiento se guardó, pero no fue posible registrar la alerta de inventario.", alertErr);
      }

      setMessage(
        editingMovementId
          ? "Movimiento actualizado y saldos recalculados correctamente."
          : "Movimiento guardado y stock actualizado correctamente."
      );
      setEditingMovementId(null);
      setOperationType("");
      setOperationConsecutive("");
      setMovementForm({
        FECHA: todayISO(),
        DESCRIPCION: "",
        OBSERVACIONES: "",
        INGRESO: "",
        SALIDA: "",
        SALDO: "",
        STOCK_RESERVADO: "",
        STOCK_DISPONIBLE: "",
        STOCK_TEORICO: "",
      });

      // La escucha en tiempo real de PROVEEDORES actualiza la vista automáticamente.
    } catch (err: any) {
      setError(`No fue posible guardar el movimiento. ${err?.message || ""}`);
    } finally {
      setSavingMovement(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((current) => ({ ...current, [sectionTitle]: !current[sectionTitle] }));
    if (sidebarCollapsed) setSidebarCollapsed(false);
  };

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

  if (loadingPermissions || !authUser) {
    return (
      <main className="min-h-screen bg-[#244C5A] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl px-8 py-7 shadow-2xl flex items-center gap-3 text-[#244C5A] font-semibold">
          <Loader2 className="animate-spin" size={22} />
          Validando acceso...
        </div>
      </main>
    );
  }

  if (!isActive) {
    return (
      <NoPermission
        title="Usuario inactivo"
        message="Tu usuario está desactivado. Contacta al administrador."
      />
    );
  }

  if (!can("proveedoresBodega", "ver")) {
    return (
      <NoPermission
        title="Sin permiso"
        message="Tu rol no tiene permiso para ver proveedores y bodega."
      />
    );
  }

  const canModifyForm = editingProvider
    ? can("proveedoresBodega", "editar")
    : can("proveedoresBodega", "crear");

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="w-10 h-10 rounded-2xl bg-[#244C5A] text-white flex items-center justify-center"
          aria-label="Abrir menú"
        >
          <Menu size={22} />
        </button>
        <Image src="/logo.png" alt="Nuall" width={105} height={45} priority className="object-contain" />
        <button
          type="button"
          onClick={handleLogout}
          className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center"
          aria-label="Cerrar sesión"
        >
          <LogOut size={20} />
        </button>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-slate-950/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar fondo menú"
        />
      )}

      <AppSidebar
        sidebarOpen={sidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarOpen={setSidebarOpen}
        setSidebarCollapsed={setSidebarCollapsed}
        openSections={openSections}
        toggleSection={toggleSection}
        userName={userName}
        email={authUser?.email || ""}
        roleName={(profile as any)?.rolNombre || "Sin rol"}
        onLogout={handleLogout}
        activeHref="/panel/proveedores-bodega"
      />

      <main className={`${sidebarWidth} min-h-screen bg-slate-100 text-slate-900 pt-16 lg:pt-0 transition-all duration-300`}>
        <header className="hidden lg:flex h-20 bg-white border-b border-slate-200 px-8 items-center justify-between sticky top-0 z-30">
          <div>
            <nav aria-label="Ruta de navegación" className="flex items-center gap-2 text-sm text-slate-500">
              <Link
                href="/panel"
                className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-[#244C5A] text-white hover:bg-[#1d3d49] transition"
                title="Ir al dashboard"
              >
                <Home size={18} />
              </Link>
              <Link href="/panel" className="font-semibold hover:text-[#244C5A] transition">
                Panel administrativo
              </Link>
              <span className="text-slate-300">/</span>
              <button
                type="button"
                onClick={handleBackToProviders}
                className={`font-semibold transition ${selectedProvider || selectedProduct ? "hover:text-[#244C5A]" : "text-slate-900 font-black"}`}
              >
                Bodega
              </button>
              {selectedProvider && (
                <>
                  <span className="text-slate-300">/</span>
                  <button
                    type="button"
                    onClick={handleBackToProducts}
                    className={`font-semibold transition ${selectedProduct ? "hover:text-[#244C5A]" : "text-slate-900 font-black"}`}
                  >
                    {selectedProvider.nombre}
                  </button>
                </>
              )}
              {selectedProduct && (
                <>
                  <span className="text-slate-300">/</span>
                  <span className="font-black text-slate-900 truncate max-w-[360px]">
                    {selectedProduct.codigo} · {selectedProduct.producto}
                  </span>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800 truncate max-w-[240px]">{userName}</p>
              <p className="text-xs text-slate-500 truncate max-w-[240px]">{authUser?.email}</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-[#244C5A] text-white flex items-center justify-center font-black uppercase">
              {userName.slice(0, 1)}
            </div>
          </div>
        </header>

      <section className="max-w-[1600px] mx-auto px-5 sm:px-8 py-6">
        {(error || message) && (
          <div className="mb-5">

      {editingProvider && (
        <div className="fixed inset-0 z-[60] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#244C5A]">Editar proveedor</p>
                <h3 className="text-2xl font-black text-slate-900">{editingProvider.nombre}</h3>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                aria-label="Cerrar edición"
              >
                <X size={22} />
              </button>
            </div>
            <form
              onSubmit={handleSubmit}
              className="bg-white"
            >
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    {editingProvider ? "Editando proveedor" : "Nuevo proveedor"}
                  </p>
                  <h2 className="text-2xl font-black mt-1">
                    {editingProvider
                      ? "Actualizar datos del proveedor"
                      : "Crear proveedor"}
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Primera capa conectada al nodo PROVEEDORES de Realtime Database.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                  {editingProvider && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      <X size={17} />
                      Cancelar
                    </button>
                  )}

                  {canModifyForm && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20 whitespace-nowrap"
                    >
                      {saving ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : editingProvider ? (
                        <Save size={20} />
                      ) : (
                        <Plus size={20} />
                      )}
                      {saving
                        ? "Guardando..."
                        : editingProvider
                        ? "Actualizar proveedor"
                        : "Crear proveedor"}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Código
                  </label>
                  <input
                    type="text"
                    value={form.CODIGO}
                    disabled={!canModifyForm || !!editingProvider}
                    onChange={(e) => handleChange("CODIGO", e.target.value)}
                    placeholder="ALI-105"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Proveedor
                  </label>
                  <input
                    type="text"
                    value={form.PROVEEDOR}
                    disabled={!canModifyForm}
                    onChange={(e) => handleChange("PROVEEDOR", e.target.value)}
                    placeholder="ALICO"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    NIT
                  </label>
                  <input
                    type="text"
                    value={form.NIT}
                    disabled={!canModifyForm}
                    onChange={(e) => handleChange("NIT", e.target.value)}
                    placeholder="900000000"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={form.TELEFONO}
                    disabled={!canModifyForm}
                    onChange={(e) => handleChange("TELEFONO", e.target.value)}
                    placeholder="3000000000"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="hidden">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Hoja
                  </label>
                  <input
                    type="text"
                    value={form.HOJA}
                    disabled={!canModifyForm}
                    onChange={(e) => handleChange("HOJA", e.target.value)}
                    placeholder="Nombre hoja"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="md:col-span-2 xl:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={form.DIRECCION}
                    disabled={!canModifyForm}
                    onChange={(e) => handleChange("DIRECCION", e.target.value)}
                    placeholder="Dirección proveedor"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </form>


          </div>
        </div>
      )}

      {editingProduct && selectedProvider && (
        <div className="fixed inset-0 z-[60] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#244C5A]">Editar producto</p>
                <h3 className="text-2xl font-black text-slate-900">{editingProduct.producto || editingProduct.codigo}</h3>
              </div>
              <button
                type="button"
                onClick={resetProductForm}
                className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                aria-label="Cerrar edición de producto"
              >
                <X size={22} />
              </button>
            </div>
            <form
              onSubmit={handleSaveProduct}
              className="bg-white"
            >
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    {editingProduct ? "Editando producto" : "Nuevo producto"}
                  </p>
                  <h2 className="text-2xl font-black mt-1">
                    {editingProduct ? "Actualizar producto" : "Agregar producto al proveedor"}
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Segunda capa: datos base del producto. La operación diaria se maneja en movimientos.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={resetProductForm}
                      className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition"
                    >
                      Cancelar
                    </button>
                  )}

                  {((editingProduct && can("proveedoresBodega", "editar")) ||
                    (!editingProduct && can("proveedoresBodega", "crear"))) && (
                    <button
                      type="submit"
                      disabled={savingProduct}
                      className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20 whitespace-nowrap"
                    >
                      {savingProduct ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : editingProduct ? (
                        <Save size={20} />
                      ) : (
                        <Plus size={20} />
                      )}
                      {savingProduct
                        ? "Guardando..."
                        : editingProduct
                        ? "Actualizar producto"
                        : "Crear producto"}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Código
                  </label>
                  <input
                    type="text"
                    value={productForm.CODIGO}
                    onChange={(e) => handleProductChange("CODIGO", e.target.value)}
                    placeholder="ALI-001"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <div className="xl:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Producto
                  </label>
                  <input
                    type="text"
                    value={productForm.PRODUCTO}
                    onChange={(e) => handleProductChange("PRODUCTO", e.target.value)}
                    placeholder="Nombre del producto"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Mockup
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="w-full rounded-2xl border border-dashed border-[#244C5A]/35 bg-[#244C5A]/5 px-4 py-3 text-sm font-black text-[#244C5A] hover:bg-[#244C5A]/10 transition cursor-pointer flex items-center justify-center gap-2">
                      <UploadCloud size={18} />
                      Adjuntar
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleMockupChange(e.target.files?.[0])}
                      />
                    </label>

                    {(mockupPreview || productForm.MOCKUP_URL) && (
                      <button
                        type="button"
                        onClick={removeMockup}
                        className="w-12 h-12 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center transition"
                        title="Eliminar mockup"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Unidad de empaque
                  </label>
                  <input
                    type="text"
                    value={productForm.UNIDAD_DE_EMPAQUE}
                    onChange={(e) =>
                      handleProductChange("UNIDAD_DE_EMPAQUE", e.target.value)
                    }
                    placeholder="CAJA, PAQUETE..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Costo
                  </label>
                  <input
                    type="number"
                    value={productForm.COSTO}
                    onChange={(e) => handleProductChange("COSTO", e.target.value)}
                    placeholder="0"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Stock inicial
                  </label>
                  <input
                    type="number"
                    value={productForm.STOCK}
                    onChange={(e) => handleProductChange("STOCK", e.target.value)}
                    placeholder="0"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <div className="hidden">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Hoja detalle
                  </label>
                  <input
                    type="text"
                    value={productForm.HOJA_DETALLE}
                    onChange={(e) =>
                      handleProductChange("HOJA_DETALLE", e.target.value)
                    }
                    placeholder="Referencia hoja o ubicación"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>
              </div>
            </form>


          </div>
        </div>
      )}

      {error && (
              <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">
                {message}
              </div>
            )}
          </div>
        )}

        {selectedProduct && selectedProvider ? (
          <>
            <section className="relative overflow-hidden rounded-[32px] bg-[#244C5A] text-white p-6 sm:p-8 shadow-xl mb-6">
              <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-white/10" />
              <div className="absolute right-24 bottom-[-80px] w-56 h-56 rounded-full bg-white/10" />

              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <button
                    type="button"
                    onClick={handleBackToProducts}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2 text-sm font-bold transition mb-5"
                  >
                    <ArrowLeft size={17} />
                    Volver a productos
                  </button>

                  <p className="text-sm text-white/65 uppercase tracking-wide font-bold">
                    {selectedProvider.nombre}
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-black mt-1">
                    {selectedProduct.producto || selectedProduct.codigo}
                  </h2>
                  <p className="text-white/70 mt-2">
                    Código: {selectedProduct.codigo}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {selectedProduct.mockupUrl ? (
                    <button
                      type="button"
                      onClick={() => setSelectedMockup(selectedProduct.mockupUrl)}
                      className="w-28 h-28 rounded-[28px] overflow-hidden border border-white/20 bg-white/10 shadow-lg hover:scale-105 transition shrink-0"
                      title="Ampliar mockup"
                    >
                      <Image
                        src={selectedProduct.mockupUrl}
                        alt={`Mockup ${selectedProduct.producto}`}
                        width={160}
                        height={160}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </button>
                  ) : (
                    <div className="w-28 h-28 rounded-[28px] border border-white/15 bg-white/10 text-white/60 flex items-center justify-center shrink-0">
                      <ImageIcon size={32} />
                    </div>
                  )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4">
                    <p className="text-xs text-white/50 uppercase tracking-wide">
                      Stock real
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {normalizeNumber(currentBalance)}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4">
                    <p className="text-xs text-white/50 uppercase tracking-wide">
                      Movimientos
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {movementRows.length}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4 col-span-2 sm:col-span-1">
                    <p className="text-xs text-white/50 uppercase tracking-wide">
                      Stock proyectado
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {normalizeNumber(calculatedBalance)}
                    </p>
                  </div>
                </div>
                </div>
              </div>
            </section>

            <form
              onSubmit={handleSaveMovement}
              className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden mb-6"
            >
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    {editingMovementId ? "Editando movimiento" : "Actualización rápida"}
                  </p>
                  <h2 className="text-2xl font-black mt-1">
                    {editingMovementId ? "Corregir movimiento" : "Registrar nuevo movimiento"}
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    El saldo se calcula igual que en Excel: saldo de la fila inferior + ingreso - salida.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {editingMovementId && (
                    <button
                      type="button"
                      onClick={cancelMovementEdit}
                      className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition"
                    >
                      Cancelar edición
                    </button>
                  )}

                {(can("proveedoresBodega", "crear") ||
                  can("proveedoresBodega", "editar")) && (
                  <button
                    type="submit"
                    disabled={savingMovement}
                    className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20 whitespace-nowrap"
                  >
                    {savingMovement ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Save size={20} />
                    )}
                    {savingMovement
                      ? "Guardando..."
                      : editingMovementId
                      ? "Actualizar movimiento"
                      : "Guardar movimiento"}
                  </button>
                )}
                </div>
              </div>

              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={normalizeText(movementForm.FECHA) || todayISO()}
                    max={todayISO()}
                    onChange={(e) => handleMovementChange("FECHA", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <div className="xl:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Operación
                  </label>
                  <div className="grid grid-cols-[1fr_1.2fr] gap-2">
                    <select
                      value={operationType}
                      onChange={(e) => {
                        const value = e.target.value;
                        setOperationType(value);
                        setOperationConsecutive("");
                        handleMovementChange("DESCRIPCION", value ? `${value}-` : "");
                        handleMovementChange("OBSERVACIONES", "");
                        if (value === "COMPRA" || value === "REINTEGRO") {
                          handleMovementChange("SALIDA", "");
                        }
                        if (value === "OP") {
                          handleMovementChange("INGRESO", "");
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    >
                      <option value="">Seleccionar</option>
                      <option value="COMPRA">COMPRA</option>
                      <option value="OP">OP</option>
                      <option value="REINTEGRO">REINTEGRO</option>
                      <option value="AJUSTE" disabled={!isMaster && !adjustmentApproved}>
                        AJUSTE {!isMaster && !adjustmentApproved ? "(bloqueado)" : ""}
                      </option>
                    </select>

                    {operationType === "OP" ? (
                      <select
                        value={operationConsecutive}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setOperationConsecutive(value);
                          handleMovementChange(
                            "DESCRIPCION",
                            value ? `OP-${value}` : "OP-"
                          );
                        }}
                        disabled={loadingOrdenesProduccion}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {loadingOrdenesProduccion
                            ? "Cargando órdenes..."
                            : ordenesProduccionOptions.length === 0
                              ? "No hay órdenes creadas"
                              : "Selecciona OP"}
                        </option>
                        {ordenesProduccionOptions.map((orden) => (
                          <option key={orden.id} value={orden.numero}>
                            {orden.numero}
                            {orden.cliente ? ` · ${orden.cliente}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={operationConsecutive}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setOperationConsecutive(value);
                          handleMovementChange(
                            "DESCRIPCION",
                            operationType ? `${operationType}-${value}` : value
                          );
                        }}
                        placeholder={operationType ? `${operationType}-001` : "001"}
                        disabled={!operationType}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    )}
                  </div>
                </div>

                <div className="xl:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Lote
                  </label>
                  {mustSelectExistingLot && lotOptions.length > 0 ? (
                    <select
                      value={normalizeText(movementForm.OBSERVACIONES)}
                      onChange={(e) =>
                        handleMovementChange("OBSERVACIONES", e.target.value.toUpperCase())
                      }
                      disabled={!operationType}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">Selecciona lote</option>
                      {lotOptions.map((lot) => (
                        <option key={lot.lote} value={lot.lote}>
                          {lot.lote} · saldo {normalizeNumber(lot.balance)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={normalizeText(movementForm.OBSERVACIONES)}
                      onChange={(e) =>
                        handleMovementChange("OBSERVACIONES", e.target.value.toUpperCase())
                      }
                      placeholder={canCreateLotFromMovement ? "Digita lote origen" : "FE658255"}
                      disabled={!operationType}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  )}
                  {mustSelectExistingLot && lotOptions.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Lotes cargados del más nuevo al más antiguo.
                    </p>
                  )}
                  {canCreateLotFromMovement && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Este producto aún no tiene lotes registrados. Puedes digitar el lote origen para crearlo con este primer movimiento.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Ingreso
                  </label>
                  <input
                    type="number"
                    value={normalizeText(movementForm.INGRESO)}
                    disabled={operationType === "OP" || (!isMaster && operationType === "AJUSTE" && !adjustmentApproved)}
                    onChange={(e) => handleMovementChange("INGRESO", e.target.value)}
                    placeholder="0"
                    className="w-full rounded-2xl border border-green-200 bg-green-50 px-4 py-3 outline-none focus:bg-white focus:border-green-600 focus:ring-2 focus:ring-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Salida
                  </label>
                  <input
                    type="number"
                    value={normalizeText(movementForm.SALIDA)}
                    disabled={operationType === "COMPRA" || operationType === "REINTEGRO" || (!isMaster && operationType === "AJUSTE" && !adjustmentApproved)}
                    onChange={(e) => handleMovementChange("SALIDA", e.target.value)}
                    placeholder="0"
                    className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 outline-none focus:bg-white focus:border-red-600 focus:ring-2 focus:ring-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="md:col-span-2 xl:col-span-7 rounded-3xl border border-[#244C5A]/15 bg-[#244C5A]/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-[#244C5A]">
                    <strong>Stock real calculado:</strong> {normalizeNumber(movementBaseBalance)} +{" "}
                    {normalizeNumber(movementForm.INGRESO || 0)} -{" "}
                    {normalizeNumber(movementForm.SALIDA || 0)}
                  </p>
                  <p className="text-2xl font-black text-[#244C5A]">
                    {normalizeNumber(calculatedBalance)}
                  </p>
                </div>
              </div>
            </form>

            <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    Tercera capa
                  </p>
                  <h2 className="text-2xl font-black mt-1">
                    Historial de movimientos
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    El historial se conserva hacia abajo; el nuevo movimiento se
                    gestiona arriba.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <div className="relative w-full lg:w-[380px]">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={19}
                    />
                    <input
                      type="text"
                      value={movementSearch}
                      onChange={(e) => setMovementSearch(e.target.value)}
                      placeholder="Buscar fecha, descripción, lote..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>

                  <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center">
                    {filteredMovements.length} movimientos
                  </div>
                </div>
              </div>

              {filteredMovements.length === 0 ? (
                <div className="p-8 text-center">
                  <PackageSearch className="mx-auto text-[#244C5A]" size={44} />
                  <h3 className="font-black text-slate-900 mt-4">
                    No hay movimientos para mostrar
                  </h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Registra el primer movimiento desde el formulario superior.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Fecha
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Operación
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Lote
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Ingreso
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Salida
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Stock real
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Stock reservado
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Stock disponible
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Stock esperado
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Acciones
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedMovements.map((item, index) => (
                        <tr
                          key={item.id}
                          className={`border-b border-slate-100 last:border-b-0 ${
                            movementPage === 1 && index === 0
                              ? "bg-[#244C5A]/5 hover:bg-[#244C5A]/10"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="px-5 py-4 text-sm text-slate-700">
                            {item.fecha || "—"}
                          </td>
                          <td className="px-5 py-4 text-sm font-bold text-slate-800">
                            {item.descripcion || "—"}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-700">
                            {item.observaciones || "—"}
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-black text-green-700">
                            {item.ingreso ? normalizeNumber(item.ingreso) : "—"}
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-black text-red-700">
                            {item.salida ? normalizeNumber(item.salida) : "—"}
                          </td>
                          <td className={`px-5 py-4 text-right text-sm font-black ${toNumber(item.saldo) < 0 ? "text-red-700" : "text-slate-900"}`}>
                            {normalizeNumber(item.saldo)}
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-black text-slate-700 bg-slate-50">
                            {item.stockReservado ? normalizeNumber(item.stockReservado) : "—"}
                          </td>
                          <td className={`px-5 py-4 text-right text-sm font-black ${toNumber(item.stockDisponible) < 0 ? "text-red-700" : "text-slate-900"}`}>
                            {normalizeNumber(toNumber(item.saldo) - toNumber(item.stockReservado))}
                          </td>
                          <td className={`px-5 py-4 text-right text-sm font-black ${toNumber(item.stockDisponible) < 0 ? "text-red-700" : "text-slate-900"}`}>
                            {normalizeNumber(toNumber(item.saldo) - toNumber(item.stockReservado))}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {can("proveedoresBodega", "editar") ? (
                              <button
                                type="button"
                                onClick={() => handleEditMovement(item)}
                                className="rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition"
                              >
                                Editar
                              </button>
                            ) : (
                              <span className="text-sm text-slate-400 font-semibold">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredMovements.length > 10 && (
                <div className="px-5 py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Página {movementPage} de {movementTotalPages}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={movementPage === 1}
                      onClick={() => setMovementPage((current) => Math.max(1, current - 1))}
                      className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>

                    <button
                      type="button"
                      disabled={movementPage === movementTotalPages}
                      onClick={() =>
                        setMovementPage((current) =>
                          Math.min(movementTotalPages, current + 1)
                        )
                      }
                      className="rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : selectedProvider ? (
          <>
            <section className="relative overflow-hidden rounded-[32px] bg-[#244C5A] text-white p-6 sm:p-8 shadow-xl mb-6">
              <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-white/10" />
              <div className="absolute right-24 bottom-[-80px] w-56 h-56 rounded-full bg-white/10" />

              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <button
                    type="button"
                    onClick={handleBackToProviders}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2 text-sm font-bold transition mb-5"
                  >
                    <ArrowLeft size={17} />
                    Volver a proveedores
                  </button>

                  <p className="text-sm text-white/65 uppercase tracking-wide font-bold">
                    {selectedProvider.codigo}
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-black mt-1">
                    {selectedProvider.nombre}
                  </h2>
                  <p className="text-white/70 mt-2 max-w-3xl">
                    {selectedProvider.datos.DIRECCION || "Sin dirección registrada"}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4">
                    <p className="text-xs text-white/50 uppercase tracking-wide">
                      Productos
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {products.length}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4">
                    <p className="text-xs text-white/50 uppercase tracking-wide">
                      Stock total
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {normalizeNumber(totalStock)}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4 col-span-2 sm:col-span-1">
                    <p className="text-xs text-white/50 uppercase tracking-wide">
                      Valor inventario
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {normalizeMoney(totalValorInventario)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    Segunda capa
                  </p>
                  <h2 className="text-2xl font-black mt-1">Productos</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Haz clic en cualquier parte de la fila del producto para ver sus movimientos.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <div className="relative w-full lg:w-[380px]">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={19}
                    />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar producto, código, hoja..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>

                  <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center">
                    {filteredProducts.length} productos
                  </div>
                </div>
              </div>


              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center">
                  <PackageSearch className="mx-auto text-[#244C5A]" size={44} />
                  <h3 className="font-black text-slate-900 mt-4">
                    No hay productos para mostrar
                  </h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Este proveedor todavía no tiene productos o cambia el filtro.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1380px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Código
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Producto
                        </th>
                        <th className="text-center px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Mockup
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Unidad de empaque
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Costo
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Stock real
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Stock reservado
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Stock disponible
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Stock esperado
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Semáforo
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredProducts.map((item) => {
                        const latestStock = getLatestProductStock({ DATOS_PRODUCTO: item.datos, MOVIMIENTOS: item.movimientosRaw || {} });
                        const semaphore = productSemaphoreMap.get(item.codigo);
                        const disponibleStatus = semaphore?.disponibleStatus || "ok";
                        const teoricoStatus = semaphore?.teoricoStatus || "ok";
                        const worstStatus = getWorstStatus([disponibleStatus, teoricoStatus]);

                        return (
                        <tr
                          key={item.id}
                          onClick={() => handleOpenProduct(item)}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer"
                          title="Ver movimientos"
                        >
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-2 rounded-full bg-[#244C5A]/10 text-[#244C5A] px-3 py-1 text-xs font-black">
                              <Boxes size={15} />
                              {item.codigo}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-black text-slate-900">
                              {item.producto || "Sin nombre de producto"}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-center">
                            {item.mockupUrl ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMockup(item.mockupUrl);
                                }}
                                className="mx-auto w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:scale-105 transition"
                                title="Ampliar mockup"
                              >
                                <Image
                                  src={item.mockupUrl}
                                  alt={`Mockup ${item.producto}`}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                />
                              </button>
                            ) : (
                              <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 text-slate-400">
                                <ImageIcon size={20} />
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700">
                            {normalizeText(item.unidadEmpaque) || "—"}
                          </td>

                          <td className="px-5 py-4 text-sm font-bold text-slate-800">
                            {normalizeMoney(item.costo)}
                          </td>

                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${toNumber(latestStock.stockReal) < 0 ? "bg-red-100 text-red-700 border-red-200" : "bg-slate-100 text-slate-700 border-slate-200"}`}>
                              {normalizeNumber(latestStock.stockReal)}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-black">
                              {normalizeNumber(latestStock.stockReservado)}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${getStatusClasses(disponibleStatus)}`}>
                              {normalizeNumber(semaphore?.stockDisponible ?? latestStock.stockDisponible)}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${getStatusClasses(teoricoStatus)}`}>
                              {normalizeNumber(semaphore?.stockTeorico ?? latestStock.stockTeorico)}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-black ${getStatusClasses(worstStatus)}`}>
                                {worstStatus === "ok"
                                  ? "OK"
                                  : worstStatus === "warning"
                                  ? "Bajo"
                                  : worstStatus === "zero"
                                  ? "Cero"
                                  : "Negativo"}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const currentConfig = getProductSemaforoConfig(
                                    semaforoConfigs,
                                    selectedProvider.codigoNodo,
                                    item.codigo
                                  );
                                  setSelectedSemaforoProduct(item);
                                  setSemaforoForm(currentConfig);
                                  setSemaforoModalOpen(true);
                                }}
                                className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#244C5A]/20 bg-[#244C5A]/5 px-3 py-1.5 text-xs font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition"
                              >
                                <Settings size={14} />
                                Configurar
                              </button>
                            </div>
                          </td>

                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 mt-6 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    Nodo PROVEEDORES
                  </p>
                  <h2 className="text-2xl font-black mt-1">Lista de proveedores</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Haz clic en cualquier parte de la fila del proveedor para ver sus productos.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <div className="relative w-full lg:w-[360px]">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={19}
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar proveedor, código, NIT..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>

                  <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center">
                    {filteredProviders.length} proveedores
                  </div>

                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 text-center min-w-[220px]">
                    <p className="text-[11px] uppercase tracking-wide font-black text-emerald-600/80">Valor total inventario</p>
                    <p className="text-lg font-black leading-tight">{normalizeMoney(totalValorInventarioGeneral)}</p>
                  </div>
                </div>
              </div>

              {loadingProviders ? (
                <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
                  <Loader2 className="animate-spin" size={22} />
                  Cargando proveedores...
                </div>
              ) : filteredProviders.length === 0 ? (
                <div className="p-8 text-center">
                  <Truck className="mx-auto text-[#244C5A]" size={44} />
                  <h3 className="font-black text-slate-900 mt-4">
                    No hay proveedores para mostrar
                  </h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Crea un proveedor o cambia el texto de búsqueda.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Código
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Proveedor
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Productos
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          NIT
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Dirección
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Teléfono
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredProviders.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => handleOpenProvider(item)}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer"
                          title="Ver productos"
                        >
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center rounded-full bg-[#244C5A]/10 text-[#244C5A] px-3 py-1 text-xs font-black">
                              {item.codigo}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-black text-[#244C5A] inline-flex items-center gap-2">
                              <Building2 size={18} />
                              {item.nombre}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-black">
                              {Object.keys(item.productosRaw || {}).length}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700">
                            {normalizeText(item.datos.NIT) || "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700 max-w-[320px]">
                            <span className="line-clamp-2">
                              {normalizeText(item.datos.DIRECCION) || "—"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700">
                            {normalizeText(item.datos.TELEFONO) || "—"}
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>

      {semaforoModalOpen && (
        <div className="fixed inset-0 z-[65] bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-[32px] bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-[#244C5A]">Semaforización</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">Configurar alerta del producto</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedSemaforoProduct?.producto || "Producto seleccionado"}. Por defecto alerta cuando falten 10, cuando llegue a 0 o cuando sea negativo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSemaforoModalOpen(false); setSelectedSemaforoProduct(null); }}
                className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0"
                aria-label="Cerrar semaforización"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">
                    Stock disponible: alertar cuando falten
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={semaforoForm.stockDisponibleMinimo}
                    onChange={(e) =>
                      setSemaforoForm((current) => ({
                        ...current,
                        stockDisponibleMinimo: toNumber(e.target.value),
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-black outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                  <p className="mt-2 text-xs text-slate-500">Ejemplo: 10 unidades.</p>
                </div>

                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">
                    Stock esperado: alertar cuando falten
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={semaforoForm.stockTeoricoMinimo}
                    onChange={(e) =>
                      setSemaforoForm((current) => ({
                        ...current,
                        stockTeoricoMinimo: toNumber(e.target.value),
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-black outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                  <p className="mt-2 text-xs text-slate-500">También alerta si llega a 0 o negativo.</p>
                </div>
              </div>

              <div className="rounded-3xl border border-[#244C5A]/15 bg-[#244C5A]/5 p-4 text-sm text-[#244C5A]">
                <strong>Reglas del producto:</strong> disponible ≤ {normalizeNumber(semaforoForm.stockDisponibleMinimo)} y esperado ≤ {normalizeNumber(semaforoForm.stockTeoricoMinimo)}.
              </div>
            </div>

            <div className="px-6 py-5 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => { setSemaforoModalOpen(false); setSelectedSemaforoProduct(null); }}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSemaforizacion}
                disabled={savingSemaforo}
                className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20"
              >
                {savingSemaforo ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Guardar configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-[520px] rounded-[32px] bg-white shadow-2xl border border-red-100 overflow-hidden">
            <div className="bg-red-50 px-6 py-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={26} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-red-600">
                  Atención
                </p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Revisa este movimiento
                </h3>
              </div>
            </div>

            <div className="px-6 py-5">
              <p className="text-base leading-relaxed text-slate-700 font-semibold">
                {error}
              </p>
            </div>

            <div className="px-6 pb-6 flex justify-end">
              <button
                type="button"
                onClick={() => setError("")}
                className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] text-white font-black px-6 py-3 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedMockup && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-3xl rounded-[32px] bg-white p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedMockup("")}
              className="absolute right-4 top-4 z-10 w-11 h-11 rounded-2xl bg-slate-900/80 text-white hover:bg-slate-900 flex items-center justify-center"
              aria-label="Cerrar mockup"
            >
              <X size={22} />
            </button>
            <Image
              src={selectedMockup}
              alt="Mockup ampliado"
              width={1000}
              height={700}
              className="w-full max-h-[78vh] object-contain rounded-[24px] bg-slate-100"
              unoptimized
            />
          </div>
        </div>
      )}

      </main>
    </>
  );
}


function AppSidebar({
  sidebarOpen,
  sidebarCollapsed,
  setSidebarOpen,
  setSidebarCollapsed,
  openSections,
  toggleSection,
  userName,
  email,
  roleName,
  onLogout,
  activeHref,
}: {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  setSidebarOpen: (value: boolean) => void;
  setSidebarCollapsed: (value: boolean | ((current: boolean) => boolean)) => void;
  openSections: Record<string, boolean>;
  toggleSection: (sectionTitle: string) => void;
  userName: string;
  email: string;
  roleName: string;
  onLogout: () => void;
  activeHref: string;
}) {
  return (
    <aside
      className={`fixed z-50 inset-y-0 left-0 ${
        sidebarCollapsed ? "lg:w-[88px]" : "lg:w-[300px]"
      } w-[300px] bg-[#244C5A] text-white transform transition-all duration-300 lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="h-full flex flex-col">
        <div className={`px-4 pt-6 pb-5 border-b border-white/10 flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center justify-center min-h-[56px]">
            <Image src="/logo.png" alt="Nuall" width={sidebarCollapsed ? 48 : 145} height={70} priority className="object-contain" />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="hidden lg:flex w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 items-center justify-center"
              aria-label="Encoger o ampliar menú"
            >
              {sidebarCollapsed ? <PanelLeftOpen size={21} /> : <PanelLeftClose size={21} />}
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center"
              aria-label="Cerrar menú"
            >
              <X size={21} />
            </button>
          </div>
        </div>

        {!sidebarCollapsed && (
          <div className="px-6 py-5">
            <div className="rounded-3xl bg-white border border-white p-4 text-[#244C5A] shadow-sm">
              <p className="text-xs uppercase tracking-wider font-black text-[#244C5A]/70">Sesión activa</p>
              <p className="font-black mt-1 truncate">{userName}</p>
              <p className="text-xs text-[#244C5A]/70 truncate mt-1">{email}</p>
              <p className="text-xs text-[#244C5A]/70 truncate mt-1">Rol: {roleName}</p>
            </div>
          </div>
        )}

        <nav className="px-4 flex-1 space-y-2 overflow-y-auto pb-4">
          <Link
            href="/panel"
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-white text-[#244C5A] font-bold shadow-lg ${sidebarCollapsed ? "justify-center" : ""}`}
            onClick={() => setSidebarOpen(false)}
            title="Panel Principal"
          >
            <LayoutDashboard size={20} />
            {!sidebarCollapsed && <span>Panel Principal</span>}
          </Link>

          {sidebarMenuSections.map((section) => {
            const SectionIcon = section.icon;
            const sectionHasActive = section.items.some((item) => item.href === activeHref);
            const isOpen = openSections[section.title] ?? sectionHasActive;

            return (
              <div key={section.title} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-white/90 hover:bg-white/10 hover:text-white transition ${sidebarCollapsed ? "justify-center" : ""}`}
                  title={section.title}
                >
                  <span className={`flex items-center gap-3 font-bold ${sidebarCollapsed ? "justify-center" : ""}`}>
                    <SectionIcon size={20} />
                    {!sidebarCollapsed && section.title}
                  </span>
                  {!sidebarCollapsed && <ChevronDown size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />}
                </button>

                {!sidebarCollapsed && isOpen && (
                  <div className="ml-4 pl-3 border-l border-white/15 space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = item.href === activeHref;
                      return (
                        <Link
                          key={item.title}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition ${
                            active
                              ? "bg-white text-[#244C5A] font-black shadow-sm"
                              : "text-white/75 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <Icon size={18} /> {item.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={onLogout}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 font-semibold transition ${sidebarCollapsed ? "px-0" : ""}`}
            title="Cerrar sesión"
          >
            <LogOut size={19} /> {!sidebarCollapsed && "Cerrar sesión"}
          </button>
        </div>
      </div>
    </aside>
  );
}
