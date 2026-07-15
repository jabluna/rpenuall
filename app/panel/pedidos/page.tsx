"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
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
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
  Search,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Tags,
  Trash2,
  Truck,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { get, onValue, push, ref, set, update } from "firebase/database";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
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

type ProductoOption = {
  codigo: string;
  nombre: string;
  detalleProducto?: Record<string, any>;
};

type InsumoDisponibilidad = {
  codigoEnvase: string;
  descripcion: string;
  tipoEmpaque: string;
  proveedor: string;
  codigoProveedor?: string;
  nombreProveedor?: string;
  codigoProductoProveedor?: string;
  productoProveedor?: string;
  movimientoKey?: string;
  stockReal: number;
  stockReservadoActual: number;
  stockReservado: number;
  stockDisponible: number;
  requerido: number;
  faltante: number;
  encontrado: boolean;
};

type ClienteOption = {
  codigo_cliente: string;
  cliente: string;
  productos: ProductoOption[];
};

type PedidoItem = {
  codigo: string;
  producto: string;
  cantidad: string;
  consecutivo: string;
  procesos: Record<string, EstadoProceso>;
  estadosMeta: Record<string, EstadoMeta>;
  historialEstados: Record<string, EstadoMeta[]>;
  responsables?: Record<string, string>;
};

type PedidoBaseRow = {
  cliente: string;
  consecutivo: string;
  pedidoBase: string;
  observaciones: string;
};

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

