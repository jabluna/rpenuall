"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Eye,
  FileText,
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Tags,
  Truck,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { auth, dbRealtime } from "@/lib/firebase";
import { PermissionModule, useUserPermissions } from "@/lib/useUserPermissions";
import NoPermission from "@/components/NoPermission";

type EstadoProceso = "sin_verificar" | "aceptado" | "rechazado";

type PedidoItem = {
  codigo?: string;
  producto?: string;
  cantidad?: string;
  procesos?: Record<string, EstadoProceso>;
};

type PedidoGuardado = {
  id: string;
  ordenPedido?: string;
  fecha?: string;
  cliente?: {
    codigo_cliente?: string;
    nombre?: string;
  };
  items?: PedidoItem[];
  estadoGeneral?: string;
};

type CompraItem = {
  codigoEnvase?: string;
  descripcion?: string;
  proveedor?: string;
  cantidadComprar?: string | number;
  total?: string | number;
  totalUnidades?: string | number;
};

type CompraGuardada = {
  id: string;
  consecutivo?: string;
  fecha?: string;
  ordenPedido?: string;
  cliente?: {
    codigo_cliente?: string;
    nombre?: string;
  };
  itemsCompra?: CompraItem[];
  estado?: string;
  creadoAt?: string;
  actualizadoAt?: string;
  evidenciaCompra?: {
    url?: string;
    nombre?: string;
  };
};

type EstadoPorItem = {
  estado?: EstadoProceso;
  historialRechazos?: any[];
};

type GestionCompra = {
  compraId?: string;
  estados?: Record<string, Record<string, EstadoPorItem>>;
};

type AlertaBodega = {
  id: string;
  activo?: boolean;
  alertaDisponible?: boolean;
  alertaTeorico?: boolean;
  codigoProducto?: string;
  codigoProveedor?: string;
  estadoDisponible?: string;
  estadoTeorico?: string;
  nombreProveedor?: string;
  producto?: string;
  proveedorNodo?: string;
  stockDisponible?: number | string;
  stockDisponibleMinimo?: number | string;
  stockTeorico?: number | string;
  stockTeoricoMinimo?: number | string;
};

type AlertaEtiqueta = {
  id: string;
  clienteId: string;
  codigoCliente: string;
  cliente: string;
  productoId: string;
  codigoProducto: string;
  producto: string;
  lado: "frente" | "dorso";
  saldo: number;
  estado: "etiqueta_negativa" | "etiqueta_cero" | "etiqueta_baja";
};

type MenuItem = {
  title: string;
  icon: any;
  href: string;
  module?: PermissionModule;
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
      { title: "Crear / ver roles", icon: ShieldCheck, href: "/panel/roles", module: "roles" },
      { title: "Crear / ver usuarios", icon: UserCog, href: "/panel/usuarios", module: "usuarios" },
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
        module: "proveedoresBodega",
      },
    ],
  },
  {
    title: "Comercial",
    icon: ClipboardList,
    items: [
      { title: "Crear / ver clientes", icon: Users, href: "/panel/clientes" },
      { title: "Crear orden de pedido", icon: ClipboardList, href: "/panel/pedidos" },
      { title: "Ver órdenes de pedido", icon: Eye, href: "/panel/ordenes_creadas" },
      { title: "Generar orden de muestra", icon: FileText, href: "/panel/muestra" },
    ],
  },
  {
    title: "Producción",
    icon: Boxes,
    items: [
      { title: "Ver órdenes de pedido", icon: Eye, href: "/panel/ordenes_creadas" },
      { title: "Producción x Planta", icon: Boxes, href: "/panel/produccionxplanta" },
    ],
  },
  {
    title: "Compras",
    icon: ShoppingCart,
    items: [
      { title: "Crear órdenes de compra", icon: PlusCircle, href: "/panel/compras2" },
      { title: "Ver órdenes de compra", icon: Eye, href: "/panel/gestion-compras2" },
      { title: "Crear proveedor", icon: Truck, href: "/panel/crear-proveedor" },
    ],
  },
  {
    title: "Etiquetas",
    icon: Tag,
    items: [
      { title: "Lista etiquetas", icon: Tags, href: "/panel/inventario-etiquetas" },
      { title: "Crear orden de compra etiquetas", icon: FileText, href: "/panel/compra-etiqueta" },
      { title: "Ver órdenes de compra etiquetas", icon: Eye, href: "/panel/gestion-etiquetas" },
    ],
  },
];

