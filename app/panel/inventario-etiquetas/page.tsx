"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  Eye,
  FileText,
  LayoutDashboard,
  Menu,
  MoveRight,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  UserCog,
  UserPlus,
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  FileSpreadsheet,
  Home,
  ImageIcon,
  Loader2,
  LogOut,
  PackageSearch,
  Save,
  Search,
  Upload,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { get, getDatabase, push, ref as dbRef, set, update } from "firebase/database";
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth } from "@/lib/firebase";
import { useUserPermissions } from "@/lib/useUserPermissions";
import NoPermission from "@/components/NoPermission";

type StockEtiqueta = {
  frente?: number | string | null;
  dorso?: number | string | null;
};

type MovimientoEtiqueta = {
  fecha?: string | null;
  descripcion?: string | null;
  operacion?: string | null;
  ingreso?: number | string | null;
  salida?: number | string | null;
  saldo?: number | string | null;
  createdAt?: number | null;
};

type DetalleLadoEtiqueta = {
  stockInicial?: number | string | null;
  movimientos?: Record<string, MovimientoEtiqueta>;
};

type DetalleEtiqueta = {
  hojaDetalle?: string | null;
  frente?: DetalleLadoEtiqueta;
  dorso?: DetalleLadoEtiqueta;
};

type ProductoEtiquetaData = {
  codigo?: string;
  producto?: string;
  stock?: StockEtiqueta | number | string | null;
  acabado?: string;
  acabados?: string;
  tipoEtiqueta?: string;
  materialEtiqueta?: string;
  baseImpresion?: string;
  mockupProductoUrl?: string;
  mockupProductoPath?: string;
  mockupEtiquetaUrl?: string;
  mockupEtiquetaPath?: string;
  detalle?: DetalleEtiqueta;
};

type ProductoEtiquetaRow = {
  id: string;
  codigo: string;
  producto: string;
  mockupProductoUrl: string;
  mockupProductoPath: string;
  mockupEtiquetaUrl: string;
  mockupEtiquetaPath: string;
  tipoEtiqueta: string;
  materialEtiqueta: string;
  baseImpresion: string;
  acabados: string;
  stockFrente: string;
  stockDorso: string;
  detalle?: DetalleEtiqueta;
  raw: ProductoEtiquetaData;
};

type ClienteEtiquetaData = {
  codigoCliente: string;
  cliente: string;
  productos?: Record<string, ProductoEtiquetaData>;
};

type ClienteEtiquetaRow = {
  id: string;
  codigoCliente: string;
  cliente: string;
  productos: ProductoEtiquetaRow[];
  datos: ClienteEtiquetaData;
};

type NuevoMovimientoDraft = {
  fecha: string;
  operacionTipo: "COMPRA" | "OP" | "REINTEGRO" | "AJUSTE" | "";
  operacionNumero: string;
  ingreso: string;
  salida: string;
};

type ProductEditForm = {
  codigo: string;
  producto: string;
  tipoEtiqueta: string;
  materialEtiqueta: string;
  baseImpresion: string;
  acabados: string;
  mockupProductoUrl: string;
  mockupProductoPath: string;
  mockupEtiquetaUrl: string;
  mockupEtiquetaPath: string;
};

const TIPO_ETIQUETA_OPTIONS = ["Sencilla", "Termoencogible", "Doble etiqueta", "Rollo"];
const MATERIAL_ETIQUETA_OPTIONS = ["TERMOENCOGIBLE", "ADHESIVO", "PROPALCOTE", "POLIPROPILENO"];
const BASE_IMPRESION_OPTIONS = ["BLANCO", "METALIZADO"];
const ACABADOS_OPTIONS = ["MATE", "BRILLANTE", "UV PARCIAL"];

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

const emptyEditForm: ProductEditForm = {
  codigo: "",
  producto: "",
  tipoEtiqueta: "",
  materialEtiqueta: "",
  baseImpresion: "",
  acabados: "",
  mockupProductoUrl: "",
  mockupProductoPath: "",
  mockupEtiquetaUrl: "",
  mockupEtiquetaPath: "",
};

