"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  ChevronDown,
  ClipboardList,
  Eye,
  FileText,
  Home,
  Loader2,
  LogOut,
  Menu,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Save,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Tags,
  Trash2,
  Truck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { get, ref, set, update } from "firebase/database";
import {
  collection,
  doc,
  getDoc,
  limit,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db, dbRealtime } from "@/lib/firebase";
import { useUserPermissions } from "@/lib/useUserPermissions";

type EstadoProceso = "sin_verificar" | "aceptado" | "rechazado";

type EstadoMeta = {
  estado: EstadoProceso;
  usuario: string;
  uid?: string | null;
  email?: string | null;
  fecha: string;
  rol?: string;
  motivo?: string;
};

type PedidoItem = {
  codigo: string;
  producto: string;
  cantidad: string;
  consecutivo: string;
  planta?: string;
  procesos: Record<string, EstadoProceso>;
  estadosMeta: Record<string, EstadoMeta>;
  historialEstados: Record<string, EstadoMeta[]>;
  responsables?: Record<string, string>;
};

type PedidoGuardado = {
  id: string;
  ordenPedido: string;
  fecha: string;
  cliente?: {
    codigo_cliente?: string;
    nombre?: string;
  };
  items?: PedidoItem[];
  estadoGeneral?: string;
  creadoPor?: string;
  creadoPorUid?: string | null;
  creadoPorEmail?: string | null;
  creadoAt?: string;
  actualizadoPor?: string;
  actualizadoPorUid?: string | null;
  actualizadoPorEmail?: string | null;
  actualizadoAt?: string;
  responsableProduccion?: string;
  responsableProduccionUid?: string | null;
  responsableProduccionEmail?: string | null;
  responsableProduccionRol?: string;
};

type SidebarItem = {
  title: string;
  icon: any;
  href: string;
  module?: string;
};

type SidebarSection = {
  title: string;
  icon: any;
  items: SidebarItem[];
};

const sidebarSections: SidebarSection[] = [
  {
    title: "Usuarios",
    icon: Users,
    items: [
      {
        title: "Crear / ver roles",
        icon: ShieldCheck,
        href: "/panel/roles",
        module: "roles",
      },
      {
        title: "Crear / ver usuarios",
        icon: UserCog,
        href: "/panel/usuarios",
        module: "usuarios",
      },
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
      {
        title: "Crear / ver clientes",
        icon: Users,
        href: "/panel/clientes",
        module: "clientes",
      },
      {
        title: "Crear orden de pedido",
        icon: PlusCircle,
        href: "/panel/pedidos",
        module: "pedidos",
      },
      {
        title: "Ver órdenes de pedido",
        icon: Eye,
        href: "/panel/ordenes_creadas",
        module: "ordenesCreadas",
      },
      {
        title: "Generar orden de muestra",
        icon: ClipboardList,
        href: "/panel/muestra",
        module: "muestra",
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
        module: "ordenesCreadas",
      },
      {
        title: "Producción x Planta",
        icon: ClipboardList,
        href: "/panel/produccionxplanta",
        module: "produccionxplanta",
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
        module: "compras",
      },
      {
        title: "Ver órdenes de compra",
        icon: Eye,
        href: "/panel/gestion-compras2",
        module: "gestionCompras",
      },
      {
        title: "Crear proveedor",
        icon: PackagePlus,
        href: "/panel/crear-proveedor",
        module: "crearProveedor",
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
        module: "inventarioEtiquetas",
      },
      {
        title: "Crear orden de compra etiquetas",
        icon: FileText,
        href: "/panel/compra-etiqueta",
        module: "compraEtiqueta",
      },
      {
        title: "Ver órdenes de compra etiquetas",
        icon: Eye,
        href: "/panel/gestion-etiquetas",
        module: "gestionEtiquetas",
      },
    ],
  },
];

const currentPageHref = "/panel/ordenes_creadas";

