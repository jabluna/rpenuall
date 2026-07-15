"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  Home,
  Loader2,
  LogOut,
  Menu,
  PackageCheck,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Search,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Tags,
  Timeline,
  Truck,
  UserCog,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, dbRealtime } from "@/lib/firebase";
import { useUserPermissions } from "@/lib/useUserPermissions";

type EstadoProceso = "sin_verificar" | "aceptado" | "rechazado";

type EstadoMeta = {
  estado: EstadoProceso;
  usuario?: string;
  uid?: string | null;
  email?: string | null;
  fecha?: string;
  rol?: string;
  motivo?: string;
};

type PedidoItem = {
  codigo?: string;
  producto?: string;
  cantidad?: string | number;
  consecutivo?: string | number;
  planta?: string;
  procesos?: Record<string, EstadoProceso>;
  estadosMeta?: Record<string, EstadoMeta>;
  historialEstados?: Record<string, EstadoMeta[]>;
};

type PedidoGuardado = {
  id: string;
  ordenPedido?: string;
  ordenBase?: string | number;
  fecha?: string;
  cliente?: { codigo_cliente?: string; nombre?: string };
  items?: PedidoItem[];
  estadoGeneral?: string;
  creadoPor?: string;
  creadoPorEmail?: string | null;
  creadoAt?: string;
  actualizadoPor?: string;
  actualizadoPorEmail?: string | null;
  actualizadoAt?: string;
  responsableProduccion?: string;
  responsableProduccionRol?: string;
};

type ReservaInsumo = {
  key: string;
  path: string;
  proveedor?: string;
  proveedorCodigo?: string;
  productoProveedor?: string;
  codigoInsumo?: string;
  descripcionInsumo?: string;
  tipoEmpaque?: string;
  cantidad?: number;
  movimientoKey?: string;
  stockReservadoAnterior?: number;
  stockReservadoNuevo?: number;
  stockDisponible?: number;
  stockTeorico?: number;
  estado?: string;
  createdAt?: string;
  productoPedidoCodigo?: string;
  productoPedido?: string;
  ordenPedido?: string;
  ordenPedidoId?: string;
};

type SidebarItem = { title: string; icon: any; href: string; module?: string };
type SidebarSection = { title: string; icon: any; items: SidebarItem[] };

const sidebarSections: SidebarSection[] = [
  {
    title: "Usuarios",
    icon: Users,
    items: [
      { title: "Crear / ver roles", icon: ShieldCheck, href: "/panel/roles", module: "roles" },
      { title: "Crear / ver usuarios", icon: UserCog, href: "/panel/usuarios", module: "usuarios" },
    ],
  },
  {
    title: "Bodega",
    icon: Boxes,
    items: [
      { title: "Listado / Movimiento de Proveedores", icon: Truck, href: "/panel/proveedores-bodega", module: "proveedoresBodega" },
    ],
  },
  {
    title: "Pedidos y Producción",
    icon: ClipboardList,
    items: [
      { title: "Crear / ver clientes", icon: Users, href: "/panel/clientes", module: "clientes" },
      { title: "Crear orden de producción", icon: PlusCircle, href: "/panel/pedidos" },
      { title: "Ver órdenes de producción", icon: Eye, href: "/panel/ordenes_creadas" },
      { title: "Trazabilidad de pedidos", icon: Timeline, href: "/panel/trazabilidad-pedidos" },
    ],
  },
  {
    title: "Compras",
    icon: ShoppingCart,
    items: [
      { title: "Crear órdenes de compra", icon: PlusCircle, href: "/panel/compras2" },
      { title: "Ver órdenes de compra", icon: Eye, href: "/panel/gestion-compras2" },
    ],
  },
  {
    title: "Etiquetas",
    icon: Tag,
    items: [
      { title: "Lista etiquetas", icon: Tags, href: "/panel/inventario-etiquetas", module: "inventarioEtiquetas" },
      { title: "Crear orden compra etiquetas", icon: FileText, href: "/panel/compra-etiqueta" },
    ],
  },
];

const currentPageHref = "/panel/trazabilidad-pedidos";

