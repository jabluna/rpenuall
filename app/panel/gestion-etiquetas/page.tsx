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
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
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
import { onValue, ref, set } from "firebase/database";
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
    icon: ClipboardList,
    items: [
      { title: "Ver órdenes de pedido", icon: Eye, href: "/panel/ordenes_creadas" },
      { title: "Producción x Planta", icon: ClipboardList, href: "/panel/produccionxplanta" },
    ],
  },
  {
    title: "Compras",
    icon: ShoppingCart,
    items: [
      { title: "Crear órdenes de compra", icon: Plus, href: "/panel/compras2" },
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

type EstadoGestion = "sin_verificar" | "aceptado" | "rechazado";

type CompraDetalleItem = {
  id?: string;
  clienteCodigo?: string;
  clienteNombre?: string;
  codigoProducto?: string;
  producto?: string;
  codigoEnvase?: string;
  descripcion?: string;
  unidadEmpaque?: string;
  tipoEmpaque?: string;
  cajasPacas?: string | number;
  total?: string | number;
  stock?: string | number;
  codigoCliente?: string;
  cliente?: string;
  lado?: string;
  stockActual?: string | number;
  tipoEtiqueta?: string;
  materialEtiqueta?: string;
  baseImpresion?: string;
  acabados?: string;
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

const procesos = [
  { key: "factura", titulo: "Factura" },
  { key: "verificacion_bodega", titulo: "Verificación de bodega" },
  {
    key: "comprobante_pago",
    titulo: "Comprobante de pago",
    permiteArchivo: true,
  },
  { key: "recepcion_mercancia", titulo: "Recepción de mercancía" },
  { key: "contabilizacion_factura", titulo: "Contabilización de factura" },
];

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
  if (estado === "rechazado") return "Rechazado";
  return "Sin verificar";
}

function estadoClass(estado?: EstadoGestion) {
  if (estado === "aceptado")
    return "bg-green-50 text-green-700 border-green-200";
  if (estado === "rechazado") return "bg-red-50 text-red-700 border-red-200";
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

export default function GestionComprasEtiquetasPage() {
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
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rechazoModal, setRechazoModal] = useState<RechazoModal | null>(null);
  const [historialModal, setHistorialModal] = useState<HistorialModal | null>(
    null,
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pagina, setPagina] = useState(1);
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
    setOpenSections((current) => ({ ...current, [sectionTitle]: !current[sectionTitle] }));
    if (sidebarCollapsed) setSidebarCollapsed(false);
  };

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

  useEffect(() => {
    if (!loadingPermissions && !authUser) router.replace("/");
  }, [loadingPermissions, authUser, router]);

  useEffect(() => {
    setLoading(true);
    setError("");

    const comprasRef = ref(dbRealtime, "COMPRAS_ETIQUETAS");
    const gestionRef = ref(dbRealtime, "GESTION_COMPRAS_ETIQUETAS");

    const unsubscribeCompras = onValue(
      comprasRef,
      (snap) => {
        const comprasData = snap.exists() ? snap.val() : {};
        const lista = Object.entries(comprasData || {}).map(([id, value]: any) => ({
          id,
          ...value,
          // Compatibilidad con la página nueva de crear compras:
          // allí los productos se guardan como itemsCompra.
          items: value?.items || value?.itemsCompra || [],
          evidenciaUrl: value?.evidenciaUrl || value?.evidenciaCompra?.url || "",
          evidenciaNombre: value?.evidenciaNombre || value?.evidenciaCompra?.nombre || "",
        })) as CompraGuardada[];

        lista.sort(
          (a, b) =>
            new Date(b.creadoAt || b.actualizadoAt || b.fecha || "").getTime() -
            new Date(a.creadoAt || a.actualizadoAt || a.fecha || "").getTime(),
        );

        setCompras(lista);
        setLoading(false);
      },
      (err) => {
        setError(`No fue posible escuchar compras de etiquetas en tiempo real. ${err?.message || ""}`);
        setLoading(false);
      },
    );

    const unsubscribeGestion = onValue(
      gestionRef,
      (snap) => {
        setGestion(snap.exists() ? snap.val() : {});
      },
      (err) => {
        setError(`No fue posible escuchar gestión en tiempo real. ${err?.message || ""}`);
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

      return {
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
    tipo: "factura_compra_etiquetas" | "comprobante_pago",
    file: File,
    itemId?: string,
  ) => {
    setError("");
    setMessage("");
    const uploadId = `${compraId}-${tipo}-${itemId || "general"}`;
    setUploadingKey(uploadId);

    try {
      const path = `gestion-compras-etiquetas/${compraId}/${tipo}/${itemId || "general"}-${Date.now()}-${file.name}`;
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

        if (tipo === "factura_compra_etiquetas") {
          return {
            ...current,
            [compraId]: {
              ...compraGestion,
              fechaGestion: compraGestion.fechaGestion || hoy(),
              facturaCompra: archivo,
              facturaCompraAccion: crearMeta("aceptado"),
              actualizadoAt: new Date().toISOString(),
            },
          };
        }

        const item = itemId || "general";
        const estadosCompra = compraGestion.estados || {};
        const estadosItem = estadosCompra[item] || {};
        const estadoAnterior = estadosItem.comprobante_pago || estadoInicial();

        return {
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
      });

      setMessage("Archivo cargado. Recuerda guardar la gestión.");
    } catch (err: any) {
      setError(`No fue posible subir el archivo. ${err?.message || ""}`);
    } finally {
      setUploadingKey("");
    }
  };

  const guardarGestion = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await set(ref(dbRealtime, "GESTION_COMPRAS_ETIQUETAS"), gestion);
      setMessage("Gestión de compras etiquetas guardada correctamente.");
      // La actualización se refleja automáticamente por onValue().
    } catch (err: any) {
      setError(`No fue posible guardar la gestión. ${err?.message || ""}`);
    } finally {
      setSaving(false);
    }
  };

  const comprasFiltradas = useMemo(() => {
    return compras.filter((compra) => compra.estado !== "anulada");
  }, [compras]);

  const comprasPaginadas = useMemo(() => {
    return comprasFiltradas.slice((pagina - 1) * 10, pagina * 10);
  }, [comprasFiltradas, pagina]);

  const totalPaginas = Math.max(1, Math.ceil(comprasFiltradas.length / 10));

  const resumenEstadosCompra = (compra: CompraGuardada) => {
    const items = compra.items || [];
    const total = items.length * procesos.length;
    let aceptados = 0;
    let rechazados = 0;

    items.forEach((item, index) => {
      const key = itemKey(item, index);
      procesos.forEach((proceso) => {
        const estado = obtenerEstado(compra.id, key, proceso.key).estado;
        if (estado === "aceptado") aceptados += 1;
        if (estado === "rechazado") rechazados += 1;
      });
    });

    return { total, aceptados, rechazados };
  };

  const toggleExpanded = (compraId: string) => {
    setExpanded((current) => ({ ...current, [compraId]: !current[compraId] }));
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
        userRole={(profile as any)?.rolNombre || (profile as any)?.role || (profile as any)?.rol || "Sin rol"}
      />

      <section className={`${sidebarWidth} transition-all duration-300`}>
      <header className="bg-[#244C5A] text-white">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>

            <button
              type="button"
              onClick={() => router.push("/panel")}
              className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition"
            >
              <ArrowLeft size={22} />
            </button>

            <div className="hidden sm:block bg-white/10 border border-white/15 rounded-3xl px-5 py-2.5">
              <Image
                src="/logo.png"
                alt="Nuall"
                width={115}
                height={56}
                priority
              />
            </div>

            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-white/65">
                Panel administrativo
              </p>
              <h1 className="text-xl sm:text-3xl font-black truncate">
                Gestión de compras etiquetas
              </h1>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold truncate max-w-[220px]">
                {userName}
              </p>
              <p className="text-xs text-white/60 truncate max-w-[220px]">
                {authUser?.email}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 rounded-2xl px-4 py-3 font-semibold transition"
            >
              <LogOut size={18} />
              Salir
            </button>
          </div>
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
              <h2 className="text-2xl font-black mt-1">Compras de etiquetas</h2>
              <p className="text-slate-500 text-sm mt-1">
                Vista tipo Excel: se muestran las 10 últimas compras por página.
                Cada fila se despliega para revisar producto por producto. La evidencia se toma de la orden de compra de etiquetas creada en la pantalla anterior.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="rounded-2xl bg-slate-100 border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 text-center">
                Página {pagina} de {totalPaginas} · {comprasFiltradas.length}{" "}
                compras
              </div>
              <button
                type="button"
                onClick={guardarGestion}
                disabled={saving}
                className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Save size={20} />
                )}
                {saving ? "Guardando..." : "Guardar gestión"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
              <Loader2 className="animate-spin" size={22} />
              Cargando compras de etiquetas...
            </div>
          ) : comprasFiltradas.length === 0 ? (
            <div className="p-8 text-center">
              <ClipboardCheck className="mx-auto text-[#244C5A]" size={44} />
              <h3 className="font-black text-slate-900 mt-4">
                No hay compras de etiquetas creadas
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
                        Primera etiqueta a comprar
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
                          <tr className={`border-b align-top transition ${estaAbierta ? "bg-emerald-50 hover:bg-emerald-50/90 border-emerald-200" : "border-slate-100 hover:bg-slate-50"}`}>
                            <td className="px-4 py-4">
                              <p className="font-black text-slate-900">
                                {gestionCompra.fechaGestion || hoy()}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(() => {
                                  const factura = obtenerFacturaCompra(compra);
                                  const uploadId = `${compra.id}-factura_compra_etiquetas-general`;
                                  return (
                                    <>
                                      <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] cursor-pointer transition">
                                        {uploadingKey === uploadId ? (
                                          <Loader2 className="animate-spin" size={15} />
                                        ) : (
                                          <Upload size={15} />
                                        )}
                                        {factura ? "Cambiar archivo" : "Adjuntar archivo"}
                                        <input
                                          type="file"
                                          accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                                          className="hidden"
                                          onChange={(event) => {
                                            const file = event.target.files?.[0];
                                            if (file) subirArchivo(compra.id, "factura_compra_etiquetas", file);
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
                                          <Eye size={15} /> Ver archivo
                                        </a>
                                      ) : (
                                        <span className="inline-flex items-center rounded-xl bg-yellow-50 border border-yellow-100 px-3 py-2 text-xs font-black text-yellow-700">
                                          No se ha adjuntado archivo
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              {obtenerFacturaCompra(compra)?.fecha && (
                                <div className="mt-2 text-[11px] text-slate-500 leading-4">
                                  <p>
                                    <strong>{obtenerFacturaCompra(compra)?.subidoPor || "Usuario"}</strong>
                                  </p>
                                  <p>{formatoFechaHora(obtenerFacturaCompra(compra)?.fecha)}</p>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <p className="text-lg font-black text-[#244C5A]">
                                {compra.consecutivo}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Estado:{" "}
                                <strong>{compra.estado || "en_proceso"}</strong>
                              </p>
                              <p className="text-xs text-slate-500 mt-1 truncate">
                                {compra.creadoPor || "Usuario"}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              {primerItem ? (
                                <div>
                                  <p className="font-black text-slate-900">
                                    {primerItem.codigoEnvase || primerItem.codigoProducto || "Sin código"}
                                  </p>
                                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                                    {primerItem.descripcion || primerItem.producto || "Sin descripción"}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-2">
                                    Cliente:{" "}
                                    <strong>
                                      {primerItem.cliente || primerItem.clienteNombre || primerItem.codigoCliente || "Sin cliente"}
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
                              <button
                                type="button"
                                onClick={() => toggleExpanded(compra.id)}
                                className="rounded-2xl bg-[#244C5A] text-white px-4 py-2 text-xs font-black hover:bg-[#1b3b46] transition"
                              >
                                {estaAbierta ? "Ocultar" : "Desplegar"}
                              </button>
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
                                      Cada fila es una etiqueta/compra
                                      solicitada. Cada estado se maneja de forma
                                      individual.
                                    </p>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1150px] border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                          <th className="text-left px-3 py-3 text-[11px] font-black uppercase text-slate-500 w-[250px]">
                                            Etiqueta / cliente
                                          </th>
                                          <th className="text-center px-3 py-3 text-[11px] font-black uppercase text-slate-500 w-[110px]">
                                            Compra
                                          </th>
                                          {procesos.map((proceso) => (
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
                                                  {item.codigoEnvase || item.codigoProducto || "Sin código"}
                                                </p>
                                                <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                                                  {item.descripcion || item.producto || "Sin descripción"}
                                                </p>
                                                <p className="text-[11px] text-slate-500 mt-1">
                                                  Cliente:{" "}
                                                  <strong>
                                                    {item.cliente || item.clienteNombre || item.codigoCliente || "Sin cliente"}
                                                  </strong>
                                                </p>
                                              </td>
                                              <td className="px-3 py-3 text-center font-black text-slate-900">
                                                {item.total || 0}
                                              </td>
                                              {procesos.map((proceso) => {
                                                const estado = obtenerEstado(
                                                  compra.id,
                                                  key,
                                                  proceso.key,
                                                );
                                                const historial =
                                                  estado.historialRechazos ||
                                                  [];
                                                const uploadId = `${compra.id}-comprobante_pago-${key}`;
                                                return (
                                                  <td
                                                    key={`${compra.id}-${key}-${proceso.key}`}
                                                    className="px-3 py-3"
                                                  >
                                                    <select
                                                      value={estado.estado}
                                                      onChange={(event) =>
                                                        solicitarEstado(
                                                          compra.id,
                                                          key,
                                                          proceso.key,
                                                          proceso.titulo,
                                                          nombreItem(item),
                                                          event.target
                                                            .value as EstadoGestion,
                                                        )
                                                      }
                                                      className={`w-full rounded-xl border px-2 py-2 text-xs font-black outline-none ${estadoClass(estado.estado)}`}
                                                    >
                                                      <option value="sin_verificar">
                                                        Sin verificar
                                                      </option>
                                                      <option value="aceptado">
                                                        Aceptado
                                                      </option>
                                                      <option value="rechazado">
                                                        Rechazado
                                                      </option>
                                                    </select>
                                                    {proceso.permiteArchivo && (
                                                      <div className="mt-2 flex flex-wrap gap-2">
                                                        <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-2.5 py-2 text-[11px] font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] cursor-pointer transition">
                                                          {uploadingKey ===
                                                          uploadId ? (
                                                            <Loader2
                                                              className="animate-spin"
                                                              size={14}
                                                            />
                                                          ) : (
                                                            <Upload size={14} />
                                                          )}
                                                          Adjuntar
                                                          <input
                                                            type="file"
                                                            accept="application/pdf,image/*"
                                                            className="hidden"
                                                            onChange={(
                                                              event,
                                                            ) => {
                                                              const file =
                                                                event.target
                                                                  .files?.[0];
                                                              if (file)
                                                                subirArchivo(
                                                                  compra.id,
                                                                  "comprobante_pago",
                                                                  file,
                                                                  key,
                                                                );
                                                              event.currentTarget.value =
                                                                "";
                                                            }}
                                                          />
                                                        </label>
                                                        {estado.archivo
                                                          ?.url && (
                                                          <a
                                                            href={
                                                              estado.archivo.url
                                                            }
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-2 text-[11px] font-black text-slate-600 hover:bg-[#244C5A] hover:text-white transition"
                                                          >
                                                            <FileText
                                                              size={14}
                                                            />{" "}
                                                            Ver
                                                          </a>
                                                        )}
                                                      </div>
                                                    )}
                                                    {estado.meta && (
                                                      <div className="mt-2 text-[10px] text-slate-500 leading-4">
                                                        <p className="font-bold truncate">
                                                          {estado.meta.usuario}
                                                        </p>
                                                        <p>
                                                          {formatoFechaHora(
                                                            estado.meta.fecha,
                                                          )}
                                                        </p>
                                                      </div>
                                                    )}
                                                    {historial.length > 0 && (
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          setHistorialModal({
                                                            titulo: `${proceso.titulo} · ${nombreItem(item)}`,
                                                            historial,
                                                          })
                                                        }
                                                        className="mt-2 text-[11px] text-red-600 font-black underline"
                                                      >
                                                        Ver rechazos (
                                                        {historial.length})
                                                      </button>
                                                    )}
                                                  </td>
                                                );
                                              })}
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
                    <div key={`${compra.id}-mobile`} className={`p-4 transition ${estaAbierta ? "bg-emerald-50 border-l-4 border-emerald-400" : "bg-white"}`}>
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
                            {primerItem.codigoEnvase || primerItem.codigoProducto || "Sin código"}
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            {primerItem.descripcion || "Sin descripción"}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Cliente:{" "}
                            <strong>
                              {primerItem.cliente || primerItem.clienteNombre || primerItem.codigoCliente || "Sin cliente"}
                            </strong>{" "}
                            · Compra: <strong>{primerItem.total || 0}</strong>
                          </p>
                        </div>
                      )}

                      <div className="mt-4 flex flex-col gap-2">
                        {(() => {
                          const factura = obtenerFacturaCompra(compra);
                          const uploadId = `${compra.id}-factura_compra_etiquetas-general`;
                          return (
                            <>
                              <label className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-3 py-3 text-xs font-black text-slate-600 cursor-pointer">
                                {uploadingKey === uploadId ? (
                                  <Loader2 className="animate-spin" size={15} />
                                ) : (
                                  <Upload size={15} />
                                )}
                                {factura ? "Cambiar archivo" : "Adjuntar archivo"}
                                <input
                                  type="file"
                                  accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                                  className="hidden"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) subirArchivo(compra.id, "factura_compra_etiquetas", file);
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
                                  <Eye size={15} /> Ver archivo
                                </a>
                              ) : (
                                <div className="rounded-2xl bg-yellow-50 border border-yellow-100 px-3 py-3 text-xs font-black text-yellow-700 text-center">
                                  No se ha adjuntado archivo
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

                      <button
                        type="button"
                        onClick={() => toggleExpanded(compra.id)}
                        className="w-full mt-4 rounded-2xl bg-[#244C5A] text-white px-4 py-3 text-sm font-black"
                      >
                        {estaAbierta
                          ? "Ocultar productos"
                          : "Desplegar productos"}
                      </button>

                      {estaAbierta && (
                        <div className="mt-4 space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-3">
                          {items.map((item, index) => {
                            const key = itemKey(item, index);
                            return (
                              <div
                                key={`${compra.id}-mobile-item-${key}`}
                                className="rounded-3xl border border-slate-200 overflow-hidden"
                              >
                                <div className="p-4 bg-slate-50 border-b border-slate-200">
                                  <p className="font-black text-slate-900">
                                    {item.codigoEnvase || item.codigoProducto || "Sin código"}
                                  </p>
                                  <p className="text-sm text-slate-600 mt-1">
                                    {item.descripcion || item.producto || "Sin descripción"}
                                  </p>
                                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                                    <div>
                                      <p className="text-slate-400 font-black uppercase">
                                        Cliente
                                      </p>
                                      <p className="font-black text-slate-700">
                                        {item.cliente || item.clienteNombre || item.codigoCliente || "N/A"}
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
                                  {procesos.map((proceso) => {
                                    const estado = obtenerEstado(
                                      compra.id,
                                      key,
                                      proceso.key,
                                    );
                                    const historial =
                                      estado.historialRechazos || [];
                                    const uploadId = `${compra.id}-comprobante_pago-${key}`;
                                    return (
                                      <div
                                        key={`${compra.id}-mobile-${key}-${proceso.key}`}
                                        className="rounded-2xl border border-slate-200 p-3"
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <p className="font-black text-sm text-slate-900">
                                            {proceso.titulo}
                                          </p>
                                          <span
                                            className={`rounded-full border px-2 py-1 text-[10px] font-black ${estadoClass(estado.estado)}`}
                                          >
                                            {mostrarEstado(estado.estado)}
                                          </span>
                                        </div>
                                        <select
                                          value={estado.estado}
                                          onChange={(event) =>
                                            solicitarEstado(
                                              compra.id,
                                              key,
                                              proceso.key,
                                              proceso.titulo,
                                              nombreItem(item),
                                              event.target
                                                .value as EstadoGestion,
                                            )
                                          }
                                          className={`w-full mt-3 rounded-2xl border px-3 py-3 text-sm font-black outline-none ${estadoClass(estado.estado)}`}
                                        >
                                          <option value="sin_verificar">
                                            Sin verificar
                                          </option>
                                          <option value="aceptado">
                                            Aceptado
                                          </option>
                                          <option value="rechazado">
                                            Rechazado
                                          </option>
                                        </select>
                                        {proceso.permiteArchivo && (
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-2.5 py-2 text-[11px] font-black text-slate-600 cursor-pointer">
                                              {uploadingKey === uploadId ? (
                                                <Loader2
                                                  className="animate-spin"
                                                  size={14}
                                                />
                                              ) : (
                                                <Upload size={14} />
                                              )}
                                              Adjuntar
                                              <input
                                                type="file"
                                                accept="application/pdf,image/*"
                                                className="hidden"
                                                onChange={(event) => {
                                                  const file =
                                                    event.target.files?.[0];
                                                  if (file)
                                                    subirArchivo(
                                                      compra.id,
                                                      "comprobante_pago",
                                                      file,
                                                      key,
                                                    );
                                                  event.currentTarget.value =
                                                    "";
                                                }}
                                              />
                                            </label>
                                            {estado.archivo?.url && (
                                              <a
                                                href={estado.archivo.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-2 text-[11px] font-black text-slate-600"
                                              >
                                                <FileText size={14} /> Ver
                                              </a>
                                            )}
                                          </div>
                                        )}
                                        {estado.meta && (
                                          <div className="mt-2 text-[11px] text-slate-500 leading-4">
                                            <p className="font-bold">
                                              {estado.meta.usuario}
                                            </p>
                                            <p>
                                              {formatoFechaHora(
                                                estado.meta.fecha,
                                              )}
                                            </p>
                                          </div>
                                        )}
                                        {historial.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setHistorialModal({
                                                titulo: `${proceso.titulo} · ${nombreItem(item)}`,
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
                                  })}
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
