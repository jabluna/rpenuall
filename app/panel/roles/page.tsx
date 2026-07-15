"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  Check,
  ChevronDown,
  ClipboardList,
  Edit3,
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
  Plus,
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
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useUserPermissions } from "@/lib/useUserPermissions";
import NoPermission from "@/components/NoPermission";

type ActionKey = "ver" | "crear" | "editar" | "eliminar";

type MenuKey =
  | "panel"
  | "roles"
  | "usuarios"
  | "proveedoresBodega"
  | "clientes"
  | "pedidos"
  | "muestra"
  | "ordenesCreadas"
  | "produccionxplanta"
  | "compras"
  | "gestionCompras"
  | "crearProveedor"
  | "inventarioEtiquetas"
  | "compraEtiqueta"
  | "gestionEtiquetas";
type Permissions = Record<MenuKey, Record<ActionKey, boolean>>;

type Role = {
  id: string;
  nombre: string;
  permisos: Permissions;
};

const actions: { key: ActionKey; label: string }[] = [
  { key: "ver", label: "Ver" },
  { key: "crear", label: "Crear" },
  { key: "editar", label: "Editar" },
  { key: "eliminar", label: "Eliminar" },
];

const menuItems: {
  key: MenuKey;
  label: string;
  description: string;
  icon: any;
}[] = [
  {
    key: "panel",
    label: "Panel Principal",
    description: "Acceso al dashboard principal del sistema.",
    icon: LayoutDashboard,
  },
  {
    key: "roles",
    label: "Crear / ver roles",
    description: "Usuarios · Administrar perfiles y permisos.",
    icon: ShieldCheck,
  },
  {
    key: "usuarios",
    label: "Crear / ver usuarios",
    description: "Usuarios · Crear y administrar usuarios.",
    icon: UserCog,
  },
  {
    key: "proveedoresBodega",
    label: "Listado / movimiento de proveedores",
    description: "Bodega · Control de proveedores, productos y movimientos.",
    icon: Truck,
  },
  {
    key: "clientes",
    label: "Crear / ver clientes",
    description: "Comercial · Gestión de clientes y productos asociados.",
    icon: Users,
  },
  {
    key: "pedidos",
    label: "Crear orden de pedido",
    description: "Comercial · Creación de órdenes de pedido.",
    icon: ClipboardList,
  },
  {
    key: "muestra",
    label: "Generar orden de muestra",
    description: "Comercial · Creación de órdenes de muestra.",
    icon: FileText,
  },
  {
    key: "ordenesCreadas",
    label: "Ver órdenes de pedido",
    description: "Comercial y Producción · Gestión y seguimiento de órdenes de pedido.",
    icon: Eye,
  },
  {
    key: "produccionxplanta",
    label: "Producción x Planta",
    description: "Producción · Asignación y orden de producción por planta.",
    icon: ClipboardList,
  },
  {
    key: "compras",
    label: "Crear órdenes de compra",
    description: "Compras · Crear compras con alerta o sin alerta.",
    icon: PlusCircle,
  },
  {
    key: "gestionCompras",
    label: "Ver órdenes de compra",
    description: "Compras · Revisión, estados y evidencias de compras.",
    icon: ShoppingCart,
  },
  {
    key: "crearProveedor",
    label: "Crear proveedor",
    description: "Compras · Crear y administrar proveedores y productos base.",
    icon: PackagePlus,
  },
  {
    key: "inventarioEtiquetas",
    label: "Lista etiquetas",
    description: "Etiquetas · Control de etiquetas e inventario.",
    icon: Tags,
  },
  {
    key: "compraEtiqueta",
    label: "Crear orden de compra etiquetas",
    description: "Etiquetas · Crear compras específicas para etiquetas.",
    icon: FileText,
  },
  {
    key: "gestionEtiquetas",
    label: "Ver órdenes de compra etiquetas",
    description: "Etiquetas · Gestión, estados y evidencias de compras de etiquetas.",
    icon: Tag,
  },
];

