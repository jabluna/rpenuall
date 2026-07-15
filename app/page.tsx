"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ShieldCheck,
  Users,
  ShoppingCart,
  Truck,
  Loader2,
} from "lucide-react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const savedEmail = localStorage.getItem("nuall_email");

    if (savedEmail) {
      setEmail(savedEmail);
      setRemember(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);

      if (remember) {
        localStorage.setItem("nuall_email", email);
      } else {
        localStorage.removeItem("nuall_email");
      }

      router.push("/panel");
    } catch (err: any) {
      if (err.code === "auth/invalid-credential") {
        setError("Correo o contraseña incorrectos.");
      } else if (err.code === "auth/user-not-found") {
        setError("No existe un usuario con este correo.");
      } else if (err.code === "auth/wrong-password") {
        setError("La contraseña no es correcta.");
      } else {
        setError("No fue posible iniciar sesión. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    setMessage("");

    if (!email) {
      setError("Escribe tu correo para recuperar la contraseña.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Te enviamos un correo para recuperar tu contraseña.");
    } catch {
      setError("No fue posible enviar el correo de recuperación.");
    }
  };

  return (
    <main className="min-h-screen relative flex items-center justify-center px-4 py-6 overflow-hidden">
      {/* Fondo con imagen */}
      <div className="absolute inset-0 bg-[url('/fondo.jpg')] bg-cover bg-center bg-no-repeat" />

      {/* Capa oscura elegante */}
      <div className="absolute inset-0 bg-[#244C5A]/75" />

      {/* Decoración suave */}
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_left,#ffffff_0,transparent_32%),radial-gradient(circle_at_bottom_right,#ffffff_0,transparent_28%)]" />

      <section className="relative z-10 w-full max-w-6xl bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Panel izquierdo escritorio */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-[#244C5A]/95 text-white relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-white/10" />
          <div className="absolute -left-16 bottom-20 w-52 h-52 rounded-full bg-white/10" />

          <div className="relative">
            <Image
              src="/logo.png"
              alt="Nuall"
              width={180}
              height={90}
              className="mb-12 drop-shadow-lg"
              priority
            />

            <span className="inline-flex items-center gap-2 bg-white/15 border border-white/20 px-4 py-2 rounded-full text-sm mb-6">
              <ShieldCheck size={18} />
              Acceso seguro empresarial
            </span>

            <h1 className="text-4xl font-bold leading-tight mb-5">
              Administra tu empresa desde una plataforma moderna.
            </h1>

            <p className="text-white/80 text-lg max-w-md">
              Gestión de clientes, proveedores, compras, operaciones y procesos
              internos en un solo lugar.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-4 mt-10">
            <div className="bg-white/12 border border-white/15 rounded-2xl p-4">
              <Users className="mb-3" />
              <p className="text-sm text-white/80">Clientes</p>
            </div>

            <div className="bg-white/12 border border-white/15 rounded-2xl p-4">
              <Truck className="mb-3" />
              <p className="text-sm text-white/80">Proveedores</p>
            </div>

            <div className="bg-white/12 border border-white/15 rounded-2xl p-4">
              <ShoppingCart className="mb-3" />
              <p className="text-sm text-white/80">Compras</p>
            </div>
          </div>
        </div>

        {/* Login */}
        <div className="p-7 sm:p-10 lg:p-14">
          {/* Logo móvil */}
<div className="flex justify-center lg:hidden mb-8">
  <div className="bg-[#244C5A] rounded-3xl px-8 py-5 shadow-lg">
    <Image
      src="/logo.png"
      alt="Nuall"
      width={170}
      height={90}
      priority
      className="drop-shadow-md"
    />
  </div>
</div>

          <div className="mb-8">
            <p className="text-sm font-semibold text-[#244C5A] uppercase tracking-wide">
              Bienvenido de nuevo
            </p>

            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2">
              Iniciar sesión
            </h2>

            <p className="text-gray-500 mt-3">
              Ingresa tus credenciales para continuar.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Correo electrónico
              </label>

              <div className="relative group">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#244C5A]"
                  size={20}
                />

                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@empresa.com"
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#244C5A]/25 focus:border-[#244C5A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Contraseña
              </label>

              <div className="relative group">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#244C5A]"
                  size={20}
                />

                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  className="w-full pl-12 pr-12 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-[#244C5A]/25 focus:border-[#244C5A]"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#244C5A]"
                  aria-label="Mostrar contraseña"
                >
                  {showPassword ? <EyeOff size={21} /> : <Eye size={21} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 text-sm">
              <label className="flex items-center gap-2 text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 accent-[#244C5A]"
                />
                Recordar correo
              </label>

              <button
                type="button"
                onClick={handleResetPassword}
                className="font-semibold text-[#244C5A] hover:underline"
              >
                Recuperar contraseña
              </button>
            </div>

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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl shadow-xl shadow-[#244C5A]/25 transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={20} className="animate-spin" />}
              {loading ? "Validando..." : "Entrar a la plataforma"}
            </button>
          </form>

          <footer className="mt-10 text-center text-xs text-gray-500">
            Derechos de{" "}
            <span className="font-bold text-[#244C5A]">Nuall</span> y
            desarrollado por{" "}
            <span className="font-bold text-[#244C5A]">PRINTSERP SAS</span>
          </footer>
        </div>
      </section>
    </main>
  );
}