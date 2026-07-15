"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  Edit3,
  Eye,
  Loader2,
  LogOut,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { get, push, ref, set } from "firebase/database";
import { collection, doc, getDoc, limit, query, where, getDocs } from "firebase/firestore";
import { auth, db, dbRealtime } from "@/lib/firebase";
import { useUserPermissions } from "@/lib/useUserPermissions";

type EstadoProceso = "sin_verificar" | "aceptado" | "rechazado";

type EstadoMeta = {
  estado: EstadoProceso;
  usuario: string;
  uid?: string | null;
  email?: string | null;
  fecha: string;
  rol?: string;
  motivo?: string;
};

type ProductoOption = {
  codigo: string;
  nombre: string;
};

type ClienteOption = {
  codigo_cliente: string;
  cliente: string;
  productos: ProductoOption[];
};

type PedidoItem = {
  codigo: string;
  producto: string;
  cantidad: string;
  consecutivo: string;
  procesos: Record<string, EstadoProceso>;
  estadosMeta: Record<string, EstadoMeta>;
  historialEstados: Record<string, EstadoMeta[]>;
  responsables?: Record<string, string>;
};

type PedidoGuardado = {
  id: string;
  ordenPedido: string;
  fecha: string;
  cliente?: {
    codigo_cliente?: string;
    nombre?: string;
  };
  items?: PedidoItem[];
  estadoGeneral?: string;
  creadoPor?: string;
  creadoPorUid?: string | null;
  creadoPorEmail?: string | null;
  creadoAt?: string;
  actualizadoPor?: string;
  actualizadoPorUid?: string | null;
  actualizadoPorEmail?: string | null;
  actualizadoAt?: string;
  responsableProduccion?: string;
  responsableProduccionUid?: string | null;
  responsableProduccionEmail?: string | null;
  responsableProduccionRol?: string;
};

const procesos = [
  { key: "materias_primas", titulo: "Materias primas", rol: "investigación" },
  { key: "etiquetas", titulo: "Etiquetas", rol: "etiquetas" },
  { key: "envase", titulo: "Envase", rol: "bodega" },
  { key: "cucharas", titulo: "Cucharas", rol: "bodega" },
  { key: "termo_sello", titulo: "Termo / sello", rol: "bodega" },
  { key: "tapas", titulo: "Tapas", rol: "bodega" },
  { key: "liner", titulo: "Liner", rol: "bodega" },
  { key: "orden_premezcla", titulo: "Orden premezcla", rol: "producción" },
  {
    key: "verificacion_pre",
    titulo: "Verificación pre",
    rol: "investigación",
  },
  { key: "pre_mezcla", titulo: "Pre mezcla", rol: "investigación" },
  { key: "orden_mezcla", titulo: "Orden mezcla", rol: "producción" },
  {
    key: "verificacion_mez",
    titulo: "Verificación mez",
    rol: "investigación",
  },
  { key: "mezcla", titulo: "Mezcla", rol: "investigación" },
  {
    key: "orden_acondicionamiento",
    titulo: "Orden acondicionamiento",
    rol: "producción",
  },
  { key: "envasado", titulo: "Envasado", rol: "planta" },
  { key: "acondicionado", titulo: "Acondicionado", rol: "planta" },
  { key: "batch_record", titulo: "Batch record", rol: "planta" },
  { key: "almacenado", titulo: "Almacenado", rol: "bodega" },
  { key: "remisionado", titulo: "Remisionado", rol: "bodega" },
  { key: "facturado", titulo: "Facturado", rol: "contabilidad" },
  { key: "entregado", titulo: "Entregado", rol: "bodega" },
];

function crearProcesosIniciales() {
  return procesos.reduce((acc, proceso) => {
    acc[proceso.key] = "sin_verificar";
    return acc;
  }, {} as Record<string, EstadoProceso>);
}

function normalizarItem(item: Partial<PedidoItem>): PedidoItem {
  return {
    codigo: item.codigo || "",
    producto: item.producto || "",
    cantidad: item.cantidad || "",
    consecutivo: item.consecutivo || "",
    procesos: {
      ...crearProcesosIniciales(),
      ...(item.procesos || {}),
    },
    estadosMeta: item.estadosMeta || {},
    historialEstados: item.historialEstados || {},
    responsables: item.responsables || {},
  };
}

function mostrarEstado(estado?: EstadoProceso) {
  if (!estado || estado === "sin_verificar") return "Sin verificar";
  if (estado === "aceptado") return "Aceptado";
  if (estado === "rechazado") return "Rechazado";
  return estado;
}

