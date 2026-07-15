"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  FileText,
  Home,
  Info,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Package,
  PackagePlus,
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
import { get, getDatabase, ref, set, update } from "firebase/database";
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth } from "@/lib/firebase";
import { useUserPermissions } from "@/lib/useUserPermissions";
import NoPermission from "@/components/NoPermission";

type ClientData = {
  cliente: string;
  codigo_cliente: string;
  no: string | number;
  observaciones: string;
};

type ClientRow = {
  id: string;
  codigoNodo: string;
  nombreNodo: string;
  no: number;
  codigoCliente: string;
  cliente: string;
  observaciones: string;
  datos: ClientData;
  raw?: Record<string, any>;
};

type ProductRow = {
  id: string;
  codigoNodo: string;
  nombreNodo: string;
  codigoProducto: string;
  producto: string;
  codigoEtiqueta: string;
  precio: string;
  etiquetaCreada?: boolean;
  etiquetaCodigoCreada?: string;
};

type ProductDetailRow = {
  id: string;
  codigoEnvase: string;
  tipoDeEmpaque: string;
  unidadDeEmpaque: string;
  descripcion: string;
  proveedor: string;
  codigoProveedor: string;
  nit: string;
  telefono: string;
  correo: string;
  direccion: string;
  stock: string;
  costo: string;
};

type ProviderProductRow = {
  id: string;
  codigo: string;
  producto: string;
  unidadDeEmpaque: string;
  stock: string;
  costo: string;
};

type ProviderRow = {
  id: string;
  codigoNodo: string;
  nombreNodo: string;
  codigoProveedor: string;
  proveedor: string;
  nit: string;
  telefono: string;
  correo: string;
  direccion: string;
  productos: ProviderProductRow[];
};

type NewProductDetailForm = Omit<ProductDetailRow, "id">;

type NewProductForm = {
  codigoProducto: string;
  producto: string;
  codigoEtiqueta: string;
  precio: string;
  crearEtiqueta?: boolean;
  etiqueta?: EtiquetaCreateForm;
  detalles: NewProductDetailForm[];
};

type EtiquetaCreateForm = {
  codigo: string;
  producto: string;
  tipoEtiqueta: string;
  materialEtiqueta: string;
  baseImpresion: string;
  acabados: string;
  mockupProductoUrl: string;
  mockupProductoPath: string;
};

type EtiquetaModalState = {
  client: ClientRow;
  product: ProductRow;
} | null;

const emptyClient: ClientData = {
  cliente: "",
  codigo_cliente: "",
  no: "",
  observaciones: "",
};

const emptyProductDetail: NewProductDetailForm = {
  codigoEnvase: "",
  tipoDeEmpaque: "",
  unidadDeEmpaque: "",
  descripcion: "",
  proveedor: "",
  codigoProveedor: "",
  nit: "",
  telefono: "",
  correo: "",
  direccion: "",
  stock: "",
  costo: "",
};

const packagingTypeOptions = ["PLANCHAS", "PAQUETE", "BOLSA", "CAJA", "PACA"];

const emptyProduct: NewProductForm = {
  codigoProducto: "",
  producto: "",
  codigoEtiqueta: "",
  precio: "",
  crearEtiqueta: false,
  etiqueta: {
    codigo: "",
    producto: "",
    tipoEtiqueta: "",
    materialEtiqueta: "",
    baseImpresion: "",
    acabados: "",
    mockupProductoUrl: "",
    mockupProductoPath: "",
  },
  detalles: [{ ...emptyProductDetail }],
};

const emptyEtiquetaForm: EtiquetaCreateForm = {
  codigo: "",
  producto: "",
  tipoEtiqueta: "",
  materialEtiqueta: "",
  baseImpresion: "",
  acabados: "",
  mockupProductoUrl: "",
  mockupProductoPath: "",
};

const tipoEtiquetaOptions = ["Sencilla", "Termoencogible", "Doble etiqueta", "Rollo"];
const materialEtiquetaOptions = ["TERMOENCOGIBLE", "ADHESIVO", "PROPALCOTE", "POLIPROPILENO"];
const baseImpresionOptions = ["BLANCO", "METALIZADO"];
const acabadosEtiquetaOptions = ["MATE", "BRILLANTE", "UV PARCIAL"];

function createEmptyProduct(): NewProductForm {
  return {
    ...emptyProduct,
    etiqueta: { ...(emptyProduct.etiqueta || emptyEtiquetaForm) },
    detalles: [{ ...emptyProductDetail }],
  };
}

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

function buildEtiquetaCodigo(productCode: unknown) {
  const cleanProductCode = cleanKey(normalizeText(productCode));
  return cleanProductCode ? `E-${cleanProductCode}` : "";
}

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? 0 : numberValue;
}

