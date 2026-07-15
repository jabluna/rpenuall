"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Eye,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
  Search,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { getDatabase, onValue, push, ref, set } from "firebase/database";
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

type ProductoEtiqueta = {
  id: string;
  codigoCliente: string;
  cliente: string;
  codigoProducto: string;
  producto: string;
  tipoEtiqueta: string;
  materialEtiqueta: string;
  baseImpresion: string;
  acabados: string;
  stockFrente: number;
  stockDorso: number;
};

type AlertaEtiqueta = {
  id: string;
  codigoCliente: string;
  cliente: string;
  codigoProducto: string;
  producto: string;
  lado: "frente" | "dorso";
  stockActual: number;
  tipoEtiqueta: string;
  materialEtiqueta: string;
  estado: "negativo" | "cero" | "bajo";
};

type CompraEtiquetaItem = {
  origen: "alerta" | "manual";
  productKey: string;
  alertaId?: string;
  codigoCliente: string;
  cliente: string;
  codigoProducto: string;
  producto: string;
  lado: "frente" | "dorso";
  cantidad: string;
  totalComprar: number;
  stockActual: number;
  tipoEtiqueta: string;
  materialEtiqueta: string;
  baseImpresion: string;
  acabados: string;
};

function normalizeText(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function cleanKey(value: string) {
  return value.trim().toUpperCase().replace(/[.#$/[\]]/g, "-");
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

function formatNumber(value: unknown) {
  const numberValue = toNumber(value);
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(numberValue);
}

function getEstadoClass(stock: number) {
  if (stock < 0) return "bg-red-50 text-red-700 border-red-100";
  if (stock === 0) return "bg-orange-50 text-orange-700 border-orange-100";
  return "bg-yellow-50 text-yellow-800 border-yellow-100";
}

function getEstadoLabel(stock: number) {
  if (stock < 0) return "Stock negativo";
  if (stock === 0) return "Stock en cero";
  return "Stock bajo";
}

function getProductStock(rawStock: any, lado: "frente" | "dorso") {
  if (rawStock && typeof rawStock === "object" && !Array.isArray(rawStock)) {
    return toNumber(rawStock[lado]);
  }

  if (lado === "frente") return toNumber(rawStock);
  return 0;
}

function mapEtiquetas(data: any) {
  const productos: ProductoEtiqueta[] = [];
  const alertas: AlertaEtiqueta[] = [];

  Object.entries(data || {}).forEach(([clienteKey, clienteNode]: any) => {
    const codigoCliente = cleanKey(normalizeText(clienteNode?.codigoCliente || clienteKey));
    const cliente = normalizeText(clienteNode?.cliente || clienteKey).trim();
    const productosNode = clienteNode?.productos || {};

    Object.entries(productosNode).forEach(([productoKey, productoNode]: any) => {
      const codigoProducto = cleanKey(normalizeText(productoNode?.codigo || productoKey));
      const producto = normalizeText(productoNode?.producto || productoKey).trim();
      const tipoEtiqueta = normalizeText(productoNode?.tipoEtiqueta);
      const materialEtiqueta = normalizeText(productoNode?.materialEtiqueta);
      const baseImpresion = normalizeText(productoNode?.baseImpresion);
      const acabados = normalizeText(productoNode?.acabados || productoNode?.acabado);
      const stockFrente = getProductStock(productoNode?.stock, "frente");
      const stockDorso = getProductStock(productoNode?.stock, "dorso");

      const row: ProductoEtiqueta = {
        id: `${codigoCliente}_${codigoProducto}`,
        codigoCliente,
        cliente,
        codigoProducto,
        producto,
        tipoEtiqueta,
        materialEtiqueta,
        baseImpresion,
        acabados,
        stockFrente,
        stockDorso,
      };

      productos.push(row);

      ([
        ["frente", stockFrente],
        ["dorso", stockDorso],
      ] as Array<["frente" | "dorso", number]>).forEach(([lado, stockActual]) => {
        if (stockActual <= 10) {
          alertas.push({
            id: `${codigoCliente}_${codigoProducto}_${lado}`,
            codigoCliente,
            cliente,
            codigoProducto,
            producto,
            lado,
            stockActual,
            tipoEtiqueta,
            materialEtiqueta,
            estado: stockActual < 0 ? "negativo" : stockActual === 0 ? "cero" : "bajo",
          });
        }
      });
    });
  });

  productos.sort((a, b) => a.cliente.localeCompare(b.cliente) || a.producto.localeCompare(b.producto));
  alertas.sort((a, b) => a.stockActual - b.stockActual || a.cliente.localeCompare(b.cliente) || a.producto.localeCompare(b.producto));

  return { productos, alertas };
}

export default function CompraEtiquetaPage() {
  const router = useRouter();
  const realtimeDb = getDatabase(auth.app);

  const {
    authUser,
    profile,
    loading: loadingPermissions,
    isActive,
  } = useUserPermissions();

  const [productos, setProductos] = useState<ProductoEtiqueta[]>([]);
  const [alertas, setAlertas] = useState<AlertaEtiqueta[]>([]);
  const [loadingEtiquetas, setLoadingEtiquetas] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fecha, setFecha] = useState(todayISO());
  const [manualFecha, setManualFecha] = useState(todayISO());
  const [ordenCompra, setOrdenCompra] = useState("");

  const [items, setItems] = useState<CompraEtiquetaItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"alerta" | "manual">("alerta");
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [selectedClienteCode, setSelectedClienteCode] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedLado, setSelectedLado] = useState<"frente" | "dorso">("frente");
  const [cantidad, setCantidad] = useState("");
  const [search, setSearch] = useState("");
  const [quickPage, setQuickPage] = useState(1);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const userName = useMemo(() => {
    return profile?.nombre || authUser?.displayName || authUser?.email?.split("@")[0] || "Administrador";
  }, [profile, authUser]);

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((current) => ({ ...current, [sectionTitle]: !current[sectionTitle] }));
    if (sidebarCollapsed) setSidebarCollapsed(false);
  };

  const clientesOptions = useMemo(() => {
    const map: Record<string, { codigoCliente: string; cliente: string; totalProductos: number }> = {};

    productos.forEach((producto) => {
      if (!map[producto.codigoCliente]) {
        map[producto.codigoCliente] = {
          codigoCliente: producto.codigoCliente,
          cliente: producto.cliente,
          totalProductos: 0,
        };
      }

      map[producto.codigoCliente].totalProductos += 1;
    });

    return Object.values(map).sort((a, b) => a.cliente.localeCompare(b.cliente));
  }, [productos]);

  const selectedAlert = useMemo(() => {
    return alertas.find((alerta) => alerta.id === selectedAlertId) || null;
  }, [alertas, selectedAlertId]);

  const productosCliente = useMemo(() => {
    return productos.filter((producto) => producto.codigoCliente === selectedClienteCode);
  }, [productos, selectedClienteCode]);

  const selectedProduct = useMemo(() => {
    return productos.find((producto) => producto.id === selectedProductId) || null;
  }, [productos, selectedProductId]);

  const stockModal = useMemo(() => {
    if (modalMode === "alerta") return selectedAlert?.stockActual ?? 0;
    if (!selectedProduct) return 0;
    return selectedLado === "frente" ? selectedProduct.stockFrente : selectedProduct.stockDorso;
  }, [modalMode, selectedAlert, selectedProduct, selectedLado]);

  const alertasFiltradas = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    if (!cleanSearch) return alertas;

    return alertas.filter((alerta) => {
      return (
        alerta.codigoCliente.toLowerCase().includes(cleanSearch) ||
        alerta.cliente.toLowerCase().includes(cleanSearch) ||
        alerta.codigoProducto.toLowerCase().includes(cleanSearch) ||
        alerta.producto.toLowerCase().includes(cleanSearch) ||
        alerta.lado.toLowerCase().includes(cleanSearch)
      );
    });
  }, [alertas, search]);

  const productosFiltrados = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    if (!cleanSearch) return productos;

    return productos.filter((producto) => {
      return (
        producto.codigoCliente.toLowerCase().includes(cleanSearch) ||
        producto.cliente.toLowerCase().includes(cleanSearch) ||
        producto.codigoProducto.toLowerCase().includes(cleanSearch) ||
        producto.producto.toLowerCase().includes(cleanSearch)
      );
    });
  }, [productos, search]);

  const alertItems = useMemo(() => {
    return items.map((item, index) => ({ item, index })).filter(({ item }) => item.origen === "alerta");
  }, [items]);

  const manualItems = useMemo(() => {
    return items.map((item, index) => ({ item, index })).filter(({ item }) => item.origen === "manual");
  }, [items]);

  const quickPerPage = 10;

  const quickTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(alertasFiltradas.length / quickPerPage));
  }, [alertasFiltradas.length]);

  const alertasPaginadas = useMemo(() => {
    const start = (quickPage - 1) * quickPerPage;
    return alertasFiltradas.slice(start, start + quickPerPage);
  }, [alertasFiltradas, quickPage]);

  useEffect(() => {
    setQuickPage(1);
  }, [search, alertasFiltradas.length]);

  useEffect(() => {
    if (!loadingPermissions && !authUser) router.replace("/");
  }, [loadingPermissions, authUser, router]);

  useEffect(() => {
    if (loadingPermissions || !authUser) return;

    setLoadingEtiquetas(true);

    const unsubscribe = onValue(
      ref(realtimeDb, "ETIQUETAS/CLIENTES"),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() || {} : {};
        const mapped = mapEtiquetas(data);
        setProductos(mapped.productos);
        setAlertas(mapped.alertas);
        setLoadingEtiquetas(false);
      },
      (err) => {
        setError(`No fue posible cargar etiquetas. ${err.message}`);
        setLoadingEtiquetas(false);
      },
    );

    return () => unsubscribe();
  }, [loadingPermissions, authUser, realtimeDb]);

  const resetModal = () => {
    setSelectedAlertId("");
    setSelectedClienteCode("");
    setSelectedProductId("");
    setSelectedLado("frente");
    setCantidad("");
    setEditingItemIndex(null);
    setSearch("");
    setModalOpen(false);
  };

  const openNewAlertModal = (alertaId = "") => {
    setModalMode("alerta");
    setEditingItemIndex(null);
    setSelectedAlertId(alertaId);
    setSelectedClienteCode("");
    setSelectedProductId("");
    setSelectedLado("frente");
    setCantidad("");
    setSearch("");
    setModalOpen(true);
  };

  const openManualModal = () => {
    setModalMode("manual");
    setEditingItemIndex(null);
    setSelectedAlertId("");
    setSelectedClienteCode("");
    setSelectedProductId("");
    setSelectedLado("frente");
    setCantidad("");
    setSearch("");
    setModalOpen(true);
  };

  const openEditItemModal = (index: number) => {
    const item = items[index];
    if (!item) return;

    setEditingItemIndex(index);
    setModalMode(item.origen);
    setSelectedAlertId(item.alertaId || "");
    setSelectedClienteCode(item.codigoCliente);
    setSelectedProductId(item.productKey);
    setSelectedLado(item.lado);
    setCantidad(item.cantidad || "");
    setSearch("");
    setModalOpen(true);
  };

  const handleAddItem = () => {
    setError("");
    setMessage("");

    if (!cantidad.trim() || toNumber(cantidad) <= 0) {
      setError("Digita una cantidad válida para comprar.");
      return;
    }

    let nextItem: CompraEtiquetaItem | null = null;

    if (modalMode === "alerta") {
      if (!selectedAlert) {
        setError("Selecciona una etiqueta en alerta.");
        return;
      }

      nextItem = {
        origen: "alerta",
        productKey: `${selectedAlert.codigoCliente}_${selectedAlert.codigoProducto}`,
        alertaId: selectedAlert.id,
        codigoCliente: selectedAlert.codigoCliente,
        cliente: selectedAlert.cliente,
        codigoProducto: selectedAlert.codigoProducto,
        producto: selectedAlert.producto,
        lado: selectedAlert.lado,
        cantidad: cantidad.trim(),
        totalComprar: toNumber(cantidad),
        stockActual: selectedAlert.stockActual,
        tipoEtiqueta: selectedAlert.tipoEtiqueta,
        materialEtiqueta: selectedAlert.materialEtiqueta,
        baseImpresion: "",
        acabados: "",
      };
    }

    if (modalMode === "manual") {
      if (!selectedProduct) {
        setError("Selecciona cliente y producto.");
        return;
      }

      const stockActual = selectedLado === "frente" ? selectedProduct.stockFrente : selectedProduct.stockDorso;

      nextItem = {
        origen: "manual",
        productKey: selectedProduct.id,
        codigoCliente: selectedProduct.codigoCliente,
        cliente: selectedProduct.cliente,
        codigoProducto: selectedProduct.codigoProducto,
        producto: selectedProduct.producto,
        lado: selectedLado,
        cantidad: cantidad.trim(),
        totalComprar: toNumber(cantidad),
        stockActual,
        tipoEtiqueta: selectedProduct.tipoEtiqueta,
        materialEtiqueta: selectedProduct.materialEtiqueta,
        baseImpresion: selectedProduct.baseImpresion,
        acabados: selectedProduct.acabados,
      };
    }

    if (!nextItem) return;

    const exists = items.some((item, index) => {
      if (index === editingItemIndex) return false;
      return item.codigoCliente === nextItem?.codigoCliente && item.codigoProducto === nextItem?.codigoProducto && item.lado === nextItem?.lado && item.origen === nextItem?.origen;
    });

    if (exists) {
      setError("Esta etiqueta ya está agregada en esta orden.");
      return;
    }

    setItems((current) => {
      if (editingItemIndex !== null) {
        return current.map((item, index) => (index === editingItemIndex ? nextItem as CompraEtiquetaItem : item));
      }

      return [...current, nextItem as CompraEtiquetaItem];
    });

    resetModal();
  };

  const handleRemoveItem = (indexToRemove: number) => {
    setItems((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const handleSaveCompra = async (tipoOrden: "alerta" | "manual") => {
    setError("");
    setMessage("");

    const itemsGuardar = tipoOrden === "alerta" ? alertItems : manualItems;
    const fechaOrden = tipoOrden === "alerta" ? fecha : manualFecha;

    if (itemsGuardar.length === 0) {
      setError("Agrega al menos una etiqueta a la orden.");
      return;
    }

    if (!fechaOrden) {
      setError("La fecha de la orden es obligatoria.");
      return;
    }

    if (!ordenCompra.trim()) {
      setError("Digita manualmente el número de orden de compra.");
      return;
    }

    setSaving(true);

    try {
      const now = new Date().toISOString();
      const compraRef = push(ref(realtimeDb, "COMPRAS_ETIQUETAS"));
      const ordenLimpia = cleanKey(ordenCompra);

      await set(compraRef, {
        consecutivo: ordenLimpia,
        ordenCompra: ordenLimpia,
        fecha: fechaOrden,
        origen: tipoOrden === "alerta" ? "ALERTAS_ETIQUETAS" : "COMPRA_MANUAL_ETIQUETAS",
        estado: "creada",
        itemsCompra: itemsGuardar.map(({ item }, index) => ({
          item: index + 1,
          codigoCliente: item.codigoCliente,
          cliente: item.cliente,
          codigoProducto: item.codigoProducto,
          producto: item.producto,
          lado: item.lado,
          descripcion: `${item.producto} · ${item.lado.toUpperCase()}`,
          cantidadComprar: item.totalComprar,
          total: item.totalComprar,
          totalUnidades: item.totalComprar,
          stockActual: item.stockActual,
          tipoEtiqueta: item.tipoEtiqueta,
          materialEtiqueta: item.materialEtiqueta,
          baseImpresion: item.baseImpresion,
          acabados: item.acabados,
          origen: item.origen,
          productKey: item.productKey,
          alertaId: item.alertaId || null,
        })),
        creadoAt: now,
        actualizadoAt: now,
        creadoPorUid: authUser?.uid || null,
        creadoPorEmail: authUser?.email || null,
      });

      const indicesGuardados = itemsGuardar.map(({ index }) => index);
      setItems((current) => current.filter((_, index) => !indicesGuardados.includes(index)));
      setMessage(`Orden de compra de etiquetas ${ordenLimpia} creada correctamente.`);
    } catch (err: any) {
      setError(`No fue posible guardar la orden de etiquetas. ${err?.message || ""}`);
    } finally {
      setSaving(false);
    }
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
          <div className="max-w-[1600px] mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
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
                aria-label="Volver al panel"
              >
                <ArrowLeft size={22} />
              </button>

              <div className="hidden sm:block bg-white/10 border border-white/15 rounded-3xl px-5 py-2.5">
                <Image src="/logo.png" alt="Nuall" width={115} height={56} priority />
              </div>

              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-white/65">Panel administrativo / Etiquetas</p>
                <h1 className="text-xl sm:text-3xl font-black truncate">Crear compra de etiquetas</h1>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-bold truncate max-w-[220px]">{userName}</p>
                <p className="text-xs text-white/60 truncate max-w-[220px]">{authUser?.email}</p>
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

        <section className="max-w-[1600px] mx-auto px-5 sm:px-8 py-6">
          {(error || message) && (
            <div className="mb-5 space-y-2">
              {error && <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>}
              {message && <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">{message}</div>}
            </div>
          )}

          <section className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">Orden de compra etiquetas</p>
                <h2 className="text-2xl font-black mt-1">Etiquetas en alerta para comprar</h2>
                <p className="text-sm text-slate-500 mt-1">Se muestran etiquetas con saldo negativo, en cero o menor/igual a 10.</p>
              </div>

              <button
                type="button"
                onClick={() => handleSaveCompra("alerta")}
                disabled={saving || alertItems.length === 0}
                className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-60 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {saving ? "Guardando..." : "Guardar orden"}
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-y-3">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">Fecha</th>
                    <th className="text-left px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">Orden de compra</th>
                    <th className="text-left px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">Etiquetas agregadas</th>
                    <th className="text-left px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">Resumen</th>
                  </tr>
                </thead>

                <tbody>
                  <tr className="bg-slate-50 border border-slate-200">
                    <td className="px-4 py-4 rounded-l-3xl border-y border-l border-slate-200 align-top">
                      <label className="flex items-center gap-2 text-xs font-black text-[#244C5A] mb-2">
                        <CalendarDays size={16} /> Fecha
                      </label>
                      <input
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                      />
                    </td>

                    <td className="px-4 py-4 border-y border-slate-200 align-top">
                      <label className="flex items-center gap-2 text-xs font-black text-[#244C5A] mb-2">
                        <ClipboardList size={16} /> Orden de compra
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={ordenCompra}
                          onChange={(e) => setOrdenCompra(e.target.value.toUpperCase())}
                          placeholder="Digitar manual"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black outline-none focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                        />
                        <button
                          type="button"
                          onClick={() => openNewAlertModal()}
                          className="w-12 h-12 rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#244C5A]/20"
                          title="Agregar etiqueta en alerta"
                        >
                          <Plus size={22} />
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-4 border-y border-slate-200 align-top">
                      {alertItems.length === 0 ? (
                        <div className="rounded-2xl bg-white border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                          No hay etiquetas en alerta agregadas. Usa el botón + o da clic en una alerta de la vista rápida.
                        </div>
                      ) : (
                        <ItemsList items={alertItems} onEdit={openEditItemModal} onRemove={handleRemoveItem} />
                      )}
                    </td>

                    <td className="px-4 py-4 rounded-r-3xl border-y border-r border-slate-200 align-top">
                      <ResumenCard total={alertItems.length} label={`Alertas disponibles: ${alertasFiltradas.length}`} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">Orden de compra manual</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">Etiquetas para comprar sin alerta</h3>
                <p className="text-sm text-slate-500 mt-1">Compra directa desde ETIQUETAS / CLIENTES con fecha, orden manual, productos agregados y resumen.</p>
              </div>

              <button
                type="button"
                onClick={() => handleSaveCompra("manual")}
                disabled={saving || manualItems.length === 0}
                className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-60 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {saving ? "Guardando..." : "Guardar orden"}
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-y-3">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">Fecha</th>
                    <th className="text-left px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">Orden de compra</th>
                    <th className="text-left px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">Etiquetas agregadas</th>
                    <th className="text-left px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">Resumen</th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td className="px-4 py-4 rounded-l-3xl border-y border-l border-slate-200 align-top">
                      <label className="flex items-center gap-2 text-xs font-black text-[#244C5A] mb-2">
                        <CalendarDays size={16} /> Fecha
                      </label>
                      <input
                        type="date"
                        value={manualFecha}
                        onChange={(e) => setManualFecha(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                      />
                    </td>

                    <td className="px-4 py-4 border-y border-slate-200 align-top">
                      <label className="flex items-center gap-2 text-xs font-black text-[#244C5A] mb-2">
                        <ClipboardList size={16} /> Orden de compra
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={ordenCompra}
                          onChange={(e) => setOrdenCompra(e.target.value.toUpperCase())}
                          placeholder="Digitar manual"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black outline-none focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                        />
                        <button
                          type="button"
                          onClick={openManualModal}
                          className="w-12 h-12 rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#244C5A]/20"
                          title="Agregar etiqueta sin alerta"
                        >
                          <Plus size={22} />
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-4 border-y border-slate-200 align-top">
                      {manualItems.length === 0 ? (
                        <div className="rounded-2xl bg-white border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                          No hay etiquetas sin alerta agregadas. Usa el botón + para seleccionar cliente, producto y lado.
                        </div>
                      ) : (
                        <ItemsList items={manualItems} onEdit={openEditItemModal} onRemove={handleRemoveItem} />
                      )}
                    </td>

                    <td className="px-4 py-4 rounded-r-3xl border-y border-r border-slate-200 align-top">
                      <ResumenCard total={manualItems.length} label={`Productos cargados: ${productos.length}`} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">Vista rápida</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">Alertas de etiquetas disponibles</h3>
              </div>

              <div className="relative w-full lg:w-[420px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar cliente, código, producto o lado..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                />
              </div>
            </div>

            {loadingEtiquetas ? (
              <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
                <Loader2 className="animate-spin" size={22} />
                Cargando etiquetas...
              </div>
            ) : alertasFiltradas.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="mx-auto text-green-600" size={46} />
                <h3 className="font-black text-slate-900 mt-3">No hay etiquetas en alerta</h3>
                <p className="text-sm text-slate-500 mt-1">Cuando el saldo sea negativo, cero o menor/igual a 10 aparecerá aquí.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Cliente</th>
                      <th className="text-left px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Código</th>
                      <th className="text-left px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Producto</th>
                      <th className="text-center px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Lado</th>
                      <th className="text-center px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Saldo</th>
                      <th className="text-center px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertasPaginadas.map((alerta) => (
                      <tr
                        key={alerta.id}
                        onClick={() => openNewAlertModal(alerta.id)}
                        className="border-b border-slate-100 hover:bg-[#244C5A]/5 cursor-pointer transition"
                        title="Agregar esta etiqueta a la orden"
                      >
                        <td className="px-4 py-2 text-xs text-slate-500 max-w-[220px] truncate">{alerta.codigoCliente} · {alerta.cliente}</td>
                        <td className="px-4 py-2 text-xs font-black text-[#244C5A] whitespace-nowrap">{alerta.codigoProducto || "—"}</td>
                        <td className="px-4 py-2 text-xs font-semibold text-slate-800 max-w-[340px] truncate">{alerta.producto || "Sin producto"}</td>
                        <td className="px-4 py-2 text-center text-xs font-black text-slate-800 uppercase">{alerta.lado}</td>
                        <td className="px-4 py-2 text-center text-xs font-black text-slate-800">{formatNumber(alerta.stockActual)}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${getEstadoClass(alerta.stockActual)}`}>
                            {getEstadoLabel(alerta.stockActual)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {quickTotalPages > 1 && (
                  <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs font-bold text-slate-500">
                      Mostrando {(quickPage - 1) * quickPerPage + 1}-{Math.min(quickPage * quickPerPage, alertasFiltradas.length)} de {alertasFiltradas.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={quickPage <= 1}
                        onClick={() => setQuickPage((current) => Math.max(1, current - 1))}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#244C5A] hover:text-[#244C5A] transition"
                      >
                        Anterior
                      </button>
                      <span className="text-xs font-black text-slate-500">{quickPage}/{quickTotalPages}</span>
                      <button
                        type="button"
                        disabled={quickPage >= quickTotalPages}
                        onClick={() => setQuickPage((current) => Math.min(quickTotalPages, current + 1))}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#244C5A] hover:text-[#244C5A] transition"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </section>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">
                  {editingItemIndex !== null ? "Editar etiqueta" : "Agregar etiqueta"}
                </p>
                <h3 className="text-2xl font-black text-slate-900">
                  {modalMode === "alerta" ? "Etiqueta en alerta" : "Etiqueta sin alerta"}
                </h3>
              </div>

              <button type="button" onClick={resetModal} className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center" aria-label="Cerrar">
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="rounded-3xl bg-[#244C5A]/5 border border-[#244C5A]/10 p-4 flex items-start gap-3">
                <AlertTriangle className="text-[#244C5A] shrink-0 mt-0.5" size={22} />
                <div>
                  <p className="font-black text-slate-900">Selecciona la etiqueta a comprar</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {modalMode === "alerta"
                      ? "Solo se listan etiquetas con saldo negativo, en cero o menor/igual a 10."
                      : "Selecciona cliente, producto y lado desde ETIQUETAS / CLIENTES."}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-orange-100 bg-orange-50 px-5 py-4">
                <p className="text-xs font-black uppercase tracking-wide text-orange-700">Saldo actual</p>
                <p className="text-3xl font-black text-orange-800 mt-1">
                  {modalMode === "alerta" ? (selectedAlert ? formatNumber(selectedAlert.stockActual) : "—") : selectedProduct ? formatNumber(stockModal) : "—"}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    {modalMode === "alerta" ? "Buscar alerta" : "Buscar etiqueta"}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cliente, código o producto..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>
                </div>

                <div className="lg:col-span-2">
                  {modalMode === "alerta" ? (
                    <>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Etiqueta en alerta</label>
                      <select
                        value={selectedAlertId}
                        onChange={(e) => setSelectedAlertId(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                      >
                        <option value="">{alertasFiltradas.length === 0 ? "No hay alertas disponibles" : "Seleccione etiqueta"}</option>
                        {alertasFiltradas.map((alerta) => (
                          <option key={alerta.id} value={alerta.id}>
                            {alerta.codigoCliente} / {alerta.codigoProducto} - {alerta.producto} / {alerta.lado.toUpperCase()} / saldo {alerta.stockActual}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Cliente</label>
                        <select
                          value={selectedClienteCode}
                          onChange={(e) => {
                            setSelectedClienteCode(e.target.value);
                            setSelectedProductId("");
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                        >
                          <option value="">{clientesOptions.length === 0 ? "No hay clientes" : "Seleccione cliente"}</option>
                          {clientesOptions.map((cliente) => (
                            <option key={cliente.codigoCliente} value={cliente.codigoCliente}>
                              {cliente.codigoCliente} - {cliente.cliente} ({cliente.totalProductos})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Producto</label>
                        <select
                          value={selectedProductId}
                          disabled={!selectedClienteCode}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          <option value="">{!selectedClienteCode ? "Primero selecciona cliente" : productosCliente.length === 0 ? "Cliente sin productos" : "Seleccione producto"}</option>
                          {productosCliente.map((producto) => (
                            <option key={producto.id} value={producto.id}>
                              {producto.codigoProducto} - {producto.producto}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Lado</label>
                        <select
                          value={selectedLado}
                          onChange={(e) => setSelectedLado(e.target.value as "frente" | "dorso")}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                        >
                          <option value="frente">Frente</option>
                          <option value="dorso">Dorso</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <ReadOnlyField label="Cliente" value={modalMode === "alerta" ? selectedAlert ? `${selectedAlert.codigoCliente} - ${selectedAlert.cliente}` : "" : selectedProduct ? `${selectedProduct.codigoCliente} - ${selectedProduct.cliente}` : ""} />
                <ReadOnlyField label="Código producto" value={modalMode === "alerta" ? selectedAlert?.codigoProducto || "" : selectedProduct?.codigoProducto || ""} />
                <ReadOnlyField label="Producto" value={modalMode === "alerta" ? selectedAlert?.producto || "" : selectedProduct?.producto || ""} />
                <ReadOnlyField label="Lado" value={(modalMode === "alerta" ? selectedAlert?.lado || "" : selectedLado).toUpperCase()} />
                <ReadOnlyField label="Tipo etiqueta" value={modalMode === "alerta" ? selectedAlert?.tipoEtiqueta || "" : selectedProduct?.tipoEtiqueta || ""} />
                <ReadOnlyField label="Material etiqueta" value={modalMode === "alerta" ? selectedAlert?.materialEtiqueta || "" : selectedProduct?.materialEtiqueta || ""} />

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Cantidad a comprar</label>
                  <input
                    type="number"
                    min="0"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="Ej: 500"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <ReadOnlyField label="Total" value={cantidad ? formatNumber(cantidad) : ""} placeholder="Cantidad a comprar" />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetModal}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20"
                >
                  <PackagePlus size={19} />
                  {editingItemIndex !== null ? "Actualizar etiqueta" : "Agregar a la orden"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ItemsList({
  items,
  onEdit,
  onRemove,
}: {
  items: Array<{ item: CompraEtiquetaItem; index: number }>;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map(({ item, index }) => (
        <div
          key={`${item.origen}-${item.codigoCliente}-${item.codigoProducto}-${item.lado}-${index}`}
          className="rounded-2xl bg-white border border-slate-200 px-4 py-3 flex items-start justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="font-black text-sm text-slate-900 truncate">
              {item.codigoProducto} · {item.producto}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {item.codigoCliente} · {item.cliente} · Lado: {item.lado.toUpperCase()} · Cantidad: {formatNumber(item.totalComprar)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black">
              <span className="rounded-full bg-[#244C5A]/10 text-[#244C5A] px-2 py-1">
                {item.origen === "alerta" ? "Alerta" : "Sin alerta"}
              </span>
              <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-1">Saldo: {formatNumber(item.stockActual)}</span>
              {item.tipoEtiqueta && <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-1">{item.tipoEtiqueta}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(index)}
              className="rounded-xl border border-[#244C5A]/30 text-[#244C5A] hover:bg-[#244C5A]/5 px-3 py-2 text-xs font-black"
              title="Editar"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="rounded-xl border border-red-200 text-red-600 hover:bg-red-50 p-2"
              title="Quitar"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResumenCard({ total, label }: { total: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Total ítems</p>
      <p className="text-4xl font-black text-[#244C5A] mt-1">{total}</p>
      <p className="text-xs text-slate-500 mt-2">{label}</p>
    </div>
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
      <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
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
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.title}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm text-white/75 hover:bg-white/10 hover:text-white transition"
                          >
                            <ItemIcon size={18} />
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
    </>
  );
}
