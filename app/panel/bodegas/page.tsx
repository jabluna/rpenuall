"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onValue, ref, runTransaction } from "firebase/database";
import { dbRealtime } from "@/lib/firebase";
import { useUserPermissions } from "@/lib/useUserPermissions";

type Bodega = { id: string; nombre: string; ubicacion?: string; activa?: boolean };
export default function BodegasPage() {
  const { loading, can } = useUserPermissions();
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const ver = can("proveedoresBodega", "ver");
  const crear = can("proveedoresBodega", "crear");
  useEffect(() => {
    if (loading || !ver) return;
    return onValue(ref(dbRealtime, "BODEGAS"), snapshot => {
      const raw = (snapshot.val() || {}) as Record<string, Bodega>;
      setBodegas(Object.entries(raw).map(([id, b]) => ({ ...b, id })));
    }, () => setError("No fue posible consultar bodegas. Revisa los permisos de Firebase."));
  }, [loading, ver]);
  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!crear || guardando) return;
    const id = codigo.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,24}$/.test(id) || !nombre.trim()) {
      setError("Código inválido o nombre vacío."); return;
    }
    setGuardando(true); setError("");
    try {
      const resultado = await runTransaction(ref(dbRealtime, "BODEGAS/" + id), actual =>
        actual === null ? { id, codigo: id, nombre: nombre.trim(), ubicacion: ubicacion.trim(), activa: true, principal: id === "BOD-001", creadaEn: Date.now() } : undefined,
        { applyLocally: false });
      if (!resultado.committed) throw new Error("Ya existe una bodega con ese código.");
      setNombre(""); setCodigo(""); setUbicacion("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); }
    finally { setGuardando(false); }
  }
  if (loading) return <main className="p-8">Cargando permisos…</main>;
  if (!ver) return <main className="p-8">No tienes permiso para consultar bodegas.</main>;
  return <main className="min-h-screen bg-slate-100 p-6 text-slate-900 md:p-10">
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/panel/proveedores-bodega" className="font-semibold text-teal-800">← Volver a proveedores</Link>
      <header><h1 className="text-3xl font-black">Gestión de bodegas</h1><p className="mt-2 text-slate-500">Fase 1 · Crear bodegas sin alterar el inventario actual.</p></header>
      {!bodegas.some(b => b.id === "BOD-001") && <p className="rounded-xl bg-amber-50 p-4 text-amber-900">La bodega principal aún no está registrada. Su inventario permanece intacto en PROVEEDORES. Puedes registrarla con código BOD-001.</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {crear && <form onSubmit={guardar} className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-2">
        <h2 className="font-bold md:col-span-2">Nueva bodega</h2>
        <label className="grid gap-1 text-sm">Código<input required maxLength={24} value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="BOD-002" className="rounded-xl border p-3"/></label>
        <label className="grid gap-1 text-sm">Nombre<input required maxLength={100} value={nombre} onChange={e => setNombre(e.target.value)} className="rounded-xl border p-3"/></label>
        <label className="grid gap-1 text-sm md:col-span-2">Ubicación<input value={ubicacion} onChange={e => setUbicacion(e.target.value)} className="rounded-xl border p-3"/></label>
        <button disabled={guardando} className="rounded-xl bg-teal-900 px-5 py-3 font-bold text-white disabled:opacity-50">{guardando ? "Guardando…" : "Crear bodega"}</button>
      </form>}
      <section className="grid gap-4 md:grid-cols-2">{bodegas.map(b => <article key={b.id} className="rounded-2xl bg-white p-6 shadow-sm"><div className="flex justify-between"><h2 className="text-xl font-bold">{b.nombre}</h2><span className="text-sm text-emerald-700">{b.activa === false ? "Inactiva" : "Activa"}</span></div><p className="mt-2 text-slate-500">{b.id}{b.id === "BOD-001" ? " · Principal" : ""}</p><p className="mt-2 text-sm text-slate-500">{b.ubicacion || "Sin ubicación"}</p><p className="mt-4 text-xs text-slate-400">Inventario pendiente de integración</p></article>)}</section>
    </div>
  </main>;
}
