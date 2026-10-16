"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onValue, ref, runTransaction, get } from "firebase/database";
import { dbRealtime } from "@/lib/firebase";
import { useUserPermissions } from "@/lib/useUserPermissions";

type Bodega = { id: string; nombre: string; ubicacion?: string; activa?: boolean; eliminada?: boolean };
export default function BodegasPage() {
  const { loading, can } = useUserPermissions();
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const editar = can("proveedoresBodega", "editar");
  const eliminar = can("proveedoresBodega", "eliminar");
  const ver = can("proveedoresBodega", "ver");
  const crear = can("proveedoresBodega", "crear");
  useEffect(() => {
    if (loading || !ver) return;
    return onValue(ref(dbRealtime, "BODEGAS"), snapshot => {
      const raw = (snapshot.val() || {}) as Record<string, Bodega>;
      setBodegas(Object.entries(raw).filter(([, b]) => !b.eliminada).map(([id, b]) => ({ ...b, id })));
    }, () => setError("No fue posible consultar bodegas. Revisa los permisos de Firebase."));
  }, [loading, ver]);
  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!(editando ? editar : crear) || guardando) return;
    const id = codigo.trim().toUpperCase();
    if (editando && id !== editando) { setError("El código de una bodega no se puede modificar."); return; }
    if (!/^[A-Z0-9_-]{2,24}$/.test(id) || !nombre.trim()) {
      setError("Código inválido o nombre vacío."); return;
    }
    setGuardando(true); setError(""); setMensaje("");
    try {
      const resultado = await runTransaction(ref(dbRealtime, "BODEGAS/" + id), actual => {
        if (editando) {
          if (!actual || actual.eliminada) return;
          return { ...actual, nombre: nombre.trim(), ubicacion: ubicacion.trim(), actualizadoEn: Date.now() };
        }
        return actual === null ? { id, codigo: id, nombre: nombre.trim(), ubicacion: ubicacion.trim(), activa: true, principal: id === "BOD-001", creadaEn: Date.now() } : undefined;
      }, { applyLocally: false });
      if (!resultado.committed) throw new Error(editando ? "La bodega ya no está disponible." : "Ya existe una bodega con ese código.");
      setNombre(""); setCodigo(""); setUbicacion(""); setEditando(null);
      setMensaje("Bodega guardada correctamente.");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); }
    finally { setGuardando(false); }
  }
  function comenzarEdicion(b: Bodega) {
    setEditando(b.id); setCodigo(b.id); setNombre(b.nombre); setUbicacion(b.ubicacion || "");
    setError(""); setMensaje("");
  }
  async function eliminarBodega(b: Bodega) {
    if (!eliminar || guardando || b.id === "BOD-001") return;
    if (!window.confirm("¿Eliminar " + b.nombre + "? La bodega dejará de aparecer en el catálogo.")) return;
    setGuardando(true); setError(""); setMensaje("");
    try {
      // No eliminar registros históricos: conservar auditoría y bloquear si existen existencias.
      const inventario = await get(ref(dbRealtime, "INVENTARIO_BODEGAS/" + b.id));
      if (inventario.exists()) throw new Error("No se puede eliminar: hay registros de inventario en esta bodega.");
      const resultado = await runTransaction(ref(dbRealtime, "BODEGAS/" + b.id), actual => {
        if (!actual || actual.eliminada || actual.principal || b.id === "BOD-001") return;
        return { ...actual, eliminada: true, activa: false, eliminadaEn: Date.now() };
      }, { applyLocally: false });
      if (!resultado.committed) throw new Error("No se pudo eliminar la bodega.");
      setMensaje("Bodega retirada del catálogo. El registro se conserva para auditoría.");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo eliminar."); }
    finally { setGuardando(false); }
  }
  if (loading) return <main className="p-8">Cargando permisos…</main>;
  if (!ver) return <main className="p-8">No tienes permiso para consultar bodegas.</main>;
  return <main className="min-h-screen bg-slate-100 p-6 text-slate-900 md:p-10">
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/panel/proveedores-bodega" className="font-semibold text-teal-800">← Volver a proveedores</Link>
      <header><h1 className="text-3xl font-black">Gestión de bodegas</h1><p className="mt-2 text-slate-500">Fase 1 · Crear, editar y retirar bodegas sin alterar el inventario actual.</p></header>
      {!bodegas.some(b => b.id === "BOD-001") && <p className="rounded-xl bg-amber-50 p-4 text-amber-900">La bodega principal aún no está registrada. Su inventario permanece intacto en PROVEEDORES. Puedes registrarla con código BOD-001.</p>}
      {mensaje && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-700">{mensaje}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {(crear || (editar && !!editando)) && <form onSubmit={guardar} className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-2">
        <h2 className="font-bold md:col-span-2">{editando ? "Editar bodega" : "Nueva bodega"}</h2>
        <label className="grid gap-1 text-sm">Código<input required disabled={!!editando} maxLength={24} value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="BOD-002" className="rounded-xl border p-3"/></label>
        <label className="grid gap-1 text-sm">Nombre<input required maxLength={100} value={nombre} onChange={e => setNombre(e.target.value)} className="rounded-xl border p-3"/></label>
        <label className="grid gap-1 text-sm md:col-span-2">Ubicación<input value={ubicacion} onChange={e => setUbicacion(e.target.value)} className="rounded-xl border p-3"/></label>
        <button disabled={guardando} className="rounded-xl bg-teal-900 px-5 py-3 font-bold text-white disabled:opacity-50">{guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear bodega"}</button>{editando && <button type="button" className="rounded-xl border px-5 py-3" onClick={() => { setEditando(null); setCodigo(""); setNombre(""); setUbicacion(""); }}>Cancelar</button>}
      </form>}
      <section className="grid gap-4 md:grid-cols-2">{bodegas.map(b => <article key={b.id} className="rounded-2xl bg-white p-6 shadow-sm"><div className="flex justify-between"><h2 className="text-xl font-bold">{b.nombre}</h2><span className="text-sm text-emerald-700">{b.activa === false ? "Inactiva" : "Activa"}</span></div><p className="mt-2 text-slate-500">{b.id}{b.id === "BOD-001" ? " · Principal" : ""}</p><p className="mt-2 text-sm text-slate-500">{b.ubicacion || "Sin ubicación"}</p><p className="mt-4 text-xs text-slate-400">Inventario pendiente de integración</p><div className="mt-4 flex gap-2">{editar && <button type="button" onClick={() => comenzarEdicion(b)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Editar</button>}{eliminar && b.id !== "BOD-001" && <button type="button" disabled={guardando} onClick={() => eliminarBodega(b)} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Eliminar</button>}</div></article>)}</section>
    </div>
  </main>;
}
