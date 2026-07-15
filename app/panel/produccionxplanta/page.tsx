"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Dispatch, DragEvent, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  GripVertical,
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MoveRight,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  Trash2,
  Wrench,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { getDatabase, onValue, push, ref, update } from "firebase/database";
import { auth } from "@/lib/firebase";
import { useUserPermissions } from "@/lib/useUserPermissions";
import NoPermission from "@/components/NoPermission";

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
      { title: "Listado / movimiento de proveedores", icon: Truck, href: "/panel/proveedores-bodega" },
    ],
  },
  {
    title: "Comercial",
    icon: ClipboardList,
    items: [
      { title: "Crear / ver clientes", icon: UserPlus, href: "/panel/clientes" },
      { title: "Crear orden de pedido", icon: ClipboardList, href: "/panel/pedidos" },
      { title: "Ver órdenes de pedido", icon: Eye, href: "/panel/ordenes_creadas" },
      { title: "Generar orden de muestra", icon: FileText, href: "/panel/muestra" },
    ],
  },
  {
    title: "Producción",
    icon: MoveRight,
    items: [
      { title: "Ver órdenes de pedido", icon: Eye, href: "/panel/ordenes_creadas" },
      { title: "Producción x Planta", icon: MoveRight, href: "/panel/produccionxplanta" },
    ],
  },
  {
    title: "Compras",
    icon: ShoppingCart,
    items: [
      { title: "Crear órdenes de compra", icon: ClipboardList, href: "/panel/compras2" },
      { title: "Ver órdenes de compra", icon: Eye, href: "/panel/gestion-compras2" },
      { title: "Crear proveedor", icon: Truck, href: "/panel/crear-proveedor" },
    ],
  },
  {
    title: "Etiquetas",
    icon: Tags,
    items: [
      { title: "Lista etiquetas", icon: Tags, href: "/panel/inventario-etiquetas" },
      { title: "Crear orden de compra etiquetas", icon: FileText, href: "/panel/compra-etiqueta" },
      { title: "Ver órdenes de compra etiquetas", icon: Eye, href: "/panel/gestion-etiquetas" },
    ],
  },
];

const plantas = ["Planta 1", "Planta 2", "Planta 3", "Planta 4"] as const;
type Planta = (typeof plantas)[number];

const plantTheme: Record<Planta, {
  panel: string;
  header: string;
  border: string;
  title: string;
  label: string;
  badge: string;
  softBadge: string;
  cardSaving: string;
  cardNormal: string;
  button: string;
}> = {
  "Planta 1": {
    panel: "bg-blue-50/35",
    header: "bg-blue-50 border-blue-200",
    border: "border-blue-200",
    title: "text-blue-800",
    label: "text-blue-700",
    badge: "bg-blue-100 text-blue-800",
    softBadge: "bg-blue-50 text-blue-700",
    cardSaving: "border-blue-400 bg-blue-50/70",
    cardNormal: "border-blue-100 bg-white hover:border-blue-300 hover:bg-blue-50/30",
    button: "border-blue-300 text-blue-700 hover:bg-blue-700 hover:text-white",
  },
  "Planta 2": {
    panel: "bg-emerald-50/35",
    header: "bg-emerald-50 border-emerald-200",
    border: "border-emerald-200",
    title: "text-emerald-800",
    label: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800",
    softBadge: "bg-emerald-50 text-emerald-700",
    cardSaving: "border-emerald-400 bg-emerald-50/70",
    cardNormal: "border-emerald-100 bg-white hover:border-emerald-300 hover:bg-emerald-50/30",
    button: "border-emerald-300 text-emerald-700 hover:bg-emerald-700 hover:text-white",
  },
  "Planta 3": {
    panel: "bg-amber-50/40",
    header: "bg-amber-50 border-amber-200",
    border: "border-amber-200",
    title: "text-amber-800",
    label: "text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    softBadge: "bg-amber-50 text-amber-700",
    cardSaving: "border-amber-400 bg-amber-50/70",
    cardNormal: "border-amber-100 bg-white hover:border-amber-300 hover:bg-amber-50/30",
    button: "border-amber-300 text-amber-700 hover:bg-amber-600 hover:text-white",
  },
  "Planta 4": {
    panel: "bg-violet-50/35",
    header: "bg-violet-50 border-violet-200",
    border: "border-violet-200",
    title: "text-violet-800",
    label: "text-violet-700",
    badge: "bg-violet-100 text-violet-800",
    softBadge: "bg-violet-50 text-violet-700",
    cardSaving: "border-violet-400 bg-violet-50/70",
    cardNormal: "border-violet-100 bg-white hover:border-violet-300 hover:bg-violet-50/30",
    button: "border-violet-300 text-violet-700 hover:bg-violet-700 hover:text-white",
  },
};