const procesos = [
  { key: "materias_primas", titulo: "Materias primas", rol: "investigación" },
  { key: "etiquetas", titulo: "Etiquetas", rol: "etiquetas" },
  { key: "envase", titulo: "Envase", rol: "bodega" },
  { key: "cucharas", titulo: "Cucharas", rol: "bodega" },
  { key: "termo_sello", titulo: "Termo / sello", rol: "bodega" },
  { key: "tapas", titulo: "Tapas", rol: "bodega" },
  { key: "liner", titulo: "Liner", rol: "bodega" },
  { key: "orden_premezcla", titulo: "Orden premezcla", rol: "producción" },
  { key: "verificacion_pre", titulo: "Verificación pre", rol: "investigación" },
  { key: "pre_mezcla", titulo: "Pre mezcla", rol: "investigación" },
  { key: "orden_mezcla", titulo: "Orden mezcla", rol: "producción" },
  { key: "verificacion_mez", titulo: "Verificación mez", rol: "investigación" },
  { key: "mezcla", titulo: "Mezcla", rol: "investigación" },
  { key: "orden_acondicionamiento", titulo: "Orden acondicionamiento", rol: "producción" },
  { key: "envasado", titulo: "Envasado", rol: "planta" },
  { key: "acondicionado", titulo: "Acondicionado", rol: "planta" },
  { key: "batch_record", titulo: "Batch record", rol: "planta" },
  { key: "almacenado", titulo: "Almacenado", rol: "bodega" },
  { key: "remisionado", titulo: "Remisionado", rol: "bodega" },
  { key: "facturado", titulo: "Facturado", rol: "contabilidad" },
  { key: "entregado", titulo: "Entregado", rol: "bodega" },
];

function crearProcesosIniciales() {
  return procesos.reduce((acc, proceso) => {
    acc[proceso.key] = "sin_verificar";
    return acc;
  }, {} as Record<string, EstadoProceso>);
}

function normalizarItem(item: Partial<PedidoItem>): PedidoItem {
  return {
    codigo: item.codigo || "",
    producto: item.producto || "",
    cantidad: item.cantidad || "",
    consecutivo: item.consecutivo || "",
    planta: item.planta || "",
    procesos: { ...crearProcesosIniciales(), ...(item.procesos || {}) },
    estadosMeta: item.estadosMeta || {},
    historialEstados: item.historialEstados || {},
  };
}

function formatoFechaHora(value?: string) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(toNumber(value));
}

function mostrarEstado(estado?: EstadoProceso) {
  if (estado === "aceptado") return "Aceptado";
  if (estado === "rechazado") return "Rechazado";
  return "Sin verificar";
}

function estadoBadgeClass(estado?: EstadoProceso) {
  if (estado === "aceptado") return "bg-green-100 text-green-700 border-green-200";
  if (estado === "rechazado") return "bg-red-100 text-red-700 border-red-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function calcularEstadoOrden(pedido: PedidoGuardado) {
  const items = pedido.items || [];
  if (items.length === 0) return "creada";

  const estados: EstadoProceso[] = [];
  items.forEach((item) => procesos.forEach((proceso) => estados.push(item.procesos?.[proceso.key] || "sin_verificar")));

  if (estados.some((estado) => estado === "rechazado")) return "con_rechazos";
  if (estados.length > 0 && estados.every((estado) => estado === "aceptado")) return "completada";
  if (estados.every((estado) => estado === "sin_verificar")) return "creada";
  return "incompleta";
}

function mostrarEstadoOrden(estado: string) {
  if (estado === "con_rechazos") return "Con rechazos";
  if (estado === "incompleta") return "Incompleta";
  if (estado === "completada") return "Completada";
  return "Creada";
}

function estadoOrdenClass(estado: string) {
  if (estado === "con_rechazos") return "bg-red-100 text-red-700 border-red-200";
  if (estado === "incompleta") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (estado === "completada") return "bg-green-100 text-green-700 border-green-200";
  return "bg-[#244C5A]/10 text-[#244C5A] border-[#244C5A]/10";
}