const procesosPedido = [
  "materias_primas",
  "etiquetas",
  "envase",
  "cucharas",
  "termo_sello",
  "tapas",
  "liner",
  "orden_premezcla",
  "verificacion_pre",
  "pre_mezcla",
  "orden_mezcla",
  "verificacion_mez",
  "mezcla",
  "orden_acondicionamiento",
  "envasado",
  "acondicionado",
  "batch_record",
  "almacenado",
  "remisionado",
  "facturado",
  "entregado",
];

function calcularEstadoOrden(pedido: PedidoGuardado) {
  const items = pedido.items || [];
  if (items.length === 0) return "creada";

  const estados: EstadoProceso[] = [];
  items.forEach((item) => {
    procesosPedido.forEach((procesoKey) => {
      estados.push(item.procesos?.[procesoKey] || "sin_verificar");
    });
  });

  const tieneRechazos = estados.some((estado) => estado === "rechazado");
  const todosAceptados = estados.length > 0 && estados.every((estado) => estado === "aceptado");
  const todosSinVerificar = estados.every((estado) => estado === "sin_verificar");

  if (tieneRechazos) return "con_rechazos";
  if (todosAceptados) return "completada";
  if (todosSinVerificar) return "creada";
  return "incompleta";
}

function estadoLabel(estado: string) {
  if (estado === "con_rechazos") return "Con rechazos";
  if (estado === "incompleta") return "Incompleta";
  if (estado === "completada") return "Completada";
  if (estado === "anulada") return "Anulada";
  if (estado === "completado") return "Completado";
  if (estado === "en_proceso") return "En proceso";
  if (estado === "alerta_bodega") return "Alerta";
  if (estado === "etiqueta_negativa") return "Negativo";
  if (estado === "etiqueta_cero") return "En cero";
  if (estado === "etiqueta_baja") return "Menos de 10";
  return "Creada";
}

function estadoBadgeClass(estado: string) {
  if (estado === "con_rechazos" || estado === "rechazado") return "bg-red-100 text-red-700";
  if (estado === "incompleta" || estado === "en_proceso") return "bg-yellow-100 text-yellow-800";
  if (estado === "completada" || estado === "completado") return "bg-green-100 text-green-700";
  if (estado === "anulada") return "bg-slate-200 text-slate-600";
  if (estado === "alerta_bodega") return "bg-orange-100 text-orange-700";
  if (estado === "etiqueta_negativa") return "bg-red-100 text-red-700";
  if (estado === "etiqueta_cero") return "bg-orange-100 text-orange-700";
  if (estado === "etiqueta_baja") return "bg-yellow-100 text-yellow-800";
  return "bg-slate-100 text-slate-600";
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown) {
  const parsed = toNumber(value);
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(parsed);
}

function getMovimientosEtiqueta(detalle?: any) {
  if (!detalle?.movimientos || typeof detalle.movimientos !== "object") return [];

  return Object.entries(detalle.movimientos)
    .map(([id, movimiento]: [string, any]) => ({
      id,
      fecha: String(movimiento?.fecha || ""),
      saldo: toNumber(movimiento?.saldo),
      createdAt: toNumber(movimiento?.createdAt),
    }))
    .sort((a, b) => {
      const fechaCompare = b.fecha.localeCompare(a.fecha);
      if (fechaCompare !== 0) return fechaCompare;
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      return b.id.localeCompare(a.id);
    });
}

function getSaldoEtiqueta(producto: any, lado: "frente" | "dorso") {
  const detalleLado = producto?.detalle?.[lado];
  const movimientos = getMovimientosEtiqueta(detalleLado);

  if (movimientos.length > 0) return toNumber(movimientos[0].saldo);

  if (detalleLado?.stockInicial !== undefined && detalleLado?.stockInicial !== null) {
    return toNumber(detalleLado.stockInicial);
  }

  const stock = producto?.stock;

  if (stock && typeof stock === "object" && !Array.isArray(stock)) {
    return toNumber(stock?.[lado]);
  }

  return lado === "frente" ? toNumber(stock) : 0;
}

function getEstadoEtiqueta(saldo: number): AlertaEtiqueta["estado"] | null {
  if (saldo < 0) return "etiqueta_negativa";
  if (saldo === 0) return "etiqueta_cero";
  if (saldo < 10) return "etiqueta_baja";
  return null;
}