type PedidoItem = {
  itemKey: string;
  rawIndex: number;
  codigo?: string;
  codigoProducto?: string;
  producto?: string;
  descripcion?: string;
  cantidad?: string | number;
  cliente?: string;
  planta?: string;
  ordenPlanta?: number;
  fechaProgramada?: string;
  horaInicio?: string;
  horaFin?: string;
  materiasPrimas?: any;
  detalleProducto?: any;
  estado?: string;
  [key: string]: any;
};

type OrdenProduccion = {
  id: string;
  orden?: string;
  consecutivo?: string;
  numeroOrden?: string;
  ordenPedido?: string;
  cliente?: string;
  clienteNombre?: string;
  codigoCliente?: string;
  fecha?: string;
  estado?: string;
  items: PedidoItem[];
  raw: any;
};

type PlantaCard = {
  uid: string;
  ordenId: string;
  itemKey: string;
  itemIndex: number;
  ordenNumero: string;
  cliente: string;
  fecha: string;
  producto: string;
  codigoProducto: string;
  cantidad: string | number;
  planta: Planta;
  ordenPlanta: number;
  fechaProgramada: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  orden: OrdenProduccion;
  item: PedidoItem;
};

type DragPayload = {
  uid: string;
  fromPlant: Planta;
};

type BloqueProgramado = {
  id: string;
  tipo: "mantenimiento" | "capacitacion";
  titulo: string;
  planta: Planta;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  descripcion?: string;
  createdAt?: string;
};

type ScheduleModalState = {
  card: PlantaCard;
  planta: Planta;
  fecha: string;
  horaInicio: string;
  horaFin: string;
} | null;

type BlockModalState = {
  tipo: "mantenimiento" | "capacitacion";
  titulo: string;
  planta: Planta;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  descripcion: string;
} | null;

function normalizeText(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function normalizeDisplayName(value: unknown) {
  if (value === undefined || value === null) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "object") {
    const item = value as Record<string, any>;

    return (
      normalizeText(item.cliente) ||
      normalizeText(item.nombreCliente) ||
      normalizeText(item.clienteNombre) ||
      normalizeText(item.nombre) ||
      normalizeText(item.razonSocial) ||
      normalizeText(item.empresa) ||
      normalizeText(item.codigoCliente) ||
      normalizeText(item.codigo) ||
      ""
    );
  }

  return String(value);
}

function normalizeNumber(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return normalizeText(value) || "—";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(numberValue);
}