function recolectarTimeline(pedido: PedidoGuardado) {
  const eventos: Array<{ fecha: string; titulo: string; descripcion: string; estado?: EstadoProceso; usuario?: string; rol?: string; motivo?: string }> = [];

  if (pedido.creadoAt) {
    eventos.push({ fecha: pedido.creadoAt, titulo: "Orden creada", descripcion: pedido.ordenPedido || "Orden", usuario: pedido.creadoPor || pedido.creadoPorEmail || "Usuario" });
  }

  (pedido.items || []).forEach((item) => {
    procesos.forEach((proceso) => {
      const historial = item.historialEstados?.[proceso.key] || [];
      historial.forEach((registro) => {
        if (!registro?.fecha || registro.estado === "sin_verificar") return;
        eventos.push({
          fecha: registro.fecha,
          titulo: `${proceso.titulo} · ${mostrarEstado(registro.estado)}`,
          descripcion: `${item.codigo || ""} ${item.producto || ""}`.trim(),
          estado: registro.estado,
          usuario: registro.usuario || registro.email || "Usuario",
          rol: registro.rol,
          motivo: registro.motivo,
        });
      });
    });
  });

  if (pedido.actualizadoAt && pedido.actualizadoAt !== pedido.creadoAt) {
    eventos.push({ fecha: pedido.actualizadoAt, titulo: "Última actualización", descripcion: "Estados o datos de la orden actualizados", usuario: pedido.actualizadoPor || pedido.actualizadoPorEmail || "Usuario" });
  }

  return eventos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
}

function recolectarReservas(proveedoresData: any, pedido: PedidoGuardado): ReservaInsumo[] {
  const reservas: ReservaInsumo[] = [];
  const orden = String(pedido.ordenPedido || "");
  const pedidoId = String(pedido.id || "");

  Object.entries(proveedoresData || {}).forEach(([codigoProveedor, proveedorNode]: any) => {
    Object.entries(proveedorNode || {}).forEach(([nombreProveedor, proveedorInfo]: any) => {
      Object.entries(proveedorInfo?.PRODUCTOS || {}).forEach(([codigoProductoProveedor, productoInfo]: any) => {
        Object.entries(productoInfo?.RESERVADO_PEDIDOS || {}).forEach(([reservaKey, reserva]: any) => {
          const coincideOrden = String(reserva?.ordenPedido || "") === orden;
          const coincideId = pedidoId && String(reserva?.ordenPedidoId || "") === pedidoId;
          if (!coincideOrden && !coincideId) return;

          reservas.push({
            key: reservaKey,
            path: `PROVEEDORES/${codigoProveedor}/${nombreProveedor}/PRODUCTOS/${codigoProductoProveedor}/RESERVADO_PEDIDOS/${reservaKey}`,
            proveedor: reserva?.proveedor || nombreProveedor,
            proveedorCodigo: codigoProveedor,
            productoProveedor: productoInfo?.DATOS_PRODUCTO?.PRODUCTO || reserva?.descripcionInsumo || codigoProductoProveedor,
            codigoInsumo: reserva?.codigoInsumo || codigoProductoProveedor,
            descripcionInsumo: reserva?.descripcionInsumo,
            tipoEmpaque: reserva?.tipoEmpaque,
            cantidad: toNumber(reserva?.cantidad),
            movimientoKey: reserva?.movimientoKey,
            stockReservadoAnterior: toNumber(reserva?.stockReservadoAnterior),
            stockReservadoNuevo: toNumber(reserva?.stockReservadoNuevo),
            stockDisponible: toNumber(reserva?.stockDisponible),
            stockTeorico: toNumber(reserva?.stockTeorico),
            estado: reserva?.estado,
            createdAt: reserva?.createdAt,
            productoPedidoCodigo: reserva?.productoPedidoCodigo,
            productoPedido: reserva?.productoPedido,
            ordenPedido: reserva?.ordenPedido,
            ordenPedidoId: reserva?.ordenPedidoId,
          });
        });
      });
    });
  });

  return reservas.sort((a, b) => String(a.productoPedidoCodigo || "").localeCompare(String(b.productoPedidoCodigo || "")));
}