function normalizeText(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function cleanKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[.#$/[\]]/g, "-");
}

function normalizeStock(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(parsed);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getOperacionLabel(draft: NuevoMovimientoDraft) {
  const numero = draft.operacionNumero.trim();
  if (!draft.operacionTipo) return "";
  return numero ? `${draft.operacionTipo}-${numero}` : draft.operacionTipo;
}

function getMovimientos(detalle?: DetalleLadoEtiqueta) {
  if (!detalle?.movimientos || typeof detalle.movimientos !== "object") return [];

  return Object.entries(detalle.movimientos)
    .map(([id, movimiento]) => ({
      id,
      fecha: normalizeText(movimiento?.fecha),
      descripcion: normalizeText(movimiento?.descripcion || movimiento?.operacion),
      ingreso: movimiento?.ingreso ?? "",
      salida: movimiento?.salida ?? "",
      saldo: movimiento?.saldo ?? "",
      createdAt: toNumber(movimiento?.createdAt),
    }))
    .sort((a, b) => {
      const fechaCompare = b.fecha.localeCompare(a.fecha);
      if (fechaCompare !== 0) return fechaCompare;
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      return b.id.localeCompare(a.id);
    });
}

function getLastSaldo(detalle?: DetalleLadoEtiqueta) {
  const movimientos = getMovimientos(detalle);
  if (movimientos.length > 0) return toNumber(movimientos[0].saldo);
  return toNumber(detalle?.stockInicial);
}

function mapProductos(productosNode: unknown): ProductoEtiquetaRow[] {
  if (!productosNode || typeof productosNode !== "object") return [];

  const productos = productosNode as Record<string, ProductoEtiquetaData>;

  const rows = Object.entries(productos).map(([productoKey, productoNode]) => {
    const stock = productoNode?.stock;

    let stockFrente = "—";
    let stockDorso = "—";

    if (stock && typeof stock === "object" && !Array.isArray(stock)) {
      stockFrente = normalizeStock((stock as StockEtiqueta).frente);
      stockDorso = normalizeStock((stock as StockEtiqueta).dorso);
    } else {
      stockFrente = normalizeStock(stock);
    }

    return {
      id: productoKey,
      codigo: normalizeText(productoNode?.codigo || productoKey),
      producto: normalizeText(productoNode?.producto),
      mockupProductoUrl: normalizeText(productoNode?.mockupProductoUrl),
      mockupProductoPath: normalizeText(productoNode?.mockupProductoPath),
      mockupEtiquetaUrl: normalizeText(productoNode?.mockupEtiquetaUrl),
      mockupEtiquetaPath: normalizeText(productoNode?.mockupEtiquetaPath),
      tipoEtiqueta: normalizeText(productoNode?.tipoEtiqueta),
      materialEtiqueta: normalizeText(productoNode?.materialEtiqueta),
      baseImpresion: normalizeText(productoNode?.baseImpresion),
      acabados: normalizeText(productoNode?.acabados || productoNode?.acabado),
      stockFrente,
      stockDorso,
      detalle: productoNode?.detalle || undefined,
      raw: productoNode || {},
    };
  });

  rows.sort((a, b) => a.codigo.localeCompare(b.codigo));
  return rows;
}

function MiniMockup({
  src,
  label,
  onClick,
}: {
  src: string;
  label: string;
  onClick: () => void;
}) {
  if (!src) {
    return (
      <div className="w-14 h-14 rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400">
        <ImageIcon size={20} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-14 h-14 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm hover:ring-2 hover:ring-[#244C5A]/30"
      title={`Ver ${label}`}
    >
      <Image
        src={src}
        alt={label}
        width={64}
        height={64}
        className="w-full h-full object-cover"
        unoptimized={!src.startsWith("/")}
      />
    </button>
  );
}

function DetalleMovimientos({
  producto,
  draft,
  onDraftChange,
  onSave,
  savingSide,
  isMaster,
}: {
  producto: ProductoEtiquetaRow;
  draft: NuevoMovimientoDraft;
  onDraftChange: (next: NuevoMovimientoDraft) => void;
  onSave: (ladoKey: "frente" | "dorso", saldoAnterior: number) => Promise<void>;
  savingSide: "frente" | "dorso" | null;
  isMaster: boolean;
}) {
  const ladosBase: Array<{ key: "frente" | "dorso"; label: string; data?: DetalleLadoEtiqueta }> = [
    { key: "frente", label: "Frente", data: producto.detalle?.frente },
    { key: "dorso", label: "Dorso", data: producto.detalle?.dorso },
  ];

  const lados = ladosBase.filter(
    (lado) =>
      lado.data ||
      (lado.key === "frente" && producto.stockFrente !== "—") ||
      (lado.key === "dorso" && producto.stockDorso !== "—")
  );

  const ingresoEnabled =
    draft.operacionTipo === "COMPRA" ||
    draft.operacionTipo === "REINTEGRO" ||
    (draft.operacionTipo === "AJUSTE" && isMaster);
  const salidaEnabled =
    draft.operacionTipo === "OP" ||
    (draft.operacionTipo === "AJUSTE" && isMaster);

  if (lados.length === 0) {
    return (
      <div className="rounded-3xl bg-white border border-slate-200 p-5 text-center text-sm text-slate-500">
        Este producto no tiene detalle de movimientos registrado.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {lados.map((lado) => {
        const movimientos = getMovimientos(lado.data);
        const saldoAnterior = getLastSaldo(lado.data);
        const ingreso = ingresoEnabled ? toNumber(draft.ingreso) : 0;
        const salida = salidaEnabled ? toNumber(draft.salida) : 0;
        const nuevoSaldo = saldoAnterior + ingreso - salida;

        return (
          <section key={lado.key} className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#244C5A] font-black">Tercer nivel · {lado.label}</p>
                <h4 className="font-black text-slate-900">Movimientos de inventario</h4>
              </div>
              <div className="text-sm font-black text-slate-600">
                Saldo anterior: <span className="text-[#244C5A]">{formatNumber(saldoAnterior)}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Operación</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Número</th>
                    <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Ingreso</th>
                    <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Salida</th>
                    <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Saldo</th>
                    <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Acción</th>
                  </tr>
                </thead>

                <tbody>
                  <tr className="bg-[#244C5A]/5 border-b border-slate-200 align-top">
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={draft.fecha}
                        onChange={(event) => onDraftChange({ ...draft, fecha: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={draft.operacionTipo}
                        onChange={(event) =>
                          onDraftChange({
                            ...draft,
                            operacionTipo: event.target.value as NuevoMovimientoDraft["operacionTipo"],
                            ingreso: "",
                            salida: "",
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                      >
                        <option value="">Seleccionar</option>
                        <option value="COMPRA">COMPRA</option>
                        <option value="OP">OP</option>
                        <option value="REINTEGRO">REINTEGRO</option>
                        <option value="AJUSTE" disabled={!isMaster}>AJUSTE</option>
                      </select>
                      {!isMaster && (
                        <p className="text-[11px] text-slate-500 mt-1">Ajuste solo para master.</p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={draft.operacionNumero}
                        onChange={(event) => onDraftChange({ ...draft, operacionNumero: event.target.value })}
                        placeholder="001"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Quedará: {getOperacionLabel(draft) || "—"}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        value={draft.ingreso}
                        disabled={!ingresoEnabled}
                        onChange={(event) => onDraftChange({ ...draft, ingreso: event.target.value, salida: salidaEnabled ? draft.salida : "" })}
                        placeholder="0"
                        className="w-full rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-right outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        value={draft.salida}
                        disabled={!salidaEnabled}
                        onChange={(event) => onDraftChange({ ...draft, salida: event.target.value, ingreso: ingresoEnabled ? draft.ingreso : "" })}
                        placeholder="0"
                        className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-right outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex justify-end rounded-xl px-3 py-2 text-sm font-black min-w-24 ${
                        nuevoSaldo < 0 ? "bg-red-600 text-white" : "bg-[#244C5A] text-white"
                      }`}>
                        {formatNumber(nuevoSaldo)}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1">saldo anterior + ingreso - salida</p>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSave(lado.key, saldoAnterior)}
                        disabled={savingSide === lado.key}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#244C5A] px-4 py-2 text-sm font-black text-white transition hover:bg-[#1d3d48] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingSide === lado.key ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Guardar
                      </button>
                    </td>
                  </tr>

                  {movimientos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-5 text-center text-sm text-slate-500">
                        No hay movimientos registrados para {lado.label.toLowerCase()}.
                      </td>
                    </tr>
                  ) : (
                    movimientos.map((movimiento) => (
                      <tr key={movimiento.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-700">{movimiento.fecha || "—"}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-800">{movimiento.descripcion || "—"}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">—</td>
                        <td className="px-4 py-3 text-right text-sm text-green-700 font-bold">{formatNumber(movimiento.ingreso)}</td>
                        <td className="px-4 py-3 text-right text-sm text-red-700 font-bold">{formatNumber(movimiento.salida)}</td>
                        <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{formatNumber(movimiento.saldo)}</td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function EtiquetasPage() {
  const router = useRouter();
  const realtimeDb = getDatabase(auth.app);
  const storage = getStorage(auth.app);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const {
    authUser,
    profile,
    loading: loadingPermissions,
    isActive,
    can,
  } = useUserPermissions();

  const [clientes, setClientes] = useState<ClienteEtiquetaRow[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [selectedProductoId, setSelectedProductoId] = useState<string | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingSide, setSavingSide] = useState<"frente" | "dorso" | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [draft, setDraft] = useState<NuevoMovimientoDraft>({
    fecha: todayISO(),
    operacionTipo: "",
    operacionNumero: "",
    ingreso: "",
    salida: "",
  });

  const [editingProduct, setEditingProduct] = useState<ProductoEtiquetaRow | null>(null);
  const [editForm, setEditForm] = useState<ProductEditForm>(emptyEditForm);
  const [savingProduct, setSavingProduct] = useState(false);
  const [mockupProductoFile, setMockupProductoFile] = useState<File | null>(null);
  const [mockupEtiquetaFile, setMockupEtiquetaFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Etiquetas: true,
  });

  const userName = useMemo(() => {
    return (
      profile?.nombre ||
      authUser?.displayName ||
      authUser?.email?.split("@")[0] ||
      "Administrador"
    );
  }, [profile, authUser]);

  const isMaster = useMemo(() => {
    const rawProfile = profile as any;
    const roleText = `${rawProfile?.rolNombre || rawProfile?.role || rawProfile?.rol || ""}`.toLowerCase();
    return roleText.includes("master");
  }, [profile]);

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((current) => ({ ...current, [sectionTitle]: !current[sectionTitle] }));
    if (sidebarCollapsed) setSidebarCollapsed(false);
  };

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

  const filteredClientes = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    if (!cleanSearch) return clientes;

    return clientes.filter((item) => {
      return (
        item.codigoCliente.toLowerCase().includes(cleanSearch) ||
        item.cliente.toLowerCase().includes(cleanSearch)
      );
    });
  }, [clientes, search]);

  const selectedCliente = useMemo(() => {
    if (!selectedClienteId) return null;
    return clientes.find((item) => item.id === selectedClienteId) || null;
  }, [clientes, selectedClienteId]);

  const filteredProductos = useMemo(() => {
    if (!selectedCliente) return [];

    const cleanSearch = productSearch.trim().toLowerCase();

    if (!cleanSearch) return selectedCliente.productos;

    return selectedCliente.productos.filter((item) => {
      return (
        item.codigo.toLowerCase().includes(cleanSearch) ||
        item.producto.toLowerCase().includes(cleanSearch) ||
        item.acabados.toLowerCase().includes(cleanSearch) ||
        item.tipoEtiqueta.toLowerCase().includes(cleanSearch) ||
        item.materialEtiqueta.toLowerCase().includes(cleanSearch) ||
        item.baseImpresion.toLowerCase().includes(cleanSearch)
      );
    });
  }, [selectedCliente, productSearch]);

  useEffect(() => {
    if (!loadingPermissions && !authUser) {
      router.replace("/");
    }
  }, [loadingPermissions, authUser, router]);

  async function reloadClientes() {
    setLoadingClientes(true);
    setError("");

    try {
      const snapshot = await get(dbRef(realtimeDb, "ETIQUETAS/CLIENTES"));

      if (!snapshot.exists()) {
        setClientes([]);
        setSelectedClienteId(null);
        setSelectedProductoId(null);
        setLoadingClientes(false);
        return;
      }

      const rawClientes = snapshot.val() || {};
      const rows: ClienteEtiquetaRow[] = Object.entries(rawClientes).map(
        ([clienteKey, clienteNode]: [string, any]) => {
          const codigoCliente = normalizeText(clienteNode?.codigoCliente || clienteKey);
          const cliente = normalizeText(clienteNode?.cliente);
          const productos = mapProductos(clienteNode?.productos);

          return {
            id: clienteKey,
            codigoCliente,
            cliente,
            productos,
            datos: {
              codigoCliente,
              cliente,
              productos: clienteNode?.productos || {},
            },
          };
        }
      );

      rows.sort((a, b) => a.cliente.localeCompare(b.cliente));
      setClientes(rows);

      setSelectedClienteId((current) => {
        if (!current) return null;
        return rows.some((item) => item.id === current) ? current : null;
      });
    } catch (err: any) {
      setError(`No fue posible cargar los clientes. ${err?.message || ""}`);
    } finally {
      setLoadingClientes(false);
    }
  }

  useEffect(() => {
    if (loadingPermissions) return;

    if (!authUser) {
      setLoadingClientes(false);
      return;
    }

    if (!can("inventarioEtiquetas", "ver")) {
      setLoadingClientes(false);
      return;
    }

    reloadClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingPermissions, authUser, realtimeDb, can]);

  async function handleExportExcel() {
    setError("");
    setSuccess("");
    setExporting(true);

    try {
      const XLSX = await import("xlsx");

      const clientesSheet = clientes.map((cliente) => ({
        CODIGO_CLIENTE: cliente.codigoCliente,
        CLIENTE: cliente.cliente,
      }));

      const productosSheet = clientes.flatMap((cliente) =>
        cliente.productos.map((producto) => ({
          CODIGO_CLIENTE: cliente.codigoCliente,
          CLIENTE: cliente.cliente,
          CODIGO_PRODUCTO: producto.codigo,
          PRODUCTO: producto.producto,
          MOCKUP_PRODUCTO_URL: producto.mockupProductoUrl,
          MOCKUP_ETIQUETA_URL: producto.mockupEtiquetaUrl,
          TIPO_ETIQUETA: producto.tipoEtiqueta,
          MATERIAL_ETIQUETA: producto.materialEtiqueta,
          BASE_IMPRESION: producto.baseImpresion,
          ACABADOS: producto.acabados,
          STOCK_FRENTE: producto.stockFrente === "—" ? "" : producto.stockFrente,
          STOCK_DORSO: producto.stockDorso === "—" ? "" : producto.stockDorso,
        }))
      );

      const ayudaSheet = [
        { CAMPO: "CODIGO_CLIENTE", NOTA: "Obligatorio. Se usa como llave del cliente." },
        { CAMPO: "CODIGO_PRODUCTO", NOTA: "Obligatorio. Se usa como llave del producto." },
        { CAMPO: "TIPO_ETIQUETA", NOTA: TIPO_ETIQUETA_OPTIONS.join(", ") },
        { CAMPO: "MATERIAL_ETIQUETA", NOTA: MATERIAL_ETIQUETA_OPTIONS.join(", ") },
        { CAMPO: "BASE_IMPRESION", NOTA: BASE_IMPRESION_OPTIONS.join(", ") },
        { CAMPO: "ACABADOS", NOTA: ACABADOS_OPTIONS.join(", ") },
        { CAMPO: "STOCK_FRENTE / STOCK_DORSO", NOTA: "Se exportan para control. El stock operativo se recomienda mover desde movimientos." },
      ];

      const wb = XLSX.utils.book_new();
      const wsClientes = XLSX.utils.json_to_sheet(clientesSheet);
      const wsProductos = XLSX.utils.json_to_sheet(productosSheet);
      const wsAyuda = XLSX.utils.json_to_sheet(ayudaSheet);

      wsClientes["!cols"] = [{ wch: 18 }, { wch: 38 }];
      wsProductos["!cols"] = [
        { wch: 18 },
        { wch: 38 },
        { wch: 18 },
        { wch: 44 },
        { wch: 34 },
        { wch: 34 },
        { wch: 18 },
        { wch: 22 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
      ];
      wsAyuda["!cols"] = [{ wch: 25 }, { wch: 90 }];

      XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");
      XLSX.utils.book_append_sheet(wb, wsProductos, "Productos");
      XLSX.utils.book_append_sheet(wb, wsAyuda, "Ayuda");
      XLSX.writeFile(wb, `inventario-etiquetas-${todayISO()}.xlsx`);

      setSuccess("Excel exportado correctamente.");
    } catch (err: any) {
      setError(`No fue posible exportar Excel. ${err?.message || "Verifica que la librería xlsx esté instalada."}`);
    } finally {
      setExporting(false);
    }
  }

  async function handleImportExcel(file?: File) {
    if (!file) return;

    const confirmed = window.confirm(
      "Al importar este Excel se crearán o actualizarán clientes y productos. Si ya existen códigos iguales, se sobrescribirán los nuevos campos. ¿Deseas continuar?"
    );

    if (!confirmed) {
      if (importInputRef.current) importInputRef.current.value = "";
      return;
    }

    setError("");
    setSuccess("");
    setImporting(true);

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const clientesRows = XLSX.utils.sheet_to_json<any>(wb.Sheets["Clientes"] || wb.Sheets[wb.SheetNames[0]] || {});
      const productosRows = XLSX.utils.sheet_to_json<any>(wb.Sheets["Productos"] || {});

      const updates: Record<string, any> = {};

      clientesRows.forEach((row) => {
        const codigoCliente = cleanKey(normalizeText(row.CODIGO_CLIENTE || row.codigoCliente));
        if (!codigoCliente) return;

        updates[`${codigoCliente}/codigoCliente`] = codigoCliente;
        updates[`${codigoCliente}/cliente`] = normalizeText(row.CLIENTE || row.cliente).trim().toUpperCase();
      });

      productosRows.forEach((row) => {
        const codigoCliente = cleanKey(normalizeText(row.CODIGO_CLIENTE || row.codigoCliente));
        const codigoProducto = cleanKey(normalizeText(row.CODIGO_PRODUCTO || row.codigo || row.CODIGO));
        if (!codigoCliente || !codigoProducto) return;

        updates[`${codigoCliente}/codigoCliente`] = codigoCliente;
        updates[`${codigoCliente}/cliente`] = normalizeText(row.CLIENTE || row.cliente).trim().toUpperCase();
        updates[`${codigoCliente}/productos/${codigoProducto}/codigo`] = codigoProducto;
        updates[`${codigoCliente}/productos/${codigoProducto}/producto`] = normalizeText(row.PRODUCTO || row.producto).trim().toUpperCase();
        updates[`${codigoCliente}/productos/${codigoProducto}/mockupProductoUrl`] = normalizeText(row.MOCKUP_PRODUCTO_URL || row.mockupProductoUrl);
        updates[`${codigoCliente}/productos/${codigoProducto}/mockupEtiquetaUrl`] = normalizeText(row.MOCKUP_ETIQUETA_URL || row.mockupEtiquetaUrl);
        updates[`${codigoCliente}/productos/${codigoProducto}/tipoEtiqueta`] = normalizeText(row.TIPO_ETIQUETA || row.tipoEtiqueta);
        updates[`${codigoCliente}/productos/${codigoProducto}/materialEtiqueta`] = normalizeText(row.MATERIAL_ETIQUETA || row.materialEtiqueta);
        updates[`${codigoCliente}/productos/${codigoProducto}/baseImpresion`] = normalizeText(row.BASE_IMPRESION || row.baseImpresion);
        updates[`${codigoCliente}/productos/${codigoProducto}/acabados`] = normalizeText(row.ACABADOS || row.acabados || row.acabado);

        const stockFrente = normalizeText(row.STOCK_FRENTE || row.stockFrente);
        const stockDorso = normalizeText(row.STOCK_DORSO || row.stockDorso);

        if (stockFrente !== "") updates[`${codigoCliente}/productos/${codigoProducto}/stock/frente`] = toNumber(stockFrente);
        if (stockDorso !== "") updates[`${codigoCliente}/productos/${codigoProducto}/stock/dorso`] = toNumber(stockDorso);
      });

      if (Object.keys(updates).length === 0) {
        setError("El Excel no tiene datos válidos para importar.");
        return;
      }

      await update(dbRef(realtimeDb, "ETIQUETAS/CLIENTES"), updates);
      await reloadClientes();
      setSuccess("Excel importado correctamente. Clientes y productos fueron actualizados.");
    } catch (err: any) {
      setError(`No fue posible importar el Excel. ${err?.message || ""}`);
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function handleSaveMovimiento(ladoKey: "frente" | "dorso", saldoAnterior: number) {
    if (!selectedClienteId || !selectedProductoId) return;

    setError("");
    setSuccess("");

    const ingreso = toNumber(draft.ingreso);
    const salida = toNumber(draft.salida);
    const descripcion = getOperacionLabel(draft);

    if (!draft.fecha) {
      setError("Debes seleccionar una fecha para guardar el movimiento.");
      return;
    }

    if (!draft.operacionTipo) {
      setError("Debes seleccionar una operación para guardar el movimiento.");
      return;
    }

    if (draft.operacionTipo === "AJUSTE" && !isMaster) {
      setError("La operación AJUSTE solo puede ser realizada por un usuario master.");
      return;
    }

    if (!draft.operacionNumero.trim()) {
      setError("Debes escribir el número o referencia de la operación.");
      return;
    }

    if (ingreso <= 0 && salida <= 0) {
      setError("Debes registrar un ingreso o una salida mayor a cero.");
      return;
    }

    if (draft.operacionTipo === "COMPRA" && salida > 0) {
      setError("En COMPRA solo se permite ingreso.");
      return;
    }

    if (draft.operacionTipo === "OP" && ingreso > 0) {
      setError("En OP solo se permite salida.");
      return;
    }

    if (draft.operacionTipo === "REINTEGRO" && salida > 0) {
      setError("En REINTEGRO solo se permite ingreso.");
      return;
    }

    const nuevoSaldo = saldoAnterior + ingreso - salida;

    setSavingSide(ladoKey);

    try {
      const movimientosRef = dbRef(
        realtimeDb,
        `ETIQUETAS/CLIENTES/${selectedClienteId}/productos/${selectedProductoId}/detalle/${ladoKey}/movimientos`
      );
      const newMovimientoRef = push(movimientosRef);

      await set(newMovimientoRef, {
        fecha: draft.fecha,
        operacion: descripcion,
        descripcion,
        ingreso: ingreso > 0 ? ingreso : null,
        salida: salida > 0 ? salida : null,
        saldo: nuevoSaldo,
        createdAt: Date.now(),
      });

      await update(
        dbRef(realtimeDb, `ETIQUETAS/CLIENTES/${selectedClienteId}/productos/${selectedProductoId}/stock`),
        { [ladoKey]: nuevoSaldo }
      );

      setDraft({
        fecha: todayISO(),
        operacionTipo: "",
        operacionNumero: "",
        ingreso: "",
        salida: "",
      });
      setSuccess("Movimiento guardado correctamente.");
      await reloadClientes();
    } catch (err: any) {
      setError(`No fue posible guardar el movimiento. ${err?.message || ""}`);
    } finally {
      setSavingSide(null);
    }
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const handleSelectCliente = (cliente: ClienteEtiquetaRow) => {
    const nextId = selectedClienteId === cliente.id ? null : cliente.id;
    setSelectedClienteId(nextId);
    setSelectedProductoId(null);
    setProductSearch("");
    setDraft({ fecha: todayISO(), operacionTipo: "", operacionNumero: "", ingreso: "", salida: "" });
  };

  const handleSelectProducto = (producto: ProductoEtiquetaRow) => {
    const nextId = selectedProductoId === producto.id ? null : producto.id;
    setSelectedProductoId(nextId);
    setDraft({ fecha: todayISO(), operacionTipo: "", operacionNumero: "", ingreso: "", salida: "" });
  };

  const openEditProduct = (producto: ProductoEtiquetaRow) => {
    if (!can("inventarioEtiquetas", "editar")) {
      setError("Tu rol no tiene permiso para editar etiquetas.");
      return;
    }

    setEditingProduct(producto);
    setEditForm({
      codigo: producto.codigo,
      producto: producto.producto,
      tipoEtiqueta: producto.tipoEtiqueta,
      materialEtiqueta: producto.materialEtiqueta,
      baseImpresion: producto.baseImpresion,
      acabados: producto.acabados,
      mockupProductoUrl: producto.mockupProductoUrl,
      mockupProductoPath: producto.mockupProductoPath,
      mockupEtiquetaUrl: producto.mockupEtiquetaUrl,
      mockupEtiquetaPath: producto.mockupEtiquetaPath,
    });
    setMockupProductoFile(null);
    setMockupEtiquetaFile(null);
    setError("");
    setSuccess("");
  };

  async function uploadMockup(file: File, kind: "producto" | "etiqueta") {
    if (!selectedClienteId || !editingProduct) return null;

    const extension = file.name.split(".").pop() || "jpg";
    const path = `etiquetas/${selectedClienteId}/${editingProduct.id}/mockup-${kind}.${extension}`;
    const fileRef = storageRef(storage, path);

    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    return { path, url };
  }

  async function handleSaveProductEdit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedClienteId || !editingProduct) return;

    setSavingProduct(true);
    setError("");
    setSuccess("");

    try {
      let mockupProducto = {
        url: editForm.mockupProductoUrl,
        path: editForm.mockupProductoPath,
      };
      let mockupEtiqueta = {
        url: editForm.mockupEtiquetaUrl,
        path: editForm.mockupEtiquetaPath,
      };

      if (mockupProductoFile) {
        const uploaded = await uploadMockup(mockupProductoFile, "producto");
        if (uploaded) mockupProducto = { url: uploaded.url, path: uploaded.path };
      }

      if (mockupEtiquetaFile) {
        const uploaded = await uploadMockup(mockupEtiquetaFile, "etiqueta");
        if (uploaded) mockupEtiqueta = { url: uploaded.url, path: uploaded.path };
      }

      await update(
        dbRef(realtimeDb, `ETIQUETAS/CLIENTES/${selectedClienteId}/productos/${editingProduct.id}`),
        {
          codigo: editForm.codigo.trim().toUpperCase(),
          producto: editForm.producto.trim().toUpperCase(),
          tipoEtiqueta: editForm.tipoEtiqueta,
          materialEtiqueta: editForm.materialEtiqueta,
          baseImpresion: editForm.baseImpresion,
          acabados: editForm.acabados,
          acabado: editForm.acabados,
          mockupProductoUrl: mockupProducto.url,
          mockupProductoPath: mockupProducto.path,
          mockupEtiquetaUrl: mockupEtiqueta.url,
          mockupEtiquetaPath: mockupEtiqueta.path,
        }
      );

      setSuccess("Producto actualizado correctamente.");
      setEditingProduct(null);
      await reloadClientes();
    } catch (err: any) {
      setError(`No fue posible actualizar el producto. ${err?.message || ""}`);
    } finally {
      setSavingProduct(false);
    }
  }

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

  if (!can("inventarioEtiquetas", "ver")) {
    return (
      <NoPermission
        title="Sin permiso"
        message="Tu rol no tiene permiso para ver etiquetas."
      />
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
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-11 h-11 rounded-2xl bg-[#244C5A] text-white hover:bg-[#1d3d48] flex items-center justify-center transition"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>

            <button
              type="button"
              onClick={() => router.push("/panel")}
              className="w-11 h-11 rounded-2xl bg-[#244C5A]/10 text-[#244C5A] hover:bg-[#244C5A] hover:text-white flex items-center justify-center transition"
              aria-label="Ir al dashboard"
              title="Ir al dashboard"
            >
              <Home size={21} />
            </button>

            <nav className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-600 min-w-0">
              <button
                type="button"
                onClick={() => router.push("/panel")}
                className="text-[#244C5A] hover:underline"
              >
                Panel
              </button>
              <span className="text-slate-300">@</span>
              <span>Etiquetas</span>
              <span className="text-slate-300">@</span>
              <span className="text-slate-900 truncate">Inventario</span>
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold truncate max-w-[220px] text-slate-900">{userName}</p>
              <p className="text-xs text-slate-500 truncate max-w-[220px]">{authUser?.email}</p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 bg-[#244C5A] hover:bg-[#1d3d48] text-white rounded-2xl px-4 py-3 font-semibold transition"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-[1600px] mx-auto px-5 sm:px-8 py-6">
        {error && (
          <div className="mb-5 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <section className="relative overflow-hidden rounded-[32px] bg-[#244C5A] text-white p-6 sm:p-8 shadow-xl mb-6">
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-white/10" />
          <div className="absolute right-24 bottom-[-80px] w-56 h-56 rounded-full bg-white/10" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-sm text-white/65 uppercase tracking-wide font-bold">Inventario de etiquetas</p>
              <h2 className="text-3xl sm:text-4xl font-black mt-1">Clientes, productos y movimientos</h2>
              <p className="text-white/70 mt-2 max-w-3xl">
                Haz clic sobre el código del cliente para desplegar sus productos. Luego haz clic sobre el código del producto para ver movimientos de frente y dorso.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4">
                <p className="text-xs text-white/50 uppercase tracking-wide">Clientes</p>
                <p className="text-2xl font-black mt-1">{clientes.length}</p>
              </div>

              <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4">
                <p className="text-xs text-white/50 uppercase tracking-wide">Filtrados</p>
                <p className="text-2xl font-black mt-1">{filteredClientes.length}</p>
              </div>

              <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4">
                <p className="text-xs text-white/50 uppercase tracking-wide">Productos</p>
                <p className="text-2xl font-black mt-1">{selectedCliente?.productos.length || 0}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">Primera capa</p>
              <h2 className="text-2xl font-black mt-1">Clientes</h2>
              <p className="text-slate-500 text-sm mt-1">Exporta o importa clientes y productos desde el mismo formato Excel.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative w-full lg:w-[330px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar cliente o código..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                />
              </div>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exporting}
                className="rounded-2xl border border-[#244C5A] text-[#244C5A] hover:bg-[#244C5A] hover:text-white px-4 py-3 font-black flex items-center justify-center gap-2 transition disabled:opacity-60"
              >
                {exporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                Exportar
              </button>

              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                className="rounded-2xl bg-[#244C5A] text-white hover:bg-[#1d3d48] px-4 py-3 font-black flex items-center justify-center gap-2 transition disabled:opacity-60"
              >
                {importing ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                Importar
              </button>

              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(event) => handleImportExcel(event.target.files?.[0])}
              />

              <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center">
                {filteredClientes.length} clientes
              </div>
            </div>
          </div>

          {loadingClientes ? (
            <div className="p-8 text-center text-[#244C5A] font-bold flex items-center justify-center gap-3">
              <Loader2 className="animate-spin" size={22} />
              Cargando clientes...
            </div>
          ) : filteredClientes.length === 0 ? (
            <div className="p-8 text-center">
              <PackageSearch className="mx-auto text-[#244C5A]" size={44} />
              <h3 className="font-black text-slate-900 mt-4">No hay clientes para mostrar</h3>
              <p className="text-sm text-slate-500 mt-2">Verifica que exista el nodo ETIQUETAS / CLIENTES en Realtime Database.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Código cliente</th>
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Cliente</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredClientes.map((cliente) => {
                    const isSelectedCliente = selectedClienteId === cliente.id;
                    const productosVisibles = isSelectedCliente ? filteredProductos : [];

                    return (
                      <Fragment key={cliente.id}>
                        <tr
                          onClick={() => handleSelectCliente(cliente)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleSelectCliente(cliente);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          className={`cursor-pointer border-b border-slate-100 transition outline-none focus:bg-[#244C5A]/10 ${
                            isSelectedCliente ? "bg-[#244C5A]/5" : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleSelectCliente(cliente);
                              }}
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black transition ${
                                isSelectedCliente
                                  ? "bg-[#244C5A] text-white"
                                  : "bg-[#244C5A]/10 text-[#244C5A] hover:bg-[#244C5A] hover:text-white"
                              }`}
                              title="Ver productos del cliente"
                            >
                              {isSelectedCliente ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              <Building2 size={15} />
                              {cliente.codigoCliente || "—"}
                            </button>
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-black text-slate-900">{cliente.cliente || "Sin nombre de cliente"}</p>
                            <p className="text-xs text-slate-500 mt-1">{cliente.productos.length} productos</p>
                          </td>
                        </tr>

                        {isSelectedCliente && (
                          <tr className="border-b border-slate-200">
                            <td colSpan={2} className="bg-slate-50/80 px-4 sm:px-8 py-6">
                              <div className="rounded-[26px] border border-slate-200 bg-white overflow-hidden shadow-sm">
                                <div className="p-5 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                                  <div>
                                    <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">Segunda capa</p>
                                    <h3 className="text-xl font-black mt-1">Productos de {cliente.codigoCliente}</h3>
                                    <p className="text-slate-500 text-sm mt-1">{cliente.cliente || "Cliente sin nombre"}</p>
                                  </div>

                                  <div className="relative w-full xl:w-[380px]">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                                    <input
                                      type="text"
                                      value={productSearch}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={(event) => setProductSearch(event.target.value)}
                                      placeholder="Buscar código, producto, material..."
                                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                                    />
                                  </div>
                                </div>

                                {productosVisibles.length === 0 ? (
                                  <div className="p-8 text-center">
                                    <PackageSearch className="mx-auto text-[#244C5A]" size={44} />
                                    <h3 className="font-black text-slate-900 mt-4">No hay productos para mostrar</h3>
                                    <p className="text-sm text-slate-500 mt-2">Este cliente no tiene referencias o el filtro no encontró coincidencias.</p>
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1450px] border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                          <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Código</th>
                                          <th className="text-center px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Mockup producto</th>
                                          <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Producto</th>
                                          <th className="text-center px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Mockup etiqueta</th>
                                          <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Tipo etiqueta</th>
                                          <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Material etiqueta</th>
                                          <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Base impresión</th>
                                          <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Acabados</th>
                                          <th className="text-center px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Stock frente</th>
                                          <th className="text-center px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Stock dorso</th>
                                          <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Editar</th>
                                        </tr>
                                      </thead>

                                      <tbody>
                                        {productosVisibles.map((producto) => {
                                          const isSelectedProducto = selectedProductoId === producto.id;

                                          return (
                                            <Fragment key={producto.id}>
                                              <tr className={`border-b border-slate-100 transition ${isSelectedProducto ? "bg-[#244C5A]/5" : "hover:bg-slate-50"}`}>
                                                <td className="px-5 py-4">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleSelectProducto(producto)}
                                                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black transition ${
                                                      isSelectedProducto
                                                        ? "bg-[#244C5A] text-white"
                                                        : "bg-[#244C5A]/10 text-[#244C5A] hover:bg-[#244C5A] hover:text-white"
                                                    }`}
                                                    title="Ver movimientos del producto"
                                                  >
                                                    {isSelectedProducto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                                    {producto.codigo || "—"}
                                                  </button>
                                                </td>

                                                <td className="px-5 py-4 text-center">
                                                  <MiniMockup
                                                    src={producto.mockupProductoUrl}
                                                    label={`Mockup producto ${producto.codigo}`}
                                                    onClick={() => setImagePreview({ src: producto.mockupProductoUrl, title: `Mockup producto ${producto.codigo}` })}
                                                  />
                                                </td>

                                                <td className="px-5 py-4">
                                                  <p className="font-bold text-slate-900">{producto.producto || "Sin nombre de producto"}</p>
                                                </td>

                                                <td className="px-5 py-4 text-center">
                                                  <MiniMockup
                                                    src={producto.mockupEtiquetaUrl}
                                                    label={`Mockup etiqueta ${producto.codigo}`}
                                                    onClick={() => setImagePreview({ src: producto.mockupEtiquetaUrl, title: `Mockup etiqueta ${producto.codigo}` })}
                                                  />
                                                </td>

                                                <td className="px-5 py-4 text-sm text-slate-700">{producto.tipoEtiqueta || "—"}</td>
                                                <td className="px-5 py-4 text-sm text-slate-700">{producto.materialEtiqueta || "—"}</td>
                                                <td className="px-5 py-4 text-sm text-slate-700">{producto.baseImpresion || "—"}</td>
                                                <td className="px-5 py-4">
                                                  <span className="inline-flex rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-black">
                                                    {producto.acabados || "—"}
                                                  </span>
                                                </td>

                                                <td className="px-5 py-4 text-center">
                                                  <span className="inline-flex min-w-14 justify-center rounded-2xl bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                                                    {producto.stockFrente}
                                                  </span>
                                                </td>

                                                <td className="px-5 py-4 text-center">
                                                  <span className="inline-flex min-w-14 justify-center rounded-2xl bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                                                    {producto.stockDorso}
                                                  </span>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                  {can("inventarioEtiquetas", "editar") ? (
                                                    <button
                                                      type="button"
                                                      onClick={() => openEditProduct(producto)}
                                                      className="inline-flex items-center gap-2 rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition"
                                                    >
                                                      <Edit3 size={17} />
                                                      Editar
                                                    </button>
                                                  ) : (
                                                    <span className="text-sm text-slate-400">—</span>
                                                  )}
                                                </td>
                                              </tr>

                                              {isSelectedProducto && (
                                                <tr className="border-b border-slate-200">
                                                  <td colSpan={11} className="bg-slate-100/70 px-4 sm:px-7 py-6">
                                                    <DetalleMovimientos
                                                      producto={producto}
                                                      draft={draft}
                                                      onDraftChange={setDraft}
                                                      onSave={handleSaveMovimiento}
                                                      savingSide={savingSide}
                                                      isMaster={isMaster}
                                                    />
                                                  </td>
                                                </tr>
                                              )}
                                            </Fragment>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
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
          )}
        </section>
      </section>

      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProductEdit}
            className="w-full max-w-4xl bg-white rounded-[32px] shadow-2xl overflow-hidden"
          >
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-[#244C5A] uppercase tracking-wide">Editar producto</p>
                <h3 className="text-2xl font-black mt-1">{editingProduct.codigo}</h3>
              </div>

              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Código</label>
                <input
                  type="text"
                  value={editForm.codigo}
                  onChange={(event) => setEditForm((current) => ({ ...current, codigo: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                />
              </div>

              <div className="xl:col-span-3">
                <label className="block text-sm font-bold text-slate-700 mb-2">Producto</label>
                <input
                  type="text"
                  value={editForm.producto}
                  onChange={(event) => setEditForm((current) => ({ ...current, producto: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Tipo etiqueta</label>
                <select
                  value={editForm.tipoEtiqueta}
                  onChange={(event) => setEditForm((current) => ({ ...current, tipoEtiqueta: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                >
                  <option value="">Selecciona</option>
                  {TIPO_ETIQUETA_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Material etiqueta</label>
                <select
                  value={editForm.materialEtiqueta}
                  onChange={(event) => setEditForm((current) => ({ ...current, materialEtiqueta: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                >
                  <option value="">Selecciona</option>
                  {MATERIAL_ETIQUETA_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Base de impresión</label>
                <select
                  value={editForm.baseImpresion}
                  onChange={(event) => setEditForm((current) => ({ ...current, baseImpresion: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                >
                  <option value="">Selecciona</option>
                  {BASE_IMPRESION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Acabados</label>
                <select
                  value={editForm.acabados}
                  onChange={(event) => setEditForm((current) => ({ ...current, acabados: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                >
                  <option value="">Selecciona</option>
                  {ACABADOS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>

              <div className="md:col-span-1 xl:col-span-2 rounded-3xl border border-slate-200 p-4">
                <label className="block text-sm font-bold text-slate-700 mb-3">Mockup del producto</label>
                <div className="flex items-center gap-4">
                  <MiniMockup
                    src={mockupProductoFile ? URL.createObjectURL(mockupProductoFile) : editForm.mockupProductoUrl}
                    label="Mockup producto"
                    onClick={() =>
                      setImagePreview({
                        src: mockupProductoFile ? URL.createObjectURL(mockupProductoFile) : editForm.mockupProductoUrl,
                        title: "Mockup producto",
                      })
                    }
                  />
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setMockupProductoFile(event.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-[#244C5A] file:px-3 file:py-2 file:text-white file:font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMockupProductoFile(null);
                        setEditForm((current) => ({ ...current, mockupProductoUrl: "", mockupProductoPath: "" }));
                      }}
                      className="text-xs font-bold text-red-600 hover:underline"
                    >
                      Eliminar mockup producto
                    </button>
                  </div>
                </div>
              </div>

              <div className="md:col-span-1 xl:col-span-2 rounded-3xl border border-slate-200 p-4">
                <label className="block text-sm font-bold text-slate-700 mb-3">Mockup etiqueta</label>
                <div className="flex items-center gap-4">
                  <MiniMockup
                    src={mockupEtiquetaFile ? URL.createObjectURL(mockupEtiquetaFile) : editForm.mockupEtiquetaUrl}
                    label="Mockup etiqueta"
                    onClick={() =>
                      setImagePreview({
                        src: mockupEtiquetaFile ? URL.createObjectURL(mockupEtiquetaFile) : editForm.mockupEtiquetaUrl,
                        title: "Mockup etiqueta",
                      })
                    }
                  />
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setMockupEtiquetaFile(event.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-[#244C5A] file:px-3 file:py-2 file:text-white file:font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMockupEtiquetaFile(null);
                        setEditForm((current) => ({ ...current, mockupEtiquetaUrl: "", mockupEtiquetaPath: "" }));
                      }}
                      className="text-xs font-bold text-red-600 hover:underline"
                    >
                      Eliminar mockup etiqueta
                    </button>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 xl:col-span-4 rounded-2xl bg-[#244C5A]/5 border border-[#244C5A]/10 px-4 py-3 text-sm text-[#244C5A]">
                Los campos de stock frente y stock dorso se actualizan desde movimientos.
              </div>
            </div>

            <div className="p-5 sm:p-6 border-t border-slate-200 flex flex-col sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="rounded-2xl border border-slate-300 px-5 py-3 font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingProduct}
                className="rounded-2xl bg-[#244C5A] hover:bg-[#1d3d48] text-white px-5 py-3 font-black flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {savingProduct ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {imagePreview?.src && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-4xl w-full overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-black text-slate-900">{imagePreview.title}</h3>
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex justify-center">
              <Image
                src={imagePreview.src}
                alt={imagePreview.title}
                width={900}
                height={650}
                className="max-h-[75vh] w-auto object-contain rounded-2xl"
                unoptimized={!imagePreview.src.startsWith("/")}
              />
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
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition ${
                              item.href === "/panel/inventario-etiquetas"
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