function cleanKey(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[.#$/[\]]/g, "-");
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(parsed);
}

function padDigits(value: unknown, length = 4) {
  const clean = String(value || "").replace(/\D/g, "");
  return (clean || "0").padStart(length, "0").slice(-length);
}

function getProductConsecutivoFromCodigo(codigoProducto?: unknown) {
  const clean = String(codigoProducto || "").trim().toUpperCase();
  const lastPart = clean.includes("-") ? clean.split("-").pop() || clean : clean;
  const digits = lastPart.replace(/\D/g, "");
  const current = Number(digits || "0");
  return Number.isFinite(current) ? current : 0;
}

function getNextProductConsecutivoFromProductos(productos?: ProductoOption[], offset = 0) {
  const maxConsecutivo = Math.max(
    0,
    ...((productos || []).map((producto) => getProductConsecutivoFromCodigo(producto.codigo))),
  );

  return String(maxConsecutivo + 1 + offset);
}

function buildOrdenProduccionNumber(pedidoCliente: unknown, consecutivoProducto: unknown, fechaOrden?: string) {
  const rawFecha = String(fechaOrden || "").trim();
  const fechaSafe = /^\d{4}-\d{2}-\d{2}$/.test(rawFecha) ? rawFecha : new Date().toISOString().slice(0, 10);
  const match = fechaSafe.match(/^(\d{4})-(\d{2})-\d{2}$/);
  const mm = match?.[2] || String(new Date().getMonth() + 1).padStart(2, "0");
  const pedido = padDigits(pedidoCliente, 4);
  const consecutivo = padDigits(consecutivoProducto, 4);

  return `OP${mm}${pedido}${consecutivo}`;
}

function getOrdenBaseFromPedidoKey(consecutivoKey: string, info: any) {
  const storedBase = Number(String(info?.ORDEN_BASE || info?.ordenBase || "").replace(/\D/g, ""));
  if (Number.isFinite(storedBase) && storedBase > 0) return storedBase;

  const clean = String(consecutivoKey || "").trim().toUpperCase();
  if (clean.startsWith("OP")) {
    const digits = clean.replace(/\D/g, "");
    // Formato nuevo: OP + MM + PEDIDO(4) + CONSECUTIVO_PRODUCTO(4). Ej: OP0701240020.
    if (digits.length >= 10) {
      const candidateNuevo = Number(digits.slice(2, 6));
      if (Number.isFinite(candidateNuevo) && candidateNuevo > 0) return candidateNuevo;
    }

    // Compatibilidad con formato anterior: OP + MM + AA + pedido + consecutivo interno.
    const candidateAnterior = Number(digits.slice(4, -3));
    return Number.isFinite(candidateAnterior) && candidateAnterior > 0 ? candidateAnterior : 0;
  }

  const numeric = Number(clean.replace(/\D/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeCompare(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function getMovementNumericId(id: string) {
  const value = Number(String(id || "").replace(/\D/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function parseMovementDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return 0;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00`).getTime();
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/").map(Number);
    return new Date(year, month - 1, day).getTime();
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLatestMovementEntry(productNode: any) {
  const movimientos = productNode?.MOVIMIENTOS || {};
  const entries = Object.entries(movimientos) as Array<[string, any]>;

  if (entries.length === 0) return null;

  return entries
    .map(([key, movement]) => {
      const fechaOrder =
        typeof movement?.ORDEN_FECHA === "number" && movement.ORDEN_FECHA > 0
          ? movement.ORDEN_FECHA
          : parseMovementDate(movement?.FECHA);

      const createdAt =
        typeof movement?.CREATED_AT === "number" && movement.CREATED_AT > 0
          ? movement.CREATED_AT
          : getMovementNumericId(key);

      return { key, movement: movement || {}, fechaOrder, createdAt, numericId: getMovementNumericId(key) };
    })
    .sort((a, b) => {
      if (b.fechaOrder !== a.fechaOrder) return b.fechaOrder - a.fechaOrder;
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      return b.numericId - a.numericId;
    })[0];
}

function getProviderProductInventory(productNode: any) {
  const datosProducto = productNode?.DATOS_PRODUCTO || {};
  const latestMovement = getLatestMovementEntry(productNode);
  const latestData = latestMovement?.movement || {};
  const stockReal = latestMovement ? toNumber(latestData.SALDO) : toNumber(datosProducto.STOCK);
  const stockReservadoActual = latestMovement
    ? toNumber(latestData.STOCK_RESERVADO)
    : toNumber(datosProducto.STOCK_RESERVADO);

  return {
    datosProducto,
    latestMovementKey: latestMovement?.key || "",
    stockReal,
    stockReservadoActual,
  };
}

function getProductDetalleEntries(producto?: ProductoOption | null) {
  if (!producto?.detalleProducto || typeof producto.detalleProducto !== "object") return [];

  return Object.entries(producto.detalleProducto).map(([detalleKey, detalle]: [string, any]) => ({
    detalleKey,
    codigoEnvase: String(detalle?.codigo_envase || detalle?.CODIGO_ENVASE || detalleKey || ""),
    descripcion: String(detalle?.descripcion || detalle?.DESCRIPCION || ""),
    tipoEmpaque: String(detalle?.tipo_de_empaque || detalle?.TIPO_DE_EMPAQUE || ""),
    proveedor: String(detalle?.proveedor || detalle?.PROVEEDOR || ""),
  }));
}

function normalizarItem(item: Partial<PedidoItem>): PedidoItem {
  return {
    codigo: item.codigo || "",
    producto: item.producto || "",
    cantidad: item.cantidad || "",
    consecutivo: item.consecutivo || "",
    procesos: {
      ...crearProcesosIniciales(),
      ...(item.procesos || {}),
    },
    estadosMeta: item.estadosMeta || {},
    historialEstados: item.historialEstados || {},
    responsables: item.responsables || {},
  };
}


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
      { title: "Generar orden de muestra", icon: PackageSearch, href: "/panel/muestra" },
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
      { title: "Crear órdenes de compra", icon: Plus, href: "/panel/compras2" },
      { title: "Ver órdenes de compra", icon: Eye, href: "/panel/gestion-compras2" },
      { title: "Crear proveedor", icon: PackagePlus, href: "/panel/crear-proveedor" },
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

function AppSidebar({
  userName,
  userEmail,
  roleName,
  sidebarOpen,
  setSidebarOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
  handleLogout,
}: {
  userName: string;
  userEmail?: string | null;
  roleName?: string;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean | ((current: boolean) => boolean)) => void;
  handleLogout: () => void;
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "Comercial": true,
  });

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((current) => ({ ...current, [sectionTitle]: !current[sectionTitle] }));
    if (sidebarCollapsed) setSidebarCollapsed(false);
  };

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
                <p className="text-xs text-[#244C5A]/70 truncate mt-1">{userEmail}</p>
                <p className="text-xs text-[#244C5A]/70 truncate mt-1">Rol: {roleName || "Sin rol"}</p>
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
                        const isActive = item.href === "/panel/pedidos";

                        return (
                          <Link
                            key={item.title}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition ${
                              isActive
                                ? "bg-white text-[#244C5A] font-black"
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

export default function PedidosPage() {
  const router = useRouter();

  const { authUser, profile, loading: loadingPermissions } = useUserPermissions();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteOption | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);

  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoOption | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [productoDropdownOpen, setProductoDropdownOpen] = useState(false);

  const [ordenPedido, setOrdenPedido] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [cantidad, setCantidad] = useState("");
  const [items, setItems] = useState<PedidoItem[]>([]);

  const [pedidosBase, setPedidosBase] = useState<PedidoBaseRow[]>([]);
  const [basePedidosPage, setBasePedidosPage] = useState(1);

  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingBasePedidos, setLoadingBasePedidos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [userRole, setUserRole] = useState("Sin rol");
  const [insumosModalOpen, setInsumosModalOpen] = useState(false);
  const [loadingInsumos, setLoadingInsumos] = useState(false);
  const [insumosProducto, setInsumosProducto] = useState<ProductoOption | null>(null);
  const [insumosDisponibilidad, setInsumosDisponibilidad] = useState<InsumoDisponibilidad[]>([]);

  const userName = useMemo(() => {
    return profile?.nombre || authUser?.displayName || authUser?.email?.split("@")[0] || "Usuario";
  }, [profile, authUser]);

  const pedidoClienteActual = useMemo(() => padDigits(ordenPedido, 4), [ordenPedido]);

  const consecutivoProductoActual = useMemo(() => {
    if (clienteSeleccionado?.productos?.length) {
      return getNextProductConsecutivoFromProductos(clienteSeleccionado.productos, items.length);
    }

    if (items.length > 0) return items[items.length - 1]?.consecutivo || "";
    return "";
  }, [clienteSeleccionado, items.length, items]);

  const ordenProduccionActual = useMemo(() => {
    if (!ordenPedido || !consecutivoProductoActual) return "";
    return buildOrdenProduccionNumber(ordenPedido, consecutivoProductoActual, fecha);
  }, [ordenPedido, consecutivoProductoActual, fecha]);

  useEffect(() => {
    const cargarRolUsuario = async () => {
      if (!authUser?.uid && !authUser?.email) return;

      const obtenerRolDesdeData = async (data: any) => {
        if (!data) return "";
        if (data.rolNombre) return String(data.rolNombre);
        if (data.rol) return String(data.rol);

        if (data.rolId) {
          try {
            const rolSnap = await getDoc(doc(db, "roles", String(data.rolId)));
            if (rolSnap.exists()) {
              const rolData = rolSnap.data();
              if (rolData?.nombre) return String(rolData.nombre);
            }
          } catch {
            return String(data.rolId);
          }
          return String(data.rolId);
        }

        if (Array.isArray(data.roles) && data.roles.length > 0) return String(data.roles[0]);
        return "";
      };

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
          const q = query(collection(db, "usuarios"), where("email", "==", authUser.email), limit(1));
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
        setUserRole(profileRol || "Sin rol");
      } catch {
        setUserRole("Sin rol");
      }
    };

    cargarRolUsuario();
  }, [authUser?.uid, authUser?.email, profile]);

  useEffect(() => {
    if (!loadingPermissions && !authUser) router.replace("/");
  }, [loadingPermissions, authUser, router]);

  useEffect(() => {
    cargarClientes();

    const ordenesRef = ref(dbRealtime, "ORDENES_PEDIDO");
    const unsubscribe = onValue(
      ordenesRef,
      (snapshot) => {
        procesarOrdenesParaConsecutivos(snapshot.exists() ? snapshot.val() || {} : {});
      },
      (err) => {
        setError(`No fue posible escuchar cambios de órdenes. ${err?.message || ""}`);
        setLoadingBasePedidos(false);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarClientes = async () => {
    setLoadingClientes(true);

    try {
      const snap = await get(ref(dbRealtime, "CLIENTES"));
      if (!snap.exists()) {
        setClientes([]);
        return;
      }

      const data = snap.val();
      const lista: ClienteOption[] = [];
      const clientesAgregados = new Set<string>();

      const addProductFromNode = (
        productos: ProductoOption[],
        codigoProducto: string,
        productNode: any,
        productNameFallback = "",
      ) => {
        const datosProducto =
          productNode?.DATOS_PRODUCTO ||
          productNode?.datosProducto ||
          productNode?.datos_producto ||
          productNode ||
          {};

        const codigo = cleanKey(
          datosProducto.codigo_producto ||
            datosProducto.codigoProducto ||
            datosProducto.codigo ||
            datosProducto.CODIGO ||
            codigoProducto,
        );

        if (!codigo) return;

        const nombre = String(
          datosProducto.producto ||
            datosProducto.nombre ||
            datosProducto.NOMBRE ||
            datosProducto.descripcion ||
            datosProducto.DESCRIPCION ||
            productNameFallback ||
            codigo,
        );

        productos.push({
          codigo,
          nombre,
          detalleProducto:
            productNode?.DETALLE_PRODUCTO ||
            productNode?.detalleProducto ||
            productNode?.detalles ||
            {},
        });
      };

      const readProducts = (clienteData: any) => {
        const productos: ProductoOption[] = [];
        const productosNode = clienteData?.PRODUCTOS || clienteData?.productos || {};

        Object.entries(productosNode || {}).forEach(([codigoProducto, productoObj]: any) => {
          if (
            productoObj?.DATOS_PRODUCTO ||
            productoObj?.datosProducto ||
            productoObj?.datos_producto ||
            productoObj?.producto ||
            productoObj?.nombre ||
            productoObj?.descripcion ||
            productoObj?.codigo_producto ||
            productoObj?.codigoProducto ||
            productoObj?.codigo
          ) {
            addProductFromNode(productos, String(codigoProducto), productoObj);
            return;
          }

          Object.entries(productoObj || {}).forEach(([nombreProducto, productoData]: any) => {
            addProductFromNode(productos, String(codigoProducto), productoData, String(nombreProducto));
          });
        });

        return productos.sort((a, b) => getProductConsecutivoFromCodigo(a.codigo) - getProductConsecutivoFromCodigo(b.codigo));
      };

      const tryAddClient = (empresaKey: string, nombreFallback: string, codigoFallback: string, clienteData: any) => {
        if (!clienteData || typeof clienteData !== "object") return false;

        const datos = clienteData?.DATOS || clienteData?.datos || clienteData;
        const hasClientData =
          !!clienteData?.DATOS ||
          !!clienteData?.datos ||
          !!clienteData?.PRODUCTOS ||
          !!clienteData?.productos ||
          !!datos.codigo_cliente ||
          !!datos.codigoCliente ||
          !!datos.cliente ||
          !!datos.nombre;

        if (!hasClientData) return false;

        const codigoCliente = cleanKey(
          datos.codigo_cliente || datos.codigoCliente || datos.codigo || codigoFallback || empresaKey,
        );
        const nombreCliente = String(datos.cliente || datos.nombre || nombreFallback || codigoCliente).trim();

        if (!codigoCliente || !nombreCliente) return false;

        const uniqueKey = `${empresaKey}/${codigoCliente}/${nombreCliente}`;
        if (clientesAgregados.has(uniqueKey)) return true;
        clientesAgregados.add(uniqueKey);

        lista.push({
          codigo_cliente: codigoCliente,
          cliente: nombreCliente,
          productos: readProducts(clienteData),
        });

        return true;
      };

      Object.entries(data || {}).forEach(([empresaKey, empresaNode]: any) => {
        if (tryAddClient(String(empresaKey), String(empresaKey), String(empresaKey), empresaNode)) return;

        Object.entries(empresaNode || {}).forEach(([nombreCliente, clienteOrCodes]: any) => {
          if (tryAddClient(String(empresaKey), String(nombreCliente), String(nombreCliente), clienteOrCodes)) return;

          Object.entries(clienteOrCodes || {}).forEach(([codigoCliente, clienteData]: any) => {
            tryAddClient(String(empresaKey), String(nombreCliente), String(codigoCliente), clienteData);
          });
        });
      });

      lista.sort((a, b) => a.cliente.localeCompare(b.cliente));
      setClientes(lista);
    } catch (err: any) {
      setError(`No fue posible cargar clientes. ${err?.message || ""}`);
    } finally {
      setLoadingClientes(false);
    }
  };

  const procesarOrdenesParaConsecutivos = (ordenesData: Record<string, any>) => {
    const rows: PedidoBaseRow[] = [];
    let maxOrden = 0;

    Object.entries(ordenesData || {}).forEach(([ordenId, info]: any) => {
      const ordenPedido = String(info?.ordenPedido || info?.ORDEN_PRODUCCION || ordenId || "");
      const pedidoBaseNumber = getOrdenBaseFromPedidoKey(ordenPedido, {
        ORDEN_BASE: info?.ordenBase || info?.ORDEN_BASE,
        ordenBase: info?.ordenBase,
      });

      if (!Number.isFinite(pedidoBaseNumber) || pedidoBaseNumber <= 0) return;
      if (pedidoBaseNumber > maxOrden) maxOrden = pedidoBaseNumber;

      const codigoCliente = String(
        info?.cliente?.codigo_cliente ||
          info?.cliente?.codigoCliente ||
          info?.CODIGO_CLIENTE ||
          "",
      ).trim();

      const nombreCliente = String(
        info?.cliente?.nombre ||
          info?.cliente?.cliente ||
          info?.CLIENTE ||
          "",
      ).trim();

      rows.push({
        cliente: codigoCliente && nombreCliente
          ? `${codigoCliente} - ${nombreCliente}`
          : codigoCliente || nombreCliente || "Sin cliente",
        consecutivo: ordenPedido,
        pedidoBase: String(pedidoBaseNumber).padStart(4, "0"),
        observaciones: String(
          info?.observaciones ||
            info?.OBSERVACIONES ||
            info?.estadoGeneral ||
            "Orden activa",
        ),
      });
    });

    rows.sort(
      (a, b) =>
        Number(b.pedidoBase || getOrdenBaseFromPedidoKey(b.consecutivo, {})) -
        Number(a.pedidoBase || getOrdenBaseFromPedidoKey(a.consecutivo, {})),
    );

    setPedidosBase(rows);
    setOrdenPedido(String(maxOrden > 0 ? maxOrden + 1 : 1));
    setLoadingBasePedidos(false);
  };

  const cargarPedidosBaseYConsecutivos = async () => {
    setLoadingBasePedidos(true);

    try {
      const ordenesSnap = await get(ref(dbRealtime, "ORDENES_PEDIDO"));
      procesarOrdenesParaConsecutivos(ordenesSnap.exists() ? ordenesSnap.val() || {} : {});
    } catch (err: any) {
      setError(`No fue posible cargar consecutivos. ${err?.message || ""}`);
      setLoadingBasePedidos(false);
    }
  };

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (cliente) => cliente.cliente.toLowerCase().includes(q) || cliente.codigo_cliente.toLowerCase().includes(q)
    );
  }, [clientes, busquedaCliente]);

  const productosFiltrados = useMemo(() => {
    if (!clienteSeleccionado) return [];
    const q = busquedaProducto.trim().toLowerCase();
    if (!q) return clienteSeleccionado.productos.slice(0, 100);
    return clienteSeleccionado.productos
      .filter((producto) => producto.codigo.toLowerCase().includes(q) || producto.nombre.toLowerCase().includes(q))
      .slice(0, 100);
  }, [clienteSeleccionado, busquedaProducto]);

  const basePedidosTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(pedidosBase.length / 10));
  }, [pedidosBase.length]);

  const pedidosBasePaginados = useMemo(() => {
    const start = (basePedidosPage - 1) * 10;
    return pedidosBase.slice(start, start + 10);
  }, [pedidosBase, basePedidosPage]);

  useEffect(() => {
    setBasePedidosPage(1);
  }, [pedidosBase.length]);

  const getNextPedidoGlobal = () => {
    const maxPedido = pedidosBase.reduce((max, row) => {
      const value = Number(row.pedidoBase || getOrdenBaseFromPedidoKey(row.consecutivo, { ORDEN_BASE: undefined }));
      return value > max ? value : max;
    }, 0);

    return String(maxPedido > 0 ? maxPedido + 1 : Number(ordenPedido || 1));
  };

  const limpiarFormulario = (keepOrder = false) => {
    setFecha(new Date().toISOString().split("T")[0]);
    setClienteSeleccionado(null);
    setBusquedaCliente("");
    setProductoSeleccionado(null);
    setBusquedaProducto("");
    setCantidad("");
    setItems([]);
    setClienteDropdownOpen(false);
    setProductoDropdownOpen(false);
    if (!keepOrder) cargarPedidosBaseYConsecutivos();
  };

  const seleccionarCliente = (cliente: ClienteOption) => {
    setClienteSeleccionado(cliente);
    setBusquedaCliente(`${cliente.codigo_cliente} - ${cliente.cliente}`);
    setClienteDropdownOpen(false);
    setProductoSeleccionado(null);
    setBusquedaProducto("");
    setProductoDropdownOpen(false);
    setCantidad("");
    setItems([]);
    setOrdenPedido((current) => current || getNextPedidoGlobal());
    setError("");
    setMessage("");
  };

  async function cargarDisponibilidadInsumos(producto: ProductoOption, cantidadBase?: string) {
    const requerido = toNumber(cantidadBase || cantidad);

    if (requerido <= 0) {
      setError("Digita primero la cantidad para calcular el stock reservado y la disponibilidad.");
      return;
    }

    setLoadingInsumos(true);
    setInsumosProducto(producto);
    setInsumosModalOpen(true);
    setInsumosDisponibilidad([]);

    try {
      const detalles = getProductDetalleEntries(producto);

      if (detalles.length === 0) {
        setInsumosDisponibilidad([]);
        return;
      }

      const proveedoresSnap = await get(ref(dbRealtime, "PROVEEDORES"));
      const proveedoresData = proveedoresSnap.exists() ? proveedoresSnap.val() || {} : {};

      const rows: InsumoDisponibilidad[] = detalles.map((detalle) => {
        let encontrado: any = null;
        const codigoDetalle = normalizeCompare(detalle.codigoEnvase);

        // IMPORTANTE:
        // El proveedor NO se toma del detalle del cliente.
        // El detalle del cliente solo indica qué insumo/código de envase se requiere.
        // El proveedor definitivo se obtiene buscando ese código dentro de PROVEEDORES.
        for (const [codigoProveedor, proveedoresPorCodigo] of Object.entries(proveedoresData) as any[]) {
          if (encontrado) break;

          for (const [nombreProveedor, proveedorNode] of Object.entries(proveedoresPorCodigo || {}) as any[]) {
            if (encontrado) break;

            const proveedorNombreDato = proveedorNode?.DATOS?.PROVEEDOR || nombreProveedor;
            const productos = proveedorNode?.PRODUCTOS || {};

            for (const [codigoProductoProveedor, productoNode] of Object.entries(productos) as any[]) {
              const datosProducto = productoNode?.DATOS_PRODUCTO || {};
              const codigoProveedorProducto = datosProducto.CODIGO || codigoProductoProveedor;
              const codigoMatch = normalizeCompare(codigoProveedorProducto) === codigoDetalle;

              if (!codigoMatch) continue;

              const inventory = getProviderProductInventory(productoNode);

              encontrado = {
                codigoProveedor,
                nombreProveedor: proveedorNombreDato,
                codigoProductoProveedor,
                datosProducto: inventory.datosProducto,
                movimientoKey: inventory.latestMovementKey,
                stockReal: inventory.stockReal,
                stockReservadoActual: inventory.stockReservadoActual,
              };

              break;
            }
          }
        }

        const stockReal = encontrado ? toNumber(encontrado.stockReal) : 0;
        const stockReservadoActual = encontrado ? toNumber(encontrado.stockReservadoActual) : 0;
        // En este modal el reservado visible es la cantidad que se está intentando pedir.
        // El reservado existente también se descuenta para calcular la disponibilidad real antes de guardar.
        const stockReservado = requerido;
        const stockDisponible = stockReal - stockReservadoActual - stockReservado;
        const faltante = Math.max(0, stockDisponible < 0 ? Math.abs(stockDisponible) : 0);

        return {
          codigoEnvase: detalle.codigoEnvase,
          descripcion: detalle.descripcion,
          tipoEmpaque: detalle.tipoEmpaque,
          proveedor: "",
          codigoProveedor: encontrado?.codigoProveedor,
          nombreProveedor: encontrado?.nombreProveedor,
          codigoProductoProveedor: encontrado?.codigoProductoProveedor,
          productoProveedor: encontrado?.datosProducto?.PRODUCTO || "",
          movimientoKey: encontrado?.movimientoKey || "",
          stockReal,
          stockReservadoActual,
          stockReservado,
          stockDisponible,
          requerido,
          faltante,
          encontrado: !!encontrado,
        };
      });

      setInsumosDisponibilidad(rows);
    } catch (err: any) {
      setError(`No fue posible consultar los insumos. ${err?.message || ""}`);
    } finally {
      setLoadingInsumos(false);
    }
  }

  const seleccionarProducto = (producto: ProductoOption) => {
    setProductoSeleccionado(producto);
    setBusquedaProducto(`${producto.codigo} - ${producto.nombre}`);
    setProductoDropdownOpen(false);
    setInsumosDisponibilidad([]);
    setInsumosProducto(null);
  };

  const handleVerInsumos = () => {
    setError("");
    setMessage("");

    if (!productoSeleccionado) {
      setError("Selecciona primero un código o producto.");
      return;
    }

    if (!cantidad || Number(cantidad) <= 0) {
      setError("Digita primero la cantidad para calcular el stock reservado y la disponibilidad.");
      return;
    }

    cargarDisponibilidadInsumos(productoSeleccionado, cantidad);
  };

  const agregarProducto = () => {
    setError("");
    setMessage("");

    if (!clienteSeleccionado) {
      setError("Selecciona un cliente.");
      return;
    }

    if (!productoSeleccionado) {
      setError("Selecciona un código o producto.");
      return;
    }

    if (!cantidad || Number(cantidad) <= 0) {
      setError("Ingresa una cantidad válida.");
      return;
    }

    const nuevoItem: PedidoItem = {
      codigo: productoSeleccionado.codigo,
      producto: productoSeleccionado.nombre,
      cantidad,
      consecutivo: padDigits(getNextProductConsecutivoFromProductos(clienteSeleccionado.productos, items.length), 4),
      procesos: crearProcesosIniciales(),
      estadosMeta: {},
      historialEstados: {},
      responsables: {},
    };

    setItems((current) => [...current, nuevoItem]);
    setProductoSeleccionado(null);
    setBusquedaProducto("");
    setProductoDropdownOpen(false);
    setCantidad("");
  };

  const eliminarItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const editarCantidadItem = (index: number, nuevaCantidad: string) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, cantidad: nuevaCantidad } : item)));
  };

  async function reservarStockEnProveedores(orderId: string, orderNumber: string, itemsValidos: PedidoItem[]) {
    const proveedoresSnap = await get(ref(dbRealtime, "PROVEEDORES"));
    if (!proveedoresSnap.exists()) return ["No existe el nodo PROVEEDORES para reservar stock."];

    const proveedoresData = proveedoresSnap.val() || {};
    const warnings: string[] = [];

    /*
      Importante:
      El snapshot de PROVEEDORES se lee una sola vez antes de recorrer los productos.
      Si una misma orden trae dos productos que usan el mismo insumo/movimiento,
      el STOCK_RESERVADO del snapshot queda "viejo" para el segundo producto.
      Por eso llevamos un acumulado local por movimientoPath durante este guardado.
      Ejemplo: reservado actual 0 + producto A 100 + producto B 50 = 150.
    */
    const reservaAcumuladaPorMovimiento: Record<string, number> = {};

    for (const [itemIndex, item] of itemsValidos.entries()) {
      const cantidadReservar = toNumber(item.cantidad);
      const productoCliente = clienteSeleccionado?.productos.find((producto) => producto.codigo === item.codigo);
      const detalles = getProductDetalleEntries(productoCliente);

      if (detalles.length === 0) {
        warnings.push(`El producto ${item.codigo} no tiene DETALLE_PRODUCTO para reservar insumos.`);
        continue;
      }

      for (const [detalleIndex, detalle] of detalles.entries()) {
        let encontrado = false;
        const codigoDetalle = normalizeCompare(detalle.codigoEnvase);

        // Igual que en el modal: el proveedor se determina exclusivamente por el producto encontrado en PROVEEDORES,
        // usando el código de envase/insumo del detalle del cliente.
        for (const [codigoProveedor, proveedoresPorCodigo] of Object.entries(proveedoresData) as any[]) {
          if (encontrado) break;

          for (const [nombreProveedor, proveedorNode] of Object.entries(proveedoresPorCodigo || {}) as any[]) {
            if (encontrado) break;

            const proveedorNombreDato = proveedorNode?.DATOS?.PROVEEDOR || nombreProveedor;
            const productos = proveedorNode?.PRODUCTOS || {};

            for (const [codigoProductoProveedor, productoNode] of Object.entries(productos) as any[]) {
              const datosProducto = productoNode?.DATOS_PRODUCTO || {};
              const codigoReal = String(datosProducto.CODIGO || codigoProductoProveedor || "").trim();

              if (normalizeCompare(codigoReal) !== codigoDetalle) continue;

              const productPath = `PROVEEDORES/${codigoProveedor}/${nombreProveedor}/PRODUCTOS/${codigoProductoProveedor}`;
              const inventory = getProviderProductInventory(productoNode);

              if (!inventory.latestMovementKey) {
                warnings.push(`El insumo ${detalle.codigoEnvase} fue encontrado en PROVEEDORES, pero no tiene movimientos en la tercera capa para guardar STOCK_RESERVADO.`);
                encontrado = true;
                break;
              }

              const stockDisponible = toNumber(inventory.stockReal);
              const reservaKey = cleanKey(`${orderNumber}-${item.codigo}-${detalle.codigoEnvase}-${itemIndex + 1}-${detalleIndex + 1}`);
              const movimientoPath = `${productPath}/MOVIMIENTOS/${inventory.latestMovementKey}`;
              const stockReservadoActual =
                reservaAcumuladaPorMovimiento[movimientoPath] ??
                toNumber(inventory.stockReservadoActual);
              const nuevoReservado = stockReservadoActual + cantidadReservar;
              const stockTeorico = stockDisponible - nuevoReservado;

              reservaAcumuladaPorMovimiento[movimientoPath] = nuevoReservado;

              await update(ref(dbRealtime, productPath), {
                [`MOVIMIENTOS/${inventory.latestMovementKey}/STOCK_RESERVADO`]: nuevoReservado,
                [`MOVIMIENTOS/${inventory.latestMovementKey}/STOCK_DISPONIBLE`]: stockDisponible,
                [`MOVIMIENTOS/${inventory.latestMovementKey}/STOCK_TEORICO`]: stockTeorico,
                [`RESERVADO_PEDIDOS/${reservaKey}`]: {
                  ordenPedidoId: orderId,
                  ordenPedido: orderNumber,
                  clienteCodigo: clienteSeleccionado?.codigo_cliente || "",
                  clienteNombre: clienteSeleccionado?.cliente || "",
                  productoPedidoCodigo: item.codigo,
                  productoPedido: item.producto,
                  codigoInsumo: detalle.codigoEnvase,
                  descripcionInsumo: detalle.descripcion,
                  tipoEmpaque: detalle.tipoEmpaque,
                  proveedor: proveedorNombreDato,
                  cantidad: cantidadReservar,
                  consecutivo: item.consecutivo,
                  movimientoKey: inventory.latestMovementKey,
                  movimientoPath,
                  stockReservadoAnterior: stockReservadoActual,
                  stockReservadoNuevo: nuevoReservado,
                  stockDisponible,
                  stockTeorico,
                  estado: "reservado",
                  createdAt: new Date().toISOString(),
                  createdByUid: authUser?.uid || null,
                  createdByEmail: authUser?.email || null,
                },
              });

              encontrado = true;
              break;
            }
          }
        }

        if (!encontrado) {
          warnings.push(`No se encontró el insumo ${detalle.codigoEnvase} (${detalle.descripcion || "sin descripción"}) del producto ${item.codigo} en PROVEEDORES.`);
        }
      }
    }

    return warnings;
  }

  const guardarPedido = async () => {
    setError("");
    setMessage("");

    if (!ordenPedido.trim()) {
      setError("No fue posible calcular el # Pedido Cliente.");
      return;
    }

    if (!clienteSeleccionado) {
      setError("Selecciona un cliente.");
      return;
    }

    if (items.length === 0) {
      setError("Agrega al menos un producto a la orden.");
      return;
    }

    const itemsValidos = items.filter((item) => item.codigo && item.producto && Number(item.cantidad) > 0);

    if (itemsValidos.length === 0) {
      setError("La orden debe tener al menos un producto con cantidad válida.");
      return;
    }

    setSaving(true);

    try {
      const pedidoRef = push(ref(dbRealtime, "ORDENES_PEDIDO"));
      const ultimoConsecutivoUsado = Math.max(...itemsValidos.map((item) => Number(String(item.consecutivo).replace(/\D/g, "")) || 0), 0);
      const orden = buildOrdenProduccionNumber(ordenPedido, ultimoConsecutivoUsado, fecha);
      const orderId = pedidoRef.key || cleanKey(orden);

      await set(pedidoRef, {
        ordenPedido: orden,
        ordenBase: ordenPedido.trim(),
        consecutivoInternoFinal: ultimoConsecutivoUsado,
        fecha,
        cliente: {
          codigo_cliente: clienteSeleccionado.codigo_cliente,
          nombre: clienteSeleccionado.cliente,
        },
        items: itemsValidos.map((item) => ({
          ...normalizarItem(item),
          ordenProduccion: buildOrdenProduccionNumber(ordenPedido, item.consecutivo, fecha),
        })),
        creadoPor: userName,
        creadoPorUid: authUser?.uid || null,
        creadoPorEmail: authUser?.email || null,
        creadoAt: new Date().toISOString(),
        actualizadoPor: userName,
        actualizadoPorUid: authUser?.uid || null,
        actualizadoPorEmail: authUser?.email || null,
        actualizadoAt: new Date().toISOString(),
        responsableProduccion: userName,
        responsableProduccionUid: authUser?.uid || null,
        responsableProduccionEmail: authUser?.email || null,
        responsableProduccionRol: userRole,
        estadoGeneral: "creada",
      });

      await set(ref(dbRealtime, `PEDIDOS/${cleanKey(clienteSeleccionado.codigo_cliente)}/${padDigits(ordenPedido, 4)}`), {
        CLIENTE: clienteSeleccionado.cliente,
        CODIGO_CLIENTE: clienteSeleccionado.codigo_cliente,
        OBSERVACIONES: "Orden creada desde panel de pedidos",
        ORDEN_BASE: ordenPedido.trim(),
        CONSECUTIVO_INTERNO_FINAL: ultimoConsecutivoUsado,
        ORDEN_PEDIDO_ID: orderId,
        ORDEN_PRODUCCION: orden,
        CREATED_AT: new Date().toISOString(),
      });


      await reservarStockEnProveedores(orderId, orden, itemsValidos);

      setMessage("Orden de pedido creada correctamente y stock reservado actualizado.");

      limpiarFormulario(false);
    } catch (err: any) {
      setError(`No fue posible guardar la orden. ${err?.message || ""}`);
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

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AppSidebar
        userName={userName}
        userEmail={authUser?.email}
        roleName={userRole}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        handleLogout={handleLogout}
      />

      <section className={`${sidebarWidth} pt-16 lg:pt-0 transition-all duration-300`}>
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
            <span className="font-semibold text-slate-700">Comercial</span>
            <span className="text-slate-300">/</span>
            <span className="font-black text-slate-900">Crear orden de pedido</span>
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
        <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-visible">
          <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">Nueva orden</p>
              <h2 className="text-2xl font-black mt-1">Crear orden de pedido</h2>
              <p className="text-slate-500 text-sm mt-1">
                El #Pedido es consecutivo general para cualquier cliente. El #Orden se genera con OP + mes + #Pedido de 4 dígitos + consecutivo siguiente de productos del cliente.
              </p>
            </div>

            <div className="w-full lg:w-auto">
              <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center flex items-center justify-center gap-2">
                <ClipboardList size={20} />
                #Orden {ordenProduccionActual || "—"}
              </div>
            </div>
          </div>

          {(error || message) && (
            <div className="px-5 sm:px-6 pt-5">
              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError("")}> <X size={18} /> </button>
                </div>
              )}

              {message && (
                <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700 flex items-center justify-between gap-3">
                  <span>{message}</span>
                  <button type="button" onClick={() => setMessage("")}> <X size={18} /> </button>
                </div>
              )}
            </div>
          )}

          <div className="p-5 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-8 gap-4">
              <div className="lg:col-span-2">
                <label className="text-sm font-black text-slate-700"># Pedido Cliente</label>
                <input
                  type="text"
                  value={pedidoClienteActual}
                  readOnly
                  className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 font-black text-[#244C5A] outline-none cursor-not-allowed"
                />
              </div>

              <div className="relative lg:col-span-2">
                <label className="text-sm font-black text-slate-700">Cliente</label>
                <div className="relative mt-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={busquedaCliente}
                    onFocus={() => setClienteDropdownOpen(true)}
                    onChange={(event) => {
                      setBusquedaCliente(event.target.value);
                      setClienteSeleccionado(null);
                      setClienteDropdownOpen(true);
                      setProductoSeleccionado(null);
                      setBusquedaProducto("");
                      setItems([]);
                    }}
                    placeholder={loadingClientes ? "Cargando clientes..." : "Clic para ver clientes o buscar..."}
                    className="w-full rounded-2xl border border-green-200 bg-green-50/70 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  />
                </div>

                {clienteDropdownOpen && (
                  <div className="absolute z-50 bg-white border border-slate-200 rounded-3xl shadow-xl w-full mt-2 max-h-80 overflow-auto">
                    {clientesFiltrados.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-500">No hay clientes para mostrar.</div>
                    ) : (
                      clientesFiltrados.map((cliente) => (
                        <button
                          type="button"
                          key={`${cliente.codigo_cliente}-${cliente.cliente}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => seleccionarCliente(cliente)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                        >
                          <p className="font-black text-slate-900">{cliente.codigo_cliente}</p>
                          <p className="text-sm text-slate-500">{cliente.cliente}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-black text-slate-700">Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value)}
                  className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                />
              </div>


              <div className="relative lg:col-span-2">
                <label className="text-sm font-black text-slate-700">Código y producto</label>
                <div className="relative mt-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={busquedaProducto}
                    disabled={!clienteSeleccionado}
                    onFocus={() => setProductoDropdownOpen(true)}
                    onChange={(event) => {
                      setBusquedaProducto(event.target.value);
                      setProductoSeleccionado(null);
                      setProductoDropdownOpen(true);
                    }}
                    placeholder={clienteSeleccionado ? "Clic para ver productos o buscar código..." : "Primero selecciona un cliente"}
                    className="w-full rounded-2xl border border-green-200 bg-green-50/70 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 disabled:opacity-60"
                  />
                </div>

                {productoDropdownOpen && clienteSeleccionado && (
                  <div className="absolute z-50 bg-white border border-slate-200 rounded-3xl shadow-xl w-full mt-2 max-h-96 overflow-auto">
                    {productosFiltrados.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-500">No hay productos para mostrar.</div>
                    ) : (
                      productosFiltrados.map((producto) => (
                        <button
                          type="button"
                          key={`${producto.codigo}-${producto.nombre}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => seleccionarProducto(producto)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                        >
                          <p className="font-black text-slate-900">{producto.codigo}</p>
                          <p className="text-sm text-slate-500">{producto.nombre}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-black text-slate-700">Cantidad</label>
                <input
                  type="number"
                  min="0"
                  value={cantidad}
                  onChange={(event) => {
                    setCantidad(event.target.value);
                    setInsumosDisponibilidad([]);
                  }}
                  placeholder="0"
                  className="w-full mt-1 rounded-2xl border border-green-200 bg-green-50/70 px-4 py-3 outline-none focus:bg-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  disabled={!productoSeleccionado || !cantidad || Number(cantidad) <= 0}
                  onClick={handleVerInsumos}
                  className="w-full rounded-2xl border border-[#244C5A] px-4 py-3 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  <PackageSearch size={18} />
                  Ver insumos
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={agregarProducto}
                className="rounded-2xl border border-[#244C5A] px-5 py-3 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Agregar producto
              </button>

              <button
                type="button"
                onClick={guardarPedido}
                disabled={saving}
                className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {saving ? "Guardando..." : "Guardar orden"}
              </button>
            </div>

            {items.length > 0 && (
              <div className="overflow-x-auto rounded-3xl border border-slate-200">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Código</th>
                      <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Producto</th>
                      <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Cantidad</th>
                      <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">#Orden</th>
                      <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item, index) => (
                      <tr key={`${item.codigo}-${index}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-3 font-black text-slate-900">{item.codigo}</td>
                        <td className="px-4 py-3 text-slate-600">{item.producto}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.cantidad}
                            onChange={(event) => editarCantidadItem(index, event.target.value)}
                            className="w-28 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center font-black outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-2 text-sm font-black">
                            {buildOrdenProduccionNumber(ordenPedido, item.consecutivo, fecha)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => eliminarItem(index)}
                            className="w-10 h-10 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center justify-center transition"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">Base PEDIDOS</p>
              <h2 className="text-2xl font-black mt-1">Consecutivos por cliente</h2>
              <p className="text-slate-500 text-sm mt-1">Estructura leída desde PEDIDOS / CLIENTE / #PEDIDO / OBSERVACIONES. Si existen registros antiguos con OP, se muestra aquí solo el #Pedido.</p>
            </div>

            <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center">
              {pedidosBase.length} registros
            </div>
          </div>

          {loadingBasePedidos ? (
            <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
              <Loader2 className="animate-spin" size={22} />
              Cargando PEDIDOS...
            </div>
          ) : pedidosBase.length === 0 ? (
            <div className="p-8 text-center">
              <ClipboardList className="mx-auto text-[#244C5A]" size={42} />
              <h3 className="font-black text-slate-900 mt-4">No hay registros en PEDIDOS</h3>
              <p className="text-sm text-slate-500 mt-2">La primera orden se calculará cuando exista información base.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500"># Pedido</th>
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Cliente</th>
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Observaciones</th>
                  </tr>
                </thead>

                <tbody>
                  {pedidosBasePaginados.map((row, index) => (
                    <tr key={`${row.cliente}-${row.consecutivo}-${index}`} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-[#244C5A]/10 text-[#244C5A] px-3 py-1 text-xs font-black">
                          {row.pedidoBase || padDigits(getOrdenBaseFromPedidoKey(row.consecutivo, {}), 4)}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-black text-slate-900">{row.cliente}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{row.observaciones || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {pedidosBase.length > 10 && (
                <div className="px-5 py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Mostrando {((basePedidosPage - 1) * 10) + 1} - {Math.min(basePedidosPage * 10, pedidosBase.length)} de {pedidosBase.length} registros
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={basePedidosPage === 1}
                      onClick={() => setBasePedidosPage((current) => Math.max(1, current - 1))}
                      className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <span className="rounded-2xl bg-[#244C5A]/10 px-4 py-2 text-sm font-black text-[#244C5A]">
                      Página {basePedidosPage} de {basePedidosTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={basePedidosPage === basePedidosTotalPages}
                      onClick={() => setBasePedidosPage((current) => Math.min(basePedidosTotalPages, current + 1))}
                      className="rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
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

      {insumosModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/55 flex items-center justify-center px-4 py-6">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">Disponibilidad de insumos</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">
                  {insumosProducto?.codigo || "Producto"} · {insumosProducto?.nombre || ""}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Se usa el detalle del cliente solo para conocer los insumos; el proveedor, saldo y disponibilidad se toman buscando el código de envase en PROVEEDORES / PRODUCTOS.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInsumosModalOpen(false)}
                className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0"
                aria-label="Cerrar"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-auto">
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3">
                  <p className="text-xs font-black uppercase">Cantidad pedido</p>
                  <p className="text-2xl font-black">{formatNumber(cantidad || 0)}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 text-slate-700 px-4 py-3">
                  <p className="text-xs font-black uppercase">Insumos</p>
                  <p className="text-2xl font-black">{insumosDisponibilidad.length}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 text-emerald-700 px-4 py-3">
                  <p className="text-xs font-black uppercase">Con disponibilidad</p>
                  <p className="text-2xl font-black">{insumosDisponibilidad.filter((item) => item.encontrado && item.faltante <= 0).length}</p>
                </div>
                <div className="rounded-2xl bg-red-50 text-red-700 px-4 py-3">
                  <p className="text-xs font-black uppercase">Con faltante</p>
                  <p className="text-2xl font-black">{insumosDisponibilidad.filter((item) => !item.encontrado || item.faltante > 0).length}</p>
                </div>
              </div>

              {loadingInsumos ? (
                <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
                  <Loader2 className="animate-spin" size={22} />
                  Consultando insumos...
                </div>
              ) : insumosDisponibilidad.length === 0 ? (
                <div className="p-8 text-center rounded-3xl border border-slate-200">
                  <PackageSearch className="mx-auto text-[#244C5A]" size={44} />
                  <h4 className="font-black text-slate-900 mt-4">No hay insumos para mostrar</h4>
                  <p className="text-sm text-slate-500 mt-2">Este producto no tiene DETALLE_PRODUCTO o no se pudo leer la estructura.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-3xl border border-slate-200">
                  <table className="w-full min-w-[1280px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Código envase</th>
                        <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Descripción</th>
                        <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Tipo empaque</th>
                        <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Proveedor</th>
                        <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Saldo</th>
                        <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Reservado actual</th>
                        <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Reserva orden</th>
                        <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Disponible</th>
                        <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Requerido</th>
                        <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Faltante</th>
                        <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insumosDisponibilidad.map((item, index) => (
                        <tr key={`${item.codigoEnvase}-${index}`} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                          <td className="px-4 py-3 font-black text-slate-900">{item.codigoEnvase || "—"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700 max-w-[280px]">{item.descripcion || item.productoProveedor || "—"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{item.tipoEmpaque || "—"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{item.nombreProveedor || "—"}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">{formatNumber(item.stockReal)}</td>
                          <td className="px-4 py-3 text-right font-black text-amber-700">{formatNumber(item.stockReservadoActual)}</td>
                          <td className="px-4 py-3 text-right font-black text-[#244C5A]">{formatNumber(item.stockReservado)}</td>
                          <td className={`px-4 py-3 text-right font-black ${item.stockDisponible < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatNumber(item.stockDisponible)}</td>
                          <td className="px-4 py-3 text-right font-black text-[#244C5A]">{formatNumber(item.requerido)}</td>
                          <td className={`px-4 py-3 text-right font-black ${item.faltante > 0 ? "text-red-700" : "text-emerald-700"}`}>{item.faltante > 0 ? formatNumber(item.faltante) : "0"}</td>
                          <td className="px-4 py-3">
                            {!item.encontrado ? (
                              <span className="inline-flex rounded-full bg-red-50 text-red-700 px-3 py-1 text-xs font-black">No encontrado</span>
                            ) : item.faltante > 0 ? (
                              <span className="inline-flex rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-xs font-black">Pedir a compras</span>
                            ) : (
                              <span className="inline-flex rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-black">Disponible</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <strong>Importante:</strong> el stock reservado mostrado corresponde a la cantidad de esta orden. Al guardar, ese valor se suma al STOCK_RESERVADO del movimiento vigente en la tercera capa del insumo exacto.
              </div>
            </div>
          </div>
        </div>
      )}

      </section>
    </main>
  );
}