export default function TrazabilidadPedidosPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ "Pedidos y Producción": true });
  const { authUser, profile, loading: loadingPermissions, canView } = useUserPermissions();

  const [pedidos, setPedidos] = useState<PedidoGuardado[]>([]);
  const [reservas, setReservas] = useState<ReservaInsumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState("");

  const userName = useMemo(() => profile?.nombre || authUser?.displayName || authUser?.email?.split("@")[0] || "Usuario", [profile, authUser]);

  const filteredSidebarSections = useMemo(() => sidebarSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => (item.module && canView ? canView(item.module as any) : true)),
  })).filter((section) => section.items.length > 0), [canView]);

  const sidebarPadding = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

  const pedidoSeleccionado = useMemo(() => pedidos.find((pedido) => pedido.id === pedidoSeleccionadoId) || pedidos[0] || null, [pedidos, pedidoSeleccionadoId]);
  const estadoOrden = pedidoSeleccionado ? calcularEstadoOrden(pedidoSeleccionado) : "creada";
  const timeline = pedidoSeleccionado ? recolectarTimeline(pedidoSeleccionado) : [];
  const totalProcesos = (pedidoSeleccionado?.items?.length || 0) * procesos.length;
  const aceptados = (pedidoSeleccionado?.items || []).reduce((acc, item) => acc + procesos.filter((proceso) => item.procesos?.[proceso.key] === "aceptado").length, 0);
  const rechazados = (pedidoSeleccionado?.items || []).reduce((acc, item) => acc + procesos.filter((proceso) => item.procesos?.[proceso.key] === "rechazado").length, 0);
  const avance = totalProcesos > 0 ? Math.round((aceptados / totalProcesos) * 100) : 0;

  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return pedidos.slice(0, 25);
    return pedidos.filter((pedido) => [pedido.ordenPedido, pedido.fecha, pedido.cliente?.codigo_cliente, pedido.cliente?.nombre, pedido.creadoPor]
      .join(" ").toLowerCase().includes(q)).slice(0, 40);
  }, [pedidos, busqueda]);

  const reservasSeleccionadas = useMemo(() => {
    if (!pedidoSeleccionado) return [];
    return reservas.filter((reserva) => reserva.ordenPedido === pedidoSeleccionado.ordenPedido || reserva.ordenPedidoId === pedidoSeleccionado.id);
  }, [reservas, pedidoSeleccionado]);

  const reservasPorProducto = useMemo(() => {
    return reservasSeleccionadas.reduce((acc, reserva) => {
      const key = String(reserva.productoPedidoCodigo || "SIN-CODIGO");
      if (!acc[key]) acc[key] = [];
      acc[key].push(reserva);
      return acc;
    }, {} as Record<string, ReservaInsumo[]>);
  }, [reservasSeleccionadas]);

  useEffect(() => {
    if (!loadingPermissions && !authUser) router.replace("/");
  }, [loadingPermissions, authUser, router]);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      setError("");
      try {
        const [pedidosSnap, proveedoresSnap] = await Promise.all([
          get(ref(dbRealtime, "ORDENES_PEDIDO")),
          get(ref(dbRealtime, "PROVEEDORES")),
        ]);

        const data = pedidosSnap.exists() ? pedidosSnap.val() : {};
        const lista = Object.entries(data || {}).map(([id, value]: any) => ({
          id,
          ...value,
          items: (value?.items || []).map((item: PedidoItem) => normalizarItem(item)),
        })) as PedidoGuardado[];

        lista.sort((a, b) => new Date(b.creadoAt || b.fecha || 0).getTime() - new Date(a.creadoAt || a.fecha || 0).getTime());
        setPedidos(lista);
        setPedidoSeleccionadoId((actual) => actual || lista[0]?.id || "");

        if (lista.length > 0) {
          const proveedoresData = proveedoresSnap.exists() ? proveedoresSnap.val() : {};
          const todasReservas = lista.flatMap((pedido) => recolectarReservas(proveedoresData, pedido));
          setReservas(todasReservas);
        } else {
          setReservas([]);
        }
      } catch (err: any) {
        setError(`No fue posible cargar la trazabilidad. ${err?.message || ""}`);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, []);

  useEffect(() => {
    if (!pedidoSeleccionadoId && pedidosFiltrados[0]?.id) setPedidoSeleccionadoId(pedidosFiltrados[0].id);
  }, [pedidosFiltrados, pedidoSeleccionadoId]);

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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
        <button type="button" onClick={() => setSidebarOpen(true)} className="w-10 h-10 rounded-2xl bg-[#244C5A] text-white flex items-center justify-center" aria-label="Abrir menú"><Menu size={22} /></button>
        <Image src="/logo.png" alt="Nuall" width={105} height={45} priority className="object-contain" />
        <button type="button" onClick={handleLogout} className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center" aria-label="Cerrar sesión"><LogOut size={20} /></button>
      </div>

      {sidebarOpen && <button type="button" className="fixed inset-0 bg-slate-950/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Cerrar fondo menú" />}

      <aside className={`fixed z-50 inset-y-0 left-0 ${sidebarCollapsed ? "lg:w-[88px]" : "lg:w-[300px]"} w-[300px] bg-[#244C5A] text-white transform transition-all duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-full flex flex-col">
          <div className={`px-4 pt-6 pb-5 border-b border-white/10 flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center justify-center min-h-[56px]"><Image src="/logo.png" alt="Nuall" width={sidebarCollapsed ? 48 : 145} height={70} priority className="object-contain" /></div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSidebarCollapsed((v) => !v)} className="hidden lg:flex w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 items-center justify-center" aria-label="Encoger o ampliar menú">{sidebarCollapsed ? <PanelLeftOpen size={21} /> : <PanelLeftClose size={21} />}</button>
              <button type="button" onClick={() => setSidebarOpen(false)} className="lg:hidden w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center" aria-label="Cerrar menú"><X size={21} /></button>
            </div>
          </div>

          {!sidebarCollapsed && (
            <div className="px-6 py-5">
              <div className="rounded-3xl bg-white/10 border border-white/10 px-4 py-3">
                <p className="text-xs text-white/60">Sesión activa</p>
                <p className="font-bold truncate">{userName}</p>
              </div>
            </div>
          )}

          <nav className="flex-1 px-4 pb-4 space-y-2 overflow-y-auto">
            <Link href="/panel" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-white/85 hover:bg-white/10 hover:text-white transition ${sidebarCollapsed ? "justify-center" : ""}`} title="Panel Principal"><Home size={20} />{!sidebarCollapsed && <span className="font-bold">Panel Principal</span>}</Link>
            {filteredSidebarSections.map((section) => {
              const SectionIcon = section.icon;
              const isOpen = openSections[section.title];
              return (
                <div key={section.title} className="space-y-1">
                  <button type="button" onClick={() => { setOpenSections((current) => ({ ...current, [section.title]: !current[section.title] })); if (sidebarCollapsed) setSidebarCollapsed(false); }} className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-white/90 hover:bg-white/10 hover:text-white transition ${sidebarCollapsed ? "justify-center" : ""}`} title={section.title}>
                    <span className={`flex items-center gap-3 font-bold ${sidebarCollapsed ? "justify-center" : ""}`}><SectionIcon size={20} />{!sidebarCollapsed && section.title}</span>
                    {!sidebarCollapsed && <ChevronDown size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />}
                  </button>
                  {!sidebarCollapsed && isOpen && (
                    <div className="ml-4 pl-3 border-l border-white/15 space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const active = item.href === currentPageHref;
                        return <Link key={item.title} href={item.href} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition ${active ? "bg-white text-[#244C5A] font-black" : "text-white/75 hover:bg-white/10 hover:text-white"}`}><Icon size={18} />{item.title}</Link>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10"><button type="button" onClick={handleLogout} className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 font-semibold transition ${sidebarCollapsed ? "px-0" : ""}`}><LogOut size={19} />{!sidebarCollapsed && "Cerrar sesión"}</button></div>
        </div>
      </aside>

      <section className={`${sidebarPadding} pt-16 lg:pt-0 transition-all duration-300`}>
        <header className="bg-[#244C5A] text-white">
          <div className="max-w-[1600px] mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button type="button" onClick={() => router.push("/panel")} className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition" aria-label="Volver al dashboard"><ArrowLeft size={22} /></button>
              <div className="hidden sm:block bg-white/10 border border-white/15 rounded-3xl px-5 py-2.5"><Image src="/logo.png" alt="Nuall" width={115} height={56} priority /></div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-white/65">Dashboard / Pedidos / Trazabilidad</p>
                <h1 className="text-xl sm:text-3xl font-black truncate">Trazabilidad de pedidos</h1>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <button type="button" onClick={() => router.push("/panel")} className="flex items-center gap-2 bg-white text-[#244C5A] hover:bg-white/90 border border-white rounded-2xl px-4 py-3 font-black transition">Home</button>
              <div className="text-right"><p className="text-sm font-bold truncate max-w-[220px]">{userName}</p><p className="text-xs text-white/60 truncate max-w-[220px]">{authUser?.email}</p></div>
              <button type="button" onClick={handleLogout} className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 rounded-2xl px-4 py-3 font-semibold transition"><LogOut size={18} />Cerrar sesión</button>
            </div>
          </div>
        </header>

        <section className="max-w-[1600px] mx-auto px-5 sm:px-8 py-6 space-y-6">
          {error && <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => setError("")}><X size={18} /></button></div>}

          <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">Buscar y auditar</p>
                <h2 className="text-2xl font-black mt-1">Consulta por orden de producción</h2>
                <p className="text-slate-500 text-sm mt-1">Busca una OP y revisa productos, procesos, responsables, rechazos, línea de tiempo e insumos reservados en bodega.</p>
              </div>
              <div className="relative w-full xl:max-w-xl">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por OP, cliente, fecha o usuario..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20" />
              </div>
            </div>

            {loading ? (
              <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold"><Loader2 className="animate-spin" size={22} />Cargando trazabilidad...</div>
            ) : pedidos.length === 0 ? (
              <div className="p-10 text-center"><ClipboardList className="mx-auto text-[#244C5A]" size={44} /><h3 className="font-black mt-4">No hay órdenes creadas</h3></div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-0">
                <aside className="xl:col-span-4 border-b xl:border-b-0 xl:border-r border-slate-200 bg-slate-50/60 max-h-[720px] overflow-y-auto">
                  {pedidosFiltrados.map((pedido) => {
                    const estado = calcularEstadoOrden(pedido);
                    const active = pedido.id === pedidoSeleccionado?.id;
                    return (
                      <button key={pedido.id} type="button" onClick={() => setPedidoSeleccionadoId(pedido.id)} className={`w-full text-left p-4 border-b border-slate-200 hover:bg-white transition ${active ? "bg-white ring-2 ring-inset ring-[#244C5A]/20" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-black text-[#244C5A] truncate">{pedido.ordenPedido}</p>
                            <p className="text-sm text-slate-600 truncate">{pedido.cliente?.codigo_cliente} · {pedido.cliente?.nombre}</p>
                            <p className="text-xs text-slate-400 mt-1">{pedido.fecha || "Sin fecha"}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${estadoOrdenClass(estado)}`}>{mostrarEstadoOrden(estado)}</span>
                        </div>
                      </button>
                    );
                  })}
                  {pedidosFiltrados.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No se encontraron órdenes con esa búsqueda.</div>}
                </aside>

                <div className="xl:col-span-8 p-5 sm:p-6 space-y-6">
                  {pedidoSeleccionado && (
                    <>
                      <section className="rounded-[28px] border border-slate-200 overflow-hidden">
                        <div className="bg-[#244C5A] text-white p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                          <div>
                            <p className="text-white/65 text-sm font-bold uppercase tracking-wide">Orden seleccionada</p>
                            <h2 className="text-3xl font-black mt-1">{pedidoSeleccionado.ordenPedido}</h2>
                            <p className="text-white/75 mt-1">{pedidoSeleccionado.cliente?.codigo_cliente} · {pedidoSeleccionado.cliente?.nombre}</p>
                          </div>
                          <span className={`rounded-full border px-4 py-2 text-sm font-black bg-white ${estadoOrdenClass(estadoOrden)}`}>{mostrarEstadoOrden(estadoOrden)}</span>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-0 border-b border-slate-200">
                          <div className="p-4 border-r border-slate-200"><p className="text-xs font-black text-slate-400 uppercase">Fecha</p><p className="font-black mt-1">{pedidoSeleccionado.fecha || "—"}</p></div>
                          <div className="p-4 border-r border-slate-200"><p className="text-xs font-black text-slate-400 uppercase">Productos</p><p className="font-black mt-1">{pedidoSeleccionado.items?.length || 0}</p></div>
                          <div className="p-4 border-r border-slate-200"><p className="text-xs font-black text-slate-400 uppercase">Avance</p><p className="font-black mt-1">{avance}%</p></div>
                          <div className="p-4 border-r border-slate-200"><p className="text-xs font-black text-slate-400 uppercase">Aceptados</p><p className="font-black mt-1 text-green-700">{aceptados}</p></div>
                          <div className="p-4"><p className="text-xs font-black text-slate-400 uppercase">Rechazos</p><p className="font-black mt-1 text-red-700">{rechazados}</p></div>
                        </div>

                        <div className="p-5">
                          <div className="h-4 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#244C5A] transition-all" style={{ width: `${avance}%` }} /></div>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4"><strong>Creada por:</strong> {pedidoSeleccionado.creadoPor || pedidoSeleccionado.creadoPorEmail || "Usuario"}<br /><span className="text-slate-500">{formatoFechaHora(pedidoSeleccionado.creadoAt)}</span></div>
                            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4"><strong>Responsable producción:</strong> {pedidoSeleccionado.responsableProduccion || "Aún no hay responsable"}<br /><span className="text-slate-500">{pedidoSeleccionado.responsableProduccionRol || "Sin rol registrado"}</span></div>
                          </div>
                        </div>
                      </section>

                      <section className="bg-white rounded-[28px] border border-slate-200 overflow-hidden">
                        <div className="p-5 border-b border-slate-200 flex items-center gap-3"><PackageCheck className="text-[#244C5A]" /><div><h3 className="font-black text-xl">Productos y procesos</h3><p className="text-sm text-slate-500">Cada producto conserva su avance por etapa.</p></div></div>
                        <div className="divide-y divide-slate-200">
                          {(pedidoSeleccionado.items || []).map((item, index) => {
                            const reservasItem = reservasPorProducto[String(item.codigo || "SIN-CODIGO")] || [];
                            return (
                              <details key={`${item.codigo}-${index}`} className="group open:bg-slate-50/50">
                                <summary className="cursor-pointer list-none p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                  <div>
                                    <p className="font-black text-slate-900">{item.codigo} · {item.producto}</p>
                                    <p className="text-sm text-slate-500">Cantidad: {formatNumber(item.cantidad)} · Consecutivo: {item.consecutivo || "—"} · Planta: {item.planta || "Sin asignar"}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full bg-green-100 text-green-700 border border-green-200 px-3 py-1 text-xs font-black">{procesos.filter((p) => item.procesos?.[p.key] === "aceptado").length} aceptados</span>
                                    <span className="rounded-full bg-red-100 text-red-700 border border-red-200 px-3 py-1 text-xs font-black">{procesos.filter((p) => item.procesos?.[p.key] === "rechazado").length} rechazos</span>
                                    <span className="rounded-full bg-[#244C5A]/10 text-[#244C5A] border border-[#244C5A]/10 px-3 py-1 text-xs font-black">{reservasItem.length} reservas</span>
                                  </div>
                                </summary>

                                <div className="px-5 pb-5 space-y-5">
                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {procesos.map((proceso) => {
                                      const estado = item.procesos?.[proceso.key] || "sin_verificar";
                                      const meta = item.estadosMeta?.[proceso.key];
                                      return (
                                        <div key={proceso.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                                          <div className="flex items-start justify-between gap-2">
                                            <div><p className="font-black text-sm">{proceso.titulo}</p><p className="text-xs text-slate-400">Rol: {proceso.rol}</p></div>
                                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${estadoBadgeClass(estado)}`}>{mostrarEstado(estado)}</span>
                                          </div>
                                          {meta?.fecha && <p className="text-xs text-slate-500 mt-3">{meta.usuario || meta.email || "Usuario"}<br />{formatoFechaHora(meta.fecha)}</p>}
                                          {meta?.motivo && <p className="mt-2 rounded-xl bg-red-50 text-red-700 border border-red-100 px-3 py-2 text-xs"><strong>Motivo:</strong> {meta.motivo}</p>}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="rounded-3xl border border-[#244C5A]/15 bg-[#244C5A]/5 overflow-hidden">
                                    <div className="p-4 border-b border-[#244C5A]/10 flex items-center gap-2 text-[#244C5A]"><PackageSearch size={19} /><h4 className="font-black">Insumos reservados en proveedores-bodega</h4></div>
                                    {reservasItem.length === 0 ? (
                                      <div className="p-4 text-sm text-slate-500">No se encontraron reservas vinculadas a este producto en PROVEEDORES/RESERVADO_PEDIDOS.</div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full min-w-[860px] text-sm">
                                          <thead><tr className="bg-white/70 text-slate-500 text-xs uppercase"><th className="text-left px-4 py-3">Insumo</th><th className="text-left px-4 py-3">Proveedor</th><th className="text-right px-4 py-3">Reservado</th><th className="text-right px-4 py-3">Disponible</th><th className="text-right px-4 py-3">Teórico</th><th className="text-left px-4 py-3">Movimiento</th></tr></thead>
                                          <tbody>{reservasItem.map((reserva) => <tr key={reserva.key} className="border-t border-[#244C5A]/10"><td className="px-4 py-3"><strong>{reserva.codigoInsumo}</strong><br /><span className="text-slate-500">{reserva.descripcionInsumo || reserva.productoProveedor}</span></td><td className="px-4 py-3">{reserva.proveedor}</td><td className="px-4 py-3 text-right font-black">{formatNumber(reserva.cantidad)}</td><td className="px-4 py-3 text-right">{formatNumber(reserva.stockDisponible)}</td><td className="px-4 py-3 text-right">{formatNumber(reserva.stockTeorico)}</td><td className="px-4 py-3"><strong>{reserva.movimientoKey || "—"}</strong><br /><span className="text-xs text-slate-500">{formatoFechaHora(reserva.createdAt)}</span></td></tr>)}</tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </section>

                      <section className="bg-white rounded-[28px] border border-slate-200 overflow-hidden">
                        <div className="p-5 border-b border-slate-200 flex items-center gap-3"><Clock3 className="text-[#244C5A]" /><div><h3 className="font-black text-xl">Línea de tiempo</h3><p className="text-sm text-slate-500">Registro cronológico de creación, actualizaciones y cambios de estados.</p></div></div>
                        <div className="p-5 space-y-4">
                          {timeline.length === 0 ? <p className="text-sm text-slate-500">Aún no hay eventos para mostrar.</p> : timeline.map((evento, index) => (
                            <div key={`${evento.fecha}-${index}`} className="flex gap-4">
                              <div className="flex flex-col items-center"><div className={`w-10 h-10 rounded-full flex items-center justify-center border ${evento.estado === "rechazado" ? "bg-red-50 text-red-700 border-red-200" : evento.estado === "aceptado" ? "bg-green-50 text-green-700 border-green-200" : "bg-[#244C5A]/10 text-[#244C5A] border-[#244C5A]/10"}`}>{evento.estado === "rechazado" ? <XCircle size={20} /> : evento.estado === "aceptado" ? <CheckCircle2 size={20} /> : <Clock3 size={20} />}</div>{index < timeline.length - 1 && <div className="w-px flex-1 bg-slate-200" />}</div>
                              <div className="pb-5 min-w-0"><p className="font-black">{evento.titulo}</p><p className="text-sm text-slate-600">{evento.descripcion}</p><p className="text-xs text-slate-400 mt-1">{formatoFechaHora(evento.fecha)} · {evento.usuario}{evento.rol ? ` · ${evento.rol}` : ""}</p>{evento.motivo && <p className="mt-2 rounded-xl bg-red-50 text-red-700 border border-red-100 px-3 py-2 text-sm"><strong>Motivo:</strong> {evento.motivo}</p>}</div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}
