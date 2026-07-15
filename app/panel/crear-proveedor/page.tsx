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
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Eye,
  FileText,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  ShoppingCart,
  Tags,
  UserCog,
  UserPlus,
  Users,
  Building2,
  Download,
  Edit3,
  Home,
  ImageIcon,
  Loader2,
  LogOut,
  PackageSearch,
  Plus,
  Save,
  Search,
  Trash2,
  Truck,
  UploadCloud,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { get, getDatabase, ref, set, update } from "firebase/database";
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "firebase/storage";
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
      { title: "Generar orden de muestra", icon: PackageSearch, href: "/panel/muestra" },
    ],
  },
  {
    title: "Producción",
    icon: Building2,
    items: [
      { title: "Ver órdenes de pedido", icon: Eye, href: "/panel/ordenes_creadas" },
      { title: "Producción x Planta", icon: PackageSearch, href: "/panel/produccionxplanta" },
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

declare global {
  interface Window {
    XLSX?: any;
  }
}

const SHEETJS_CDN_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

function loadXlsxLibrary() {
  return new Promise<any>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Excel solo está disponible en el navegador."));
      return;
    }

    if (window.XLSX) {
      resolve(window.XLSX);
      return;
    }

    const existingScript = document.getElementById("sheetjs-xlsx-cdn") as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.XLSX), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("No fue posible cargar la librería de Excel.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "sheetjs-xlsx-cdn";
    script.src = SHEETJS_CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.XLSX) {
        resolve(window.XLSX);
      } else {
        reject(new Error("La librería de Excel no quedó disponible."));
      }
    };
    script.onerror = () => reject(new Error("No fue posible cargar la librería de Excel."));
    document.body.appendChild(script);
  });
}

type ProviderData = {
  CODIGO: string;
  DIRECCION: string;
  HOJA: string;
  EMAIL: string;
  NIT: string | number;
  PROVEEDOR: string;
  TELEFONO: string | number;
};

type ProductData = {
  CODIGO: string;
  COSTO: string | number;
  HOJA_DETALLE: string;
  PRODUCTO: string;
  STOCK: string | number;
  UNIDAD_DE_EMPAQUE: string | number;
  MOCKUP_URL?: string;
  MOCKUP_PATH?: string;
};

type MovementData = {
  FECHA?: string;
  DESCRIPCION?: string;
  OBSERVACIONES?: string;
  INGRESO?: string | number;
  SALIDA?: string | number;
  SALDO?: string | number;
  STOCK_RESERVADO?: string | number;
  STOCK_DISPONIBLE?: string | number;
  STOCK_TEORICO?: string | number;
  ORDEN_FECHA?: number;
  CREATED_AT?: number;
  UPDATED_AT?: number;
};

type ProviderRow = {
  id: string;
  codigoNodo: string;
  nombreNodo: string;
  codigo: string;
  nombre: string;
  datos: ProviderData;
  productosRaw?: Record<string, any>;
};

type ProductRow = {
  id: string;
  codigo: string;
  producto: string;
  unidadEmpaque: string | number;
  costo: string | number;
  stock: string | number;
  hojaDetalle: string;
  mockupUrl: string;
  mockupPath: string;
  datos: ProductData;
  movimientosRaw?: Record<string, MovementData>;
};

type MovementRow = {
  id: string;
  fecha: string;
  descripcion: string;
  observaciones: string;
  ingreso: string | number;
  salida: string | number;
  saldo: string | number;
  stockReservado: string | number;
  stockDisponible: string | number;
  stockTeorico: string | number;
};

const emptyProvider: ProviderData = {
  CODIGO: "",
  DIRECCION: "",
  HOJA: "",
  EMAIL: "",
  NIT: "",
  PROVEEDOR: "",
  TELEFONO: "",
};

const emptyMovement: MovementData = {
  FECHA: "",
  DESCRIPCION: "",
  OBSERVACIONES: "",
  INGRESO: "",
  SALIDA: "",
  SALDO: "",
  STOCK_RESERVADO: "",
  STOCK_DISPONIBLE: "",
  STOCK_TEORICO: "",
};

const emptyProduct: ProductData = {
  CODIGO: "",
  COSTO: "",
  HOJA_DETALLE: "",
  PRODUCTO: "",
  STOCK: "",
  UNIDAD_DE_EMPAQUE: "",
  MOCKUP_URL: "",
  MOCKUP_PATH: "",
};

function cleanKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[.#$/[\]]/g, "-");
}

function cleanProviderNode(value: string) {
  const cleaned = cleanKey(value);
  return cleaned || "SIN-PROVEEDOR";
}

function normalizeText(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? 0 : numberValue;
}