function estadoBadgeClass(estado?: EstadoProceso) {
  if (estado === "aceptado") return "bg-green-100 text-green-700 border-green-200";
  if (estado === "rechazado") return "bg-red-100 text-red-700 border-red-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function estadoSelectClass(estado?: EstadoProceso) {
  if (estado === "aceptado") return "bg-green-50 text-green-700 border-green-200";
  if (estado === "rechazado") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function formatoFechaHora(value?: string) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function calcularEstadoOrden(pedido: PedidoGuardado) {
  const items = pedido.items || [];

  if (items.length === 0) {
    return "creada";
  }

  const estados: EstadoProceso[] = [];

  items.forEach((item) => {
    procesos.forEach((proceso) => {
      estados.push(item.procesos?.[proceso.key] || "sin_verificar");
    });
  });

  const tieneRechazos = estados.some((estado) => estado === "rechazado");
  const todosAceptados = estados.length > 0 && estados.every((estado) => estado === "aceptado");
  const todosSinVerificar = estados.every((estado) => estado === "sin_verificar");

  if (tieneRechazos) return "con_rechazos";
  if (todosAceptados) return "completada";
  if (todosSinVerificar) return "creada";

  return "incompleta";
}

function mostrarEstadoOrden(estado: string) {
  if (estado === "con_rechazos") return "Con rechazos";
  if (estado === "incompleta") return "Incompleta";
  if (estado === "completada") return "Completada";
  return "Creada";
}

function estadoOrdenClass(estado: string) {
  if (estado === "con_rechazos") return "bg-red-100 text-red-700 border-red-200";
  if (estado === "incompleta") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (estado === "completada") return "bg-green-100 text-green-700 border-green-200";
  return "bg-[#244C5A]/10 text-[#244C5A] border-[#244C5A]/10";
}

function obtenerHistorialRechazos(item: PedidoItem, procesoKey: string) {
  const historial = item.historialEstados?.[procesoKey] || [];
  const rechazos = historial.filter((registro) => registro.estado === "rechazado");

  const metaActual = item.estadosMeta?.[procesoKey];

  if (
    metaActual?.estado === "rechazado" &&
    !rechazos.some((registro) => registro.fecha === metaActual.fecha)
  ) {
    return [...rechazos, metaActual];
  }

  return rechazos;
}

function esRolPlanta(rol?: string) {
  return String(rol || "")
    .toLowerCase()
    .includes("planta");
}

function obtenerResponsableProduccion(pedido: PedidoGuardado) {
  const registrosPlanta: EstadoMeta[] = [];

  (pedido.items || []).forEach((item) => {
    Object.values(item.estadosMeta || {}).forEach((meta) => {
      if (esRolPlanta(meta.rol)) {
        registrosPlanta.push(meta);
      }
    });

    Object.values(item.historialEstados || {}).forEach((historial) => {
      historial.forEach((meta) => {
        if (esRolPlanta(meta.rol)) {
          registrosPlanta.push(meta);
        }
      });
    });
  });

  if (registrosPlanta.length === 0) return null;

  return registrosPlanta.sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  )[0];
}

