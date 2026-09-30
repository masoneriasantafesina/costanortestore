'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Pedido } from '@/lib/types';
import { MARCA_PRODUCTO_LABEL, UNIDAD_NEGOCIO_LABEL } from '@/lib/types';

type RangoPreset = 'hoy' | 'semana' | 'mes' | 'personalizado';

const METODO_PAGO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  pendiente_pago: 'Pendiente de Pago',
  cheque: 'Cheque',
  mixto: 'Mixto',
};

function inicioDelDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function finDelDia(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function calcularRango(preset: RangoPreset, desdeInput: string, hastaInput: string): { desde: Date; hasta: Date } {
  const hoy = new Date();
  if (preset === 'hoy') {
    return { desde: inicioDelDia(hoy), hasta: finDelDia(hoy) };
  }
  if (preset === 'semana') {
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - 6);
    return { desde: inicioDelDia(inicio), hasta: finDelDia(hoy) };
  }
  if (preset === 'mes') {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: inicioDelDia(inicio), hasta: finDelDia(hoy) };
  }
  // personalizado
  const d = desdeInput ? new Date(desdeInput + 'T00:00:00') : inicioDelDia(hoy);
  const h = hastaInput ? new Date(hastaInput + 'T23:59:59') : finDelDia(hoy);
  return { desde: d, hasta: h };
}

function rangoAnterior(desde: Date, hasta: Date): { desde: Date; hasta: Date } {
  const duracionMs = hasta.getTime() - desde.getTime();
  const nuevaHasta = new Date(desde.getTime() - 1);
  const nuevaDesde = new Date(nuevaHasta.getTime() - duracionMs);
  return { desde: nuevaDesde, hasta: nuevaHasta };
}

function formatoFecha(d: Date) {
  return d.toLocaleDateString('es-AR');
}

