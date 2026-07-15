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
  Home,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MoveRight,
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
import {
  get,
  getDatabase,
  onValue,
  push,
  ref,
  set,
  update,
} from "firebase/database";
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
    icon: MoveRight,
    items: [
      {
        title: "Ver órdenes de pedido",
        icon: Eye,
        href: "/panel/ordenes_creadas",
      },
      {
        title: "Producción x Planta",
        icon: MoveRight,
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

type AlertaBodega = {
  id: string;
  mockupUrl?: string;
  MOCKUP_URL?: string;
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
  stockReal?: number | string;
  stockReservado?: number | string;
  stockDisponible?: number | string;
  stockDisponibleMinimo?: number | string;
  stockEsperado?: number | string;
  stockTeorico?: number | string;
  stockTeoricoMinimo?: number | string;
  unidadDeEmpaque?: string;
};

type ProductoProveedorIndex = {
  codigoProducto: string;
  codigoProveedor: string;
  proveedorNodo: string;
  nombreProveedor: string;
  producto: string;
  unidadDeEmpaque: string;
  mockupUrl: string;
};

type ProductoGeneralCompra = {
  id: string;
  codigoProducto: string;
  codigoProveedor: string;
  proveedorNodo: string;
  nombreProveedor: string;
  producto: string;
  unidadDeEmpaque: string;
  mockupUrl: string;
  stockReal: number;
  stockReservado: number;
  stockDisponible: number;
  stockEsperado: number;
  stockTeorico: number;
};

type DuplicateOrderModalState = {
  tipoOrden: "alerta" | "manual";
  orderId: string;
  consecutivo: string;
  proveedor: string;
  totalItems: number;
} | null;

type CompraItem = {
  origen: "alerta" | "manual";
  productKey?: string;
  codigoProducto: string;
  producto: string;
  codigoProveedor: string;
  proveedor: string;
  unidadEmpaque: string;
  cajasPacas: string;
  totalComprar: number;
  stockReal: number;
  stockReservado: number;
  stockDisponible: number;
  stockEsperado: number;
  stockTeorico: number;
  mockupUrl?: string;
  alertaId?: string;
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

function getProviderPrefixFromCode(value?: string) {
  const clean = cleanKey(normalizeText(value));
  if (!clean) return "";
  const firstPart = clean.split("-")[0] || clean;
  const letters = firstPart.replace(/[^A-Z]/g, "");
  return (letters || firstPart).slice(0, 3).toUpperCase();
}

function normalizeOrderNumber(value: number, providerCode?: string) {
  const prefix = getProviderPrefixFromCode(providerCode);
  const base = `AA-${String(value).padStart(3, "0")}`;
  return prefix ? `${prefix}-${base}` : base;
}

function getOrderNumberValue(consecutivo?: string, providerCode?: string) {
  const clean = normalizeText(consecutivo).toUpperCase().trim();
  const prefix = getProviderPrefixFromCode(providerCode);

  if (prefix) {
    const providerMatch = clean.match(new RegExp(`^${prefix}-AA-(\\d+)$`));
    return providerMatch ? Number(providerMatch[1]) : 0;
  }

  const match = clean.match(/^(?:[A-Z]{2,6}-)?AA-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function getEstadoClass(stockDisponible: number, stockTeorico: number) {
  if (stockDisponible < 0 || stockTeorico < 0)
    return "bg-red-50 text-red-700 border-red-100";
  if (stockDisponible === 0 || stockTeorico === 0)
    return "bg-orange-50 text-orange-700 border-orange-100";
  return "bg-yellow-50 text-yellow-800 border-yellow-100";
}

function getEstadoLabel(stockDisponible: number, stockTeorico: number) {
  if (stockDisponible < 0 || stockTeorico < 0) return "Stock negativo";
  if (stockDisponible === 0 || stockTeorico === 0) return "Stock en cero";
  return "Stock bajo";
}

function calcularTotalCompra(unidadEmpaque: unknown, cajasPacas: unknown) {
  const cajas = toNumber(cajasPacas);
  const unidad = toNumber(unidadEmpaque);
  return unidad > 0 ? unidad * cajas : cajas;
}

function formatNumber(value: unknown) {
  const numberValue = toNumber(value);
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(
    numberValue,
  );
}

function getAlertStocks(alerta: AlertaBodega) {
  const stockReal = toNumber(alerta.stockReal ?? alerta.stockDisponible);
  const stockReservado = toNumber(alerta.stockReservado);
  const stockDisponible = toNumber(
    alerta.stockDisponible ?? stockReal - stockReservado,
  );
  const stockEsperado = toNumber(
    alerta.stockEsperado ?? alerta.stockTeorico ?? stockDisponible,
  );

  return { stockReal, stockReservado, stockDisponible, stockEsperado };
}

const providerGroupClasses = [
  "bg-sky-50/70 hover:bg-sky-100/80",
  "bg-emerald-50/70 hover:bg-emerald-100/80",
  "bg-amber-50/70 hover:bg-amber-100/80",
  "bg-violet-50/70 hover:bg-violet-100/80",
  "bg-rose-50/70 hover:bg-rose-100/80",
  "bg-cyan-50/70 hover:bg-cyan-100/80",
];

function getProviderGroupClass(providerKey: string) {
  let hash = 0;
  for (let index = 0; index < providerKey.length; index += 1) {
    hash = providerKey.charCodeAt(index) + ((hash << 5) - hash);
  }
  return providerGroupClasses[Math.abs(hash) % providerGroupClasses.length];
}

function getMockupUrlFromData(...sources: Array<Record<string, any> | null | undefined>) {
  for (const source of sources) {
    const value = normalizeText(
      source?.mockupUrl ||
        source?.MOCKUP_URL ||
        source?.mockup ||
        source?.MOCKUP ||
        source?.imagen ||
        source?.IMAGEN ||
        source?.foto ||
        source?.FOTO,
    ).trim();

    if (value) return value;
  }

  return "";
}

function getMovementOrderValue(id: string, movement: any) {
  const fecha = normalizeText(movement?.FECHA);
  const fechaOrder = /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? new Date(`${fecha}T00:00:00`).getTime()
    : 0;
  const createdAt = toNumber(movement?.CREATED_AT || movement?.UPDATED_AT);
  const movNumber = toNumber(id.replace(/\D/g, ""));
  return fechaOrder || createdAt || movNumber;
}

function getLatestStockFromProductNode(productNode: Record<string, any>) {
  const datos = productNode?.DATOS_PRODUCTO || {};
  const movimientos = Object.entries(productNode?.MOVIMIENTOS || {}).sort(
    ([, a]: any, [, b]: any) => {
      const aDate = normalizeText(a?.CREATED_AT || a?.FECHA || a?.ORDEN_FECHA);
      const bDate = normalizeText(b?.CREATED_AT || b?.FECHA || b?.ORDEN_FECHA);
      return bDate.localeCompare(aDate);
    },
  );

  const latest = movimientos[0]?.[1] as any;
  const stockReal = latest
    ? toNumber(latest.STOCK_REAL ?? latest.SALDO ?? latest.STOCK)
    : toNumber(datos.STOCK_REAL ?? datos.SALDO ?? datos.STOCK);
  const stockReservado = latest
    ? toNumber(latest.STOCK_RESERVADO)
    : toNumber(datos.STOCK_RESERVADO);
  const stockDisponible = latest
    ? toNumber(latest.STOCK_DISPONIBLE ?? stockReal - stockReservado)
    : toNumber(datos.STOCK_DISPONIBLE ?? stockReal - stockReservado);
  const stockEsperado = latest
    ? toNumber(latest.STOCK_ESPERADO ?? latest.STOCK_TEORICO ?? stockDisponible)
    : toNumber(datos.STOCK_ESPERADO ?? datos.STOCK_TEORICO ?? stockDisponible);
  const stockTeorico = stockEsperado;

  return {
    stockReal,
    stockReservado,
    stockDisponible,
    stockEsperado,
    stockTeorico,
  };
}

export default function CrearComprasAlertasPage() {
  const router = useRouter();
  const realtimeDb = getDatabase(auth.app);

  const {
    authUser,
    profile,
    loading: loadingPermissions,
    isActive,
  } = useUserPermissions();

  const [alertas, setAlertas] = useState<AlertaBodega[]>([]);
  const [productosIndex, setProductosIndex] = useState<
    Record<string, ProductoProveedorIndex>
  >({});
  const [productosGenerales, setProductosGenerales] = useState<
    ProductoGeneralCompra[]
  >([]);
  const [loadingAlertas, setLoadingAlertas] = useState(true);
  const [loadingCompra, setLoadingCompra] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fecha, setFecha] = useState(todayISO());
  const [consecutivo, setConsecutivo] = useState("AA-001");
  const [manualFecha, setManualFecha] = useState(todayISO());
  const [items, setItems] = useState<CompraItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [duplicateOrderModal, setDuplicateOrderModal] =
    useState<DuplicateOrderModalState>(null);
  const [modalMode, setModalMode] = useState<"alerta" | "manual">("alerta");
  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [selectedGeneralId, setSelectedGeneralId] = useState("");
  const [selectedManualProviderCode, setSelectedManualProviderCode] =
    useState("");
  const [cajasPacas, setCajasPacas] = useState("");
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [alertSearch, setAlertSearch] = useState("");
  const [quickPage, setQuickPage] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [selectedMockup, setSelectedMockup] = useState("");

  const userName = useMemo(() => {
    return (
      profile?.nombre ||
      authUser?.displayName ||
      authUser?.email?.split("@")[0] ||
      "Administrador"
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

  const alertasFiltradas = useMemo(() => {
    const base = alertas.filter((alerta) => {
      const stocks = getAlertStocks(alerta);
      const minimoDisponible = toNumber(alerta.stockDisponibleMinimo || 10);
      const minimoTeorico = toNumber(alerta.stockTeoricoMinimo || 10);

      return (
        alerta.activo !== false &&
        (alerta.alertaDisponible ||
          alerta.alertaTeorico ||
          stocks.stockDisponible <= minimoDisponible ||
          stocks.stockEsperado <= minimoTeorico)
      );
    });

    return base.sort((a, b) => {
      const providerCompare = normalizeText(
        a.nombreProveedor || a.proveedorNodo || a.codigoProveedor,
      ).localeCompare(
        normalizeText(
          b.nombreProveedor || b.proveedorNodo || b.codigoProveedor,
        ),
      );
      if (providerCompare !== 0) return providerCompare;
      return normalizeText(a.producto).localeCompare(normalizeText(b.producto));
    });
  }, [alertas]);

  const alertasModalFiltradas = useMemo(() => {
    const cleanSearch = alertSearch.trim().toLowerCase();
    if (!cleanSearch) return alertasFiltradas;

    return alertasFiltradas.filter((alerta) => {
      const texto = [
        alerta.codigoProducto,
        alerta.producto,
        alerta.codigoProveedor,
        alerta.nombreProveedor,
        alerta.proveedorNodo,
      ]
        .map((value) => normalizeText(value).toLowerCase())
        .join(" ");

      return texto.includes(cleanSearch);
    });
  }, [alertSearch, alertasFiltradas]);

  const productosGeneralesFiltrados = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    const base = [...productosGenerales].sort(
      (a, b) =>
        a.codigoProveedor.localeCompare(b.codigoProveedor) ||
        a.producto.localeCompare(b.producto),
    );

    if (!cleanSearch) return base;

    return base.filter((producto) => {
      return (
        producto.codigoProducto.toLowerCase().includes(cleanSearch) ||
        producto.producto.toLowerCase().includes(cleanSearch) ||
        producto.nombreProveedor.toLowerCase().includes(cleanSearch) ||
        producto.codigoProveedor.toLowerCase().includes(cleanSearch)
      );
    });
  }, [productosGenerales, search]);

  const manualProviderOptions = useMemo(() => {
    const map: Record<
      string,
      {
        codigoProveedor: string;
        nombreProveedor: string;
        proveedorNodo: string;
        totalProductos: number;
      }
    > = {};

    productosGenerales.forEach((producto) => {
      const codigoProveedor = cleanKey(producto.codigoProveedor);
      if (!codigoProveedor) return;

      if (!map[codigoProveedor]) {
        map[codigoProveedor] = {
          codigoProveedor,
          nombreProveedor:
            producto.nombreProveedor ||
            producto.proveedorNodo ||
            codigoProveedor,
          proveedorNodo: producto.proveedorNodo || "",
          totalProductos: 0,
        };
      }

      map[codigoProveedor].totalProductos += 1;
    });

    return Object.values(map).sort(
      (a, b) =>
        a.nombreProveedor.localeCompare(b.nombreProveedor) ||
        a.codigoProveedor.localeCompare(b.codigoProveedor),
    );
  }, [productosGenerales]);

  const manualProviderOptionsFiltrados = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    if (!cleanSearch) return manualProviderOptions;

    return manualProviderOptions.filter((provider) => {
      const texto = [
        provider.codigoProveedor,
        provider.nombreProveedor,
        provider.proveedorNodo,
      ]
        .map((value) => normalizeText(value).toLowerCase())
        .join(" ");

      return texto.includes(cleanSearch);
    });
  }, [manualProviderOptions, search]);

  const manualProductsForSelectedProvider = useMemo(() => {
    const cleanProviderCode = cleanKey(selectedManualProviderCode);
    const cleanSearch = search.trim().toLowerCase();

    const base = productosGenerales
      .filter(
        (producto) => cleanKey(producto.codigoProveedor) === cleanProviderCode,
      )
      .sort(
        (a, b) =>
          a.codigoProducto.localeCompare(b.codigoProducto) ||
          a.producto.localeCompare(b.producto),
      );

    if (!cleanSearch) return base;

    return base.filter((producto) => {
      return (
        producto.codigoProducto.toLowerCase().includes(cleanSearch) ||
        producto.producto.toLowerCase().includes(cleanSearch) ||
        producto.nombreProveedor.toLowerCase().includes(cleanSearch)
      );
    });
  }, [productosGenerales, selectedManualProviderCode, search]);

  const selectedAlert = useMemo(() => {
    return alertas.find((alerta) => alerta.id === selectedAlertId) || null;
  }, [alertas, selectedAlertId]);

  const selectedGeneralProduct = useMemo(() => {
    return (
      productosGenerales.find(
        (producto) => producto.id === selectedGeneralId,
      ) || null
    );
  }, [productosGenerales, selectedGeneralId]);

  const selectedIndexData = useMemo(() => {
    if (!selectedAlert) return null;
    const key = cleanKey(
      `${selectedAlert.codigoProveedor || ""}_${selectedAlert.codigoProducto || ""}`,
    );
    return productosIndex[key] || null;
  }, [selectedAlert, productosIndex]);

  const selectedAlertMockupUrl = useMemo(() => {
    if (!selectedAlert) return "";
    return getMockupUrlFromData(
      selectedAlert,
      selectedIndexData,
      productosIndex[
        cleanKey(
          `${selectedAlert.codigoProveedor || ""}_${selectedAlert.codigoProducto || ""}`,
        )
      ],
    );
  }, [selectedAlert, selectedIndexData, productosIndex]);

  const selectedModalMockupUrl = useMemo(() => {
    if (modalMode === "manual") return selectedGeneralProduct?.mockupUrl || "";
    return selectedAlertMockupUrl;
  }, [modalMode, selectedGeneralProduct, selectedAlertMockupUrl]);

  const unidadEmpaqueSeleccionada = useMemo(() => {
    if (modalMode === "manual") {
      return normalizeText(selectedGeneralProduct?.unidadDeEmpaque).trim();
    }

    return normalizeText(
      selectedIndexData?.unidadDeEmpaque || selectedAlert?.unidadDeEmpaque,
    ).trim();
  }, [modalMode, selectedGeneralProduct, selectedIndexData, selectedAlert]);

  const totalModal = useMemo(() => {
    return calcularTotalCompra(unidadEmpaqueSeleccionada, cajasPacas);
  }, [unidadEmpaqueSeleccionada, cajasPacas]);

  const selectedModalStocks = useMemo(() => {
    if (modalMode === "manual") {
      return {
        stockReal: toNumber(selectedGeneralProduct?.stockReal),
        stockDisponible: toNumber(selectedGeneralProduct?.stockDisponible),
        stockEsperado: toNumber(selectedGeneralProduct?.stockEsperado),
      };
    }

    return selectedAlert
      ? getAlertStocks(selectedAlert)
      : { stockReal: 0, stockDisponible: 0, stockEsperado: 0 };
  }, [modalMode, selectedGeneralProduct, selectedAlert]);

  const selectedModalProviderCode = useMemo(() => {
    if (modalMode === "manual") return selectedGeneralProduct?.codigoProveedor || "";
    return selectedAlert?.codigoProveedor || "";
  }, [modalMode, selectedGeneralProduct, selectedAlert]);

  useEffect(() => {
    if (!modalOpen || !selectedModalProviderCode) return;

    let cancelled = false;

    async function loadProviderOrderPreview() {
      try {
        const comprasSnapshot = await get(ref(realtimeDb, "COMPRAS_BODEGA"));
        const comprasData = comprasSnapshot.exists() ? comprasSnapshot.val() || {} : {};
        let maxNumber = 0;

        Object.values(comprasData || {}).forEach((value: any) => {
          const current = getOrderNumberValue(
            value?.consecutivo || value?.ordenCompra,
            selectedModalProviderCode,
          );
          if (current > maxNumber) maxNumber = current;
        });

        if (!cancelled) {
          setConsecutivo(
            normalizeOrderNumber((maxNumber || 0) + 1, selectedModalProviderCode),
          );
        }
      } catch (err) {
        console.warn("No fue posible calcular el consecutivo del proveedor.", err);
      }
    }

    loadProviderOrderPreview();

    return () => {
      cancelled = true;
    };
  }, [modalOpen, selectedModalProviderCode, realtimeDb]);

  const cajasPacasSugeridas = useMemo(() => {
    const unidad = toNumber(unidadEmpaqueSeleccionada);
    const disponible = toNumber(selectedModalStocks.stockDisponible);
    if (unidad <= 0 || disponible <= 0) return "";
    const sugerido = Math.ceil(disponible / unidad);
    return sugerido > 0 ? String(sugerido) : "";
  }, [unidadEmpaqueSeleccionada, selectedModalStocks]);

  const alertItems = useMemo(() => {
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.origen === "alerta");
  }, [items]);

  const manualItems = useMemo(() => {
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.origen === "manual");
  }, [items]);

  const modalItems = modalMode === "alerta" ? alertItems : manualItems;

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
  }, [alertasFiltradas.length]);

  useEffect(() => {
    if (!loadingPermissions && !authUser) router.replace("/");
  }, [loadingPermissions, authUser, router]);

  useEffect(() => {
    if (loadingPermissions || !authUser) return;

    setLoadingAlertas(true);

    const unsubscribe = onValue(
      ref(realtimeDb, "SEMAFORIZACIÓN/ALERTAS"),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() || {} : {};
        const rows = Object.entries(data).map(([id, value]: any) => ({
          id,
          ...(value || {}),
        })) as AlertaBodega[];

        rows.sort((a, b) => {
          const aDisponible = toNumber(a.stockDisponible);
          const bDisponible = toNumber(b.stockDisponible);

          if (aDisponible !== bDisponible) return aDisponible - bDisponible;

          return normalizeText(a.producto).localeCompare(
            normalizeText(b.producto),
          );
        });

        setAlertas(rows);
        setLoadingAlertas(false);
      },
      (err) => {
        setError(`No fue posible cargar alertas de bodega. ${err.message}`);
        setLoadingAlertas(false);
      },
    );

    return () => unsubscribe();
  }, [loadingPermissions, authUser, realtimeDb]);

  useEffect(() => {
    if (loadingPermissions || !authUser) return;

    const unsubscribe = onValue(
      ref(realtimeDb, "PROVEEDORES"),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() || {} : {};
        const index: Record<string, ProductoProveedorIndex> = {};
        const generalRows: ProductoGeneralCompra[] = [];

        Object.entries(data).forEach(([providerCode, providerNode]) => {
          const providerNames = providerNode as Record<string, any>;

          Object.entries(providerNames || {}).forEach(
            ([providerName, providerContent]) => {
              const content = providerContent as Record<string, any>;
              const datosProveedor = content?.DATOS || {};
              const nombreProveedor = normalizeText(
                datosProveedor.PROVEEDOR || providerName,
              );
              const productos = content?.PRODUCTOS || {};

              Object.entries(productos).forEach(
                ([productCode, productContent]) => {
                  const productNode = productContent as Record<string, any>;
                  const datosProducto = productNode?.DATOS_PRODUCTO || {};
                  const codigoProducto = cleanKey(
                    normalizeText(datosProducto.CODIGO || productCode),
                  );
                  const codigoProveedor = cleanKey(
                    normalizeText(datosProveedor.CODIGO || providerCode),
                  );
                  const key = cleanKey(`${codigoProveedor}_${codigoProducto}`);

                  const stock = getLatestStockFromProductNode(productNode);
                  const productoInfo = {
                    codigoProducto,
                    codigoProveedor,
                    proveedorNodo: normalizeText(providerName),
                    nombreProveedor,
                    producto: normalizeText(datosProducto.PRODUCTO),
                    unidadDeEmpaque: normalizeText(
                      datosProducto.UNIDAD_DE_EMPAQUE,
                    ),
                    mockupUrl: getMockupUrlFromData(datosProducto, productNode),
                  };

                  index[key] = productoInfo;
                  generalRows.push({
                    id: key,
                    ...productoInfo,
                    stockReal: stock.stockReal,
                    stockReservado: stock.stockReservado,
                    stockDisponible: stock.stockDisponible,
                    stockEsperado: stock.stockEsperado,
                    stockTeorico: stock.stockTeorico,
                  });
                },
              );
            },
          );
        });

        setProductosIndex(index);
        setProductosGenerales(generalRows);
      },
      (err) => {
        console.warn("No fue posible cargar índice de proveedores.", err);
      },
    );

    return () => unsubscribe();
  }, [loadingPermissions, authUser, realtimeDb]);

  useEffect(() => {
    if (loadingPermissions || !authUser) return;

    async function loadNextOrder() {
      setLoadingCompra(true);

      try {
        const snapshot = await get(ref(realtimeDb, "COMPRAS_BODEGA"));
        const data = snapshot.exists() ? snapshot.val() || {} : {};
        let maxNumber = 0;

        Object.values(data).forEach((value: any) => {
          const current = getOrderNumberValue(
            value?.consecutivo || value?.ordenCompra,
          );
          if (current > maxNumber) maxNumber = current;
        });

        const nextNumber = maxNumber + 1 || 1;
        setConsecutivo(normalizeOrderNumber(nextNumber));
      } catch (err: any) {
        setError(
          `No fue posible calcular el consecutivo de compra. ${err?.message || ""}`,
        );
      } finally {
        setLoadingCompra(false);
      }
    }

    loadNextOrder();
  }, [loadingPermissions, authUser, realtimeDb]);

  const resetModal = () => {
    setSelectedAlertId("");
    setSelectedGeneralId("");
    setSelectedManualProviderCode("");
    setCajasPacas("");
    setEditingItemIndex(null);
    setSearch("");
    setAlertSearch("");
    setModalOpen(false);
  };

  const openNewItemModal = (alertaId = "") => {
    setModalMode("alerta");
    setEditingItemIndex(null);
    setSelectedAlertId(alertaId);
    setSelectedGeneralId("");
    setSelectedManualProviderCode("");
    setCajasPacas("");
    setSearch("");
    setAlertSearch("");
    setModalOpen(true);
  };

  const openGeneralItemModal = (productId = "") => {
    const selectedProduct =
      productosGenerales.find((producto) => producto.id === productId) || null;

    setModalMode("manual");
    setEditingItemIndex(null);
    setSelectedGeneralId(productId);
    setSelectedManualProviderCode(selectedProduct?.codigoProveedor || "");
    setSelectedAlertId("");
    setCajasPacas("");
    setSearch("");
    setAlertSearch("");
    setModalOpen(true);
  };

  const openEditItemModal = (index: number) => {
    const item = items[index];
    if (!item) return;

    setEditingItemIndex(index);
    setModalMode(item.origen || (item.alertaId ? "alerta" : "manual"));
    setSelectedAlertId(item.alertaId || "");
    setSelectedGeneralId(item.productKey || "");
    setSelectedManualProviderCode(item.codigoProveedor || "");
    setCajasPacas(item.cajasPacas || "");
    setSearch("");
    setAlertSearch("");
    setModalOpen(true);
  };

  const handleAddItem = () => {
    setError("");
    setMessage("");

    if (!cajasPacas.trim()) {
      setError("Digita la cantidad de cajas o pacas.");
      return;
    }

    const selectedProduct =
      modalMode === "manual" ? selectedGeneralProduct : null;

    if (modalMode === "alerta" && !selectedAlert) {
      setError("Selecciona un producto en alerta.");
      return;
    }

    if (modalMode === "manual" && !selectedProduct) {
      setError("Selecciona un producto del proveedor.");
      return;
    }

    const codigoProducto = cleanKey(
      modalMode === "manual"
        ? normalizeText(selectedProduct?.codigoProducto)
        : normalizeText(selectedAlert?.codigoProducto),
    );
    const codigoProveedor = cleanKey(
      modalMode === "manual"
        ? normalizeText(selectedProduct?.codigoProveedor)
        : normalizeText(selectedAlert?.codigoProveedor),
    );
    const producto = normalizeText(
      modalMode === "manual"
        ? selectedProduct?.producto
        : selectedIndexData?.producto || selectedAlert?.producto,
    ).trim();
    const proveedor = normalizeText(
      modalMode === "manual"
        ? selectedProduct?.nombreProveedor || selectedProduct?.proveedorNodo
        : selectedAlert?.nombreProveedor ||
            selectedIndexData?.nombreProveedor ||
            selectedAlert?.proveedorNodo,
    ).trim();
    const unidadEmpaque = normalizeText(
      modalMode === "manual"
        ? selectedProduct?.unidadDeEmpaque
        : selectedIndexData?.unidadDeEmpaque || selectedAlert?.unidadDeEmpaque,
    ).trim();
    const alertStocks = selectedAlert ? getAlertStocks(selectedAlert) : null;
    const stockReal =
      modalMode === "manual"
        ? toNumber(selectedProduct?.stockReal)
        : toNumber(alertStocks?.stockReal);
    const stockReservado =
      modalMode === "manual"
        ? toNumber(selectedProduct?.stockReservado)
        : toNumber(alertStocks?.stockReservado);
    const stockDisponible =
      modalMode === "manual"
        ? toNumber(selectedProduct?.stockDisponible)
        : toNumber(alertStocks?.stockDisponible);
    const stockEsperado =
      modalMode === "manual"
        ? toNumber(
            selectedProduct?.stockEsperado ?? selectedProduct?.stockTeorico,
          )
        : toNumber(alertStocks?.stockEsperado);
    const stockTeorico = stockEsperado;
    const mockupUrl =
      modalMode === "manual"
        ? normalizeText(selectedProduct?.mockupUrl)
        : selectedAlertMockupUrl;
    const productKey =
      modalMode === "manual"
        ? selectedProduct?.id
        : cleanKey(`${codigoProveedor}_${codigoProducto}`);

    if (!codigoProducto || !producto || !proveedor) {
      setError(
        "El producto seleccionado no tiene código, producto o proveedor completo.",
      );
      return;
    }

    const providerConflict = items.some((item, index) => {
      if (index === editingItemIndex) return false;
      if (item.origen !== modalMode) return false;
      return cleanKey(item.codigoProveedor) !== codigoProveedor;
    });

    if (providerConflict) {
      setError(
        "Cada orden de compra debe pertenecer a un solo proveedor. Finaliza la orden actual o limpia los productos antes de seleccionar otro proveedor.",
      );
      return;
    }

    const exists = items.some((item, index) => {
      if (index === editingItemIndex) return false;
      if (modalMode === "alerta") return item.alertaId === selectedAlert?.id;
      return item.productKey === productKey && item.origen === "manual";
    });

    if (exists) {
      setError("Este producto ya está agregado en la orden de compra.");
      return;
    }

    const nextItem: CompraItem = {
      origen: modalMode,
      productKey,
      alertaId: modalMode === "alerta" ? selectedAlert?.id : undefined,
      codigoProducto,
      producto,
      codigoProveedor,
      proveedor,
      unidadEmpaque,
      cajasPacas: cajasPacas.trim(),
      totalComprar: calcularTotalCompra(unidadEmpaque, cajasPacas),
      stockReal,
      stockReservado,
      stockDisponible,
      stockEsperado,
      stockTeorico,
      mockupUrl,
    };

    setItems((current) => {
      if (editingItemIndex !== null) {
        return current.map((item, index) =>
          index === editingItemIndex ? nextItem : item,
        );
      }

      return [...current, nextItem];
    });

    if (editingItemIndex !== null) {
      resetModal();
      return;
    }

    setSelectedAlertId("");
    setSelectedGeneralId("");
    setSelectedManualProviderCode("");
    setCajasPacas("");
  };

  const handleRemoveItem = (indexToRemove: number) => {
    setItems((current) =>
      current.filter((_, index) => index !== indexToRemove),
    );
  };

  const handleSaveCompra = async (
    tipoOrden?: "alerta" | "manual",
    duplicateAction?: "append" | "new",
  ) => {
    setError("");
    setMessage("");

    const gruposAGuardar =
      tipoOrden === "alerta"
        ? {
            alertas: alertItems,
            manuales: [] as Array<{ item: CompraItem; index: number }>,
          }
        : tipoOrden === "manual"
          ? {
              alertas: [] as Array<{ item: CompraItem; index: number }>,
              manuales: manualItems,
            }
          : { alertas: alertItems, manuales: manualItems };

    const totalItemsGuardar =
      gruposAGuardar.alertas.length + gruposAGuardar.manuales.length;

    if (totalItemsGuardar === 0) {
      setError("Agrega al menos un producto a la orden de compra.");
      return;
    }

    if (gruposAGuardar.alertas.length > 0 && !fecha) {
      setError("La fecha de la orden con alertas es obligatoria.");
      return;
    }

    if (gruposAGuardar.manuales.length > 0 && !manualFecha) {
      setError("La fecha de la compra manual es obligatoria.");
      return;
    }

    setSaving(true);

    try {
      const nowDate = new Date();
      const now = nowDate.toISOString();
      const creadoPorNombre = userName;
      const creadoPorRol =
        (profile as any)?.rolNombre ||
        (profile as any)?.role ||
        (profile as any)?.rol ||
        "Sin rol";
      const creadoPorEmail = authUser?.email || null;
      const creadoPorUid = authUser?.uid || null;
      const comprasSnapshot = await get(ref(realtimeDb, "COMPRAS_BODEGA"));
      const comprasData = comprasSnapshot.exists()
        ? comprasSnapshot.val() || {}
        : {};

      const getNextConsecutivoFromData = (
        data: Record<string, any>,
        providerCode?: string,
      ) => {
        let maxNumber = 0;
        Object.values(data || {}).forEach((value: any) => {
          const current = getOrderNumberValue(
            value?.consecutivo || value?.ordenCompra,
            providerCode,
          );
          if (current > maxNumber) maxNumber = current;
        });
        return normalizeOrderNumber((maxNumber || 0) + 1, providerCode);
      };

      const normalizeProveedor = (value: unknown) =>
        cleanKey(normalizeText(value));
      const providersToSave = new Set(
        [...gruposAGuardar.alertas, ...gruposAGuardar.manuales]
          .map(({ item }) =>
            normalizeProveedor(item.codigoProveedor || item.proveedor),
          )
          .filter(Boolean),
      );

      const existingProviderOrder = Object.entries(comprasData || {}).find(
        ([, raw]: [string, any]) => {
          const estado = normalizeText(
            raw?.estado || raw?.estadoCalculado,
          ).toLowerCase();
          if (
            ["anulada", "eliminada", "completada", "finalizada"].includes(
              estado,
            )
          )
            return false;
          const itemsExistentes = Array.isArray(raw?.itemsCompra)
            ? raw.itemsCompra
            : Object.values(raw?.itemsCompra || {});
          return itemsExistentes.some((item: any) => {
            const providerKey = normalizeProveedor(
              item?.codigoProveedor || item?.proveedor,
            );
            return providerKey && providersToSave.has(providerKey);
          });
        },
      ) as [string, any] | undefined;

      if (existingProviderOrder && !duplicateAction) {
        const [, existingOrder] = existingProviderOrder;
        const currentItems = Array.isArray(existingOrder?.itemsCompra)
          ? existingOrder.itemsCompra
          : Object.values(existingOrder?.itemsCompra || {});
        setDuplicateOrderModal({
          tipoOrden: tipoOrden || "alerta",
          orderId: existingProviderOrder[0],
          consecutivo:
            existingOrder?.consecutivo ||
            existingOrder?.ordenCompra ||
            "sin consecutivo",
          proveedor:
            currentItems?.[0]?.proveedor ||
            currentItems?.[0]?.nombreProveedor ||
            "Proveedor seleccionado",
          totalItems: currentItems.length || 0,
        });
        setSaving(false);
        return;
      }

      const wantsAppendToExisting =
        Boolean(existingProviderOrder) && duplicateAction === "append";

      const buildItems = (
        itemsOrden: Array<{ item: CompraItem; index: number }>,
        startAt = 0,
      ) =>
        itemsOrden.map(({ item }, index) => ({
          item: startAt + index + 1,
          codigoEnvase: item.codigoProducto,
          codigoProducto: item.codigoProducto,
          descripcion: item.producto,
          producto: item.producto,
          proveedor: item.proveedor,
          codigoProveedor: item.codigoProveedor,
          unidadEmpaque: item.unidadEmpaque,
          cajasPacas: item.cajasPacas,
          total: item.totalComprar,
          totalUnidades: item.totalComprar,
          cantidadComprar: item.totalComprar,
          stockReal: item.stockReal,
          stockReservado: item.stockReservado,
          stockDisponible: item.stockDisponible,
          stockEsperado: item.stockEsperado,
          stockTeorico: item.stockTeorico,
          origen: item.origen,
          productKey: item.productKey || null,
          alertaId: item.alertaId || null,
          agregadoAt: now,
          agregadoPorUid: creadoPorUid,
          agregadoPorEmail: creadoPorEmail,
          agregadoPorNombre: creadoPorNombre,
          agregadoPorRol: creadoPorRol,
        }));

      const itemsSeleccionados = [
        ...gruposAGuardar.alertas,
        ...gruposAGuardar.manuales,
      ];

      if (wantsAppendToExisting && existingProviderOrder) {
        const [existingId, existingOrder] = existingProviderOrder;
        const currentItems = Array.isArray(existingOrder?.itemsCompra)
          ? existingOrder.itemsCompra
          : Object.values(existingOrder?.itemsCompra || {});
        const newItems = buildItems(itemsSeleccionados, currentItems.length);

        await update(ref(realtimeDb, `COMPRAS_BODEGA/${existingId}`), {
          itemsCompra: [...currentItems, ...newItems],
          actualizadoAt: now,
          actualizadoPorUid: creadoPorUid,
          actualizadoPorEmail: creadoPorEmail,
          actualizadoPorNombre: creadoPorNombre,
          actualizadoPorRol: creadoPorRol,
          ultimaAccion: "productos_agregados_a_orden_existente",
        });

        setMessage(
          `Productos agregados a la orden ${existingOrder?.consecutivo || existingOrder?.ordenCompra}.`,
        );
      } else {
        const fechaOrden =
          gruposAGuardar.alertas.length > 0 ? fecha : manualFecha;
        const origenOrden =
          gruposAGuardar.alertas.length > 0 &&
          gruposAGuardar.manuales.length > 0
            ? "COMPRA_MIXTA_ALERTAS_Y_MANUAL"
            : gruposAGuardar.alertas.length > 0
              ? "SEMAFORIZACIÓN/ALERTAS"
              : "COMPRA_MANUAL_PROVEEDORES";
        const providerCodeForOrder = cleanKey(
          normalizeText(itemsSeleccionados[0]?.item.codigoProveedor),
        );
        const ordenLimpia = cleanKey(
          getNextConsecutivoFromData(comprasData, providerCodeForOrder),
        );
        const compraRef = push(ref(realtimeDb, "COMPRAS_BODEGA"));

        await set(compraRef, {
          consecutivo: ordenLimpia,
          ordenCompra: ordenLimpia,
          fecha: fechaOrden,
          origen: origenOrden,
          estado: "creada",
          itemsCompra: buildItems(itemsSeleccionados),
          creadoAt: now,
          creadoFecha: nowDate.toLocaleDateString("es-CO"),
          creadoHora: nowDate.toLocaleTimeString("es-CO"),
          actualizadoAt: now,
          creadoPorUid,
          creadoPorEmail,
          creadoPorNombre,
          creadoPorRol,
        });

        setMessage(`Orden de compra ${ordenLimpia} creada correctamente.`);
      }

      setItems((current) =>
        current.filter(
          (_, index) =>
            !itemsSeleccionados.some((item) => item.index === index),
        ),
      );

      const updatedSnapshot = await get(ref(realtimeDb, "COMPRAS_BODEGA"));
      const updatedData = updatedSnapshot.exists()
        ? updatedSnapshot.val() || {}
        : {};
      let maxNumber = 0;
      Object.values(updatedData).forEach((value: any) => {
        const current = getOrderNumberValue(
          value?.consecutivo || value?.ordenCompra,
        );
        if (current > maxNumber) maxNumber = current;
      });
      setConsecutivo(normalizeOrderNumber((maxNumber || 0) + 1));
      setDuplicateOrderModal(null);
      resetModal();
    } catch (err: any) {
      setError(
        `No fue posible guardar la orden de compra. ${err?.message || ""}`,
      );
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
        userRole={
          (profile as any)?.rolNombre ||
          (profile as any)?.role ||
          (profile as any)?.rol ||
          "Sin rol"
        }
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
              <span className="font-semibold text-slate-600">Compras</span>
              <span className="text-slate-300">/</span>
              <span className="font-black text-slate-900">Crear orden de compra</span>
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

        <section className="max-w-[1600px] mx-auto px-5 sm:px-8 py-6">
          {(error || message) && (
            <div className="mb-5 space-y-2">
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 sm:px-6 py-5 border-b border-slate-200">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">
                    Orden de compra
                  </p>
                  <h2 className="text-xl font-black mt-1">
                    Productos en alerta para comprar
                  </h2>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4">
                    <label className="flex items-center gap-2 text-xs font-black text-[#244C5A] mb-2">
                      <CalendarDays size={16} /> Fecha
                    </label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>

                  <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4">
                    <label className="flex items-center gap-2 text-xs font-black text-[#244C5A] mb-2">
                      <ClipboardList size={16} /> Orden de compra
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={consecutivo}
                        onChange={(e) =>
                          setConsecutivo(e.target.value.toUpperCase())
                        }
                        disabled={loadingCompra}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black outline-none focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70"
                      />
                      <button
                        type="button"
                        onClick={() => openNewItemModal()}
                        className="w-12 h-12 rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#244C5A]/20"
                        title="Agregar producto en alerta"
                      >
                        <Plus size={22} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-[#244C5A]/5 border border-[#244C5A]/10 px-4 py-3 text-sm text-slate-600">
                  Los productos en alerta se agregan, editan y finalizan dentro
                  del modal del botón +.
                </div>
              </div>
            </section>

            <section className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 sm:px-6 py-5 border-b border-slate-200">
                <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">
                  Vista rápida
                </p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Alertas de bodega disponibles
                </h3>
              </div>

              {loadingAlertas ? (
                <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
                  <Loader2 className="animate-spin" size={22} />
                  Cargando alertas...
                </div>
              ) : alertasFiltradas.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 className="mx-auto text-green-600" size={46} />
                  <h3 className="font-black text-slate-900 mt-3">
                    No hay productos en alerta
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Cuando bodega genere alertas aparecerán aquí.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                          Código
                        </th>
                        <th className="text-left px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                          Producto
                        </th>
                        <th className="text-left px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                          Proveedor
                        </th>
                        <th className="text-center px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                          Real
                        </th>
                        <th className="text-center px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                          Disp.
                        </th>
                        <th className="text-center px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                          Esperado
                        </th>
                        <th className="text-center px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertasPaginadas.map((alerta) => {
                        const stocks = getAlertStocks(alerta);
                        const providerKey = normalizeText(
                          alerta.nombreProveedor ||
                            alerta.proveedorNodo ||
                            alerta.codigoProveedor ||
                            "SIN_PROVEEDOR",
                        );
                        return (
                          <tr
                            key={alerta.id}
                            onClick={() => openNewItemModal(alerta.id)}
                            className={`border-b border-white cursor-pointer transition ${getProviderGroupClass(providerKey)}`}
                            title="Agregar este producto a la orden"
                          >
                            <td className="px-4 py-2 text-xs font-black text-[#244C5A] whitespace-nowrap">
                              {alerta.codigoProducto || "—"}
                            </td>
                            <td className="px-4 py-2 text-xs font-semibold text-slate-800 max-w-[260px] truncate">
                              {alerta.producto || "Sin producto"}
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-600 max-w-[180px] truncate">
                              {alerta.nombreProveedor ||
                                alerta.proveedorNodo ||
                                "Sin proveedor"}
                            </td>
                            <td className="px-3 py-2 text-center text-xs font-black text-slate-800">
                              {formatNumber(stocks.stockReal)}
                            </td>
                            <td className="px-3 py-2 text-center text-xs font-black text-slate-800">
                              {formatNumber(stocks.stockDisponible)}
                            </td>
                            <td className="px-3 py-2 text-center text-xs font-black text-slate-800">
                              {formatNumber(stocks.stockEsperado)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${getEstadoClass(stocks.stockDisponible, stocks.stockEsperado)}`}
                              >
                                {getEstadoLabel(
                                  stocks.stockDisponible,
                                  stocks.stockEsperado,
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {quickTotalPages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <p className="text-xs font-bold text-slate-500">
                        Mostrando {(quickPage - 1) * quickPerPage + 1}-
                        {Math.min(
                          quickPage * quickPerPage,
                          alertasFiltradas.length,
                        )}{" "}
                        de {alertasFiltradas.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={quickPage <= 1}
                          onClick={() =>
                            setQuickPage((current) => Math.max(1, current - 1))
                          }
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#244C5A] hover:text-[#244C5A] transition"
                        >
                          Anterior
                        </button>
                        <span className="text-xs font-black text-slate-500">
                          {quickPage}/{quickTotalPages}
                        </span>
                        <button
                          type="button"
                          disabled={quickPage >= quickTotalPages}
                          onClick={() =>
                            setQuickPage((current) =>
                              Math.min(quickTotalPages, current + 1),
                            )
                          }
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
          </div>

          <section className="mt-6 bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 py-5 border-b border-slate-200">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">
                  Orden de compra manual
                </p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Productos para comprar sin alerta
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Compra directa desde PROVEEDORES. Los productos se agregan y
                  editan dentro del modal.
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-y-3">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">
                      Fecha
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">
                      Orden de compra
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500">
                      Resumen
                    </th>
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
                          value={consecutivo}
                          onChange={(e) =>
                            setConsecutivo(e.target.value.toUpperCase())
                          }
                          disabled={loadingCompra}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black outline-none focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70"
                        />
                        <button
                          type="button"
                          onClick={() => openGeneralItemModal()}
                          className="w-12 h-12 rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#244C5A]/20"
                          title="Agregar producto sin alerta"
                        >
                          <Plus size={22} />
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-4 rounded-r-3xl border-y border-r border-slate-200 align-top">
                      <div className="rounded-2xl bg-white border border-slate-200 p-4">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Total ítems
                        </p>
                        <p className="text-4xl font-black text-[#244C5A] mt-1">
                          {manualItems.length}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          Proveedores disponibles:{" "}
                          {manualProviderOptions.length}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Productos cargados: {productosGenerales.length}
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#244C5A]">
                  {editingItemIndex !== null
                    ? "Editar producto"
                    : "Agregar producto"}
                </p>
                <h3 className="text-2xl font-black text-slate-900">
                  {modalMode === "alerta"
                    ? "Producto en alerta"
                    : "Producto de proveedor"}
                </h3>
              </div>

              <button
                type="button"
                onClick={resetModal}
                className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                aria-label="Cerrar"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="rounded-3xl bg-[#244C5A]/5 border border-[#244C5A]/10 p-4 flex items-start gap-3">
                <AlertTriangle
                  className="text-[#244C5A] shrink-0 mt-0.5"
                  size={22}
                />
                <div>
                  <p className="font-black text-slate-900">
                    Selecciona por código o producto
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {modalMode === "alerta"
                      ? "Solo se listan productos activos dentro de SEMAFORIZACIÓN / ALERTAS."
                      : "Selecciona cualquier producto cargado en PROVEEDORES para compra manual."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-3xl border border-sky-100 bg-sky-50 px-5 py-4">
                  <p className="text-xs font-black uppercase tracking-wide text-sky-700">
                    Stock real
                  </p>
                  <p className="text-3xl font-black text-sky-800 mt-1">
                    {modalMode === "manual"
                      ? selectedGeneralProduct
                        ? formatNumber(selectedGeneralProduct.stockReal)
                        : "—"
                      : selectedAlert
                        ? formatNumber(getAlertStocks(selectedAlert).stockReal)
                        : "—"}
                  </p>
                </div>
                <div className="rounded-3xl border border-orange-100 bg-orange-50 px-5 py-4">
                  <p className="text-xs font-black uppercase tracking-wide text-orange-700">
                    Stock disponible
                  </p>
                  <p className="text-3xl font-black text-orange-800 mt-1">
                    {modalMode === "manual"
                      ? selectedGeneralProduct
                        ? formatNumber(selectedGeneralProduct.stockDisponible)
                        : "—"
                      : selectedAlert
                        ? formatNumber(
                            getAlertStocks(selectedAlert).stockDisponible,
                          )
                        : "—"}
                  </p>
                </div>
                <div className="rounded-3xl border border-red-100 bg-red-50 px-5 py-4">
                  <p className="text-xs font-black uppercase tracking-wide text-red-700">
                    Stock esperado
                  </p>
                  <p className="text-3xl font-black text-red-800 mt-1">
                    {modalMode === "manual"
                      ? selectedGeneralProduct
                        ? formatNumber(selectedGeneralProduct.stockEsperado)
                        : "—"
                      : selectedAlert
                        ? formatNumber(
                            getAlertStocks(selectedAlert).stockEsperado,
                          )
                        : "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    {modalMode === "alerta"
                      ? "Producto en alerta"
                      : "Producto del proveedor"}
                  </label>
                  {modalMode === "alerta" ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                          size={18}
                        />
                        <input
                          type="text"
                          value={alertSearch}
                          onChange={(e) => setAlertSearch(e.target.value)}
                          placeholder="Buscar por proveedor, código o producto..."
                          className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 outline-none focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                        />
                      </div>
                      <div className="rounded-3xl border border-slate-200 overflow-hidden max-h-[320px] overflow-y-auto bg-white">
                        {alertasModalFiltradas.length === 0 ? (
                          <div className="p-4 text-sm text-slate-500">
                            No hay alertas disponibles con ese filtro
                          </div>
                        ) : (
                          alertasModalFiltradas.map((alerta) => {
                            const stocks = getAlertStocks(alerta);
                            const providerKey = normalizeText(
                              alerta.nombreProveedor ||
                                alerta.proveedorNodo ||
                                alerta.codigoProveedor ||
                                "SIN_PROVEEDOR",
                            );
                            const active = selectedAlertId === alerta.id;
                            return (
                              <button
                                key={alerta.id}
                                type="button"
                                onClick={() => setSelectedAlertId(alerta.id)}
                                className={`w-full text-left px-4 py-3 border-b border-white transition ${getProviderGroupClass(providerKey)} ${active ? "ring-2 ring-inset ring-[#244C5A]" : ""}`}
                              >
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    {(() => {
                                      const alertaKey = cleanKey(
                                        `${alerta.codigoProveedor || ""}_${alerta.codigoProducto || ""}`,
                                      );
                                      const mockupUrl = getMockupUrlFromData(
                                        alerta,
                                        productosIndex[alertaKey],
                                      );
                                      return mockupUrl ? (
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setSelectedMockup(mockupUrl);
                                          }}
                                          onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                              event.preventDefault();
                                              event.stopPropagation();
                                              setSelectedMockup(mockupUrl);
                                            }
                                          }}
                                          className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm flex items-center justify-center cursor-zoom-in"
                                          title="Ampliar mockup"
                                        >
                                          <img
                                            src={mockupUrl}
                                            alt={`Mockup ${alerta.producto || alerta.codigoProducto || "producto"}`}
                                            className="h-full w-full object-contain"
                                          />
                                        </span>
                                      ) : (
                                        <span className="h-14 w-14 shrink-0 rounded-2xl border border-white/80 bg-white/70 flex items-center justify-center text-[10px] font-black text-slate-400">
                                          Sin
                                        </span>
                                      );
                                    })()}
                                    <div className="min-w-0">
                                      <p className="text-sm font-black text-slate-900 truncate">
                                        {alerta.codigoProducto} ·{" "}
                                        {alerta.producto || "Sin producto"}
                                      </p>
                                      <p className="text-xs font-semibold text-slate-600 truncate">
                                        {alerta.nombreProveedor ||
                                          alerta.proveedorNodo ||
                                          "Sin proveedor"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-[10px] font-black shrink-0">
                                    <span className="rounded-full bg-white/80 text-slate-700 px-2 py-1">
                                      Real: {formatNumber(stocks.stockReal)}
                                    </span>
                                    <span className="rounded-full bg-white/80 text-slate-700 px-2 py-1">
                                      Disp:{" "}
                                      {formatNumber(stocks.stockDisponible)}
                                    </span>
                                    <span className="rounded-full bg-white/80 text-slate-700 px-2 py-1">
                                      Esperado:{" "}
                                      {formatNumber(stocks.stockEsperado)}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative">
                        <Search
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                          size={18}
                        />
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Buscar proveedor, código o producto..."
                          className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 outline-none focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-2">
                          Seleccionar proveedor
                        </label>
                        <div className="rounded-3xl border border-slate-200 overflow-hidden max-h-[230px] overflow-y-auto bg-white">
                          {manualProviderOptionsFiltrados.length === 0 ? (
                            <div className="p-4 text-sm text-slate-500">
                              No hay proveedores disponibles con ese filtro.
                            </div>
                          ) : (
                            manualProviderOptionsFiltrados.map((provider) => {
                              const active =
                                cleanKey(selectedManualProviderCode) ===
                                cleanKey(provider.codigoProveedor);
                              const providerKey =
                                provider.nombreProveedor ||
                                provider.codigoProveedor;
                              return (
                                <button
                                  key={provider.codigoProveedor}
                                  type="button"
                                  onClick={() => {
                                    setSelectedManualProviderCode(
                                      provider.codigoProveedor,
                                    );
                                    setSelectedGeneralId("");
                                  }}
                                  className={`w-full text-left px-4 py-3 border-b border-white transition ${getProviderGroupClass(providerKey)} ${active ? "ring-2 ring-inset ring-[#244C5A]" : ""}`}
                                >
                                  <p className="text-sm font-black text-slate-900 truncate">
                                    {provider.codigoProveedor} ·{" "}
                                    {provider.nombreProveedor}
                                  </p>
                                  <p className="text-xs font-semibold text-slate-600 truncate">
                                    {provider.totalProductos} producto(s)
                                    disponible(s)
                                  </p>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-2">
                          Seleccionar producto
                        </label>
                        <div className="rounded-3xl border border-slate-200 overflow-hidden max-h-[260px] overflow-y-auto bg-white">
                          {!selectedManualProviderCode ? (
                            <div className="p-4 text-sm text-slate-500">
                              Primero selecciona un proveedor.
                            </div>
                          ) : manualProductsForSelectedProvider.length === 0 ? (
                            <div className="p-4 text-sm text-slate-500">
                              Este proveedor no tiene productos con ese filtro.
                            </div>
                          ) : (
                            manualProductsForSelectedProvider.map(
                              (producto) => {
                                const active =
                                  selectedGeneralId === producto.id;
                                const providerKey =
                                  producto.nombreProveedor ||
                                  producto.codigoProveedor;
                                return (
                                  <button
                                    key={producto.id}
                                    type="button"
                                    onClick={() =>
                                      setSelectedGeneralId(producto.id)
                                    }
                                    className={`w-full text-left px-4 py-3 border-b border-white transition ${getProviderGroupClass(providerKey)} ${active ? "ring-2 ring-inset ring-[#244C5A]" : ""}`}
                                  >
                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                      <div className="flex items-center gap-3 min-w-0">
                                        {producto.mockupUrl ? (
                                          <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setSelectedMockup(producto.mockupUrl);
                                            }}
                                            onKeyDown={(event) => {
                                              if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                setSelectedMockup(producto.mockupUrl);
                                              }
                                            }}
                                            className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/80 bg-white shadow-sm flex items-center justify-center cursor-zoom-in"
                                            title="Ampliar mockup"
                                          >
                                            <img
                                              src={producto.mockupUrl}
                                              alt={`Mockup ${producto.producto}`}
                                              className="h-full w-full object-contain"
                                            />
                                          </span>
                                        ) : (
                                          <span className="h-14 w-14 shrink-0 rounded-2xl border border-white/80 bg-white/70 flex items-center justify-center text-[10px] font-black text-slate-400">
                                            Sin
                                          </span>
                                        )}
                                        <div className="min-w-0">
                                          <p className="text-sm font-black text-slate-900 truncate">
                                            {producto.codigoProducto} ·{" "}
                                            {producto.producto}
                                          </p>
                                          <p className="text-xs font-semibold text-slate-600 truncate">
                                            {producto.nombreProveedor}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap gap-2 text-[10px] font-black shrink-0">
                                        <span className="rounded-full bg-white/80 text-slate-700 px-2 py-1">
                                          Real:{" "}
                                          {formatNumber(producto.stockReal)}
                                        </span>
                                        <span className="rounded-full bg-white/80 text-slate-700 px-2 py-1">
                                          Disp:{" "}
                                          {formatNumber(
                                            producto.stockDisponible,
                                          )}
                                        </span>
                                        <span className="rounded-full bg-white/80 text-slate-700 px-2 py-1">
                                          Esperado:{" "}
                                          {formatNumber(producto.stockEsperado)}
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              },
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {selectedModalMockupUrl && (
                  <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedMockup(selectedModalMockupUrl)}
                      className="h-24 w-24 shrink-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm flex items-center justify-center cursor-zoom-in"
                      title="Ampliar mockup"
                    >
                      <img
                        src={selectedModalMockupUrl}
                        alt="Mockup producto seleccionado"
                        className="h-full w-full object-contain"
                      />
                    </button>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Mockup del producto seleccionado
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        Úsalo para confirmar visualmente que el producto a pedir es el correcto. Haz clic sobre la imagen para ampliarla.
                      </p>
                    </div>
                  </div>
                )}

                <ReadOnlyField
                  label="Código producto"
                  value={
                    modalMode === "manual"
                      ? selectedGeneralProduct?.codigoProducto || ""
                      : selectedAlert?.codigoProducto || ""
                  }
                />
                <ReadOnlyField
                  label="Producto"
                  value={
                    modalMode === "manual"
                      ? selectedGeneralProduct?.producto || ""
                      : selectedIndexData?.producto ||
                        selectedAlert?.producto ||
                        ""
                  }
                />
                <ReadOnlyField
                  label="Proveedor"
                  value={
                    modalMode === "manual"
                      ? selectedGeneralProduct?.nombreProveedor ||
                        selectedGeneralProduct?.proveedorNodo ||
                        ""
                      : selectedAlert?.nombreProveedor ||
                        selectedIndexData?.nombreProveedor ||
                        selectedAlert?.proveedorNodo ||
                        ""
                  }
                />
                <ReadOnlyField
                  label="Unidad de empaque"
                  value={
                    modalMode === "manual"
                      ? selectedGeneralProduct?.unidadDeEmpaque ||
                        "Pendiente en proveedor"
                      : selectedIndexData?.unidadDeEmpaque ||
                        selectedAlert?.unidadDeEmpaque ||
                        "Pendiente en proveedor"
                  }
                />

                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <label className="block text-sm font-black text-slate-700">
                      # cajas / pacas
                    </label>
                    {cajasPacasSugeridas && !cajasPacas && (
                      <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 text-xs font-black">
                        Sugerido: {cajasPacasSugeridas}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={cajasPacas}
                    onChange={(e) => setCajasPacas(e.target.value)}
                    placeholder={
                      cajasPacasSugeridas
                        ? `Sugerido ${cajasPacasSugeridas}; debes digitarlo manualmente`
                        : "Ej: 5"
                    }
                    className={`w-full rounded-2xl border-2 px-4 py-4 text-2xl font-black outline-none focus:bg-white focus:ring-4 ${
                      cajasPacas
                        ? "border-red-300 bg-red-50 text-red-800 focus:border-red-500 focus:ring-red-200"
                        : "border-emerald-300 bg-emerald-50 text-emerald-800 focus:border-emerald-500 focus:ring-emerald-200"
                    }`}
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    El valor verde es solo sugerido. Para comprar debes digitar
                    manualmente las cajas/pacas.
                  </p>
                </div>

                <ReadOnlyField
                  label="Total"
                  value={cajasPacas ? formatNumber(totalModal) : ""}
                  placeholder="Unidad de empaque × cajas/pacas"
                />
              </div>

              <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h4 className="text-sm font-black text-slate-900">
                    Productos agregados en esta orden
                  </h4>
                  <span className="rounded-full bg-[#244C5A]/10 text-[#244C5A] px-3 py-1 text-xs font-black">
                    {modalItems.length} ítem(s)
                  </span>
                </div>

                {modalItems.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Aún no has agregado productos a la orden.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {modalItems.map(({ item, index }) => (
                      <div
                        key={`modal-${modalMode}-${item.alertaId || item.productKey || item.codigoProducto}-${index}`}
                        className="rounded-2xl bg-white border border-slate-200 px-4 py-3 flex items-start justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.mockupUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedMockup(item.mockupUrl || "")}
                              className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white flex items-center justify-center cursor-zoom-in"
                              title="Ampliar mockup"
                            >
                              <img
                                src={item.mockupUrl}
                                alt={`Mockup ${item.producto}`}
                                className="h-full w-full object-contain"
                              />
                            </button>
                          ) : null}
                          <div className="min-w-0">
                            <p className="font-black text-sm text-slate-900 truncate">
                              {item.codigoProducto} · {item.producto}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {item.proveedor} · Cajas/Pacas: {item.cajasPacas} ·
                              Total: {formatNumber(item.totalComprar)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditItemModal(index)}
                            className="rounded-xl border border-[#244C5A]/30 text-[#244C5A] hover:bg-[#244C5A]/5 px-3 py-2 text-xs font-black"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="rounded-xl border border-red-200 text-red-600 hover:bg-red-50 p-2"
                            title="Quitar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                  {editingItemIndex !== null
                    ? "Actualizar producto"
                    : "Agregar a la orden"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCompra(modalMode)}
                  disabled={
                    saving ||
                    loadingCompra ||
                    (modalMode === "alerta"
                      ? alertItems.length === 0
                      : manualItems.length === 0)
                  }
                  className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={19} />
                  ) : (
                    <Save size={19} />
                  )}
                  {saving ? "Creando..." : "Crear orden de compra"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedMockup && (
        <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl rounded-[32px] bg-white border border-white shadow-2xl p-4">
            <button
              type="button"
              onClick={() => setSelectedMockup("")}
              className="absolute right-4 top-4 z-10 h-11 w-11 rounded-2xl bg-slate-900/80 text-white hover:bg-slate-900 flex items-center justify-center"
              aria-label="Cerrar mockup"
            >
              <X size={22} />
            </button>
            <div className="rounded-[24px] bg-slate-50 border border-slate-200 min-h-[420px] max-h-[78vh] flex items-center justify-center overflow-hidden p-4">
              <img
                src={selectedMockup}
                alt="Mockup ampliado"
                className="max-h-[72vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {duplicateOrderModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-[32px] bg-white shadow-2xl border border-white overflow-hidden">
            <div className="bg-[#244C5A] text-white px-6 py-5 flex items-start gap-3">
              <AlertTriangle className="shrink-0 mt-1" size={24} />
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-white/70">
                  Orden existente detectada
                </p>
                <h3 className="text-2xl font-black mt-1">
                  Ya existe una orden para este proveedor
                </h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Proveedor</p>
                <p className="font-black text-slate-900 mt-1">
                  {duplicateOrderModal.proveedor}
                </p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="rounded-2xl bg-white border border-slate-200 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Orden
                    </p>
                    <p className="text-lg font-black text-[#244C5A]">
                      {duplicateOrderModal.consecutivo}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Ítems actuales
                    </p>
                    <p className="text-lg font-black text-[#244C5A]">
                      {duplicateOrderModal.totalItems}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-600">
                Puedes agregar estos productos a la orden existente o crear una
                nueva orden con otro consecutivo.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const tipo = duplicateOrderModal.tipoOrden;
                    setDuplicateOrderModal(null);
                    handleSaveCompra(tipo, "append");
                  }}
                  className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] text-white font-black px-5 py-3"
                >
                  Agregar a existente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tipo = duplicateOrderModal.tipoOrden;
                    setDuplicateOrderModal(null);
                    handleSaveCompra(tipo, "new");
                  }}
                  className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-3"
                >
                  Crear nueva
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDuplicateOrderModal(null)}
                className="w-full rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition"
              >
                Cancelar
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
        className="w-full rounded-2xl border border-[#244C5A]/20 bg-[#244C5A]/5 px-4 py-3 font-bold text-[#244C5A] outline-none cursor-not-allowed"
      />
    </div>
  );
}