type MenuItem = {
  title: string;
  icon: any;
  href: string;
  module?: string;
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
      { title: "Crear / ver clientes", icon: UserPlus, href: "/panel/clientes", module: "clientes" },
      { title: "Crear orden de pedido", icon: ClipboardList, href: "/panel/pedidos", module: "pedidos" },
      { title: "Ver órdenes de pedido", icon: Eye, href: "/panel/ordenes_creadas", module: "ordenesCreadas" },
      { title: "Generar orden de muestra", icon: Package, href: "/panel/muestra", module: "muestra" },
    ],
  },
  {
    title: "Producción",
    icon: Building2,
    items: [
      { title: "Ver órdenes de pedido", icon: Eye, href: "/panel/ordenes_creadas", module: "ordenesCreadas" },
      { title: "Producción x Planta", icon: Building2, href: "/panel/produccionxplanta", module: "produccionxplanta" },
    ],
  },
  {
    title: "Compras",
    icon: ShoppingCart,
    items: [
      { title: "Crear órdenes de compra", icon: Plus, href: "/panel/compras2", module: "compras" },
      { title: "Ver órdenes de compra", icon: Eye, href: "/panel/gestion-compras2", module: "gestionCompras" },
      { title: "Crear proveedor", icon: PackagePlus, href: "/panel/crear-proveedor", module: "crearProveedor" },
    ],
  },
  {
    title: "Etiquetas",
    icon: Tag,
    items: [
      { title: "Lista etiquetas", icon: Tags, href: "/panel/inventario-etiquetas", module: "inventarioEtiquetas" },
      { title: "Crear orden de compra etiquetas", icon: FileText, href: "/panel/compra-etiqueta", module: "compraEtiqueta" },
      { title: "Ver órdenes de compra etiquetas", icon: Eye, href: "/panel/gestion-etiquetas", module: "gestionEtiquetas" },
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
  can,
  handleLogout,
}: {
  userName: string;
  userEmail?: string | null;
  roleName?: string;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean | ((current: boolean) => boolean)) => void;
  can: (module: any, action: any) => boolean;
  handleLogout: () => void;
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const filteredMenuSections = useMemo(() => {
    return menuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => (item.module ? can(item.module as any, "ver") : true)),
      }))
      .filter((section) => section.items.length > 0);
  }, [can]);

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

            {filteredMenuSections.map((section) => {
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
                        const isActive = item.href === "/panel/clientes";

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

export default function ClientesPage() {
  const router = useRouter();
  const realtimeDb = getDatabase(auth.app);
  const storage = getStorage(auth.app);

  const {
    authUser,
    profile,
    loading: loadingPermissions,
    isActive,
    can,
  } = useUserPermissions();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [saving, setSaving] = useState(false);

  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [productsByClient, setProductsByClient] = useState<
    Record<string, ProductRow[]>
  >({});
  const [loadingProductsByClient, setLoadingProductsByClient] = useState<
    Record<string, boolean>
  >({});
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(
    null,
  );
  const [productDetailsByKey, setProductDetailsByKey] = useState<
    Record<string, ProductDetailRow[]>
  >({});
  const [loadingDetailsByKey, setLoadingDetailsByKey] = useState<
    Record<string, boolean>
  >({});

  const [form, setForm] = useState<ClientData>(emptyClient);
  const [newProducts, setNewProducts] = useState<NewProductForm[]>([
    createEmptyProduct(),
  ]);
  // Control visual: las capas 2 y 3 inician cerradas para evitar scroll largo.
  const [showCreateProducts, setShowCreateProducts] = useState(false);
  const [openNewProductIndex, setOpenNewProductIndex] = useState<number | null>(null);
  const [openNewDetailsByProduct, setOpenNewDetailsByProduct] = useState<Record<number, boolean>>({});
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientModalStep, setClientModalStep] = useState<1 | 2 | 3 | 4>(1);
  const [clientModalMaxStep, setClientModalMaxStep] = useState<1 | 2 | 3 | 4>(1);

  const [etiquetaModal, setEtiquetaModal] = useState<EtiquetaModalState>(null);
  const [etiquetaForm, setEtiquetaForm] = useState<EtiquetaCreateForm>(emptyEtiquetaForm);
  const [mockupProductoEtiquetaFile, setMockupProductoEtiquetaFile] = useState<File | null>(null);
  const [newProductEtiquetaFiles, setNewProductEtiquetaFiles] = useState<Record<number, File | null>>({});
  const [savingEtiqueta, setSavingEtiqueta] = useState(false);

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const userName = useMemo(() => {
    return (
      profile?.nombre ||
      authUser?.displayName ||
      authUser?.email?.split("@")[0] ||
      "Administrador"
    );
  }, [profile, authUser]);

  const filteredClients = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    if (!cleanSearch) return clients;

    return clients.filter((item) => {
      return (
        normalizeText(item.no).toLowerCase().includes(cleanSearch) ||
        item.codigoCliente.toLowerCase().includes(cleanSearch) ||
        item.cliente.toLowerCase().includes(cleanSearch) ||
        item.observaciones.toLowerCase().includes(cleanSearch)
      );
    });
  }, [clients, search]);

  const providersByCode = useMemo(() => {
    const map: Record<string, ProviderRow> = {};

    providers.forEach((provider) => {
      if (provider.codigoProveedor) {
        map[provider.codigoProveedor] = provider;
      }
    });

    return map;
  }, [providers]);

  useEffect(() => {
    if (!loadingPermissions && !authUser) {
      router.replace("/");
    }
  }, [loadingPermissions, authUser, router]);

  async function reloadClients() {
    setLoadingClients(true);
    setError("");

    try {
      const snapshot = await get(ref(realtimeDb, "CLIENTES"));

      if (!snapshot.exists()) {
        setClients([]);
        setLoadingClients(false);
        return;
      }

      const rawClients = snapshot.val() || {};
      const rows: ClientRow[] = [];

      Object.entries(rawClients).forEach(([clientCode, clientNode]) => {
        const clientNames = clientNode as Record<string, any>;

        Object.entries(clientNames || {}).forEach(
          ([clientName, clientContent]) => {
            const datos = clientContent?.DATOS || {};
            const no = toNumber(datos.no);

            rows.push({
              id: `${clientCode}/${clientName}`,
              codigoNodo: clientCode,
              nombreNodo: clientName,
              no,
              codigoCliente: normalizeText(datos.codigo_cliente || clientCode),
              cliente: normalizeText(datos.cliente || clientName),
              observaciones: normalizeText(datos.observaciones),
              datos: {
                no: normalizeText(datos.no),
                codigo_cliente: normalizeText(
                  datos.codigo_cliente || clientCode,
                ),
                cliente: normalizeText(datos.cliente || clientName),
                observaciones: normalizeText(datos.observaciones),
              },
              raw: clientContent || {},
            });
          },
        );
      });

      rows.sort((a, b) => {
        if (a.no !== b.no) return a.no - b.no;
        return a.cliente.localeCompare(b.cliente);
      });

      setClients(rows);
    } catch (err: any) {
      setError(`No fue posible cargar clientes. ${err?.message || ""}`);
    } finally {
      setLoadingClients(false);
    }
  }

  async function reloadProviders() {
    setLoadingProviders(true);

    try {
      const snapshot = await get(ref(realtimeDb, "PROVEEDORES"));

      if (!snapshot.exists()) {
        setProviders([]);
        return;
      }

      const rawProviders = snapshot.val() || {};
      const rowsByCode: Record<string, ProviderRow> = {};

      const readProviderProducts = (productosNode: unknown): ProviderProductRow[] => {
        const productos = productosNode as Record<string, any>;

        return Object.entries(productos || {})
          .map(([productCode, productContent]) => {
            const content = productContent as Record<string, any>;
            const datosProducto = content?.DATOS_PRODUCTO || content || {};
            const codigo = cleanKey(
              normalizeText(
                datosProducto.CODIGO ||
                  datosProducto.codigo ||
                  datosProducto.codigo_producto ||
                  productCode,
              ),
            );

            return {
              id: codigo || productCode,
              codigo: codigo || cleanKey(productCode),
              producto: normalizeText(
                datosProducto.PRODUCTO ||
                  datosProducto.producto ||
                  datosProducto.descripcion ||
                  datosProducto.DESCRIPCION,
              ).trim(),
              unidadDeEmpaque: normalizeText(
                datosProducto.UNIDAD_DE_EMPAQUE ||
                  datosProducto.unidad_de_empaque ||
                  datosProducto.unidadDeEmpaque,
              ).trim(),
              stock: normalizeText(datosProducto.STOCK || datosProducto.stock).trim(),
              costo: normalizeText(datosProducto.COSTO || datosProducto.costo).trim(),
            };
          })
          .filter((item) => item.codigo || item.producto)
          .sort((a, b) => a.codigo.localeCompare(b.codigo));
      };

      const readProviderDatos = (
        datos: Record<string, any>,
        productosNode: unknown,
        providerCodeFallback: string,
        providerNameFallback: string,
        idFallback: string,
      ) => {
        const codigoProveedor = cleanKey(
          normalizeText(
            datos.CODIGO ||
              datos.codigo ||
              datos.codigo_proveedor ||
              datos.codigoProveedor ||
              providerCodeFallback,
          ),
        );

        if (!codigoProveedor) return;

        const proveedor = normalizeText(
          datos.PROVEEDOR ||
            datos.proveedor ||
            datos.nombre ||
            datos.NOMBRE ||
            providerNameFallback,
        ).trim();

        rowsByCode[codigoProveedor] = {
          id: idFallback,
          codigoNodo: providerCodeFallback,
          nombreNodo: providerNameFallback,
          codigoProveedor,
          proveedor,
          nit: normalizeText(datos.NIT || datos.nit),
          telefono: normalizeText(datos.TELEFONO || datos.telefono),
          correo: normalizeText(
            datos.CORREO || datos.correo || datos.EMAIL || datos.email,
          ),
          direccion: normalizeText(datos.DIRECCION || datos.direccion),
          productos: readProviderProducts(productosNode),
        };
      };

      Object.entries(rawProviders).forEach(([providerCode, providerNode]) => {
        const firstLevel = providerNode as Record<string, any>;

        // Soporta: PROVEEDORES/{codigo}/DATOS
        if (firstLevel?.DATOS) {
          readProviderDatos(
            firstLevel.DATOS,
            firstLevel.PRODUCTOS,
            providerCode,
            normalizeText(firstLevel.DATOS.PROVEEDOR || firstLevel.DATOS.proveedor || providerCode),
            providerCode,
          );
        }

        // Soporta: PROVEEDORES/{codigo}/{nombreProveedor}/DATOS
        Object.entries(firstLevel || {}).forEach(([providerName, providerContent]) => {
          const content = providerContent as Record<string, any>;

          if (content?.DATOS) {
            readProviderDatos(
              content.DATOS,
              content.PRODUCTOS,
              providerCode,
              providerName,
              `${providerCode}/${providerName}`,
            );
            return;
          }

          // Soporta datos planos por si algún proveedor no tiene nodo DATOS.
          if (
            content?.CODIGO ||
            content?.codigo ||
            content?.PROVEEDOR ||
            content?.proveedor
          ) {
            readProviderDatos(
              content,
              content.PRODUCTOS,
              providerCode,
              providerName,
              `${providerCode}/${providerName}`,
            );
          }
        });
      });

      const rows = Object.values(rowsByCode).sort((a, b) =>
        a.codigoProveedor.localeCompare(b.codigoProveedor),
      );

      setProviders(rows);
    } catch (err: any) {
      setError(`No fue posible cargar proveedores. ${err?.message || ""}`);
    } finally {
      setLoadingProviders(false);
    }
  }

  useEffect(() => {
    if (loadingPermissions) return;

    if (!authUser) {
      setLoadingClients(false);
      return;
    }

    if (!can("clientes", "ver")) {
      setLoadingClients(false);
      return;
    }

    reloadClients();
    reloadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingPermissions, authUser, realtimeDb, can]);

  const resetForm = () => {
    setForm(emptyClient);
    setNewProducts([createEmptyProduct()]);
    setShowCreateProducts(false);
    setOpenNewProductIndex(null);
    setOpenNewDetailsByProduct({});
    setEditingClient(null);
    setClientModalOpen(false);
    setClientModalStep(1);
    setClientModalMaxStep(1);
    setNewProductEtiquetaFiles({});
    setError("");
    setMessage("");
  };

  const handleChange = (field: keyof ClientData, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleNewProductChange = (
    productIndex: number,
    field: keyof Omit<NewProductForm, "detalles">,
    value: string,
  ) => {
    setNewProducts((current) =>
      current.map((product, index) =>
        index === productIndex ? { ...product, [field]: value } : product,
      ),
    );
  };

  const toggleNewProductEtiqueta = (productIndex: number) => {
    setNewProducts((current) =>
      current.map((product, index) => {
        if (index !== productIndex) return product;

        const nextEnabled = !product.crearEtiqueta;
        const codigoSugerido = buildEtiquetaCodigo(product.codigoProducto);
        const productoSugerido = normalizeText(product.producto).trim().toUpperCase();

        return {
          ...product,
          crearEtiqueta: nextEnabled,
          etiqueta: nextEnabled
            ? {
                ...(product.etiqueta || emptyEtiquetaForm),
                codigo: codigoSugerido,
                producto: product.etiqueta?.producto || productoSugerido,
              }
            : { ...(product.etiqueta || emptyEtiquetaForm) },
        };
      }),
    );
  };

  const handleNewProductEtiquetaChange = (
    productIndex: number,
    field: keyof EtiquetaCreateForm,
    value: string,
  ) => {
    setNewProducts((current) =>
      current.map((product, index) =>
        index === productIndex
          ? {
              ...product,
              etiqueta: {
                ...(product.etiqueta || emptyEtiquetaForm),
                [field]: value,
              },
            }
          : product,
      ),
    );
  };

  const handleNewProductEtiquetaFileChange = (productIndex: number, file?: File | null) => {
    setNewProductEtiquetaFiles((current) => ({
      ...current,
      [productIndex]: file || null,
    }));
  };

  const handleNewDetailChange = (
    productIndex: number,
    detailIndex: number,
    field: keyof NewProductDetailForm,
    value: string,
  ) => {
    setNewProducts((current) =>
      current.map((product, index) => {
        if (index !== productIndex) return product;

        return {
          ...product,
          detalles: product.detalles.map((detail, currentDetailIndex) =>
            currentDetailIndex === detailIndex
              ? { ...detail, [field]: value }
              : detail,
          ),
        };
      }),
    );
  };

  const handleProviderSelect = (
    productIndex: number,
    detailIndex: number,
    providerCode: string,
  ) => {
    const cleanProviderCode = cleanKey(providerCode);
    const selectedProvider = providersByCode[cleanProviderCode];

    setNewProducts((current) =>
      current.map((product, index) => {
        if (index !== productIndex) return product;

        return {
          ...product,
          detalles: product.detalles.map((detail, currentDetailIndex) =>
            currentDetailIndex === detailIndex
              ? {
                  ...detail,
                  codigoProveedor: cleanProviderCode,
                  proveedor: selectedProvider?.proveedor || "",
                  nit: selectedProvider?.nit || "",
                  telefono: selectedProvider?.telefono || "",
                  correo: selectedProvider?.correo || "",
                  direccion: selectedProvider?.direccion || "",
                  descripcion: "",
                  unidadDeEmpaque: "",
                  stock: "",
                  costo: "",
                }
              : detail,
          ),
        };
      }),
    );
  };

  const handleProviderProductSelect = (
    productIndex: number,
    detailIndex: number,
    providerProductCode: string,
  ) => {
    setNewProducts((current) =>
      current.map((product, index) => {
        if (index !== productIndex) return product;

        return {
          ...product,
          detalles: product.detalles.map((detail, currentDetailIndex) => {
            if (currentDetailIndex !== detailIndex) return detail;

            const selectedProvider = providersByCode[detail.codigoProveedor];
            const selectedProduct = selectedProvider?.productos.find(
              (item) => item.codigo === providerProductCode,
            );

            return {
              ...detail,
              codigoEnvase: selectedProduct?.codigo || providerProductCode || detail.codigoEnvase,
              descripcion: selectedProduct?.producto || "",
              unidadDeEmpaque: selectedProduct?.unidadDeEmpaque || "",
              stock: selectedProduct?.stock || detail.stock,
              costo: selectedProduct?.costo || detail.costo,
            };
          }),
        };
      }),
    );
  };

  const addNewProduct = () => {
    setShowCreateProducts(true);
    setNewProducts((current) => {
      const nextIndex = current.length;
      setOpenNewProductIndex(nextIndex);
      setOpenNewDetailsByProduct((currentOpen) => ({
        ...currentOpen,
        [nextIndex]: true,
      }));
      return [...current, createEmptyProduct()];
    });
  };

  const toggleNewProduct = (productIndex: number) => {
    setOpenNewProductIndex((current) =>
      current === productIndex ? null : productIndex,
    );
  };

  const toggleNewProductDetails = (productIndex: number) => {
    setOpenNewDetailsByProduct((current) => ({
      ...current,
      [productIndex]: !current[productIndex],
    }));
  };

  const removeNewProduct = (productIndex: number) => {
    setNewProducts((current) => {
      const nextProducts = current.filter((_, index) => index !== productIndex);
      setNewProductEtiquetaFiles((currentFiles) => {
        const nextFiles = { ...currentFiles };
        delete nextFiles[productIndex];
        return nextFiles;
      });
      setOpenNewProductIndex(null);
      setOpenNewDetailsByProduct({});
      return nextProducts.length > 0 ? nextProducts : [createEmptyProduct()];
    });
  };

  const addNewProductDetail = (productIndex: number) => {
    setNewProducts((current) =>
      current.map((product, index) =>
        index === productIndex
          ? {
              ...product,
              detalles: [...product.detalles, { ...emptyProductDetail }],
            }
          : product,
      ),
    );
  };

  const removeNewProductDetail = (productIndex: number, detailIndex: number) => {
    setNewProducts((current) =>
      current.map((product, index) => {
        if (index !== productIndex) return product;

        const nextDetails = product.detalles.filter(
          (_, currentDetailIndex) => currentDetailIndex !== detailIndex,
        );

        return {
          ...product,
          detalles: nextDetails.length > 0 ? nextDetails : [{ ...emptyProductDetail }],
        };
      }),
    );
  };

  const handleOpenCreateClient = () => {
    const nextNo = String(getNextNo());
    setForm({ ...emptyClient, no: nextNo });
    setNewProducts([createEmptyProduct()]);
    setShowCreateProducts(false);
    setOpenNewProductIndex(null);
    setOpenNewDetailsByProduct({});
    setNewProductEtiquetaFiles({});
    setEditingClient(null);
    setClientModalStep(1);
    setClientModalMaxStep(1);
    setClientModalOpen(true);
    setError("");
    setMessage("");
  };

  const buildEditableProductsFromClient = (
    client: ClientRow,
    etiquetasNode?: Record<string, any>,
  ): NewProductForm[] => {
    const productosNode = client.raw?.PRODUCTOS || {};
    const etiquetasProductos = etiquetasNode?.productos || {};
    const rows: NewProductForm[] = [];

    Object.entries(productosNode || {}).forEach(([productCode, productNames]: [string, any]) => {
      Object.entries(productNames || {}).forEach(([productName, productContent]: [string, any]) => {
        const datosProducto = productContent?.DATOS_PRODUCTO || {};
        const codigoProducto = cleanKey(normalizeText(datosProducto.codigo_producto || productCode));
        const producto = normalizeText(datosProducto.producto || productName).trim().toUpperCase();
        const codigoEtiqueta = cleanKey(normalizeText(datosProducto.codigo_etiqueta || ""));

        const etiquetaEntry = Object.entries(etiquetasProductos || {}).find(([etiquetaKey, etiquetaValue]: [string, any]) => {
          const etiquetaCodigo = cleanKey(normalizeText(etiquetaValue?.codigo || etiquetaKey));
          const origenProductoCodigo = cleanKey(normalizeText(etiquetaValue?.origenProductoCodigo));
          return (
            (codigoEtiqueta && etiquetaCodigo === codigoEtiqueta) ||
            (codigoProducto && origenProductoCodigo === codigoProducto)
          );
        }) as [string, any] | undefined;

        const etiquetaData = etiquetaEntry?.[1] || null;
        const detallesNode = productContent?.DETALLE_PRODUCTO || {};
        const detalles = Object.entries(detallesNode || {}).map(([detailCode, detailContent]: [string, any]) => ({
          codigoEnvase: cleanKey(normalizeText(detailContent?.codigo_envase || detailCode)),
          tipoDeEmpaque: normalizeText(detailContent?.tipo_de_empaque),
          unidadDeEmpaque: normalizeText(detailContent?.unidad_de_empaque),
          descripcion: normalizeText(detailContent?.descripcion),
          proveedor: normalizeText(detailContent?.proveedor),
          codigoProveedor: cleanKey(normalizeText(detailContent?.codigo_proveedor)),
          nit: normalizeText(detailContent?.nit),
          telefono: normalizeText(detailContent?.telefono),
          correo: normalizeText(detailContent?.correo),
          direccion: normalizeText(detailContent?.direccion),
          stock: normalizeText(detailContent?.stock),
          costo: normalizeText(detailContent?.costo),
        }));

        rows.push({
          codigoProducto,
          producto,
          codigoEtiqueta,
          precio: normalizeText(datosProducto.precio),
          crearEtiqueta: !!etiquetaData,
          etiqueta: etiquetaData
            ? {
                codigo: buildEtiquetaCodigo(codigoProducto),
                producto: normalizeText(etiquetaData.producto || producto).trim().toUpperCase(),
                tipoEtiqueta: normalizeText(etiquetaData.tipoEtiqueta),
                materialEtiqueta: normalizeText(etiquetaData.materialEtiqueta),
                baseImpresion: normalizeText(etiquetaData.baseImpresion),
                acabados: normalizeText(etiquetaData.acabados || etiquetaData.acabado),
                mockupProductoUrl: normalizeText(etiquetaData.mockupProductoUrl),
                mockupProductoPath: normalizeText(etiquetaData.mockupProductoPath),
              }
            : {
                ...emptyEtiquetaForm,
                codigo: buildEtiquetaCodigo(codigoProducto),
                producto,
              },
          detalles: detalles.length > 0 ? detalles : [{ ...emptyProductDetail }],
        });
      });
    });

    return rows.length > 0 ? rows : [createEmptyProduct()];
  };

  const handleEdit = async (client: ClientRow) => {
    if (!can("clientes", "editar")) {
      setError("Tu rol no tiene permiso para editar clientes.");
      return;
    }

    setEditingClient(client);
    setForm(client.datos);
    setShowCreateProducts(true);
    setOpenNewProductIndex(0);
    setOpenNewDetailsByProduct({ 0: false });
    setNewProductEtiquetaFiles({});
    setClientModalStep(1);
    setClientModalMaxStep(4);
    setClientModalOpen(true);
    setError("");
    setMessage("");

    try {
      const etiquetasSnap = await get(ref(realtimeDb, `ETIQUETAS/CLIENTES/${cleanKey(client.codigoCliente || client.codigoNodo)}`));
      const etiquetasData = etiquetasSnap.exists() ? etiquetasSnap.val() || {} : {};
      const editableProducts = buildEditableProductsFromClient(client, etiquetasData);
      const detailsOpenState = editableProducts.reduce((acc, _product, index) => {
        acc[index] = false;
        return acc;
      }, {} as Record<number, boolean>);
      setNewProducts(editableProducts);
      setOpenNewDetailsByProduct(detailsOpenState);
    } catch (err: any) {
      setNewProducts(buildEditableProductsFromClient(client));
      setMessage(`Cliente abierto para edición. No fue posible consultar etiquetas existentes: ${err?.message || ""}`);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteClient = async (client: ClientRow) => {
    if (!can("clientes", "eliminar" as any) && !can("clientes", "editar")) {
      setError("Tu rol no tiene permiso para eliminar clientes.");
      return;
    }

    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar el cliente ${client.codigoCliente} - ${client.cliente}? También se eliminarán todos sus productos y detalles dentro de CLIENTES.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await set(ref(realtimeDb, `CLIENTES/${client.codigoNodo}/${client.nombreNodo}`), null);

      setExpandedClientId((current) => (current === client.id ? null : current));
      setSelectedProductKey(null);
      setProductsByClient((current) => {
        const next = { ...current };
        delete next[client.id];
        return next;
      });
      setProductDetailsByKey((current) => {
        const next = { ...current };
        Object.keys(next).forEach((key) => {
          if (key.startsWith(`${client.id}/`)) delete next[key];
        });
        return next;
      });

      await reloadClients();
      setMessage("Cliente eliminado correctamente junto con sus productos.");
    } catch (err: any) {
      setError(`No fue posible eliminar el cliente. ${err?.message || ""}`);
    } finally {
      setSaving(false);
    }
  };

  const getNextNo = () => {
    if (clients.length === 0) return 1;

    const maxNo = Math.max(...clients.map((item) => item.no || 0));
    return maxNo + 1;
  };

  const fillNextNo = () => {
    setForm((current) => ({
      ...current,
      no: String(getNextNo()),
    }));
  };

  const loadProductsByClient = async (client: ClientRow) => {
    setLoadingProductsByClient((current) => ({
      ...current,
      [client.id]: true,
    }));

    try {
      // Ruta real:
      // CLIENTES/{codigoCliente}/{nombreCliente}/PRODUCTOS/{codigoProducto}/{nombreProducto}/DATOS_PRODUCTO
      const productsPath = `CLIENTES/${client.codigoNodo}/${client.nombreNodo}/PRODUCTOS`;
      const snapshot = await get(ref(realtimeDb, productsPath));
      const rawProducts = snapshot.exists() ? snapshot.val() || {} : {};
      const etiquetasSnap = await get(
        ref(realtimeDb, `ETIQUETAS/CLIENTES/${cleanKey(client.codigoCliente || client.codigoNodo)}/productos`),
      );
      const etiquetasProductos = etiquetasSnap.exists() ? etiquetasSnap.val() || {} : {};
      const rows: ProductRow[] = [];

      Object.entries(rawProducts).forEach(([productNodeCode, productNode]) => {
        const productNames = productNode as Record<string, any>;

        Object.entries(productNames || {}).forEach(
          ([productNodeName, productContent]) => {
            const productData =
              (productContent as Record<string, any>)?.DATOS_PRODUCTO || {};

            const codigoProducto = normalizeText(
              productData.codigo_producto || productNodeCode,
            );
            const codigoEtiqueta = normalizeText(productData.codigo_etiqueta);
            const etiquetaEntry = Object.entries(etiquetasProductos || {}).find(
              ([etiquetaKey, etiquetaValue]: [string, any]) => {
                const etiquetaCodigo = cleanKey(normalizeText(etiquetaValue?.codigo || etiquetaKey));
                const origenProductoCodigo = cleanKey(normalizeText(etiquetaValue?.origenProductoCodigo));
                return (
                  (codigoEtiqueta && etiquetaCodigo === cleanKey(codigoEtiqueta)) ||
                  (codigoProducto && origenProductoCodigo === cleanKey(codigoProducto))
                );
              },
            ) as [string, any] | undefined;

            rows.push({
              id: `${productNodeCode}/${productNodeName}`,
              codigoNodo: productNodeCode,
              nombreNodo: productNodeName,
              codigoProducto,
              producto: normalizeText(productData.producto || productNodeName),
              codigoEtiqueta,
              precio: normalizeText(productData.precio),
              etiquetaCreada: !!etiquetaEntry,
              etiquetaCodigoCreada: etiquetaEntry
                ? cleanKey(normalizeText(etiquetaEntry[1]?.codigo || etiquetaEntry[0]))
                : "",
            });
          },
        );
      });

      rows.sort((a, b) => a.codigoProducto.localeCompare(b.codigoProducto));

      setProductsByClient((current) => ({
        ...current,
        [client.id]: rows,
      }));
    } catch (err: any) {
      setError(`No fue posible cargar productos. ${err?.message || ""}`);
    } finally {
      setLoadingProductsByClient((current) => ({
        ...current,
        [client.id]: false,
      }));
    }
  };

  const handleToggleProducts = async (client: ClientRow) => {
    setError("");
    setMessage("");
    setSelectedProductKey(null);

    if (expandedClientId === client.id) {
      setExpandedClientId(null);
      return;
    }

    setExpandedClientId(client.id);

    if (!productsByClient[client.id]) {
      await loadProductsByClient(client);
    }
  };

  const getProductDetailKey = (client: ClientRow, product: ProductRow) => {
    return `${client.id}/${product.id}`;
  };

  const loadProductDetail = async (client: ClientRow, product: ProductRow) => {
    const detailKey = getProductDetailKey(client, product);

    setLoadingDetailsByKey((current) => ({
      ...current,
      [detailKey]: true,
    }));

    try {
      // Ruta real:
      // CLIENTES/{codigoCliente}/{nombreCliente}/PRODUCTOS/{codigoProducto}/{nombreProducto}/DETALLE_PRODUCTO
      const detailPath = `CLIENTES/${client.codigoNodo}/${client.nombreNodo}/PRODUCTOS/${product.codigoNodo}/${product.nombreNodo}/DETALLE_PRODUCTO`;
      const snapshot = await get(ref(realtimeDb, detailPath));
      const rawDetails = snapshot.exists() ? snapshot.val() || {} : {};

      const rows: ProductDetailRow[] = Object.entries(rawDetails).map(
        ([detailNodeCode, detailContent]) => {
          const detail = detailContent as Record<string, any>;

          return {
            id: detailNodeCode,
            codigoEnvase: normalizeText(
              detail.codigo_envase || detailNodeCode,
            ),
            tipoDeEmpaque: normalizeText(detail.tipo_de_empaque),
            unidadDeEmpaque: normalizeText(detail.unidad_de_empaque),
            descripcion: normalizeText(detail.descripcion),
            proveedor: normalizeText(detail.proveedor),
            codigoProveedor: normalizeText(detail.codigo_proveedor),
            nit: normalizeText(detail.nit),
            telefono: normalizeText(detail.telefono),
            correo: normalizeText(detail.correo),
            direccion: normalizeText(detail.direccion),
            stock: normalizeText(detail.stock),
            costo: normalizeText(detail.costo),
          };
        },
      );

      rows.sort((a, b) => a.codigoEnvase.localeCompare(b.codigoEnvase));

      setProductDetailsByKey((current) => ({
        ...current,
        [detailKey]: rows,
      }));
    } catch (err: any) {
      setError(`No fue posible cargar detalle del producto. ${err?.message || ""}`);
    } finally {
      setLoadingDetailsByKey((current) => ({
        ...current,
        [detailKey]: false,
      }));
    }
  };

  const handleToggleProductDetail = async (
    client: ClientRow,
    product: ProductRow,
  ) => {
    setError("");
    setMessage("");

    const detailKey = getProductDetailKey(client, product);

    if (selectedProductKey === detailKey) {
      setSelectedProductKey(null);
      return;
    }

    setSelectedProductKey(detailKey);

    if (!productDetailsByKey[detailKey]) {
      await loadProductDetail(client, product);
    }
  };



  const handleOpenCreateEtiqueta = (client: ClientRow, product: ProductRow) => {
    if (!can("inventarioEtiquetas", "crear") && !can("inventarioEtiquetas", "editar")) {
      setError("Tu rol no tiene permiso para crear etiquetas.");
      return;
    }

    const codigoSugerido = buildEtiquetaCodigo(product.codigoProducto);

    setEtiquetaModal({ client, product });
    setEtiquetaForm({
      ...emptyEtiquetaForm,
      codigo: codigoSugerido,
      producto: normalizeText(product.producto).trim().toUpperCase(),
    });
    setMockupProductoEtiquetaFile(null);
    setError("");
    setMessage("");
  };

  const handleEtiquetaFormChange = (field: keyof EtiquetaCreateForm, value: string) => {
    setEtiquetaForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCloseEtiquetaModal = () => {
    setEtiquetaModal(null);
    setEtiquetaForm(emptyEtiquetaForm);
    setMockupProductoEtiquetaFile(null);
    setSavingEtiqueta(false);
  };

  const uploadEtiquetaMockupIfNeeded = async (
    clienteCodigo: string,
    etiquetaCodigo: string,
  ) => {
    if (!mockupProductoEtiquetaFile) {
      return {
        mockupProductoUrl: etiquetaForm.mockupProductoUrl || "",
        mockupProductoPath: etiquetaForm.mockupProductoPath || "",
      };
    }

    const extension = mockupProductoEtiquetaFile.name.split(".").pop() || "jpg";
    const path = `etiquetas/${clienteCodigo}/${etiquetaCodigo}/mockup-producto.${extension}`;
    const fileRef = storageRef(storage, path);

    await uploadBytes(fileRef, mockupProductoEtiquetaFile);
    const url = await getDownloadURL(fileRef);

    return {
      mockupProductoUrl: url,
      mockupProductoPath: path,
    };
  };

  const handleSaveEtiqueta = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!etiquetaModal) return;

    if (!can("inventarioEtiquetas", "crear") && !can("inventarioEtiquetas", "editar")) {
      setError("Tu rol no tiene permiso para crear etiquetas.");
      return;
    }

    setError("");
    setMessage("");

    const codigoCliente = cleanKey(etiquetaModal.client.codigoCliente || etiquetaModal.client.codigoNodo);
    const nombreCliente = normalizeText(etiquetaModal.client.cliente || etiquetaModal.client.nombreNodo).trim().toUpperCase();
    const codigoEtiqueta = buildEtiquetaCodigo(etiquetaModal.product.codigoProducto);
    const productoEtiqueta = normalizeText(etiquetaForm.producto).trim().toUpperCase();

    if (!codigoCliente) {
      setError("No fue posible identificar el código del cliente para crear la etiqueta.");
      return;
    }

    if (!codigoEtiqueta) {
      setError("El código de la etiqueta es obligatorio.");
      return;
    }

    if (!productoEtiqueta) {
      setError("El nombre del producto es obligatorio para crear la etiqueta.");
      return;
    }

    setSavingEtiqueta(true);

    try {
      const mockupData = await uploadEtiquetaMockupIfNeeded(codigoCliente, codigoEtiqueta);

      const updates: Record<string, any> = {
        codigoCliente,
        cliente: nombreCliente,
        [`productos/${codigoEtiqueta}/codigo`]: codigoEtiqueta,
        [`productos/${codigoEtiqueta}/producto`]: productoEtiqueta,
        [`productos/${codigoEtiqueta}/tipoEtiqueta`]: etiquetaForm.tipoEtiqueta,
        [`productos/${codigoEtiqueta}/materialEtiqueta`]: etiquetaForm.materialEtiqueta,
        [`productos/${codigoEtiqueta}/baseImpresion`]: etiquetaForm.baseImpresion,
        [`productos/${codigoEtiqueta}/acabados`]: etiquetaForm.acabados,
        [`productos/${codigoEtiqueta}/acabado`]: etiquetaForm.acabados,
        [`productos/${codigoEtiqueta}/mockupProductoUrl`]: mockupData.mockupProductoUrl,
        [`productos/${codigoEtiqueta}/mockupProductoPath`]: mockupData.mockupProductoPath,
        [`productos/${codigoEtiqueta}/origenClienteCodigo`]: etiquetaModal.client.codigoCliente,
        [`productos/${codigoEtiqueta}/origenProductoCodigo`]: etiquetaModal.product.codigoProducto,
        [`productos/${codigoEtiqueta}/createdAt`]: new Date().toISOString(),
        [`productos/${codigoEtiqueta}/createdByUid`]: authUser?.uid || null,
        [`productos/${codigoEtiqueta}/createdByEmail`]: authUser?.email || null,
      };

      await update(ref(realtimeDb, `ETIQUETAS/CLIENTES/${codigoCliente}`), updates);

      setMessage(`Etiqueta ${codigoEtiqueta} creada correctamente en inventario de etiquetas.`);
      await loadProductsByClient(etiquetaModal.client);
      handleCloseEtiquetaModal();
    } catch (err: any) {
      setError(`No fue posible crear la etiqueta. ${err?.message || ""}`);
    } finally {
      setSavingEtiqueta(false);
    }
  };


  const handleEditProduct = async (client: ClientRow, product: ProductRow) => {
    if (!can("clientes", "editar")) {
      setError("Tu rol no tiene permiso para editar productos.");
      return;
    }

    const codigoProducto = window.prompt(
      "Código producto",
      product.codigoProducto,
    );
    if (codigoProducto === null) return;

    const producto = window.prompt("Producto", product.producto);
    if (producto === null) return;

    const precio = window.prompt("Precio", product.precio);
    if (precio === null) return;

    const newProductCode = cleanKey(codigoProducto);
    const newProductName = normalizeText(producto)
      .trim()
      .toUpperCase()
      .replace(/[.#$/[\]]/g, "-");

    if (!newProductCode || !newProductName) {
      setError("El código y el nombre del producto son obligatorios.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const oldPath = `CLIENTES/${client.codigoNodo}/${client.nombreNodo}/PRODUCTOS/${product.codigoNodo}/${product.nombreNodo}`;
      const newPath = `CLIENTES/${client.codigoNodo}/${client.nombreNodo}/PRODUCTOS/${newProductCode}/${newProductName}`;
      const datosProducto = {
        codigo_producto: newProductCode,
        producto: newProductName,
        codigo_etiqueta: buildEtiquetaCodigo(newProductCode),
        precio: normalizeText(precio).trim(),
      };

      if (oldPath !== newPath) {
        const oldSnapshot = await get(ref(realtimeDb, oldPath));
        const oldData = oldSnapshot.exists() ? oldSnapshot.val() : {};

        await set(ref(realtimeDb, newPath), {
          ...oldData,
          DATOS_PRODUCTO: datosProducto,
        });
        await set(ref(realtimeDb, oldPath), null);
        setSelectedProductKey(null);
      } else {
        await update(ref(realtimeDb, newPath), {
          DATOS_PRODUCTO: datosProducto,
        });
      }

      await loadProductsByClient(client);
      setMessage("Producto actualizado correctamente.");
    } catch (err: any) {
      setError(`No fue posible actualizar el producto. ${err?.message || ""}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditProductDetail = async (
    client: ClientRow,
    product: ProductRow,
    detail: ProductDetailRow,
  ) => {
    if (!can("clientes", "editar")) {
      setError("Tu rol no tiene permiso para editar detalles de producto.");
      return;
    }

    const codigoEnvase = window.prompt("Código envase", detail.codigoEnvase);
    if (codigoEnvase === null) return;

    const descripcion = window.prompt("Descripción", detail.descripcion);
    if (descripcion === null) return;

    const tipoDeEmpaque = window.prompt("Tipo de empaque", detail.tipoDeEmpaque);
    if (tipoDeEmpaque === null) return;

    const unidadDeEmpaque = window.prompt(
      "Unidad de empaque",
      detail.unidadDeEmpaque,
    );
    if (unidadDeEmpaque === null) return;

    const proveedor = window.prompt("Proveedor", detail.proveedor);
    if (proveedor === null) return;

    const codigoProveedor = window.prompt(
      "Código proveedor",
      detail.codigoProveedor,
    );
    if (codigoProveedor === null) return;

    const cleanProviderCodeForEdit = cleanKey(codigoProveedor);
    const selectedProviderForEdit = providersByCode[cleanProviderCodeForEdit];

    // Campos ocultos en tercera capa: se conservan automáticamente sin pedirlos al usuario.
    const nit = selectedProviderForEdit?.nit || detail.nit;
    const telefono = selectedProviderForEdit?.telefono || detail.telefono;
    const correo = selectedProviderForEdit?.correo || detail.correo;
    const direccion = selectedProviderForEdit?.direccion || detail.direccion;
    const stock = detail.stock;
    const costo = detail.costo;

    const newDetailCode = cleanKey(codigoEnvase);

    if (!newDetailCode) {
      setError("El código de envase es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const detailsBasePath = `CLIENTES/${client.codigoNodo}/${client.nombreNodo}/PRODUCTOS/${product.codigoNodo}/${product.nombreNodo}/DETALLE_PRODUCTO`;
      const oldPath = `${detailsBasePath}/${detail.id}`;
      const newPath = `${detailsBasePath}/${newDetailCode}`;
      const datosDetalle = {
        codigo_envase: newDetailCode,
        descripcion: normalizeText(descripcion).trim(),
        tipo_de_empaque: normalizeText(tipoDeEmpaque).trim(),
        unidad_de_empaque: normalizeText(unidadDeEmpaque).trim(),
        proveedor: normalizeText(selectedProviderForEdit?.proveedor || proveedor).trim(),
        codigo_proveedor: cleanProviderCodeForEdit,
        nit: normalizeText(nit).trim(),
        telefono: normalizeText(telefono).trim(),
        correo: normalizeText(correo).trim(),
        direccion: normalizeText(direccion).trim(),
        stock: normalizeText(stock).trim(),
        costo: normalizeText(costo).trim(),
      };

      await set(ref(realtimeDb, newPath), datosDetalle);

      if (oldPath !== newPath) {
        await set(ref(realtimeDb, oldPath), null);
      }

      await loadProductDetail(client, product);
      setMessage("Detalle de producto actualizado correctamente.");
    } catch (err: any) {
      setError(
        `No fue posible actualizar el detalle del producto. ${err?.message || ""}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const goToProductStep = () => {
    setError("");
    setMessage("");

    const codigoCliente = cleanKey(normalizeText(form.codigo_cliente));
    const cliente = normalizeText(form.cliente).trim().toUpperCase();
    const no = toNumber(form.no);

    if (!no || no <= 0) {
      setError("El campo No es obligatorio y debe ser mayor a cero.");
      return;
    }

    if (!codigoCliente) {
      setError("El código del cliente es obligatorio.");
      return;
    }

    if (!cliente) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }

    setShowCreateProducts(true);
    setOpenNewProductIndex((current) => current ?? 0);
    setClientModalStep(2);
    setClientModalMaxStep((current) => (current > 2 ? current : 2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (editingClient && !can("clientes", "editar")) {
      setError("Tu rol no tiene permiso para editar clientes.");
      return;
    }

    if (!editingClient && !can("clientes", "crear")) {
      setError("Tu rol no tiene permiso para crear clientes.");
      return;
    }

    const codigoCliente = cleanKey(normalizeText(form.codigo_cliente));
    const cliente = normalizeText(form.cliente).trim().toUpperCase();
    const no = toNumber(form.no);

    if (!no || no <= 0) {
      setError("El campo No es obligatorio y debe ser mayor a cero.");
      return;
    }

    if (!codigoCliente) {
      setError("El código del cliente es obligatorio.");
      return;
    }

    if (!cliente) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }

    const duplicatedNo = clients.find(
      (item) => item.no === no && item.id !== editingClient?.id,
    );

    if (duplicatedNo) {
      setError(`Ya existe un cliente con el No ${no}.`);
      return;
    }

    const productosPayload: Record<string, any> = {};

    for (let productIndex = 0; productIndex < newProducts.length; productIndex += 1) {
        const product = newProducts[productIndex];
        const hasProductData =
          product.codigoProducto.trim() ||
          product.producto.trim() ||
          product.codigoEtiqueta.trim() ||
          product.precio.trim() ||
          product.detalles.some((detail) =>
            Object.values(detail).some((value) => normalizeText(value).trim()),
          );

        if (!hasProductData) continue;

        const codigoProducto = cleanKey(product.codigoProducto);
        const producto = normalizeText(product.producto).trim().toUpperCase();

        if (!codigoProducto || !producto) {
          setError(
            `El producto ${productIndex + 1} debe tener código producto y nombre del producto.`,
          );
          return;
        }

        if (product.crearEtiqueta) {
          if (!can("inventarioEtiquetas", "crear") && !can("inventarioEtiquetas", "editar")) {
            setError(`Tu rol no tiene permiso para crear etiquetas. Revisa el producto ${productIndex + 1}.`);
            return;
          }

          const etiquetaCodigo = buildEtiquetaCodigo(product.codigoProducto);
          const etiquetaProducto = normalizeText(product.etiqueta?.producto || product.producto).trim().toUpperCase();

          if (!etiquetaCodigo) {
            setError(`La etiqueta del producto ${productIndex + 1} debe tener código.`);
            return;
          }

          if (!etiquetaProducto) {
            setError(`La etiqueta del producto ${productIndex + 1} debe tener nombre de producto.`);
            return;
          }
        }

        const detallePayload: Record<string, any> = {};

        for (let detailIndex = 0; detailIndex < product.detalles.length; detailIndex += 1) {
          const detail = product.detalles[detailIndex];
          const hasDetailData = Object.values(detail).some((value) =>
            normalizeText(value).trim(),
          );

          if (!hasDetailData) continue;

          const codigoEnvase = cleanKey(detail.codigoEnvase);

          if (!codigoEnvase) {
            setError(
              `El detalle ${detailIndex + 1} del producto ${codigoProducto} debe tener código envase.`,
            );
            return;
          }

          const codigoProveedor = cleanKey(detail.codigoProveedor);
          const selectedProvider = codigoProveedor ? providersByCode[codigoProveedor] : null;

          if (codigoProveedor && !selectedProvider) {
            setError(
              `El código proveedor ${codigoProveedor} del detalle ${detailIndex + 1} no existe en PROVEEDORES.`,
            );
            return;
          }

          detallePayload[codigoEnvase] = {
            codigo_envase: codigoEnvase,
            descripcion: normalizeText(detail.descripcion).trim(),
            tipo_de_empaque: normalizeText(detail.tipoDeEmpaque).trim(),
            unidad_de_empaque: normalizeText(detail.unidadDeEmpaque).trim(),
            proveedor: normalizeText(selectedProvider?.proveedor || detail.proveedor).trim(),
            codigo_proveedor: codigoProveedor,
            nit: normalizeText(selectedProvider?.nit || detail.nit).trim(),
            telefono: normalizeText(selectedProvider?.telefono || detail.telefono).trim(),
            correo: normalizeText(selectedProvider?.correo || detail.correo).trim(),
            direccion: normalizeText(selectedProvider?.direccion || detail.direccion).trim(),
            stock: normalizeText(detail.stock).trim(),
            costo: normalizeText(detail.costo).trim(),
          };
        }

        productosPayload[codigoProducto] = {
          [producto]: {
            DATOS_PRODUCTO: {
              codigo_producto: codigoProducto,
              producto,
              codigo_etiqueta: product.crearEtiqueta ? buildEtiquetaCodigo(product.codigoProducto) : "",
              precio: normalizeText(product.precio).trim(),
            },
            ...(Object.keys(detallePayload).length > 0
              ? { DETALLE_PRODUCTO: detallePayload }
              : {}),
          },
        };
      }

    setSaving(true);

    try {
      const clientPath = `CLIENTES/${codigoCliente}/${cliente}`;
      const datos: ClientData = {
        no,
        codigo_cliente: codigoCliente,
        cliente,
        observaciones: normalizeText(form.observaciones),
      };

      if (editingClient) {
        const oldPath = `CLIENTES/${editingClient.id}`;

        if (editingClient.id !== `${codigoCliente}/${cliente}`) {
          const oldSnapshot = await get(ref(realtimeDb, oldPath));
          const oldData = oldSnapshot.exists() ? oldSnapshot.val() : {};

          await set(ref(realtimeDb, clientPath), {
            ...oldData,
            DATOS: datos,
          });

          await set(ref(realtimeDb, oldPath), null);
        } else {
          await update(ref(realtimeDb, clientPath), {
            DATOS: datos,
          });
        }

        if (Object.keys(productosPayload).length > 0) {
          await update(ref(realtimeDb, `${clientPath}/PRODUCTOS`), productosPayload);
        }

        const etiquetasUpdates: Record<string, any> = {};
        let etiquetasCreadas = 0;

        for (let productIndex = 0; productIndex < newProducts.length; productIndex += 1) {
          const product = newProducts[productIndex];
          if (!product.crearEtiqueta) continue;

          const codigoProducto = cleanKey(product.codigoProducto);
          const productoCliente = normalizeText(product.producto).trim().toUpperCase();
          if (!codigoProducto || !productoCliente) continue;

          const etiquetaCodigo = buildEtiquetaCodigo(product.codigoProducto);
          const etiquetaProducto = normalizeText(product.etiqueta?.producto || product.producto).trim().toUpperCase();
          if (!etiquetaCodigo || !etiquetaProducto) continue;

          const etiquetaFile = newProductEtiquetaFiles[productIndex];
          let mockupProductoUrl = normalizeText(product.etiqueta?.mockupProductoUrl);
          let mockupProductoPath = normalizeText(product.etiqueta?.mockupProductoPath);

          if (etiquetaFile) {
            const extension = etiquetaFile.name.split(".").pop() || "jpg";
            const path = `etiquetas/${codigoCliente}/${etiquetaCodigo}/mockup-producto.${extension}`;
            const fileRef = storageRef(storage, path);
            await uploadBytes(fileRef, etiquetaFile);
            mockupProductoUrl = await getDownloadURL(fileRef);
            mockupProductoPath = path;
          }

          etiquetasUpdates[`productos/${etiquetaCodigo}/codigo`] = etiquetaCodigo;
          etiquetasUpdates[`productos/${etiquetaCodigo}/producto`] = etiquetaProducto;
          etiquetasUpdates[`productos/${etiquetaCodigo}/tipoEtiqueta`] = product.etiqueta?.tipoEtiqueta || "";
          etiquetasUpdates[`productos/${etiquetaCodigo}/materialEtiqueta`] = product.etiqueta?.materialEtiqueta || "";
          etiquetasUpdates[`productos/${etiquetaCodigo}/baseImpresion`] = product.etiqueta?.baseImpresion || "";
          etiquetasUpdates[`productos/${etiquetaCodigo}/acabados`] = product.etiqueta?.acabados || "";
          etiquetasUpdates[`productos/${etiquetaCodigo}/acabado`] = product.etiqueta?.acabados || "";
          etiquetasUpdates[`productos/${etiquetaCodigo}/mockupProductoUrl`] = mockupProductoUrl;
          etiquetasUpdates[`productos/${etiquetaCodigo}/mockupProductoPath`] = mockupProductoPath;
          etiquetasUpdates[`productos/${etiquetaCodigo}/origenClienteCodigo`] = codigoCliente;
          etiquetasUpdates[`productos/${etiquetaCodigo}/origenProductoCodigo`] = codigoProducto;
          etiquetasUpdates[`productos/${etiquetaCodigo}/createdAt`] = new Date().toISOString();
          etiquetasUpdates[`productos/${etiquetaCodigo}/createdByUid`] = authUser?.uid || null;
          etiquetasUpdates[`productos/${etiquetaCodigo}/createdByEmail`] = authUser?.email || null;
          etiquetasCreadas += 1;
        }

        if (Object.keys(etiquetasUpdates).length > 0) {
          await update(ref(realtimeDb, `ETIQUETAS/CLIENTES/${codigoCliente}`), {
            codigoCliente,
            cliente,
            ...etiquetasUpdates,
          });
        }

        setMessage(
          Object.keys(productosPayload).length > 0
            ? `Cliente actualizado correctamente con producto(s) agregado(s)${etiquetasCreadas > 0 ? ` y ${etiquetasCreadas} etiqueta(s) en inventario.` : "."}`
            : "Cliente actualizado correctamente."
        );
      } else {
        const clientSnapshot = await get(ref(realtimeDb, clientPath));

        if (clientSnapshot.exists()) {
          setError("Ya existe un cliente con ese código y nombre.");
          setSaving(false);
          return;
        }

        await set(ref(realtimeDb, clientPath), {
          DATOS: datos,
          ...(Object.keys(productosPayload).length > 0
            ? { PRODUCTOS: productosPayload }
            : {}),
        });

        const etiquetasUpdates: Record<string, any> = {};
        let etiquetasCreadas = 0;

        for (let productIndex = 0; productIndex < newProducts.length; productIndex += 1) {
          const product = newProducts[productIndex];
          if (!product.crearEtiqueta) continue;

          const codigoProducto = cleanKey(product.codigoProducto);
          const productoCliente = normalizeText(product.producto).trim().toUpperCase();
          if (!codigoProducto || !productoCliente) continue;

          const etiquetaCodigo = buildEtiquetaCodigo(product.codigoProducto);
          const etiquetaProducto = normalizeText(product.etiqueta?.producto || product.producto).trim().toUpperCase();
          if (!etiquetaCodigo || !etiquetaProducto) continue;

          const etiquetaFile = newProductEtiquetaFiles[productIndex];
          let mockupProductoUrl = normalizeText(product.etiqueta?.mockupProductoUrl);
          let mockupProductoPath = normalizeText(product.etiqueta?.mockupProductoPath);

          if (etiquetaFile) {
            const extension = etiquetaFile.name.split(".").pop() || "jpg";
            const path = `etiquetas/${codigoCliente}/${etiquetaCodigo}/mockup-producto.${extension}`;
            const fileRef = storageRef(storage, path);
            await uploadBytes(fileRef, etiquetaFile);
            mockupProductoUrl = await getDownloadURL(fileRef);
            mockupProductoPath = path;
          }

          etiquetasUpdates[`productos/${etiquetaCodigo}/codigo`] = etiquetaCodigo;
          etiquetasUpdates[`productos/${etiquetaCodigo}/producto`] = etiquetaProducto;
          etiquetasUpdates[`productos/${etiquetaCodigo}/tipoEtiqueta`] = product.etiqueta?.tipoEtiqueta || "";
          etiquetasUpdates[`productos/${etiquetaCodigo}/materialEtiqueta`] = product.etiqueta?.materialEtiqueta || "";
          etiquetasUpdates[`productos/${etiquetaCodigo}/baseImpresion`] = product.etiqueta?.baseImpresion || "";
          etiquetasUpdates[`productos/${etiquetaCodigo}/acabados`] = product.etiqueta?.acabados || "";
          etiquetasUpdates[`productos/${etiquetaCodigo}/acabado`] = product.etiqueta?.acabados || "";
          etiquetasUpdates[`productos/${etiquetaCodigo}/mockupProductoUrl`] = mockupProductoUrl;
          etiquetasUpdates[`productos/${etiquetaCodigo}/mockupProductoPath`] = mockupProductoPath;
          etiquetasUpdates[`productos/${etiquetaCodigo}/origenClienteCodigo`] = codigoCliente;
          etiquetasUpdates[`productos/${etiquetaCodigo}/origenProductoCodigo`] = codigoProducto;
          etiquetasUpdates[`productos/${etiquetaCodigo}/createdAt`] = new Date().toISOString();
          etiquetasUpdates[`productos/${etiquetaCodigo}/createdByUid`] = authUser?.uid || null;
          etiquetasUpdates[`productos/${etiquetaCodigo}/createdByEmail`] = authUser?.email || null;
          etiquetasCreadas += 1;
        }

        if (Object.keys(etiquetasUpdates).length > 0) {
          await update(ref(realtimeDb, `ETIQUETAS/CLIENTES/${codigoCliente}`), {
            codigoCliente,
            cliente,
            ...etiquetasUpdates,
          });
        }

        setMessage(
          Object.keys(productosPayload).length > 0
            ? `Cliente creado correctamente con productos y detalle${etiquetasCreadas > 0 ? `, y ${etiquetasCreadas} etiqueta(s) en inventario.` : "."}`
            : "Cliente creado correctamente.",
        );
      }

      resetForm();
      await reloadClients();
    } catch (err: any) {
      setError(`No fue posible guardar el cliente. ${err?.message || ""}`);
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
    return (
      <NoPermission
        title="Usuario inactivo"
        message="Tu usuario está desactivado. Contacta al administrador."
      />
    );
  }

  if (!can("clientes", "ver")) {
    return (
      <NoPermission
        title="Sin permiso"
        message="Tu rol no tiene permiso para ver clientes."
      />
    );
  }

  const canModifyForm = editingClient
    ? can("clientes", "editar")
    : can("clientes", "crear");

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <AppSidebar
        userName={userName}
        userEmail={authUser?.email}
        roleName={profile?.rolNombre}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        can={can}
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
            <span className="font-black text-slate-900">Clientes</span>
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

      <section className="max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-7 py-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">Gestión de clientes</p>
            <h2 className="text-2xl font-black text-slate-900 mt-1">Listado y productos</h2>
            <p className="text-sm text-slate-500 mt-1">El formulario de creación y edición se abre en modal para no tapar el listado.</p>
          </div>

          {can("clientes", "crear") && (
            <button
              type="button"
              onClick={handleOpenCreateClient}
              className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20 w-full sm:w-fit"
            >
              <Plus size={20} />
              Crear cliente
            </button>
          )}
        </div>

        {clientModalOpen && (
          <div className="fixed inset-0 z-[70] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
            <form
              onSubmit={handleSubmit}
              className="w-full max-w-[1180px] max-h-[92vh] overflow-y-auto bg-white rounded-[28px] shadow-2xl border border-slate-200"
            >
          <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div>
              <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                {editingClient ? "Editando cliente" : "Nuevo cliente"}
              </p>
              <h2 className="text-2xl font-black mt-1">
                {editingClient
                  ? "Actualizar cliente"
                  : "Crear cliente"}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {editingClient
                  ? "Edita los datos del cliente y, si hace falta, agrega productos, detalle y etiqueta desde este mismo modal."
                  : "Flujo guiado: datos del cliente, productos, detalles/insumos y etiquetas. Todo se guarda al final."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
              {!editingClient && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition whitespace-nowrap flex items-center justify-center gap-2"
                >
                  <X size={17} />
                  Cerrar
                </button>
              )}

              <div className="rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm font-black text-lime-800 whitespace-nowrap text-center">
                No consecutivo: {form.no || getNextNo()}
              </div>

              {editingClient && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition whitespace-nowrap flex items-center justify-center gap-2"
                >
                  <X size={17} />
                  Cancelar
                </button>
              )}

              {/* El guardado final queda en el nivel 4 · Etiquetas. */}
            </div>
          </div>

          <div className="px-5 sm:px-6 pt-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { step: 1 as const, label: "Datos del cliente", color: "sky" },
                { step: 2 as const, label: "Productos del cliente", color: "indigo" },
                { step: 3 as const, label: "Detalle / insumos", color: "amber" },
                { step: 4 as const, label: "Inventario etiquetas", color: "emerald" },
              ].map((item) => {
                const enabled = item.step <= clientModalMaxStep;
                const active = clientModalStep === item.step;
                const colorClass =
                  item.color === "sky"
                    ? active
                      ? "border-sky-300 bg-sky-100 text-sky-700 shadow-sm"
                      : enabled
                        ? "border-sky-200 bg-sky-50/70 text-sky-700 hover:bg-sky-100"
                        : "border-slate-200 bg-slate-50 text-slate-400"
                    : item.color === "indigo"
                      ? active
                        ? "border-indigo-300 bg-indigo-100 text-indigo-700 shadow-sm"
                        : enabled
                          ? "border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100"
                          : "border-slate-200 bg-slate-50 text-slate-400"
                      : item.color === "amber"
                        ? active
                          ? "border-amber-300 bg-amber-100 text-amber-700 shadow-sm"
                          : enabled
                            ? "border-amber-200 bg-amber-50/70 text-amber-700 hover:bg-amber-100"
                            : "border-slate-200 bg-slate-50 text-slate-400"
                        : active
                          ? "border-emerald-300 bg-emerald-100 text-emerald-700 shadow-sm"
                          : enabled
                            ? "border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100"
                            : "border-slate-200 bg-slate-50 text-slate-400";

                return (
                  <button
                    key={item.step}
                    type="button"
                    disabled={!enabled}
                    onClick={() => setClientModalStep(item.step)}
                    className={`text-left rounded-2xl border px-4 py-3 transition disabled:cursor-not-allowed ${colorClass}`}
                  >
                    <p className="text-[11px] font-black uppercase tracking-wide">Nivel {item.step}</p>
                    <p className="text-sm font-black text-slate-900">{item.label}</p>
                    <p className="text-[11px] font-bold mt-1">
                      {enabled ? "Disponible para revisar o corregir" : "Continúa el nivel anterior"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {(error || message) && (
            <div className="px-5 sm:px-6 pt-5">
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

          {clientModalStep === 1 && (
          <section className="mx-5 sm:mx-6 mt-5 rounded-[24px] border border-sky-200 bg-sky-50/70 overflow-hidden">
            <div className="px-5 py-4 border-b border-sky-200 bg-sky-100/70">
              <p className="text-xs font-black uppercase tracking-wide text-sky-700">Nivel 1 · Cliente</p>
              <h3 className="text-lg font-black text-slate-900 mt-1">Datos principales del cliente</h3>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                No
              </label>
              <input
                type="number"
                value={form.no}
                disabled={!canModifyForm}
                onChange={(e) => handleChange("no", e.target.value)}
                placeholder="Consecutivo automático"
                className="w-full rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 font-black text-lime-900 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Código cliente
              </label>
              <input
                type="text"
                value={form.codigo_cliente}
                disabled={!canModifyForm}
                onChange={(e) => handleChange("codigo_cliente", e.target.value)}
                placeholder="Digite código del cliente. Ej: ACF"
                className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Cliente
              </label>
              <input
                type="text"
                value={form.cliente}
                disabled={!canModifyForm}
                onChange={(e) => handleChange("cliente", e.target.value)}
                placeholder="Ingrese nombre del cliente"
                className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Observaciones
              </label>
              <input
                type="text"
                value={form.observaciones}
                disabled={!canModifyForm}
                onChange={(e) => handleChange("observaciones", e.target.value)}
                placeholder="Ingrese observaciones si aplica"
                className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
            </div>
            <div className="px-5 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs font-bold text-slate-500">
                Nivel 1 listo: continúa a productos del cliente. El guardado final será en el nivel 4.
              </p>
              <button
                type="button"
                onClick={goToProductStep}
                disabled={!canModifyForm}
                className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-60 text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20"
              >
                Continuar a productos del cliente
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
          )}

          {clientModalStep >= 2 && ((!editingClient && can("clientes", "crear")) || (editingClient && can("clientes", "editar"))) && (
            <div className="px-5 sm:px-6 pb-6">
              <div className="rounded-[24px] border border-indigo-200 bg-indigo-50/60 overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-indigo-200 bg-indigo-100/70 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">
                      {clientModalStep === 2
                        ? "Nivel 2 · Productos del cliente"
                        : clientModalStep === 3
                          ? "Nivel 3 · Detalle / insumos"
                          : "Nivel 4 · Inventario etiquetas"}
                    </p>
                    <h3 className="text-xl font-black text-slate-900 mt-1">
                      {clientModalStep === 2
                        ? "Productos del cliente"
                        : clientModalStep === 3
                          ? "Detalles e insumos por producto"
                          : "Etiquetas por producto"}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {clientModalStep === 2
                        ? "Aquí solo registras los datos del producto. La etiqueta no aparece aquí; se crea en el nivel 4."
                        : clientModalStep === 3
                          ? "Aparecen los productos creados. En cada uno selecciona primero proveedor; luego se carga envase/producto del proveedor."
                          : "Último nivel: aquí creas la etiqueta independiente para cada producto y guardas todo al final."}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <button
                      type="button"
                      onClick={() => setClientModalStep(1)}
                      className="rounded-2xl bg-white border border-slate-300 px-4 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition w-full sm:w-fit flex items-center justify-center gap-2"
                    >
                      <ChevronRight size={18} className="rotate-180" />
                      Volver nivel 1
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateProducts((current) => !current);
                        if (!showCreateProducts && openNewProductIndex === null) {
                          setOpenNewProductIndex(0);
                        }
                      }}
                      className="rounded-2xl bg-white border border-[#244C5A] px-4 py-3 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition w-full sm:w-fit flex items-center justify-center gap-2"
                    >
                      {showCreateProducts ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      {showCreateProducts ? "Ocultar productos" : "Abrir productos"}
                    </button>

                    {clientModalStep === 2 && showCreateProducts && (
                      <button
                        type="button"
                        onClick={addNewProduct}
                        className="rounded-2xl bg-[#244C5A] border border-[#244C5A] px-4 py-3 text-sm font-black text-white hover:bg-[#1b3b46] transition w-full sm:w-fit flex items-center justify-center gap-2"
                      >
                        <Plus size={18} />
                        Agregar producto
                      </button>
                    )}
                  </div>
                </div>

                {!showCreateProducts ? (
                  <div className="p-5">
                    <div className="rounded-2xl border border-dashed border-[#244C5A]/30 bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          Productos cerrados por defecto
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Primero diligencia o confirma los datos del cliente. Luego abre esta sección para agregar solo datos del producto. El detalle va en nivel 3 y la etiqueta en nivel 4.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateProducts(true);
                          setOpenNewProductIndex(0);
                        }}
                        className="rounded-2xl bg-[#244C5A] px-4 py-3 text-sm font-black text-white hover:bg-[#1b3b46] transition w-full sm:w-fit flex items-center justify-center gap-2"
                      >
                        <ChevronRight size={18} />
                        Abrir productos
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 space-y-5">
                  {newProducts.map((product, productIndex) => (
                    <div
                      key={`new-product-${productIndex}`}
                      className="rounded-[22px] bg-white border-2 border-indigo-200 overflow-hidden shadow-sm"
                    >
                      <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">
                            Producto #{productIndex + 1}
                          </p>
                          <h4 className="font-black text-slate-900 mt-1">
                            {editingClient && (product.codigoProducto || product.producto) ? "Producto existente" : "DATOS_PRODUCTO"}
                          </h4>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => toggleNewProduct(productIndex)}
                            className="rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition w-full sm:w-fit flex items-center justify-center gap-2"
                          >
                            {openNewProductIndex === productIndex ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                            {openNewProductIndex === productIndex ? "Cerrar" : "Abrir producto"}
                          </button>

                          {newProducts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeNewProduct(productIndex)}
                              className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 hover:bg-red-50 transition w-full sm:w-fit flex items-center justify-center gap-2"
                            >
                              <Trash2 size={16} />
                              Quitar
                            </button>
                          )}
                        </div>
                      </div>

                      {openNewProductIndex === productIndex ? (
                        <>
                      {clientModalStep === 2 && (
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Código producto
                          </label>
                          <div className="flex rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden focus-within:border-[#244C5A] focus-within:ring-2 focus-within:ring-[#244C5A]/20">
                            <span className="px-4 py-3 bg-lime-50 border-r border-lime-200 text-lime-800 font-black whitespace-nowrap">
                              {cleanKey(normalizeText(form.codigo_cliente)) || "COD"}-
                            </span>
                            <input
                              type="text"
                              value={(() => {
                                const prefix = `${cleanKey(normalizeText(form.codigo_cliente))}-`;
                                return product.codigoProducto.startsWith(prefix)
                                  ? product.codigoProducto.slice(prefix.length)
                                  : product.codigoProducto;
                              })()}
                              disabled={!canModifyForm}
                              onChange={(e) => {
                                const prefix = cleanKey(normalizeText(form.codigo_cliente));
                                const suffix = cleanKey(e.target.value);
                                handleNewProductChange(
                                  productIndex,
                                  "codigoProducto",
                                  prefix ? `${prefix}-${suffix}` : suffix,
                                );
                              }}
                              placeholder="Digite consecutivo. Ej: 001"
                              className="w-full bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 disabled:opacity-70 disabled:cursor-not-allowed"
                            />
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Se arma con el código del cliente + guion + el consecutivo que digites.
                          </p>
                        </div>

                        <div className="xl:col-span-2">
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Producto
                          </label>
                          <input
                            type="text"
                            value={product.producto}
                            disabled={!canModifyForm}
                            onChange={(e) =>
                              handleNewProductChange(productIndex, "producto", e.target.value)
                            }
                            placeholder="Ingrese nombre del producto"
                            className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">
                            Precio
                          </label>
                          <input
                            type="text"
                            value={product.precio}
                            disabled={!canModifyForm}
                            onChange={(e) =>
                              handleNewProductChange(productIndex, "precio", e.target.value)
                            }
                            placeholder="Digite precio. Ej: 0"
                            className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      )}

                      {clientModalStep === 2 && (
                      <div className="px-5 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-xs font-bold text-slate-500">
                          Puedes agregar varios productos. Al continuar, verás la lista para asignar detalle e insumos a cada producto.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setClientModalStep(3);
                            setClientModalMaxStep((current) => (current > 3 ? current : 3));
                            setOpenNewDetailsByProduct((current) => ({
                              ...current,
                              [productIndex]: true,
                            }));
                          }}
                          disabled={!canModifyForm || !product.codigoProducto || !product.producto}
                          className="rounded-2xl bg-indigo-700 hover:bg-indigo-800 disabled:opacity-60 text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-indigo-700/20"
                        >
                          Continuar a detalles e insumos
                          <ChevronRight size={18} />
                        </button>
                      </div>
                      )}





                      {clientModalStep === 3 && (
                      <div className="px-5 pb-5">
                        <div className="rounded-[20px] border-2 border-amber-200 bg-amber-50/50 overflow-hidden shadow-sm">
                          <div className="px-4 py-3 bg-amber-100/70 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">
                                Nivel 3 · Detalle / insumos
                              </p>
                              <h5 className="font-black text-slate-900">
                                DETALLE_PRODUCTO
                              </h5>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => toggleNewProductDetails(productIndex)}
                                className="rounded-2xl bg-white border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition w-full sm:w-fit flex items-center justify-center gap-2"
                              >
                                {openNewDetailsByProduct[productIndex] ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                                {openNewDetailsByProduct[productIndex] ? "Ocultar detalle" : "Abrir detalle"}
                              </button>

                              {openNewDetailsByProduct[productIndex] && (
                                <button
                                  type="button"
                                  onClick={() => addNewProductDetail(productIndex)}
                                  className="rounded-2xl bg-white border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition w-full sm:w-fit flex items-center justify-center gap-2"
                                >
                                  <Plus size={16} />
                                  Agregar detalle
                                </button>
                              )}

                              {openNewDetailsByProduct[productIndex] && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setClientModalStep(4);
                                    setClientModalMaxStep(4);
                                  }}
                                  className="rounded-2xl bg-amber-600 border border-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700 transition w-full sm:w-fit flex items-center justify-center gap-2"
                                >
                                  Continuar a etiquetas
                                  <ChevronRight size={16} />
                                </button>
                              )}
                            </div>
                          </div>

                          {!openNewDetailsByProduct[productIndex] ? (
                            <div className="p-4 bg-white text-sm text-slate-500">
                              Nivel 3 · Detalle / insumos cerrada. Ábrela solo cuando vayas a agregar envases, proveedor y producto del proveedor.
                            </div>
                          ) : (
                          <div className="p-4 space-y-4">
                            {product.detalles.map((detail, detailIndex) => (
                              <div
                                key={`new-detail-${productIndex}-${detailIndex}`}
                                className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
                              >
                                <div className="flex items-center justify-between gap-3 mb-4">
                                  <p className="font-black text-slate-800">
                                    Detalle #{detailIndex + 1}
                                  </p>

                                  {product.detalles.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeNewProductDetail(productIndex, detailIndex)
                                      }
                                      className="rounded-xl border border-red-200 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50 transition flex items-center gap-2"
                                    >
                                      <Trash2 size={14} />
                                      Quitar
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                  <div className="md:col-span-2 rounded-3xl border-2 border-[#244C5A]/30 bg-[#244C5A]/5 p-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                                      <div>
                                        <label className="block text-sm font-black text-[#244C5A] mb-1 uppercase tracking-wide">
                                          Código proveedor / desplegable desde PROVEEDORES
                                        </label>
                                        <p className="text-xs font-semibold text-slate-500">
                                          Proveedores cargados: {providers.length}. Al seleccionar uno se llena el proveedor y luego en Descripción se listan sus PRODUCTOS.
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={reloadProviders}
                                        disabled={loadingProviders}
                                        className="rounded-2xl border border-[#244C5A] bg-white px-4 py-2 text-xs font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition disabled:opacity-60 w-fit"
                                      >
                                        {loadingProviders ? "Cargando..." : "Recargar proveedores"}
                                      </button>
                                    </div>

                                    <select
                                      value={detail.codigoProveedor}
                                      disabled={!canModifyForm || loadingProviders}
                                      onFocus={() => {
                                        if (providers.length === 0 && !loadingProviders) {
                                          reloadProviders();
                                        }
                                      }}
                                      onChange={(e) =>
                                        handleProviderSelect(
                                          productIndex,
                                          detailIndex,
                                          e.target.value,
                                        )
                                      }
                                      className="w-full rounded-2xl border-2 border-[#244C5A]/40 bg-white px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed font-bold text-slate-800"
                                    >
                                      <option value="">
                                        {loadingProviders
                                          ? "Cargando proveedores..."
                                          : providers.length === 0
                                            ? "No hay proveedores cargados - revisa nodo PROVEEDORES"
                                            : `Seleccione un código proveedor (${providers.length})`}
                                      </option>
                                      {providers.map((provider) => (
                                        <option
                                          key={provider.id}
                                          value={provider.codigoProveedor}
                                        >
                                          {provider.codigoProveedor} - {provider.proveedor}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                      Código envase
                                    </label>
                                    <input
                                      type="text"
                                      value={detail.codigoEnvase}
                                      disabled={!canModifyForm || !detail.codigoProveedor}
                                      onChange={(e) =>
                                        handleNewDetailChange(
                                          productIndex,
                                          detailIndex,
                                          "codigoEnvase",
                                          e.target.value,
                                        )
                                      }
                                      placeholder={detail.codigoProveedor ? "Digite código envase. Ej: ENV-001" : "Primero seleccione código proveedor"}
                                      className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                      Descripción / producto del proveedor
                                    </label>
                                    <select
                                      value={detail.descripcion}
                                      disabled={!canModifyForm || !detail.codigoProveedor}
                                      onChange={(e) => {
                                        const selectedProduct = providersByCode[
                                          detail.codigoProveedor
                                        ]?.productos.find(
                                          (item) => item.producto === e.target.value,
                                        );

                                        handleProviderProductSelect(
                                          productIndex,
                                          detailIndex,
                                          selectedProduct?.codigo || "",
                                        );
                                      }}
                                      className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                      <option value="">
                                        {!detail.codigoProveedor
                                          ? "Primero selecciona código proveedor"
                                          : (providersByCode[detail.codigoProveedor]?.productos || []).length === 0
                                            ? "Este proveedor no tiene PRODUCTOS"
                                            : "Seleccione producto"}
                                      </option>
                                      {(providersByCode[detail.codigoProveedor]?.productos || []).map(
                                        (providerProduct) => (
                                          <option
                                            key={providerProduct.codigo}
                                            value={providerProduct.producto}
                                          >
                                            {providerProduct.codigo} - {providerProduct.producto}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                      Tipo de empaque
                                    </label>
                                    <input
                                      type="text"
                                      list="tipo-empaque-options"
                                      value={detail.tipoDeEmpaque}
                                      disabled={!canModifyForm}
                                      onChange={(e) =>
                                        handleNewDetailChange(
                                          productIndex,
                                          detailIndex,
                                          "tipoDeEmpaque",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="Digite o seleccione tipo de empaque"
                                      className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                                    />
                                    <datalist id="tipo-empaque-options">
                                      {packagingTypeOptions.map((option) => (
                                        <option key={option} value={option} />
                                      ))}
                                    </datalist>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                      Unidad de empaque automática
                                    </label>
                                    <input
                                      type="text"
                                      value={detail.unidadDeEmpaque}
                                      disabled
                                      placeholder="Se carga desde PRODUCTOS del proveedor"
                                      className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600 outline-none cursor-not-allowed"
                                    />
                                  </div>



                                  {[
                                    ["proveedor", "Proveedor automático"],
                                  ].map(([field, label]) => (
                                    <div key={`${productIndex}-${detailIndex}-${field}`}>
                                      <label className="block text-sm font-bold text-slate-700 mb-2">
                                        {label}
                                      </label>
                                      <input
                                        type="text"
                                        value={detail[field as keyof NewProductDetailForm]}
                                        disabled
                                        placeholder="Se carga desde PROVEEDORES"
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600 outline-none cursor-not-allowed"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          )}
                        </div>
                      </div>
                      )}

                      {clientModalStep === 4 && (
                      <div className="px-5 pb-5">
                        <div className="rounded-[22px] border-2 border-emerald-200 bg-emerald-50/70 overflow-hidden shadow-sm">
                          <div className="px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                                Etiqueta · Inventario de etiquetas
                              </p>
                              <h5 className="font-black text-slate-900">
                                Crear etiqueta para inventario
                              </h5>
                              <p className="text-xs text-slate-500 mt-1">
                                Si activas esta opción, al guardar el cliente también se creará la referencia en ETIQUETAS / CLIENTES.
                              </p>
                            </div>
                            {(can("inventarioEtiquetas", "crear") || can("inventarioEtiquetas", "editar")) ? (
                              <button
                                type="button"
                                onClick={() => toggleNewProductEtiqueta(productIndex)}
                                className={`rounded-2xl px-4 py-2 text-sm font-black transition flex items-center justify-center gap-2 ${
                                  product.crearEtiqueta
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                                }`}
                              >
                                <Tag size={16} />
                                {product.crearEtiqueta ? "Etiqueta activada" : "Crear etiqueta"}
                              </button>
                            ) : (
                              <span className="rounded-2xl bg-white border border-slate-200 px-4 py-2 text-xs font-black text-slate-400">
                                Sin permiso para etiquetas
                              </span>
                            )}
                          </div>

                          {product.crearEtiqueta && (
                            <div className="border-t border-emerald-200 bg-emerald-50/30 p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Código etiqueta</label>
                                <input
                                  type="text"
                                  value={buildEtiquetaCodigo(product.codigoProducto)}
                                  disabled={!canModifyForm}
                                  readOnly
                                  placeholder="Se genera automático: E-CODIGO-PRODUCTO"
                                  className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                                />
                              </div>
                              <div className="xl:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Producto etiqueta</label>
                                <input
                                  type="text"
                                  value={product.etiqueta?.producto || normalizeText(product.producto).trim().toUpperCase()}
                                  disabled={!canModifyForm}
                                  onChange={(event) => handleNewProductEtiquetaChange(productIndex, "producto", event.target.value)}
                                  placeholder="Ingrese nombre para la etiqueta"
                                  className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Mockup producto</label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={!canModifyForm}
                                  onChange={(event) => handleNewProductEtiquetaFileChange(productIndex, event.target.files?.[0] || null)}
                                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-[#244C5A] file:px-3 file:py-2 file:text-white file:font-bold disabled:opacity-70"
                                />
                                {newProductEtiquetaFiles[productIndex]?.name && (
                                  <p className="text-[11px] text-emerald-700 font-bold mt-1 truncate">
                                    {newProductEtiquetaFiles[productIndex]?.name}
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Tipo etiqueta</label>
                                <select
                                  value={product.etiqueta?.tipoEtiqueta || ""}
                                  disabled={!canModifyForm}
                                  onChange={(event) => handleNewProductEtiquetaChange(productIndex, "tipoEtiqueta", event.target.value)}
                                  className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70"
                                >
                                  <option value="">Selecciona</option>
                                  {tipoEtiquetaOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Material</label>
                                <select
                                  value={product.etiqueta?.materialEtiqueta || ""}
                                  disabled={!canModifyForm}
                                  onChange={(event) => handleNewProductEtiquetaChange(productIndex, "materialEtiqueta", event.target.value)}
                                  className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70"
                                >
                                  <option value="">Selecciona</option>
                                  {materialEtiquetaOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Base impresión</label>
                                <select
                                  value={product.etiqueta?.baseImpresion || ""}
                                  disabled={!canModifyForm}
                                  onChange={(event) => handleNewProductEtiquetaChange(productIndex, "baseImpresion", event.target.value)}
                                  className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70"
                                >
                                  <option value="">Selecciona</option>
                                  {baseImpresionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Acabados</label>
                                <select
                                  value={product.etiqueta?.acabados || ""}
                                  disabled={!canModifyForm}
                                  onChange={(event) => handleNewProductEtiquetaChange(productIndex, "acabados", event.target.value)}
                                  className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70"
                                >
                                  <option value="">Selecciona</option>
                                  {acabadosEtiquetaOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      )}
                        </>
                      ) : (
                        <div className="px-5 py-4 bg-slate-50 text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span>
                            {product.codigoProducto || "Sin código"} · {product.producto || "Sin nombre de producto"}
                          </span>
                          <span className="font-black text-[#244C5A]">
                            {product.detalles.length} detalle(s)
                          </span>
                        </div>
                      )}
                    </div>
                  ))}

                  {clientModalStep === 4 && (
                    <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/80 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-emerald-800">Nivel 4 listo</p>
                        <p className="text-xs font-bold text-slate-500 mt-1">Revisa las etiquetas por producto. Al guardar se crearán el cliente, sus productos, detalles/insumos y etiquetas configuradas.</p>
                      </div>
                      {canModifyForm && (
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 whitespace-nowrap"
                        >
                          {saving ? (
                            <Loader2 className="animate-spin" size={20} />
                          ) : (
                            <Save size={20} />
                          )}
                          {saving ? "Guardando..." : "Guardar cliente y productos"}
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                )}
              </div>
            </div>
          )}
            </form>
          </div>
        )}

        <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                Nodo CLIENTES
              </p>
              <h2 className="text-2xl font-black mt-1">Lista de clientes</h2>
              <p className="text-slate-500 text-sm mt-1">
                Ordenados por No de menor a mayor.
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
                  placeholder="Buscar No, código, cliente..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                />
              </div>

              <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center">
                {filteredClients.length} clientes
              </div>
            </div>
          </div>

          {loadingClients ? (
            <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
              <Loader2 className="animate-spin" size={22} />
              Cargando clientes...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="mx-auto text-[#244C5A]" size={44} />
              <h3 className="font-black text-slate-900 mt-4">
                No hay clientes para mostrar
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                Crea un cliente o cambia el texto de búsqueda.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      No
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Código cliente
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Cliente
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Observaciones
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredClients.map((item, index) => (
                    <Fragment key={item.id}>
                      <tr
                        onClick={() => handleToggleProducts(item)}
                        className={`border-b border-slate-100 last:border-b-0 transition cursor-pointer ${index % 2 === 1 ? "bg-lime-50/45 hover:bg-lime-100/55" : "bg-white hover:bg-slate-50"}`}
                        title="Clic para ver productos del cliente"
                      >
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center justify-center min-w-10 rounded-full bg-[#244C5A]/10 text-[#244C5A] px-3 py-1 text-xs font-black">
                            {item.no || "—"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black transition ${
                              expandedClientId === item.id
                                ? "bg-[#244C5A] text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {expandedClientId === item.id ? (
                              <ChevronDown size={15} />
                            ) : (
                              <ChevronRight size={15} />
                            )}
                            {item.codigoCliente}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-black text-slate-900 inline-flex items-center gap-2">
                            <Building2 size={18} className="text-[#244C5A]" />
                            {item.cliente}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700 max-w-[420px]">
                          <span className="line-clamp-2">
                            {item.observaciones || "—"}
                          </span>
                        </td>

                        <td className="px-5 py-4" onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {can("clientes", "editar") ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(item)}
                                  className="rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white flex items-center gap-2 transition"
                                >
                                  <Edit3 size={17} />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClient(item)}
                                  disabled={saving}
                                  className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 hover:bg-red-50 flex items-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                  title="Eliminar cliente y todos sus productos"
                                >
                                  <Trash2 size={17} />
                                  Eliminar
                                </button>
                              </>
                            ) : (
                              <span className="text-sm text-slate-400 font-semibold">
                                Solo lectura
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {expandedClientId === item.id && (
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <td colSpan={5} className="px-5 py-5">
                            <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden">
                              <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">
                                    Segunda capa / CLIENTES / PRODUCTOS
                                  </p>
                                  <h3 className="text-lg font-black text-slate-900 mt-1">
                                    Productos de {item.codigoCliente}
                                  </h3>
                                </div>

                                <div className="inline-flex items-center gap-2 rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-2 text-sm font-black w-fit">
                                  <Package size={17} />
                                  {
                                    (productsByClient[item.id] || []).length
                                  }{" "}
                                  productos
                                </div>
                              </div>

                              {loadingProductsByClient[item.id] ? (
                                <div className="p-6 flex items-center justify-center gap-3 text-slate-500 font-semibold">
                                  <Loader2 className="animate-spin" size={20} />
                                  Cargando productos...
                                </div>
                              ) : (productsByClient[item.id] || []).length ===
                                0 ? (
                                <div className="p-6 text-center text-sm text-slate-500 font-semibold">
                                  No hay productos guardados en este cliente.
                                </div>
                              ) : (
                                <>
                                  <div className="overflow-x-auto">
                                  <table className="w-full min-w-[980px] border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                                          Código producto
                                        </th>
                                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                                          Producto
                                        </th>
                                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                                          Etiqueta
                                        </th>
                                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                                          Precio
                                        </th>
                                      </tr>
                                    </thead>

                                    <tbody>
                                      {(productsByClient[item.id] || []).map(
                                        (product) => {
                                          const detailKey = getProductDetailKey(
                                            item,
                                            product,
                                          );
                                          const isProductDetailOpen =
                                            selectedProductKey === detailKey;
                                          const productDetails =
                                            productDetailsByKey[detailKey] || [];

                                          return (
                                            <Fragment key={product.id}>
                                              <tr className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="px-5 py-4">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      handleToggleProductDetail(
                                                        item,
                                                        product,
                                                      )
                                                    }
                                                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black transition ${
                                                      isProductDetailOpen
                                                        ? "bg-[#244C5A] text-white"
                                                        : "bg-[#244C5A]/10 text-[#244C5A] hover:bg-[#244C5A] hover:text-white"
                                                    }`}
                                                    title="Ver detalle del producto"
                                                  >
                                                    {isProductDetailOpen ? (
                                                      <ChevronDown size={15} />
                                                    ) : (
                                                      <ChevronRight size={15} />
                                                    )}
                                                    {product.codigoProducto || "—"}
                                                  </button>
                                                </td>

                                                <td className="px-5 py-4 text-sm font-bold text-slate-800">
                                                  {product.producto || "—"}
                                                </td>

                                                <td className="px-5 py-4">
                                                  <div className="flex flex-col gap-2">
                                                    {product.etiquetaCreada ? (
                                                      <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-black">
                                                        <CheckCircle2 size={15} />
                                                        Ya tiene etiqueta{product.etiquetaCodigoCreada ? `: ${product.etiquetaCodigoCreada}` : ""}
                                                      </span>
                                                    ) : (
                                                      <>
                                                        <span className="inline-flex w-fit items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-xs font-black">
                                                          Sin etiqueta creada
                                                        </span>
                                                        {(can("inventarioEtiquetas", "crear") || can("inventarioEtiquetas", "editar")) && (
                                                          <button
                                                            type="button"
                                                            onClick={() => handleOpenCreateEtiqueta(item, product)}
                                                            disabled={savingEtiqueta}
                                                            className="inline-flex w-fit items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-600 hover:text-white transition disabled:opacity-60"
                                                            title="Crear etiqueta en inventario"
                                                          >
                                                            <Tag size={15} />
                                                            Crear etiqueta
                                                          </button>
                                                        )}
                                                      </>
                                                    )}
                                                  </div>
                                                </td>

                                                <td className="px-5 py-4 text-sm font-black text-slate-800">
                                                  {product.precio || "—"}
                                                </td>

                                              </tr>

                                              {isProductDetailOpen && (
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                  <td colSpan={4} className="px-5 py-5">
                                                    <div className="rounded-[22px] bg-white border-2 border-indigo-200 overflow-hidden shadow-sm">
                                                      <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                        <div>
                                                          <p className="text-xs font-black uppercase tracking-wide text-[#244C5A] flex items-center gap-2">
                                                            <Info size={15} />
                                                            Nivel 3 · Detalle / insumos / DETALLE_PRODUCTO / PROVEEDORES ACTIVO
                                                          </p>
                                                          <h4 className="text-lg font-black text-slate-900 mt-1">
                                                            Detalle de {product.codigoProducto || "producto"}
                                                          </h4>
                                                        </div>

                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            setSelectedProductKey(null)
                                                          }
                                                          className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition w-fit"
                                                        >
                                                          Cerrar detalle
                                                        </button>
                                                      </div>

                                                      {loadingDetailsByKey[detailKey] ? (
                                                        <div className="flex items-center justify-center gap-3 text-slate-500 font-semibold py-8">
                                                          <Loader2
                                                            className="animate-spin"
                                                            size={20}
                                                          />
                                                          Cargando detalle del producto...
                                                        </div>
                                                      ) : productDetails.length === 0 ? (
                                                        <div className="p-6 text-center text-sm text-slate-500 font-semibold">
                                                          Este producto no tiene DETALLE_PRODUCTO guardado.
                                                        </div>
                                                      ) : (
                                                        <div className="overflow-x-auto">
                                                          <table className="w-full min-w-[900px] border-collapse">
                                                            <thead>
                                                              <tr className="bg-slate-50 border-b border-slate-200">
                                                                <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                                                                  Código envase
                                                                </th>
                                                                <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                                                                  Descripción
                                                                </th>
                                                                <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                                                                  Tipo empaque
                                                                </th>
                                                                <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                                                                  Unidad empaque
                                                                </th>
                                                                <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                                                                  Proveedor
                                                                </th>
                                                                <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                                                                  Código proveedor
                                                                </th>
                                                              </tr>
                                                            </thead>

                                                            <tbody>
                                                              {productDetails.map((detail) => (
                                                                <tr
                                                                  key={detail.id}
                                                                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                                                                >
                                                                  <td className="px-5 py-4">
                                                                    <span className="inline-flex items-center rounded-full bg-[#244C5A]/10 text-[#244C5A] px-3 py-1 text-xs font-black">
                                                                      {detail.codigoEnvase || "—"}
                                                                    </span>
                                                                  </td>
                                                                  <td className="px-5 py-4 text-sm font-bold text-slate-800 max-w-[340px]">
                                                                    {detail.descripcion || "—"}
                                                                  </td>
                                                                  <td className="px-5 py-4 text-sm text-slate-700">
                                                                    {detail.tipoDeEmpaque || "—"}
                                                                  </td>
                                                                  <td className="px-5 py-4 text-sm text-slate-700">
                                                                    {detail.unidadDeEmpaque || "—"}
                                                                  </td>
                                                                  <td className="px-5 py-4 text-sm font-bold text-slate-800">
                                                                    {detail.proveedor || "—"}
                                                                  </td>
                                                                  <td className="px-5 py-4 text-sm text-slate-700">
                                                                    {detail.codigoProveedor || "—"}
                                                                  </td>
                                                                </tr>
                                                              ))}
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
                                        },
                                      )}
                                    </tbody>
                                  </table>
                                  </div>                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {etiquetaModal && (
          <div className="fixed inset-0 z-[90] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
            <form
              onSubmit={handleSaveEtiqueta}
              className="w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white rounded-[28px] shadow-2xl border border-slate-200"
            >
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    Crear etiqueta
                  </p>
                  <h2 className="text-2xl font-black mt-1">
                    Inventario de etiquetas
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Se guardará en ETIQUETAS / CLIENTES / {cleanKey(etiquetaModal.client.codigoCliente)} / productos para que aparezca en inventario de etiquetas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCloseEtiquetaModal}
                  className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0"
                  aria-label="Cerrar"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                <div className="rounded-3xl bg-[#244C5A]/5 border border-[#244C5A]/10 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">Cliente</p>
                    <p className="text-sm font-black text-slate-900 mt-1">{etiquetaModal.client.codigoCliente}</p>
                    <p className="text-xs text-slate-500">{etiquetaModal.client.cliente}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">Producto origen</p>
                    <p className="text-sm font-black text-slate-900 mt-1">{etiquetaModal.product.codigoProducto}</p>
                    <p className="text-xs text-slate-500">{etiquetaModal.product.producto}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">Código etiqueta actual</p>
                    <p className="text-sm font-black text-slate-900 mt-1">{buildEtiquetaCodigo(etiquetaModal.product.codigoProducto)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Código
                    </label>
                    <input
                      type="text"
                      value={buildEtiquetaCodigo(etiquetaModal.product.codigoProducto)}
                      readOnly
                      placeholder="Se genera automático: E-CODIGO-PRODUCTO"
                      className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>

                  <div className="md:col-span-1 xl:col-span-3">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Producto
                    </label>
                    <input
                      type="text"
                      value={etiquetaForm.producto}
                      onChange={(event) => handleEtiquetaFormChange("producto", event.target.value)}
                      placeholder="Nombre del producto"
                      className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Tipo etiqueta
                    </label>
                    <select
                      value={etiquetaForm.tipoEtiqueta}
                      onChange={(event) => handleEtiquetaFormChange("tipoEtiqueta", event.target.value)}
                      className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    >
                      <option value="">Selecciona</option>
                      {tipoEtiquetaOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Material etiqueta
                    </label>
                    <select
                      value={etiquetaForm.materialEtiqueta}
                      onChange={(event) => handleEtiquetaFormChange("materialEtiqueta", event.target.value)}
                      className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    >
                      <option value="">Selecciona</option>
                      {materialEtiquetaOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Base de impresión
                    </label>
                    <select
                      value={etiquetaForm.baseImpresion}
                      onChange={(event) => handleEtiquetaFormChange("baseImpresion", event.target.value)}
                      className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    >
                      <option value="">Selecciona</option>
                      {baseImpresionOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Acabados
                    </label>
                    <select
                      value={etiquetaForm.acabados}
                      onChange={(event) => handleEtiquetaFormChange("acabados", event.target.value)}
                      className="w-full rounded-2xl border border-lime-200 bg-lime-50/70 px-4 py-3 outline-none placeholder:text-lime-700/70 focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    >
                      <option value="">Selecciona</option>
                      {acabadosEtiquetaOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 p-4">
                  <label className="block text-sm font-bold text-slate-700 mb-3">
                    Mockup de producto
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-24 h-24 rounded-3xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
                      {mockupProductoEtiquetaFile ? (
                        <img
                          src={URL.createObjectURL(mockupProductoEtiquetaFile)}
                          alt="Vista previa mockup producto"
                          className="w-full h-full object-contain"
                        />
                      ) : etiquetaForm.mockupProductoUrl ? (
                        <img
                          src={etiquetaForm.mockupProductoUrl}
                          alt="Mockup producto"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Package size={30} className="text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 space-y-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setMockupProductoEtiquetaFile(event.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-[#244C5A] file:px-3 file:py-2 file:text-white file:font-bold"
                      />

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => setMockupProductoEtiquetaFile(null)}
                          className="rounded-2xl border border-slate-300 px-4 py-2 text-xs font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition"
                        >
                          Quitar archivo seleccionado
                        </button>
                        <p className="text-xs text-slate-500 flex items-center">
                          Este mockup se verá en Inventario de etiquetas.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 border-t border-slate-200 flex flex-col sm:flex-row sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseEtiquetaModal}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingEtiqueta}
                  className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20"
                >
                  {savingEtiqueta ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  {savingEtiqueta ? "Guardando..." : "Guardar etiqueta"}
                </button>
              </div>
            </form>
          </div>
        )}

      </section>
      </section>
    </main>
  );
}