function normalizeMoney(value: unknown) {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return normalizeText(value) || "—";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function normalizeNumber(value: unknown) {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return normalizeText(value) || "—";

  return new Intl.NumberFormat("es-CO").format(numberValue);
}

function nextMovementKey(movementsRaw?: Record<string, MovementData>) {
  const usedNumbers = Object.keys(movementsRaw || {})
    .map((key) => Number(key.replace(/\D/g, "")))
    .filter((value) => !Number.isNaN(value));

  const nextNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
  return `MOV-${String(nextNumber).padStart(3, "0")}`;
}

function parseDateValue(value: string) {
  if (!value) return 0;

  const clean = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date(`${clean}T00:00:00`).getTime();
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const [day, month, year] = clean.split("/").map(Number);
    return new Date(year, month - 1, day).getTime();
  }

  const parsed = Date.parse(clean);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getMovementNumericId(id: string) {
  const value = Number(id.replace(/\D/g, ""));
  return Number.isNaN(value) ? 0 : value;
}

function movementToRow(key: string, value: MovementData): MovementRow {
  const saldo = normalizeText(value.SALDO);
  const stockReservado = normalizeText(value.STOCK_RESERVADO);
  const stockDisponible = normalizeText(value.STOCK_DISPONIBLE || value.SALDO);
  const stockTeorico =
    value.STOCK_TEORICO !== undefined && value.STOCK_TEORICO !== null
      ? normalizeText(value.STOCK_TEORICO)
      : normalizeText(toNumber(saldo) - toNumber(stockReservado));

  return {
    id: key,
    fecha: normalizeText(value.FECHA),
    descripcion: normalizeText(value.DESCRIPCION),
    observaciones: normalizeText(value.OBSERVACIONES),
    ingreso: normalizeText(value.INGRESO),
    salida: normalizeText(value.SALIDA),
    saldo,
    stockReservado,
    stockDisponible,
    stockTeorico,
  };
}

/*
  IMPORTANTE:
  El JSON histórico puede tener MOV-001 como movimiento reciente
  y MOV-060 como movimiento antiguo. Por eso NO calculamos por número MOV.
  La fuente de orden para saldo es:
  1. FECHA / ORDEN_FECHA
  2. CREATED_AT si existe
  3. número MOV solo como desempate visual
*/
function getMovementOrderValue(id: string, value: MovementData) {
  const fechaOrder =
    typeof value.ORDEN_FECHA === "number" && value.ORDEN_FECHA > 0
      ? value.ORDEN_FECHA
      : parseDateValue(normalizeText(value.FECHA));

  return {
    fechaOrder,
    createdAt:
      typeof value.CREATED_AT === "number" && value.CREATED_AT > 0
        ? value.CREATED_AT
        : getMovementNumericId(id),
    movNumber: getMovementNumericId(id),
  };
}

function sortMovementEntriesAsc(movementsRaw?: Record<string, MovementData>) {
  return Object.entries(movementsRaw || {}).sort(([idA, valueA], [idB, valueB]) => {
    const orderA = getMovementOrderValue(idA, valueA || {});
    const orderB = getMovementOrderValue(idB, valueB || {});

    if (orderA.fechaOrder !== orderB.fechaOrder) {
      return orderA.fechaOrder - orderB.fechaOrder;
    }

    if (orderA.createdAt !== orderB.createdAt) {
      return orderA.createdAt - orderB.createdAt;
    }

    return orderA.movNumber - orderB.movNumber;
  });
}

function sortMovementEntriesDesc(movementsRaw?: Record<string, MovementData>) {
  return [...sortMovementEntriesAsc(movementsRaw)].reverse();
}

function sortMovementRows(movementsRaw?: Record<string, MovementData>) {
  return sortMovementEntriesDesc(movementsRaw).map(([key, value]) =>
    movementToRow(key, value || {})
  );
}

function sortMovementRowsAsc(movementsRaw?: Record<string, MovementData>) {
  return sortMovementEntriesAsc(movementsRaw).map(([key, value]) =>
    movementToRow(key, value || {})
  );
}

function getBaseBalanceFromMovements(movementsRaw?: Record<string, MovementData>) {
  const ascRows = sortMovementRowsAsc(movementsRaw);

  if (ascRows.length === 0) return 0;

  const first = ascRows[0];

  return toNumber(first.saldo) - toNumber(first.ingreso) + toNumber(first.salida);
}

function getPreviousBalanceForMovement(
  movementsRaw: Record<string, MovementData> | undefined,
  movementId: string | null
) {
  if (!movementId) return null;

  /*
    La vista está ordenada de más reciente a más antiguo.
    La fórmula real es:
    saldo fila actual = saldo fila inferior + ingreso actual - salida actual.
    Por eso, al editar una fila, la base es el saldo de la fila de abajo.
  */
  const descRows = sortMovementRows(movementsRaw);
  const index = descRows.findIndex((item) => item.id === movementId);

  if (index < 0) return null;

  const rowBelow = descRows[index + 1];

  if (rowBelow) {
    return toNumber(rowBelow.saldo);
  }

  const current = descRows[index];
  return toNumber(current.saldo) - toNumber(current.ingreso) + toNumber(current.salida);
}

function extractProducts(provider: ProviderRow | null): ProductRow[] {
  if (!provider?.productosRaw) return [];

  return Object.entries(provider.productosRaw)
    .map(([productCode, productNode]) => {
      const datos = productNode?.DATOS_PRODUCTO || {};

      return {
        id: productCode,
        codigo: normalizeText(datos.CODIGO || productCode),
        producto: normalizeText(datos.PRODUCTO),
        unidadEmpaque: normalizeText(datos.UNIDAD_DE_EMPAQUE),
        costo: normalizeText(datos.COSTO),
        stock: normalizeText(datos.STOCK),
        hojaDetalle: normalizeText(datos.HOJA_DETALLE),
        mockupUrl: normalizeText(datos.MOCKUP_URL),
        mockupPath: normalizeText(datos.MOCKUP_PATH),
        datos: {
          CODIGO: normalizeText(datos.CODIGO || productCode),
          COSTO: normalizeText(datos.COSTO),
          HOJA_DETALLE: normalizeText(datos.HOJA_DETALLE),
          PRODUCTO: normalizeText(datos.PRODUCTO),
          STOCK: normalizeText(datos.STOCK),
          UNIDAD_DE_EMPAQUE: normalizeText(datos.UNIDAD_DE_EMPAQUE),
          MOCKUP_URL: normalizeText(datos.MOCKUP_URL),
          MOCKUP_PATH: normalizeText(datos.MOCKUP_PATH),
        },
        movimientosRaw: productNode?.MOVIMIENTOS || {},
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function getMovementOperation(value: string) {
  const clean = value.trim().toUpperCase();
  if (clean.startsWith("COMPRA-")) return "COMPRA";
  if (clean.startsWith("OP-")) return "OP";
  if (clean.startsWith("REINTEGRO-")) return "REINTEGRO";
  if (clean.startsWith("AJUSTE-")) return "AJUSTE";
  return "";
}

function getMovementConsecutive(value: string) {
  const clean = value.trim().toUpperCase();
  return clean.replace(/^(COMPRA|OP|REINTEGRO|AJUSTE)-?/, "");
}

function getLotBalances(movementsRaw?: Record<string, MovementData>) {
  const lots: Record<
    string,
    { lote: string; balance: number; firstOrder: number; lastOrder: number }
  > = {};

  sortMovementEntriesAsc(movementsRaw).forEach(([key, movement], index) => {
    const lote = normalizeText(movement.OBSERVACIONES).trim().toUpperCase();
    if (!lote) return;

    const order = getMovementOrderValue(key, movement || {});
    const orderValue = order.fechaOrder || order.createdAt || index + 1;

    if (!lots[lote]) {
      lots[lote] = {
        lote,
        balance: 0,
        firstOrder: orderValue,
        lastOrder: orderValue,
      };
    }

    lots[lote].balance += toNumber(movement.INGRESO) - toNumber(movement.SALIDA);
    lots[lote].lastOrder = orderValue;
  });

  return Object.values(lots).sort((a, b) => a.firstOrder - b.firstOrder);
}

function getOldestLotWithBalance(movementsRaw?: Record<string, MovementData>) {
  return getLotBalances(movementsRaw).find((lot) => lot.balance > 0) || null;
}

function getLotsNewestFirst(movementsRaw?: Record<string, MovementData>) {
  return getLotBalances(movementsRaw)
    .filter((lot) => lot.lote)
    .sort((a, b) => b.lastOrder - a.lastOrder);
}


export default function CrearProveedorPage() {
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

  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);

  const [form, setForm] = useState<ProviderData>(emptyProvider);
  const [productForm, setProductForm] = useState<ProductData>(emptyProduct);
  const [movementForm, setMovementForm] = useState<MovementData>(emptyMovement);
  const [mockupFile, setMockupFile] = useState<File | null>(null);
  const [mockupPreview, setMockupPreview] = useState("");
  const [selectedMockup, setSelectedMockup] = useState("");
  const [operationType, setOperationType] = useState("");
  const [operationConsecutive, setOperationConsecutive] = useState("");
  const [adjustmentApproved] = useState(false);

  const [editingProvider, setEditingProvider] = useState<ProviderRow | null>(
    null
  );
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [movementPage, setMovementPage] = useState(1);

  const [selectedProvider, setSelectedProvider] = useState<ProviderRow | null>(
    null
  );
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(
    null
  );

  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [movementSearch, setMovementSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Usuarios: true,
    Bodega: true,
    "Comercial": true,
    Producción: true,
    Compras: true,
    Etiquetas: false,
  });

  const userName = useMemo(() => {
    return (
      profile?.nombre ||
      authUser?.displayName ||
      authUser?.email?.split("@")[0] ||
      "Administrador"
    );
  }, [profile, authUser]);

  const userRole = useMemo(() => {
    return (
      (profile as any)?.rolNombre ||
      (profile as any)?.role ||
      (profile as any)?.rol ||
      "Sin rol"
    );
  }, [profile]);

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((current) => ({
      ...current,
      [sectionTitle]: !(current[sectionTitle] ?? false),
    }));
  };

  const isMaster = useMemo(() => {
    const roleText = `${(profile as any)?.rolNombre || ""} ${(profile as any)?.role || ""} ${(profile as any)?.rol || ""}`.toLowerCase();
    return roleText.includes("master");
  }, [profile]);

  const filteredProviders = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    if (!cleanSearch) return providers;

    return providers.filter((item) => {
      return (
        item.codigo.toLowerCase().includes(cleanSearch) ||
        item.nombre.toLowerCase().includes(cleanSearch) ||
        normalizeText(item.datos.NIT).toLowerCase().includes(cleanSearch) ||
        normalizeText(item.datos.EMAIL).toLowerCase().includes(cleanSearch) ||
        normalizeText(item.datos.TELEFONO).toLowerCase().includes(cleanSearch) ||
        normalizeText(item.datos.DIRECCION).toLowerCase().includes(cleanSearch)
      );
    });
  }, [providers, search]);

  const products = useMemo(() => {
    return extractProducts(selectedProvider);
  }, [selectedProvider]);

  const filteredProducts = useMemo(() => {
    const cleanSearch = productSearch.trim().toLowerCase();

    if (!cleanSearch) return products;

    return products.filter((item) => {
      return (
        item.codigo.toLowerCase().includes(cleanSearch) ||
        item.producto.toLowerCase().includes(cleanSearch) ||
        normalizeText(item.unidadEmpaque).toLowerCase().includes(cleanSearch) ||
        normalizeText(item.hojaDetalle).toLowerCase().includes(cleanSearch)
      );
    });
  }, [products, productSearch]);

  const movementRows = useMemo(() => {
    return sortMovementRows(selectedProduct?.movimientosRaw);
  }, [selectedProduct]);

  const lotOptions = useMemo(() => {
    return getLotsNewestFirst(selectedProduct?.movimientosRaw);
  }, [selectedProduct]);

  const mustSelectExistingLot = useMemo(() => {
    return operationType === "OP" || operationType === "REINTEGRO" || operationType === "AJUSTE";
  }, [operationType]);

  const filteredMovements = useMemo(() => {
    const cleanSearch = movementSearch.trim().toLowerCase();

    if (!cleanSearch) return movementRows;

    return movementRows.filter((item) => {
      return (
        item.fecha.toLowerCase().includes(cleanSearch) ||
        item.descripcion.toLowerCase().includes(cleanSearch) ||
        item.observaciones.toLowerCase().includes(cleanSearch) ||
        normalizeText(item.ingreso).toLowerCase().includes(cleanSearch) ||
        normalizeText(item.salida).toLowerCase().includes(cleanSearch) ||
        normalizeText(item.saldo).toLowerCase().includes(cleanSearch)
      );
    });
  }, [movementRows, movementSearch]);

  const movementTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredMovements.length / 10));
  }, [filteredMovements.length]);

  const paginatedMovements = useMemo(() => {
    const start = (movementPage - 1) * 10;
    return filteredMovements.slice(start, start + 10);
  }, [filteredMovements, movementPage]);

  const currentBalance = useMemo(() => {
    const firstMovement = movementRows[0];
    return toNumber(firstMovement?.saldo || selectedProduct?.stock || 0);
  }, [movementRows, selectedProduct]);

  const movementBaseBalance = useMemo(() => {
    const previousBalance = getPreviousBalanceForMovement(
      selectedProduct?.movimientosRaw,
      editingMovementId
    );

    return previousBalance === null ? currentBalance : previousBalance;
  }, [selectedProduct, editingMovementId, currentBalance]);

  const calculatedBalance = useMemo(() => {
    const ingreso = toNumber(movementForm.INGRESO);
    const salida = toNumber(movementForm.SALIDA);

    return movementBaseBalance + ingreso - salida;
  }, [movementBaseBalance, movementForm.INGRESO, movementForm.SALIDA]);

  useEffect(() => {
    setMovementPage(1);
  }, [selectedProduct, movementSearch]);

  const totalStock = useMemo(() => {
    return products.reduce((acc, item) => {
      const value = Number(item.stock);
      return Number.isNaN(value) ? acc : acc + value;
    }, 0);
  }, [products]);

  const totalValorInventario = useMemo(() => {
    return products.reduce((acc, item) => {
      const stock = Number(item.stock);
      const costo = Number(item.costo);

      if (Number.isNaN(stock) || Number.isNaN(costo)) return acc;

      return acc + stock * costo;
    }, 0);
  }, [products]);

  useEffect(() => {
    if (!loadingPermissions && !authUser) {
      router.replace("/");
    }
  }, [loadingPermissions, authUser, router]);

  async function reloadProviders() {
    setLoadingProviders(true);
    setError("");

    try {
      const snapshot = await get(ref(realtimeDb, "PROVEEDORES"));

      if (!snapshot.exists()) {
        setProviders([]);
        setLoadingProviders(false);
        return;
      }

      const rawProviders = snapshot.val() || {};
      const rows: ProviderRow[] = [];

      Object.entries(rawProviders).forEach(([providerCode, providerNode]) => {
        const providerNames = providerNode as Record<string, any>;

        Object.entries(providerNames || {}).forEach(
          ([providerName, providerContent]) => {
            const datos = providerContent?.DATOS || {};

            rows.push({
              id: `${providerCode}/${providerName}`,
              codigoNodo: providerCode,
              nombreNodo: providerName,
              codigo: normalizeText(datos.CODIGO || providerCode),
              nombre: normalizeText(datos.PROVEEDOR || providerName),
              datos: {
                CODIGO: normalizeText(datos.CODIGO || providerCode),
                DIRECCION: normalizeText(datos.DIRECCION),
                HOJA: normalizeText(datos.HOJA),
                EMAIL: normalizeText(datos.EMAIL),
                NIT: normalizeText(datos.NIT),
                PROVEEDOR: normalizeText(datos.PROVEEDOR || providerName),
                TELEFONO: normalizeText(datos.TELEFONO),
              },
              productosRaw: providerContent?.PRODUCTOS || {},
            });
          }
        );
      });

      rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setProviders(rows);

      if (selectedProvider) {
        const updatedSelected = rows.find((item) => item.id === selectedProvider.id);
        setSelectedProvider(updatedSelected || null);

        if (selectedProduct && updatedSelected) {
          const updatedProduct = extractProducts(updatedSelected).find(
            (item) => item.id === selectedProduct.id
          );
          setSelectedProduct(updatedProduct || null);
        }
      }
    } catch (err: any) {
      setError(`No fue posible cargar proveedores. ${err?.message || ""}`);
    } finally {
      setLoadingProviders(false);
    }
  }

  useEffect(() => {
    if (loadingPermissions) return;

    if (!authUser) {
      setLoadingProviders(false);
      return;
    }

    if (!can("proveedoresBodega", "ver")) {
      setLoadingProviders(false);
      return;
    }

    reloadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingPermissions, authUser, realtimeDb, can]);

  const resetForm = () => {
    setForm(emptyProvider);
    setEditingProvider(null);
    setError("");
    setMessage("");
  };

  const resetMovementForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    setMovementForm({
      ...emptyMovement,
      FECHA: today,
      SALDO: calculatedBalance,
    });
  };

  const handleChange = (field: keyof ProviderData, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleProductChange = (field: keyof ProductData, value: string) => {
    setProductForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleMovementChange = (field: keyof MovementData, value: string) => {
    setMovementForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleEdit = (provider: ProviderRow) => {
    if (!can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para editar proveedores.");
      return;
    }

    setEditingProvider(provider);
    setForm(provider.datos);
    setSelectedProvider(null);
    setSelectedProduct(null);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetProductForm = () => {
    setProductForm(emptyProduct);
    setMockupFile(null);
    setMockupPreview("");
    setEditingProduct(null);
    setError("");
    setMessage("");
  };

  const handleMockupChange = (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen válida para el mockup.");
      return;
    }

    setMockupFile(file);
    setMockupPreview(URL.createObjectURL(file));
  };

  const removeMockup = () => {
    setMockupFile(null);
    setMockupPreview("");
    setProductForm((current) => ({
      ...current,
      MOCKUP_URL: "",
      MOCKUP_PATH: "",
    }));
  };

  const uploadMockupIfNeeded = async (
    providerCode: string,
    providerName: string,
    productCode: string
  ) => {
    if (!mockupFile) {
      return {
        MOCKUP_URL: productForm.MOCKUP_URL || "",
        MOCKUP_PATH: productForm.MOCKUP_PATH || "",
      };
    }

    const extension = mockupFile.name.split(".").pop() || "jpg";
    const path = `proveedores/${providerCode}/${providerName}/productos/${productCode}/mockup.${extension}`;
    const fileRef = storageRef(storage, path);

    await uploadBytes(fileRef, mockupFile);
    const url = await getDownloadURL(fileRef);

    return {
      MOCKUP_URL: url,
      MOCKUP_PATH: path,
    };
  };

  const handleOpenProvider = (provider: ProviderRow) => {
    setSelectedProvider(provider);
    setSelectedProduct(null);
    setProductForm(emptyProduct);
    setEditingProduct(null);
    setProductSearch("");
    setMovementSearch("");
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEditProduct = (product: ProductRow) => {
    if (!can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para editar productos.");
      return;
    }

    setEditingProduct(product);
    setProductForm(product.datos);
    setMockupFile(null);
    setMockupPreview(product.mockupUrl || "");
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenProduct = (product: ProductRow) => {
    setSelectedProduct(product);
    setMovementSearch("");
    const today = new Date().toISOString().slice(0, 10);

    setMovementForm({
      FECHA: today,
      DESCRIPCION: "",
      OBSERVACIONES: "",
      INGRESO: "",
      SALIDA: "",
      SALDO: "",
      STOCK_RESERVADO: "",
      STOCK_DISPONIBLE: "",
      STOCK_TEORICO: "",
    });
    setOperationType("");
    setOperationConsecutive("");
    setEditingMovementId(null);
    setMovementPage(1);

    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToProviders = () => {
    setSelectedProvider(null);
    setSelectedProduct(null);
    setProductSearch("");
    setMovementSearch("");
    setError("");
    setMessage("");
  };

  const handleBackToProducts = () => {
    setSelectedProduct(null);
    setMovementSearch("");
    setError("");
    setMessage("");
  };


  const handleExportExcel = async () => {
    setError("");
    setMessage("");

    let XLSX: any;
    try {
      XLSX = await loadXlsxLibrary();
    } catch (err: any) {
      setError(`${err?.message || "No fue posible cargar Excel."} Revisa tu conexión o instala el paquete con: npm install xlsx`);
      return;
    }
    const proveedoresSheet = providers.map((provider) => ({
      CODIGO: provider.codigo,
      PROVEEDOR_NODO: provider.nombreNodo,
      PROVEEDOR: provider.nombre,
      EMAIL: normalizeText(provider.datos.EMAIL),
      NIT: normalizeText(provider.datos.NIT),
      DIRECCION: normalizeText(provider.datos.DIRECCION),
      TELEFONO: normalizeText(provider.datos.TELEFONO),
      HOJA: normalizeText(provider.datos.HOJA),
      TOTAL_PRODUCTOS: Object.keys(provider.productosRaw || {}).length,
    }));

    const productosSheet = providers.flatMap((provider) =>
      extractProducts(provider).map((product) => ({
        CODIGO_PROVEEDOR: provider.codigo,
        PROVEEDOR_NODO: provider.nombreNodo,
        PROVEEDOR: provider.nombre,
        CODIGO_PRODUCTO: product.codigo,
        PRODUCTO: product.producto,
        UNIDAD_DE_EMPAQUE: normalizeText(product.unidadEmpaque),
        COSTO: normalizeText(product.costo),
        STOCK: normalizeText(product.stock),
        MOCKUP_URL: normalizeText(product.mockupUrl),
        MOCKUP_PATH: normalizeText(product.mockupPath),
        HOJA_DETALLE: normalizeText(product.hojaDetalle),
      }))
    );

    const ayudaSheet = [
      {
        SECCION: "PROVEEDORES",
        INSTRUCCION:
          "Cada fila crea o actualiza un proveedor. No cambies CODIGO si ya existe.",
      },
      {
        SECCION: "PRODUCTOS",
        INSTRUCCION:
          "Cada producto debe tener CODIGO_PROVEEDOR. PROVEEDOR_NODO se usa como ruta segura en Firebase; PROVEEDOR conserva el nombre visible.",
      },
      {
        SECCION: "MOCKUP",
        INSTRUCCION:
          "Desde Excel puedes conservar URL/PATH existentes. Para subir imágenes nuevas usa el formulario web.",
      },
    ];

    const workbook = XLSX.utils.book_new();
    const wsProveedores = XLSX.utils.json_to_sheet(proveedoresSheet.length ? proveedoresSheet : [{
      CODIGO: "",
      PROVEEDOR_NODO: "",
      PROVEEDOR: "",
      EMAIL: "",
      NIT: "",
      DIRECCION: "",
      TELEFONO: "",
      HOJA: "",
      TOTAL_PRODUCTOS: "",
    }]);
    const wsProductos = XLSX.utils.json_to_sheet(productosSheet.length ? productosSheet : [{
      CODIGO_PROVEEDOR: "",
      PROVEEDOR_NODO: "",
      PROVEEDOR: "",
      CODIGO_PRODUCTO: "",
      PRODUCTO: "",
      UNIDAD_DE_EMPAQUE: "",
      COSTO: "",
      STOCK: "",
      MOCKUP_URL: "",
      MOCKUP_PATH: "",
      HOJA_DETALLE: "",
    }]);
    const wsAyuda = XLSX.utils.json_to_sheet(ayudaSheet);

    wsProveedores["!cols"] = [
      { wch: 16 },
      { wch: 34 },
      { wch: 34 },
      { wch: 34 },
      { wch: 18 },
      { wch: 42 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
    ];
    wsProductos["!cols"] = [
      { wch: 18 },
      { wch: 34 },
      { wch: 34 },
      { wch: 18 },
      { wch: 44 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 44 },
      { wch: 44 },
      { wch: 20 },
    ];
    wsAyuda["!cols"] = [{ wch: 18 }, { wch: 90 }];

    XLSX.utils.book_append_sheet(workbook, wsProveedores, "Proveedores");
    XLSX.utils.book_append_sheet(workbook, wsProductos, "Productos");
    XLSX.utils.book_append_sheet(workbook, wsAyuda, "Ayuda");
    XLSX.writeFile(workbook, `proveedores-bodega-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleImportExcel = async (file?: File) => {
    if (!file) return;

    setError("");
    setMessage("");

    if (!can("proveedoresBodega", "crear") && !can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para importar proveedores o productos.");
      return;
    }

    const confirmImport = window.confirm(
      "Advertencia: al importar este Excel se crearán proveedores/productos nuevos y se actualizarán los campos existentes que coincidan con el mismo código de proveedor, nodo de proveedor y código de producto. ¿Deseas continuar?"
    );

    if (!confirmImport) return;

    setImportingExcel(true);

    try {
      const XLSX = await loadXlsxLibrary();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const proveedoresRows = XLSX.utils.sheet_to_json(
        workbook.Sheets["Proveedores"] || workbook.Sheets[workbook.SheetNames[0]] || {}
      ) as Record<string, any>[];
      const productosRows = XLSX.utils.sheet_to_json(
        workbook.Sheets["Productos"] || workbook.Sheets[workbook.SheetNames[1]] || {}
      ) as Record<string, any>[];

      if (proveedoresRows.length === 0 && productosRows.length === 0) {
        setError("El Excel no contiene datos para importar.");
        return;
      }

      const updates: Record<string, any> = {};
      let proveedoresCount = 0;
      let productosCount = 0;

      proveedoresRows.forEach((row) => {
        const codigo = cleanKey(normalizeText(row.CODIGO));
        const proveedor = normalizeText(row.PROVEEDOR).trim().toUpperCase();
        const proveedorNodo = cleanProviderNode(normalizeText(row.PROVEEDOR_NODO || proveedor));

        if (!codigo || !proveedor) return;

        updates[`PROVEEDORES/${codigo}/${proveedorNodo}/DATOS`] = {
          CODIGO: codigo,
          PROVEEDOR: proveedor,
          EMAIL: normalizeText(row.EMAIL).trim(),
          NIT: normalizeText(row.NIT).trim(),
          DIRECCION: normalizeText(row.DIRECCION).trim(),
          TELEFONO: normalizeText(row.TELEFONO).trim(),
          HOJA: normalizeText(row.HOJA).trim(),
        };
        proveedoresCount += 1;
      });

      productosRows.forEach((row) => {
        const codigoProveedor = cleanKey(normalizeText(row.CODIGO_PROVEEDOR));
        const proveedor = normalizeText(row.PROVEEDOR).trim().toUpperCase();
        const proveedorNodo = cleanProviderNode(normalizeText(row.PROVEEDOR_NODO || proveedor));
        const codigoProducto = cleanKey(normalizeText(row.CODIGO_PRODUCTO || row.CODIGO));
        const producto = normalizeText(row.PRODUCTO).trim().toUpperCase();

        if (!codigoProveedor || !proveedor || !codigoProducto || !producto) return;


        updates[`PROVEEDORES/${codigoProveedor}/${proveedorNodo}/PRODUCTOS/${codigoProducto}/DATOS_PRODUCTO`] = {
          CODIGO: codigoProducto,
          PRODUCTO: producto,
          UNIDAD_DE_EMPAQUE: normalizeText(row.UNIDAD_DE_EMPAQUE).trim(),
          COSTO: normalizeText(row.COSTO).trim(),
          STOCK: normalizeText(row.STOCK).trim(),
          MOCKUP_URL: normalizeText(row.MOCKUP_URL).trim(),
          MOCKUP_PATH: normalizeText(row.MOCKUP_PATH).trim(),
          HOJA_DETALLE: normalizeText(row.HOJA_DETALLE).trim(),
        };
        productosCount += 1;
      });

      if (Object.keys(updates).length === 0) {
        setError("No se encontraron filas válidas. Revisa que existan CODIGO, PROVEEDOR y CODIGO_PRODUCTO.");
        return;
      }

      await update(ref(realtimeDb), updates);
      await reloadProviders();
      setMessage(`Importación realizada correctamente. Se procesaron ${proveedoresCount} proveedores y ${productosCount} productos. Los registros existentes fueron actualizados con los campos del Excel.`);
    } catch (err: any) {
      setError(`No fue posible importar el Excel. ${err?.message || ""}`);
    } finally {
      setImportingExcel(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (editingProvider && !can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para editar proveedores.");
      return;
    }

    if (!editingProvider && !can("proveedoresBodega", "crear")) {
      setError("Tu rol no tiene permiso para crear proveedores.");
      return;
    }

    const codigo = cleanKey(form.CODIGO);
    const proveedor = form.PROVEEDOR.trim().toUpperCase();
    const proveedorNodo = cleanProviderNode(proveedor);

    if (!codigo) {
      setError("El código del proveedor es obligatorio.");
      return;
    }

    if (!proveedor) {
      setError("El nombre del proveedor es obligatorio.");
      return;
    }

    setSaving(true);

    try {
      const providerPath = `PROVEEDORES/${codigo}/${proveedorNodo}`;
      const datos: ProviderData = {
        CODIGO: codigo,
        PROVEEDOR: proveedor,
        EMAIL: form.EMAIL,
        NIT: form.NIT,
        DIRECCION: form.DIRECCION,
        TELEFONO: form.TELEFONO,
        HOJA: form.HOJA,
      };

      if (editingProvider) {
        const oldPath = `PROVEEDORES/${editingProvider.id}`;

        if (editingProvider.id !== `${codigo}/${proveedorNodo}`) {
          const oldSnapshot = await get(ref(realtimeDb, oldPath));
          const oldData = oldSnapshot.exists() ? oldSnapshot.val() : {};

          await set(ref(realtimeDb, providerPath), {
            ...oldData,
            DATOS: datos,
          });

          await set(ref(realtimeDb, oldPath), null);
        } else {
          await update(ref(realtimeDb, providerPath), {
            DATOS: datos,
          });
        }

        setMessage("Proveedor actualizado correctamente.");
      } else {
        const providerSnapshot = await get(ref(realtimeDb, providerPath));

        if (providerSnapshot.exists()) {
          setError("Ya existe un proveedor con ese código y nombre.");
          setSaving(false);
          return;
        }

        await set(ref(realtimeDb, providerPath), {
          DATOS: datos,
          PRODUCTOS: {},
        });

        setMessage("Proveedor creado correctamente.");
      }

      resetForm();
      await reloadProviders();
    } catch (err: any) {
      setError(`No fue posible guardar el proveedor. ${err?.message || ""}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!selectedProvider) {
      setError("Selecciona primero un proveedor.");
      return;
    }

    if (editingProduct && !can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para editar productos.");
      return;
    }

    if (!editingProduct && !can("proveedoresBodega", "crear")) {
      setError("Tu rol no tiene permiso para crear productos.");
      return;
    }

    const codigo = cleanKey(productForm.CODIGO);

    if (!codigo) {
      setError("El código del producto es obligatorio.");
      return;
    }

    if (!productForm.PRODUCTO.trim()) {
      setError("El nombre del producto es obligatorio.");
      return;
    }

    setSavingProduct(true);

    try {
      const providerPath = `PROVEEDORES/${selectedProvider.codigoNodo}/${selectedProvider.nombreNodo}`;
      const oldProductPath = `${providerPath}/PRODUCTOS/${editingProduct?.id || codigo}`;
      const newProductPath = `${providerPath}/PRODUCTOS/${codigo}`;

      const mockupData = await uploadMockupIfNeeded(
        selectedProvider.codigoNodo,
        selectedProvider.nombreNodo,
        codigo
      );

      const datos: ProductData = {
        CODIGO: codigo,
        PRODUCTO: productForm.PRODUCTO.trim().toUpperCase(),
        UNIDAD_DE_EMPAQUE: productForm.UNIDAD_DE_EMPAQUE,
        COSTO: productForm.COSTO,
        STOCK: editingProduct ? editingProduct.datos.STOCK : 0,
        HOJA_DETALLE: productForm.HOJA_DETALLE,
        MOCKUP_URL: mockupData.MOCKUP_URL,
        MOCKUP_PATH: mockupData.MOCKUP_PATH,
      };

      if (editingProduct && editingProduct.id !== codigo) {
        const oldSnapshot = await get(ref(realtimeDb, oldProductPath));
        const oldData = oldSnapshot.exists() ? oldSnapshot.val() : {};

        await set(ref(realtimeDb, newProductPath), {
          ...oldData,
          DATOS_PRODUCTO: datos,
        });

        await set(ref(realtimeDb, oldProductPath), null);
      } else {
        await update(ref(realtimeDb, newProductPath), {
          DATOS_PRODUCTO: datos,
        });

        const productSnapshot = await get(ref(realtimeDb, newProductPath));
        if (!productSnapshot.exists()) {
          await set(ref(realtimeDb, newProductPath), {
            DATOS_PRODUCTO: datos,
            MOVIMIENTOS: {},
          });
        }
      }

      setMessage(editingProduct ? "Producto actualizado correctamente." : "Producto creado correctamente.");
      resetProductForm();
      await reloadProviders();
    } catch (err: any) {
      setError(`No fue posible guardar el producto. ${err?.message || ""}`);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleEditMovement = (movement: MovementRow) => {
    if (!can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para editar movimientos.");
      return;
    }

    setEditingMovementId(movement.id);
    setMovementForm({
      FECHA: movement.fecha,
      DESCRIPCION: movement.descripcion,
      OBSERVACIONES: movement.observaciones,
      INGRESO: movement.ingreso,
      SALIDA: movement.salida,
      SALDO: movement.saldo,
      STOCK_RESERVADO: movement.stockReservado,
      STOCK_DISPONIBLE: movement.stockDisponible,
      STOCK_TEORICO: movement.stockTeorico,
    });
    setOperationType(getMovementOperation(movement.descripcion));
    setOperationConsecutive(getMovementConsecutive(movement.descripcion));
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelMovementEdit = () => {
    setEditingMovementId(null);
    setOperationType("");
    setOperationConsecutive("");
    setMovementForm({
      FECHA: new Date().toISOString().slice(0, 10),
      DESCRIPCION: "",
      OBSERVACIONES: "",
      INGRESO: "",
      SALIDA: "",
      SALDO: "",
      STOCK_RESERVADO: "",
      STOCK_DISPONIBLE: "",
      STOCK_TEORICO: "",
    });
  };

  const recalculateAndSaveMovements = async (
    productPath: string,
    movementsRaw: Record<string, MovementData>,
    movementKeyToSave: string,
    movementToSave: MovementData
  ) => {
    const updatedMovements = {
      ...(movementsRaw || {}),
      [movementKeyToSave]: movementToSave,
    };

    /*
      Fórmula igual al Excel en la vista:
      - La tabla se ve de fecha más reciente hacia abajo.
      - Cada fila calcula con el saldo de la fila inferior:
        saldo actual = saldo inferior + ingreso actual - salida actual.
      - Si se edita una fila vieja, se recalcula esa fila y todas las filas
        que están por encima de ella, es decir, hacia la fecha más reciente.
      - No usamos MOV-001, MOV-060 como orden lógico porque el JSON histórico
        puede venir invertido.
    */

    const descRows = sortMovementRows(updatedMovements);
    const targetIndex = descRows.findIndex((row) => row.id === movementKeyToSave);

    if (targetIndex < 0) {
      throw new Error("No fue posible ubicar el movimiento para recalcular.");
    }

    const rowBelowTarget = descRows[targetIndex + 1];

    let runningBalance = rowBelowTarget
      ? toNumber(rowBelowTarget.saldo)
      : (() => {
          const original = movementsRaw?.[movementKeyToSave];

          if (original) {
            return (
              toNumber(original.SALDO) -
              toNumber(original.INGRESO) +
              toNumber(original.SALIDA)
            );
          }

          return 0;
        })();

    const updates: Record<string, any> = {};

    for (let index = targetIndex; index >= 0; index -= 1) {
      const row = descRows[index];

      runningBalance =
        runningBalance + toNumber(row.ingreso) - toNumber(row.salida);

      if (row.id === movementKeyToSave) {
        updates[`MOVIMIENTOS/${row.id}`] = {
          ...movementToSave,
          SALDO: runningBalance,
        };
      } else {
        updates[`MOVIMIENTOS/${row.id}/SALDO`] = runningBalance;
      }
    }

    /*
      El stock del producto es el saldo de la fila superior,
      es decir, la fecha más reciente.
    */
    const newestRow = descRows[0];
    const newestBalance =
      updates[`MOVIMIENTOS/${newestRow.id}/SALDO`] ??
      updates[`MOVIMIENTOS/${newestRow.id}`]?.SALDO ??
      newestRow.saldo;

    updates["DATOS_PRODUCTO/STOCK"] = toNumber(newestBalance);

    await update(ref(realtimeDb, productPath), updates);

    return toNumber(newestBalance);
  };

  const saveInventoryAlertIfNeeded = async (
    productPath: string,
    productCode: string,
    productName: string,
    lote: string,
    saldo: number,
    stockReservado: number,
    stockTeorico: number
  ) => {
    const alerts: Record<string, any> = {};
    const now = Date.now();
    const safeLote = cleanKey(lote || "SIN-LOTE");

    if (saldo < 0) {
      alerts[`ALERTAS_BODEGA/SALDO_NEGATIVO/${productCode}_${safeLote}`] = {
        tipo: "SALDO_NEGATIVO",
        productoCodigo: productCode,
        producto: productName,
        lote,
        saldo,
        stockReservado,
        stockTeorico,
        productPath,
        activo: true,
        createdAt: now,
        updatedAt: now,
      };
    }

    if (stockTeorico < 0) {
      alerts[`ALERTAS_BODEGA/STOCK_TEORICO_NEGATIVO/${productCode}_${safeLote}`] = {
        tipo: "STOCK_TEORICO_NEGATIVO",
        productoCodigo: productCode,
        producto: productName,
        lote,
        saldo,
        stockReservado,
        stockTeorico,
        productPath,
        activo: true,
        createdAt: now,
        updatedAt: now,
      };
    }

    if (Object.keys(alerts).length > 0) {
      await update(ref(realtimeDb), alerts);
    }
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!selectedProvider || !selectedProduct) {
      setError("Selecciona un proveedor y un producto.");
      return;
    }

    if (!can("proveedoresBodega", "crear") && !can("proveedoresBodega", "editar")) {
      setError("Tu rol no tiene permiso para crear movimientos.");
      return;
    }

    const ingreso = toNumber(movementForm.INGRESO);
    const salida = toNumber(movementForm.SALIDA);

    if (!movementForm.FECHA) {
      setError("La fecha del movimiento es obligatoria.");
      return;
    }

    const selectedOperation = operationType.trim().toUpperCase();
    const operationSuffix = operationConsecutive.trim().toUpperCase();
    const lote = normalizeText(movementForm.OBSERVACIONES).trim().toUpperCase();

    if (!selectedOperation) {
      setError("Selecciona la operación del movimiento.");
      return;
    }

    if (!operationSuffix) {
      setError("Digita el consecutivo o referencia de la operación.");
      return;
    }

    if (!lote) {
      setError("El lote es obligatorio.");
      return;
    }

    if ((selectedOperation === "OP" || selectedOperation === "REINTEGRO" || selectedOperation === "AJUSTE") && !editingMovementId) {
      const loteExiste = lotOptions.some((item) => item.lote === lote);
      if (!loteExiste) {
        setError("Para OP, REINTEGRO o AJUSTE debes seleccionar un lote existente.");
        return;
      }
    }

    if (selectedOperation === "AJUSTE" && !isMaster && !adjustmentApproved) {
      setError("La operación AJUSTE está bloqueada hasta aprobación del usuario master.");
      return;
    }

    if (ingreso > 0 && salida > 0) {
      setError("Un movimiento no debe tener ingreso y salida al mismo tiempo.");
      return;
    }

    if (ingreso <= 0 && salida <= 0) {
      setError("Debes registrar un ingreso o una salida.");
      return;
    }

    if ((selectedOperation === "COMPRA" || selectedOperation === "REINTEGRO") && salida > 0) {
      setError(`${selectedOperation} solo permite ingreso.`);
      return;
    }

    if (selectedOperation === "OP" && ingreso > 0) {
      setError("OP solo permite salida.");
      return;
    }

    if (selectedOperation !== "AJUSTE") {
      const oldestLot = getOldestLotWithBalance(selectedProduct.movimientosRaw);
      if (salida > 0 && oldestLot && oldestLot.lote !== lote) {
        setError(
          `Primero debes dejar en cero el lote ${oldestLot.lote}. Tiene ${normalizeNumber(oldestLot.balance)} disponibles antes de usar otro lote.`
        );
        return;
      }
    }

    setSavingMovement(true);

    try {
      const movimientoKey =
        editingMovementId || nextMovementKey(selectedProduct.movimientosRaw);
      const providerPath = `PROVEEDORES/${selectedProvider.codigoNodo}/${selectedProvider.nombreNodo}`;
      const productPath = `${providerPath}/PRODUCTOS/${selectedProduct.id}`;

      const now = Date.now();

      const stockReservado = toNumber(movementForm.STOCK_RESERVADO);
      const operationCode = `${selectedOperation}-${operationSuffix}`;

      const movimiento: MovementData = {
        FECHA: movementForm.FECHA,
        DESCRIPCION: operationCode,
        OBSERVACIONES: lote,
        INGRESO: ingreso > 0 ? ingreso : "",
        SALIDA: salida > 0 ? salida : "",
        SALDO: 0,
        STOCK_RESERVADO: stockReservado || "",
        STOCK_DISPONIBLE: 0,
        STOCK_TEORICO: 0,
        ORDEN_FECHA: parseDateValue(normalizeText(movementForm.FECHA)),
        ...(editingMovementId ? { UPDATED_AT: now } : { CREATED_AT: now }),
      };

      const newestBalance = await recalculateAndSaveMovements(
        productPath,
        selectedProduct.movimientosRaw || {},
        movimientoKey,
        movimiento
      );

      const stockTeorico = newestBalance - stockReservado;

      await update(ref(realtimeDb, `${productPath}/MOVIMIENTOS/${movimientoKey}`), {
        STOCK_DISPONIBLE: newestBalance,
        STOCK_TEORICO: stockTeorico,
      });

      try {
        await saveInventoryAlertIfNeeded(
          productPath,
          selectedProduct.codigo,
          selectedProduct.producto,
          lote,
          newestBalance,
          stockReservado,
          stockTeorico
        );
      } catch (alertErr) {
        console.warn("El movimiento se guardó, pero no fue posible registrar la alerta de inventario.", alertErr);
      }

      setMessage(
        editingMovementId
          ? "Movimiento actualizado y saldos recalculados correctamente."
          : "Movimiento guardado y stock actualizado correctamente."
      );
      setEditingMovementId(null);
      setOperationType("");
      setOperationConsecutive("");
      setMovementForm({
        FECHA: new Date().toISOString().slice(0, 10),
        DESCRIPCION: "",
        OBSERVACIONES: "",
        INGRESO: "",
        SALIDA: "",
        SALDO: "",
        STOCK_RESERVADO: "",
        STOCK_DISPONIBLE: "",
        STOCK_TEORICO: "",
      });

      await reloadProviders();
    } catch (err: any) {
      setError(`No fue posible guardar el movimiento. ${err?.message || ""}`);
    } finally {
      setSavingMovement(false);
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

  if (!can("proveedoresBodega", "ver")) {
    return (
      <NoPermission
        title="Sin permiso"
        message="Tu rol no tiene permiso para ver proveedores y bodega."
      />
    );
  }

  const canModifyForm = editingProvider
    ? can("proveedoresBodega", "editar")
    : can("proveedoresBodega", "crear");

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
        userRole={userRole}
      />

      <div
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]"
        }`}
      >
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-11 h-11 rounded-2xl bg-[#244C5A] text-white hover:bg-[#1b3b46] flex items-center justify-center transition"
              aria-label="Abrir menú"
              title="Abrir menú"
            >
              <Menu size={22} />
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedProduct) {
                  handleBackToProducts();
                } else if (selectedProvider) {
                  handleBackToProviders();
                } else {
                  router.push("/panel");
                }
              }}
              className="w-11 h-11 rounded-2xl border border-slate-200 bg-slate-50 text-[#244C5A] hover:bg-slate-100 flex items-center justify-center transition"
              aria-label="Volver"
              title="Volver"
            >
              <ArrowLeft size={22} />
            </button>

            <button
              type="button"
              onClick={() => router.push("/panel")}
              className="w-11 h-11 rounded-2xl bg-[#244C5A] text-white hover:bg-[#1b3b46] flex items-center justify-center transition"
              aria-label="Ir al dashboard"
              title="Dashboard"
            >
              <Home size={21} />
            </button>

            <nav className="flex items-center gap-2 text-sm font-black min-w-0">
              <button
                type="button"
                onClick={() => router.push("/panel")}
                className="text-[#244C5A] hover:underline shrink-0"
              >
                Panel
              </button>
              <span className="text-slate-300">@</span>
              <span className="text-slate-500 shrink-0">Bodega</span>
              <span className="text-slate-300">@</span>
              <span className="text-slate-900 truncate">
                {selectedProduct
                  ? `Movimientos · ${selectedProduct?.codigo}`
                  : selectedProvider
                  ? `Productos · ${selectedProvider?.nombre}`
                  : "Crear proveedor"}
              </span>
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900 truncate max-w-[220px]">
                {userName}
              </p>
              <p className="text-xs text-slate-500 truncate max-w-[220px]">
                {authUser?.email}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 bg-[#244C5A] hover:bg-[#1b3b46] text-white rounded-2xl px-4 py-3 font-semibold transition"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>


      <section className="max-w-[1600px] mx-auto px-5 sm:px-8 py-6">
        {(error || message) && (
          <div className="mb-5">
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

        {false && selectedProduct && selectedProvider ? (
          <>
            <section className="relative overflow-hidden rounded-[32px] bg-[#244C5A] text-white p-6 sm:p-8 shadow-xl mb-6">
              <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-white/10" />
              <div className="absolute right-24 bottom-[-80px] w-56 h-56 rounded-full bg-white/10" />

              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <button
                    type="button"
                    onClick={handleBackToProducts}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2 text-sm font-bold transition mb-5"
                  >
                    <ArrowLeft size={17} />
                    Volver a productos
                  </button>

                  <p className="text-sm text-white/65 uppercase tracking-wide font-bold">
                    {selectedProvider?.nombre}
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-black mt-1">
                    {selectedProduct?.producto || selectedProduct?.codigo}
                  </h2>
                  <p className="text-white/70 mt-2">
                    Código: {selectedProduct?.codigo}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4">
                    <p className="text-xs text-white/50 uppercase tracking-wide">
                      Saldo actual
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {normalizeNumber(currentBalance)}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4">
                    <p className="text-xs text-white/50 uppercase tracking-wide">
                      Movimientos
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {movementRows.length}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4 col-span-2 sm:col-span-1">
                    <p className="text-xs text-white/50 uppercase tracking-wide">
                      Nuevo saldo
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {normalizeNumber(calculatedBalance)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <form
              onSubmit={handleSaveMovement}
              className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden mb-6"
            >
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    {editingMovementId ? "Editando movimiento" : "Actualización rápida"}
                  </p>
                  <h2 className="text-2xl font-black mt-1">
                    {editingMovementId ? "Corregir movimiento" : "Registrar nuevo movimiento"}
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    El saldo se calcula igual que en Excel: saldo de la fila inferior + ingreso - salida.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {editingMovementId && (
                    <button
                      type="button"
                      onClick={cancelMovementEdit}
                      className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition"
                    >
                      Cancelar edición
                    </button>
                  )}

                {(can("proveedoresBodega", "crear") ||
                  can("proveedoresBodega", "editar")) && (
                  <button
                    type="submit"
                    disabled={savingMovement}
                    className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20 whitespace-nowrap"
                  >
                    {savingMovement ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Save size={20} />
                    )}
                    {savingMovement
                      ? "Guardando..."
                      : editingMovementId
                      ? "Actualizar movimiento"
                      : "Guardar movimiento"}
                  </button>
                )}
                </div>
              </div>

              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={normalizeText(movementForm.FECHA)}
                    onChange={(e) => handleMovementChange("FECHA", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <div className="xl:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Operación
                  </label>
                  <div className="grid grid-cols-[1fr_1.2fr] gap-2">
                    <select
                      value={operationType}
                      onChange={(e) => {
                        const value = e.target.value;
                        setOperationType(value);
                        setOperationConsecutive("");
                        handleMovementChange("DESCRIPCION", value ? `${value}-` : "");
                        handleMovementChange("OBSERVACIONES", "");
                        if (value === "COMPRA" || value === "REINTEGRO") {
                          handleMovementChange("SALIDA", "");
                        }
                        if (value === "OP") {
                          handleMovementChange("INGRESO", "");
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    >
                      <option value="">Seleccionar</option>
                      <option value="COMPRA">COMPRA</option>
                      <option value="OP">OP</option>
                      <option value="REINTEGRO">REINTEGRO</option>
                      <option value="AJUSTE" disabled={!isMaster && !adjustmentApproved}>
                        AJUSTE {!isMaster && !adjustmentApproved ? "(bloqueado)" : ""}
                      </option>
                    </select>

                    <input
                      type="text"
                      value={operationConsecutive}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        setOperationConsecutive(value);
                        handleMovementChange(
                          "DESCRIPCION",
                          operationType ? `${operationType}-${value}` : value
                        );
                      }}
                      placeholder={operationType ? `${operationType}-001` : "001"}
                      disabled={!operationType}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="xl:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Lote
                  </label>
                  {mustSelectExistingLot ? (
                    <select
                      value={normalizeText(movementForm.OBSERVACIONES)}
                      onChange={(e) =>
                        handleMovementChange("OBSERVACIONES", e.target.value.toUpperCase())
                      }
                      disabled={!operationType || lotOptions.length === 0}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {lotOptions.length === 0
                          ? "No hay lotes registrados"
                          : "Selecciona lote"}
                      </option>
                      {lotOptions.map((lot) => (
                        <option key={lot.lote} value={lot.lote}>
                          {lot.lote} · saldo {normalizeNumber(lot.balance)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={normalizeText(movementForm.OBSERVACIONES)}
                      onChange={(e) =>
                        handleMovementChange("OBSERVACIONES", e.target.value.toUpperCase())
                      }
                      placeholder="FE658255"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  )}
                  {mustSelectExistingLot && lotOptions.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Lotes cargados del más nuevo al más antiguo.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Ingreso
                  </label>
                  <input
                    type="number"
                    value={normalizeText(movementForm.INGRESO)}
                    disabled={operationType === "OP" || (!isMaster && operationType === "AJUSTE" && !adjustmentApproved)}
                    onChange={(e) => handleMovementChange("INGRESO", e.target.value)}
                    placeholder="0"
                    className="w-full rounded-2xl border border-green-200 bg-green-50 px-4 py-3 outline-none focus:bg-white focus:border-green-600 focus:ring-2 focus:ring-green-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Salida
                  </label>
                  <input
                    type="number"
                    value={normalizeText(movementForm.SALIDA)}
                    disabled={operationType === "COMPRA" || operationType === "REINTEGRO" || (!isMaster && operationType === "AJUSTE" && !adjustmentApproved)}
                    onChange={(e) => handleMovementChange("SALIDA", e.target.value)}
                    placeholder="0"
                    className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 outline-none focus:bg-white focus:border-red-600 focus:ring-2 focus:ring-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="md:col-span-2 xl:col-span-7 rounded-3xl border border-[#244C5A]/15 bg-[#244C5A]/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-[#244C5A]">
                    <strong>Saldo calculado:</strong> {normalizeNumber(movementBaseBalance)} +{" "}
                    {normalizeNumber(movementForm.INGRESO || 0)} -{" "}
                    {normalizeNumber(movementForm.SALIDA || 0)}
                  </p>
                  <p className="text-2xl font-black text-[#244C5A]">
                    {normalizeNumber(calculatedBalance)}
                  </p>
                </div>
              </div>
            </form>

            <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    Tercera capa
                  </p>
                  <h2 className="text-2xl font-black mt-1">
                    Historial de movimientos
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    El historial se conserva hacia abajo; el nuevo movimiento se
                    gestiona arriba.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <div className="relative w-full lg:w-[380px]">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={19}
                    />
                    <input
                      type="text"
                      value={movementSearch}
                      onChange={(e) => setMovementSearch(e.target.value)}
                      placeholder="Buscar fecha, descripción, lote..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>

                  <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center">
                    {filteredMovements.length} movimientos
                  </div>
                </div>
              </div>

              {filteredMovements.length === 0 ? (
                <div className="p-8 text-center">
                  <PackageSearch className="mx-auto text-[#244C5A]" size={44} />
                  <h3 className="font-black text-slate-900 mt-4">
                    No hay movimientos para mostrar
                  </h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Registra el primer movimiento desde el formulario superior.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Fecha
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Operación
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Lote
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Ingreso
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Salida
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Saldo
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Stock reservado
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Stock disponible
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Stock teórico
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Acciones
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedMovements.map((item, index) => (
                        <tr
                          key={item.id}
                          className={`border-b border-slate-100 last:border-b-0 ${
                            movementPage === 1 && index === 0
                              ? "bg-[#244C5A]/5 hover:bg-[#244C5A]/10"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="px-5 py-4 text-sm text-slate-700">
                            {item.fecha || "—"}
                          </td>
                          <td className="px-5 py-4 text-sm font-bold text-slate-800">
                            {item.descripcion || "—"}
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-700">
                            {item.observaciones || "—"}
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-black text-green-700">
                            {item.ingreso ? normalizeNumber(item.ingreso) : "—"}
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-black text-red-700">
                            {item.salida ? normalizeNumber(item.salida) : "—"}
                          </td>
                          <td className={`px-5 py-4 text-right text-sm font-black ${toNumber(item.saldo) < 0 ? "text-red-700" : "text-slate-900"}`}>
                            {normalizeNumber(item.saldo)}
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-black text-slate-700 bg-slate-50">
                            {item.stockReservado ? normalizeNumber(item.stockReservado) : "—"}
                          </td>
                          <td className="px-5 py-4 text-right text-sm font-black text-slate-900">
                            {normalizeNumber(item.stockDisponible || item.saldo)}
                          </td>
                          <td className={`px-5 py-4 text-right text-sm font-black ${toNumber(item.stockTeorico) < 0 ? "text-red-700" : "text-slate-900"}`}>
                            {normalizeNumber(item.stockTeorico)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {can("proveedoresBodega", "editar") ? (
                              <button
                                type="button"
                                onClick={() => handleEditMovement(item)}
                                className="rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition"
                              >
                                Editar
                              </button>
                            ) : (
                              <span className="text-sm text-slate-400 font-semibold">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredMovements.length > 10 && (
                <div className="px-5 py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Página {movementPage} de {movementTotalPages}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={movementPage === 1}
                      onClick={() => setMovementPage((current) => Math.max(1, current - 1))}
                      className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>

                    <button
                      type="button"
                      disabled={movementPage === movementTotalPages}
                      onClick={() =>
                        setMovementPage((current) =>
                          Math.min(movementTotalPages, current + 1)
                        )
                      }
                      className="rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : selectedProvider ? (
          <>
            <section className="relative overflow-hidden rounded-[32px] bg-[#244C5A] text-white p-6 sm:p-8 shadow-xl mb-6">
              <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-white/10" />
              <div className="absolute right-24 bottom-[-80px] w-56 h-56 rounded-full bg-white/10" />

              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <button
                    type="button"
                    onClick={handleBackToProviders}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2 text-sm font-bold transition mb-5"
                  >
                    <ArrowLeft size={17} />
                    Volver a proveedores
                  </button>

                  <p className="text-sm text-white/65 uppercase tracking-wide font-bold">
                    {selectedProvider?.codigo}
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-black mt-1">
                    {selectedProvider?.nombre}
                  </h2>
                  <p className="text-white/70 mt-2 max-w-3xl">
                    {selectedProvider?.datos?.DIRECCION || "Sin dirección registrada"}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4">
                    <p className="text-xs text-white/50 uppercase tracking-wide">
                      Productos
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {products.length}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4">
                    <p className="text-xs text-white/50 uppercase tracking-wide">
                      Stock total
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {normalizeNumber(totalStock)}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-white/10 border border-white/10 px-5 py-4 col-span-2 sm:col-span-1">
                    <p className="text-xs text-white/50 uppercase tracking-wide">
                      Valor inventario
                    </p>
                    <p className="text-2xl font-black mt-1">
                      {normalizeMoney(totalValorInventario)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <form
              onSubmit={handleSaveProduct}
              className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden mb-6"
            >
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    {editingProduct ? "Editando producto" : "Nuevo producto"}
                  </p>
                  <h2 className="text-2xl font-black mt-1">
                    {editingProduct ? "Actualizar producto" : "Agregar producto al proveedor"}
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Segunda capa: datos base del producto. La operación diaria se maneja en movimientos.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={resetProductForm}
                      className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition"
                    >
                      Cancelar
                    </button>
                  )}

                  {((editingProduct && can("proveedoresBodega", "editar")) ||
                    (!editingProduct && can("proveedoresBodega", "crear"))) && (
                    <button
                      type="submit"
                      disabled={savingProduct}
                      className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20 whitespace-nowrap"
                    >
                      {savingProduct ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : editingProduct ? (
                        <Save size={20} />
                      ) : (
                        <Plus size={20} />
                      )}
                      {savingProduct
                        ? "Guardando..."
                        : editingProduct
                        ? "Actualizar producto"
                        : "Crear producto"}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Código
                  </label>
                  <input
                    type="text"
                    value={productForm.CODIGO}
                    onChange={(e) => handleProductChange("CODIGO", e.target.value)}
                    placeholder="ALI-001"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <div className="xl:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Producto
                  </label>
                  <input
                    type="text"
                    value={productForm.PRODUCTO}
                    onChange={(e) => handleProductChange("PRODUCTO", e.target.value)}
                    placeholder="Nombre del producto"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Mockup
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="w-full rounded-2xl border border-dashed border-[#244C5A]/35 bg-[#244C5A]/5 px-4 py-3 text-sm font-black text-[#244C5A] hover:bg-[#244C5A]/10 transition cursor-pointer flex items-center justify-center gap-2">
                      <UploadCloud size={18} />
                      Adjuntar
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleMockupChange(e.target.files?.[0])}
                      />
                    </label>

                    {(mockupPreview || productForm.MOCKUP_URL) && (
                      <button
                        type="button"
                        onClick={removeMockup}
                        className="w-12 h-12 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center transition"
                        title="Eliminar mockup"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Unidad de empaque
                  </label>
                  <input
                    type="text"
                    value={productForm.UNIDAD_DE_EMPAQUE}
                    onChange={(e) =>
                      handleProductChange("UNIDAD_DE_EMPAQUE", e.target.value)
                    }
                    placeholder="CAJA, PAQUETE..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Costo
                  </label>
                  <input
                    type="number"
                    value={productForm.COSTO}
                    onChange={(e) => handleProductChange("COSTO", e.target.value)}
                    placeholder="0"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Stock inicial
                  </label>
                  <input
                    type="number"
                    value={editingProduct ? normalizeText(editingProduct.datos.STOCK) : "0"}
                    disabled
                    placeholder="0"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none cursor-not-allowed"
                  />
                  <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    El stock no se registra aquí. El ingreso inicial se hace desde el primer movimiento en Proveedores / Bodega.
                  </p>
                </div>

                <div className="hidden">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Hoja detalle
                  </label>
                  <input
                    type="text"
                    value={productForm.HOJA_DETALLE}
                    onChange={(e) =>
                      handleProductChange("HOJA_DETALLE", e.target.value)
                    }
                    placeholder="Referencia hoja o ubicación"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>
              </div>
            </form>

            <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    Segunda capa
                  </p>
                  <h2 className="text-2xl font-black mt-1">Productos</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Haz clic en el código del producto para ver sus movimientos.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <div className="relative w-full lg:w-[380px]">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={19}
                    />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar producto, código, hoja..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>

                  <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center">
                    {filteredProducts.length} productos
                  </div>
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center">
                  <PackageSearch className="mx-auto text-[#244C5A]" size={44} />
                  <h3 className="font-black text-slate-900 mt-4">
                    No hay productos para mostrar
                  </h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Este proveedor todavía no tiene productos o cambia el filtro.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Código
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Producto
                        </th>
                        <th className="text-center px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Mockup
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Unidad de empaque
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Costo
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Stock
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Acciones
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredProducts.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => setMessage("Los movimientos se gestionan desde Proveedores / Bodega.")}
                              className="inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-600 px-3 py-1 text-xs font-black cursor-default"
                              title="Los movimientos se gestionan desde Proveedores / Bodega"
                            >
                              <Boxes size={15} />
                              {item.codigo}
                            </button>
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-black text-slate-900">
                              {item.producto || "Sin nombre de producto"}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-center">
                            {item.mockupUrl ? (
                              <button
                                type="button"
                                onClick={() => setSelectedMockup(item.mockupUrl)}
                                className="mx-auto w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:scale-105 transition"
                                title="Ampliar mockup"
                              >
                                <Image
                                  src={item.mockupUrl}
                                  alt={`Mockup ${item.producto}`}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                />
                              </button>
                            ) : (
                              <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 text-slate-400">
                                <ImageIcon size={20} />
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700">
                            {normalizeText(item.unidadEmpaque) || "—"}
                          </td>

                          <td className="px-5 py-4 text-sm font-bold text-slate-800">
                            {normalizeMoney(item.costo)}
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-black">
                              {normalizeNumber(item.stock)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            {can("proveedoresBodega", "editar") ? (
                              <button
                                type="button"
                                onClick={() => handleEditProduct(item)}
                                className="rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition"
                              >
                                Editar
                              </button>
                            ) : (
                              <span className="text-sm text-slate-400 font-semibold">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden"
            >
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    {editingProvider ? "Editando proveedor" : "Nuevo proveedor"}
                  </p>
                  <h2 className="text-2xl font-black mt-1">
                    {editingProvider
                      ? "Actualizar datos del proveedor"
                      : "Crear proveedor"}
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Primera capa conectada al nodo PROVEEDORES de Realtime Database.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                  {editingProvider && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      <X size={17} />
                      Cancelar
                    </button>
                  )}

                  {canModifyForm && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20 whitespace-nowrap"
                    >
                      {saving ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : editingProvider ? (
                        <Save size={20} />
                      ) : (
                        <Plus size={20} />
                      )}
                      {saving
                        ? "Guardando..."
                        : editingProvider
                        ? "Actualizar proveedor"
                        : "Crear proveedor"}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Código
                  </label>
                  <input
                    type="text"
                    value={form.CODIGO}
                    disabled={!canModifyForm || !!editingProvider}
                    onChange={(e) => handleChange("CODIGO", e.target.value)}
                    placeholder="ALI-105"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Proveedor
                  </label>
                  <input
                    type="text"
                    value={form.PROVEEDOR}
                    disabled={!canModifyForm}
                    onChange={(e) => handleChange("PROVEEDOR", e.target.value)}
                    placeholder="ALICO"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.EMAIL}
                    disabled={!canModifyForm}
                    onChange={(e) => handleChange("EMAIL", e.target.value)}
                    placeholder="proveedor@empresa.com"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    NIT
                  </label>
                  <input
                    type="text"
                    value={form.NIT}
                    disabled={!canModifyForm}
                    onChange={(e) => handleChange("NIT", e.target.value)}
                    placeholder="900000000"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={form.TELEFONO}
                    disabled={!canModifyForm}
                    onChange={(e) => handleChange("TELEFONO", e.target.value)}
                    placeholder="3000000000"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="hidden">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Hoja
                  </label>
                  <input
                    type="text"
                    value={form.HOJA}
                    disabled={!canModifyForm}
                    onChange={(e) => handleChange("HOJA", e.target.value)}
                    placeholder="Nombre hoja"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="md:col-span-2 xl:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={form.DIRECCION}
                    disabled={!canModifyForm}
                    onChange={(e) => handleChange("DIRECCION", e.target.value)}
                    placeholder="Dirección proveedor"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </form>

            <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 mt-6 overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    Proveedores creados
                  </p>
                  <h2 className="text-2xl font-black mt-1">Lista de proveedores</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Haz clic en el nombre del proveedor para crear o revisar sus productos.
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
                      placeholder="Buscar proveedor, código, email, NIT..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="rounded-2xl border border-[#244C5A] px-4 py-3 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Download size={18} />
                    Exportar Excel
                  </button>

                  <label className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] text-white px-4 py-3 text-sm font-black transition flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer">
                    {importingExcel ? <Loader2 className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                    {importingExcel ? "Importando..." : "Importar Excel"}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      disabled={importingExcel}
                      onChange={(e) => {
                        handleImportExcel(e.target.files?.[0]);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>

                  <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center">
                    {filteredProviders.length} proveedores
                  </div>
                </div>
              </div>

              {loadingProviders ? (
                <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
                  <Loader2 className="animate-spin" size={22} />
                  Cargando proveedores...
                </div>
              ) : filteredProviders.length === 0 ? (
                <div className="p-8 text-center">
                  <Truck className="mx-auto text-[#244C5A]" size={44} />
                  <h3 className="font-black text-slate-900 mt-4">
                    No hay proveedores para mostrar
                  </h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Crea un proveedor o cambia el texto de búsqueda.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1220px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Código
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Proveedor
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Productos
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Email
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          NIT
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Dirección
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Teléfono
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                          Acciones
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredProviders.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center rounded-full bg-[#244C5A]/10 text-[#244C5A] px-3 py-1 text-xs font-black">
                              {item.codigo}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => handleOpenProvider(item)}
                              className="font-black text-[#244C5A] hover:underline inline-flex items-center gap-2"
                              title="Ver productos"
                            >
                              <Building2 size={18} />
                              {item.nombre}
                            </button>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-black">
                              {Object.keys(item.productosRaw || {}).length}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700">
                            {normalizeText(item.datos.EMAIL) || "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700">
                            {normalizeText(item.datos.NIT) || "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700 max-w-[320px]">
                            <span className="line-clamp-2">
                              {normalizeText(item.datos.DIRECCION) || "—"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700">
                            {normalizeText(item.datos.TELEFONO) || "—"}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {can("proveedoresBodega", "editar") ? (
                                <button
                                  type="button"
                                  onClick={() => handleEdit(item)}
                                  className="rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white flex items-center gap-2 transition"
                                >
                                  <Edit3 size={17} />
                                  Editar
                                </button>
                              ) : (
                                <span className="text-sm text-slate-400 font-semibold">
                                  Solo lectura
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>

      {error && (
        <div className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-[520px] rounded-[32px] bg-white shadow-2xl border border-red-100 overflow-hidden">
            <div className="bg-red-50 px-6 py-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={26} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-red-600">
                  Atención
                </p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Revisa este movimiento
                </h3>
              </div>
            </div>

            <div className="px-6 py-5">
              <p className="text-base leading-relaxed text-slate-700 font-semibold">
                {error}
              </p>
            </div>

            <div className="px-6 pb-6 flex justify-end">
              <button
                type="button"
                onClick={() => setError("")}
                className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] text-white font-black px-6 py-3 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedMockup && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-3xl rounded-[32px] bg-white p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedMockup("")}
              className="absolute right-4 top-4 z-10 w-11 h-11 rounded-2xl bg-slate-900/80 text-white hover:bg-slate-900 flex items-center justify-center"
              aria-label="Cerrar mockup"
            >
              <X size={22} />
            </button>
            <Image
              src={selectedMockup}
              alt="Mockup ampliado"
              width={1000}
              height={700}
              className="w-full max-h-[78vh] object-contain rounded-[24px] bg-slate-100"
              unoptimized
            />
          </div>
        </div>
      )}

      </div>
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
                              item.href === "/panel/crear-proveedor"
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

