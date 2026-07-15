"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  ChevronDown,
  ClipboardList,
  Eye,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
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
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
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

export default function MuestraPage() {
  const router = useRouter();
  const { authUser, profile, loading: loadingPermissions } = useUserPermissions();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Comercial: true,
  });

  const userName = useMemo(() => {
    return (
      profile?.nombre ||
      authUser?.displayName ||
      authUser?.email?.split("@")[0] ||
      "Usuario"
    );
  }, [profile, authUser]);

  const userRole =
    (profile as any)?.rolNombre ||
    (profile as any)?.role ||
    (profile as any)?.rol ||
    "Sin rol";

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((current) => ({
      ...current,
      [sectionTitle]: !current[sectionTitle],
    }));

    if (sidebarCollapsed) setSidebarCollapsed(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  if (loadingPermissions) {
    return (
      <main className="min-h-screen bg-[#244C5A] flex items-center justify-center">
        <div className="rounded-3xl bg-white px-8 py-6 font-black text-[#244C5A] shadow-2xl">
          Validando acceso...
        </div>
      </main>
    );
  }

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[300px]";

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

      <section className={`${sidebarWidth} transition-all duration-300`}>
        <header className="h-16 lg:h-20 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-10 h-10 rounded-2xl bg-[#244C5A] text-white flex items-center justify-center"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>

            <button
              type="button"
              onClick={() => router.push("/panel")}
              className="w-10 h-10 rounded-2xl bg-[#244C5A]/10 text-[#244C5A] flex items-center justify-center"
              aria-label="Volver al panel"
            >
              <ArrowLeft size={20} />
            </button>

            <div>
              <p className="text-xs font-bold text-slate-500">
                Comercial / Generar orden de muestra
              </p>
              <h1 className="text-lg sm:text-2xl font-black">
                Generar orden de muestra
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center"
            aria-label="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>
        </header>

        <section className="min-h-[calc(100vh-80px)] flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-3xl rounded-[36px] border border-slate-200 bg-white px-8 py-20 text-center shadow-sm">
            <h2 className="text-4xl sm:text-6xl font-black text-[#244C5A]">
              PARA CONSTRUIR
            </h2>
          </div>
        </section>
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

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center"
                aria-label="Cerrar menú"
              >
                <ArrowLeft size={20} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <Link
              href="/panel"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 mb-2 hover:bg-white/10 ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
            >
              <LayoutDashboard size={20} />
              {!sidebarCollapsed && <span className="font-bold">Panel Principal</span>}
            </Link>

            {menuSections.map((section) => {
              const SectionIcon = section.icon;
              const isOpen = !!openSections[section.title];

              return (
                <div key={section.title} className="mb-2">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className={`w-full flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-white/10 ${
                      sidebarCollapsed ? "justify-center" : ""
                    }`}
                  >
                    <SectionIcon size={20} />
                    {!sidebarCollapsed && (
                      <>
                        <span className="font-black flex-1 text-left">{section.title}</span>
                        <ChevronDown
                          size={18}
                          className={`transition ${isOpen ? "rotate-180" : ""}`}
                        />
                      </>
                    )}
                  </button>

                  {!sidebarCollapsed && isOpen && (
                    <div className="mt-1 ml-3 pl-3 border-l border-white/15 space-y-1">
                      {section.items.map((item) => {
                        const ItemIcon = item.icon;

                        return (
                          <Link
                            key={`${section.title}-${item.title}`}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
                          >
                            <ItemIcon size={17} />
                            <span>{item.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/10 p-3">
            {!sidebarCollapsed && (
              <div className="rounded-2xl bg-white/10 px-4 py-3 mb-3">
                <p className="font-black truncate">{userName}</p>
                <p className="text-xs text-white/60 truncate">{userEmail}</p>
                <p className="text-xs text-white/60 truncate">{userRole}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="hidden lg:flex flex-1 items-center justify-center rounded-2xl bg-white/10 py-3 hover:bg-white/15"
                aria-label={sidebarCollapsed ? "Expandir menú" : "Contraer menú"}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen size={20} />
                ) : (
                  <PanelLeftClose size={20} />
                )}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 hover:bg-white/15"
              >
                <LogOut size={19} />
                {!sidebarCollapsed && <span className="font-bold">Salir</span>}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}