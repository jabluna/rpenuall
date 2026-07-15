"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Eye,
  FileText,
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  Upload,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { get, onValue, ref, set, update } from "firebase/database";
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { auth, dbRealtime } from "@/lib/firebase";
import { useUserPermissions } from "@/lib/useUserPermissions";

type MenuItem = {
  title: string;
  icon: any;
  href: string;
};

type MenuSection = {
  title: string;
  icon: any;
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
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
    icon: ClipboardList,
    items: [
      {
        title: "Crear / ver clientes",
        icon: UserPlus,
        href: "/panel/clientes",
      },
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
    icon: ClipboardList,
    items: [
      {
        title: "Ver órdenes de pedido",
        icon: Eye,
        href: "/panel/ordenes_creadas",
      },
      {
        title: "Producción x Planta",
        icon: ClipboardList,
        href: "/panel/produccionxplanta",
      },
    ],
  },
  {
    title: "Compras",
    icon: ShoppingCart,
    items: [
      { title: "Crear órdenes de compra", icon: Plus, href: "/panel/compras2" },
      {
        title: "Ver órdenes de compra",
        icon: Eye,
        href: "/panel/gestion-compras2",
      },
      { title: "Crear proveedor", icon: Truck, href: "/panel/crear-proveedor" },
    ],
  },
  {
    title: "Etiquetas",
    icon: Tags,
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

type EstadoGestion =
  | "sin_verificar"
  | "aceptado"
  | "diferente"
  | "rechazado"
  | "solicitado"
  | "sin_solicitar";

type CompraDetalleItem = {
  id?: string;
  clienteCodigo?: string;
  clienteNombre?: string;
  codigoProducto?: string;
  producto?: string;
  codigoEnvase?: string;
  descripcion?: string;
  proveedor?: string;
  unidadEmpaque?: string;
  tipoEmpaque?: string;
  cajasPacas?: string | number;
  total?: string | number;
  stock?: string | number;
};

type CompraGuardada = {
  id: string;
  consecutivo?: string;
  fecha?: string;
  items?: CompraDetalleItem[];
  estado?: "en_proceso" | "completado" | "anulada";
  evidenciaUrl?: string;
  evidenciaNombre?: string;
  evidenciaPor?: string;
  evidenciaPorEmail?: string | null;
  evidenciaAt?: string;
  creadoPor?: string;
  creadoAt?: string;
  actualizadoAt?: string;
  anuladaPor?: string;
  anuladaAt?: string;
};

type ArchivoGestion = {
  nombre: string;
  url: string;
  tipo: string;
  subidoPor: string;
  subidoPorUid?: string | null;
  subidoPorEmail?: string | null;
  fecha: string;
};

type EstadoMeta = {
  estado: EstadoGestion;
  usuario: string;
  uid?: string | null;
  email?: string | null;
  fecha: string;
  motivo?: string;
};

type EstadoPorItem = {
  estado: EstadoGestion;
  meta?: EstadoMeta;
  historialRechazos?: EstadoMeta[];
  archivo?: ArchivoGestion;
};

type GestionCompra = {
  compraId: string;
  fechaGestion?: string;
  facturaCompra?: ArchivoGestion;
  facturaCompraAccion?: EstadoMeta;
  estados?: Record<string, Record<string, EstadoPorItem>>;
  actualizadoAt?: string;
};

type RechazoModal = {
  compraId: string;
  itemKey: string;
  procesoKey: string;
  procesoTitulo: string;
  itemTitulo: string;
  motivo: string;
};

type HistorialModal = {
  titulo: string;
  historial: EstadoMeta[];
};

type ProcesoGestion = {
  key: string;
  titulo: string;
  tipoPago?: boolean;
  permiteArchivo?: boolean;
};

const procesosGenerales: ProcesoGestion[] = [
  { key: "factura", titulo: "Verificación de factura" },
  { key: "solicitar_pago", titulo: "Solicitar pago", tipoPago: true },
  {
    key: "comprobante_pago",
    titulo: "Comprobante de pago",
    permiteArchivo: true,
  },
  { key: "contabilizacion_factura", titulo: "Contabilización de factura" },
];

const procesosProducto: ProcesoGestion[] = [
  { key: "recepcion_mercancia", titulo: "Recepción de mercancía" },
];

const procesos: ProcesoGestion[] = [...procesosGenerales, ...procesosProducto];

const hoy = () => new Date().toISOString().split("T")[0];

function formatoFechaHora(value?: string) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function estadoInicial(): EstadoPorItem {
  return { estado: "sin_verificar", historialRechazos: [] };
}

function mostrarEstado(estado?: EstadoGestion) {
  if (estado === "aceptado") return "Aceptado";
  if (estado === "diferente") return "Diferente";
  if (estado === "rechazado") return "Rechazado";
  if (estado === "solicitado") return "Solicitado";
  if (estado === "sin_solicitar") return "Sin solicitar";
  return "Sin verificar";
}

function estadoClass(estado?: EstadoGestion) {
  if (estado === "aceptado" || estado === "solicitado")
    return "bg-green-50 text-green-700 border-green-200";
  if (estado === "diferente") return "bg-orange-50 text-orange-700 border-orange-200";
  if (estado === "rechazado") return "bg-red-50 text-red-700 border-red-200";
  if (estado === "sin_solicitar")
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function safeKey(value: unknown) {
  return String(value || "item")
    .trim()
    .replace(/[.#$\[\]/]/g, "_")
    .replace(/\s+/g, "_");
}

function itemKey(item: CompraDetalleItem, index: number) {
  return `${safeKey(item.codigoEnvase || item.codigoProducto)}_${index}`;
}

function nombreItem(item: CompraDetalleItem) {
  return `${item.codigoEnvase || item.codigoProducto || "Sin código"} · ${item.descripcion || item.producto || "Sin descripción"}`;
}


type MovimientoBodega = {
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

type RecepcionModal = {
  compra: CompraGuardada;
  item: CompraDetalleItem;
  itemId: string;
  providerCode: string;
  providerName: string;
  productCode: string;
  productName: string;
  productPath: string;
  movimientosRaw: Record<string, MovimientoBodega>;
  fecha: string;
  lote: string;
  ingreso: string;
  rechazoMotivo?: string;
  confirmandoRechazo?: boolean;
};

function normalizeText(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const clean = String(value).trim().replace(/\s/g, "").replace(/,/g, ".");
  const numberValue = Number(clean);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function parseDateValue(value: unknown) {
  const clean = normalizeText(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return new Date(`${clean}T00:00:00`).getTime();
  const parsed = Date.parse(clean);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getMovementNumericId(id: string) {
  const value = Number(id.replace(/\D/g, ""));
  return Number.isNaN(value) ? 0 : value;
}

function getMovementOrderValue(id: string, value: MovimientoBodega) {
  return {
    fechaOrder:
      typeof value.ORDEN_FECHA === "number" && value.ORDEN_FECHA > 0
        ? value.ORDEN_FECHA
        : parseDateValue(value.FECHA),
    createdAt:
      typeof value.CREATED_AT === "number" && value.CREATED_AT > 0
        ? value.CREATED_AT
        : getMovementNumericId(id),
    movNumber: getMovementNumericId(id),
  };
}

function sortMovementEntriesAsc(movimientosRaw?: Record<string, MovimientoBodega>) {
  return Object.entries(movimientosRaw || {}).sort(([idA, valueA], [idB, valueB]) => {
    const orderA = getMovementOrderValue(idA, valueA || {});
    const orderB = getMovementOrderValue(idB, valueB || {});
    if (orderA.fechaOrder !== orderB.fechaOrder) return orderA.fechaOrder - orderB.fechaOrder;
    if (orderA.createdAt !== orderB.createdAt) return orderA.createdAt - orderB.createdAt;
    return orderA.movNumber - orderB.movNumber;
  });
}

function sortMovementEntriesDesc(movimientosRaw?: Record<string, MovimientoBodega>) {
  return [...sortMovementEntriesAsc(movimientosRaw)].reverse();
}

function nextMovementKey(movimientosRaw?: Record<string, MovimientoBodega>) {
  const usedNumbers = Object.keys(movimientosRaw || {})
    .map((key) => Number(key.replace(/\D/g, "")))
    .filter((value) => !Number.isNaN(value));
  const nextNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
  return `MOV-${String(nextNumber).padStart(3, "0")}`;
}

function getLatestStockFromMovements(movimientosRaw?: Record<string, MovimientoBodega>, stockFallback?: unknown) {
  const latest = sortMovementEntriesDesc(movimientosRaw)[0]?.[1];
  const stockReal = latest ? toNumber(latest.SALDO) : toNumber(stockFallback);
  const stockReservado = latest ? toNumber(latest.STOCK_RESERVADO) : 0;
  const stockDisponible = stockReal - stockReservado;
  return { stockReal, stockReservado, stockDisponible, stockEsperado: stockDisponible };
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("es-CO").format(toNumber(value));
}

export default function GestionComprasBodegaPage() {
  const router = useRouter();
  const storage = getStorage();
  const {
    authUser,
    profile,
    loading: loadingPermissions,
  } = useUserPermissions();

  const [compras, setCompras] = useState<CompraGuardada[]>([]);
  const [gestion, setGestion] = useState<Record<string, GestionCompra>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rechazoModal, setRechazoModal] = useState<RechazoModal | null>(null);
  const [historialModal, setHistorialModal] = useState<HistorialModal | null>(
    null,
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [recepcionModal, setRecepcionModal] = useState<RecepcionModal | null>(null);
  const [loadingRecepcion, setLoadingRecepcion] = useState(false);
  const [savingRecepcion, setSavingRecepcion] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const userName = useMemo(() => {
    return (
      profile?.nombre ||
      authUser?.displayName ||
      authUser?.email?.split("@")[0] ||
      "Usuario"
    );
  }, [profile, authUser]);

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((current) => ({
      ...current,
      [sectionTitle]: !current[sectionTitle],
    }));
    if (sidebarCollapsed) setSidebarCollapsed(false);
  };

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

  useEffect(() => {
    if (!loadingPermissions && !authUser) router.replace("/");
  }, [loadingPermissions, authUser, router]);

  useEffect(() => {
    setLoading(true);
    setError("");

    const comprasRef = ref(dbRealtime, "COMPRAS_BODEGA");
    const gestionRef = ref(dbRealtime, "GESTION_COMPRAS_BODEGA");

    const unsubscribeCompras = onValue(
      comprasRef,
      (snap) => {
        const comprasData = snap.exists() ? snap.val() : {};
        const lista = Object.entries(comprasData || {}).map(
          ([id, value]: any) => ({
            id,
            ...value,
            // Compatibilidad con la página nueva de crear compras:
            // allí los productos se guardan como itemsCompra.
            items: value?.items || value?.itemsCompra || [],
            evidenciaUrl:
              value?.evidenciaUrl || value?.evidenciaCompra?.url || "",
            evidenciaNombre:
              value?.evidenciaNombre || value?.evidenciaCompra?.nombre || "",
          }),
        ) as CompraGuardada[];

        lista.sort(
          (a, b) =>
            new Date(b.creadoAt || b.actualizadoAt || b.fecha || "").getTime() -
            new Date(a.creadoAt || a.actualizadoAt || a.fecha || "").getTime(),
        );

        setCompras(lista);
        setLoading(false);
      },
      (err) => {
        setError(
          `No fue posible escuchar compras en tiempo real. ${err?.message || ""}`,
        );
        setLoading(false);
      },
    );

    const unsubscribeGestion = onValue(
      gestionRef,
      (snap) => {
        setGestion(snap.exists() ? snap.val() : {});
      },
      (err) => {
        setError(
          `No fue posible escuchar gestión en tiempo real. ${err?.message || ""}`,
        );
      },
    );

    return () => {
      unsubscribeCompras();
      unsubscribeGestion();
    };
  }, []);

  const crearMeta = (estado: EstadoGestion, motivo?: string): EstadoMeta => ({
    estado,
    usuario: userName,
    uid: authUser?.uid || null,
    email: authUser?.email || null,
    fecha: new Date().toISOString(),
    ...(motivo ? { motivo } : {}),
  });

  const cargarDatos = async () => {
    // La pantalla ahora se actualiza automáticamente con onValue().
    // Esta función queda como compatibilidad para llamadas antiguas.
  };

  const obtenerGestionCompra = (compraId: string): GestionCompra => {
    return gestion[compraId] || { compraId, fechaGestion: hoy(), estados: {} };
  };

  const obtenerFacturaCompra = (compra: CompraGuardada) => {
    const gestionCompra = obtenerGestionCompra(compra.id);
    return (
      gestionCompra.facturaCompra ||
      (compra.evidenciaUrl
        ? {
            nombre: compra.evidenciaNombre || "Evidencia de compra",
            url: compra.evidenciaUrl,
            tipo: "archivo",
            subidoPor: compra.evidenciaPor || compra.creadoPor || "Usuario",
            subidoPorUid: null,
            subidoPorEmail: compra.evidenciaPorEmail || null,
            fecha: compra.evidenciaAt || compra.creadoAt || "",
          }
        : null)
    );
  };

  const obtenerEstado = (
    compraId: string,
    itemId: string,
    procesoKey: string,
  ): EstadoPorItem => {
    return (
      obtenerGestionCompra(compraId).estados?.[itemId]?.[procesoKey] ||
      estadoInicial()
    );
  };

  const actualizarEstadoLocal = (
    compraId: string,
    itemId: string,
    procesoKey: string,
    nuevoEstado: EstadoGestion,
    motivo?: string,
  ) => {
    const meta =
      nuevoEstado === "sin_verificar"
        ? undefined
        : crearMeta(nuevoEstado, motivo);

    setGestion((current) => {
      const compraGestion = current[compraId] || {
        compraId,
        fechaGestion: hoy(),
        estados: {},
      };
      const estadosCompra = compraGestion.estados || {};
      const estadosItem = estadosCompra[itemId] || {};
      const estadoAnterior = estadosItem[procesoKey] || estadoInicial();
      const historialAnterior = estadoAnterior.historialRechazos || [];
      const historialRechazos =
        nuevoEstado === "rechazado" && meta
          ? [...historialAnterior, meta]
          : historialAnterior;

      const nextGestion = {
        ...current,
        [compraId]: {
          ...compraGestion,
          fechaGestion: compraGestion.fechaGestion || hoy(),
          actualizadoAt: new Date().toISOString(),
          estados: {
            ...estadosCompra,
            [itemId]: {
              ...estadosItem,
              [procesoKey]: {
                ...estadoAnterior,
                estado: nuevoEstado,
                meta,
                historialRechazos,
              },
            },
          },
        },
      };

      guardarGestionAutomatica(nextGestion);
      setMessage("Gestión actualizada automáticamente.");
      return nextGestion;
    });
  };

  const solicitarEstado = (
    compraId: string,
    itemId: string,
    procesoKey: string,
    procesoTitulo: string,
    itemTitulo: string,
    estado: EstadoGestion,
  ) => {
    setError("");
    setMessage("");

    if (estado === "rechazado") {
      setRechazoModal({
        compraId,
        itemKey: itemId,
        procesoKey,
        procesoTitulo,
        itemTitulo,
        motivo: "",
      });
      return;
    }

    actualizarEstadoLocal(compraId, itemId, procesoKey, estado);
  };

  const confirmarRechazo = () => {
    if (!rechazoModal) return;
    if (!rechazoModal.motivo.trim()) {
      setError("Describe el motivo del rechazo.");
      return;
    }

    actualizarEstadoLocal(
      rechazoModal.compraId,
      rechazoModal.itemKey,
      rechazoModal.procesoKey,
      "rechazado",
      rechazoModal.motivo.trim(),
    );
    setRechazoModal(null);
    setError("");
  };

  const subirArchivo = async (
    compraId: string,
    tipo: "factura_compra_bodega" | "comprobante_pago",
    file: File,
    itemId?: string,
  ) => {
    setError("");
    setMessage("");
    const uploadId = `${compraId}-${tipo}-${itemId || "general"}`;
    setUploadingKey(uploadId);

    try {
      const path = `gestion-compras-bodega/${compraId}/${tipo}/${itemId || "general"}-${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      const archivo: ArchivoGestion = {
        nombre: file.name,
        url,
        tipo: file.type,
        subidoPor: userName,
        subidoPorUid: authUser?.uid || null,
        subidoPorEmail: authUser?.email || null,
        fecha: new Date().toISOString(),
      };

      setGestion((current) => {
        const compraGestion = current[compraId] || {
          compraId,
          fechaGestion: hoy(),
          estados: {},
        };

        if (tipo === "factura_compra_bodega") {
          const nextGestion = {
            ...current,
            [compraId]: {
              ...compraGestion,
              fechaGestion: compraGestion.fechaGestion || hoy(),
              facturaCompra: archivo,
              facturaCompraAccion: crearMeta("aceptado"),
              actualizadoAt: new Date().toISOString(),
            },
          };
          guardarGestionAutomatica(nextGestion);
          return nextGestion;
        }

        const item = itemId || "general";
        const estadosCompra = compraGestion.estados || {};
        const estadosItem = estadosCompra[item] || {};
        const estadoAnterior = estadosItem.comprobante_pago || estadoInicial();

        const nextGestion = {
          ...current,
          [compraId]: {
            ...compraGestion,
            fechaGestion: compraGestion.fechaGestion || hoy(),
            actualizadoAt: new Date().toISOString(),
            estados: {
              ...estadosCompra,
              [item]: {
                ...estadosItem,
                comprobante_pago: {
                  ...estadoAnterior,
                  archivo,
                },
              },
            },
          },
        };
        guardarGestionAutomatica(nextGestion);
        return nextGestion;
      });

      setMessage("Archivo cargado y gestión actualizada automáticamente.");
    } catch (err: any) {
      setError(`No fue posible subir el archivo. ${err?.message || ""}`);
    } finally {
      setUploadingKey("");
    }
  };

  const guardarGestionAutomatica = async (
    gestionActualizada: Record<string, GestionCompra>,
  ) => {
    try {
      await set(ref(dbRealtime, "GESTION_COMPRAS_BODEGA"), gestionActualizada);
    } catch (err: any) {
      setError(
        `No fue posible guardar automáticamente la gestión. ${err?.message || ""}`,
      );
    }
  };

  const registrarAlertaRecepcionCompra = async (
    compra: CompraGuardada,
    item: CompraDetalleItem,
    estado: "diferente" | "rechazado",
    detalle: Record<string, any>,
  ) => {
    const alertaKey = safeKey(`${compra.id}_${item.codigoEnvase || item.codigoProducto || "item"}_${estado}`);
    await set(ref(dbRealtime, `ALERTAS_COMPRAS/RECEPCION_MERCANCIA/${alertaKey}`), {
      activo: true,
      tipo: estado === "diferente" ? "RECEPCION_DIFERENTE" : "RECEPCION_RECHAZADA",
      estado,
      compraId: compra.id,
      consecutivo: compra.consecutivo || "",
      codigoProducto: item.codigoEnvase || item.codigoProducto || "",
      producto: item.descripcion || item.producto || "",
      proveedor: item.proveedor || "",
      ...detalle,
      createdAt: new Date().toISOString(),
      createdBy: userName,
      createdByUid: authUser?.uid || null,
      createdByEmail: authUser?.email || null,
    });
  };

  const comprasFiltradas = useMemo(() => {
    return compras.filter((compra) => compra.estado !== "anulada");
  }, [compras]);

  const comprasPaginadas = useMemo(() => {
    return comprasFiltradas.slice((pagina - 1) * porPagina, pagina * porPagina);
  }, [comprasFiltradas, pagina, porPagina]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(comprasFiltradas.length / porPagina),
  );

  const resumenEstadosCompra = (compra: CompraGuardada) => {
    const items = compra.items || [];
    const total = procesosGenerales.length + items.length * procesosProducto.length;
    let aceptados = 0;
    let rechazados = 0;

    procesosGenerales.forEach((proceso) => {
      const estado = obtenerEstado(compra.id, "__orden__", proceso.key).estado;
      if (estado === "aceptado" || estado === "solicitado") aceptados += 1;
      if (estado === "rechazado" || estado === "diferente") rechazados += 1;
    });

    items.forEach((item, index) => {
      const key = itemKey(item, index);
      procesosProducto.forEach((proceso) => {
        const estado = obtenerEstado(compra.id, key, proceso.key).estado;
        if (estado === "aceptado" || estado === "solicitado") aceptados += 1;
        if (estado === "rechazado" || estado === "diferente") rechazados += 1;
      });
    });

    return { total, aceptados, rechazados };
  };

  const abrirModalRecepcion = async (
    compra: CompraGuardada,
    item: CompraDetalleItem,
    itemId: string,
  ) => {
    setError("");
    setMessage("");
    setLoadingRecepcion(true);

    try {
      const codigoProducto = normalizeText(item.codigoEnvase || item.codigoProducto).trim().toUpperCase();
      const proveedorItem = normalizeText(item.proveedor).trim().toUpperCase();

      if (!codigoProducto) {
        throw new Error("El producto no tiene código para buscarlo en bodega.");
      }

      const snapshot = await get(ref(dbRealtime, "PROVEEDORES"));
      const proveedoresRaw = snapshot.exists() ? snapshot.val() || {} : {};
      let encontrado: RecepcionModal | null = null;

      Object.entries(proveedoresRaw).some(([providerCode, providerNode]: any) => {
        return Object.entries(providerNode || {}).some(([providerName, providerContent]: any) => {
          const datosProveedor = providerContent?.DATOS || {};
          const nombreProveedor = normalizeText(datosProveedor.PROVEEDOR || providerName).trim().toUpperCase();
          const coincideProveedor =
            !proveedorItem ||
            nombreProveedor === proveedorItem ||
            normalizeText(providerName).trim().toUpperCase() === proveedorItem;

          if (!coincideProveedor) return false;

          return Object.entries(providerContent?.PRODUCTOS || {}).some(([productKey, productNode]: any) => {
            const datosProducto = productNode?.DATOS_PRODUCTO || {};
            const codigoBodega = normalizeText(datosProducto.CODIGO || productKey).trim().toUpperCase();

            if (codigoBodega !== codigoProducto && normalizeText(productKey).trim().toUpperCase() !== codigoProducto) {
              return false;
            }

            encontrado = {
              compra,
              item,
              itemId,
              providerCode: normalizeText(providerCode),
              providerName: normalizeText(providerName),
              productCode: codigoBodega || codigoProducto,
              productName: normalizeText(datosProducto.PRODUCTO || item.descripcion || item.producto),
              productPath: `PROVEEDORES/${providerCode}/${providerName}/PRODUCTOS/${productKey}`,
              movimientosRaw: productNode?.MOVIMIENTOS || {},
              fecha: todayISO(),
              lote: "",
              ingreso: normalizeText(item.total || ""),
            };

            return true;
          });
        });
      });

      if (!encontrado) {
        throw new Error(`No encontré el producto ${codigoProducto} del proveedor ${proveedorItem || "indicado"} en PROVEEDORES.`);
      }

      setRecepcionModal(encontrado);
    } catch (err: any) {
      setError(`No fue posible abrir la recepción de mercancía. ${err?.message || ""}`);
    } finally {
      setLoadingRecepcion(false);
    }
  };

  const guardarRecepcionMercancia = async () => {
    if (!recepcionModal) return;

    setError("");
    setMessage("");

    const fecha = recepcionModal.fecha || todayISO();
    const lote = recepcionModal.lote.trim().toUpperCase();
    const ingreso = toNumber(recepcionModal.ingreso);
    const cantidadOrdenada = toNumber(recepcionModal.item.total);

    if (!lote) {
      setError("Digita el lote recibido para registrar la entrada.");
      return;
    }

    if (ingreso <= 0) {
      setError("Digita una cantidad de ingreso mayor a cero.");
      return;
    }

    setSavingRecepcion(true);

    try {
      const productSnapshot = await get(ref(dbRealtime, recepcionModal.productPath));
      const productNode = productSnapshot.exists() ? productSnapshot.val() || {} : {};
      const movimientosRaw: Record<string, MovimientoBodega> = productNode?.MOVIMIENTOS || {};
      const datosProducto = productNode?.DATOS_PRODUCTO || {};
      const movimientoKey = nextMovementKey(movimientosRaw);
      const currentStock = getLatestStockFromMovements(movimientosRaw, datosProducto.STOCK);
      const nuevoStockReal = currentStock.stockReal + ingreso;
      const stockDisponible = nuevoStockReal - currentStock.stockReservado;
      const stockEsperado = stockDisponible;
      const now = Date.now();
      const estadoRecepcion: EstadoGestion = ingreso === cantidadOrdenada ? "aceptado" : "diferente";
      const motivoDiferencia = estadoRecepcion === "diferente"
        ? `Cantidad ordenada: ${formatNumber(cantidadOrdenada)}. Cantidad recibida: ${formatNumber(ingreso)}.`
        : undefined;

      await update(ref(dbRealtime, recepcionModal.productPath), {
        [`MOVIMIENTOS/${movimientoKey}`]: {
          FECHA: fecha,
          DESCRIPCION: `COMPRA-${recepcionModal.compra.consecutivo || recepcionModal.compra.id}`,
          OBSERVACIONES: lote,
          INGRESO: ingreso,
          SALIDA: "",
          SALDO: nuevoStockReal,
          STOCK_RESERVADO: currentStock.stockReservado > 0 ? currentStock.stockReservado : "",
          STOCK_DISPONIBLE: stockDisponible,
          STOCK_TEORICO: stockEsperado,
          ORDEN_FECHA: parseDateValue(fecha),
          CREATED_AT: now,
          COMPRA_ID: recepcionModal.compra.id,
          COMPRA_CONSECUTIVO: recepcionModal.compra.consecutivo || "",
          CANTIDAD_ORDENADA: cantidadOrdenada,
          CANTIDAD_RECIBIDA: ingreso,
          ESTADO_RECEPCION: estadoRecepcion,
          CREADO_DESDE: "GESTION_COMPRAS_BODEGA",
          CREADO_POR: userName,
          CREADO_POR_UID: authUser?.uid || null,
          CREADO_POR_EMAIL: authUser?.email || null,
        },
        "DATOS_PRODUCTO/STOCK": nuevoStockReal,
      });

      actualizarEstadoLocal(
        recepcionModal.compra.id,
        recepcionModal.itemId,
        "recepcion_mercancia",
        estadoRecepcion,
        motivoDiferencia,
      );

      if (estadoRecepcion === "diferente") {
        await registrarAlertaRecepcionCompra(recepcionModal.compra, recepcionModal.item, "diferente", {
          cantidadOrdenada,
          cantidadRecibida: ingreso,
          lote,
          movimientoKey,
          mensaje: motivoDiferencia,
        });
      }

      setRecepcionModal(null);
      setMessage(
        estadoRecepcion === "aceptado"
          ? "Recepción aceptada, movimiento creado en bodega y stock actualizado."
          : "Recepción registrada como DIFERENTE, movimiento creado en bodega y alerta generada."
      );
    } catch (err: any) {
      setError(`No fue posible guardar la recepción. ${err?.message || ""}`);
    } finally {
      setSavingRecepcion(false);
    }
  };

  const rechazarRecepcionMercancia = async () => {
    if (!recepcionModal) return;

    const motivo = recepcionModal.rechazoMotivo?.trim();

    if (!motivo) {
      setError("Describe el motivo del rechazo de la recepción.");
      return;
    }

    setSavingRecepcion(true);
    setError("");
    setMessage("");

    try {
      actualizarEstadoLocal(
        recepcionModal.compra.id,
        recepcionModal.itemId,
        "recepcion_mercancia",
        "rechazado",
        motivo,
      );

      await registrarAlertaRecepcionCompra(recepcionModal.compra, recepcionModal.item, "rechazado", {
        motivo,
        cantidadOrdenada: toNumber(recepcionModal.item.total),
        cantidadRecibida: 0,
      });

      setRecepcionModal(null);
      setMessage("Recepción rechazada, motivo guardado y alerta generada para tesorería/anulación.");
    } catch (err: any) {
      setError(`No fue posible rechazar la recepción. ${err?.message || ""}`);
    } finally {
      setSavingRecepcion(false);
    }
  };

  const toggleExpanded = (compraId: string) => {
    setExpanded((current) => ({ ...current, [compraId]: !current[compraId] }));
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const renderProcesoControl = (
    compra: CompraGuardada,
    itemId: string,
    proceso: (typeof procesos)[number],
    itemTitulo: string,
  ) => {
    const estado = obtenerEstado(compra.id, itemId, proceso.key);
    const historial = estado.historialRechazos || [];
    const uploadId = `${compra.id}-comprobante_pago-${itemId}`;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="font-black text-sm text-slate-900">{proceso.titulo}</p>
          <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${estadoClass(estado.estado)}`}>
            {mostrarEstado(estado.estado)}
          </span>
        </div>
        <select
          value={
            proceso.tipoPago && estado.estado === "sin_verificar"
              ? "sin_solicitar"
              : estado.estado
          }
          onChange={(event) =>
            solicitarEstado(
              compra.id,
              itemId,
              proceso.key,
              proceso.titulo,
              itemTitulo,
              event.target.value as EstadoGestion,
            )
          }
          className={`w-full rounded-xl border px-2 py-2 text-xs font-black outline-none ${estadoClass(estado.estado)}`}
        >
          {proceso.tipoPago ? (
            <>
              <option value="sin_solicitar">Sin solicitar</option>
              <option value="solicitado">Solicitado</option>
            </>
          ) : (
            <>
              <option value="sin_verificar">Sin verificar</option>
              <option value="aceptado">Aceptado</option>
              <option value="rechazado">Rechazado</option>
            </>
          )}
        </select>
        {proceso.permiteArchivo && (
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-2.5 py-2 text-[11px] font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] cursor-pointer transition">
              {uploadingKey === uploadId ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Upload size={14} />
              )}
              Adjuntar
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) subirArchivo(compra.id, "comprobante_pago", file, itemId);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {estado.archivo?.url && (
              <a
                href={estado.archivo.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-2 text-[11px] font-black text-slate-600 hover:bg-[#244C5A] hover:text-white transition"
              >
                <FileText size={14} /> Ver
              </a>
            )}
          </div>
        )}
        {estado.meta && (
          <div className="mt-2 text-[10px] text-slate-500 leading-4">
            <p className="font-bold truncate">{estado.meta.usuario}</p>
            <p>{formatoFechaHora(estado.meta.fecha)}</p>
          </div>
        )}
        {historial.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setHistorialModal({
                titulo: `${proceso.titulo} · ${itemTitulo}`,
                historial,
              })
            }
            className="mt-2 text-[11px] text-red-600 font-black underline"
          >
            Ver rechazos ({historial.length})
          </button>
        )}
      </div>
    );
  };

  const renderProcesosGeneralesOrden = (compra: CompraGuardada) => (
    <div className="p-4 border-b border-emerald-200 bg-white">
      <div className="mb-3">
        <p className="text-sm font-black text-slate-900">Procesos generales de la orden</p>
        <p className="text-xs text-slate-500 mt-1">
          Factura, solicitud de pago, comprobante y contabilización se gestionan una sola vez por orden.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {procesosGenerales.map((proceso) => (
          <div key={`${compra.id}-general-${proceso.key}`}>
            {renderProcesoControl(compra, "__orden__", proceso, `Orden ${compra.consecutivo || compra.id}`)}
          </div>
        ))}
      </div>
    </div>
  );


  const generarPdfOrdenCompra = (compra: CompraGuardada) => {
    const items = compra.items || [];
    const factura = obtenerFacturaCompra(compra);
    const resumen = resumenEstadosCompra(compra);
    const gestionCompra = obtenerGestionCompra(compra.id);
    const escapeHtml = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const estadoGeneral = (procesoKey: string) =>
      mostrarEstado(obtenerEstado(compra.id, "__orden__", procesoKey).estado);

    const filasProductos = items
      .map((item, index) => {
        const key = itemKey(item, index);
        const recepcion = obtenerEstado(compra.id, key, "recepcion_mercancia");
        return `
          <tr>
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(item.codigoEnvase || item.codigoProducto || "Sin código")}</strong><br/><span>${escapeHtml(item.descripcion || item.producto || "Sin descripción")}</span></td>
            <td>${escapeHtml(item.proveedor || "Sin proveedor")}</td>
            <td>${escapeHtml(item.unidadEmpaque || "-")}</td>
            <td>${escapeHtml(item.cajasPacas || "-")}</td>
            <td>${escapeHtml(item.total || 0)}</td>
            <td>${escapeHtml(mostrarEstado(recepcion.estado))}</td>
            <td>${escapeHtml(recepcion.meta?.motivo || "")}</td>
          </tr>`;
      })
      .join("");

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Orden de compra ${escapeHtml(compra.consecutivo || compra.id)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 28px; background: #ffffff; }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 4px solid #244C5A; padding-bottom: 18px; margin-bottom: 22px; }
    .brand { font-size: 30px; font-weight: 900; color: #244C5A; letter-spacing: -1px; }
    .subtitle { color: #64748b; font-size: 12px; margin-top: 4px; }
    .title { text-align: right; }
    .title h1 { margin: 0; font-size: 22px; color: #244C5A; }
    .title p { margin: 6px 0 0; font-size: 12px; color: #475569; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
    .box { border: 1px solid #dbeafe; background: #f8fafc; border-radius: 12px; padding: 12px; }
    .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 900; letter-spacing: .04em; margin-bottom: 4px; }
    .value { font-size: 14px; font-weight: 800; color: #0f172a; }
    h2 { font-size: 15px; margin: 20px 0 10px; color: #244C5A; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #244C5A; color: white; text-align: left; padding: 9px; text-transform: uppercase; font-size: 9px; letter-spacing: .04em; }
    td { border: 1px solid #e2e8f0; padding: 8px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .status-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .status { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
    .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 10px; display: flex; justify-content: space-between; gap: 20px; }
    @media print { body { padding: 18px; } .no-print { display:none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Nüall</div>
      <div class="subtitle">Resumen de orden de compra generado desde el ERP.</div>
    </div>
    <div class="title">
      <h1>ORDEN DE COMPRA ${escapeHtml(compra.consecutivo || compra.id)}</h1>
      <p>Generado: ${escapeHtml(formatoFechaHora(new Date().toISOString()))}</p>
    </div>
  </div>

  <div class="grid">
    <div class="box"><div class="label">Fecha de compra</div><div class="value">${escapeHtml(compra.fecha || gestionCompra.fechaGestion || hoy())}</div></div>
    <div class="box"><div class="label">Estado</div><div class="value">${escapeHtml(compra.estado || "en_proceso")}</div></div>
    <div class="box"><div class="label">Creada por</div><div class="value">${escapeHtml(compra.creadoPor || "Usuario")}</div></div>
    <div class="box"><div class="label">Productos</div><div class="value">${items.length}</div></div>
    <div class="box"><div class="label">Aceptados / solicitados</div><div class="value">${resumen.aceptados}</div></div>
    <div class="box"><div class="label">Rechazados / diferentes</div><div class="value">${resumen.rechazados}</div></div>
  </div>

  <h2>Procesos generales</h2>
  <div class="status-grid">
    <div class="status"><div class="label">Verificación de factura</div><div class="value">${escapeHtml(estadoGeneral("factura"))}</div></div>
    <div class="status"><div class="label">Solicitar pago</div><div class="value">${escapeHtml(estadoGeneral("solicitar_pago"))}</div></div>
    <div class="status"><div class="label">Comprobante de pago</div><div class="value">${escapeHtml(estadoGeneral("comprobante_pago"))}</div></div>
    <div class="status"><div class="label">Contabilización</div><div class="value">${escapeHtml(estadoGeneral("contabilizacion_factura"))}</div></div>
  </div>

  <h2>Factura de compra</h2>
  <div class="box">
    <div class="value">${factura ? escapeHtml(factura.nombre || "Factura adjunta") : "No se ha adjuntado factura de compra"}</div>
    <div class="subtitle">${factura ? `Subida por ${escapeHtml(factura.subidoPor || "Usuario")} · ${escapeHtml(formatoFechaHora(factura.fecha))}` : ""}</div>
  </div>

  <h2>Detalle de productos</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Producto</th>
        <th>Proveedor</th>
        <th>Unidad</th>
        <th>Cajas/Pacas</th>
        <th>Total compra</th>
        <th>Recepción</th>
        <th>Observación</th>
      </tr>
    </thead>
    <tbody>${filasProductos || `<tr><td colspan="8">Sin productos registrados.</td></tr>`}</tbody>
  </table>

  <div class="footer">
    <span>Generado por: ${escapeHtml(userName)} · ${escapeHtml(authUser?.email || "")}</span>
    <span>ERP Nüall</span>
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      setError("No fue posible abrir la ventana del PDF. Permite ventanas emergentes para este sitio.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AppSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        openSections={openSections}
        toggleSection={toggleSection}
        handleLogout={handleLogout}
        userName={userName}
        userEmail={authUser?.email || ""}
        userRole={
          (profile as any)?.rolNombre ||
          (profile as any)?.role ||
          (profile as any)?.rol ||
          "Sin rol"
        }
      />

      <section className={`${sidebarWidth} transition-all duration-300`}>
        <header className="h-16 lg:h-20 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-10 h-10 rounded-2xl bg-[#244C5A] text-white flex items-center justify-center"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>

            <nav aria-label="Ruta de navegación" className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
              <Link
                href="/panel"
                className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-[#244C5A] text-white hover:bg-[#1d3d49] transition shrink-0"
                title="Ir al dashboard"
              >
                <Home size={18} />
              </Link>
              <Link href="/panel" className="hidden sm:inline font-semibold hover:text-[#244C5A] transition">
                Panel administrativo
              </Link>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="hidden sm:inline font-semibold text-slate-600">
                Compras
              </span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="font-black text-slate-900 truncate">
                Ver órdenes de compra
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-bold text-slate-800 truncate max-w-[220px]">
                {userName}
              </p>
              <p className="text-xs text-slate-500 truncate max-w-[220px]">
                {authUser?.email}
              </p>
            </div>
            <div className="hidden sm:flex w-11 h-11 rounded-2xl bg-[#244C5A] text-white items-center justify-center font-black uppercase">
              {userName.slice(0, 1)}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <section className="max-w-[1500px] mx-auto px-4 sm:px-8 py-5 sm:py-6 space-y-5">
          {(error || message) && (
            <div className="space-y-3">
              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError("")}>
                    {" "}
                    <X size={18} />{" "}
                  </button>
                </div>
              )}
              {message && (
                <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">
                  {message}
                </div>
              )}
            </div>
          )}

          <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                  Aprobaciones
                </p>
                <h2 className="text-2xl font-black mt-1">COMPRAS</h2>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="rounded-2xl bg-slate-100 border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 text-center">
                  {comprasFiltradas.length} compras
                </div>
                <label className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm font-black text-slate-600">
                  Ver
                  <select
                    value={porPagina}
                    onChange={(event) => {
                      setPorPagina(Number(event.target.value));
                      setPagina(1);
                    }}
                    className="bg-transparent outline-none font-black text-[#244C5A]"
                  >
                    <option value={10}>10</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  por página
                </label>
              </div>
            </div>

            {loading ? (
              <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
                <Loader2 className="animate-spin" size={22} />
                Cargando compras...
              </div>
            ) : comprasFiltradas.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardCheck className="mx-auto text-[#244C5A]" size={44} />
                <h3 className="font-black text-slate-900 mt-4">
                  No hay compras de bodega creadas
                </h3>
              </div>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full min-w-[1180px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-emerald-50 border-b border-emerald-200">
                        <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 w-[250px]">
                          Fecha / evidencia de compra
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 w-[210px]">
                          Consecutivo / estado
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Primer insumo a comprar
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 w-[160px]">
                          Productos
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 w-[190px]">
                          Estado
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 w-[150px]">
                          Acción
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comprasPaginadas.map((compra) => {
                        const gestionCompra = obtenerGestionCompra(compra.id);
                        const items = compra.items || [];
                        const primerItem = items[0];
                        const resumen = resumenEstadosCompra(compra);
                        const estaAbierta = !!expanded[compra.id];

                        return (
                          <Fragment key={compra.id}>
                            <tr
                              className={`border-b align-top transition ${estaAbierta ? "bg-emerald-50 hover:bg-emerald-50/90 border-emerald-200" : "border-slate-100 hover:bg-slate-50"}`}
                            >
                              <td className="px-4 py-4">
                                <p className="font-black text-slate-900">
                                  {gestionCompra.fechaGestion || hoy()}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(() => {
                                    const factura =
                                      obtenerFacturaCompra(compra);
                                    const uploadId = `${compra.id}-factura_compra_bodega-general`;
                                    return (
                                      <>
                                        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] cursor-pointer transition">
                                          {uploadingKey === uploadId ? (
                                            <Loader2
                                              className="animate-spin"
                                              size={15}
                                            />
                                          ) : (
                                            <Upload size={15} />
                                          )}
                                          {factura
                                            ? "Cambiar factura de compra"
                                            : "Adjuntar factura de compra"}
                                          <input
                                            type="file"
                                            accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                                            className="hidden"
                                            onChange={(event) => {
                                              const file =
                                                event.target.files?.[0];
                                              if (file)
                                                subirArchivo(
                                                  compra.id,
                                                  "factura_compra_bodega",
                                                  file,
                                                );
                                              event.currentTarget.value = "";
                                            }}
                                          />
                                        </label>

                                        {factura?.url ? (
                                          <a
                                            href={factura.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 hover:bg-[#244C5A] hover:text-white transition"
                                          >
                                            <Eye size={15} /> Ver factura
                                          </a>
                                        ) : (
                                          <span className="inline-flex items-center rounded-xl bg-yellow-50 border border-yellow-100 px-3 py-2 text-xs font-black text-yellow-700">
                                            No se ha adjuntado factura de compra
                                          </span>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                                {obtenerFacturaCompra(compra)?.fecha && (
                                  <div className="mt-2 text-[11px] text-slate-500 leading-4">
                                    <p>
                                      <strong>
                                        {obtenerFacturaCompra(compra)
                                          ?.subidoPor || "Usuario"}
                                      </strong>
                                    </p>
                                    <p>
                                      {formatoFechaHora(
                                        obtenerFacturaCompra(compra)?.fecha,
                                      )}
                                    </p>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                <p className="text-lg font-black text-[#244C5A]">
                                  {compra.consecutivo}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  Estado:{" "}
                                  <strong>
                                    {compra.estado || "en_proceso"}
                                  </strong>
                                </p>
                                <p className="text-xs text-slate-500 mt-1 truncate">
                                  {compra.creadoPor || "Usuario"}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                {primerItem ? (
                                  <div>
                                    <p className="font-black text-slate-900">
                                      {primerItem.codigoEnvase ||
                                        primerItem.codigoProducto ||
                                        "Sin código"}
                                    </p>
                                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                                      {primerItem.descripcion ||
                                        primerItem.producto ||
                                        "Sin descripción"}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">
                                      Proveedor:{" "}
                                      <strong>
                                        {primerItem.proveedor ||
                                          "Sin proveedor"}
                                      </strong>{" "}
                                      · Compra:{" "}
                                      <strong>{primerItem.total || 0}</strong>
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-semibold">
                                    Sin productos
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className="inline-flex rounded-full bg-[#244C5A]/10 text-[#244C5A] px-3 py-1 text-xs font-black">
                                  {items.length} ítems
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <div className="text-xs font-black text-slate-600">
                                  <span className="text-green-700">
                                    {resumen.aceptados}
                                  </span>{" "}
                                  aceptados ·{" "}
                                  <span className="text-red-700">
                                    {resumen.rechazados}
                                  </span>{" "}
                                  rechazados
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className="h-full bg-[#244C5A]"
                                    style={{
                                      width: `${resumen.total ? Math.round((resumen.aceptados / resumen.total) * 100) : 0}%`,
                                    }}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex flex-col items-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => generarPdfOrdenCompra(compra)}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-[#244C5A]/20 bg-white px-4 py-2 text-xs font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition"
                                  >
                                    <FileText size={15} /> PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(compra.id)}
                                    className="rounded-2xl bg-[#244C5A] text-white px-4 py-2 text-xs font-black hover:bg-[#1b3b46] transition"
                                  >
                                    {estaAbierta ? "Ocultar" : "Desplegar"}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {estaAbierta && (
                              <tr className="border-b border-emerald-200 bg-emerald-50/70">
                                <td colSpan={6} className="p-4">
                                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 overflow-hidden shadow-sm shadow-emerald-100">
                                    <div className="px-4 py-3 border-b border-emerald-200 bg-emerald-50">
                                      <p className="font-black text-slate-900">
                                        Detalle de productos y verificaciones
                                      </p>
                                      <p className="text-xs text-slate-500 mt-1">
                                        La recepción se verifica por producto. Los procesos de factura, pago y contabilización se gestionan una sola vez por orden.
                                      </p>
                                    </div>
                                    {renderProcesosGeneralesOrden(compra)}
                                    <div className="overflow-x-auto">
                                      <table className="w-full min-w-[1150px] border-collapse">
                                        <thead>
                                          <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="text-left px-3 py-3 text-[11px] font-black uppercase text-slate-500 w-[250px]">
                                              Producto / proveedor
                                            </th>
                                            <th className="text-center px-3 py-3 text-[11px] font-black uppercase text-slate-500 w-[110px]">
                                              Compra
                                            </th>
                                            {procesosProducto.map((proceso) => (
                                              <th
                                                key={`${compra.id}-head-${proceso.key}`}
                                                className="text-left px-3 py-3 text-[11px] font-black uppercase text-slate-500 min-w-[175px]"
                                              >
                                                {proceso.titulo}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {items.map((item, index) => {
                                            const key = itemKey(item, index);
                                            return (
                                              <tr
                                                key={`${compra.id}-detalle-${key}`}
                                                className="border-b border-slate-100 last:border-b-0 align-top"
                                              >
                                                <td className="px-3 py-3">
                                                  <p className="font-black text-slate-900">
                                                    {item.codigoEnvase ||
                                                      item.codigoProducto ||
                                                      "Sin código"}
                                                  </p>
                                                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                                                    {item.descripcion ||
                                                      item.producto ||
                                                      "Sin descripción"}
                                                  </p>
                                                  <p className="text-[11px] text-slate-500 mt-1">
                                                    Proveedor:{" "}
                                                    <strong>
                                                      {item.proveedor ||
                                                        "Sin proveedor"}
                                                    </strong>
                                                  </p>
                                                </td>
                                                <td className="px-3 py-3 text-center font-black text-slate-900">
                                                  {item.total || 0}
                                                </td>
                                                {(() => {
                                                  const estado = obtenerEstado(compra.id, key, "recepcion_mercancia");
                                                  return (
                                                    <td className="px-3 py-3 w-[260px]">
                                                      <div className="flex flex-col items-start gap-2">
                                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${estadoClass(estado.estado)}`}>
                                                          {mostrarEstado(estado.estado)}
                                                        </span>
                                                        <button
                                                          type="button"
                                                          onClick={() => abrirModalRecepcion(compra, item, key)}
                                                          disabled={loadingRecepcion}
                                                          className="inline-flex items-center gap-2 rounded-xl bg-[#244C5A] px-3 py-2 text-xs font-black text-white hover:bg-[#1b3b46] disabled:opacity-60 transition"
                                                        >
                                                          {loadingRecepcion ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                                                          Recibir mercancía
                                                        </button>
                                                        {estado.meta && (
                                                          <div className="text-[10px] text-slate-500 leading-4">
                                                            <p className="font-bold truncate">{estado.meta.usuario}</p>
                                                            <p>{formatoFechaHora(estado.meta.fecha)}</p>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </td>
                                                  );
                                                })()}
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden divide-y divide-slate-200">
                  {comprasPaginadas.map((compra) => {
                    const gestionCompra = obtenerGestionCompra(compra.id);
                    const items = compra.items || [];
                    const primerItem = items[0];
                    const resumen = resumenEstadosCompra(compra);
                    const estaAbierta = !!expanded[compra.id];
                    return (
                      <div
                        key={`${compra.id}-mobile`}
                        className={`p-4 transition ${estaAbierta ? "bg-emerald-50 border-l-4 border-emerald-400" : "bg-white"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase text-slate-400">
                              {gestionCompra.fechaGestion || hoy()}
                            </p>
                            <h3 className="text-xl font-black text-[#244C5A] mt-1">
                              {compra.consecutivo}
                            </h3>
                            <p className="text-sm text-slate-600">
                              Estado:{" "}
                              <strong>{compra.estado || "en_proceso"}</strong>
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {compra.creadoPor || "Usuario"}
                            </p>
                          </div>
                          <span className="rounded-full bg-[#244C5A]/10 text-[#244C5A] px-3 py-1 text-xs font-black">
                            {items.length} ítems
                          </span>
                        </div>

                        {primerItem && (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-black text-slate-900">
                              {primerItem.codigoEnvase ||
                                primerItem.codigoProducto ||
                                "Sin código"}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              {primerItem.descripcion || "Sin descripción"}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Proveedor:{" "}
                              <strong>
                                {primerItem.proveedor || "Sin proveedor"}
                              </strong>{" "}
                              · Compra: <strong>{primerItem.total || 0}</strong>
                            </p>
                          </div>
                        )}

                        <div className="mt-4 flex flex-col gap-2">
                          {(() => {
                            const factura = obtenerFacturaCompra(compra);
                            const uploadId = `${compra.id}-factura_compra_bodega-general`;
                            return (
                              <>
                                <label className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-3 py-3 text-xs font-black text-slate-600 cursor-pointer">
                                  {uploadingKey === uploadId ? (
                                    <Loader2
                                      className="animate-spin"
                                      size={15}
                                    />
                                  ) : (
                                    <Upload size={15} />
                                  )}
                                  {factura
                                    ? "Cambiar factura de compra"
                                    : "Adjuntar factura de compra"}
                                  <input
                                    type="file"
                                    accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                                    className="hidden"
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      if (file)
                                        subirArchivo(
                                          compra.id,
                                          "factura_compra_bodega",
                                          file,
                                        );
                                      event.currentTarget.value = "";
                                    }}
                                  />
                                </label>

                                {factura?.url ? (
                                  <a
                                    href={factura.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-3 py-3 text-xs font-black text-slate-600"
                                  >
                                    <Eye size={15} /> Ver factura
                                  </a>
                                ) : (
                                  <div className="rounded-2xl bg-yellow-50 border border-yellow-100 px-3 py-3 text-xs font-black text-yellow-700 text-center">
                                    No se ha adjuntado factura de compra
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        <div className="mt-4 text-xs font-black text-slate-600">
                          <span className="text-green-700">
                            {resumen.aceptados}
                          </span>{" "}
                          aceptados ·{" "}
                          <span className="text-red-700">
                            {resumen.rechazados}
                          </span>{" "}
                          rechazados
                        </div>

                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => generarPdfOrdenCompra(compra)}
                            className="w-full rounded-2xl border border-[#244C5A]/20 bg-white text-[#244C5A] px-4 py-3 text-sm font-black flex items-center justify-center gap-2"
                          >
                            <FileText size={17} /> Generar PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(compra.id)}
                            className="w-full rounded-2xl bg-[#244C5A] text-white px-4 py-3 text-sm font-black"
                          >
                            {estaAbierta
                              ? "Ocultar productos"
                              : "Desplegar productos"}
                          </button>
                        </div>

                        {estaAbierta && (
                          <div className="mt-4 space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-3">
                            <div className="rounded-3xl overflow-hidden border border-emerald-200 bg-white">
                              {renderProcesosGeneralesOrden(compra)}
                            </div>
                            {items.map((item, index) => {
                              const key = itemKey(item, index);
                              return (
                                <div
                                  key={`${compra.id}-mobile-item-${key}`}
                                  className="rounded-3xl border border-slate-200 overflow-hidden"
                                >
                                  <div className="p-4 bg-slate-50 border-b border-slate-200">
                                    <p className="font-black text-slate-900">
                                      {item.codigoEnvase ||
                                        item.codigoProducto ||
                                        "Sin código"}
                                    </p>
                                    <p className="text-sm text-slate-600 mt-1">
                                      {item.descripcion ||
                                        item.producto ||
                                        "Sin descripción"}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                                      <div>
                                        <p className="text-slate-400 font-black uppercase">
                                          Proveedor
                                        </p>
                                        <p className="font-black text-slate-700">
                                          {item.proveedor || "N/A"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-slate-400 font-black uppercase">
                                          Compra
                                        </p>
                                        <p className="font-black text-slate-700">
                                          {item.total || 0}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-3 space-y-3">
                                    {(() => {
                                      const estado = obtenerEstado(compra.id, key, "recepcion_mercancia");
                                      return (
                                        <div className="rounded-2xl border border-slate-200 p-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <p className="font-black text-sm text-slate-900">Recepción de mercancía</p>
                                            <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${estadoClass(estado.estado)}`}>
                                              {mostrarEstado(estado.estado)}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => abrirModalRecepcion(compra, item, key)}
                                            disabled={loadingRecepcion}
                                            className="w-full mt-3 rounded-2xl bg-[#244C5A] text-white px-4 py-3 text-sm font-black disabled:opacity-60"
                                          >
                                            {loadingRecepcion ? "Abriendo..." : "Recibir mercancía"}
                                          </button>
                                          {estado.meta && (
                                            <div className="mt-2 text-[11px] text-slate-500 leading-4">
                                              <p className="font-bold">{estado.meta.usuario}</p>
                                              <p>{formatoFechaHora(estado.meta.fecha)}</p>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-sm text-slate-500 font-semibold">
                    Mostrando {comprasPaginadas.length} de{" "}
                    {comprasFiltradas.length} órdenes.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pagina <= 1}
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-600 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={pagina >= totalPaginas}
                      onClick={() =>
                        setPagina((p) => Math.min(totalPaginas, p + 1))
                      }
                      className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-600 disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </section>


        {recepcionModal && (
          <div className="fixed inset-0 z-[1002] bg-black/60 flex items-center justify-center px-4 py-6">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-6xl overflow-hidden max-h-[92vh] flex flex-col">
              <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    Recepción de mercancía
                  </p>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    {recepcionModal.productCode} · {recepcionModal.productName}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Orden {recepcionModal.compra.consecutivo || recepcionModal.compra.id} · Proveedor {recepcionModal.providerName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRecepcionModal(null)}
                  className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 overflow-auto space-y-5">
                {(() => {
                  const stockActual = getLatestStockFromMovements(recepcionModal.movimientosRaw, recepcionModal.item.stock);
                  const ingreso = toNumber(recepcionModal.ingreso);
                  const cantidadOrdenada = toNumber(recepcionModal.item.total);
                  const nuevoStock = stockActual.stockReal + ingreso;
                  const nuevoDisponible = nuevoStock - stockActual.stockReservado;

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                      <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4">
                        <p className="text-xs font-black uppercase text-blue-700">Cantidad ordenada</p>
                        <p className="text-2xl font-black text-blue-700 mt-1">{formatNumber(cantidadOrdenada)}</p>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase text-slate-400">Stock real actual</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{formatNumber(stockActual.stockReal)}</p>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase text-slate-400">Stock reservado</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{formatNumber(stockActual.stockReservado)}</p>
                      </div>
                      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs font-black uppercase text-emerald-700">Nuevo stock disponible</p>
                        <p className="text-2xl font-black text-emerald-700 mt-1">{formatNumber(nuevoDisponible)}</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      guardarRecepcionMercancia();
                    }}
                    className="rounded-3xl border border-slate-200 bg-white p-4 space-y-4"
                  >
                    <div>
                      <p className="font-black text-slate-900">Crear entrada en bodega</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Se creará un movimiento COMPRA con el consecutivo de la orden.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-2">Fecha</label>
                      <input
                        type="date"
                        value={recepcionModal.fecha}
                        onChange={(event) =>
                          setRecepcionModal((current) => current ? { ...current, fecha: event.target.value } : current)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-2">Lote recibido</label>
                      <input
                        type="text"
                        value={recepcionModal.lote}
                        onChange={(event) =>
                          setRecepcionModal((current) => current ? { ...current, lote: event.target.value.toUpperCase() } : current)
                        }
                        placeholder="Ej: LOTE 0141"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-black outline-none focus:bg-white focus:border-[#244C5A]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-2">Cantidad recibida</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={recepcionModal.ingreso}
                        onChange={(event) =>
                          setRecepcionModal((current) => current ? { ...current, ingreso: event.target.value } : current)
                        }
                        className="w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-lg font-black text-emerald-800 outline-none focus:bg-white focus:border-emerald-500"
                      />
                    </div>

                    <div className={`rounded-2xl border p-3 text-xs font-black ${toNumber(recepcionModal.ingreso) === toNumber(recepcionModal.item.total) ? "bg-green-50 border-green-200 text-green-700" : "bg-orange-50 border-orange-200 text-orange-700"}`}>
                      Estado al guardar: {toNumber(recepcionModal.ingreso) === toNumber(recepcionModal.item.total) ? "ACEPTADA" : "DIFERENTE"}
                      {toNumber(recepcionModal.ingreso) !== toNumber(recepcionModal.item.total) && (
                        <p className="mt-1 font-semibold">Se creará el movimiento y también una alerta por diferencia.</p>
                      )}
                    </div>

                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                      <p><strong>Descripción:</strong> COMPRA-{recepcionModal.compra.consecutivo || recepcionModal.compra.id}</p>
                      <p className="mt-1"><strong>Producto:</strong> {recepcionModal.productCode}</p>
                    </div>

                    {recepcionModal.confirmandoRechazo && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-3 space-y-2">
                        <label className="block text-sm font-black text-red-700">Motivo del rechazo</label>
                        <textarea
                          rows={3}
                          value={recepcionModal.rechazoMotivo || ""}
                          onChange={(event) =>
                            setRecepcionModal((current) =>
                              current ? { ...current, rechazoMotivo: event.target.value } : current,
                            )
                          }
                          placeholder="Describe por qué se rechaza la recepción..."
                          className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 resize-none"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="submit"
                        disabled={savingRecepcion}
                        className="w-full rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 text-white font-black px-5 py-3 flex items-center justify-center gap-2"
                      >
                        {savingRecepcion ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                        {savingRecepcion ? "Guardando recepción..." : "Guardar entrada de mercancía"}
                      </button>
                      {!recepcionModal.confirmandoRechazo ? (
                        <button
                          type="button"
                          onClick={() =>
                            setRecepcionModal((current) =>
                              current ? { ...current, confirmandoRechazo: true } : current,
                            )
                          }
                          className="w-full rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 hover:bg-red-100 transition"
                        >
                          Rechazar recepción
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={rechazarRecepcionMercancia}
                          disabled={savingRecepcion}
                          className="w-full rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-70 transition"
                        >
                          Confirmar rechazo de mercancía
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                      <p className="font-black text-slate-900">Movimientos actuales del producto</p>
                      <p className="text-xs text-slate-500 mt-1">Referencia tomada del nivel 3 de bodega.</p>
                    </div>
                    <div className="overflow-x-auto max-h-[430px]">
                      <table className="w-full min-w-[780px] text-sm">
                        <thead className="sticky top-0 bg-white border-b border-slate-200">
                          <tr>
                            <th className="text-left px-3 py-3 text-[11px] font-black uppercase text-slate-500">Fecha</th>
                            <th className="text-left px-3 py-3 text-[11px] font-black uppercase text-slate-500">Movimiento</th>
                            <th className="text-left px-3 py-3 text-[11px] font-black uppercase text-slate-500">Lote</th>
                            <th className="text-right px-3 py-3 text-[11px] font-black uppercase text-slate-500">Ingreso</th>
                            <th className="text-right px-3 py-3 text-[11px] font-black uppercase text-slate-500">Salida</th>
                            <th className="text-right px-3 py-3 text-[11px] font-black uppercase text-slate-500">Stock real</th>
                            <th className="text-right px-3 py-3 text-[11px] font-black uppercase text-slate-500">Disponible</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortMovementEntriesDesc(recepcionModal.movimientosRaw).length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-3 py-8 text-center text-slate-400 font-semibold">
                                Este producto aún no tiene movimientos.
                              </td>
                            </tr>
                          ) : (
                            sortMovementEntriesDesc(recepcionModal.movimientosRaw).slice(0, 20).map(([movId, mov]) => {
                              const saldo = toNumber(mov.SALDO);
                              const reservado = toNumber(mov.STOCK_RESERVADO);
                              return (
                                <tr key={movId} className="border-b border-slate-100 last:border-b-0">
                                  <td className="px-3 py-3 font-bold text-slate-700">{normalizeText(mov.FECHA) || "—"}</td>
                                  <td className="px-3 py-3 font-black text-slate-900">{normalizeText(mov.DESCRIPCION) || movId}</td>
                                  <td className="px-3 py-3 text-slate-600">{normalizeText(mov.OBSERVACIONES) || "—"}</td>
                                  <td className="px-3 py-3 text-right text-emerald-700 font-black">{mov.INGRESO ? formatNumber(mov.INGRESO) : "—"}</td>
                                  <td className="px-3 py-3 text-right text-red-700 font-black">{mov.SALIDA ? formatNumber(mov.SALIDA) : "—"}</td>
                                  <td className="px-3 py-3 text-right font-black text-slate-900">{formatNumber(saldo)}</td>
                                  <td className="px-3 py-3 text-right font-black text-[#244C5A]">{formatNumber(saldo - reservado)}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {rechazoModal && (
          <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center px-4">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-red-600 uppercase tracking-wide">
                    Motivo de rechazo
                  </p>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    {rechazoModal.procesoTitulo}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {rechazoModal.itemTitulo}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRechazoModal(null)}
                  className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <textarea
                  value={rechazoModal.motivo}
                  onChange={(event) =>
                    setRechazoModal((current) =>
                      current
                        ? { ...current, motivo: event.target.value }
                        : current,
                    )
                  }
                  rows={5}
                  placeholder="Describe el motivo del rechazo..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 resize-none"
                />
                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setRechazoModal(null)}
                    className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-600 hover:border-slate-400 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarRechazo}
                    className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 transition"
                  >
                    Guardar rechazo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {historialModal && (
          <div className="fixed inset-0 z-[1001] bg-black/60 flex items-center justify-center px-4">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-red-600 uppercase tracking-wide">
                    Historial de rechazos
                  </p>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    {historialModal.titulo}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setHistorialModal(null)}
                  className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-auto">
                {historialModal.historial.map((registro, index) => (
                  <div
                    key={`${registro.fecha}-${index}`}
                    className="rounded-2xl border border-red-100 bg-red-50 p-4"
                  >
                    <p className="text-sm font-black text-red-700">
                      Rechazo #{index + 1}
                    </p>
                    <p className="text-sm text-slate-700 mt-2">
                      {registro.motivo || "Sin motivo registrado."}
                    </p>
                    <div className="mt-3 text-xs text-slate-500">
                      <p>
                        <strong>{registro.usuario}</strong>
                      </p>
                      <p>{formatoFechaHora(registro.fecha)}</p>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setHistorialModal(null)}
                  className="w-full rounded-2xl bg-[#244C5A] px-5 py-3 text-sm font-black text-white hover:bg-[#1b3b46] transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function AppSidebar({
  sidebarOpen,
  setSidebarOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
  openSections,
  toggleSection,
  handleLogout,
  userName,
  userEmail,
  userRole,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  openSections: Record<string, boolean>;
  toggleSection: (sectionTitle: string) => void;
  handleLogout: () => Promise<void>;
  userName: string;
  userEmail: string;
  userRole: string;
}) {
  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-slate-950/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar fondo menú"
        />
      )}

      <aside
        className={`fixed z-50 inset-y-0 left-0 ${
          sidebarCollapsed ? "lg:w-[88px]" : "lg:w-[300px]"
        } w-[300px] bg-[#244C5A] text-white transform transition-all duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          <div
            className={`px-4 pt-6 pb-5 border-b border-white/10 flex items-center ${
              sidebarCollapsed ? "justify-center" : "justify-between"
            }`}
          >
            <Link
              href="/panel"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center justify-center min-h-[56px]"
            >
              <Image
                src="/logo.png"
                alt="Nuall"
                width={sidebarCollapsed ? 48 : 145}
                height={70}
                priority
                className="object-contain"
              />
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="hidden lg:flex w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 items-center justify-center"
                aria-label="Encoger o ampliar menú"
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen size={21} />
                ) : (
                  <PanelLeftClose size={21} />
                )}
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
                <p className="text-xs uppercase tracking-wider font-black text-[#244C5A]/70">
                  Sesión activa
                </p>
                <p className="font-black mt-1 truncate">{userName}</p>
                <p className="text-xs text-[#244C5A]/70 truncate mt-1">
                  {userEmail}
                </p>
                <p className="text-xs text-[#244C5A]/70 truncate mt-1">
                  Rol: {userRole || "Sin rol"}
                </p>
              </div>
            </div>
          )}

          <nav className="px-4 flex-1 space-y-2 overflow-y-auto pb-4">
            <Link
              href="/panel"
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-white text-[#244C5A] font-bold shadow-lg ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
              onClick={() => setSidebarOpen(false)}
              title="Panel Principal"
            >
              <LayoutDashboard size={20} />
              {!sidebarCollapsed && <span>Panel Principal</span>}
            </Link>

            {menuSections.map((section) => {
              const SectionIcon = section.icon;
              const isOpen = openSections[section.title] ?? false;

              return (
                <div key={section.title} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-white/90 hover:bg-white/10 hover:text-white transition ${
                      sidebarCollapsed ? "justify-center" : ""
                    }`}
                    title={section.title}
                  >
                    <span
                      className={`flex items-center gap-3 font-bold ${
                        sidebarCollapsed ? "justify-center" : ""
                      }`}
                    >
                      <SectionIcon size={20} />
                      {!sidebarCollapsed && section.title}
                    </span>
                    {!sidebarCollapsed && (
                      <ChevronDown
                        size={18}
                        className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    )}
                  </button>

                  {!sidebarCollapsed && isOpen && (
                    <div className="ml-4 pl-3 border-l border-white/15 space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.title}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm text-white/75 hover:bg-white/10 hover:text-white transition"
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
              onClick={handleLogout}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 font-semibold transition ${
                sidebarCollapsed ? "px-0" : ""
              }`}
              title="Cerrar sesión"
            >
              <LogOut size={19} /> {!sidebarCollapsed && "Cerrar sesión"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function ReadOnlyField({
  label,
  value,
  placeholder = "Se carga automático",
}: {
  label: string;
  value: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-700 mb-2">
        {label}
      </label>
      <input
        type="text"
        value={value}
        disabled
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600 outline-none cursor-not-allowed"
      />
    </div>
  );
}
