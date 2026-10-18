"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Boxes, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Factory, FileText, Filter, Loader2, PackageCheck, RefreshCw, Search, ShoppingCart, Tags, Timeline, Truck, X } from "lucide-react";
import { get, ref } from "firebase/database";
import { dbRealtime } from "@/lib/firebase";
import { useUserPermissions } from "@/lib/useUserPermissions";
import NoPermission from "@/components/NoPermission";

type Fuente = "pedido" | "compra" | "compra_etiquetas" | "programacion" | "traslado";
type Evento = { id:string; fuente:Fuente; referencia:string; titulo:string; detalle:string; fecha:string; estado:string; responsable:string; url:string; items:number; cantidad:number; relaciones:string[]; pasos:Paso[] };
type Paso = { titulo:string; fecha:string; estado:string; descripcion:string; usuario?:string };
const fuentes: Record<Fuente,{nombre:string;url:string;clase:string}> = {
  pedido:{nombre:"Pedidos / producción",url:"/panel/ordenes_creadas",clase:"bg-indigo-50 text-indigo-700 border-indigo-200"},
  compra:{nombre:"Compras de insumos",url:"/panel/gestion-compras2",clase:"bg-sky-50 text-sky-700 border-sky-200"},
  compra_etiquetas:{nombre:"Compras de etiquetas",url:"/panel/gestion-etiquetas",clase:"bg-amber-50 text-amber-800 border-amber-200"},
  programacion:{nombre:"Programación de planta",url:"/panel/produccionxplanta",clase:"bg-violet-50 text-violet-700 border-violet-200"},
  traslado:{nombre:"Traslados entre bodegas",url:"/panel/proveedores-bodega",clase:"bg-emerald-50 text-emerald-700 border-emerald-200"},
};
const normal = (v:unknown) => String(v ?? "").trim();
const fechaISO = (v:unknown) => { const t=normal(v); if(!t)return ""; const d=new Date(t); return Number.isNaN(d.getTime()) ? t : d.toISOString(); };
const fechaVista = (v:string) => { if(!v)return "Sin fecha"; const d=new Date(v); return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"short",year:"numeric"}).format(d); };
const lista = (v:any):any[] => Array.isArray(v)?v:Object.values(v || {});
const textoCliente = (v:any) => typeof v==="string"?v:normal(v?.nombre || v?.cliente || v?.razonSocial || v?.codigo_cliente);
const num = (v:unknown) => Number(v)||0;
function estadosGestion(g:any):Paso[] {
  const pasos:Paso[]=[];
  if(g?.facturaCompra?.fecha)pasos.push({titulo:"Factura adjuntada",fecha:fechaISO(g.facturaCompra.fecha),estado:"registrado",descripcion:normal(g.facturaCompra.nombre),usuario:normal(g.facturaCompra.subidoPor)});
  Object.entries(g?.estados || {}).forEach(([item, procesos]:[string,any]) => {
    Object.entries(procesos || {}).forEach(([nombre,registro]:[string,any]) => {
      const meta=registro?.meta;
      if(!meta?.fecha)return;
      pasos.push({titulo:nombre.replace(/_/g," "),fecha:fechaISO(meta.fecha),estado:normal(registro.estado),descripcion:"Ítem "+item+(meta.motivo?" · "+meta.motivo:""),usuario:normal(meta.usuario || meta.email)});
    });
  });
  return pasos;
}
function construir(datos:Record<string,any>):Evento[] {
  const salida:Evento[]=[];
  const add=(fuente:Fuente,id:string,v:any,gestion?:any)=>{
    const refOrden=normal(v?.ordenPedido || v?.ordenCompra || v?.consecutivo || v?.numeroOrden || v?.orden || v?.codigo || id);
    const items=lista(v?.items || v?.itemsCompra || v?.productos || v?.detalle || v?.itemsPedido);
    const estado=normal(v?.estadoGeneral || v?.estado || v?.estadoCalculado || "Registrado");
    const creado=fechaISO(v?.creadoAt || v?.createdAt || v?.fecha || v?.fechaCreacion || v?.actualizadoAt);
    const pasos:Paso[]=[{titulo:"Registro creado",fecha:creado,estado:"registrado",descripcion:refOrden,usuario:normal(v?.creadoPor || v?.creadoPorEmail)}];
    if(fuente==="pedido"){
      items.forEach((it:any,index:number)=>{
        Object.entries(it?.estadosMeta || {}).forEach(([nombre,meta]:[string,any])=>{if(meta?.fecha)pasos.push({titulo:nombre.replace(/_/g," "),fecha:fechaISO(meta.fecha),estado:normal(meta.estado || it?.procesos?.[nombre]),descripcion:normal(it?.producto || it?.codigo || "Producto "+(index+1)),usuario:normal(meta.usuario)});});
        Object.entries(it?.historialEstados || {}).forEach(([nombre,hist]:[string,any])=>lista(hist).forEach((meta:any)=>{if(meta?.fecha)pasos.push({titulo:nombre.replace(/_/g," "),fecha:fechaISO(meta.fecha),estado:normal(meta.estado),descripcion:normal(it?.producto || it?.codigo),usuario:normal(meta.usuario)});}));
      });
    }
    if(gestion)pasos.push(...estadosGestion(gestion));
    if(v?.actualizadoAt && v.actualizadoAt!==v.creadoAt)pasos.push({titulo:"Última actualización",fecha:fechaISO(v.actualizadoAt),estado,descripcion:"Registro actualizado",usuario:normal(v?.actualizadoPor)});
    const relaciones=[v?.ordenPedido,v?.ordenPedidoId,v?.ordenCompra,v?.pedidoId,v?.compraId,v?.referenciaOrden,v?.ordenProduccion,v?.ordenOrigen].map(normal).filter(Boolean);
    salida.push({id:fuente+":"+id,fuente,referencia:refOrden,titulo:fuente==="pedido"?textoCliente(v?.cliente || v?.clienteNombre || v?.datosCliente) || "Orden de pedido":fuente==="programacion"?normal(v?.titulo || v?.tipo || "Actividad programada"):fuente==="traslado"?normal(v?.bodegaDestino || v?.destino || "Traslado de insumos"):normal(v?.proveedor || v?.nombreProveedor || v?.origen || "Orden de compra"),detalle:fuente==="pedido"?"Producción y seguimiento de productos":fuentes[fuente].nombre,fecha:creado,estado,responsable:normal(v?.creadoPor || v?.responsableProduccion || v?.usuario || v?.creadoPorEmail || "Sin responsable"),url:fuentes[fuente].url,items:items.length,cantidad:items.reduce((n:number,it:any)=>n+num(it?.cantidadComprar ?? it?.totalUnidades ?? it?.cantidad ?? it?.total),0),relaciones,pasos:pasos.filter(p=>p.fecha).sort((a,b)=>a.fecha.localeCompare(b.fecha))});
  };
  Object.entries(datos.ORDENES_PEDIDO || {}).forEach(([id,v])=>add("pedido",id,v));
  Object.entries(datos.COMPRAS_BODEGA || {}).forEach(([id,v])=>add("compra",id,v,datos.GESTION_COMPRAS_BODEGA?.[id]));
  Object.entries(datos.COMPRAS_ETIQUETAS || {}).forEach(([id,v])=>add("compra_etiquetas",id,v,datos.GESTION_COMPRAS_ETIQUETAS?.[id]));
  Object.entries(datos.PRODUCCION_PROGRAMACION || {}).forEach(([id,v])=>add("programacion",id,v));
  Object.entries(datos.TRASLADOS_BODEGAS || {}).forEach(([id,v])=>add("traslado",id,v));
  return salida.sort((a,b)=>b.fecha.localeCompare(a.fecha));
}
const nodos=["ORDENES_PEDIDO","COMPRAS_BODEGA","GESTION_COMPRAS_BODEGA","COMPRAS_ETIQUETAS","GESTION_COMPRAS_ETIQUETAS","PRODUCCION_PROGRAMACION","TRASLADOS_BODEGAS"];
export default function TrazabilidadPage(){
  const router=useRouter();
  const {authUser,loading:loadingPermissions}=useUserPermissions();
  const [datos,setDatos]=useState<Record<string,any>>({});
  const [cargando,setCargando]=useState(false);
  const [error,setError]=useState("");
  const [advertencias,setAdvertencias]=useState<string[]>([]);
  const [busqueda,setBusqueda]=useState("");
  const [tipo,setTipo]=useState("todos");
  const [estado,setEstado]=useState("todos");
  const [desde,setDesde]=useState("");
  const [hasta,setHasta]=useState("");
  const [seleccion,setSeleccion]=useState<string|null>(null);
  const [pagina,setPagina]=useState(1);
  const [version,setVersion]=useState(0);
  useEffect(()=>{if(!loadingPermissions&&!authUser)router.replace("/");},[loadingPermissions,authUser,router]);
  useEffect(()=>{
    if(loadingPermissions||!authUser)return;
    let activo=true;
    const cargar=async()=>{
      setCargando(true);setError("");
      const resultados=await Promise.allSettled(nodos.map(n=>get(ref(dbRealtime,n))));
      if(!activo)return;
      const siguiente:Record<string,any>={};const fallidos:string[]=[];
      resultados.forEach((r,i)=>{if(r.status==="fulfilled")siguiente[nodos[i]]=r.value.val()||{};else fallidos.push(nodos[i]);});
      setDatos(siguiente);setAdvertencias(fallidos);
      if(fallidos.length===nodos.length)setError("No se pudieron leer las fuentes de trazabilidad. Revisa conexión y permisos de Firebase.");
      setCargando(false);
    };
    void cargar();return()=>{activo=false};
  },[authUser,loadingPermissions,version]);
  const eventos=useMemo(()=>construir(datos),[datos]);
  const filtrados=useMemo(()=>eventos.filter(e=>{
    const q=busqueda.trim().toLowerCase();
    const coincide=!q||[e.referencia,e.titulo,e.detalle,e.responsable,e.estado,...e.relaciones,...e.pasos.map(p=>p.descripcion)].join(" ").toLowerCase().includes(q);
    return coincide&&(tipo==="todos"||e.fuente===tipo)&&(estado==="todos"||e.estado.toLowerCase().includes(estado))&&(!desde||e.fecha.slice(0,10)>=desde)&&(!hasta||e.fecha.slice(0,10)<=hasta);
  }),[eventos,busqueda,tipo,estado,desde,hasta]);
  useEffect(()=>setPagina(1),[busqueda,tipo,estado,desde,hasta]);
  const actual=eventos.find(e=>e.id===seleccion);
  const relacionados=useMemo(()=>actual?eventos.filter(e=>e.id!==actual.id&&(
    e.relaciones.includes(actual.referencia)||actual.relaciones.includes(e.referencia)||
    (actual.relaciones.length>0&&e.relaciones.some(r=>actual.relaciones.includes(r)))
  )):[],[actual,eventos]);
  const totalPaginas=Math.max(1,Math.ceil(filtrados.length/10));
  const paginaSegura=Math.min(pagina,totalPaginas);
  if(loadingPermissions||!authUser)return <div className="flex min-h-screen items-center justify-center text-slate-500"><Loader2 className="animate-spin" size={28}/></div>;
  return <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex w-full max-w-[1700px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3"><Link href="/panel" className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50" aria-label="Volver al panel"><ArrowLeft size={19}/></Link><div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">NUALL · Control operativo</p><h1 className="text-xl font-black sm:text-2xl">Centro de trazabilidad</h1></div></div>
      <button type="button" onClick={()=>setVersion(v=>v+1)} disabled={cargando} className="inline-flex items-center gap-2 rounded-xl bg-[#244C5A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><RefreshCw size={16} className={cargando?"animate-spin":""}/> Actualizar</button>
    </div></header>
    <main className="mx-auto w-full max-w-[1700px] space-y-5 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500"><span>Consulta unificada de operaciones</span><span>·</span><span>Datos reales de Firebase</span><span>·</span><span>Solo lectura</span></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {titulo:"Registros encontrados",valor:eventos.length,icon:ClipboardList,color:"text-slate-700 bg-slate-100"},
          {titulo:"Órdenes de pedido",valor:eventos.filter(e=>e.fuente==="pedido").length,icon:Factory,color:"text-indigo-700 bg-indigo-50"},
          {titulo:"Compras de insumos",valor:eventos.filter(e=>e.fuente==="compra").length,icon:ShoppingCart,color:"text-sky-700 bg-sky-50"},
          {titulo:"Compras de etiquetas",valor:eventos.filter(e=>e.fuente==="compra_etiquetas").length,icon:Tags,color:"text-amber-700 bg-amber-50"},
        ].map(k=><div key={k.titulo} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`rounded-xl p-3 ${k.color}`}><k.icon size={22}/></span><div><p className="text-xs font-semibold text-slate-500">{k.titulo}</p><p className="text-2xl font-black">{k.valor}</p></div></div>)}
      </div>
      {advertencias.length>0&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No se pudieron consultar algunas fuentes: {advertencias.join(", ")}. Los resultados pueden estar incompletos.</div>}
      {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><Filter size={18} className="text-teal-700"/><h2 className="font-black">Buscar y filtrar operaciones</h2></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1fr]">
            <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18}/><input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Orden, cliente, producto, responsable..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-teal-600"/></label>
            <select value={tipo} onChange={e=>setTipo(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="todos">Todos los módulos</option>{Object.entries(fuentes).map(([id,f])=><option key={id} value={id}>{f.nombre}</option>)}</select>
            <select value={estado} onChange={e=>setEstado(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="todos">Todos los estados</option><option value="cread">Creada</option><option value="proceso">En proceso</option><option value="complet">Completada</option><option value="acept">Aceptada</option><option value="rechaz">Rechazada</option><option value="anulad">Anulada</option></select>
            <label className="text-[11px] font-bold text-slate-500">Desde<input type="date" value={desde} onChange={e=>setDesde(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm text-slate-800"/></label>
            <label className="text-[11px] font-bold text-slate-500">Hasta<input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm text-slate-800"/></label>
          </div>
        </div>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full table-fixed text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="w-[17%] px-4 py-3">Fecha</th><th className="w-[22%] px-4 py-3">Referencia</th><th className="w-[22%] px-4 py-3">Módulo</th><th className="w-[20%] px-4 py-3">Cliente / detalle</th><th className="w-[12%] px-4 py-3">Estado</th><th className="w-[7%] px-4 py-3">Ver</th></tr></thead><tbody>{filtrados.slice((paginaSegura-1)*10,paginaSegura*10).map(e=><tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-4 py-3 text-slate-600">{fechaVista(e.fecha)}</td><td className="break-words px-4 py-3 font-black">{e.referencia}</td><td className="px-4 py-3"><span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-bold ${fuentes[e.fuente].clase}`}>{fuentes[e.fuente].nombre}</span></td><td className="break-words px-4 py-3 text-slate-600">{e.titulo}</td><td className="break-words px-4 py-3 font-semibold">{e.estado}</td><td className="px-4 py-3"><button type="button" onClick={()=>setSeleccion(e.id)} className="rounded-lg bg-[#244C5A] p-2 text-white" aria-label={"Ver "+e.referencia}><ChevronRight size={17}/></button></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-slate-100 lg:hidden">{filtrados.slice((paginaSegura-1)*10,paginaSegura*10).map(e=><button key={e.id} type="button" onClick={()=>setSeleccion(e.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left"><div className="min-w-0"><p className="text-xs text-slate-500">{fechaVista(e.fecha)} · {fuentes[e.fuente].nombre}</p><p className="mt-1 font-black">{e.referencia}</p><p className="truncate text-sm text-slate-600">{e.titulo} · {e.estado}</p></div><ChevronRight size={19}/></button>)}</div>
        {filtrados.length===0&&<div className="p-12 text-center text-sm text-slate-500">{cargando?"Consultando información...":"No hay operaciones para los filtros seleccionados."}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm text-slate-500"><span>{filtrados.length} resultados · Página {paginaSegura} de {totalPaginas}</span><div className="flex gap-2"><button type="button" disabled={paginaSegura<=1} onClick={()=>setPagina(p=>p-1)} className="rounded-lg border px-3 py-2 disabled:opacity-30">Anterior</button><button type="button" disabled={paginaSegura>=totalPaginas} onClick={()=>setPagina(p=>p+1)} className="rounded-lg border px-3 py-2 disabled:opacity-30">Siguiente</button></div></div>
      </section>
      <div className="grid gap-3 sm:grid-cols-3">{[{label:"Gestión de compras",href:"/panel/gestion-compras2",icon:ShoppingCart},{label:"Producción por planta",href:"/panel/produccionxplanta",icon:Factory},{label:"Inventario de etiquetas",href:"/panel/inventario-etiquetas",icon:Tags}].map(a=><Link key={a.href} href={a.href} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-[#244C5A] hover:border-teal-500"><span className="flex items-center gap-2"><a.icon size={19}/>{a.label}</span><ChevronRight size={17}/></Link>)}</div>
    </main>
    {actual&&<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/65 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Detalle de trazabilidad"><div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex shrink-0 items-center justify-between gap-4 bg-[#244C5A] px-5 py-4 text-white"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-emerald-200">{fuentes[actual.fuente].nombre}</p><h2 className="break-words text-xl font-black">{actual.referencia}</h2><p className="text-xs text-white/75">{actual.titulo}</p></div><button type="button" onClick={()=>setSeleccion(null)} className="rounded-lg bg-white/15 p-2" aria-label="Cerrar"><X size={21}/></button></div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-4">{[{k:"Fecha",v:fechaVista(actual.fecha)},{k:"Estado",v:actual.estado},{k:"Responsable",v:actual.responsable},{k:"Ítems",v:String(actual.items)}].map(c=><div key={c.k} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-bold text-slate-500">{c.k}</p><p className="mt-1 break-words text-sm font-black">{c.v}</p></div>)}</div>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="mb-4 flex items-center gap-2 font-black"><Timeline size={19} className="text-teal-700"/> Línea de tiempo documentada</h3><div className="space-y-0">{actual.pasos.length?actual.pasos.map((p,i)=><div key={i} className="relative border-l-2 border-teal-200 pb-5 pl-6 last:pb-0"><span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-teal-600"/><p className="text-xs font-semibold text-slate-500">{fechaVista(p.fecha)}</p><p className="font-bold">{p.titulo} <span className="ml-1 text-xs font-semibold text-teal-700">{p.estado}</span></p><p className="text-sm text-slate-600">{p.descripcion}</p>{p.usuario&&<p className="mt-1 text-xs text-slate-500">Responsable: {p.usuario}</p>}</div>):<p className="text-sm text-slate-500">Sin eventos históricos documentados.</p>}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="mb-2 font-black">Vínculos entre módulos</h3><p className="mb-3 text-xs text-slate-500">Se muestran únicamente coincidencias por referencias explícitas guardadas en Firebase. No se supone que dos órdenes estén relacionadas por tener fechas similares.</p>{relacionados.length?<div className="space-y-2">{relacionados.map(e=><button key={e.id} type="button" onClick={()=>setSeleccion(e.id)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left text-sm hover:bg-slate-50"><span><strong>{e.referencia}</strong> · {fuentes[e.fuente].nombre}</span><ChevronRight size={17}/></button>)}</div>:<p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Esta operación todavía no tiene referencias cruzadas verificables.</p>}</section>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-3"><button type="button" onClick={()=>setSeleccion(null)} className="rounded-xl border px-4 py-2 text-sm font-bold">Cerrar</button><Link href={actual.url} className="rounded-xl bg-[#244C5A] px-4 py-2 text-sm font-bold text-white">Abrir módulo de origen</Link></div>
    </div></div>}
  </div>;
}