function safeKey(value: unknown) {
  return normalizeText(value || "item")
    .trim()
    .replace(/[.#$\[\]/]/g, "_")
    .replace(/\s+/g, "_");
}

function getOrderNumber(order: OrdenProduccion) {
  return (
    normalizeText(order.orden) ||
    normalizeText(order.consecutivo) ||
    normalizeText(order.numeroOrden) ||
    normalizeText(order.ordenPedido) ||
    order.id
  );
}

function normalizePlant(value: unknown): Planta | "" {
  const clean = normalizeText(value).trim().toLowerCase();
  if (!clean) return "";
  if (clean.includes("1")) return "Planta 1";
  if (clean.includes("2")) return "Planta 2";
  if (clean.includes("3")) return "Planta 3";
  if (clean.includes("4")) return "Planta 4";
  return "";
}

function normalizeItems(rawItems: any): PedidoItem[] {
  if (!rawItems) return [];

  if (Array.isArray(rawItems)) {
    return rawItems.map((item, index) => ({
      ...(item || {}),
      itemKey: safeKey((item as any)?.itemKey || (item as any)?.id || index),
      rawIndex: index,
    }));
  }

  return Object.entries(rawItems || {}).map(([key, value]: any, index) => ({
    ...(value || {}),
    itemKey: safeKey(key),
    rawIndex: Number.isFinite(Number(key)) ? Number(key) : index,
  }));
}

function normalizeOrders(data: any): OrdenProduccion[] {
  return Object.entries(data || {})
    .map(([id, raw]: any) => ({
      id,
      orden: raw?.orden || raw?.ordenProduccion || raw?.ordenPedido,
      consecutivo: raw?.consecutivo,
      numeroOrden: raw?.numeroOrden,
      ordenPedido: raw?.ordenPedido,
      cliente: normalizeDisplayName(raw?.cliente || raw?.clienteNombre || raw?.datosCliente),
      clienteNombre: normalizeDisplayName(raw?.clienteNombre || raw?.cliente || raw?.datosCliente),
      codigoCliente: normalizeDisplayName(raw?.codigoCliente || raw?.cliente?.codigoCliente || raw?.cliente?.codigo),
      fecha: raw?.fecha || raw?.creadoAt || raw?.createdAt,
      estado: raw?.estado || raw?.estadoCalculado || "creada",
      items: normalizeItems(raw?.items || raw?.productos || raw?.detalle || raw?.itemsPedido),
      raw,
    }))
    .sort((a, b) => {
      const aDate = normalizeText(a.fecha);
      const bDate = normalizeText(b.fecha);
      return bDate.localeCompare(aDate);
    });
}

function formatDate(value?: string) {
  if (!value) return "Sin fecha";
  try {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function minutesFromTime(value: string) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  const a1 = minutesFromTime(startA);
  const a2 = minutesFromTime(endA);
  const b1 = minutesFromTime(startB);
  const b2 = minutesFromTime(endB);
  return a1 < b2 && b1 < a2;
}

function formatSchedule(fecha: string, horaInicio: string, horaFin: string) {
  if (!fecha || !horaInicio || !horaFin) return "Sin horario";
  return `${formatDate(fecha)} · ${horaInicio} - ${horaFin}`;
}

export default function ProduccionPorPlantaPage() {
  const router = useRouter();
  const realtimeDb = getDatabase(auth.app);
  const { authUser, profile, loading: loadingPermissions, isActive } = useUserPermissions();

  const [orders, setOrders] = useState<OrdenProduccion[]>([]);
  const [cards, setCards] = useState<Record<Planta, PlantaCard[]>>({
    "Planta 1": [],
    "Planta 2": [],
    "Planta 3": [],
    "Planta 4": [],
  });
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [bloques, setBloques] = useState<BloqueProgramado[]>([]);
  const [scheduleModal, setScheduleModal] = useState<ScheduleModalState>(null);
  const [blockModal, setBlockModal] = useState<BlockModalState>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "Producción": true,
  });

  const userName = useMemo(() => {
    return profile?.nombre || authUser?.displayName || authUser?.email?.split("@")[0] || "Administrador";
  }, [profile, authUser]);

  const userRole = useMemo(() => {
    return (profile as any)?.rolNombre || (profile as any)?.role || (profile as any)?.rol || "Sin rol";
  }, [profile]);

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((current) => ({ ...current, [sectionTitle]: !current[sectionTitle] }));
    if (sidebarCollapsed) setSidebarCollapsed(false);
  };

  useEffect(() => {
    if (!loadingPermissions && !authUser) router.replace("/");
  }, [loadingPermissions, authUser, router]);

  useEffect(() => {
    if (loadingPermissions || !authUser) return;

    setLoading(true);
    setError("");

    const unsubscribe = onValue(
      ref(realtimeDb, "ORDENES_PEDIDO"),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() || {} : {};
        setOrders(normalizeOrders(data));
        setLoading(false);
      },
      (err) => {
        setError(`No fue posible cargar órdenes de producción. ${err?.message || ""}`);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [loadingPermissions, authUser, realtimeDb]);

  useEffect(() => {
    if (loadingPermissions || !authUser) return;

    const unsubscribe = onValue(ref(realtimeDb, "PRODUCCION_PROGRAMACION"), (snapshot) => {
      const data = snapshot.exists() ? snapshot.val() || {} : {};
      const rows = Object.entries(data).map(([id, value]: any) => ({
        id,
        tipo: value?.tipo === "capacitacion" ? "capacitacion" : "mantenimiento",
        titulo: normalizeText(value?.titulo || value?.tipo || "Actividad"),
        planta: normalizePlant(value?.planta) || "Planta 1",
        fecha: normalizeText(value?.fecha),
        horaInicio: normalizeText(value?.horaInicio),
        horaFin: normalizeText(value?.horaFin),
        descripcion: normalizeText(value?.descripcion),
        createdAt: normalizeText(value?.createdAt),
      })) as BloqueProgramado[];
      setBloques(rows);
    });

    return () => unsubscribe();
  }, [loadingPermissions, authUser, realtimeDb]);

  useEffect(() => {
    const nextCards: Record<Planta, PlantaCard[]> = {
      "Planta 1": [],
      "Planta 2": [],
      "Planta 3": [],
      "Planta 4": [],
    };

    orders.forEach((order) => {
      order.items.forEach((item, index) => {
        const plant = normalizePlant(item.planta || item.plantaAsignada || item.plant) || "Planta 1";
        const uid = `${order.id}__${item.itemKey || index}`;
        const productName = normalizeText(
          item.producto || item.descripcion || item.nombreProducto || item.productName || "Producto sin nombre",
        );

        nextCards[plant].push({
          uid,
          ordenId: order.id,
          itemKey: item.itemKey || safeKey(index),
          itemIndex: item.rawIndex ?? index,
          ordenNumero: getOrderNumber(order),
          cliente: normalizeDisplayName(order.clienteNombre || order.cliente || item.cliente || item.clienteNombre || "Sin cliente") || "Sin cliente",
          fecha: normalizeText(order.fecha),
          producto: productName,
          codigoProducto: normalizeText(item.codigoProducto || item.codigo || item.codigoEnvase || "Sin código"),
          cantidad: item.cantidad || item.total || item.cantidadProducir || 0,
          planta: plant,
          ordenPlanta: Number(item.ordenPlanta ?? item.posicionPlanta ?? index),
          fechaProgramada: normalizeText(item.fechaProgramada || item.fechaProduccion || item.programadoFecha),
          horaInicio: normalizeText(item.horaInicio || item.horaProgramadaInicio || item.programadoHoraInicio),
          horaFin: normalizeText(item.horaFin || item.horaProgramadaFin || item.programadoHoraFin),
          estado: normalizeText(item.estado || order.estado || "creada"),
          orden: order,
          item,
        });
      });
    });

    plantas.forEach((plant) => {
      nextCards[plant].sort((a, b) => {
        if (a.fechaProgramada && b.fechaProgramada && a.fechaProgramada !== b.fechaProgramada) return a.fechaProgramada.localeCompare(b.fechaProgramada);
        if (a.horaInicio && b.horaInicio && a.horaInicio !== b.horaInicio) return a.horaInicio.localeCompare(b.horaInicio);
        if (a.ordenPlanta !== b.ordenPlanta) return a.ordenPlanta - b.ordenPlanta;
        return a.ordenNumero.localeCompare(b.ordenNumero);
      });
    });

    setCards(nextCards);
  }, [orders]);

  const persistPlantOrder = async (nextCards: Record<Planta, PlantaCard[]>, movedUid?: string) => {
    const updates: Record<string, any> = {};
    const now = new Date().toISOString();

    plantas.forEach((plant) => {
      nextCards[plant].forEach((card, index) => {
        const basePath = `ORDENES_PEDIDO/${card.ordenId}/items/${card.itemIndex}`;
        updates[`${basePath}/planta`] = plant;
        updates[`${basePath}/plantaAsignada`] = plant;
        updates[`${basePath}/ordenPlanta`] = index + 1;
        updates[`${basePath}/actualizadoPlantaAt`] = now;
        updates[`${basePath}/actualizadoPlantaPorUid`] = authUser?.uid || null;
        updates[`${basePath}/actualizadoPlantaPorEmail`] = authUser?.email || null;
        updates[`${basePath}/actualizadoPlantaPorNombre`] = userName;
      });
    });

    setSavingUid(movedUid || "guardando");
    setError("");
    setMessage("");

    try {
      await update(ref(realtimeDb), updates);
      setMessage("Asignación de planta guardada automáticamente.");
      window.setTimeout(() => setMessage(""), 2500);
    } catch (err: any) {
      setError(`No fue posible guardar el cambio de planta. ${err?.message || ""}`);
    } finally {
      setSavingUid("");
    }
  };

  const findScheduleConflict = (
    planta: Planta,
    fecha: string,
    horaInicio: string,
    horaFin: string,
    ignoreUid?: string,
  ) => {
    if (!fecha || !horaInicio || !horaFin) return "";

    for (const plant of plantas) {
      for (const card of cards[plant]) {
        if (card.uid === ignoreUid) continue;
        if (card.planta !== planta || card.fechaProgramada !== fecha) continue;
        if (!card.horaInicio || !card.horaFin) continue;
        if (rangesOverlap(horaInicio, horaFin, card.horaInicio, card.horaFin)) {
          return `Ya existe la orden ${card.ordenNumero} en ${planta} de ${card.horaInicio} a ${card.horaFin}.`;
        }
      }
    }

    const bloqueConflict = bloques.find(
      (bloque) =>
        bloque.planta === planta &&
        bloque.fecha === fecha &&
        bloque.horaInicio &&
        bloque.horaFin &&
        rangesOverlap(horaInicio, horaFin, bloque.horaInicio, bloque.horaFin),
    );

    if (bloqueConflict) {
      return `Ya hay ${bloqueConflict.tipo === "capacitacion" ? "capacitación" : "mantenimiento"}: ${bloqueConflict.titulo} de ${bloqueConflict.horaInicio} a ${bloqueConflict.horaFin}.`;
    }

    return "";
  };

  const openScheduleModal = (card: PlantaCard) => {
    setScheduleModal({
      card,
      planta: card.planta,
      fecha: card.fechaProgramada || new Date().toISOString().slice(0, 10),
      horaInicio: card.horaInicio || "08:00",
      horaFin: card.horaFin || "09:00",
    });
    setError("");
    setMessage("");
  };

  const saveScheduleModal = async () => {
    if (!scheduleModal) return;
    const { card, planta, fecha, horaInicio, horaFin } = scheduleModal;

    if (!fecha || !horaInicio || !horaFin) {
      setError("Selecciona fecha, hora inicial y hora final.");
      return;
    }

    if (minutesFromTime(horaFin) <= minutesFromTime(horaInicio)) {
      setError("La hora final debe ser mayor a la hora inicial.");
      return;
    }

    const conflict = findScheduleConflict(planta, fecha, horaInicio, horaFin, card.uid);
    if (conflict) {
      setError(conflict);
      return;
    }

    const basePath = `ORDENES_PEDIDO/${card.ordenId}/items/${card.itemIndex}`;
    const now = new Date().toISOString();

    setSavingUid(card.uid);
    setError("");
    setMessage("");

    try {
      await update(ref(realtimeDb), {
        [`${basePath}/planta`]: planta,
        [`${basePath}/plantaAsignada`]: planta,
        [`${basePath}/fechaProgramada`]: fecha,
        [`${basePath}/fechaProduccion`]: fecha,
        [`${basePath}/horaInicio`]: horaInicio,
        [`${basePath}/horaFin`]: horaFin,
        [`${basePath}/programadoAt`]: now,
        [`${basePath}/programadoPorUid`]: authUser?.uid || null,
        [`${basePath}/programadoPorEmail`]: authUser?.email || null,
        [`${basePath}/programadoPorNombre`]: userName,
      });
      setScheduleModal(null);
      setMessage("Horario de producción asignado correctamente.");
      window.setTimeout(() => setMessage(""), 2500);
    } catch (err: any) {
      setError(`No fue posible asignar el horario. ${err?.message || ""}`);
    } finally {
      setSavingUid("");
    }
  };

  const openBlockModal = (tipo: "mantenimiento" | "capacitacion") => {
    setBlockModal({
      tipo,
      titulo: tipo === "capacitacion" ? "Capacitación" : "Mantenimiento",
      planta: "Planta 1",
      fecha: new Date().toISOString().slice(0, 10),
      horaInicio: "08:00",
      horaFin: "09:00",
      descripcion: "",
    });
    setError("");
    setMessage("");
  };

  const saveBlockModal = async () => {
    if (!blockModal) return;

    if (!blockModal.titulo.trim() || !blockModal.fecha || !blockModal.horaInicio || !blockModal.horaFin) {
      setError("Completa título, planta, fecha y horario.");
      return;
    }

    if (minutesFromTime(blockModal.horaFin) <= minutesFromTime(blockModal.horaInicio)) {
      setError("La hora final debe ser mayor a la hora inicial.");
      return;
    }

    const conflict = findScheduleConflict(blockModal.planta, blockModal.fecha, blockModal.horaInicio, blockModal.horaFin);
    if (conflict) {
      setError(conflict);
      return;
    }

    setSavingUid("bloque");
    setError("");
    setMessage("");

    try {
      const newRef = push(ref(realtimeDb, "PRODUCCION_PROGRAMACION"));
      await update(ref(realtimeDb), {
        [`PRODUCCION_PROGRAMACION/${newRef.key}`]: {
          ...blockModal,
          titulo: blockModal.titulo.trim(),
          descripcion: blockModal.descripcion.trim(),
          createdAt: new Date().toISOString(),
          createdByUid: authUser?.uid || null,
          createdByEmail: authUser?.email || null,
          createdByName: userName,
        },
      });
      setBlockModal(null);
      setMessage("Actividad programada correctamente.");
      window.setTimeout(() => setMessage(""), 2500);
    } catch (err: any) {
      setError(`No fue posible programar la actividad. ${err?.message || ""}`);
    } finally {
      setSavingUid("");
    }
  };

  const deleteBlock = async (bloque: BloqueProgramado) => {
    const confirmed = window.confirm(`¿Eliminar ${bloque.titulo} de ${bloque.planta}?`);
    if (!confirmed) return;

    setSavingUid(bloque.id);
    setError("");
    setMessage("");

    try {
      await update(ref(realtimeDb), {
        [`PRODUCCION_PROGRAMACION/${bloque.id}`]: null,
      });
      setMessage("Actividad eliminada.");
      window.setTimeout(() => setMessage(""), 2500);
    } catch (err: any) {
      setError(`No fue posible eliminar la actividad. ${err?.message || ""}`);
    } finally {
      setSavingUid("");
    }
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, card: PlantaCard) => {
    const payload: DragPayload = { uid: card.uid, fromPlant: card.planta };
    setDragging(payload);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
  };

  const handleDrop = async (event: DragEvent<HTMLElement>, targetPlant: Planta, targetUid?: string) => {
    event.preventDefault();

    let payload = dragging;
    try {
      const raw = event.dataTransfer.getData("application/json");
      if (raw) payload = JSON.parse(raw);
    } catch {
      // Mantiene payload local si falla dataTransfer.
    }

    if (!payload?.uid) return;

    const sourcePlant = payload.fromPlant;
    const sourceCards = [...cards[sourcePlant]];
    const movingIndex = sourceCards.findIndex((card) => card.uid === payload.uid);
    if (movingIndex < 0) return;

    const movingCard = { ...sourceCards[movingIndex], planta: targetPlant };
    sourceCards.splice(movingIndex, 1);

    const targetCards = sourcePlant === targetPlant ? sourceCards : [...cards[targetPlant]];
    let targetIndex = targetUid ? targetCards.findIndex((card) => card.uid === targetUid) : targetCards.length;
    if (targetIndex < 0) targetIndex = targetCards.length;

    targetCards.splice(targetIndex, 0, movingCard);

    const nextCards: Record<Planta, PlantaCard[]> = {
      ...cards,
      [sourcePlant]: sourcePlant === targetPlant ? targetCards : sourceCards,
      [targetPlant]: targetCards,
    };

    plantas.forEach((plant) => {
      nextCards[plant] = nextCards[plant].map((card, index) => ({
        ...card,
        planta: plant,
        ordenPlanta: index + 1,
      }));
    });

    setCards(nextCards);
    setDragging(null);
    await persistPlantOrder(nextCards, movingCard.uid);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
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

  if (!isActive) {
    return <NoPermission title="Usuario inactivo" message="Tu usuario está desactivado. Contacta al administrador." />;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
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
        userRole={userRole}
      />

      <section className={`${sidebarWidth} pt-16 lg:pt-0 transition-all duration-300`}>
        <header className="hidden lg:flex h-20 bg-white border-b border-slate-200 px-8 items-center justify-between sticky top-0 z-30">
          <div>
            <nav aria-label="Ruta de navegación" className="flex items-center gap-2 text-sm text-slate-500">
              <Link href="/panel" className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-[#244C5A] text-white hover:bg-[#1d3d49] transition" title="Ir al dashboard">
                <Home size={18} />
              </Link>
              <Link href="/panel" className="font-semibold hover:text-[#244C5A] transition">
                Panel administrativo
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">Producción</span>
              <span className="text-slate-300">/</span>
              <span className="font-black text-slate-900">Producción x Planta</span>
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

        <section className="max-w-[1800px] mx-auto px-5 sm:px-8 py-6 space-y-5">
          {(error || message) && (
            <div className="space-y-2">
              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError("")}> <X size={18} /> </button>
                </div>
              )}
              {message && (
                <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">
                  {message}
                </div>
              )}
            </div>
          )}

          <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">Cronograma</p>
                <h2 className="text-xl sm:text-2xl font-black mt-1">Producción, mantenimientos y capacitaciones</h2>
                <p className="text-slate-500 text-sm mt-1">Antes de asignar una orden a una planta y horario, el sistema valida si ya hay algo programado.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={() => openBlockModal("mantenimiento")} className="rounded-2xl bg-[#244C5A] px-4 py-3 text-sm font-black text-white hover:bg-[#1b3b46] flex items-center justify-center gap-2 transition">
                  <Wrench size={18} /> Asignar mantenimiento
                </button>
                <button type="button" onClick={() => openBlockModal("capacitacion")} className="rounded-2xl border border-[#244C5A] px-4 py-3 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white flex items-center justify-center gap-2 transition">
                  <Plus size={18} /> Asignar capacitación
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {plantas.map((plant) => {
                const theme = plantTheme[plant];
                const ordenesProgramadas = cards[plant].filter((card) => card.fechaProgramada && card.horaInicio && card.horaFin);
                const bloquesPlanta = bloques.filter((bloque) => bloque.planta === plant);
                const total = ordenesProgramadas.length + bloquesPlanta.length;

                return (
                  <div key={`${plant}-cronograma`} className={`rounded-3xl border ${theme.border} ${theme.panel} p-4 min-h-[150px]`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`font-black ${theme.title}`}>{plant}</h3>
                      <span className={`rounded-full ${theme.badge} px-3 py-1 text-xs font-black`}>{total}</span>
                    </div>
                    <div className="mt-3 space-y-2 max-h-56 overflow-auto pr-1">
                      {total === 0 ? (
                        <p className="text-xs text-slate-400 font-semibold">Sin programación.</p>
                      ) : (
                        <>
                          {ordenesProgramadas.map((card) => (
                            <div key={`${card.uid}-schedule`} className={`rounded-2xl bg-white border ${theme.border} px-3 py-2`}>
                              <p className={`text-[11px] font-black ${theme.label}`}>{card.fechaProgramada} · {card.horaInicio}-{card.horaFin}</p>
                              <p className="text-xs font-black text-slate-800 truncate">OP {card.ordenNumero}</p>
                              <p className="text-[11px] text-slate-500 truncate">{card.producto}</p>
                            </div>
                          ))}
                          {bloquesPlanta.map((bloque) => (
                            <div key={bloque.id} className="rounded-2xl bg-amber-50 border border-amber-100 px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-black text-amber-700">{bloque.fecha} · {bloque.horaInicio}-{bloque.horaFin}</p>
                                  <p className="text-xs font-black text-slate-800 truncate">{bloque.titulo}</p>
                                  <p className="text-[11px] text-slate-500 capitalize">{bloque.tipo}</p>
                                </div>
                                <button type="button" onClick={() => deleteBlock(bloque)} className="shrink-0 w-7 h-7 rounded-xl bg-white text-red-600 border border-red-100 flex items-center justify-center hover:bg-red-50">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5">
            {plantas.map((plant) => {
              const theme = plantTheme[plant];

              return (
              <div
                key={plant}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, plant)}
                className={`rounded-[24px] sm:rounded-[30px] border ${theme.border} ${theme.panel} shadow-sm overflow-hidden min-h-[520px] sm:min-h-[680px]`}
              >
                <div className={`px-3 sm:px-5 py-4 border-b ${theme.header} flex items-center justify-between gap-3`}>
                  <div>
                    <p className={`text-xs font-black uppercase tracking-wide ${theme.label}`}>
                      Producción
                    </p>
                    <h2 className={`text-base sm:text-xl font-black ${theme.title}`}>{plant}</h2>
                  </div>
                  <span className={`rounded-full ${theme.badge} px-3 py-1 text-xs font-black`}>
                    {cards[plant].length}
                  </span>
                </div>

                {loading ? (
                  <div className="p-6 flex items-center justify-center gap-2 text-slate-500 font-semibold">
                    <Loader2 className="animate-spin" size={20} />
                    Cargando...
                  </div>
                ) : cards[plant].length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400 font-semibold">
                    Arrastra aquí órdenes asignadas a {plant.toLowerCase()}.
                  </div>
                ) : (
                  <div className="p-2 sm:p-4 space-y-3">
                    {cards[plant].map((card) => (
                      <div
                        key={card.uid}
                        draggable
                        onDragStart={(event) => handleDragStart(event, card)}
                        onDragEnd={() => setDragging(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, plant, card.uid)}
                        className={`w-full text-left rounded-2xl sm:rounded-3xl border px-2.5 sm:px-4 py-3 sm:py-4 shadow-sm transition cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-md ${
                          savingUid === card.uid
                            ? theme.cardSaving
                            : theme.cardNormal
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <GripVertical className="text-slate-300 shrink-0 mt-1" size={20} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm font-black ${theme.label} truncate`}>
                                OP {card.ordenNumero}
                              </p>
                              {savingUid === card.uid && <Loader2 className="animate-spin text-[#244C5A]" size={16} />}
                            </div>
                            <p className="text-xs sm:text-sm font-black text-slate-900 mt-1 line-clamp-2">
                              {card.producto}
                            </p>
                            <p className="text-[11px] sm:text-xs text-slate-500 mt-2 truncate">
                              {card.cliente}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-black">
                              <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-1">
                                {card.codigoProducto}
                              </span>
                              <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-1">
                                Cant: {normalizeNumber(card.cantidad)}
                              </span>
                              {card.fechaProgramada && card.horaInicio && card.horaFin && (
                                <span className="rounded-full bg-amber-50 text-amber-700 px-2 py-1">
                                  {card.fechaProgramada} · {card.horaInicio}-{card.horaFin}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openScheduleModal(card);
                              }}
                              className={`mt-3 w-full rounded-2xl border px-3 py-2 text-[11px] font-black transition flex items-center justify-center gap-2 ${theme.button}`}
                            >
                              <Clock size={15} />
                              {card.fechaProgramada ? "Cambiar horario" : "Asignar día y hora"}
                            </button>
                            <p className="mt-2 text-[10px] text-slate-400 font-semibold">
                              {card.fechaProgramada ? formatSchedule(card.fechaProgramada, card.horaInicio, card.horaFin) : "Sin horario asignado"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </section>
        </section>
      </section>

      {scheduleModal && (
        <div className="fixed inset-0 z-[999] bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-[520px] rounded-[28px] bg-white shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">Programar orden</p>
                <h3 className="text-xl font-black mt-1">OP {scheduleModal.card.ordenNumero}</h3>
                <p className="text-sm text-slate-500 mt-1">{scheduleModal.card.producto}</p>
              </div>
              <button type="button" onClick={() => setScheduleModal(null)} className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-black text-slate-700">Planta</label>
                <select value={scheduleModal.planta} onChange={(event) => setScheduleModal((current) => current ? { ...current, planta: event.target.value as Planta } : current)} className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#244C5A]">
                  {plantas.map((plant) => <option key={plant} value={plant}>{plant}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-black text-slate-700">Fecha</label>
                  <input type="date" value={scheduleModal.fecha} onChange={(event) => setScheduleModal((current) => current ? { ...current, fecha: event.target.value } : current)} className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#244C5A]" />
                </div>
                <div>
                  <label className="text-sm font-black text-slate-700">Hora inicio</label>
                  <input type="time" value={scheduleModal.horaInicio} onChange={(event) => setScheduleModal((current) => current ? { ...current, horaInicio: event.target.value } : current)} className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#244C5A]" />
                </div>
                <div>
                  <label className="text-sm font-black text-slate-700">Hora fin</label>
                  <input type="time" value={scheduleModal.horaFin} onChange={(event) => setScheduleModal((current) => current ? { ...current, horaFin: event.target.value } : current)} className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#244C5A]" />
                </div>
              </div>
              <button type="button" onClick={saveScheduleModal} disabled={savingUid === scheduleModal.card.uid} className="w-full rounded-2xl bg-[#244C5A] px-5 py-3 text-white font-black hover:bg-[#1b3b46] disabled:opacity-70 flex items-center justify-center gap-2">
                {savingUid === scheduleModal.card.uid ? <Loader2 className="animate-spin" size={18} /> : <Clock size={18} />}
                Guardar horario
              </button>
            </div>
          </div>
        </div>
      )}

      {blockModal && (
        <div className="fixed inset-0 z-[999] bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-[560px] rounded-[28px] bg-white shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">Actividad de planta</p>
                <h3 className="text-xl font-black mt-1 capitalize">Asignar {blockModal.tipo}</h3>
              </div>
              <button type="button" onClick={() => setBlockModal(null)} className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-black text-slate-700">Título</label>
                <input type="text" value={blockModal.titulo} onChange={(event) => setBlockModal((current) => current ? { ...current, titulo: event.target.value } : current)} className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#244C5A]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-sm font-black text-slate-700">Planta</label>
                  <select value={blockModal.planta} onChange={(event) => setBlockModal((current) => current ? { ...current, planta: event.target.value as Planta } : current)} className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#244C5A]">
                    {plantas.map((plant) => <option key={plant} value={plant}>{plant}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-black text-slate-700">Fecha</label>
                  <input type="date" value={blockModal.fecha} onChange={(event) => setBlockModal((current) => current ? { ...current, fecha: event.target.value } : current)} className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#244C5A]" />
                </div>
                <div>
                  <label className="text-sm font-black text-slate-700">Inicio</label>
                  <input type="time" value={blockModal.horaInicio} onChange={(event) => setBlockModal((current) => current ? { ...current, horaInicio: event.target.value } : current)} className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#244C5A]" />
                </div>
                <div>
                  <label className="text-sm font-black text-slate-700">Fin</label>
                  <input type="time" value={blockModal.horaFin} onChange={(event) => setBlockModal((current) => current ? { ...current, horaFin: event.target.value } : current)} className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#244C5A]" />
                </div>
              </div>
              <div>
                <label className="text-sm font-black text-slate-700">Descripción</label>
                <textarea value={blockModal.descripcion} onChange={(event) => setBlockModal((current) => current ? { ...current, descripcion: event.target.value } : current)} rows={3} className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#244C5A]" />
              </div>
              <button type="button" onClick={saveBlockModal} disabled={savingUid === "bloque"} className="w-full rounded-2xl bg-[#244C5A] px-5 py-3 text-white font-black hover:bg-[#1b3b46] disabled:opacity-70 flex items-center justify-center gap-2">
                {savingUid === "bloque" ? <Loader2 className="animate-spin" size={18} /> : <CalendarDays size={18} />}
                Guardar actividad
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div className={`px-4 pt-6 pb-5 border-b border-white/10 flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
            <Link href="/panel" onClick={() => setSidebarOpen(false)} className="flex items-center justify-center min-h-[56px]">
              <Image src="/logo.png" alt="Nuall" width={sidebarCollapsed ? 48 : 145} height={70} priority className="object-contain" />
            </Link>

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
                <p className="text-xs text-[#244C5A]/70 truncate mt-1">{userEmail}</p>
                <p className="text-xs text-[#244C5A]/70 truncate mt-1">Rol: {userRole || "Sin rol"}</p>
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

            {menuSections.map((section) => {
              const SectionIcon = section.icon;
              const isOpen = openSections[section.title] ?? false;

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
                        const active = item.href === "/panel/produccionxplanta";
                        return (
                          <Link
                            key={item.title}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition ${
                              active ? "bg-white text-[#244C5A] font-black" : "text-white/75 hover:bg-white/10 hover:text-white"
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
              onClick={handleLogout}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 font-semibold transition ${sidebarCollapsed ? "px-0" : ""}`}
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