function csvEscape(valor: string | number) {
  const s = String(valor ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function descargarArchivo(contenido: string, nombreArchivo: string, tipo: string) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function EstadisticasPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [preset, setPreset] = useState<RangoPreset>('mes');
  const [desdeInput, setDesdeInput] = useState('');
  const [hastaInput, setHastaInput] = useState('');
  const [filtroMarca, setFiltroMarca] = useState<Pedido['marca'] | 'todas'>('todas');
  const [ordenProductos, setOrdenProductos] = useState<'monto' | 'unidades' | 'kilos'>('monto');
  const [ordenClientes, setOrdenClientes] = useState<'monto' | 'kilos'>('monto');

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const { data } = await supabase
        .from('pedidos')
        .select('*, clientes(*), pedido_items(*)')
        .order('actualizado_en', { ascending: true });
      setPedidos((data as any) ?? []);
      setCargando(false);
    }
    cargar();
  }, []);

  const { desde, hasta } = useMemo(() => calcularRango(preset, desdeInput, hastaInput), [preset, desdeInput, hastaInput]);
  const { desde: desdeAnt, hasta: hastaAnt } = useMemo(() => rangoAnterior(desde, hasta), [desde, hasta]);

  // "Venta" = pedido entregado y pagado. Usamos actualizado_en como fecha de
  // venta porque no hay un campo específico de "fecha de entrega" en la tabla.
  function esVenta(p: Pedido) {
    return p.estado === 'entregado' && p.pagado;
  }
  function enRango(p: Pedido, d: Date, h: Date) {
    const f = new Date(p.actualizado_en);
    return f >= d && f <= h;
  }
  function pasaMarca(p: Pedido) {
    return filtroMarca === 'todas' || p.marca === filtroMarca;
  }

  const ventasPeriodo = pedidos.filter((p) => esVenta(p) && pasaMarca(p) && enRango(p, desde, hasta));
  const ventasPeriodoAnterior = pedidos.filter((p) => esVenta(p) && pasaMarca(p) && enRango(p, desdeAnt, hastaAnt));

  // Deuda actual: todos los pedidos entregados sin pagar, sin filtrar por fecha
  // (es una foto del momento, no depende del período elegido) pero sí por marca.
  const deudaActual = pedidos.filter((p) => p.estado === 'entregado' && !p.pagado && pasaMarca(p));

  function totalesDe(lista: Pedido[]) {
    const totalMonto = lista.reduce((acc, p) => acc + p.total, 0);
    const totalKg = lista.reduce(
      (acc, p) => acc + (p.pedido_items ?? []).reduce((a, it) => a + it.cantidad * (it.peso_kg ?? 0), 0),
      0
    );
    return { cantidad: lista.length, totalMonto, totalKg, ticketPromedio: lista.length ? totalMonto / lista.length : 0 };
  }

  const totalesActual = totalesDe(ventasPeriodo);
  const totalesAnterior = totalesDe(ventasPeriodoAnterior);

  function variacion(actual: number, anterior: number) {
    if (anterior === 0) return actual === 0 ? 0 : 100;
    return ((actual - anterior) / anterior) * 100;
  }

  // Ventas agrupadas por día para el gráfico de barras del período
  const ventasPorDia = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of ventasPeriodo) {
      const clave = new Date(p.actualizado_en).toLocaleDateString('es-AR');
      mapa.set(clave, (mapa.get(clave) ?? 0) + p.total);
    }
    return Array.from(mapa.entries())
      .map(([fecha, monto]) => ({ fecha, monto }))
      .sort((a, b) => {
        const [da, ma, ya] = a.fecha.split('/').map(Number);
        const [db, mb, yb] = b.fecha.split('/').map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      });
  }, [ventasPeriodo]);

  const maxVentaDia = Math.max(1, ...ventasPorDia.map((v) => v.monto));

  // Ventas por marca
  const ventasPorMarca = useMemo(() => {
    const mapa = new Map<string, { monto: number; kg: number; cantidad: number }>();
    for (const p of ventasPeriodo) {
      const clave = MARCA_PRODUCTO_LABEL[p.marca] ?? p.marca;
      const actual = mapa.get(clave) ?? { monto: 0, kg: 0, cantidad: 0 };
      const kg = (p.pedido_items ?? []).reduce((a, it) => a + it.cantidad * (it.peso_kg ?? 0), 0);
      mapa.set(clave, { monto: actual.monto + p.total, kg: actual.kg + kg, cantidad: actual.cantidad + 1 });
    }
    return Array.from(mapa.entries()).map(([marca, v]) => ({ marca, ...v }));
  }, [ventasPeriodo]);

  // Ventas por unidad de negocio
  const ventasPorUnidad = useMemo(() => {
    const mapa = new Map<string, { monto: number; kg: number; cantidad: number }>();
    for (const p of ventasPeriodo) {
      const clave = p.clientes?.unidad_negocio ? UNIDAD_NEGOCIO_LABEL[p.clientes.unidad_negocio] : 'Sin cliente asignado';
      const actual = mapa.get(clave) ?? { monto: 0, kg: 0, cantidad: 0 };
      const kg = (p.pedido_items ?? []).reduce((a, it) => a + it.cantidad * (it.peso_kg ?? 0), 0);
      mapa.set(clave, { monto: actual.monto + p.total, kg: actual.kg + kg, cantidad: actual.cantidad + 1 });
    }
    return Array.from(mapa.entries())
      .map(([unidad, v]) => ({ unidad, ...v }))
      .sort((a, b) => b.monto - a.monto);
  }, [ventasPeriodo]);

  // Productos más vendidos
  const productosVendidos = useMemo(() => {
    const mapa = new Map<string, { nombre: string; unidades: number; kilos: number; monto: number }>();
    for (const p of ventasPeriodo) {
      for (const it of p.pedido_items ?? []) {
        const actual = mapa.get(it.nombre_producto) ?? { nombre: it.nombre_producto, unidades: 0, kilos: 0, monto: 0 };
        mapa.set(it.nombre_producto, {
          nombre: it.nombre_producto,
          unidades: actual.unidades + it.cantidad,
          kilos: actual.kilos + it.cantidad * (it.peso_kg ?? 0),
          monto: actual.monto + it.subtotal,
        });
      }
    }
    const lista = Array.from(mapa.values());
    lista.sort((a, b) =>
      ordenProductos === 'monto' ? b.monto - a.monto : ordenProductos === 'unidades' ? b.unidades - a.unidades : b.kilos - a.kilos
    );
    return lista.slice(0, 20);
  }, [ventasPeriodo, ordenProductos]);

  // Ranking de clientes
  const rankingClientes = useMemo(() => {
    const mapa = new Map<string, { nombre: string; monto: number; kilos: number; cantidad: number }>();
    for (const p of ventasPeriodo) {
      const nombre = p.clientes?.nombre_apellido ?? p.nombre_contacto;
      const clave = p.cliente_id ?? `sin-cliente-${p.nombre_contacto}`;
      const actual = mapa.get(clave) ?? { nombre, monto: 0, kilos: 0, cantidad: 0 };
      const kg = (p.pedido_items ?? []).reduce((a, it) => a + it.cantidad * (it.peso_kg ?? 0), 0);
      mapa.set(clave, { nombre, monto: actual.monto + p.total, kilos: actual.kilos + kg, cantidad: actual.cantidad + 1 });
    }
    const lista = Array.from(mapa.values());
    lista.sort((a, b) => (ordenClientes === 'monto' ? b.monto - a.monto : b.kilos - a.kilos));
    return lista.slice(0, 20);
  }, [ventasPeriodo, ordenClientes]);

  // Métodos de pago
  const metodosPago = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of ventasPeriodo) {
      const clave = p.metodo_pago ?? 'sin_definir';
      mapa.set(clave, (mapa.get(clave) ?? 0) + p.total);
    }
    const totalGeneral = Array.from(mapa.values()).reduce((a, b) => a + b, 0);
    return Array.from(mapa.entries())
      .map(([metodo, monto]) => ({
        metodo: METODO_PAGO_LABEL[metodo] ?? 'Sin definir',
        monto,
        porcentaje: totalGeneral ? (monto / totalGeneral) * 100 : 0,
      }))
      .sort((a, b) => b.monto - a.monto);
  }, [ventasPeriodo]);

  // Deuda por cliente
  const deudaPorCliente = useMemo(() => {
    const mapa = new Map<string, { nombre: string; monto: number; pedidos: number }>();
    for (const p of deudaActual) {
      const nombre = p.clientes?.nombre_apellido ?? p.nombre_contacto;
      const clave = p.cliente_id ?? `sin-cliente-${p.nombre_contacto}`;
      const actual = mapa.get(clave) ?? { nombre, monto: 0, pedidos: 0 };
      mapa.set(clave, { nombre, monto: actual.monto + p.total, pedidos: actual.pedidos + 1 });
    }
    return Array.from(mapa.values()).sort((a, b) => b.monto - a.monto);
  }, [deudaActual]);
  const deudaTotal = deudaActual.reduce((acc, p) => acc + p.total, 0);

  function descargarExcel() {
    const lineas: string[] = [];
    lineas.push(`Estadísticas Costa Norte Store`);
    lineas.push(`Período: ${formatoFecha(desde)} a ${formatoFecha(hasta)}`);
    lineas.push(`Marca: ${filtroMarca === 'todas' ? 'Todas' : MARCA_PRODUCTO_LABEL[filtroMarca]}`);
    lineas.push('');
    lineas.push('RESUMEN');
    lineas.push(['Total ventas', 'Cantidad de pedidos', 'Kilos vendidos', 'Ticket promedio'].join(','));
    lineas.push(
      [
        totalesActual.totalMonto.toFixed(2),
        totalesActual.cantidad,
        totalesActual.totalKg.toFixed(2),
        totalesActual.ticketPromedio.toFixed(2),
      ].join(',')
    );
    lineas.push('');
    lineas.push('VENTAS POR DÍA');
    lineas.push(['Fecha', 'Monto'].join(','));
    ventasPorDia.forEach((v) => lineas.push([csvEscape(v.fecha), v.monto.toFixed(2)].join(',')));
    lineas.push('');
    lineas.push('VENTAS POR MARCA');
    lineas.push(['Marca', 'Monto', 'Kilos', 'Cantidad de pedidos'].join(','));
    ventasPorMarca.forEach((v) => lineas.push([csvEscape(v.marca), v.monto.toFixed(2), v.kg.toFixed(2), v.cantidad].join(',')));
    lineas.push('');
    lineas.push('VENTAS POR UNIDAD DE NEGOCIO');
    lineas.push(['Unidad', 'Monto', 'Kilos', 'Cantidad de pedidos'].join(','));
    ventasPorUnidad.forEach((v) => lineas.push([csvEscape(v.unidad), v.monto.toFixed(2), v.kg.toFixed(2), v.cantidad].join(',')));
    lineas.push('');
    lineas.push('PRODUCTOS MÁS VENDIDOS');
    lineas.push(['Producto', 'Unidades', 'Kilos', 'Monto'].join(','));
    productosVendidos.forEach((p) => lineas.push([csvEscape(p.nombre), p.unidades, p.kilos.toFixed(2), p.monto.toFixed(2)].join(',')));
    lineas.push('');
    lineas.push('RANKING DE CLIENTES');
    lineas.push(['Cliente', 'Monto', 'Kilos', 'Cantidad de pedidos'].join(','));
    rankingClientes.forEach((c) => lineas.push([csvEscape(c.nombre), c.monto.toFixed(2), c.kilos.toFixed(2), c.cantidad].join(',')));
    lineas.push('');
    lineas.push('MÉTODOS DE PAGO');
    lineas.push(['Método', 'Monto', 'Porcentaje'].join(','));
    metodosPago.forEach((m) => lineas.push([csvEscape(m.metodo), m.monto.toFixed(2), m.porcentaje.toFixed(1) + '%'].join(',')));
    lineas.push('');
    lineas.push('PENDIENTES DE PAGO (DEUDA ACTUAL)');
    lineas.push(['Cliente', 'Monto adeudado', 'Cantidad de pedidos'].join(','));
    deudaPorCliente.forEach((d) => lineas.push([csvEscape(d.nombre), d.monto.toFixed(2), d.pedidos].join(',')));

    // El BOM al inicio hace que Excel detecte los acentos correctamente.
    descargarArchivo(
      '﻿' + lineas.join('\n'),
      `estadisticas_${formatoFecha(desde).replace(/\//g, '-')}_a_${formatoFecha(hasta).replace(/\//g, '-')}.csv`,
      'text/csv;charset=utf-8'
    );
  }

  function descargarPdf() {
    window.print();
  }

  if (cargando) return <p className="text-frost-500">Cargando estadísticas...</p>;

  return (
    <div>
      <style jsx global>{`
        @media print {
          nav,
          header,
          .print\\:hidden {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>

      <div className="flex items-center justify-between mb-5 print:hidden">
        <h1 className="font-display text-2xl text-frost-800">Estadísticas</h1>
        <div className="flex gap-2">
          <button
            onClick={descargarExcel}
            className="text-sm font-medium text-frost-600 border border-frost-200 rounded-card px-3 py-1.5 hover:bg-frost-50"
          >
            Descargar Excel
          </button>
          <button
            onClick={descargarPdf}
            className="text-sm font-medium text-frost-600 border border-frost-200 rounded-card px-3 py-1.5 hover:bg-frost-50"
          >
            Descargar PDF
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3 print:hidden">
        {(['hoy', 'semana', 'mes', 'personalizado'] as const).map((valor) => (
          <button
            key={valor}
            onClick={() => setPreset(valor)}
            className={`px-3 py-2 rounded-card text-sm font-medium ${
              preset === valor ? 'bg-frost-700 text-white' : 'bg-white text-frost-700 border border-frost-200'
            }`}
          >
            {valor === 'hoy' ? 'Hoy' : valor === 'semana' ? 'Últimos 7 días' : valor === 'mes' ? 'Este mes' : 'Personalizado'}
          </button>
        ))}
        {preset === 'personalizado' && (
          <>
            <input
              type="date"
              className="input-field text-sm py-1.5 w-auto"
              value={desdeInput}
              onChange={(e) => setDesdeInput(e.target.value)}
            />
            <span className="text-frost-400 self-center">a</span>
            <input
              type="date"
              className="input-field text-sm py-1.5 w-auto"
              value={hastaInput}
              onChange={(e) => setHastaInput(e.target.value)}
            />
          </>
        )}
      </div>

      <div className="flex gap-2 mb-5 print:hidden">
        {(['todas', 'grido', 'via_vana'] as const).map((valor) => (
          <button
            key={valor}
            onClick={() => setFiltroMarca(valor)}
            className={`px-3 py-2 rounded-card text-sm font-medium ${
              filtroMarca === valor ? 'bg-frost-700 text-white' : 'bg-white text-frost-700 border border-frost-200'
            }`}
          >
            {valor === 'todas' ? 'Todas las marcas' : MARCA_PRODUCTO_LABEL[valor]}
          </button>
        ))}
      </div>

      <p className="text-xs text-frost-400 mb-4">
        Período: {formatoFecha(desde)} a {formatoFecha(hasta)} · Comparado con {formatoFecha(desdeAnt)} a {formatoFecha(hastaAnt)}
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <TarjetaKpi
          titulo="Total ventas"
          valor={`$${totalesActual.totalMonto.toFixed(2)}`}
          variacion={variacion(totalesActual.totalMonto, totalesAnterior.totalMonto)}
        />
        <TarjetaKpi
          titulo="Pedidos"
          valor={String(totalesActual.cantidad)}
          variacion={variacion(totalesActual.cantidad, totalesAnterior.cantidad)}
        />
        <TarjetaKpi
          titulo="Kilos vendidos"
          valor={`${totalesActual.totalKg.toFixed(2)} kg`}
          variacion={variacion(totalesActual.totalKg, totalesAnterior.totalKg)}
        />
        <TarjetaKpi
          titulo="Ticket promedio"
          valor={`$${totalesActual.ticketPromedio.toFixed(2)}`}
          variacion={variacion(totalesActual.ticketPromedio, totalesAnterior.ticketPromedio)}
        />
      </div>

      {/* Ventas por período */}
      <Seccion titulo="Ventas por día">
        {ventasPorDia.length === 0 && <p className="text-sm text-frost-400">Sin ventas en este período.</p>}
        <div className="space-y-1.5">
          {ventasPorDia.map((v) => (
            <div key={v.fecha} className="flex items-center gap-2">
              <span className="text-xs text-frost-500 w-20 shrink-0">{v.fecha}</span>
              <div className="flex-1 bg-frost-50 rounded-card h-5 overflow-hidden">
                <div className="bg-frost-600 h-full rounded-card" style={{ width: `${(v.monto / maxVentaDia) * 100}%` }} />
              </div>
              <span className="text-xs text-frost-700 font-medium w-20 text-right shrink-0">${v.monto.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Seccion>

      {/* Ventas por marca y unidad */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Seccion titulo="Ventas por marca">
          <TablaSimple
            columnas={['Marca', 'Monto', 'Kilos', 'Pedidos']}
            filas={ventasPorMarca.map((v) => [v.marca, `$${v.monto.toFixed(2)}`, `${v.kg.toFixed(2)} kg`, String(v.cantidad)])}
          />
        </Seccion>
        <Seccion titulo="Ventas por unidad de negocio">
          <TablaSimple
            columnas={['Unidad', 'Monto', 'Kilos', 'Pedidos']}
            filas={ventasPorUnidad.map((v) => [v.unidad, `$${v.monto.toFixed(2)}`, `${v.kg.toFixed(2)} kg`, String(v.cantidad)])}
          />
        </Seccion>
      </div>

      {/* Productos más vendidos */}
      <Seccion
        titulo="Productos más vendidos"
        extra={
          <div className="flex gap-1 print:hidden">
            {(['monto', 'unidades', 'kilos'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setOrdenProductos(v)}
                className={`text-xs px-2 py-1 rounded-card ${ordenProductos === v ? 'bg-frost-700 text-white' : 'bg-frost-50 text-frost-600'}`}
              >
                {v === 'monto' ? 'Por $' : v === 'unidades' ? 'Por unidades' : 'Por kilos'}
              </button>
            ))}
          </div>
        }
      >
        <TablaSimple
          columnas={['Producto', 'Unidades', 'Kilos', 'Monto']}
          filas={productosVendidos.map((p) => [p.nombre, String(p.unidades), `${p.kilos.toFixed(2)} kg`, `$${p.monto.toFixed(2)}`])}
        />
      </Seccion>

      {/* Ranking de clientes */}
      <Seccion
        titulo="Ranking de clientes"
        extra={
          <div className="flex gap-1 print:hidden">
            {(['monto', 'kilos'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setOrdenClientes(v)}
                className={`text-xs px-2 py-1 rounded-card ${ordenClientes === v ? 'bg-frost-700 text-white' : 'bg-frost-50 text-frost-600'}`}
              >
                {v === 'monto' ? 'Por $' : 'Por kilos'}
              </button>
            ))}
          </div>
        }
      >
        <TablaSimple
          columnas={['Cliente', 'Monto', 'Kilos', 'Pedidos']}
          filas={rankingClientes.map((c) => [c.nombre, `$${c.monto.toFixed(2)}`, `${c.kilos.toFixed(2)} kg`, String(c.cantidad)])}
        />
      </Seccion>

      {/* Métodos de pago */}
      <Seccion titulo="Métodos de pago">
        {metodosPago.length === 0 && <p className="text-sm text-frost-400">Sin ventas en este período.</p>}
        <div className="space-y-1.5">
          {metodosPago.map((m) => (
            <div key={m.metodo} className="flex items-center gap-2">
              <span className="text-xs text-frost-500 w-28 shrink-0">{m.metodo}</span>
              <div className="flex-1 bg-frost-50 rounded-card h-5 overflow-hidden">
                <div className="bg-teal-500 h-full rounded-card" style={{ width: `${m.porcentaje}%` }} />
              </div>
              <span className="text-xs text-frost-700 font-medium w-32 text-right shrink-0">
                ${m.monto.toFixed(2)} ({m.porcentaje.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </Seccion>

      {/* Pendientes de pago */}
      <Seccion titulo={`Pendientes de pago — deuda actual: $${deudaTotal.toFixed(2)}`}>
        <p className="text-xs text-frost-400 mb-2">
          Esta sección muestra la deuda vigente ahora mismo (no depende del período elegido arriba, solo del filtro de
          marca).
        </p>
        {deudaPorCliente.length === 0 && <p className="text-sm text-frost-400">No hay pendientes de pago.</p>}
        <TablaSimple
          columnas={['Cliente', 'Monto adeudado', 'Pedidos']}
          filas={deudaPorCliente.map((d) => [d.nombre, `$${d.monto.toFixed(2)}`, String(d.pedidos)])}
        />
      </Seccion>
    </div>
  );
}

function TarjetaKpi({ titulo, valor, variacion }: { titulo: string; valor: string; variacion: number }) {
  const positivo = variacion >= 0;
  return (
    <div className="bg-white rounded-card border border-frost-100 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-frost-500">{titulo}</p>
      <p className="text-xl font-display text-frost-800 mt-1">{valor}</p>
      <p className={`text-xs mt-1 font-medium ${positivo ? 'text-teal-600' : 'text-red-500'}`}>
        {positivo ? '▲' : '▼'} {Math.abs(variacion).toFixed(1)}% vs. período anterior
      </p>
    </div>
  );
}

function Seccion({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-white rounded-card border border-frost-100 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-frost-500">{titulo}</p>
        {extra}
      </div>
      {children}
    </div>
  );
}

function TablaSimple({ columnas, filas }: { columnas: string[]; filas: string[][] }) {
  if (filas.length === 0) return <p className="text-sm text-frost-400">Sin datos.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-frost-400 border-b border-frost-100">
            {columnas.map((c) => (
              <th key={c} className="pb-2 pr-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-b border-frost-50 last:border-0">
              {fila.map((valor, j) => (
                <td key={j} className="py-1.5 pr-3 text-frost-700">
                  {valor}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
