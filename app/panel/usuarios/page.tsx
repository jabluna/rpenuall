"use client";

import Image from "next/image";
import Link from "next/link";
import emailjs from "@emailjs/browser";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  ArrowLeft,
  AlertTriangle,
  Boxes,
  Camera,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Droplet,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Home,
  IdCard,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  MailPlus,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Plus,
  Save,
  Search,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Tags,
  Truck,
  UserCircle2,
  UserCog,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { auth, db } from "@/lib/firebase";
import { PermissionModule, useUserPermissions } from "@/lib/useUserPermissions";
import NoPermission from "@/components/NoPermission";

type Role = {
  id: string;
  nombre: string;
  permisos?: Record<string, unknown>;
};

type AppUser = {
  id: string;
  authUid?: string;
  nombre: string;
  email: string;
  telefono: string;
  rh?: string;
  fechaCumpleanos?: string;
  fotoUrl: string;
  fotoPath?: string;
  rolId: string;
  rolNombre: string;
  activo: boolean;
  passwordTemporal?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type UserForm = {
  nombre: string;
  email: string;
  telefono: string;
  rh: string;
  fechaCumpleanos: string;
  rolId: string;
  password: string;
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
        icon: Plus,
        href: "/panel/compras2",
      },
      {
        title: "Ver órdenes de compra",
        icon: Eye,
        href: "/panel/gestion-compras2",
      },
      {
        title: "Crear proveedor",
        icon: Truck,
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
        module: "inventarioEtiquetas",
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

const firebaseConfig = {
  apiKey: "AIzaSyCKNKL-9tDaw1HxyGJZVRvZJDpBImDkaJA",
  authDomain: "nuall-263ea.firebaseapp.com",
  databaseURL: "https://nuall-263ea-default-rtdb.firebaseio.com",
  projectId: "nuall-263ea",
  storageBucket: "nuall-263ea.firebasestorage.app",
  messagingSenderId: "702609174051",
  appId: "1:702609174051:web:c468e18387a911bc9c0b96",
};

const defaultPhoto = "/sinfoto.jpg";
const EMAILJS_SERVICE_ID = "service_7hxlram";
const EMAILJS_TEMPLATE_ID = "template_j71zong";
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "";

const getDigitsOnly = (value: string) => value.replace(/\D/g, "");

const getCarnetBarcodeValue = (user: AppUser) => {
  const phoneDigits = getDigitsOnly(user.telefono || "");
  const currentYear = new Date().getFullYear();

  return `${phoneDigits || "0000000000"}${currentYear}`;
};

const code39Patterns: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  "*": "nwnnwnwnn",
};

const buildBarcodeBars = (value: string) => {
  const cleanValue = getDigitsOnly(value) || "00000000002026";
  const encodedValue = `*${cleanValue}*`;
  const bars: { active: boolean; width: number }[] = [];

  encodedValue.split("").forEach((char, charIndex) => {
    const pattern = code39Patterns[char] || code39Patterns["0"];

    pattern.split("").forEach((unit, unitIndex) => {
      bars.push({
        active: unitIndex % 2 === 0,
        width: unit === "w" ? 3 : 1,
      });
    });

    if (charIndex < encodedValue.length - 1) {
      bars.push({ active: false, width: 1 });
    }
  });

  return bars;
};


function getSecondaryAuth() {
  const secondaryName = "nuall-user-creator";
  const existingApp = getApps().find((app) => app.name === secondaryName);
  const secondaryApp =
    existingApp || initializeApp(firebaseConfig, secondaryName);

  return getAuth(getApp(secondaryApp.name));
}

export default function UsuariosPage() {
  const router = useRouter();
  const storage = getStorage(auth.app);

  const {
    authUser,
    profile,
    loading: loadingPermissions,
    isActive,
    can,
    canView,
  } = useUserPermissions();

  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState<UserForm>({
    nombre: "",
    email: "",
    telefono: "",
    rh: "",
    fechaCumpleanos: "",
    rolId: "",
    password: "",
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(defaultPhoto);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedCarnet, setSelectedCarnet] = useState<AppUser | null>(null);
  const [search, setSearch] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<
    Record<string, boolean>
  >({});

  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const currentUserName = useMemo(() => {
    return (
      profile?.nombre ||
      authUser?.displayName ||
      authUser?.email?.split("@")[0] ||
      "Administrador"
    );
  }, [profile, authUser]);

  const filteredMenuSections = useMemo(() => {
    return menuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          item.module ? canView(item.module) : true,
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [canView]);

  const visibleMenuItems = useMemo(
    () => filteredMenuSections.flatMap((section) => section.items),
    [filteredMenuSections],
  );

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((current) => ({
      ...current,
      [sectionTitle]: !current[sectionTitle],
    }));
    if (sidebarCollapsed) setSidebarCollapsed(false);
  };

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

  const selectedRole = useMemo(() => {
    return roles.find((role) => role.id === form.rolId) || null;
  }, [roles, form.rolId]);

  const filteredUsers = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    if (!cleanSearch) return users;

    return users.filter((item) => {
      return (
        item.nombre.toLowerCase().includes(cleanSearch) ||
        item.email.toLowerCase().includes(cleanSearch) ||
        item.telefono.toLowerCase().includes(cleanSearch) ||
        (item.rh || "").toLowerCase().includes(cleanSearch) ||
        (item.fechaCumpleanos || "").toLowerCase().includes(cleanSearch) ||
        item.rolNombre.toLowerCase().includes(cleanSearch)
      );
    });
  }, [users, search]);

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

  useEffect(() => {
    const q = query(collection(db, "usuarios"), orderBy("nombre", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as AppUser[];

        setUsers(data);
        setLoadingUsers(false);
      },
      (err) => {
        setError(`No fue posible cargar los usuarios. ${err.message}`);
        setLoadingUsers(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setForm({
      nombre: "",
      email: "",
      telefono: "",
      rh: "",
      fechaCumpleanos: "",
      rolId: "",
      password: "",
    });
    setPhotoFile(null);
    setPhotoPreview(defaultPhoto);
    setEditingId(null);
    setError("");
    setMessage("");
  };

  const handlePhotoChange = (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen válida.");
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const uploadPhotoIfNeeded = async (userId: string) => {
    if (!photoFile) return null;

    const extension = photoFile.name.split(".").pop() || "jpg";
    const path = `usuarios/${userId}/foto-perfil.${extension}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, photoFile);
    const url = await getDownloadURL(storageRef);

    return {
      fotoUrl: url,
      fotoPath: path,
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (editingId && !can("usuarios", "editar")) {
      setError("Tu rol no tiene permiso para editar usuarios.");
      return;
    }

    if (!editingId && !can("usuarios", "crear")) {
      setError("Tu rol no tiene permiso para crear usuarios.");
      return;
    }

    const cleanName = form.nombre.trim();
    const cleanEmail = form.email.trim().toLowerCase();
    const cleanPhone = form.telefono.trim();
    const cleanRh = form.rh.trim().toUpperCase();
    const cleanFechaCumpleanos = form.fechaCumpleanos.trim();
    const cleanPassword = form.password.trim();

    if (!cleanName) {
      setError("Escribe el nombre del usuario.");
      return;
    }

    if (!cleanEmail) {
      setError("Escribe el correo del usuario.");
      return;
    }

    if (!form.rolId) {
      setError("Selecciona un rol para el usuario.");
      return;
    }

    if (!editingId && cleanPassword.length < 6) {
      setError("La contraseña temporal debe tener mínimo 6 caracteres.");
      return;
    }

    const duplicatedEmail = users.find(
      (item) =>
        item.email.toLowerCase() === cleanEmail && item.id !== editingId,
    );

    if (duplicatedEmail) {
      setError("Ya existe un usuario con ese correo.");
      return;
    }

    setSaving(true);

    try {
      const roleName = selectedRole?.nombre || "Sin rol";

      if (editingId) {
        const photoData = await uploadPhotoIfNeeded(editingId);

        await updateDoc(doc(db, "usuarios", editingId), {
          nombre: cleanName,
          email: cleanEmail,
          telefono: cleanPhone,
          rh: cleanRh,
          fechaCumpleanos: cleanFechaCumpleanos,
          rolId: form.rolId,
          rolNombre: roleName,
          ...(photoData
            ? {
                fotoUrl: photoData.fotoUrl,
                fotoPath: photoData.fotoPath,
              }
            : {}),
          updatedAt: serverTimestamp(),
          updatedBy: authUser?.uid || null,
          updatedByEmail: authUser?.email || null,
        });

        setMessage("Usuario actualizado correctamente.");
      } else {
        const secondaryAuth = getSecondaryAuth();

        const createdAuthUser = await createUserWithEmailAndPassword(
          secondaryAuth,
          cleanEmail,
          cleanPassword,
        );

        await signOut(secondaryAuth);

        const newUserRef = await addDoc(collection(db, "usuarios"), {
          authUid: createdAuthUser.user.uid,
          nombre: cleanName,
          email: cleanEmail,
          telefono: cleanPhone,
          rh: cleanRh,
          fechaCumpleanos: cleanFechaCumpleanos,
          rolId: form.rolId,
          rolNombre: roleName,
          fotoUrl: defaultPhoto,
          fotoPath: "",
          activo: true,
          passwordTemporal: cleanPassword,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: authUser?.uid || null,
          createdByEmail: authUser?.email || null,
        });

        const photoData = await uploadPhotoIfNeeded(newUserRef.id);

        if (photoData) {
          await updateDoc(doc(db, "usuarios", newUserRef.id), {
            fotoUrl: photoData.fotoUrl,
            fotoPath: photoData.fotoPath,
            updatedAt: serverTimestamp(),
          });
        }

        setMessage(
          "Usuario creado correctamente en Authentication y Firestore.",
        );
      }

      resetForm();
    } catch (err: any) {
      if (err?.code === "auth/email-already-in-use") {
        setError("Ese correo ya existe en Firebase Authentication.");
      } else if (err?.code === "auth/weak-password") {
        setError("La contraseña debe tener mínimo 6 caracteres.");
      } else {
        setError(`No fue posible guardar el usuario. ${err?.message || ""}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: AppUser) => {
    if (!can("usuarios", "editar")) {
      setError("Tu rol no tiene permiso para editar usuarios.");
      return;
    }

    setEditingId(item.id);
    setForm({
      nombre: item.nombre || "",
      email: item.email || "",
      telefono: item.telefono || "",
      rh: item.rh || "",
      fechaCumpleanos: item.fechaCumpleanos || "",
      rolId: item.rolId || "",
      password: "",
    });
    setPhotoFile(null);
    setPhotoPreview(item.fotoUrl || defaultPhoto);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleStatus = async (item: AppUser) => {
    if (!can("usuarios", "editar")) {
      setError("Tu rol no tiene permiso para activar o desactivar usuarios.");
      return;
    }

    setError("");
    setMessage("");
    setTogglingId(item.id);

    try {
      await updateDoc(doc(db, "usuarios", item.id), {
        activo: !item.activo,
        updatedAt: serverTimestamp(),
        updatedBy: authUser?.uid || null,
        updatedByEmail: authUser?.email || null,
      });

      setMessage(
        item.activo
          ? "Usuario desactivado correctamente."
          : "Usuario activado correctamente.",
      );
    } catch (err: any) {
      setError(`No fue posible cambiar el estado. ${err?.message || ""}`);
    } finally {
      setTogglingId(null);
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((current) => ({
      ...current,
      [userId]: !current[userId],
    }));
  };

  const handleSendCredentialsEmail = async (item: AppUser) => {
    if (!can("usuarios", "editar")) {
      setError("Tu rol no tiene permiso para enviar credenciales por email.");
      return;
    }

    const userEmail = (item.email || "").trim().toLowerCase();
    const userPassword = item.passwordTemporal || "";

    if (!userEmail) {
      setError("El usuario no tiene correo registrado.");
      return;
    }

    if (!userPassword) {
      setError("Este usuario no tiene contraseña temporal guardada para enviar.");
      return;
    }

    if (!EMAILJS_PUBLIC_KEY) {
      setError(
        "Falta configurar NEXT_PUBLIC_EMAILJS_PUBLIC_KEY en las variables de entorno.",
      );
      return;
    }

    setError("");
    setMessage("");
    setEmailingId(item.id);

    try {
      const loginUrl =
        typeof window !== "undefined" ? `${window.location.origin}/` : "";

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email: userEmail,
          to_name: item.nombre || "Usuario",
          user_name: item.nombre || "Usuario",
          user_email: userEmail,
          user_password: userPassword,
          user_role: item.rolNombre || "Sin rol",
          user_phone: item.telefono || "Sin teléfono",
          login_url: loginUrl,
          company_name: "Nuall",
          reply_to: authUser?.email || userEmail,
        },
        EMAILJS_PUBLIC_KEY,
      );

      setMessage(`Credenciales enviadas correctamente a ${userEmail}.`);
    } catch (err: any) {
      setError(`No fue posible enviar el email. ${err?.text || err?.message || ""}`);
    } finally {
      setEmailingId(null);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const canModifyForm = editingId
    ? can("usuarios", "editar")
    : can("usuarios", "crear");

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

  if (!can("usuarios", "ver")) {
    return (
      <NoPermission
        title="Sin permiso"
        message="Tu rol no tiene permiso para ver la sección de usuarios."
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
          aria-label="Cerrar fondo menú"
        />
      )}

      <aside
        className={`fixed z-50 inset-y-0 left-0 ${sidebarCollapsed ? "lg:w-[88px]" : "lg:w-[300px]"} w-[300px] bg-[#244C5A] text-white transform transition-all duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full flex flex-col">
          <div
            className={`relative px-4 pt-6 pb-5 border-b border-white/10 flex items-center justify-center`}
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
                  {authUser?.email}
                </p>
                <p className="text-xs text-[#244C5A]/70 truncate mt-1">
                  Rol: {profile?.rolNombre || "Sin rol"}
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

            {visibleMenuItems.length === 0 && !sidebarCollapsed && (
              <div className="rounded-2xl bg-white/10 border border-white/10 p-4 text-sm text-white/70">
                No tienes módulos habilitados.
              </div>
            )}
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

      <section
        className={`${sidebarWidth} pt-16 lg:pt-0 transition-all duration-300`}
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
              <span className="font-black text-slate-900">Usuarios</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">{currentUserName}</p>
              <p className="text-xs text-slate-500">{authUser?.email}</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-[#244C5A] text-white flex items-center justify-center font-black uppercase">{currentUserName.slice(0, 1)}</div>
          </div>
        </header>

        <div className="md:hidden bg-white border-b border-slate-200">
          <div className="max-w-[1600px] mx-auto px-5 py-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push("/panel")}
              className="flex items-center gap-2 rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-2.5 text-sm font-black"
            >
              <Home size={17} />
              Home
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700"
            >
              <LogOut size={17} />
              Cerrar sesión
            </button>
          </div>
        </div>

        <section className="max-w-[1600px] mx-auto px-5 sm:px-8 py-6">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
              <div>
                <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                  {editingId ? "Editando usuario" : "Nuevo usuario"}
                </p>
                <h2 className="text-2xl font-black mt-1">
                  {editingId ? "Actualizar datos del usuario" : "Crear usuario"}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Crea el acceso en Authentication, guarda el perfil y asigna un
                  rol.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
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

            <div className="p-5 sm:p-6 grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-6">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 flex flex-col items-center justify-center">
                <div className="relative">
                  <div className="w-32 h-32 rounded-[32px] bg-white border border-slate-200 overflow-hidden shadow-sm">
                    <Image
                      src={photoPreview || defaultPhoto}
                      alt="Foto usuario"
                      width={140}
                      height={140}
                      className="w-full h-full object-cover"
                      unoptimized={photoPreview.startsWith("blob:")}
                    />
                  </div>

                  <label className="absolute -right-2 -bottom-2 w-11 h-11 rounded-2xl bg-[#244C5A] text-white flex items-center justify-center shadow-lg cursor-pointer hover:bg-[#1b3b46] transition">
                    <Camera size={20} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={!canModifyForm}
                      onChange={(e) => handlePhotoChange(e.target.files?.[0])}
                    />
                  </label>
                </div>

                <p className="text-sm font-black mt-4 text-slate-900">
                  Foto del usuario
                </p>
                <p className="text-xs text-slate-500 text-center mt-1">
                  En edición no es obligatorio volver a cargarla.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
                <div className="lg:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Nombre
                  </label>
                  <div className="relative">
                    <UserRound
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={19}
                    />
                    <input
                      type="text"
                      value={form.nombre}
                      disabled={!canModifyForm}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          nombre: e.target.value,
                        }))
                      }
                      placeholder="Nombre completo"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={19}
                    />
                    <input
                      type="email"
                      value={form.email}
                      disabled={!!editingId || !canModifyForm}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          email: e.target.value,
                        }))
                      }
                      placeholder="correo@empresa.com"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Teléfono
                  </label>
                  <div className="relative">
                    <Phone
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={19}
                    />
                    <input
                      type="tel"
                      value={form.telefono}
                      disabled={!canModifyForm}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          telefono: e.target.value,
                        }))
                      }
                      placeholder="Número de contacto"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    RH
                  </label>
                  <div className="relative">
                    <Droplet
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={19}
                    />
                    <select
                      value={form.rh}
                      disabled={!canModifyForm}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          rh: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    >
                      <option value="">Selecciona RH</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Fecha de cumpleaños
                  </label>
                  <div className="relative">
                    <CalendarDays
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={19}
                    />
                    <input
                      type="date"
                      value={form.fechaCumpleanos}
                      disabled={!canModifyForm}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          fechaCumpleanos: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                    />
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Rol
                  </label>
                  <select
                    value={form.rolId}
                    disabled={!canModifyForm}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        rolId: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  >
                    <option value="">
                      {loadingRoles ? "Cargando roles..." : "Selecciona un rol"}
                    </option>

                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Contraseña temporal
                  </label>
                  <input
                    type="text"
                    value={form.password}
                    disabled={!!editingId}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        password: e.target.value,
                      }))
                    }
                    placeholder={
                      editingId ? "No editable aquí" : "Mínimo 6 caracteres"
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="md:col-span-2 xl:col-span-7 rounded-3xl border border-[#244C5A]/15 bg-[#244C5A]/5 p-4 text-sm text-[#244C5A]">
                  <strong>Nota:</strong> al crear usuario, el correo queda
                  registrado en Firebase Authentication con la contraseña
                  temporal indicada.
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-6 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition whitespace-nowrap flex items-center justify-center gap-2"
                >
                  <X size={17} />
                  Cancelar
                </button>
              )}

              {((editingId && can("usuarios", "editar")) ||
                (!editingId && can("usuarios", "crear"))) && (
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-6 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20 whitespace-nowrap"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : editingId ? (
                    <Save size={20} />
                  ) : (
                    <Plus size={20} />
                  )}
                  {saving
                    ? "Guardando..."
                    : editingId
                      ? "Actualizar usuario"
                      : "Crear usuario"}
                </button>
              )}
            </div>
          </form>

          <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 mt-6 overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                  Usuarios guardados
                </p>
                <h2 className="text-2xl font-black mt-1">Lista de usuarios</h2>
                <p className="text-slate-500 text-sm mt-1">
                  Usuarios sincronizados desde Firestore.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <div className="relative w-full lg:w-[340px]">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={19}
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar usuario, email, teléfono, RH, cumpleaños o rol..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center">
                  {filteredUsers.length} usuarios
                </div>
              </div>
            </div>

            {loadingUsers ? (
              <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
                <Loader2 className="animate-spin" size={22} />
                Cargando usuarios...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center">
                <UserCircle2 className="mx-auto text-[#244C5A]" size={44} />
                <h3 className="font-black text-slate-900 mt-4">
                  No hay usuarios para mostrar
                </h3>
                <p className="text-sm text-slate-500 mt-2">
                  Crea un usuario o cambia el texto de búsqueda.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1320px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Usuario
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Contacto
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Rol
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Contraseña
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Estado
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Acciones
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.map((item) => {
                      const passwordVisible = visiblePasswords[item.id];
                      const storedPassword = item.passwordTemporal || "";

                      return (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                <Image
                                  src={item.fotoUrl || defaultPhoto}
                                  alt={item.nombre}
                                  width={56}
                                  height={56}
                                  className="w-full h-full object-cover"
                                  unoptimized={
                                    !!item.fotoUrl &&
                                    !item.fotoUrl.startsWith("/")
                                  }
                                />
                              </div>

                              <div>
                                <p className="font-black text-slate-900">
                                  {item.nombre}
                                </p>
                                <p className="text-xs text-slate-500">
                                  ID: {item.id.slice(0, 8)}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-sm font-bold text-slate-800">
                              {item.email}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {item.telefono || "Sin teléfono"}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              RH: {item.rh || "Sin RH"} · Cumpleaños:{" "}
                              {item.fechaCumpleanos || "Sin fecha"}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex items-center rounded-full bg-[#244C5A]/10 text-[#244C5A] px-3 py-1 text-xs font-black">
                              {item.rolNombre || "Sin rol"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-slate-700 min-w-[120px]">
                                {storedPassword
                                  ? passwordVisible
                                    ? storedPassword
                                    : "••••••••"
                                  : "No guardada"}
                              </span>

                              {storedPassword && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    togglePasswordVisibility(item.id)
                                  }
                                  className="w-9 h-9 rounded-xl border border-[#244C5A] text-[#244C5A] hover:bg-[#244C5A] hover:text-white flex items-center justify-center transition"
                                >
                                  {passwordVisible ? (
                                    <EyeOff size={17} />
                                  ) : (
                                    <Eye size={17} />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${
                                item.activo
                                  ? "bg-green-50 text-green-700"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              {item.activo ? (
                                <CheckCircle2 size={15} />
                              ) : (
                                <XCircle size={15} />
                              )}
                              {item.activo ? "Activo" : "Inactivo"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleSendCredentialsEmail(item)}
                                disabled={emailingId === item.id || !item.passwordTemporal}
                                className="w-10 h-10 rounded-2xl border border-[#244C5A] text-[#244C5A] hover:bg-[#244C5A] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition"
                                title={
                                  item.passwordTemporal
                                    ? "Enviar credenciales por email"
                                    : "Sin contraseña temporal para enviar"
                                }
                              >
                                {emailingId === item.id ? (
                                  <Loader2 className="animate-spin" size={18} />
                                ) : (
                                  <MailPlus size={18} />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedCarnet(item)}
                                className="w-10 h-10 rounded-2xl border border-[#244C5A] text-[#244C5A] hover:bg-[#244C5A] hover:text-white flex items-center justify-center transition"
                                title="Ver carnet"
                              >
                                <IdCard size={19} />
                              </button>

                              {can("usuarios", "editar") && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(item)}
                                    className="w-10 h-10 rounded-2xl border border-[#244C5A] text-[#244C5A] hover:bg-[#244C5A] hover:text-white flex items-center justify-center transition"
                                    title="Editar"
                                  >
                                    <Edit3 size={18} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(item)}
                                    disabled={togglingId === item.id}
                                    className="w-10 h-10 rounded-2xl border border-[#244C5A] text-[#244C5A] hover:bg-[#244C5A] hover:text-white disabled:opacity-60 flex items-center justify-center transition"
                                    title={
                                      item.activo ? "Desactivar" : "Activar"
                                    }
                                  >
                                    {togglingId === item.id ? (
                                      <Loader2
                                        className="animate-spin"
                                        size={18}
                                      />
                                    ) : item.activo ? (
                                      <XCircle size={18} />
                                    ) : (
                                      <CheckCircle2 size={18} />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </section>

      {selectedCarnet && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-[410px]">
            <div className="relative rounded-[30px] overflow-hidden shadow-2xl bg-[#244C5A] text-white h-[calc(100vh-16px)] max-h-[660px] min-h-[560px]">
              <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-white/10" />
              <div className="absolute -left-16 bottom-16 w-52 h-52 rounded-full bg-white/10" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.20),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_30%)]" />

              <button
                type="button"
                onClick={() => setSelectedCarnet(null)}
                className="absolute right-4 top-4 z-20 w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X size={21} />
              </button>

              <div className="relative h-full p-5 flex flex-col">
                <div className="flex items-center justify-between gap-4 pr-12 shrink-0">
                  <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-2">
                    <Image
                      src="/logo.png"
                      alt="Nuall"
                      width={108}
                      height={52}
                      priority
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center py-3">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-[30px] bg-white/10 border-4 border-white/25 overflow-hidden shadow-2xl shrink-0">
                    <Image
                      src={selectedCarnet.fotoUrl || defaultPhoto}
                      alt={selectedCarnet.nombre}
                      width={140}
                      height={140}
                      className="w-full h-full object-cover"
                      unoptimized={
                        !!selectedCarnet.fotoUrl &&
                        !selectedCarnet.fotoUrl.startsWith("/")
                      }
                    />
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black mt-4 leading-tight line-clamp-2">
                    {selectedCarnet.nombre}
                  </h3>

                  <p className="text-white/75 mt-1 text-base font-semibold line-clamp-1">
                    {selectedCarnet.rolNombre || "Sin rol asignado"}
                  </p>

                  <span
                    className={`mt-3 text-xs font-black uppercase tracking-[0.3em] ${
                      selectedCarnet.activo ? "text-green-300" : "text-red-300"
                    }`}
                  >
                    {selectedCarnet.activo ? "Activo" : "Inactivo"}
                  </span>

                  <div className="w-full mt-4 space-y-2 text-left">
                    <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-2">
                      <p className="text-[10px] text-white/50 uppercase tracking-wide">
                        Email
                      </p>
                      <p className="text-sm font-bold break-all leading-tight">
                        {selectedCarnet.email}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-2">
                        <p className="text-[10px] text-white/50 uppercase tracking-wide">
                          Teléfono
                        </p>
                        <p className="text-sm font-bold truncate">
                          {selectedCarnet.telefono || "Sin teléfono"}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/10 border border-white/10 px-3 py-2">
                        <p className="text-[10px] text-white/50 uppercase tracking-wide">
                          RH
                        </p>
                        <p className="text-sm font-bold truncate">
                          {selectedCarnet.rh || "Sin RH"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white text-slate-900 p-3 shadow-lg shrink-0">
                  <div className="h-14 rounded-xl bg-white border border-slate-200 px-2 py-2 flex items-stretch justify-center gap-[1px] overflow-hidden">
                    {buildBarcodeBars(getCarnetBarcodeValue(selectedCarnet)).map(
                      (bar, index) => (
                        <span
                          key={`${getCarnetBarcodeValue(selectedCarnet)}-${index}`}
                          className={bar.active ? "bg-slate-950" : "bg-transparent"}
                          style={{ width: `${bar.width}px` }}
                        />
                      ),
                    )}
                  </div>
                  <p className="mt-1 text-center font-mono text-[11px] font-black tracking-wider text-slate-800">
                    {getCarnetBarcodeValue(selectedCarnet)}
                  </p>
                </div>

                <div className="text-center text-[10px] text-white/45 mt-2 shrink-0">
                  Derechos de Nuall · Desarrollado por PRINTSERP SAS
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