function cleanKey(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[.#$/[\]]/g, "-");
}

const plantasProduccion = ["Planta 1", "Planta 2", "Planta 3", "Planta 4"];

const procesos = [
  { key: "materias_primas", titulo: "Materias primas", rol: "investigación" },
  { key: "etiquetas", titulo: "Etiquetas", rol: "etiquetas" },
  { key: "envase", titulo: "Envase", rol: "bodega" },
  { key: "cucharas", titulo: "Cucharas", rol: "bodega" },
  { key: "termo_sello", titulo: "Termo / sello", rol: "bodega" },
  { key: "tapas", titulo: "Tapas", rol: "bodega" },
  { key: "liner", titulo: "Liner", rol: "bodega" },
  { key: "orden_premezcla", titulo: "Orden premezcla", rol: "producción" },
  {
    key: "verificacion_pre",
    titulo: "Verificación pre",
    rol: "investigación",
  },
  { key: "pre_mezcla", titulo: "Pre mezcla", rol: "investigación" },
  { key: "orden_mezcla", titulo: "Orden mezcla", rol: "producción" },
  {
    key: "verificacion_mez",
    titulo: "Verificación mez",
    rol: "investigación",
  },
  { key: "mezcla", titulo: "Mezcla", rol: "investigación" },
  {
    key: "orden_acondicionamiento",
    titulo: "Orden acondicionamiento",
    rol: "producción",
  },
  { key: "envasado", titulo: "Envasado", rol: "planta" },
  { key: "acondicionado", titulo: "Acondicionado", rol: "planta" },
  { key: "batch_record", titulo: "Batch record", rol: "planta" },
  { key: "almacenado", titulo: "Almacenado", rol: "bodega" },
  { key: "remisionado", titulo: "Remisionado", rol: "bodega" },
  { key: "facturado", titulo: "Facturado", rol: "contabilidad" },
  { key: "entregado", titulo: "Entregado", rol: "bodega" },
];

function crearProcesosIniciales() {
  return procesos.reduce(
    (acc, proceso) => {
      acc[proceso.key] = "sin_verificar";
      return acc;
    },
    {} as Record<string, EstadoProceso>,
  );
}

function normalizarItem(item: Partial<PedidoItem>): PedidoItem {
  return {
    codigo: item.codigo || "",
    producto: item.producto || "",
    cantidad: item.cantidad || "",
    consecutivo: item.consecutivo || "",
    planta: item.planta || "",
    procesos: {
      ...crearProcesosIniciales(),
      ...(item.procesos || {}),
    },
    estadosMeta: item.estadosMeta || {},
    historialEstados: item.historialEstados || {},
    responsables: item.responsables || {},
  };
}

function mostrarEstado(estado?: EstadoProceso) {
  if (!estado || estado === "sin_verificar") return "Sin verificar";
  if (estado === "aceptado") return "Aceptado";
  if (estado === "rechazado") return "Rechazado";
  return estado;
}

function estadoBadgeClass(estado?: EstadoProceso) {
  if (estado === "aceptado")
    return "bg-green-100 text-green-700 border-green-200";
  if (estado === "rechazado") return "bg-red-100 text-red-700 border-red-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function estadoSelectClass(estado?: EstadoProceso) {
  if (estado === "aceptado")
    return "bg-green-50 text-green-700 border-green-200";
  if (estado === "rechazado") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generarPdfResumenOrden(pedido: PedidoGuardado) {
  const estadoOrden = calcularEstadoOrden(pedido);
  const productos = pedido.items || [];
  const fechaGeneracion = new Date().toLocaleString("es-CO");

  const productosHtml = productos
    .map((item, index) => {
      const planta = item.planta || "Sin asignar";
      const estados = procesos
        .map((proceso) => {
          const estado = item.procesos?.[proceso.key] || "sin_verificar";
          return `<span class="estado"><strong>${escapeHtml(proceso.titulo)}:</strong> ${escapeHtml(mostrarEstado(estado))}</span>`;
        })
        .join("");

      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(item.codigo)}</strong><br/>${escapeHtml(item.producto)}</td>
          <td>${escapeHtml(item.cantidad)}</td>
          <td>${escapeHtml(item.consecutivo || "-")}</td>
          <td>${escapeHtml(planta)}</td>
          <td>${estados}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Orden de producción ${escapeHtml(pedido.ordenPedido)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; }
          .header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 3px solid #244C5A; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { color: #244C5A; font-size: 24px; font-weight: 900; letter-spacing: .03em; }
          .muted { color: #64748b; font-size: 12px; }
          h1 { font-size: 24px; margin: 6px 0 0; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 18px 0; }
          .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; background: #f8fafc; }
          .label { color: #64748b; text-transform: uppercase; font-size: 10px; font-weight: 900; letter-spacing: .08em; }
          .value { font-size: 14px; font-weight: 800; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 11px; }
          th { background: #244C5A; color: white; text-align: left; padding: 9px; }
          td { border: 1px solid #e2e8f0; padding: 8px; vertical-align: top; }
          tr:nth-child(even) td { background: #f8fafc; }
          .estado { display: inline-block; margin: 0 6px 5px 0; padding: 4px 7px; border-radius: 999px; background: #eef2f7; color: #334155; }
          .footer { margin-top: 24px; color: #64748b; font-size: 11px; text-align: right; }
          @media print { body { margin: 18px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">NUALL</div>
            <h1>Resumen de orden de producción</h1>
            <div class="muted">Generado: ${escapeHtml(fechaGeneracion)}</div>
          </div>
          <div style="text-align:right">
            <div class="label">Orden</div>
            <div style="font-size:26px;font-weight:900;color:#244C5A">${escapeHtml(pedido.ordenPedido)}</div>
          </div>
        </div>

        <div class="grid">
          <div class="card"><div class="label">Fecha</div><div class="value">${escapeHtml(pedido.fecha)}</div></div>
          <div class="card"><div class="label">Cliente</div><div class="value">${escapeHtml(pedido.cliente?.codigo_cliente)} · ${escapeHtml(pedido.cliente?.nombre)}</div></div>
          <div class="card"><div class="label">Productos</div><div class="value">${productos.length}</div></div>
          <div class="card"><div class="label">Estado</div><div class="value">${escapeHtml(mostrarEstadoOrden(estadoOrden))}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Consecutivo</th>
              <th>Planta</th>
              <th>Estados</th>
            </tr>
          </thead>
          <tbody>
            ${productosHtml || `<tr><td colspan="6">Esta orden no tiene productos cargados.</td></tr>`}
          </tbody>
        </table>

        <div class="footer">Documento generado desde el panel administrativo.</div>
        <script>window.onload = function(){ window.print(); };</script>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function calcularEstadoOrden(pedido: PedidoGuardado) {
  const items = pedido.items || [];

  if (items.length === 0) {
    return "creada";
  }

  const estados: EstadoProceso[] = [];

  items.forEach((item) => {
    procesos.forEach((proceso) => {
      estados.push(item.procesos?.[proceso.key] || "sin_verificar");
    });
  });

  const tieneRechazos = estados.some((estado) => estado === "rechazado");
  const todosAceptados =
    estados.length > 0 && estados.every((estado) => estado === "aceptado");
  const todosSinVerificar = estados.every(
    (estado) => estado === "sin_verificar",
  );

  if (tieneRechazos) return "con_rechazos";
  if (todosAceptados) return "completada";
  if (todosSinVerificar) return "creada";

  return "incompleta";
}

function mostrarEstadoOrden(estado: string) {
  if (estado === "con_rechazos") return "Con rechazos";
  if (estado === "incompleta") return "Incompleta";
  if (estado === "completada") return "Completada";
  return "Creada";
}

function estadoOrdenClass(estado: string) {
  if (estado === "con_rechazos")
    return "bg-red-100 text-red-700 border-red-200";
  if (estado === "incompleta")
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (estado === "completada")
    return "bg-green-100 text-green-700 border-green-200";
  return "bg-[#244C5A]/10 text-[#244C5A] border-[#244C5A]/10";
}

function obtenerHistorialRechazos(item: PedidoItem, procesoKey: string) {
  const historial = item.historialEstados?.[procesoKey] || [];
  const rechazos = historial.filter(
    (registro) => registro.estado === "rechazado",
  );

  const metaActual = item.estadosMeta?.[procesoKey];

  if (
    metaActual?.estado === "rechazado" &&
    !rechazos.some((registro) => registro.fecha === metaActual.fecha)
  ) {
    return [...rechazos, metaActual];
  }

  return rechazos;
}

function esRolPlanta(rol?: string) {
  return String(rol || "")
    .toLowerCase()
    .includes("planta");
}

function obtenerResponsableProduccion(pedido: PedidoGuardado) {
  const registrosPlanta: EstadoMeta[] = [];

  (pedido.items || []).forEach((item) => {
    Object.values(item.estadosMeta || {}).forEach((meta) => {
      if (esRolPlanta(meta.rol)) {
        registrosPlanta.push(meta);
      }
    });

    Object.values(item.historialEstados || {}).forEach((historial) => {
      historial.forEach((meta) => {
        if (esRolPlanta(meta.rol)) {
          registrosPlanta.push(meta);
        }
      });
    });
  });

  if (registrosPlanta.length === 0) return null;

  return registrosPlanta.sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  )[0];
}

export default function OrdenesCreadasPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "Comercial": true,
  });

  const {
    authUser,
    profile,
    loading: loadingPermissions,
    canView,
  } = useUserPermissions();

  const [pedidos, setPedidos] = useState<PedidoGuardado[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [savingEstados, setSavingEstados] = useState(false);
  const [deletingPedidoId, setDeletingPedidoId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [pedidoProductosModal, setPedidoProductosModal] =
    useState<PedidoGuardado | null>(null);

  const [rechazoModal, setRechazoModal] = useState<{
    itemIndex: number;
    procesoKey: string;
    procesoTitulo: string;
    motivo: string;
  } | null>(null);

  const [rechazoVistaModal, setRechazoVistaModal] = useState<{
    procesoTitulo: string;
    historial: EstadoMeta[];
  } | null>(null);

  const userName = useMemo(() => {
    return (
      profile?.nombre ||
      authUser?.displayName ||
      authUser?.email?.split("@")[0] ||
      "Usuario"
    );
  }, [profile, authUser]);

  const filteredSidebarSections = useMemo(() => {
    return sidebarSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          item.module && canView ? canView(item.module as any) : true,
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [canView]);

  const toggleSidebarSection = (sectionTitle: string) => {
    setOpenSections((current) => ({
      ...current,
      [sectionTitle]: !current[sectionTitle],
    }));

    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
    }
  };

  const sidebarPadding = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

  const [userRole, setUserRole] = useState("Sin rol");

  useEffect(() => {
    const obtenerRolDesdeData = async (data: any) => {
      if (!data) return "";

      if (data.rolNombre) return String(data.rolNombre);
      if (data.rol) return String(data.rol);

      if (data.rolId) {
        try {
          const rolSnap = await getDoc(doc(db, "roles", String(data.rolId)));

          if (rolSnap.exists()) {
            const rolData = rolSnap.data();

            if (rolData?.nombre) {
              return String(rolData.nombre);
            }
          }
        } catch {
          return String(data.rolId);
        }

        return String(data.rolId);
      }

      if (Array.isArray(data.roles) && data.roles.length > 0) {
        return String(data.roles[0]);
      }

      return "";
    };

    const cargarRolUsuario = async () => {
      if (!authUser?.uid && !authUser?.email) return;

      try {
        if (authUser?.uid) {
          const snapByUid = await getDoc(doc(db, "usuarios", authUser.uid));

          if (snapByUid.exists()) {
            const rol = await obtenerRolDesdeData(snapByUid.data());

            if (rol) {
              setUserRole(rol);
              return;
            }
          }
        }

        if (authUser?.email) {
          const q = query(
            collection(db, "usuarios"),
            where("email", "==", authUser.email),
            limit(1),
          );

          const snapByEmail = await getDocs(q);

          if (!snapByEmail.empty) {
            const rol = await obtenerRolDesdeData(snapByEmail.docs[0].data());

            if (rol) {
              setUserRole(rol);
              return;
            }
          }
        }

        const profileRol = await obtenerRolDesdeData(profile);

        if (profileRol) {
          setUserRole(profileRol);
          return;
        }

        setUserRole("Sin rol");
      } catch {
        const profileRol = await obtenerRolDesdeData(profile);
        setUserRole(profileRol || "Sin rol");
      }
    };

    cargarRolUsuario();
  }, [authUser?.uid, authUser?.email, profile]);

  useEffect(() => {
    if (!loadingPermissions && !authUser) {
      router.replace("/");
    }
  }, [loadingPermissions, authUser, router]);

  useEffect(() => {
    cargarPedidos();
  }, []);

  const cargarPedidos = async () => {
    setLoadingPedidos(true);

    try {
      const snap = await get(ref(dbRealtime, "ORDENES_PEDIDO"));

      if (!snap.exists()) {
        setPedidos([]);
        return;
      }

      const data = snap.val();

      const lista = Object.entries(data).map(([id, value]: any) => ({
        id,
        ...value,
        items: (value.items || []).map((item: PedidoItem) =>
          normalizarItem(item),
        ),
      })) as PedidoGuardado[];

      lista.sort((a, b) => {
        const fechaA = new Date(a.creadoAt || a.fecha || 0).getTime();
        const fechaB = new Date(b.creadoAt || b.fecha || 0).getTime();
        return fechaB - fechaA;
      });

      setPedidos(lista);
    } catch (err: any) {
      setError(`No fue posible cargar órdenes. ${err?.message || ""}`);
    } finally {
      setLoadingPedidos(false);
    }
  };


  const liberarReservasPedido = async (pedido: PedidoGuardado) => {
    const proveedoresSnap = await get(ref(dbRealtime, "PROVEEDORES"));
    if (!proveedoresSnap.exists()) return;

    const proveedoresData = proveedoresSnap.val() || {};
    const updates: Record<string, any> = {};

    Object.entries(proveedoresData || {}).forEach(([codigoProveedor, proveedoresPorCodigo]: any) => {
      Object.entries(proveedoresPorCodigo || {}).forEach(([nombreProveedor, proveedorNode]: any) => {
        Object.entries(proveedorNode?.PRODUCTOS || {}).forEach(([codigoProductoProveedor, productoNode]: any) => {
          Object.entries(productoNode?.RESERVADO_PEDIDOS || {}).forEach(([reservaKey, reserva]: any) => {
            const perteneceAOrden =
              reserva?.ordenPedidoId === pedido.id ||
              reserva?.ordenPedido === pedido.ordenPedido;

            if (!perteneceAOrden) return;

            const productPath = `PROVEEDORES/${codigoProveedor}/${nombreProveedor}/PRODUCTOS/${codigoProductoProveedor}`;
            const movimientoKey = String(reserva?.movimientoKey || "");
            const cantidadLiberar = Number(reserva?.cantidad || 0);

            if (movimientoKey) {
              const movimiento = productoNode?.MOVIMIENTOS?.[movimientoKey] || {};
              const reservadoActual = Number(movimiento?.STOCK_RESERVADO || 0);
              const saldo = Number(movimiento?.SALDO || 0);
              const nuevoReservado = Math.max(0, reservadoActual - cantidadLiberar);

              updates[`${productPath}/MOVIMIENTOS/${movimientoKey}/STOCK_RESERVADO`] = nuevoReservado;
              updates[`${productPath}/MOVIMIENTOS/${movimientoKey}/STOCK_TEORICO`] = saldo - nuevoReservado;
            }

            updates[`${productPath}/RESERVADO_PEDIDOS/${reservaKey}`] = null;
          });
        });
      });
    });

    if (Object.keys(updates).length > 0) {
      await update(ref(dbRealtime), updates);
    }
  };

  const eliminarOrden = async (pedido: PedidoGuardado) => {
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar la orden ${pedido.ordenPedido}? Se eliminará de órdenes creadas, del consecutivo por cliente y se liberarán las reservas asociadas.`
    );

    if (!confirmed) return;

    setDeletingPedidoId(pedido.id);
    setError("");
    setMessage("");

    try {
      await liberarReservasPedido(pedido);

      const updates: Record<string, any> = {
        [`ORDENES_PEDIDO/${pedido.id}`]: null,
      };

      const codigoCliente = cleanKey(pedido.cliente?.codigo_cliente || "");
      if (codigoCliente && pedido.ordenPedido) {
        updates[`PEDIDOS/${codigoCliente}/${pedido.ordenPedido}`] = null;
      }

      await update(ref(dbRealtime), updates);

      setPedidos((current) => current.filter((item) => item.id !== pedido.id));
      setPedidoProductosModal((current) => (current?.id === pedido.id ? null : current));
      setMessage("Orden eliminada correctamente.");
    } catch (err: any) {
      setError(`No fue posible eliminar la orden. ${err?.message || ""}`);
    } finally {
      setDeletingPedidoId(null);
    }
  };

  const aplicarEstadoModal = (
    itemIndex: number,
    procesoKey: string,
    estado: EstadoProceso,
    motivo?: string,
  ) => {
    if (!pedidoProductosModal) return;

    const now = new Date().toISOString();

    const itemsActualizados = (pedidoProductosModal.items || []).map(
      (item, index) => {
        if (index !== itemIndex) return item;

        const estadosMetaActualizados = {
          ...(item.estadosMeta || {}),
        };

        const historialEstadosActualizado = {
          ...(item.historialEstados || {}),
        };

        const nuevoRegistro: EstadoMeta | null =
          estado === "sin_verificar"
            ? null
            : {
                estado,
                usuario: userName,
                uid: authUser?.uid || null,
                email: authUser?.email || null,
                fecha: now,
                rol: userRole,
                ...(estado === "rechazado" ? { motivo: motivo || "" } : {}),
              };

        if (estado === "sin_verificar") {
          delete estadosMetaActualizados[procesoKey];
        } else if (nuevoRegistro) {
          estadosMetaActualizados[procesoKey] = nuevoRegistro;
          historialEstadosActualizado[procesoKey] = [
            ...(historialEstadosActualizado[procesoKey] || []),
            nuevoRegistro,
          ];
        }

        return {
          ...item,
          procesos: {
            ...crearProcesosIniciales(),
            ...(item.procesos || {}),
            [procesoKey]: estado,
          },
          estadosMeta: estadosMetaActualizados,
          historialEstados: historialEstadosActualizado,
        };
      },
    );

    const pedidoActualizado = {
      ...pedidoProductosModal,
      items: itemsActualizados,
    };

    setPedidoProductosModal(pedidoActualizado);

    setPedidos((current) =>
      current.map((pedido) =>
        pedido.id === pedidoActualizado.id ? pedidoActualizado : pedido,
      ),
    );
  };

  const actualizarPlantaModal = (itemIndex: number, planta: string) => {
    if (!pedidoProductosModal) return;

    const pedidoActualizado = {
      ...pedidoProductosModal,
      items: (pedidoProductosModal.items || []).map((item, index) =>
        index === itemIndex ? { ...item, planta } : item,
      ),
    };

    setPedidoProductosModal(pedidoActualizado);
    setPedidos((current) =>
      current.map((pedido) =>
        pedido.id === pedidoActualizado.id ? pedidoActualizado : pedido,
      ),
    );
  };

  const solicitarCambioEstado = (
    itemIndex: number,
    procesoKey: string,
    estado: EstadoProceso,
  ) => {
    const proceso = procesos.find((item) => item.key === procesoKey);

    if (estado === "rechazado") {
      setRechazoModal({
        itemIndex,
        procesoKey,
        procesoTitulo: proceso?.titulo || procesoKey,
        motivo: "",
      });
      return;
    }

    aplicarEstadoModal(itemIndex, procesoKey, estado);
  };

  const confirmarRechazo = () => {
    if (!rechazoModal) return;

    if (!rechazoModal.motivo.trim()) {
      setError("Describe el motivo del rechazo.");
      return;
    }

    aplicarEstadoModal(
      rechazoModal.itemIndex,
      rechazoModal.procesoKey,
      "rechazado",
      rechazoModal.motivo.trim(),
    );

    setRechazoModal(null);
    setError("");
  };

  const abrirVistaRechazo = (
    procesoTitulo: string,
    historial: EstadoMeta[],
  ) => {
    if (historial.length === 0) return;

    setRechazoVistaModal({
      procesoTitulo,
      historial,
    });
  };

  const guardarEstadosModal = async () => {
    if (!pedidoProductosModal) return;

    setSavingEstados(true);
    setError("");
    setMessage("");

    try {
      const estadoCalculado = calcularEstadoOrden(pedidoProductosModal);

      await set(ref(dbRealtime, `ORDENES_PEDIDO/${pedidoProductosModal.id}`), {
        ...pedidoProductosModal,
        estadoGeneral: estadoCalculado,
        items: (pedidoProductosModal.items || []).map((item) =>
          normalizarItem(item),
        ),
        actualizadoPor: userName,
        actualizadoPorUid: authUser?.uid || null,
        actualizadoPorEmail: authUser?.email || null,
        actualizadoAt: new Date().toISOString(),
      });

      setMessage("Estados actualizados correctamente.");
      await cargarPedidos();
    } catch (err: any) {
      setError(`No fue posible guardar los estados. ${err?.message || ""}`);
    } finally {
      setSavingEstados(false);
    }
  };

  const cerrarModalProductos = () => {
    setPedidoProductosModal(null);
    setRechazoModal(null);
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

        <Image
          src="/logo.png"
          alt="Nuall"
          width={105}
          height={45}
          priority
          className="object-contain"
        />

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

      <aside
        className={`fixed z-50 inset-y-0 left-0 ${sidebarCollapsed ? "lg:w-[88px]" : "lg:w-[300px]"} w-[300px] bg-[#244C5A] text-white transform transition-all duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full flex flex-col">
          <div
            className={`px-4 pt-6 pb-5 border-b border-white/10 flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"}`}
          >
            <div className="flex items-center justify-center min-h-[56px]">
              <Image
                src="/logo.png"
                alt="Nuall"
                width={sidebarCollapsed ? 48 : 145}
                height={70}
                priority
                className="object-contain"
              />
            </div>

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
                  {authUser?.email}
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
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-white text-[#244C5A] font-bold shadow-lg ${sidebarCollapsed ? "justify-center" : ""}`}
              onClick={() => setSidebarOpen(false)}
              title="Panel Principal"
            >
              <Home size={20} />
              {!sidebarCollapsed && <span>Panel Principal</span>}
            </Link>

            {filteredSidebarSections.map((section) => {
              const SectionIcon = section.icon;
              const isOpen = openSections[section.title] ?? false;

              return (
                <div key={section.title} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSidebarSection(section.title)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-white/90 hover:bg-white/10 hover:text-white transition ${sidebarCollapsed ? "justify-center" : ""}`}
                    title={section.title}
                  >
                    <span
                      className={`flex items-center gap-3 font-bold ${sidebarCollapsed ? "justify-center" : ""}`}
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
                        const active = item.href === currentPageHref;

                        return (
                          <Link
                            key={item.title}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition ${
                              active
                                ? "bg-white text-[#244C5A] font-black"
                                : "text-white/75 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <Icon size={18} />
                            {item.title}
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
              <LogOut size={19} />
              {!sidebarCollapsed && "Cerrar sesión"}
            </button>
          </div>
        </div>
      </aside>

      <section
        className={`${sidebarPadding} pt-16 lg:pt-0 transition-all duration-300`}
      >
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
              <span className="font-semibold text-slate-500">Comercial</span>
              <span className="text-slate-300">/</span>
              <span className="font-black text-slate-900">Ver órdenes de pedido</span>
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

        <section className="max-w-[1600px] mx-auto px-5 sm:px-8 py-6 space-y-6">
          {(error || message) && (
            <div>
              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError("")}>
                    <X size={18} />
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
            <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                  Histórico
                </p>
                <h2 className="text-2xl font-black mt-1">Órdenes creadas</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Una fila por orden. Los productos y estados se consultan en el
                  modal.
                </p>
              </div>

              <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center flex items-center justify-center gap-2">
                <ClipboardList size={20} />
                {pedidos.length} órdenes
              </div>
            </div>

            {loadingPedidos ? (
              <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
                <Loader2 className="animate-spin" size={22} />
                Cargando órdenes...
              </div>
            ) : pedidos.length === 0 ? (
              <div className="p-8 text-center">
                <ClipboardList className="mx-auto text-[#244C5A]" size={42} />
                <h3 className="font-black text-slate-900 mt-4">
                  No hay órdenes creadas
                </h3>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Orden
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Fecha
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Cliente
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Productos
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Responsable de producción
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Estado
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Eliminar orden
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {pedidos.map((pedido) => (
                      <tr
                        key={pedido.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-black text-slate-900">
                            {pedido.ordenPedido}
                          </p>
                          <p className="text-xs text-slate-500">
                            Creada por {pedido.creadoPor || "Usuario"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {pedido.fecha}
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-black text-slate-900">
                            {pedido.cliente?.codigo_cliente}
                          </p>
                          <p className="text-sm text-slate-500">
                            {pedido.cliente?.nombre}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setPedidoProductosModal(pedido)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-2 text-sm font-black hover:bg-[#244C5A] hover:text-white transition"
                          >
                            <Eye size={17} />
                            Ver productos ({pedido.items?.length || 0})
                          </button>
                        </td>

                        <td className="px-5 py-4">
                          {(() => {
                            const responsablePlanta =
                              obtenerResponsableProduccion(pedido);

                            if (!responsablePlanta) {
                              return (
                                <span className="inline-flex rounded-full bg-slate-100 text-slate-500 px-3 py-1 text-xs font-black">
                                  Aún no hay responsable de producción
                                </span>
                              );
                            }

                            return (
                              <div>
                                <p className="font-black text-slate-900">
                                  {responsablePlanta.usuario}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Rol: {responsablePlanta.rol}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {formatoFechaHora(responsablePlanta.fecha)}
                                </p>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-5 py-4">
                          {(() => {
                            const estadoOrden = calcularEstadoOrden(pedido);

                            return (
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${estadoOrdenClass(
                                  estadoOrden,
                                )}`}
                              >
                                {mostrarEstadoOrden(estadoOrden)}
                              </span>
                            );
                          })()}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => eliminarOrden(pedido)}
                            disabled={deletingPedidoId === pedido.id}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Eliminar orden"
                          >
                            {deletingPedidoId === pedido.id ? (
                              <Loader2 className="animate-spin" size={17} />
                            ) : (
                              <Trash2 size={17} />
                            )}
                            Eliminar
                          </button>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => generarPdfResumenOrden(pedido)}
                              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-200 flex items-center gap-2 transition"
                              title="Ver resumen de la orden en PDF"
                            >
                              <FileText size={17} />
                              PDF
                            </button>

                            <button
                              type="button"
                              onClick={() => setPedidoProductosModal(pedido)}
                              className="rounded-2xl bg-[#244C5A] px-4 py-2 text-sm font-black text-white hover:bg-[#1b3b46] flex items-center gap-2 transition"
                            >
                              <Eye size={17} />
                              Estado
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
        {pedidoProductosModal && (
          <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center px-2 sm:px-4 py-3 sm:py-6">
            <div className="bg-white rounded-[24px] sm:rounded-[28px] shadow-2xl w-full max-w-[98vw] max-h-[94vh] overflow-hidden flex flex-col">
              <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    Productos y estados de la orden
                  </p>

                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    Orden {pedidoProductosModal.ordenPedido}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Fecha: <strong>{pedidoProductosModal.fecha}</strong>
                  </p>

                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Cliente:{" "}
                    <strong>
                      {pedidoProductosModal.cliente?.codigo_cliente} -{" "}
                      {pedidoProductosModal.cliente?.nombre}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={guardarEstadosModal}
                    disabled={savingEstados}
                    className="rounded-2xl bg-[#244C5A] px-4 py-2.5 text-xs sm:text-sm font-black text-white hover:bg-[#1b3b46] flex items-center gap-2 transition disabled:opacity-70"
                  >
                    {savingEstados ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Save size={18} />
                    )}
                    Guardar
                  </button>

                  <button
                    type="button"
                    onClick={cerrarModalProductos}
                    className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-3 sm:p-6 overflow-auto">
                <div className="lg:hidden space-y-4">
                  {(pedidoProductosModal.items || []).map((item, itemIndex) => (
                    <div
                      key={`${item.codigo}-${itemIndex}-mobile`}
                      className="rounded-3xl border border-slate-200 overflow-hidden bg-white"
                    >
                      <div className="p-4 bg-slate-50 border-b border-slate-200">
                        <p className="font-black text-slate-900">
                          {item.codigo}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          {item.producto}
                        </p>

                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <p className="text-[11px] uppercase font-black text-slate-400">
                              Cantidad
                            </p>
                            <p className="font-black text-slate-900">
                              {item.cantidad}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] uppercase font-black text-slate-400">
                              Consecutivo
                            </p>
                            <input
                              type="text"
                              value={item.consecutivo || ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setPedidoProductosModal((current) => {
                                  if (!current) return current;
                                  return {
                                    ...current,
                                    items: (current.items || []).map(
                                      (currentItem, i) =>
                                        i === itemIndex
                                          ? {
                                              ...currentItem,
                                              consecutivo: value,
                                            }
                                          : currentItem,
                                    ),
                                  };
                                });
                              }}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black outline-none focus:border-[#244C5A]"
                              placeholder="Manual"
                            />
                          </div>

                          <div>
                            <p className="text-[11px] uppercase font-black text-slate-400">
                              Planta
                            </p>
                            <select
                              value={item.planta || ""}
                              onChange={(event) =>
                                actualizarPlantaModal(
                                  itemIndex,
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black outline-none focus:border-[#244C5A]"
                            >
                              <option value="">Sin asignar</option>
                              {plantasProduccion.map((planta) => (
                                <option key={planta} value={planta}>
                                  {planta}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="mt-3 rounded-2xl bg-white border border-slate-200 p-3">
                            <p className="text-[11px] uppercase font-black text-slate-400">
                              Responsable producción
                            </p>

                            {(() => {
                              const responsablePlanta =
                                obtenerResponsableProduccion(
                                  pedidoProductosModal,
                                );

                              if (!responsablePlanta) {
                                return (
                                  <p className="font-black text-slate-500 text-sm">
                                    Aún no hay responsable de producción
                                  </p>
                                );
                              }

                              return (
                                <>
                                  <p className="font-black text-slate-900 text-sm">
                                    {responsablePlanta.usuario}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    Rol: {responsablePlanta.rol}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-1">
                                    {formatoFechaHora(responsablePlanta.fecha)}
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="p-3 space-y-3">
                        {procesos.map((proceso) => {
                          const estado =
                            item.procesos?.[proceso.key] || "sin_verificar";
                          const meta = item.estadosMeta?.[proceso.key];

                          return (
                            <div
                              key={`${item.codigo}-${proceso.key}-mobile`}
                              className="rounded-2xl border border-slate-200 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-black text-sm text-slate-900">
                                    {proceso.titulo}
                                  </p>
                                  <p className="text-[11px] font-bold text-slate-400 uppercase">
                                    {proceso.rol}
                                  </p>
                                </div>

                                <span
                                  className={`shrink-0 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${estadoBadgeClass(
                                    estado,
                                  )}`}
                                >
                                  {mostrarEstado(estado)}
                                </span>
                              </div>

                              <select
                                value={estado}
                                onChange={(event) =>
                                  solicitarCambioEstado(
                                    itemIndex,
                                    proceso.key,
                                    event.target.value as EstadoProceso,
                                  )
                                }
                                className={`w-full mt-3 rounded-2xl border px-3 py-3 text-sm font-black outline-none ${estadoSelectClass(
                                  estado,
                                )}`}
                              >
                                <option value="sin_verificar">
                                  Sin verificar
                                </option>
                                <option value="aceptado">Aceptado</option>
                                <option value="rechazado">Rechazado</option>
                              </select>

                              {meta && (
                                <div className="mt-2 text-[11px] text-slate-500 leading-4">
                                  <p>
                                    <strong>{meta.usuario}</strong> ·{" "}
                                    {formatoFechaHora(meta.fecha)}
                                  </p>
                                  {meta.rol && <p>Rol: {meta.rol}</p>}
                                </div>
                              )}

                              {obtenerHistorialRechazos(item, proceso.key)
                                .length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirVistaRechazo(
                                      proceso.titulo,
                                      obtenerHistorialRechazos(
                                        item,
                                        proceso.key,
                                      ),
                                    )
                                  }
                                  className="text-red-600 mt-2 text-[11px] font-black underline"
                                >
                                  Ver rechazo
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden lg:block overflow-auto">
                  <table className="w-full min-w-[2950px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="sticky left-0 z-20 bg-slate-50 text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 min-w-[120px]">
                          Código
                        </th>
                        <th className="sticky left-[120px] z-20 bg-slate-50 text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 min-w-[260px]">
                          Producto
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 min-w-[100px]">
                          Cantidad
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 min-w-[150px]">
                          Consecutivo
                        </th>
                        <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 min-w-[150px]">
                          Planta
                        </th>

                        {procesos.map((proceso) => (
                          <th
                            key={proceso.key}
                            className="px-3 py-3 text-center text-xs font-black uppercase tracking-wide text-slate-500 min-w-[155px]"
                          >
                            <div>{proceso.titulo}</div>
                            <div className="text-[10px] text-slate-400 normal-case">
                              {proceso.rol}
                            </div>
                          </th>
                        ))}

                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500 min-w-[220px]">
                          Responsable producción
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {(pedidoProductosModal.items || []).map(
                        (item, itemIndex) => (
                          <tr
                            key={`${item.codigo}-${itemIndex}`}
                            className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                          >
                            <td className="sticky left-0 z-10 bg-white px-4 py-4 font-black text-slate-900 min-w-[120px]">
                              {item.codigo}
                            </td>

                            <td className="sticky left-[120px] z-10 bg-white px-4 py-4 text-slate-600 min-w-[260px] max-w-[260px]">
                              {item.producto}
                            </td>

                            <td className="px-4 py-4 text-center font-black">
                              {item.cantidad}
                            </td>

                            <td className="px-4 py-4 text-center">
                              <input
                                type="text"
                                value={item.consecutivo || ""}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setPedidoProductosModal((current) => {
                                    if (!current) return current;
                                    return {
                                      ...current,
                                      items: (current.items || []).map(
                                        (currentItem, i) =>
                                          i === itemIndex
                                            ? {
                                                ...currentItem,
                                                consecutivo: value,
                                              }
                                            : currentItem,
                                      ),
                                    };
                                  });
                                }}
                                className="w-32 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center font-black outline-none focus:bg-white focus:border-[#244C5A]"
                                placeholder="Manual"
                              />
                            </td>

                            <td className="px-4 py-4 text-center">
                              <select
                                value={item.planta || ""}
                                onChange={(event) =>
                                  actualizarPlantaModal(
                                    itemIndex,
                                    event.target.value,
                                  )
                                }
                                className="w-36 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-black outline-none focus:bg-white focus:border-[#244C5A]"
                              >
                                <option value="">Sin asignar</option>
                                {plantasProduccion.map((planta) => (
                                  <option key={planta} value={planta}>
                                    {planta}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {procesos.map((proceso) => {
                              const estado =
                                item.procesos?.[proceso.key] || "sin_verificar";
                              const meta = item.estadosMeta?.[proceso.key];

                              return (
                                <td
                                  key={proceso.key}
                                  className="px-3 py-4 text-center align-top"
                                >
                                  <select
                                    value={estado}
                                    onChange={(event) =>
                                      solicitarCambioEstado(
                                        itemIndex,
                                        proceso.key,
                                        event.target.value as EstadoProceso,
                                      )
                                    }
                                    className={`w-full rounded-2xl border px-3 py-2 text-xs font-black outline-none ${estadoSelectClass(
                                      estado,
                                    )}`}
                                  >
                                    <option value="sin_verificar">
                                      Sin verificar
                                    </option>
                                    <option value="aceptado">Aceptado</option>
                                    <option value="rechazado">Rechazado</option>
                                  </select>

                                  {meta && (
                                    <div className="mt-2 text-[10px] text-slate-500 leading-4 text-left">
                                      <p className="font-bold truncate">
                                        {meta.usuario}
                                      </p>
                                      <p>{formatoFechaHora(meta.fecha)}</p>
                                      {meta.rol && <p>Rol: {meta.rol}</p>}
                                    </div>
                                  )}

                                  {obtenerHistorialRechazos(item, proceso.key)
                                    .length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        abrirVistaRechazo(
                                          proceso.titulo,
                                          obtenerHistorialRechazos(
                                            item,
                                            proceso.key,
                                          ),
                                        )
                                      }
                                      className="mt-2 text-[10px] text-red-600 font-black underline"
                                    >
                                      Ver rechazo
                                    </button>
                                  )}
                                </td>
                              );
                            })}

                            <td className="px-4 py-4 text-xs text-slate-600 min-w-[220px] align-top">
                              {(() => {
                                const responsablePlanta =
                                  obtenerResponsableProduccion(
                                    pedidoProductosModal,
                                  );

                                if (!responsablePlanta) {
                                  return (
                                    <span className="inline-flex rounded-full bg-slate-100 text-slate-500 px-3 py-1 text-xs font-black">
                                      Aún no hay responsable de producción
                                    </span>
                                  );
                                }

                                return (
                                  <div>
                                    <p className="font-black text-slate-900">
                                      {responsablePlanta.usuario}
                                    </p>
                                    <p className="text-slate-500 mt-1">
                                      Rol: {responsablePlanta.rol}
                                    </p>
                                    <p className="text-slate-400 mt-1">
                                      {formatoFechaHora(
                                        responsablePlanta.fecha,
                                      )}
                                    </p>
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>

                {(pedidoProductosModal.items || []).length === 0 && (
                  <div className="p-8 text-center text-slate-500 font-semibold">
                    Esta orden no tiene productos cargados.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {rechazoVistaModal && (
          <div className="fixed inset-0 z-[1001] bg-black/60 flex items-center justify-center px-4">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-red-600 uppercase tracking-wide">
                    Rechazo registrado
                  </p>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    {rechazoVistaModal.procesoTitulo}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setRechazoVistaModal(null)}
                  className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {rechazoVistaModal.historial.map((registro, index) => (
                  <div
                    key={`${registro.fecha}-${index}`}
                    className="rounded-2xl border border-red-100 bg-red-50 p-4"
                  >
                    <p className="text-sm font-black text-red-700">
                      Secuencia #{index + 1}
                    </p>
                    <p className="text-sm text-slate-700 mt-2">
                      {registro.motivo || "Sin motivo registrado."}
                    </p>
                    <div className="mt-3 text-xs text-slate-500">
                      <p>
                        <strong>{registro.usuario}</strong>
                      </p>
                      <p>{formatoFechaHora(registro.fecha)}</p>
                      {registro.rol && <p>Rol: {registro.rol}</p>}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setRechazoVistaModal(null)}
                  className="w-full rounded-2xl bg-[#244C5A] px-5 py-3 text-sm font-black text-white hover:bg-[#1b3b46] transition"
                >
                  Cerrar
                </button>
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
                        ? {
                            ...current,
                            motivo: event.target.value,
                          }
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
      </section>
    </main>
  );
}