const emptyPermissions: Permissions = {
  panel: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  roles: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  usuarios: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  proveedoresBodega: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  clientes: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  pedidos: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  muestra: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  ordenesCreadas: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  produccionxplanta: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  compras: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  gestionCompras: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  crearProveedor: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  inventarioEtiquetas: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  compraEtiqueta: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
  gestionEtiquetas: {
    ver: false,
    crear: false,
    editar: false,
    eliminar: false,
  },
};

function clonePermissions(): Permissions {
  return JSON.parse(JSON.stringify(emptyPermissions));
}

type SidebarMenuItem = {
  title: string;
  icon: any;
  href: string;
};

type SidebarMenuSection = {
  title: string;
  icon: any;
  items: SidebarMenuItem[];
};

const sidebarMenuSections: SidebarMenuSection[] = [
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
      { title: "Crear / ver clientes", icon: Users, href: "/panel/clientes" },
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
    icon: ClipboardList,
    items: [
      {
        title: "Ver órdenes de pedido",
        icon: Eye,
        href: "/panel/ordenes_creadas",
      },
      {
        title: "Producción x Planta",
        icon: ClipboardList,
        href: "/panel/produccionxplanta",
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
      },
      {
        title: "Ver órdenes de compra",
        icon: Eye,
        href: "/panel/gestion-compras2",
      },
      {
        title: "Crear proveedor",
        icon: PackagePlus,
        href: "/panel/crear-proveedor",
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

export default function RolesPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const {
    authUser,
    profile,
    loading: loadingPermissions,
    isActive,
    can,
  } = useUserPermissions();

  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] =
    useState<Permissions>(clonePermissions());
  const [editingId, setEditingId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"crear" | "roles">("crear");

  const userName = useMemo(() => {
    return (
      profile?.nombre ||
      authUser?.displayName ||
      authUser?.email?.split("@")[0] ||
      "Administrador"
    );
  }, [profile, authUser]);

  const filteredRoles = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    if (!cleanSearch) return roles;

    return roles.filter((role) =>
      role.nombre.toLowerCase().includes(cleanSearch),
    );
  }, [roles, search]);

  useEffect(() => {
    if (!loadingPermissions && !authUser) {
      router.replace("/");
    }
  }, [loadingPermissions, authUser, router]);

  useEffect(() => {
    const q = query(collection(db, "roles"), orderBy("nombre", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Role[];

        setRoles(data);
        setLoadingRoles(false);
      },
      (err) => {
        setError(`No fue posible cargar los roles. ${err.message}`);
        setLoadingRoles(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setRoleName("");
    setPermissions(clonePermissions());
    setEditingId(null);
    setError("");
    setMessage("");
  };

  const togglePermission = (menuKey: MenuKey, actionKey: ActionKey) => {
    setPermissions((current) => {
      const currentMenuPermissions = current[menuKey] || emptyPermissions[menuKey];

      return {
        ...current,
        [menuKey]: {
          ...currentMenuPermissions,
          [actionKey]: !currentMenuPermissions[actionKey],
        },
      };
    });
  };

  const setAllPermissionsByMenu = (menuKey: MenuKey, value: boolean) => {
    setPermissions((current) => ({
      ...current,
      [menuKey]: {
        ver: value,
        crear: value,
        editar: value,
        eliminar: value,
      },
    }));
  };

  const setAllPermissionsByAction = (actionKey: ActionKey, value: boolean) => {
    setPermissions((current) => {
      const next = { ...current };

      menuItems.forEach((item) => {
        next[item.key] = {
          ...(next[item.key] || emptyPermissions[item.key]),
          [actionKey]: value,
        };
      });

      return next;
    });
  };

  const setFullAccess = (value: boolean) => {
    const next = clonePermissions();

    menuItems.forEach((item) => {
      next[item.key] = {
        ver: value,
        crear: value,
        editar: value,
        eliminar: value,
      };
    });

    setPermissions(next);
  };

  const hasActionFullSelected = (actionKey: ActionKey) => {
    return menuItems.every((item) => permissions[item.key]?.[actionKey]);
  };

  const countRolePermissions = (role: Role) => {
    let total = 0;

    menuItems.forEach((item) => {
      actions.forEach((action) => {
        if (role.permisos?.[item.key]?.[action.key]) {
          total++;
        }
      });
    });

    return total;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (editingId && !can("roles", "editar")) {
      setError("Tu rol no tiene permiso para editar roles.");
      return;
    }

    if (!editingId && !can("roles", "crear")) {
      setError("Tu rol no tiene permiso para crear roles.");
      return;
    }

    const cleanName = roleName.trim();

    if (!cleanName) {
      setError("Escribe el nombre del rol.");
      return;
    }

    const duplicatedRole = roles.find(
      (role) =>
        role.nombre.trim().toLowerCase() === cleanName.toLowerCase() &&
        role.id !== editingId,
    );

    if (duplicatedRole) {
      setError("Ya existe un rol con ese nombre.");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        await updateDoc(doc(db, "roles", editingId), {
          nombre: cleanName,
          permisos: permissions,
          updatedAt: serverTimestamp(),
          updatedBy: authUser?.uid || null,
          updatedByEmail: authUser?.email || null,
        });

        setMessage("Rol actualizado correctamente.");
      } else {
        await addDoc(collection(db, "roles"), {
          nombre: cleanName,
          permisos: permissions,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: authUser?.uid || null,
          createdByEmail: authUser?.email || null,
        });

        setMessage("Rol creado correctamente.");
      }

      resetForm();
    } catch (err: any) {
      setError(`No fue posible guardar el rol. ${err?.message || ""}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (role: Role) => {
    if (!can("roles", "editar")) {
      setError("Tu rol no tiene permiso para editar roles.");
      return;
    }

    setEditingId(role.id);
    setRoleName(role.nombre);
    const nextPermissions = clonePermissions();

    menuItems.forEach((item) => {
      nextPermissions[item.key] = {
        ...nextPermissions[item.key],
        ...(role.permisos?.[item.key] || {}),
      };
    });

    setPermissions(nextPermissions);
    setError("");
    setMessage("");
    setActiveTab("crear");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (role: Role) => {
    if (!can("roles", "eliminar")) {
      setError("Tu rol no tiene permiso para eliminar roles.");
      return;
    }

    const confirmDelete = window.confirm(
      `¿Seguro que deseas eliminar el rol "${role.nombre}"?`,
    );

    if (!confirmDelete) return;

    setError("");
    setMessage("");
    setDeletingId(role.id);

    try {
      await deleteDoc(doc(db, "roles", role.id));

      if (editingId === role.id) {
        resetForm();
      }

      setMessage("Rol eliminado correctamente.");
    } catch (err: any) {
      setError(`No fue posible eliminar el rol. ${err?.message || ""}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((current) => ({
      ...current,
      [sectionTitle]: !current[sectionTitle],
    }));
    if (sidebarCollapsed) setSidebarCollapsed(false);
  };

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

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

  if (!can("roles", "ver")) {
    return (
      <NoPermission
        title="Sin permiso"
        message="Tu rol no tiene permiso para ver la sección de roles."
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
          aria-label="Cerrar menú"
        />
      )}

      <AppSidebar
        sidebarOpen={sidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        openSections={openSections}
        setSidebarOpen={setSidebarOpen}
        setSidebarCollapsed={setSidebarCollapsed}
        toggleSection={toggleSection}
        handleLogout={handleLogout}
        currentUserName={userName}
        authEmail={authUser?.email || ""}
        roleName={profile?.rolNombre || "Sin rol"}
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
              <span className="font-black text-slate-900">Roles y permisos</span>
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

        <section className="max-w-[1600px] mx-auto px-5 sm:px-8 py-6">
          <div className="bg-[#EAF4EF] rounded-[28px] shadow-sm border border-emerald-100 p-2 mb-6 flex flex-col sm:flex-row gap-2 sticky top-16 lg:top-20 z-20">
            <button
              type="button"
              onClick={() => setActiveTab("crear")}
              className={`flex-1 rounded-3xl px-5 py-4 text-sm font-black transition flex items-center justify-center gap-3 ${
                activeTab === "crear"
                  ? "bg-[#244C5A] text-white shadow-lg shadow-[#244C5A]/20"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="inline-flex w-7 h-7 rounded-full bg-white/20 items-center justify-center text-xs">1</span>
              Crear rol y asignar permisos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("roles")}
              className={`flex-1 rounded-3xl px-5 py-4 text-sm font-black transition flex items-center justify-center gap-3 ${
                activeTab === "roles"
                  ? "bg-[#244C5A] text-white shadow-lg shadow-[#244C5A]/20"
                  : "bg-emerald-50 text-[#244C5A] border border-emerald-200 hover:bg-emerald-100 shadow-sm"
              }`}
            >
              <span className="inline-flex w-7 h-7 rounded-full bg-white/20 items-center justify-center text-xs">2</span>
              Mis roles
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${activeTab === "roles" ? "bg-white/20 text-white" : "bg-[#244C5A]/10 text-[#244C5A]"}`}>
                {roles.length}
              </span>
            </button>
          </div>

          {activeTab === "crear" && (
          <form
            onSubmit={handleSave}
            className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col gap-5">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div>
                  <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                    {editingId ? "Editando rol" : "Nuevo rol"}
                  </p>
                  <h2 className="text-2xl font-black mt-1">
                    {editingId
                      ? "Actualizar permisos"
                      : "Crear rol y asignar permisos"}
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Sigue los pasos para configurar qué puede ver y hacer cada rol.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                  {((editingId && can("roles", "editar")) ||
                    (!editingId && can("roles", "crear"))) && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-6 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20 whitespace-nowrap"
                    >
                      {saving ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <Save size={20} />
                      )}
                      {saving ? "Guardando..." : editingId ? "Actualizar rol" : "Guardar rol"}
                    </button>
                  )}

                  {(can("roles", "crear") || can("roles", "editar")) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setFullAccess(true)}
                        className="rounded-2xl border border-[#244C5A] px-4 py-3 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition whitespace-nowrap"
                      >
                        Acceso total
                      </button>

                      <button
                        type="button"
                        onClick={() => setFullAccess(false)}
                        className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition whitespace-nowrap"
                      >
                        Limpiar
                      </button>
                    </>
                  )}

                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      <X size={17} />
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-black shrink-0">1</span>
                    <div className="flex-1">
                      <p className="font-black text-emerald-900">Digite el nombre del rol</p>
                      <input
                        type="text"
                        value={roleName}
                        disabled={
                          editingId ? !can("roles", "editar") : !can("roles", "crear")
                        }
                        onChange={(e) => setRoleName(e.target.value)}
                        placeholder="Nombre del rol: Ej. Bodega"
                        className="mt-3 w-full rounded-2xl border border-emerald-200 bg-emerald-100/70 px-4 py-3 outline-none placeholder:text-emerald-700/70 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 flex gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#244C5A] text-white flex items-center justify-center text-sm font-black shrink-0">2</span>
                  <div>
                    <p className="font-black text-slate-900">Seleccione permisos</p>
                    <p className="text-sm text-slate-500 mt-1">Marca en cada ítem del menú lo que el rol puede ver, crear, editar o eliminar.</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 flex gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#244C5A] text-white flex items-center justify-center text-sm font-black shrink-0">3</span>
                  <div>
                    <p className="font-black text-slate-900">Guardar rol</p>
                    <p className="text-sm text-slate-500 mt-1">Finaliza con el botón Guardar rol para dejarlo disponible.</p>
                  </div>
                </div>
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

            <div className="p-5 sm:p-6">
              <div className="overflow-x-auto rounded-3xl border border-slate-200">
                <table className="w-full min-w-[850px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Opción del menú
                      </th>

                      {actions.map((action) => {
                        const allSelected = hasActionFullSelected(action.key);
                        const canModify = editingId
                          ? can("roles", "editar")
                          : can("roles", "crear");

                        return (
                          <th
                            key={action.key}
                            className="px-4 py-3 text-center text-xs font-black uppercase tracking-wide text-slate-500"
                          >
                            <button
                              type="button"
                              disabled={!canModify}
                              onClick={() =>
                                setAllPermissionsByAction(
                                  action.key,
                                  !allSelected,
                                )
                              }
                              className={`mx-auto rounded-xl px-3 py-2 border text-xs font-black transition disabled:opacity-60 disabled:cursor-not-allowed ${
                                allSelected
                                  ? "bg-[#244C5A] text-white border-[#244C5A]"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-[#244C5A] hover:text-[#244C5A]"
                              }`}
                            >
                              {action.label}
                            </button>
                          </th>
                        );
                      })}

                      <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-wide text-slate-500">
                        Todo
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      const activeCount = actions.filter(
                        (action) => permissions[item.key]?.[action.key],
                      ).length;
                      const canModify = editingId
                        ? can("roles", "editar")
                        : can("roles", "crear");

                      return (
                        <tr
                          key={item.key}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-[#244C5A] text-white flex items-center justify-center shrink-0">
                                <Icon size={20} />
                              </div>
                              <div>
                                <p className="font-black text-slate-900">
                                  {item.label}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          </td>

                          {actions.map((action) => {
                            const checked = permissions[item.key]?.[action.key];

                            return (
                              <td
                                key={action.key}
                                className="px-4 py-4 text-center"
                              >
                                <button
                                  type="button"
                                  disabled={!canModify}
                                  onClick={() =>
                                    togglePermission(item.key, action.key)
                                  }
                                  className={`mx-auto w-10 h-10 rounded-2xl border flex items-center justify-center transition disabled:opacity-60 disabled:cursor-not-allowed ${
                                    checked
                                      ? "bg-[#244C5A] border-[#244C5A] text-white shadow-md shadow-[#244C5A]/20"
                                      : "bg-white border-slate-200 text-slate-300 hover:border-[#244C5A] hover:text-[#244C5A]"
                                  }`}
                                  aria-label={`${action.label} ${item.label}`}
                                >
                                  <Check size={18} />
                                </button>
                              </td>
                            );
                          })}

                          <td className="px-4 py-4 text-center">
                            <button
                              type="button"
                              disabled={!canModify}
                              onClick={() =>
                                setAllPermissionsByMenu(
                                  item.key,
                                  activeCount !== actions.length,
                                )
                              }
                              className={`rounded-2xl px-4 py-2 text-xs font-black border transition disabled:opacity-60 disabled:cursor-not-allowed ${
                                activeCount === actions.length
                                  ? "bg-[#244C5A] border-[#244C5A] text-white"
                                  : "bg-white border-slate-200 text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A]"
                              }`}
                            >
                              {activeCount === actions.length
                                ? "Completo"
                                : "Marcar"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Si tu rol no tiene permiso de crear o editar roles, la matriz queda bloqueada en solo lectura.
                </p>

                {((editingId && can("roles", "editar")) ||
                  (!editingId && can("roles", "crear"))) && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-6 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20 whitespace-nowrap"
                  >
                    {saving ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Save size={20} />
                    )}
                    {saving ? "Guardando..." : editingId ? "Actualizar rol" : "Guardar rol"}
                  </button>
                )}
              </div>
            </div>
          </form>
          )}

          {activeTab === "roles" && (
          <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                  Roles guardados
                </p>
                <h2 className="text-2xl font-black mt-1">Mis roles</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Roles sincronizados desde Firestore.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar rol..."
                  className="w-full lg:w-[320px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                />

                <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center">
                  {filteredRoles.length} roles
                </div>
              </div>
            </div>

            {loadingRoles ? (
              <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
                <Loader2 className="animate-spin" size={22} />
                Cargando roles...
              </div>
            ) : filteredRoles.length === 0 ? (
              <div className="p-8 text-center">
                <ShieldCheck className="mx-auto text-[#244C5A]" size={42} />
                <h3 className="font-black text-slate-900 mt-4">
                  No hay roles para mostrar
                </h3>
                <p className="text-sm text-slate-500 mt-2">
                  Crea un rol o cambia el texto de búsqueda.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Rol
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Resumen de permisos
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Total
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRoles.map((role) => (
                      <tr
                        key={role.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-black text-slate-900">
                            {role.nombre}
                          </p>
                          <p className="text-xs text-slate-500">
                            Rol del sistema
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {menuItems.map((item) => {
                              const enabled = actions.filter(
                                (action) =>
                                  role.permisos?.[item.key]?.[action.key],
                              );

                              if (enabled.length === 0) return null;

                              return (
                                <span
                                  key={item.key}
                                  className="inline-flex items-center rounded-full bg-[#244C5A]/10 text-[#244C5A] px-3 py-1 text-xs font-bold"
                                >
                                  {item.label}:{" "}
                                  <span className="ml-1 font-black">
                                    {enabled.length}
                                  </span>
                                </span>
                              );
                            })}

                            {countRolePermissions(role) === 0 && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-3 py-1 text-xs font-bold">
                                Sin permisos
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                            {countRolePermissions(role)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {can("roles", "editar") && (
                              <button
                                type="button"
                                onClick={() => handleEdit(role)}
                                className="rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white flex items-center gap-2 transition"
                              >
                                <Edit3 size={17} />
                                Editar
                              </button>
                            )}

                            {can("roles", "eliminar") && (
                              <button
                                type="button"
                                onClick={() => handleDelete(role)}
                                disabled={deletingId === role.id}
                                className="rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white flex items-center gap-2 transition disabled:opacity-60"
                              >
                                {deletingId === role.id ? (
                                  <Loader2 className="animate-spin" size={17} />
                                ) : (
                                  <Trash2 size={17} />
                                )}
                                Eliminar
                              </button>
                            )}

                            {!can("roles", "editar") &&
                              !can("roles", "eliminar") && (
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
          )}
        </section>
      </section>
    </main>
  );
}

function AppSidebar({
  sidebarOpen,
  sidebarCollapsed,
  openSections,
  setSidebarOpen,
  setSidebarCollapsed,
  toggleSection,
  handleLogout,
  currentUserName,
  authEmail,
  roleName,
}: {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  openSections: Record<string, boolean>;
  setSidebarOpen: (value: boolean) => void;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSection: (sectionTitle: string) => void;
  handleLogout: () => Promise<void>;
  currentUserName: string;
  authEmail: string;
  roleName: string;
}) {
  return (
    <aside
      className={`fixed z-50 inset-y-0 left-0 ${sidebarCollapsed ? "lg:w-[88px]" : "lg:w-[300px]"} w-[300px] bg-[#244C5A] text-white transform transition-all duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="h-full flex flex-col">
        <div className="relative px-4 pt-6 pb-5 border-b border-white/10 flex items-center justify-center">
          <div className="flex items-center justify-center min-h-[56px] w-full">
            <Image
              src="/logo.png"
              alt="Nuall"
              width={sidebarCollapsed ? 48 : 145}
              height={70}
              priority
              className="object-contain"
            />
          </div>

          <div className="absolute right-4 top-6 flex items-center gap-2">
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
              <p className="font-black mt-1 truncate">{currentUserName}</p>
              <p className="text-xs text-[#244C5A]/70 truncate mt-1">
                {authEmail}
              </p>
              <p className="text-xs text-[#244C5A]/70 truncate mt-1">
                Rol: {roleName}
              </p>
            </div>
          </div>
        )}

        <nav className="px-4 py-4 flex-1 space-y-2 overflow-y-auto">
          <Link
            href="/panel"
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-white text-[#244C5A] font-bold shadow-lg ${sidebarCollapsed ? "justify-center" : ""}`}
            onClick={() => setSidebarOpen(false)}
            title="Panel Principal"
          >
            <LayoutDashboard size={20} />
            {!sidebarCollapsed && <span>Panel Principal</span>}
          </Link>

          {sidebarMenuSections.map((section) => {
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
                      return (
                        <Link
                          key={`${section.title}-${item.title}`}
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
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 font-semibold transition ${sidebarCollapsed ? "px-0" : ""}`}
            title="Cerrar sesión"
          >
            <LogOut size={19} /> {!sidebarCollapsed && "Cerrar sesión"}
          </button>
        </div>
      </div>
    </aside>
  );
}