function calcularEstadoCompra(compra: CompraGuardada, gestionCompra?: GestionCompra) {
  if (compra.estado === "anulada") return "anulada";

  const estados = gestionCompra?.estados || {};
  let totalVerificaciones = 0;
  let aceptados = 0;
  let rechazados = 0;
  let pendientes = 0;

  Object.values(estados).forEach((estadosPorItem: any) => {
    Object.values(estadosPorItem || {}).forEach((estadoProceso: any) => {
      const estado = estadoProceso?.estado || "sin_verificar";
      totalVerificaciones += 1;
      if (estado === "rechazado") rechazados += 1;
      else if (estado === "aceptado") aceptados += 1;
      else pendientes += 1;
    });
  });

  if (rechazados > 0) return "con_rechazos";
  if (totalVerificaciones > 0 && aceptados === totalVerificaciones) return "completado";
  if (totalVerificaciones > 0 && pendientes > 0) return "en_proceso";
  return compra.estado === "completado" ? "completado" : "en_proceso";
}

export default function PanelPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const [pedidos, setPedidos] = useState<PedidoGuardado[]>([]);
  const [compras, setCompras] = useState<CompraGuardada[]>([]);
  const [gestionCompras, setGestionCompras] = useState<Record<string, GestionCompra>>({});
  const [alertasBodega, setAlertasBodega] = useState<AlertaBodega[]>([]);
  const [alertasEtiquetas, setAlertasEtiquetas] = useState<AlertaEtiqueta[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(true);
  const [errorAlertas, setErrorAlertas] = useState("");

  const { authUser, profile, loading, isActive, canView } = useUserPermissions();

  const userName = useMemo(() => {
    return profile?.nombre || authUser?.displayName || authUser?.email?.split("@")[0] || "Administrador";
  }, [profile, authUser]);

  const filteredMenuSections = useMemo(() => {
    return menuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => (item.module ? canView(item.module) : true)),
      }))
      .filter((section) => section.items.length > 0);
  }, [canView]);

  const visibleMenuItems = useMemo(() => filteredMenuSections.flatMap((section) => section.items), [filteredMenuSections]);

  const pedidosConEstado = useMemo(
    () => pedidos.map((pedido) => ({ ...pedido, estadoCalculado: calcularEstadoOrden(pedido) })),
    [pedidos],
  );

  const pedidosConRechazos = useMemo(() => pedidosConEstado.filter((pedido) => pedido.estadoCalculado === "con_rechazos"), [pedidosConEstado]);
  const pedidosIncompletos = useMemo(() => pedidosConEstado.filter((pedido) => pedido.estadoCalculado === "incompleta"), [pedidosConEstado]);
  const pedidosCompletados = useMemo(() => pedidosConEstado.filter((pedido) => pedido.estadoCalculado === "completada"), [pedidosConEstado]);

  const comprasConEstado = useMemo(() => {
    return compras.map((compra) => ({ ...compra, estadoCalculado: calcularEstadoCompra(compra, gestionCompras[compra.id]) }));
  }, [compras, gestionCompras]);

  const comprasConRechazos = useMemo(() => comprasConEstado.filter((compra) => compra.estadoCalculado === "con_rechazos"), [comprasConEstado]);
  const comprasEnProceso = useMemo(() => comprasConEstado.filter((compra) => compra.estadoCalculado === "en_proceso"), [comprasConEstado]);
  const comprasCompletadas = useMemo(() => comprasConEstado.filter((compra) => compra.estadoCalculado === "completado"), [comprasConEstado]);

  const alertasBodegaActivas = useMemo(() => {
    return alertasBodega.filter((alerta) => alerta.activo !== false && (alerta.alertaDisponible || alerta.alertaTeorico));
  }, [alertasBodega]);

  const alertasBodegaDisponible = useMemo(() => alertasBodegaActivas.filter((alerta) => alerta.alertaDisponible), [alertasBodegaActivas]);
  const alertasBodegaTeorico = useMemo(() => alertasBodegaActivas.filter((alerta) => alerta.alertaTeorico), [alertasBodegaActivas]);

  const alertasEtiquetasNegativas = useMemo(() => alertasEtiquetas.filter((alerta) => alerta.estado === "etiqueta_negativa"), [alertasEtiquetas]);
  const alertasEtiquetasCero = useMemo(() => alertasEtiquetas.filter((alerta) => alerta.estado === "etiqueta_cero"), [alertasEtiquetas]);
  const alertasEtiquetasBajas = useMemo(() => alertasEtiquetas.filter((alerta) => alerta.estado === "etiqueta_baja"), [alertasEtiquetas]);

  useEffect(() => {
    if (!loading && !authUser) router.replace("/");
  }, [loading, authUser, router]);

  useEffect(() => {
    if (!authUser) return;

    setLoadingAlertas(true);
    setErrorAlertas("");

    const cargados = { pedidos: false, compras: false, gestion: false, bodega: false, etiquetas: false };
    const marcarCargado = (key: keyof typeof cargados) => {
      cargados[key] = true;
      if (cargados.pedidos && cargados.compras && cargados.gestion && cargados.bodega && cargados.etiquetas) setLoadingAlertas(false);
    };

    const manejarError = (err: any) => {
      setErrorAlertas(`No fue posible cargar las alertas en tiempo real. ${err?.message || ""}`);
      setLoadingAlertas(false);
    };

    const unsubscribePedidos = onValue(
      ref(dbRealtime, "ORDENES_PEDIDO"),
      (snap) => {
        const data = snap.exists() ? snap.val() : {};
        const lista = Object.entries(data).map(([id, value]: any) => ({ id, ...value })) as PedidoGuardado[];
        lista.sort((a, b) => new Date(b.fecha || "").getTime() - new Date(a.fecha || "").getTime());
        setPedidos(lista);
        marcarCargado("pedidos");
      },
      manejarError,
    );

    const unsubscribeCompras = onValue(
      ref(dbRealtime, "COMPRAS_BODEGA"),
      (snap) => {
        const data = snap.exists() ? snap.val() : {};
        const lista = Object.entries(data).map(([id, value]: any) => ({ id, ...value })) as CompraGuardada[];
        lista.sort((a, b) => new Date(b.creadoAt || b.actualizadoAt || b.fecha || "").getTime() - new Date(a.creadoAt || a.actualizadoAt || a.fecha || "").getTime());
        setCompras(lista);
        marcarCargado("compras");
      },
      manejarError,
    );

    const unsubscribeGestion = onValue(
      ref(dbRealtime, "GESTION_COMPRAS_BODEGA"),
      (snap) => {
        setGestionCompras(snap.exists() ? snap.val() : {});
        marcarCargado("gestion");
      },
      manejarError,
    );

    const unsubscribeAlertasBodega = onValue(
      ref(dbRealtime, "SEMAFORIZACIÓN/ALERTAS"),
      (snap) => {
        const data = snap.exists() ? snap.val() : {};
        const lista = Object.entries(data).map(([id, value]: any) => ({ id, ...value })) as AlertaBodega[];
        lista.sort((a, b) => {
          const proveedorA = a.nombreProveedor || a.proveedorNodo || a.codigoProveedor || "";
          const proveedorB = b.nombreProveedor || b.proveedorNodo || b.codigoProveedor || "";
          return proveedorA.localeCompare(proveedorB) || (a.producto || "").localeCompare(b.producto || "");
        });
        setAlertasBodega(lista);
        marcarCargado("bodega");
      },
      manejarError,
    );

    const unsubscribeAlertasEtiquetas = onValue(
      ref(dbRealtime, "ETIQUETAS/CLIENTES"),
      (snap) => {
        const data = snap.exists() ? snap.val() : {};
        const lista: AlertaEtiqueta[] = [];

        Object.entries(data || {}).forEach(([clienteId, clienteNode]: [string, any]) => {
          const codigoCliente = String(clienteNode?.codigoCliente || clienteId || "");
          const cliente = String(clienteNode?.cliente || "Cliente sin nombre");
          const productos = clienteNode?.productos || {};

          Object.entries(productos).forEach(([productoId, productoNode]: [string, any]) => {
            const codigoProducto = String(productoNode?.codigo || productoId || "");
            const producto = String(productoNode?.producto || "Producto sin nombre");

            (["frente", "dorso"] as const).forEach((lado) => {
              const tieneLado =
                productoNode?.detalle?.[lado] ||
                (productoNode?.stock && typeof productoNode.stock === "object" && productoNode.stock?.[lado] !== undefined) ||
                (lado === "frente" && productoNode?.stock !== undefined);

              if (!tieneLado) return;

              const saldo = getSaldoEtiqueta(productoNode, lado);
              const estado = getEstadoEtiqueta(saldo);

              if (!estado) return;

              lista.push({
                id: `${clienteId}_${productoId}_${lado}`,
                clienteId,
                codigoCliente,
                cliente,
                productoId,
                codigoProducto,
                producto,
                lado,
                saldo,
                estado,
              });
            });
          });
        });

        lista.sort((a, b) => {
          if (a.saldo !== b.saldo) return a.saldo - b.saldo;
          return a.cliente.localeCompare(b.cliente) || a.producto.localeCompare(b.producto);
        });

        setAlertasEtiquetas(lista);
        marcarCargado("etiquetas");
      },
      manejarError,
    );

    return () => {
      unsubscribePedidos();
      unsubscribeCompras();
      unsubscribeGestion();
      unsubscribeAlertasBodega();
      unsubscribeAlertasEtiquetas();
    };
  }, [authUser]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((current) => ({ ...current, [sectionTitle]: !current[sectionTitle] }));
    if (sidebarCollapsed) setSidebarCollapsed(false);
  };

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

  if (loading || !authUser) {
    return (
      <main className="min-h-screen bg-[#244C5A] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl px-8 py-7 shadow-2xl flex items-center gap-3 text-[#244C5A] font-semibold">
          <Loader2 className="animate-spin" size={22} />
          Validando acceso al panel...
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
        <button type="button" onClick={() => setSidebarOpen(true)} className="w-10 h-10 rounded-2xl bg-[#244C5A] text-white flex items-center justify-center" aria-label="Abrir menú">
          <Menu size={22} />
        </button>
        <Image src="/logo.png" alt="Nuall" width={105} height={45} priority className="object-contain" />
        <button type="button" onClick={handleLogout} className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center" aria-label="Cerrar sesión">
          <LogOut size={20} />
        </button>
      </div>

      {sidebarOpen && <button type="button" className="fixed inset-0 bg-slate-950/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Cerrar fondo menú" />}

      <aside className={`fixed z-50 inset-y-0 left-0 ${sidebarCollapsed ? "lg:w-[88px]" : "lg:w-[300px]"} w-[300px] bg-[#244C5A] text-white transform transition-all duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-full flex flex-col">
          <div className={`relative px-6 pt-6 pb-5 border-b border-white/10 flex items-center ${sidebarCollapsed ? "justify-center" : "justify-center"}`}>
            <Link href="/panel" onClick={() => setSidebarOpen(false)} className={`flex items-center justify-center min-h-[56px] ${sidebarCollapsed ? "w-full" : "w-full max-w-[252px]"}`} title="Volver al dashboard">
              <Image src="/logo.png" alt="Nuall" width={sidebarCollapsed ? 48 : 145} height={70} priority className="object-contain" />
            </Link>

            <div className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 ${sidebarCollapsed ? "hidden lg:hidden" : ""}`}>
              <button type="button" onClick={() => setSidebarCollapsed((current) => !current)} className="hidden lg:flex w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 items-center justify-center" aria-label="Encoger o ampliar menú">
                {sidebarCollapsed ? <PanelLeftOpen size={21} /> : <PanelLeftClose size={21} />}
              </button>
              <button type="button" onClick={() => setSidebarOpen(false)} className="lg:hidden w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center" aria-label="Cerrar menú">
                <X size={21} />
              </button>
            </div>

            {sidebarCollapsed && (
              <button type="button" onClick={() => setSidebarCollapsed((current) => !current)} className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 items-center justify-center" aria-label="Ampliar menú">
                <PanelLeftOpen size={21} />
              </button>
            )}
          </div>

          {!sidebarCollapsed && (
            <div className="px-6 py-5">
              <div className="rounded-3xl bg-white border border-white p-4 text-[#244C5A] shadow-sm">
                <p className="text-xs uppercase tracking-wider font-black text-[#244C5A]/70">Sesión activa</p>
                <p className="font-black mt-1 truncate">{userName}</p>
                <p className="text-xs text-[#244C5A]/70 truncate mt-1">{authUser?.email}</p>
                <p className="text-xs text-[#244C5A]/70 truncate mt-1">Rol: {profile?.rolNombre || "Sin rol"}</p>
              </div>
            </div>
          )}

          <nav className="px-4 flex-1 space-y-2 overflow-y-auto pb-4">
            <Link href="/panel" className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-white text-[#244C5A] font-bold shadow-lg ${sidebarCollapsed ? "justify-center" : ""}`} onClick={() => setSidebarOpen(false)} title="Panel Principal">
              <LayoutDashboard size={20} />
              {!sidebarCollapsed && <span>Panel Principal</span>}
            </Link>

            {filteredMenuSections.map((section) => {
              const SectionIcon = section.icon;
              const isOpen = openSections[section.title] ?? false;

              return (
                <div key={section.title} className="space-y-1">
                  <button type="button" onClick={() => toggleSection(section.title)} className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-white/90 hover:bg-white/10 hover:text-white transition ${sidebarCollapsed ? "justify-center" : ""}`} title={section.title}>
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
                        return (
                          <Link key={item.title} href={item.href} onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm text-white/75 hover:bg-white/10 hover:text-white transition">
                            <Icon size={18} /> {item.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {visibleMenuItems.length === 0 && !sidebarCollapsed && <div className="rounded-2xl bg-white/10 border border-white/10 p-4 text-sm text-white/70">No tienes módulos habilitados.</div>}
          </nav>

          <div className="p-4 border-t border-white/10">
            <button type="button" onClick={handleLogout} className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 font-semibold transition ${sidebarCollapsed ? "px-0" : ""}`} title="Cerrar sesión">
              <LogOut size={19} /> {!sidebarCollapsed && "Cerrar sesión"}
            </button>
          </div>
        </div>
      </aside>

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
              <span className="font-black text-slate-900">Panel Principal</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">{userName}</p>
              <p className="text-xs text-slate-500">{authUser?.email}</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-[#244C5A] text-white flex items-center justify-center font-black uppercase">{userName.slice(0, 1)}</div>
          </div>
        </header>

        <div id="panel" className="p-5 sm:p-8">
          {loadingAlertas ? (
            <section className="bg-white rounded-[32px] border border-slate-200 p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
              <Loader2 className="animate-spin" size={22} /> Cargando alertas...
            </section>
          ) : errorAlertas ? (
            <section className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{errorAlertas}</section>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-4 gap-6">
              <AlertCard
                id="alertas-bodega"
                titulo="Alertas de bodega"
                subtitulo="Stock disponible y teórico bajo"
                href="/panel/proveedores-bodega"
                boton="Ir a bodega"
                icon={Boxes}
                stats={[
                  { label: "Activas", value: alertasBodegaActivas.length, tone: "red" },
                  { label: "Disponible", value: alertasBodegaDisponible.length, tone: "yellow" },
                  { label: "Teórico", value: alertasBodegaTeorico.length, tone: "yellow" },
                ]}
                items={alertasBodegaActivas.map((alerta) => {
                  const proveedorGrupo = alerta.nombreProveedor || alerta.proveedorNodo || alerta.codigoProveedor || "Proveedor sin nombre";

                  return {
                    id: alerta.id,
                    href: "/panel/proveedores-bodega",
                    title: alerta.producto || alerta.codigoProducto || "Producto sin nombre",
                    subtitle: proveedorGrupo,
                    meta: `Disponible: ${alerta.stockDisponible ?? 0} · Teórico: ${alerta.stockTeorico ?? 0}`,
                    estado: "alerta_bodega",
                    groupKey: proveedorGrupo,
                    groupLabel: "Proveedor",
                  };
                })}
                vacio="No hay alertas activas de bodega."
                porPagina={10}
              />


              <AlertCard
                id="alertas-etiquetas"
                titulo="Alertas de etiquetas"
                subtitulo="Saldos en cero, negativos o menores a 10"
                href="/panel/inventario-etiquetas"
                boton="Ir a etiquetas"
                icon={Tags}
                stats={[
                  { label: "Negativas", value: alertasEtiquetasNegativas.length, tone: "red" },
                  { label: "En cero", value: alertasEtiquetasCero.length, tone: "yellow" },
                  { label: "Menor 10", value: alertasEtiquetasBajas.length, tone: "yellow" },
                ]}
                items={alertasEtiquetas.map((alerta) => {
                  const clienteGrupo = alerta.cliente || alerta.codigoCliente || "Cliente sin nombre";

                  return {
                    id: alerta.id,
                    href: "/panel/inventario-etiquetas",
                    title: `${alerta.codigoProducto} · ${alerta.producto}`,
                    subtitle: `${alerta.codigoCliente} - ${alerta.cliente}`,
                    meta: `${alerta.lado === "frente" ? "Frente" : "Dorso"} · Saldo: ${formatNumber(alerta.saldo)}`,
                    estado: alerta.estado,
                    groupKey: clienteGrupo,
                    groupLabel: "Cliente",
                  };
                })}
                vacio="No hay alertas activas de etiquetas."
                porPagina={10}
              />

<AlertCard
                id="alertas-pedidos"
                titulo="Órdenes de pedido"
                subtitulo="Rechazos e incompletas"
                href="/panel/pedidos"
                boton="Ir a pedidos"
                icon={ClipboardList}
                stats={[
                  { label: "Rechazos", value: pedidosConRechazos.length, tone: "red" },
                  { label: "Incompletas", value: pedidosIncompletos.length, tone: "yellow" },
                  { label: "Completadas", value: pedidosCompletados.length, tone: "green" },
                ]}
                items={pedidosConEstado
                  .filter((pedido) => pedido.estadoCalculado === "con_rechazos" || pedido.estadoCalculado === "incompleta")
                  .map((pedido) => {
                    const clienteGrupo = pedido.cliente?.nombre || pedido.cliente?.codigo_cliente || "Cliente sin nombre";

                    return {
                      id: pedido.id,
                      href: "/panel/pedidos",
                      title: `Orden ${pedido.ordenPedido || "Sin número"}`,
                      subtitle: `${pedido.cliente?.codigo_cliente || ""} - ${pedido.cliente?.nombre || ""}`,
                      meta: `${pedido.fecha || "Sin fecha"} · ${pedido.items?.length || 0} productos`,
                      estado: pedido.estadoCalculado,
                      groupKey: clienteGrupo,
                      groupLabel: "Cliente",
                    };
                  })}
                vacio="No hay alertas pendientes en órdenes de pedido."
              />

              <AlertCard
                id="alertas-compras"
                titulo="Órdenes de compra"
                subtitulo="Rechazos y compras en proceso"
                href="/panel/compras2"
                boton="Ir a compras"
                icon={ShoppingCart}
                stats={[
                  { label: "Rechazos", value: comprasConRechazos.length, tone: "red" },
                  { label: "En proceso", value: comprasEnProceso.length, tone: "yellow" },
                  { label: "Completadas", value: comprasCompletadas.length, tone: "green" },
                ]}
                items={comprasConEstado
                  .filter((compra) => compra.estadoCalculado === "con_rechazos" || compra.estadoCalculado === "en_proceso")
                  .map((compra) => {
                    const proveedoresCompra = Array.from(
                      new Set((compra.itemsCompra || []).map((item) => item.proveedor).filter(Boolean))
                    );
                    const proveedorGrupo = proveedoresCompra.length === 1 ? proveedoresCompra[0] || "Proveedor sin nombre" : proveedoresCompra.length > 1 ? "Varios proveedores" : "Proveedor sin nombre";

                    return {
                      id: compra.id,
                      href: "/panel/gestion-compras2",
                      title: `Compra ${compra.consecutivo || "Sin consecutivo"}`,
                      subtitle: proveedorGrupo,
                      meta: `${compra.fecha || "Sin fecha"} · ${compra.itemsCompra?.length || 0} ítems`,
                      estado: compra.estadoCalculado,
                      groupKey: proveedorGrupo,
                      groupLabel: "Proveedor",
                    };
                  })}
                vacio="No hay alertas pendientes en órdenes de compra."
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function AlertCard({
  id,
  titulo,
  subtitulo,
  href,
  boton,
  icon: Icon,
  stats,
  items,
  vacio,
  porPagina = 3,
}: {
  id: string;
  titulo: string;
  subtitulo: string;
  href: string;
  boton: string;
  icon: any;
  stats: Array<{ label: string; value: number; tone: "red" | "yellow" | "green" }>;
  items: Array<{ id: string; href: string; title: string; subtitle: string; meta: string; estado: string; groupKey?: string; groupLabel?: string }>;
  vacio: string;
  porPagina?: number;
}) {
  const pendientes = items.length;

  return (
    <article id={id} className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#244C5A]/10 text-[#244C5A] flex items-center justify-center shrink-0">
            <Icon size={19} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-base font-black truncate">{titulo}</h3>
              <span className="shrink-0 rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">{pendientes} pendientes</span>
            </div>
            <p className="text-xs text-slate-500 truncate">{subtitulo}</p>
          </div>
        </div>

        <Link href={href} className="shrink-0 rounded-xl bg-[#244C5A] hover:bg-[#1b3b46] text-white font-black px-3 py-2 text-xs inline-flex items-center gap-1.5 transition">
          {boton}
        </Link>
      </div>

      <div className="px-4 py-3">
        <ListaAlertasCompacta items={items} vacio={vacio} porPagina={porPagina} />
      </div>
    </article>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "red" | "yellow" | "green" }) {
  const classes = {
    red: "border-red-100 bg-red-50 text-red-700",
    yellow: "border-yellow-100 bg-yellow-50 text-yellow-800",
    green: "border-green-100 bg-green-50 text-green-700",
  }[tone];

  return (
    <div className={`rounded-xl border px-3 py-2 ${classes}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase truncate">{label}</p>
        <p className="text-xl font-black leading-none">{value}</p>
      </div>
    </div>
  );
}

function ListaAlertasCompacta({
  vacio,
  items,
  porPagina = 3,
}: {
  vacio: string;
  items: Array<{ id: string; href: string; title: string; subtitle: string; meta: string; estado: string; groupKey?: string; groupLabel?: string }>;
  porPagina?: number;
}) {
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const terminoBusqueda = busqueda.trim().toLowerCase();

  const itemsFiltrados = useMemo(() => {
    if (!terminoBusqueda) return items;

    return items.filter((item) => {
      const textoBusqueda = [
        item.title,
        item.subtitle,
        item.meta,
        item.estado,
        estadoLabel(item.estado),
        item.groupKey,
        item.groupLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return textoBusqueda.includes(terminoBusqueda);
    });
  }, [items, terminoBusqueda]);

  const usarAgrupacion = itemsFiltrados.some((item) => Boolean(item.groupKey));
  const itemsOrdenados = usarAgrupacion
    ? [...itemsFiltrados].sort((a, b) => {
        const grupoA = (a.groupKey || "Sin proveedor").toLowerCase();
        const grupoB = (b.groupKey || "Sin proveedor").toLowerCase();
        if (grupoA !== grupoB) return grupoA.localeCompare(grupoB);
        return a.title.localeCompare(b.title);
      })
    : itemsFiltrados;

  const gruposOrdenados = Array.from(new Set(itemsOrdenados.map((item) => item.groupKey || "Sin proveedor")));
  const tonosGrupo = [
    "bg-slate-50/80 hover:bg-slate-100/80 border-l-slate-300",
    "bg-cyan-50/60 hover:bg-cyan-100/60 border-l-cyan-300",
    "bg-emerald-50/60 hover:bg-emerald-100/60 border-l-emerald-300",
    "bg-amber-50/60 hover:bg-amber-100/60 border-l-amber-300",
    "bg-violet-50/60 hover:bg-violet-100/60 border-l-violet-300",
    "bg-rose-50/60 hover:bg-rose-100/60 border-l-rose-300",
  ];

  const getGrupoClass = (groupKey?: string) => {
    if (!usarAgrupacion) return "hover:bg-slate-50 border-l-transparent";
    const indice = gruposOrdenados.indexOf(groupKey || "Sin proveedor");
    return tonosGrupo[Math.max(0, indice) % tonosGrupo.length];
  };

  const totalPaginas = Math.max(1, Math.ceil(itemsOrdenados.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * porPagina;
  const itemsPaginados = itemsOrdenados.slice(inicio, inicio + porPagina);

  useEffect(() => {
    setPagina(1);
  }, [items.length, terminoBusqueda]);

  if (items.length === 0) {
    return <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-center text-xs text-slate-500 font-semibold">{vacio}</div>;
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-black text-slate-700">Últimas alertas</p>
          <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-500">{itemsFiltrados.length} de {items.length}</span>
        </div>
        <div className="relative">
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por proveedor, cliente, producto, orden..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/10"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Limpiar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {itemsOrdenados.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-slate-500 font-semibold">No hay resultados para esta búsqueda.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {itemsPaginados.map((item, index) => {
            const grupoAnterior = index > 0 ? itemsPaginados[index - 1]?.groupKey : undefined;
            const mostrarSeparadorGrupo = usarAgrupacion && item.groupKey && item.groupKey !== grupoAnterior;

            return (
              <Link href={item.href} key={item.id} className={`px-3 py-2 grid grid-cols-[1fr_auto] gap-2 transition items-center border-l-4 ${getGrupoClass(item.groupKey)}`}>
                <div className="min-w-0">
                  {mostrarSeparadorGrupo && (
                    <p className="mb-1 text-[9px] font-black uppercase tracking-wide text-slate-500 truncate">{item.groupLabel || "Grupo"}: {item.groupKey}</p>
                  )}
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-black text-sm text-slate-900 truncate">{item.title}</p>
                    <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${estadoBadgeClass(item.estado)}`}>{estadoLabel(item.estado)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{item.subtitle || "Sin cliente"}</p>
                </div>
                <p className="hidden sm:block text-[10px] text-slate-400 font-semibold text-right max-w-[135px] truncate">{item.meta}</p>
              </Link>
            );
          })}
        </div>
      )}

      {totalPaginas > 1 && itemsOrdenados.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold text-slate-500">
            {inicio + 1}-{Math.min(inicio + porPagina, itemsOrdenados.length)} de {itemsOrdenados.length}
          </p>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={paginaSegura <= 1} onClick={() => setPagina((actual) => Math.max(1, actual - 1))} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-black text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#244C5A] hover:text-[#244C5A] transition">
              Ant.
            </button>
            <span className="text-[10px] font-black text-slate-500">{paginaSegura}/{totalPaginas}</span>
            <button type="button" disabled={paginaSegura >= totalPaginas} onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-black text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#244C5A] hover:text-[#244C5A] transition">
              Sig.
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