export default function PedidosPage() {
  const router = useRouter();

  const {
    authUser,
    profile,
    loading: loadingPermissions,
  } = useUserPermissions();

  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<ClienteOption | null>(null);

  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false);

  const [productoSeleccionado, setProductoSeleccionado] =
    useState<ProductoOption | null>(null);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [productoDropdownOpen, setProductoDropdownOpen] = useState(false);

  const [ordenPedido, setOrdenPedido] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [cantidad, setCantidad] = useState("");
  const [consecutivo, setConsecutivo] = useState("");

  const [items, setItems] = useState<PedidoItem[]>([]);
  const [pedidos, setPedidos] = useState<PedidoGuardado[]>([]);

  const [editingPedido, setEditingPedido] = useState<PedidoGuardado | null>(
    null
  );

  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEstados, setSavingEstados] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [pedidoProductosModal, setPedidoProductosModal] =
    useState<PedidoGuardado | null>(null);

  const [rechazoModal, setRechazoModal] = useState<{
    itemIndex: number;
    procesoKey: string;
    procesoTitulo: string;
    motivo: string;
  } | null>(null);

  const [rechazoVistaModal, setRechazoVistaModal] = useState<{
    procesoTitulo: string;
    historial: EstadoMeta[];
  } | null>(null);

  const userName = useMemo(() => {
    return (
      profile?.nombre ||
      authUser?.displayName ||
      authUser?.email?.split("@")[0] ||
      "Usuario"
    );
  }, [profile, authUser]);

  const [userRole, setUserRole] = useState("Sin rol");

  useEffect(() => {
    const obtenerRolDesdeData = async (data: any) => {
      if (!data) return "";

      if (data.rolNombre) return String(data.rolNombre);
      if (data.rol) return String(data.rol);

      if (data.rolId) {
        try {
          const rolSnap = await getDoc(doc(db, "roles", String(data.rolId)));

          if (rolSnap.exists()) {
            const rolData = rolSnap.data();

            if (rolData?.nombre) {
              return String(rolData.nombre);
            }
          }
        } catch {
          return String(data.rolId);
        }

        return String(data.rolId);
      }

      if (Array.isArray(data.roles) && data.roles.length > 0) {
        return String(data.roles[0]);
      }

      return "";
    };

    const cargarRolUsuario = async () => {
      if (!authUser?.uid && !authUser?.email) return;

      try {
        if (authUser?.uid) {
          const snapByUid = await getDoc(doc(db, "usuarios", authUser.uid));

          if (snapByUid.exists()) {
            const rol = await obtenerRolDesdeData(snapByUid.data());

            if (rol) {
              setUserRole(rol);
              return;
            }
          }
        }

        if (authUser?.email) {
          const q = query(
            collection(db, "usuarios"),
            where("email", "==", authUser.email),
            limit(1)
          );

          const snapByEmail = await getDocs(q);

          if (!snapByEmail.empty) {
            const rol = await obtenerRolDesdeData(snapByEmail.docs[0].data());

            if (rol) {
              setUserRole(rol);
              return;
            }
          }
        }

        const profileRol = await obtenerRolDesdeData(profile);

        if (profileRol) {
          setUserRole(profileRol);
          return;
        }

        setUserRole("Sin rol");
      } catch {
        const profileRol = await obtenerRolDesdeData(profile);
        setUserRole(profileRol || "Sin rol");
      }
    };

    cargarRolUsuario();
  }, [authUser?.uid, authUser?.email, profile]);

  useEffect(() => {
    if (!loadingPermissions && !authUser) {
      router.replace("/");
    }
  }, [loadingPermissions, authUser, router]);

  useEffect(() => {
    cargarClientes();
    cargarPedidos();
  }, []);

  const cargarClientes = async () => {
    setLoadingClientes(true);

    try {
      const snap = await get(ref(dbRealtime, "CLIENTES"));

      if (!snap.exists()) {
        setClientes([]);
        return;
      }

      const data = snap.val();
      const lista: ClienteOption[] = [];

      Object.entries(data).forEach(([codigoCliente, clientesPorCodigo]: any) => {
        Object.entries(clientesPorCodigo || {}).forEach(
          ([_, clienteData]: any) => {
            const datos = clienteData?.DATOS;

            if (!datos) return;

            const productos: ProductoOption[] = [];

            Object.entries(clienteData?.PRODUCTOS || {}).forEach(
              ([codigoProducto, productoObj]: any) => {
                Object.entries(productoObj || {}).forEach(
                  ([_, productoData]: any) => {
                    const datosProducto = productoData?.DATOS_PRODUCTO;

                    if (!datosProducto) return;

                    productos.push({
                      codigo:
                        datosProducto.codigo_producto || String(codigoProducto),
                      nombre: datosProducto.producto || "",
                    });
                  }
                );
              }
            );

            lista.push({
              codigo_cliente: datos.codigo_cliente || String(codigoCliente),
              cliente: datos.cliente || "",
              productos,
            });
          }
        );
      });

      setClientes(lista);
    } catch (err: any) {
      setError(`No fue posible cargar clientes. ${err?.message || ""}`);
    } finally {
      setLoadingClientes(false);
    }
  };

  const cargarPedidos = async () => {
    setLoadingPedidos(true);

    try {
      const snap = await get(ref(dbRealtime, "ORDENES_PEDIDO"));

      if (!snap.exists()) {
        setPedidos([]);
        return;
      }

      const data = snap.val();

      const lista = Object.entries(data).map(([id, value]: any) => ({
        id,
        ...value,
        items: (value.items || []).map((item: PedidoItem) =>
          normalizarItem(item)
        ),
      })) as PedidoGuardado[];

      setPedidos(lista.reverse());
    } catch (err: any) {
      setError(`No fue posible cargar órdenes. ${err?.message || ""}`);
    } finally {
      setLoadingPedidos(false);
    }
  };

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();

    if (!q) return clientes;

    return clientes.filter(
      (cliente) =>
        cliente.cliente.toLowerCase().includes(q) ||
        cliente.codigo_cliente.toLowerCase().includes(q)
    );
  }, [clientes, busquedaCliente]);

  const productosFiltrados = useMemo(() => {
    if (!clienteSeleccionado) return [];

    const q = busquedaProducto.trim().toLowerCase();

    if (!q) return clienteSeleccionado.productos.slice(0, 100);

    return clienteSeleccionado.productos
      .filter(
        (producto) =>
          producto.codigo.toLowerCase().includes(q) ||
          producto.nombre.toLowerCase().includes(q)
      )
      .slice(0, 100);
  }, [clienteSeleccionado, busquedaProducto]);

  const limpiarFormulario = () => {
    setEditingPedido(null);
    setOrdenPedido("");
    setFecha(new Date().toISOString().split("T")[0]);
    setClienteSeleccionado(null);
    setBusquedaCliente("");
    setProductoSeleccionado(null);
    setBusquedaProducto("");
    setCantidad("");
    setConsecutivo("");
    setItems([]);
    setClienteDropdownOpen(false);
    setProductoDropdownOpen(false);
  };

  const seleccionarCliente = (cliente: ClienteOption) => {
    setClienteSeleccionado(cliente);
    setBusquedaCliente(`${cliente.codigo_cliente} - ${cliente.cliente}`);
    setClienteDropdownOpen(false);

    setProductoSeleccionado(null);
    setBusquedaProducto("");
    setProductoDropdownOpen(false);
    setCantidad("");
    setConsecutivo("");

    if (editingPedido) {
      setItems([]);
    }

    setError("");
    setMessage("");
  };

  const seleccionarProducto = (producto: ProductoOption) => {
    setProductoSeleccionado(producto);
    setBusquedaProducto(`${producto.codigo} - ${producto.nombre}`);
    setProductoDropdownOpen(false);
  };

  const agregarProducto = () => {
    setError("");
    setMessage("");

    if (!clienteSeleccionado) {
      setError("Selecciona un cliente.");
      return;
    }

    if (!productoSeleccionado) {
      setError("Selecciona un código o producto.");
      return;
    }

    if (!cantidad || Number(cantidad) <= 0) {
      setError("Ingresa una cantidad válida.");
      return;
    }

    const nuevoItem: PedidoItem = {
      codigo: productoSeleccionado.codigo,
      producto: productoSeleccionado.nombre,
      cantidad,
      consecutivo,
      procesos: crearProcesosIniciales(),
      estadosMeta: {},
      historialEstados: {},
      responsables: {},
    };

    setItems((current) => [...current, nuevoItem]);

    setProductoSeleccionado(null);
    setBusquedaProducto("");
    setProductoDropdownOpen(false);
    setCantidad("");
    setConsecutivo("");
  };

  const eliminarItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  const editarCantidadItem = (index: number, nuevaCantidad: string) => {
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              cantidad: nuevaCantidad,
            }
          : item
      )
    );
  };

  const editarConsecutivoItem = (index: number, nuevoConsecutivo: string) => {
    setItems((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              consecutivo: nuevoConsecutivo,
            }
          : item
      )
    );
  };

  const iniciarEdicion = (pedido: PedidoGuardado) => {
    const clienteEncontrado = clientes.find(
      (cliente) =>
        cliente.codigo_cliente === pedido.cliente?.codigo_cliente ||
        cliente.cliente === pedido.cliente?.nombre
    );

    setEditingPedido(pedido);
    setOrdenPedido(pedido.ordenPedido || "");
    setFecha(pedido.fecha || new Date().toISOString().split("T")[0]);

    if (clienteEncontrado) {
      setClienteSeleccionado(clienteEncontrado);
      setBusquedaCliente(
        `${clienteEncontrado.codigo_cliente} - ${clienteEncontrado.cliente}`
      );
    } else {
      setClienteSeleccionado({
        codigo_cliente: pedido.cliente?.codigo_cliente || "",
        cliente: pedido.cliente?.nombre || "",
        productos: [],
      });
      setBusquedaCliente(
        `${pedido.cliente?.codigo_cliente || ""} - ${
          pedido.cliente?.nombre || ""
        }`
      );
    }

    setItems((pedido.items || []).map((item) => normalizarItem(item)));
    setProductoSeleccionado(null);
    setBusquedaProducto("");
    setCantidad("");
    setConsecutivo("");
    setClienteDropdownOpen(false);
    setProductoDropdownOpen(false);
    setPedidoProductosModal(null);
    setError("");
    setMessage(
      "Editando orden. Puedes cambiar encabezado, cliente, productos, cantidades y consecutivo. Los estados se editan desde Estado."
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardarPedido = async () => {
    setError("");
    setMessage("");

    if (!ordenPedido.trim()) {
      setError("Ingresa el número de orden de pedido.");
      return;
    }

    if (!clienteSeleccionado) {
      setError("Selecciona un cliente.");
      return;
    }

    if (items.length === 0) {
      setError("Agrega al menos un producto a la orden.");
      return;
    }

    const itemsValidos = items.filter(
      (item) => item.codigo && item.producto && Number(item.cantidad) > 0
    );

    if (itemsValidos.length === 0) {
      setError("La orden debe tener al menos un producto con cantidad válida.");
      return;
    }

    setSaving(true);

    try {
      const pedidoRef = editingPedido
        ? ref(dbRealtime, `ORDENES_PEDIDO/${editingPedido.id}`)
        : push(ref(dbRealtime, "ORDENES_PEDIDO"));

      await set(pedidoRef, {
        ordenPedido: ordenPedido.trim(),
        fecha,
        cliente: {
          codigo_cliente: clienteSeleccionado.codigo_cliente,
          nombre: clienteSeleccionado.cliente,
        },
        items: itemsValidos.map((item) => normalizarItem(item)),
        creadoPor: editingPedido?.creadoPor || userName,
        creadoPorUid: editingPedido?.creadoPorUid || authUser?.uid || null,
        creadoPorEmail:
          editingPedido?.creadoPorEmail || authUser?.email || null,
        creadoAt: editingPedido?.creadoAt || new Date().toISOString(),
        actualizadoPor: userName,
        actualizadoPorUid: authUser?.uid || null,
        actualizadoPorEmail: authUser?.email || null,
        actualizadoAt: new Date().toISOString(),
        responsableProduccion:
          editingPedido?.responsableProduccion || userName,
        responsableProduccionUid:
          editingPedido?.responsableProduccionUid || authUser?.uid || null,
        responsableProduccionEmail:
          editingPedido?.responsableProduccionEmail || authUser?.email || null,
        responsableProduccionRol:
          editingPedido?.responsableProduccionRol &&
          editingPedido.responsableProduccionRol !== "Sin rol"
            ? editingPedido.responsableProduccionRol
            : userRole,
        estadoGeneral: editingPedido?.estadoGeneral || "creada",
      });

      setMessage(
        editingPedido
          ? "Orden actualizada correctamente."
          : "Orden de pedido creada correctamente."
      );

      limpiarFormulario();
      await cargarPedidos();
    } catch (err: any) {
      setError(`No fue posible guardar la orden. ${err?.message || ""}`);
    } finally {
      setSaving(false);
    }
  };

  const aplicarEstadoModal = (
    itemIndex: number,
    procesoKey: string,
    estado: EstadoProceso,
    motivo?: string
  ) => {
    if (!pedidoProductosModal) return;

    const now = new Date().toISOString();

    const itemsActualizados = (pedidoProductosModal.items || []).map(
      (item, index) => {
        if (index !== itemIndex) return item;

        const estadosMetaActualizados = {
          ...(item.estadosMeta || {}),
        };

        const historialEstadosActualizado = {
          ...(item.historialEstados || {}),
        };

        const nuevoRegistro: EstadoMeta | null =
          estado === "sin_verificar"
            ? null
            : {
                estado,
                usuario: userName,
                uid: authUser?.uid || null,
                email: authUser?.email || null,
                fecha: now,
                rol: userRole,
                ...(estado === "rechazado" ? { motivo: motivo || "" } : {}),
              };

        if (estado === "sin_verificar") {
          delete estadosMetaActualizados[procesoKey];
        } else if (nuevoRegistro) {
          estadosMetaActualizados[procesoKey] = nuevoRegistro;
          historialEstadosActualizado[procesoKey] = [
            ...(historialEstadosActualizado[procesoKey] || []),
            nuevoRegistro,
          ];
        }

        return {
          ...item,
          procesos: {
            ...crearProcesosIniciales(),
            ...(item.procesos || {}),
            [procesoKey]: estado,
          },
          estadosMeta: estadosMetaActualizados,
          historialEstados: historialEstadosActualizado,
        };
      }
    );

    const pedidoActualizado = {
      ...pedidoProductosModal,
      items: itemsActualizados,
    };

    setPedidoProductosModal(pedidoActualizado);

    setPedidos((current) =>
      current.map((pedido) =>
        pedido.id === pedidoActualizado.id ? pedidoActualizado : pedido
      )
    );
  };

  const solicitarCambioEstado = (
    itemIndex: number,
    procesoKey: string,
    estado: EstadoProceso
  ) => {
    const proceso = procesos.find((item) => item.key === procesoKey);

    if (estado === "rechazado") {
      setRechazoModal({
        itemIndex,
        procesoKey,
        procesoTitulo: proceso?.titulo || procesoKey,
        motivo: "",
      });
      return;
    }

    aplicarEstadoModal(itemIndex, procesoKey, estado);
  };

  const confirmarRechazo = () => {
    if (!rechazoModal) return;

    if (!rechazoModal.motivo.trim()) {
      setError("Describe el motivo del rechazo.");
      return;
    }

    aplicarEstadoModal(
      rechazoModal.itemIndex,
      rechazoModal.procesoKey,
      "rechazado",
      rechazoModal.motivo.trim()
    );

    setRechazoModal(null);
    setError("");
  };

  const abrirVistaRechazo = (
    procesoTitulo: string,
    historial: EstadoMeta[]
  ) => {
    if (historial.length === 0) return;

    setRechazoVistaModal({
      procesoTitulo,
      historial,
    });
  };

  const guardarEstadosModal = async () => {
    if (!pedidoProductosModal) return;

    setSavingEstados(true);
    setError("");
    setMessage("");

    try {
      const estadoCalculado = calcularEstadoOrden(pedidoProductosModal);

      await set(ref(dbRealtime, `ORDENES_PEDIDO/${pedidoProductosModal.id}`), {
        ...pedidoProductosModal,
        estadoGeneral: estadoCalculado,
        items: (pedidoProductosModal.items || []).map((item) =>
          normalizarItem(item)
        ),
        actualizadoPor: userName,
        actualizadoPorUid: authUser?.uid || null,
        actualizadoPorEmail: authUser?.email || null,
        actualizadoAt: new Date().toISOString(),
      });

      setMessage("Estados actualizados correctamente.");
      await cargarPedidos();
    } catch (err: any) {
      setError(`No fue posible guardar los estados. ${err?.message || ""}`);
    } finally {
      setSavingEstados(false);
    }
  };

  const cerrarModalProductos = () => {
    setPedidoProductosModal(null);
    setRechazoModal(null);
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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-[#244C5A] text-white">
        <div className="max-w-[1600px] mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => router.push("/panel")}
              className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition"
            >
              <ArrowLeft size={22} />
            </button>

            <div className="hidden sm:block bg-white/10 border border-white/15 rounded-3xl px-5 py-2.5">
              <Image
                src="/logo.png"
                alt="Nuall"
                width={115}
                height={56}
                priority
              />
            </div>

            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-white/65">
                Panel administrativo
              </p>
              <h1 className="text-xl sm:text-3xl font-black truncate">
                Órdenes de pedido
              </h1>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold truncate max-w-[220px]">
                {userName}
              </p>
              <p className="text-xs text-white/60 truncate max-w-[220px]">
                {authUser?.email}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 rounded-2xl px-4 py-3 font-semibold transition"
            >
              <LogOut size={18} />
              Salir
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-[1600px] mx-auto px-5 sm:px-8 py-6 space-y-6">
        <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-visible">
          <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                {editingPedido ? "Editando orden" : "Nueva orden"}
              </p>
              <h2 className="text-2xl font-black mt-1">
                {editingPedido
                  ? `Editar orden ${editingPedido.ordenPedido}`
                  : "Crear orden de pedido"}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {editingPedido
                  ? "Editar no modifica estados. Los estados se cambian desde el modal Estado."
                  : "Selecciona cliente, producto, cantidad y consecutivo. Puedes agregar varios productos antes de guardar la orden."}
              </p>
            </div>

            {editingPedido && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-600 hover:border-[#244C5A] hover:text-[#244C5A] transition flex items-center justify-center gap-2"
              >
                <X size={18} />
                Cancelar edición
              </button>
            )}
          </div>

          {(error || message) && (
            <div className="px-5 sm:px-6 pt-5">
              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError("")}>
                    <X size={18} />
                  </button>
                </div>
              )}

              {message && (
                <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-700">
                  {message}
                </div>
              )}
            </div>
          )}

          <div className="p-5 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
              <div>
                <label className="text-sm font-black text-slate-700">
                  Orden de pedido #
                </label>
                <input
                  type="text"
                  value={ordenPedido}
                  onChange={(event) => setOrdenPedido(event.target.value)}
                  placeholder="Ej: 001"
                  className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                />
              </div>

              <div className="relative lg:col-span-2">
                <label className="text-sm font-black text-slate-700">
                  Cliente
                </label>

                <div className="relative mt-1">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />

                  <input
                    type="text"
                    value={busquedaCliente}
                    onFocus={() => setClienteDropdownOpen(true)}
                    onChange={(event) => {
                      setBusquedaCliente(event.target.value);
                      setClienteSeleccionado(null);
                      setClienteDropdownOpen(true);
                      setProductoSeleccionado(null);
                      setBusquedaProducto("");
                      setItems([]);
                    }}
                    placeholder={
                      loadingClientes
                        ? "Cargando clientes..."
                        : "Clic para ver clientes o buscar..."
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                  />
                </div>

                {clienteDropdownOpen && (
                  <div className="absolute z-50 bg-white border border-slate-200 rounded-3xl shadow-xl w-full mt-2 max-h-80 overflow-auto">
                    {clientesFiltrados.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-500">
                        No hay clientes para mostrar.
                      </div>
                    ) : (
                      clientesFiltrados.map((cliente) => (
                        <button
                          type="button"
                          key={`${cliente.codigo_cliente}-${cliente.cliente}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => seleccionarCliente(cliente)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                        >
                          <p className="font-black text-slate-900">
                            {cliente.codigo_cliente}
                          </p>
                          <p className="text-sm text-slate-500">
                            {cliente.cliente}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-black text-slate-700">
                  Fecha
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value)}
                  className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                />
              </div>

              <div className="relative lg:col-span-2">
                <label className="text-sm font-black text-slate-700">
                  Código y producto
                </label>

                <div className="relative mt-1">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />

                  <input
                    type="text"
                    value={busquedaProducto}
                    disabled={!clienteSeleccionado}
                    onFocus={() => setProductoDropdownOpen(true)}
                    onChange={(event) => {
                      setBusquedaProducto(event.target.value);
                      setProductoSeleccionado(null);
                      setProductoDropdownOpen(true);
                    }}
                    placeholder={
                      clienteSeleccionado
                        ? "Clic para ver productos o buscar código..."
                        : "Primero selecciona un cliente"
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20 disabled:opacity-60"
                  />
                </div>

                {productoDropdownOpen && clienteSeleccionado && (
                  <div className="absolute z-50 bg-white border border-slate-200 rounded-3xl shadow-xl w-full mt-2 max-h-96 overflow-auto">
                    {productosFiltrados.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-500">
                        No hay productos para mostrar.
                      </div>
                    ) : (
                      productosFiltrados.map((producto) => (
                        <button
                          type="button"
                          key={`${producto.codigo}-${producto.nombre}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => seleccionarProducto(producto)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                        >
                          <p className="font-black text-slate-900">
                            {producto.codigo}
                          </p>
                          <p className="text-sm text-slate-500">
                            {producto.nombre}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-black text-slate-700">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="0"
                  value={cantidad}
                  onChange={(event) => setCantidad(event.target.value)}
                  placeholder="0"
                  className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                />
              </div>

              <div>
                <label className="text-sm font-black text-slate-700">
                  Consecutivo
                </label>
                <input
                  type="text"
                  value={consecutivo}
                  onChange={(event) => setConsecutivo(event.target.value)}
                  placeholder="Manual"
                  className="w-full mt-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={agregarProducto}
                className="rounded-2xl border border-[#244C5A] px-5 py-3 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white transition flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Agregar producto
              </button>

              <button
                type="button"
                onClick={guardarPedido}
                disabled={saving}
                className="rounded-2xl bg-[#244C5A] hover:bg-[#1b3b46] disabled:opacity-70 disabled:cursor-not-allowed text-white font-black px-5 py-3 flex items-center justify-center gap-2 shadow-lg shadow-[#244C5A]/20"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Save size={20} />
                )}
                {saving
                  ? "Guardando..."
                  : editingPedido
                  ? "Actualizar orden"
                  : "Guardar orden"}
              </button>
            </div>

            {items.length > 0 && (
              <div className="overflow-x-auto rounded-3xl border border-slate-200">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Código
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Producto
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Cantidad
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Consecutivo
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                        Acción
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item, index) => (
                      <tr
                        key={`${item.codigo}-${index}`}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="px-4 py-3 font-black text-slate-900">
                          {item.codigo}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.producto}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.cantidad}
                            onChange={(event) =>
                              editarCantidadItem(index, event.target.value)
                            }
                            className="w-28 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center font-black outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="text"
                            value={item.consecutivo}
                            onChange={(event) =>
                              editarConsecutivoItem(index, event.target.value)
                            }
                            className="w-32 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center font-black outline-none focus:bg-white focus:border-[#244C5A] focus:ring-2 focus:ring-[#244C5A]/20"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => eliminarItem(index)}
                            className="w-10 h-10 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center justify-center transition"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-[28px] shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                Histórico
              </p>
              <h2 className="text-2xl font-black mt-1">Órdenes creadas</h2>
              <p className="text-slate-500 text-sm mt-1">
                Una fila por orden. Los productos y estados se consultan en el modal.
              </p>
            </div>

            <div className="rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-3 font-black text-center flex items-center justify-center gap-2">
              <ClipboardList size={20} />
              {pedidos.length} órdenes
            </div>
          </div>

          {loadingPedidos ? (
            <div className="p-8 flex items-center justify-center gap-3 text-slate-500 font-semibold">
              <Loader2 className="animate-spin" size={22} />
              Cargando órdenes...
            </div>
          ) : pedidos.length === 0 ? (
            <div className="p-8 text-center">
              <ClipboardList className="mx-auto text-[#244C5A]" size={42} />
              <h3 className="font-black text-slate-900 mt-4">
                No hay órdenes creadas
              </h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Orden
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Fecha
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Cliente
                    </th>
                    <th className="text-center px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Productos
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Responsable de producción
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Estado
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {pedidos.map((pedido) => (
                    <tr
                      key={pedido.id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-black text-slate-900">
                          {pedido.ordenPedido}
                        </p>
                        <p className="text-xs text-slate-500">
                          Creada por {pedido.creadoPor || "Usuario"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {pedido.fecha}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-black text-slate-900">
                          {pedido.cliente?.codigo_cliente}
                        </p>
                        <p className="text-sm text-slate-500">
                          {pedido.cliente?.nombre}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => setPedidoProductosModal(pedido)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#244C5A]/10 text-[#244C5A] px-4 py-2 text-sm font-black hover:bg-[#244C5A] hover:text-white transition"
                        >
                          <Eye size={17} />
                          Ver productos ({pedido.items?.length || 0})
                        </button>
                      </td>

                      <td className="px-5 py-4">
                        {(() => {
                          const responsablePlanta =
                            obtenerResponsableProduccion(pedido);

                          if (!responsablePlanta) {
                            return (
                              <span className="inline-flex rounded-full bg-slate-100 text-slate-500 px-3 py-1 text-xs font-black">
                                Aún no hay responsable de producción
                              </span>
                            );
                          }

                          return (
                            <div>
                              <p className="font-black text-slate-900">
                                {responsablePlanta.usuario}
                              </p>
                              <p className="text-xs text-slate-500">
                                Rol: {responsablePlanta.rol}
                              </p>
                              <p className="text-xs text-slate-400">
                                {formatoFechaHora(responsablePlanta.fecha)}
                              </p>
                            </div>
                          );
                        })()}
                      </td>

                      <td className="px-5 py-4">
                        {(() => {
                          const estadoOrden = calcularEstadoOrden(pedido);

                          return (
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${estadoOrdenClass(
                                estadoOrden
                              )}`}
                            >
                              {mostrarEstadoOrden(estadoOrden)}
                            </span>
                          );
                        })()}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => iniciarEdicion(pedido)}
                            className="rounded-2xl border border-[#244C5A] px-4 py-2 text-sm font-black text-[#244C5A] hover:bg-[#244C5A] hover:text-white flex items-center gap-2 transition"
                          >
                            <Edit3 size={17} />
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => setPedidoProductosModal(pedido)}
                            className="rounded-2xl bg-[#244C5A] px-4 py-2 text-sm font-black text-white hover:bg-[#1b3b46] flex items-center gap-2 transition"
                          >
                            <Eye size={17} />
                            Estado
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      {pedidoProductosModal && (
        <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center px-2 sm:px-4 py-3 sm:py-6">
          <div className="bg-white rounded-[24px] sm:rounded-[28px] shadow-2xl w-full max-w-[98vw] max-h-[94vh] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-[#244C5A] uppercase tracking-wide">
                  Productos y estados de la orden
                </p>

                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                  Orden {pedidoProductosModal.ordenPedido}
                </h3>

                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Fecha: <strong>{pedidoProductosModal.fecha}</strong>
                </p>

                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Cliente:{" "}
                  <strong>
                    {pedidoProductosModal.cliente?.codigo_cliente} -{" "}
                    {pedidoProductosModal.cliente?.nombre}
                  </strong>
                </p>


              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={guardarEstadosModal}
                  disabled={savingEstados}
                  className="rounded-2xl bg-[#244C5A] px-4 py-2.5 text-xs sm:text-sm font-black text-white hover:bg-[#1b3b46] flex items-center gap-2 transition disabled:opacity-70"
                >
                  {savingEstados ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  Guardar
                </button>

                <button
                  type="button"
                  onClick={cerrarModalProductos}
                  className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-6 overflow-auto">
              <div className="lg:hidden space-y-4">
                {(pedidoProductosModal.items || []).map((item, itemIndex) => (
                  <div
                    key={`${item.codigo}-${itemIndex}-mobile`}
                    className="rounded-3xl border border-slate-200 overflow-hidden bg-white"
                  >
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                      <p className="font-black text-slate-900">{item.codigo}</p>
                      <p className="text-sm text-slate-600 mt-1">
                        {item.producto}
                      </p>

                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <p className="text-[11px] uppercase font-black text-slate-400">
                            Cantidad
                          </p>
                          <p className="font-black text-slate-900">
                            {item.cantidad}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] uppercase font-black text-slate-400">
                            Consecutivo
                          </p>
                          <input
                            type="text"
                            value={item.consecutivo || ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPedidoProductosModal((current) => {
                                if (!current) return current;
                                return {
                                  ...current,
                                  items: (current.items || []).map((currentItem, i) =>
                                    i === itemIndex
                                      ? { ...currentItem, consecutivo: value }
                                      : currentItem
                                  ),
                                };
                              });
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black outline-none focus:border-[#244C5A]"
                            placeholder="Manual"
                          />
                        </div>

                        <div className="mt-3 rounded-2xl bg-white border border-slate-200 p-3">
                          <p className="text-[11px] uppercase font-black text-slate-400">
                            Responsable producción
                          </p>

                          {(() => {
                            const responsablePlanta =
                              obtenerResponsableProduccion(pedidoProductosModal);

                            if (!responsablePlanta) {
                              return (
                                <p className="font-black text-slate-500 text-sm">
                                  Aún no hay responsable de producción
                                </p>
                              );
                            }

                            return (
                              <>
                                <p className="font-black text-slate-900 text-sm">
                                  {responsablePlanta.usuario}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  Rol: {responsablePlanta.rol}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {formatoFechaHora(responsablePlanta.fecha)}
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 space-y-3">
                      {procesos.map((proceso) => {
                        const estado =
                          item.procesos?.[proceso.key] || "sin_verificar";
                        const meta = item.estadosMeta?.[proceso.key];

                        return (
                          <div
                            key={`${item.codigo}-${proceso.key}-mobile`}
                            className="rounded-2xl border border-slate-200 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-black text-sm text-slate-900">
                                  {proceso.titulo}
                                </p>
                                <p className="text-[11px] font-bold text-slate-400 uppercase">
                                  {proceso.rol}
                                </p>
                              </div>

                              <span
                                className={`shrink-0 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${estadoBadgeClass(
                                  estado
                                )}`}
                              >
                                {mostrarEstado(estado)}
                              </span>
                            </div>

                            <select
                              value={estado}
                              onChange={(event) =>
                                solicitarCambioEstado(
                                  itemIndex,
                                  proceso.key,
                                  event.target.value as EstadoProceso
                                )
                              }
                              className={`w-full mt-3 rounded-2xl border px-3 py-3 text-sm font-black outline-none ${estadoSelectClass(
                                estado
                              )}`}
                            >
                              <option value="sin_verificar">Sin verificar</option>
                              <option value="aceptado">Aceptado</option>
                              <option value="rechazado">Rechazado</option>
                            </select>

                            {meta && (
                              <div className="mt-2 text-[11px] text-slate-500 leading-4">
                                <p>
                                  <strong>{meta.usuario}</strong> ·{" "}
                                  {formatoFechaHora(meta.fecha)}
                                </p>
                                {meta.rol && <p>Rol: {meta.rol}</p>}
                              </div>
                            )}

                            {obtenerHistorialRechazos(item, proceso.key).length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  abrirVistaRechazo(
                                    proceso.titulo,
                                    obtenerHistorialRechazos(item, proceso.key)
                                  )
                                }
                                className="text-red-600 mt-2 text-[11px] font-black underline"
                              >
                                Ver rechazo
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden lg:block overflow-auto">
                <table className="w-full min-w-[2800px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="sticky left-0 z-20 bg-slate-50 text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 min-w-[120px]">
                        Código
                      </th>
                      <th className="sticky left-[120px] z-20 bg-slate-50 text-left px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 min-w-[260px]">
                        Producto
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 min-w-[100px]">
                        Cantidad
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 min-w-[150px]">
                        Consecutivo
                      </th>

                      {procesos.map((proceso) => (
                        <th
                          key={proceso.key}
                          className="px-3 py-3 text-center text-xs font-black uppercase tracking-wide text-slate-500 min-w-[155px]"
                        >
                          <div>{proceso.titulo}</div>
                          <div className="text-[10px] text-slate-400 normal-case">
                            {proceso.rol}
                          </div>
                        </th>
                      ))}

                      <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500 min-w-[220px]">
                        Responsable producción
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {(pedidoProductosModal.items || []).map((item, itemIndex) => (
                      <tr
                        key={`${item.codigo}-${itemIndex}`}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="sticky left-0 z-10 bg-white px-4 py-4 font-black text-slate-900 min-w-[120px]">
                          {item.codigo}
                        </td>

                        <td className="sticky left-[120px] z-10 bg-white px-4 py-4 text-slate-600 min-w-[260px] max-w-[260px]">
                          {item.producto}
                        </td>

                        <td className="px-4 py-4 text-center font-black">
                          {item.cantidad}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <input
                            type="text"
                            value={item.consecutivo || ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPedidoProductosModal((current) => {
                                if (!current) return current;
                                return {
                                  ...current,
                                  items: (current.items || []).map((currentItem, i) =>
                                    i === itemIndex
                                      ? { ...currentItem, consecutivo: value }
                                      : currentItem
                                  ),
                                };
                              });
                            }}
                            className="w-32 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center font-black outline-none focus:bg-white focus:border-[#244C5A]"
                            placeholder="Manual"
                          />
                        </td>

                        {procesos.map((proceso) => {
                          const estado =
                            item.procesos?.[proceso.key] || "sin_verificar";
                          const meta = item.estadosMeta?.[proceso.key];

                          return (
                            <td
                              key={proceso.key}
                              className="px-3 py-4 text-center align-top"
                            >
                              <select
                                value={estado}
                                onChange={(event) =>
                                  solicitarCambioEstado(
                                    itemIndex,
                                    proceso.key,
                                    event.target.value as EstadoProceso
                                  )
                                }
                                className={`w-full rounded-2xl border px-3 py-2 text-xs font-black outline-none ${estadoSelectClass(
                                  estado
                                )}`}
                              >
                                <option value="sin_verificar">Sin verificar</option>
                                <option value="aceptado">Aceptado</option>
                                <option value="rechazado">Rechazado</option>
                              </select>

                              {meta && (
                                <div className="mt-2 text-[10px] text-slate-500 leading-4 text-left">
                                  <p className="font-bold truncate">
                                    {meta.usuario}
                                  </p>
                                  <p>{formatoFechaHora(meta.fecha)}</p>
                                  {meta.rol && <p>Rol: {meta.rol}</p>}
                                </div>
                              )}

                              {obtenerHistorialRechazos(item, proceso.key).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirVistaRechazo(
                                      proceso.titulo,
                                      obtenerHistorialRechazos(item, proceso.key)
                                    )
                                  }
                                  className="mt-2 text-[10px] text-red-600 font-black underline"
                                >
                                  Ver rechazo
                                </button>
                              )}
                            </td>
                          );
                        })}

                        <td className="px-4 py-4 text-xs text-slate-600 min-w-[220px] align-top">
                          {(() => {
                            const responsablePlanta =
                              obtenerResponsableProduccion(pedidoProductosModal);

                            if (!responsablePlanta) {
                              return (
                                <span className="inline-flex rounded-full bg-slate-100 text-slate-500 px-3 py-1 text-xs font-black">
                                  Aún no hay responsable de producción
                                </span>
                              );
                            }

                            return (
                              <div>
                                <p className="font-black text-slate-900">
                                  {responsablePlanta.usuario}
                                </p>
                                <p className="text-slate-500 mt-1">
                                  Rol: {responsablePlanta.rol}
                                </p>
                                <p className="text-slate-400 mt-1">
                                  {formatoFechaHora(responsablePlanta.fecha)}
                                </p>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(pedidoProductosModal.items || []).length === 0 && (
                <div className="p-8 text-center text-slate-500 font-semibold">
                  Esta orden no tiene productos cargados.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {rechazoVistaModal && (
        <div className="fixed inset-0 z-[1001] bg-black/60 flex items-center justify-center px-4">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-red-600 uppercase tracking-wide">
                  Rechazo registrado
                </p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {rechazoVistaModal.procesoTitulo}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setRechazoVistaModal(null)}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {rechazoVistaModal.historial.map((registro, index) => (
                <div
                  key={`${registro.fecha}-${index}`}
                  className="rounded-2xl border border-red-100 bg-red-50 p-4"
                >
                  <p className="text-sm font-black text-red-700">
                    Secuencia #{index + 1}
                  </p>
                  <p className="text-sm text-slate-700 mt-2">
                    {registro.motivo || "Sin motivo registrado."}
                  </p>
                  <div className="mt-3 text-xs text-slate-500">
                    <p>
                      <strong>{registro.usuario}</strong>
                    </p>
                    <p>{formatoFechaHora(registro.fecha)}</p>
                    {registro.rol && <p>Rol: {registro.rol}</p>}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setRechazoVistaModal(null)}
                className="w-full rounded-2xl bg-[#244C5A] px-5 py-3 text-sm font-black text-white hover:bg-[#1b3b46] transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {rechazoModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center px-4">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-red-600 uppercase tracking-wide">
                  Motivo de rechazo
                </p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {rechazoModal.procesoTitulo}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setRechazoModal(null)}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <textarea
                value={rechazoModal.motivo}
                onChange={(event) =>
                  setRechazoModal((current) =>
                    current
                      ? {
                          ...current,
                          motivo: event.target.value,
                        }
                      : current
                  )
                }
                rows={5}
                placeholder="Describe el motivo del rechazo..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 resize-none"
              />

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setRechazoModal(null)}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-600 hover:border-slate-400 transition"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={confirmarRechazo}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 transition"
                >
                  Guardar rechazo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
