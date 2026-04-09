'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Step {
  text: string;
  visual: string;
}

interface Guide {
  title: string;
  steps: Step[];
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
const ROLES = [
  { id: 'operator', label: 'Operador de Cabina', icon: '\uD83C\uDFA7', desc: 'Recibe llamadas, crea incidentes, despacha unidades' },
  { id: 'supervisor', label: 'Supervisor de Turno', icon: '\uD83D\uDC68\u200D\u2708\uFE0F', desc: 'Supervisa cobertura, revisa metricas, gestiona patrullajes' },
  { id: 'field', label: 'Policia en Campo', icon: '\uD83D\uDE94', desc: 'Recibe asignaciones, reporta, envia GPS' },
  { id: 'admin', label: 'Administrador', icon: '\u2699\uFE0F', desc: 'Configura usuarios, sectores, reportes' },
  { id: 'commander', label: 'Comandante', icon: '\uD83C\uDF96\uFE0F', desc: 'Visualiza metricas, toma decisiones tacticas' },
];

// ---------------------------------------------------------------------------
// Guides per role
// ---------------------------------------------------------------------------
const GUIDES: Record<string, Guide[]> = {
  operator: [
    {
      title: 'Crear un incidente',
      steps: [
        { text: 'Haz clic en "+ Nuevo" en el panel de incidentes (lado derecho)', visual: 'nuevo-btn' },
        { text: 'Selecciona el tipo de incidente (Robo, Agresion, etc.)', visual: 'tipo-select' },
        { text: 'Selecciona la prioridad (Critica, Alta, Media, Baja)', visual: 'prioridad' },
        { text: 'Haz clic en el mapa para marcar la ubicacion — aparecera un pin rojo', visual: 'map-click' },
        { text: 'Agrega direccion y descripcion (opcional)', visual: '' },
        { text: 'Haz clic en "Crear incidente" — aparecera en el mapa y en la lista', visual: 'crear-btn' },
      ],
    },
    {
      title: 'Asignar una unidad',
      steps: [
        { text: 'Haz clic en un incidente de la lista para ver el detalle', visual: '' },
        { text: 'Haz clic en "Asignar unidad"', visual: 'asignar-btn' },
        { text: 'El sistema sugiere automaticamente las mejores unidades (Sugeridas)', visual: 'sugeridas' },
        { text: 'Selecciona una o mas unidades y haz clic en "Despachar"', visual: 'despachar' },
        { text: 'La unidad cambiara a "En ruta" y veras su movimiento en el mapa', visual: '' },
      ],
    },
    {
      title: 'Cerrar un incidente',
      steps: [
        { text: 'Abre el detalle del incidente', visual: '' },
        { text: 'Haz clic en "Cerrar incidente" (boton rojo)', visual: 'cerrar-btn' },
        { text: 'Escribe la resolucion (minimo 5 caracteres)', visual: 'resolucion' },
        { text: 'Haz clic en "Confirmar cierre"', visual: '' },
      ],
    },
    {
      title: 'Usar el chat operativo',
      steps: [
        { text: 'Presiona la tecla "3" o haz clic en el tab "Chat"', visual: 'chat-tab' },
        { text: 'Escribe tu mensaje y presiona Enter o "Enviar"', visual: '' },
        { text: 'Los mensajes se muestran en tiempo real para todos los operadores', visual: '' },
      ],
    },
    {
      title: 'Llenar un reporte',
      steps: [
        { text: 'Abre el detalle de un incidente', visual: '' },
        { text: 'Haz clic en "Llenar reporte" (boton morado)', visual: 'reporte-btn' },
        { text: 'Selecciona el template de reporte configurado por tu administrador', visual: '' },
        { text: 'Completa todos los campos requeridos', visual: '' },
        { text: 'Haz clic en "Enviar reporte"', visual: '' },
      ],
    },
    {
      title: 'Activar modo crisis',
      steps: [
        { text: 'Haz clic en "Modo crisis" en la barra superior', visual: 'crisis-btn' },
        { text: 'Confirma la activacion — se alertara a todos los operadores', visual: '' },
        { text: 'La lista de incidentes se filtrara solo a criticos y altos', visual: '' },
        { text: 'Para desactivar, haz clic de nuevo en "CRISIS ACTIVA"', visual: 'crisis-off' },
      ],
    },
  ],
  supervisor: [
    {
      title: 'Revisar el dashboard',
      steps: [
        { text: 'Haz clic en "Dashboard" en la barra superior', visual: '' },
        { text: 'Revisa los KPIs: tiempo de despacho, incidentes activos, unidades por estado', visual: 'kpis' },
        { text: 'Revisa los "Insights del Dia" para ver tendencias', visual: '' },
        { text: 'Usa "Exportar CSV" para descargar datos', visual: 'export-csv' },
      ],
    },
    {
      title: 'Ver mapa de cobertura',
      steps: [
        { text: 'En el centro de mando, haz clic en "Cobertura"', visual: 'cobertura-btn' },
        { text: 'Las zonas verdes tienen patrullas cerca, las rojas no', visual: '' },
        { text: 'Usa esta informacion para redistribuir unidades', visual: '' },
      ],
    },
    {
      title: 'Crear un patrullaje',
      steps: [
        { text: 'Presiona "2" o haz clic en el tab "Patrullajes"', visual: 'chat-tab' },
        { text: 'Haz clic en "+ Nuevo"', visual: 'nuevo-btn' },
        { text: 'Selecciona unidad y sector', visual: '' },
        { text: 'Elige hora de inicio y duracion', visual: '' },
        { text: 'Haz clic en "Asignar patrullaje"', visual: '' },
      ],
    },
    {
      title: 'Entrega de turno',
      steps: [
        { text: 'Ve a Admin -> "Entrega de Turno"', visual: '' },
        { text: 'Revisa incidentes pendientes y cerrados del turno', visual: '' },
        { text: 'Usa "Imprimir" para generar el documento de entrega', visual: '' },
      ],
    },
  ],
  field: [
    {
      title: 'Iniciar tu turno',
      steps: [
        { text: 'Abre la app Velnari Field en tu celular', visual: 'mobile-app-icon' },
        { text: 'Inicia sesión con tus credenciales', visual: 'login-mobile' },
        { text: 'Ve al tab "Check" y completa el checklist de turno', visual: 'mobile-checklist' },
        { text: 'Regresa al tab "Servicio" y presiona "INICIAR RASTREO"', visual: 'mobile-gps-toggle' },
        { text: 'Verás el contador de puntos GPS enviados y tus coordenadas', visual: 'mobile-gps-active' },
      ],
    },
    {
      title: 'Cambiar tu estado',
      steps: [
        { text: 'En el tab "Servicio", busca la sección "Estado de la unidad"', visual: 'mobile-status-section' },
        { text: 'Toca el botón del estado deseado — los botones son grandes para usar con guantes', visual: 'status-grid' },
        { text: 'El cambio se refleja inmediatamente en el centro de mando', visual: 'mobile-status-confirmed' },
      ],
    },
    {
      title: 'Ver tu ruta en el mapa',
      steps: [
        { text: 'Ve al tab "Mapa" — verás tu posición actual en el mapa', visual: 'mobile-map-screen' },
        { text: 'La línea azul muestra tu ruta desde que activaste el GPS', visual: 'mobile-map-trail' },
        { text: 'El pin verde "INICIO" marca dónde empezaste el patrullaje', visual: 'mobile-map-start' },
        { text: 'Arriba verás: puntos GPS, distancia recorrida, tiempo y velocidad', visual: 'mobile-map-stats' },
      ],
    },
    {
      title: 'Reportar un incidente desde campo',
      steps: [
        { text: 'Ve al tab "Reportar" (icono 🚨)', visual: 'mobile-report-tab' },
        { text: 'Presiona "Obtener mi ubicación" — usará el GPS de tu celular', visual: 'mobile-report-location' },
        { text: 'Selecciona el tipo de incidente tocando el botón correspondiente', visual: 'mobile-report-types' },
        { text: 'Selecciona la prioridad (Crítica, Alta, Media, Baja)', visual: 'mobile-report-priority' },
        { text: 'Agrega descripción y dirección si es posible', visual: 'mobile-report-desc' },
        { text: 'Presiona "Reportar incidente" — aparecerá en el mapa del C2', visual: 'mobile-report-submit' },
      ],
    },
    {
      title: 'Agregar notas y fotos al incidente',
      steps: [
        { text: 'En el tab "Servicio", debajo de tu incidente asignado verás el campo de notas', visual: 'mobile-notes-input' },
        { text: 'Escribe tu nota y presiona "Enviar"', visual: 'mobile-notes-send' },
        { text: 'Para adjuntar una foto, presiona el botón de cámara 📷', visual: 'mobile-camera-btn' },
        { text: 'Toma la foto — se adjuntará automáticamente al incidente', visual: 'mobile-camera-take' },
      ],
    },
    {
      title: 'Botón de pánico (SOS)',
      steps: [
        { text: 'En la parte inferior de la pantalla siempre verás el botón rojo "SOS"', visual: 'mobile-sos-screen' },
        { text: 'MANTÉN PRESIONADO por 1 segundo — el botón pulsa en rojo', visual: 'sos-btn' },
        { text: 'Se enviará tu ubicación GPS y una alerta CRÍTICA al centro de mando', visual: 'mobile-sos-sent' },
        { text: 'Todos los operadores y unidades cercanas serán notificados inmediatamente', visual: 'mobile-sos-alert' },
      ],
    },
    {
      title: 'Tu perfil y cerrar sesión',
      steps: [
        { text: 'Ve al tab "Perfil" (último tab)', visual: 'mobile-profile-tab' },
        { text: 'Verás tu nombre, rol, número de placa y email', visual: 'mobile-profile-info' },
        { text: 'Para cerrar sesión, presiona "Cerrar sesión" — esto detendrá el GPS', visual: 'mobile-profile-logout' },
      ],
    },
  ],
  admin: [
    {
      title: 'Crear usuarios',
      steps: [
        { text: 'Ve a Admin -> Usuarios', visual: '' },
        { text: 'Haz clic en "+ Nuevo usuario"', visual: 'nuevo-btn' },
        { text: 'Completa: nombre, email, contrasena, rol, turno', visual: '' },
        { text: 'Haz clic en "Crear usuario"', visual: '' },
      ],
    },
    {
      title: 'Configurar sectores y geocercas',
      steps: [
        { text: 'Ve a Admin -> Sectores', visual: '' },
        { text: 'Crea un sector con nombre y color', visual: '' },
        { text: 'Selecciona el sector en la lista', visual: '' },
        { text: 'Haz clic en "Dibujar geocerca" y marca los puntos en el mapa', visual: 'draw-geofence' },
        { text: 'Doble clic o "Guardar" para cerrar el poligono', visual: '' },
        { text: 'Si una unidad sale de su zona, se generara una alerta automatica', visual: '' },
      ],
    },
    {
      title: 'Crear templates de reporte',
      steps: [
        { text: 'Ve a Admin -> Constructor de Reportes', visual: '' },
        { text: 'Haz clic en "Nuevo template"', visual: '' },
        { text: 'Pon un nombre al template (ej: "Reporte de robo")', visual: '' },
        { text: 'Agrega campos desde el panel izquierdo: texto, numero, seleccion, fecha, checkbox', visual: '' },
        { text: 'Configura cada campo: nombre, si es requerido, opciones', visual: '' },
        { text: 'Haz clic en "Guardar template"', visual: '' },
        { text: 'Los operadores podran usar este template al llenar reportes', visual: '' },
      ],
    },
    {
      title: 'Ver el scorecard de unidades',
      steps: [
        { text: 'Ve a Admin -> Desempeno', visual: '' },
        { text: 'Revisa el ranking de unidades por: incidentes atendidos, tiempo de respuesta, puntos GPS', visual: '' },
        { text: 'Las medallas indican las top 3 del mes', visual: '' },
      ],
    },
  ],
  commander: [
    {
      title: 'Vision general operativa',
      steps: [
        { text: 'Abre el Dashboard para ver KPIs del dia', visual: '' },
        { text: 'Revisa: tiempo promedio de despacho, incidentes por prioridad, unidades por estado', visual: 'kpis' },
        { text: 'Los "Insights del Dia" te muestran sector mas activo, mejor unidad, hora pico', visual: '' },
      ],
    },
    {
      title: 'Mapa de calor de incidentes',
      steps: [
        { text: 'En el centro de mando, activa "Mapa de calor"', visual: 'heatmap-toggle' },
        { text: 'Las zonas rojas/naranjas tienen mas incidentes, las azules menos', visual: '' },
        { text: 'Usa esta informacion para decisiones tacticas de despliegue', visual: '' },
      ],
    },
    {
      title: 'Exportar reportes',
      steps: [
        { text: 'Ve a Admin -> Reportes', visual: '' },
        { text: 'Selecciona unidad y rango de fechas', visual: '' },
        { text: 'Haz clic en "Generar reporte"', visual: '' },
        { text: 'Usa "Exportar PDF" o "Exportar CSV" para descargar', visual: 'export-csv' },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Visual illustrations for key steps
// ---------------------------------------------------------------------------
function StepVisual({ visual }: { visual: string }) {
  switch (visual) {
    case 'nuevo-btn':
      return (
        <div className="bg-slate-800 rounded-lg p-3 inline-flex items-center gap-2 border border-slate-700">
          <span className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded font-medium shadow-sm shadow-blue-500/25">+ Nuevo</span>
        </div>
      );

    case 'tipo-select':
      return (
        <div className="bg-slate-800 rounded-lg p-3 space-y-1 w-52 border border-slate-700">
          <div className="bg-blue-500/20 border border-blue-500/40 rounded px-2.5 py-1.5 text-xs text-blue-300 font-medium">Robo</div>
          <div className="bg-slate-700/60 rounded px-2.5 py-1.5 text-xs text-slate-400">Agresion</div>
          <div className="bg-slate-700/60 rounded px-2.5 py-1.5 text-xs text-slate-400">Accidente vial</div>
          <div className="bg-slate-700/60 rounded px-2.5 py-1.5 text-xs text-slate-400">Disturbio</div>
        </div>
      );

    case 'prioridad':
      return (
        <div className="bg-slate-800 rounded-lg p-3 flex gap-2 border border-slate-700">
          <span className="text-xs px-2.5 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-medium">Critica</span>
          <span className="text-xs px-2.5 py-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">Alta</span>
          <span className="text-xs px-2.5 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Media</span>
          <span className="text-xs px-2.5 py-1 rounded bg-slate-600/40 text-slate-400 border border-slate-600/30">Baja</span>
        </div>
      );

    case 'map-click':
      return (
        <div className="bg-slate-800 rounded-lg p-4 w-56 h-32 border border-slate-700 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-8 w-24 h-px bg-slate-500" />
            <div className="absolute top-8 left-4 w-32 h-px bg-slate-500" />
            <div className="absolute top-12 left-12 w-20 h-px bg-slate-500" />
            <div className="absolute top-4 left-16 w-px h-20 bg-slate-500" />
            <div className="absolute top-2 left-28 w-px h-16 bg-slate-500" />
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg shadow-red-500/50 animate-pulse" />
            <div className="w-0.5 h-3 bg-red-500 mt-0.5" />
          </div>
          <span className="absolute bottom-2 right-2 text-[10px] text-slate-500">Clic para ubicar</span>
        </div>
      );

    case 'crear-btn':
      return (
        <div className="bg-slate-800 rounded-lg p-3 inline-flex items-center gap-3 border border-slate-700">
          <span className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-4 py-2 rounded font-medium shadow-sm shadow-blue-500/25">Crear incidente</span>
        </div>
      );

    case 'asignar-btn':
      return (
        <div className="bg-slate-800 rounded-lg p-3 inline-flex items-center gap-2 border border-slate-700">
          <span className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded font-medium">Asignar unidad</span>
        </div>
      );

    case 'sugeridas':
      return (
        <div className="bg-slate-800 rounded-lg p-3 space-y-2 w-60 border border-slate-700">
          <p className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wider">Sugeridas</p>
          <div className="bg-slate-700/60 rounded p-2 flex items-center gap-2 border border-blue-500/30">
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="text-xs text-white font-medium">P-01</span>
            <span className="text-[10px] text-slate-400 ml-auto">0.8 km</span>
          </div>
          <div className="bg-slate-700/60 rounded p-2 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="text-xs text-slate-300">P-03</span>
            <span className="text-[10px] text-slate-400 ml-auto">1.2 km</span>
          </div>
        </div>
      );

    case 'despachar':
      return (
        <div className="bg-slate-800 rounded-lg p-3 inline-flex items-center gap-3 border border-slate-700">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded border-2 border-blue-500 bg-blue-500/20 flex items-center justify-center">
              <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <span className="text-xs text-white">P-01</span>
          </div>
          <span className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded font-medium">Despachar</span>
        </div>
      );

    case 'cerrar-btn':
      return (
        <div className="bg-slate-800 rounded-lg p-3 inline-flex items-center border border-slate-700">
          <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-1.5 rounded font-medium">Cerrar incidente</span>
        </div>
      );

    case 'resolucion':
      return (
        <div className="bg-slate-800 rounded-lg p-3 w-60 border border-slate-700">
          <label className="text-[10px] text-slate-400 block mb-1">Resolucion</label>
          <div className="bg-slate-700/60 rounded p-2 text-xs text-slate-300 border border-slate-600">
            Unidad arribo, situacion controlada...
          </div>
        </div>
      );

    case 'chat-tab':
      return (
        <div className="bg-slate-800 rounded-lg p-1 inline-flex border border-slate-700">
          <span className="text-xs px-3 py-1.5 text-slate-500">Incidentes</span>
          <span className="text-xs px-3 py-1.5 text-slate-500">Patrullajes</span>
          <span className="text-xs px-3 py-1.5 text-white border-b-2 border-blue-500 font-medium">Chat</span>
        </div>
      );

    case 'crisis-btn':
      return (
        <div className="bg-slate-800 rounded-lg p-3 inline-flex items-center gap-3 border border-slate-700">
          <span className="bg-slate-700 text-slate-300 border border-slate-600 text-xs px-4 py-1.5 rounded font-semibold hover:border-red-500/50 hover:text-red-400">Modo crisis</span>
        </div>
      );

    case 'crisis-off':
      return (
        <div className="bg-slate-800 rounded-lg p-3 inline-flex items-center gap-3 border border-slate-700">
          <span className="bg-red-600 text-white border border-red-500 text-xs px-4 py-1.5 rounded font-semibold animate-pulse">CRISIS ACTIVA</span>
        </div>
      );

    case 'reporte-btn':
      return (
        <div className="bg-slate-800 rounded-lg p-3 inline-flex items-center border border-slate-700">
          <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs px-3 py-1.5 rounded font-medium">Llenar reporte</span>
        </div>
      );

    case 'kpis':
      return (
        <div className="bg-slate-800 rounded-lg p-4 grid grid-cols-3 gap-3 w-72 border border-slate-700">
          <div className="text-center">
            <p className="text-lg font-bold text-blue-400">1:42</p>
            <p className="text-[9px] text-slate-500 uppercase">Despacho</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-400">12</p>
            <p className="text-[9px] text-slate-500 uppercase">Activos</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-400">18</p>
            <p className="text-[9px] text-slate-500 uppercase">Disponibles</p>
          </div>
        </div>
      );

    case 'export-csv':
      return (
        <div className="bg-slate-800 rounded-lg p-3 inline-flex items-center gap-2 border border-slate-700">
          <span className="bg-green-500/20 text-green-400 border border-green-500/30 text-xs px-3 py-1.5 rounded font-medium">Exportar CSV</span>
          <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-1.5 rounded font-medium">Exportar PDF</span>
        </div>
      );

    case 'cobertura-btn':
      return (
        <div className="bg-slate-800 rounded-lg p-3 inline-flex items-center border border-slate-700">
          <span className="bg-green-500 text-slate-900 text-xs px-3 py-1.5 rounded font-medium">Cobertura</span>
        </div>
      );

    case 'heatmap-toggle':
      return (
        <div className="bg-slate-800 rounded-lg p-3 inline-flex items-center border border-slate-700">
          <span className="bg-amber-500 text-slate-900 text-xs px-3 py-1.5 rounded font-medium">Mapa de calor</span>
        </div>
      );

    case 'login-mobile':
      return (
        <div className="bg-slate-800 rounded-xl p-4 w-44 border border-slate-700 space-y-2">
          <div className="text-center mb-3">
            <div className="w-8 h-8 mx-auto bg-blue-500 rounded-lg flex items-center justify-center mb-1">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <p className="text-[10px] text-slate-400">Velnari Field</p>
          </div>
          <div className="bg-slate-700/60 rounded px-2 py-1.5 text-[10px] text-slate-400">Email</div>
          <div className="bg-slate-700/60 rounded px-2 py-1.5 text-[10px] text-slate-400">Contrasena</div>
          <div className="bg-blue-500 text-white text-[10px] text-center py-1.5 rounded font-medium">Iniciar sesion</div>
        </div>
      );

    case 'gps-start':
      return (
        <div className="bg-slate-800 rounded-lg p-3 inline-flex items-center border border-slate-700">
          <span className="bg-green-500 text-white text-xs px-4 py-2 rounded-lg font-bold tracking-wide shadow-sm shadow-green-500/25">INICIAR RASTREO</span>
        </div>
      );

    case 'status-grid':
      return (
        <div className="bg-slate-800 rounded-lg p-3 grid grid-cols-2 gap-2 w-52 border border-slate-700">
          <div className="bg-green-500/20 border border-green-500/30 rounded p-2 text-center">
            <div className="w-3 h-3 bg-green-400 rounded-full mx-auto mb-1" />
            <span className="text-[10px] text-green-400">Disponible</span>
          </div>
          <div className="bg-blue-500/20 border border-blue-500/30 rounded p-2 text-center">
            <div className="w-3 h-3 bg-blue-400 rounded-full mx-auto mb-1" />
            <span className="text-[10px] text-blue-400">En camino</span>
          </div>
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded p-2 text-center">
            <div className="w-3 h-3 bg-yellow-400 rounded-full mx-auto mb-1" />
            <span className="text-[10px] text-yellow-400">En escena</span>
          </div>
          <div className="bg-red-500/20 border border-red-500/30 rounded p-2 text-center">
            <div className="w-3 h-3 bg-red-400 rounded-full mx-auto mb-1" />
            <span className="text-[10px] text-red-400">Fuera</span>
          </div>
        </div>
      );

    case 'sos-btn':
      return (
        <div className="bg-slate-800 rounded-lg p-4 flex flex-col items-center border border-slate-700">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-600/40 border-4 border-red-500">
            <span className="text-white font-black text-lg tracking-wider">SOS</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-2">Mantener presionado 1s</span>
        </div>
      );

    case 'draw-geofence':
      return (
        <div className="bg-slate-800 rounded-lg p-4 w-56 h-32 border border-slate-700 relative overflow-hidden">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 224 128">
            <polygon points="40,20 180,30 190,100 30,90" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.6)" strokeWidth="2" strokeDasharray="4" />
            <circle cx="40" cy="20" r="4" fill="#3B82F6" />
            <circle cx="180" cy="30" r="4" fill="#3B82F6" />
            <circle cx="190" cy="100" r="4" fill="#3B82F6" />
            <circle cx="30" cy="90" r="4" fill="#3B82F6" />
          </svg>
          <span className="absolute bottom-2 right-2 text-[10px] text-slate-500">Geocerca</span>
        </div>
      );

    // ── Mobile phone frame visuals ───────────────────────────────
    case 'mobile-app-icon':
      return (
        <div className="flex items-center gap-4 bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-white font-black text-xl">V</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Velnari Field</p>
            <p className="text-slate-400 text-[10px]">App para unidades en campo</p>
          </div>
        </div>
      );

    case 'mobile-checklist':
      return (
        <PhoneFrame title="Check">
          <div className="space-y-1.5 p-2">
            {['Radio operativo', 'Arma verificada', 'Vehículo revisado', 'GPS activado', 'Uniforme completo'].map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-700/60 rounded px-2 py-1.5">
                <div className={`w-4 h-4 rounded flex items-center justify-center ${i < 3 ? 'bg-green-500' : 'border border-slate-500'}`}>
                  {i < 3 && <span className="text-white text-[8px] font-bold">✓</span>}
                </div>
                <span className="text-[10px] text-slate-300">{item}</span>
              </div>
            ))}
            <div className="bg-blue-500/30 text-blue-400 text-[10px] text-center py-1.5 rounded mt-2 font-medium">Iniciar turno</div>
          </div>
        </PhoneFrame>
      );

    case 'mobile-gps-toggle':
      return (
        <PhoneFrame title="Servicio">
          <div className="p-2 space-y-2">
            <div className="flex items-center justify-between bg-slate-700/60 rounded-lg p-2">
              <span className="text-white text-xs font-bold">P-01</span>
              <span className="text-[9px] text-green-400 bg-green-500/20 px-2 py-0.5 rounded-full">Disponible</span>
            </div>
            <div className="bg-green-900/40 border-2 border-green-500 rounded-lg p-3 flex items-center gap-2">
              <span className="text-lg">📡</span>
              <div>
                <p className="text-green-400 text-[10px] font-bold tracking-wide">GPS ACTIVO</p>
                <p className="text-slate-400 text-[8px]">12 puntos enviados</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-400 ml-auto animate-pulse" />
            </div>
          </div>
        </PhoneFrame>
      );

    case 'mobile-gps-active':
      return (
        <PhoneFrame title="Servicio">
          <div className="p-2 space-y-2">
            <div className="bg-green-900/40 border-2 border-green-500 rounded-lg p-3 flex items-center gap-2">
              <span className="text-lg">📡</span>
              <div>
                <p className="text-green-400 text-[10px] font-bold">GPS ACTIVO</p>
                <p className="text-slate-400 text-[8px]">28 puntos · Toca para detener</p>
              </div>
            </div>
            <div className="bg-slate-700/60 rounded text-center py-1">
              <span className="text-blue-400 text-[10px] font-mono">19.43260, -99.13320</span>
            </div>
          </div>
        </PhoneFrame>
      );

    case 'mobile-status-section':
      return (
        <PhoneFrame title="Servicio">
          <div className="p-2">
            <p className="text-slate-400 text-[8px] font-semibold uppercase tracking-widest mb-1.5">Estado de la unidad</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-green-500/20 border border-green-500/40 rounded p-2 text-center"><span className="text-[9px] text-green-400 font-medium">🟢 Disponible</span></div>
              <div className="bg-slate-700/60 border border-slate-600 rounded p-2 text-center"><span className="text-[9px] text-slate-400">🔵 En camino</span></div>
              <div className="bg-slate-700/60 border border-slate-600 rounded p-2 text-center"><span className="text-[9px] text-slate-400">🟡 En escena</span></div>
              <div className="bg-slate-700/60 border border-slate-600 rounded p-2 text-center"><span className="text-[9px] text-slate-400">🔴 Fuera</span></div>
            </div>
          </div>
        </PhoneFrame>
      );

    case 'mobile-status-confirmed':
      return (
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 text-center">
          <p className="text-green-400 text-xs font-medium">✓ Estado actualizado</p>
          <p className="text-slate-500 text-[10px] mt-1">El centro de mando ve el cambio en tiempo real</p>
        </div>
      );

    case 'mobile-map-screen':
      return (
        <PhoneFrame title="Mapa">
          <div className="relative h-32 bg-slate-700/30 overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-6 left-4 w-28 h-px bg-slate-500" />
              <div className="absolute top-12 left-8 w-20 h-px bg-slate-500" />
              <div className="absolute top-6 left-16 w-px h-16 bg-slate-500" />
              <div className="absolute top-4 left-28 w-px h-20 bg-slate-500" />
            </div>
            <svg className="absolute" viewBox="0 0 160 128" width="160" height="128">
              <polyline points="20,90 40,70 60,75 80,50 100,55 120,40" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="20" cy="90" r="4" fill="#22C55E" stroke="white" strokeWidth="1.5" />
              <circle cx="120" cy="40" r="5" fill="#3B82F6" stroke="white" strokeWidth="2" />
            </svg>
            <div className="absolute top-2 left-2 right-2 bg-slate-900/70 rounded-lg p-1.5 flex justify-around">
              <div className="text-center"><p className="text-white text-[9px] font-bold">24</p><p className="text-slate-400 text-[6px]">PUNTOS</p></div>
              <div className="text-center"><p className="text-white text-[9px] font-bold">1.2km</p><p className="text-slate-400 text-[6px]">DIST</p></div>
              <div className="text-center"><p className="text-white text-[9px] font-bold">18m</p><p className="text-slate-400 text-[6px]">TIEMPO</p></div>
            </div>
          </div>
        </PhoneFrame>
      );

    case 'mobile-map-trail':
      return (
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-1 rounded bg-blue-500" />
            <span className="text-[10px] text-slate-400">= Tu ruta de patrullaje</span>
          </div>
          <p className="text-slate-500 text-[10px]">La línea azul se dibuja en tiempo real conforme te mueves</p>
        </div>
      );

    case 'mobile-map-start':
      return (
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="bg-green-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full border border-white">INICIO</div>
            <div className="w-0.5 h-1.5 bg-green-500/60" />
            <div className="w-2 h-2 rounded-full bg-green-500 border border-white" />
          </div>
          <p className="text-slate-400 text-[10px]">Pin verde que marca dónde empezaste</p>
        </div>
      );

    case 'mobile-map-stats':
      return (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-2">
          <div className="bg-slate-900/70 rounded-lg p-2 flex justify-around">
            <div className="text-center"><p className="text-white text-xs font-bold font-mono">47</p><p className="text-slate-400 text-[8px] uppercase">Puntos</p></div>
            <div className="w-px h-6 bg-slate-600" />
            <div className="text-center"><p className="text-white text-xs font-bold font-mono">2.3km</p><p className="text-slate-400 text-[8px] uppercase">Distancia</p></div>
            <div className="w-px h-6 bg-slate-600" />
            <div className="text-center"><p className="text-white text-xs font-bold font-mono">35m</p><p className="text-slate-400 text-[8px] uppercase">Tiempo</p></div>
            <div className="w-px h-6 bg-slate-600" />
            <div className="text-center"><p className="text-white text-xs font-bold font-mono">28</p><p className="text-slate-400 text-[8px] uppercase">km/h</p></div>
          </div>
        </div>
      );

    case 'mobile-report-tab':
      return (
        <PhoneFrame title="Reportar">
          <div className="p-2 space-y-2">
            <div className="bg-slate-700/60 border border-slate-600 rounded-lg p-3 flex items-center gap-2">
              <span className="text-lg">📍</span>
              <span className="text-slate-400 text-[10px]">Obtener mi ubicación</span>
            </div>
            <p className="text-slate-500 text-[8px] uppercase tracking-widest font-semibold">Tipo de incidente</p>
            <div className="flex flex-wrap gap-1">
              <span className="bg-slate-700/60 rounded px-2 py-1 text-[9px] text-slate-400">💰 Robo</span>
              <span className="bg-slate-700/60 rounded px-2 py-1 text-[9px] text-slate-400">👊 Agresión</span>
              <span className="bg-slate-700/60 rounded px-2 py-1 text-[9px] text-slate-400">🚗 Accidente</span>
            </div>
          </div>
        </PhoneFrame>
      );

    case 'mobile-report-location':
      return (
        <PhoneFrame title="Reportar">
          <div className="p-2">
            <div className="bg-slate-900 border-2 border-blue-500 rounded-lg p-3 flex items-center gap-2">
              <span className="text-lg">📍</span>
              <div>
                <p className="text-blue-400 text-[10px] font-mono font-bold">19.43260, -99.13320</p>
                <p className="text-slate-500 text-[8px]">Toca para actualizar</p>
              </div>
            </div>
          </div>
        </PhoneFrame>
      );

    case 'mobile-report-types':
      return (
        <PhoneFrame title="Reportar">
          <div className="p-2">
            <p className="text-slate-500 text-[8px] uppercase tracking-widest font-semibold mb-1.5">Tipo de incidente</p>
            <div className="flex flex-wrap gap-1">
              <span className="bg-blue-500/20 border border-blue-500/40 rounded px-2 py-1.5 text-[9px] text-blue-400 font-medium">💰 Robo</span>
              <span className="bg-slate-700/60 rounded px-2 py-1.5 text-[9px] text-slate-400">👊 Agresión</span>
              <span className="bg-slate-700/60 rounded px-2 py-1.5 text-[9px] text-slate-400">🚗 Accidente</span>
              <span className="bg-slate-700/60 rounded px-2 py-1.5 text-[9px] text-slate-400">🔊 Ruido</span>
            </div>
          </div>
        </PhoneFrame>
      );

    case 'mobile-report-priority':
      return (
        <PhoneFrame title="Reportar">
          <div className="p-2">
            <p className="text-slate-500 text-[8px] uppercase tracking-widest font-semibold mb-1.5">Prioridad</p>
            <div className="flex gap-1">
              <div className="flex-1 bg-red-500/20 border border-red-500/40 rounded py-1.5 text-center"><span className="text-[9px] text-red-400">Crítica</span></div>
              <div className="flex-1 bg-orange-500/20 border border-orange-500/40 rounded py-1.5 text-center"><span className="text-[9px] text-orange-400 font-medium">Alta</span></div>
              <div className="flex-1 bg-slate-700/60 rounded py-1.5 text-center"><span className="text-[9px] text-slate-400">Media</span></div>
              <div className="flex-1 bg-slate-700/60 rounded py-1.5 text-center"><span className="text-[9px] text-slate-400">Baja</span></div>
            </div>
          </div>
        </PhoneFrame>
      );

    case 'mobile-report-desc':
      return (
        <PhoneFrame title="Reportar">
          <div className="p-2 space-y-1.5">
            <div className="bg-slate-700/60 rounded px-2 py-2 text-[10px] text-slate-300">Av. Juárez 120, Centro...</div>
            <div className="bg-slate-700/60 rounded px-2 py-3 text-[10px] text-slate-400">Asalto a mano armada en tienda...</div>
          </div>
        </PhoneFrame>
      );

    case 'mobile-report-submit':
      return (
        <PhoneFrame title="Reportar">
          <div className="p-2">
            <div className="bg-blue-500 text-white text-[11px] text-center py-3 rounded-lg font-bold shadow-lg shadow-blue-500/30">
              Reportar incidente
            </div>
            <p className="text-slate-500 text-[8px] text-center mt-2">El incidente aparecerá en el mapa del C2</p>
          </div>
        </PhoneFrame>
      );

    case 'mobile-notes-input':
      return (
        <PhoneFrame title="Servicio">
          <div className="p-2">
            <div className="bg-slate-700/60 rounded-lg p-2 mb-1">
              <p className="text-white text-[10px] font-bold mb-1">IC-003 · ALTO</p>
              <p className="text-slate-400 text-[9px]">Robo en Av. Juárez</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-2 mt-1.5">
              <div className="bg-slate-800 rounded px-2 py-2 text-[10px] text-slate-500 mb-1.5">Agregar nota al incidente...</div>
              <div className="flex gap-1.5">
                <div className="bg-slate-700 rounded px-2 py-1.5 text-[10px]">📷</div>
                <div className="flex-1 bg-blue-500 text-white text-[10px] text-center py-1.5 rounded font-medium">Enviar</div>
              </div>
            </div>
          </div>
        </PhoneFrame>
      );

    case 'mobile-notes-send':
      return (
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 text-center">
          <p className="text-green-400 text-xs font-medium">✓ Nota enviada</p>
          <p className="text-slate-500 text-[10px] mt-1">Visible en la línea de tiempo del incidente</p>
        </div>
      );

    case 'mobile-camera-btn':
      return (
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center gap-3">
          <div className="bg-slate-700 rounded-lg w-12 h-10 flex items-center justify-center text-lg">📷</div>
          <p className="text-slate-400 text-[10px]">Toca para abrir la cámara y adjuntar foto</p>
        </div>
      );

    case 'mobile-camera-take':
      return (
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 text-center">
          <p className="text-green-400 text-xs font-medium">✓ Foto adjuntada</p>
          <p className="text-slate-500 text-[10px] mt-1">Disponible para todos en el detalle del incidente</p>
        </div>
      );

    case 'mobile-sos-screen':
      return (
        <PhoneFrame title="Servicio">
          <div className="p-2 pt-8 flex flex-col items-center relative">
            <p className="text-slate-500 text-[9px] mb-3">↑ Contenido del servicio arriba ↑</p>
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-600/50 border-3 border-red-400 animate-pulse">
              <span className="text-white font-black text-sm tracking-wider">SOS</span>
            </div>
            <p className="text-red-400/60 text-[8px] mt-1">Mantén presionado</p>
          </div>
        </PhoneFrame>
      );

    case 'mobile-sos-sent':
      return (
        <div className="bg-red-950 rounded-lg p-4 border border-red-500 text-center">
          <p className="text-red-400 text-sm font-bold">🚨 Alerta enviada</p>
          <p className="text-red-300 text-[10px] mt-1">Tu ubicación y alerta fueron enviadas al centro de mando</p>
        </div>
      );

    case 'mobile-sos-alert':
      return (
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <p className="text-slate-400 text-[10px] mb-2">En el centro de mando aparece:</p>
          <div className="bg-red-950/80 border border-red-500 rounded-lg p-2">
            <p className="text-red-300 text-[10px] font-bold">CRÍTICO · P-01</p>
            <p className="text-white text-[10px]">🚨 ALERTA DE PÁNICO — Requiere apoyo</p>
          </div>
        </div>
      );

    case 'mobile-profile-tab':
      return (
        <PhoneFrame title="Mi perfil">
          <div className="p-3 flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mb-2">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <p className="text-white text-xs font-semibold">Miguel Patrullero</p>
            <p className="text-slate-400 text-[10px]">Unidad de Campo</p>
          </div>
        </PhoneFrame>
      );

    case 'mobile-profile-info':
      return (
        <PhoneFrame title="Mi perfil">
          <div className="p-2 space-y-1.5">
            <div className="flex justify-between bg-slate-700/40 rounded px-2 py-1.5"><span className="text-slate-400 text-[10px]">Nombre</span><span className="text-white text-[10px]">Miguel Patrullero</span></div>
            <div className="flex justify-between bg-slate-700/40 rounded px-2 py-1.5"><span className="text-slate-400 text-[10px]">Rol</span><span className="text-white text-[10px]">Unidad de Campo</span></div>
            <div className="flex justify-between bg-slate-700/40 rounded px-2 py-1.5"><span className="text-slate-400 text-[10px]">Placa</span><span className="text-white text-[10px]">FLD-001</span></div>
            <div className="flex justify-between bg-slate-700/40 rounded px-2 py-1.5"><span className="text-slate-400 text-[10px]">Email</span><span className="text-white text-[10px]">campo1@velnari.mx</span></div>
          </div>
        </PhoneFrame>
      );

    case 'mobile-profile-logout':
      return (
        <PhoneFrame title="Mi perfil">
          <div className="p-2 pt-6">
            <div className="bg-red-500/20 border border-red-500/30 text-red-400 text-[11px] text-center py-2.5 rounded-lg font-medium">
              Cerrar sesión
            </div>
            <p className="text-slate-500 text-[8px] text-center mt-1.5">Esto detendrá el envío de GPS</p>
          </div>
        </PhoneFrame>
      );

    default:
      return null;
  }
}

// ── Phone frame wrapper for mobile visuals ──────────────────────
function PhoneFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 rounded-2xl border-2 border-slate-600 w-44 overflow-hidden shadow-xl">
      {/* Status bar */}
      <div className="bg-slate-800 px-3 py-1 flex items-center justify-between">
        <span className="text-[8px] text-slate-400">9:41</span>
        <span className="text-[8px] text-slate-400">●●●</span>
      </div>
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-3 py-1.5">
        <p className="text-white text-[10px] font-semibold text-center">{title}</p>
      </div>
      {/* Content */}
      <div className="bg-[#0F172A] min-h-[120px]">{children}</div>
      {/* Tab bar */}
      <div className="bg-slate-800 border-t border-slate-700 px-2 py-1 flex justify-around">
        <span className="text-[8px]">🚔</span>
        <span className="text-[8px]">✅</span>
        <span className="text-[8px]">🗺️</span>
        <span className="text-[8px]">🚨</span>
        <span className="text-[8px]">👤</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function AyudaPage() {
  const [selectedRole, setSelectedRole] = useState('operator');
  const [openGuide, setOpenGuide] = useState<number>(0);
  const [search, setSearch] = useState('');

  const guides = GUIDES[selectedRole] || [];

  const filteredGuides = useMemo(() => {
    if (!search.trim()) return guides;
    const q = search.toLowerCase();
    return guides.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.steps.some((s) => s.text.toLowerCase().includes(q)),
    );
  }, [guides, search]);

  const currentRole = ROLES.find((r) => r.id === selectedRole)!;

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      {/* Aurora background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-[128px]" />
        <div className="absolute top-40 -right-40 w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[128px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-white font-bold text-sm">V</span>
              </div>
              <span className="text-white font-bold text-lg tracking-tight">Velnari</span>
            </Link>
            <span className="w-px h-5 bg-slate-700" />
            <span className="text-slate-400 text-sm font-medium">Centro de Ayuda</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
              Inicio
            </Link>
            <Link
              href="/login"
              className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-all border border-white/10 hover:border-white/20"
            >
              Acceder
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        {/* Page title */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            Manual de Uso
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Guias paso a paso para cada rol. Selecciona tu perfil para ver las instrucciones
            relevantes.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-md mx-auto mb-10">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Buscar en las guias..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
            />
          </div>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => {
                setSelectedRole(role.id);
                setOpenGuide(0);
                setSearch('');
              }}
              className={`group p-4 rounded-xl border text-left transition-all duration-200 ${
                selectedRole === role.id
                  ? 'bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/5'
                  : 'bg-white/[0.03] border-white/[0.06] hover:border-white/20 hover:bg-white/[0.05]'
              }`}
            >
              <span className="text-2xl block mb-2">{role.icon}</span>
              <p
                className={`text-sm font-semibold mb-0.5 ${
                  selectedRole === role.id ? 'text-blue-400' : 'text-white'
                }`}
              >
                {role.label}
              </p>
              <p className="text-[11px] text-slate-500 leading-snug">{role.desc}</p>
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Guide index (sidebar on large screens) */}
          <nav className="lg:w-64 shrink-0">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 lg:sticky lg:top-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {currentRole.icon} {currentRole.label}
              </p>
              <ul className="space-y-1">
                {filteredGuides.map((guide, idx) => (
                  <li key={guide.title}>
                    <button
                      onClick={() => setOpenGuide(idx)}
                      className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors duration-150 ${
                        openGuide === idx
                          ? 'bg-blue-500/15 text-blue-400 font-medium'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {guide.title}
                    </button>
                  </li>
                ))}
                {filteredGuides.length === 0 && (
                  <li className="text-xs text-slate-500 px-3 py-2">
                    Sin resultados para &quot;{search}&quot;
                  </li>
                )}
              </ul>
            </div>
          </nav>

          {/* Guide detail */}
          <div className="flex-1 min-w-0">
            {filteredGuides.map((guide, gIdx) => (
              <div
                key={guide.title}
                className={`${gIdx === openGuide ? 'block' : 'hidden'}`}
              >
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 md:p-8">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-6 tracking-tight">
                    {guide.title}
                  </h2>

                  <ol className="space-y-6">
                    {guide.steps.map((step, sIdx) => {
                      const visual = step.visual ? (
                        <StepVisual visual={step.visual} />
                      ) : null;

                      return (
                        <li key={sIdx} className="flex gap-4">
                          {/* Step number */}
                          <div className="shrink-0 w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 text-sm font-bold">
                            {sIdx + 1}
                          </div>

                          <div className="flex-1 min-w-0 pt-1">
                            <p className="text-sm text-slate-200 leading-relaxed mb-3">
                              {step.text}
                            </p>
                            {visual && (
                              <div className="mt-2">{visual}</div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {/* Navigation between guides */}
                <div className="flex justify-between mt-4">
                  <button
                    onClick={() => setOpenGuide(Math.max(0, gIdx - 1))}
                    disabled={gIdx === 0}
                    className="text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    &larr; Anterior
                  </button>
                  <button
                    onClick={() =>
                      setOpenGuide(Math.min(filteredGuides.length - 1, gIdx + 1))
                    }
                    disabled={gIdx === filteredGuides.length - 1}
                    className="text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Keyboard shortcuts reference */}
        <div className="mt-16 bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 md:p-8">
          <h2 className="text-lg font-bold text-white mb-4 tracking-tight">
            Atajos de teclado (Centro de Mando)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: '1', desc: 'Tab Incidentes' },
              { key: '2', desc: 'Tab Patrullajes' },
              { key: '3', desc: 'Tab Chat' },
              { key: 'H', desc: 'Abrir ayuda' },
              { key: 'Esc', desc: 'Deseleccionar' },
            ].map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <kbd className="text-xs bg-slate-800 text-blue-400 px-2 py-1 rounded font-mono border border-slate-700 min-w-[28px] text-center">
                  {s.key}
                </kbd>
                <span className="text-sm text-slate-400">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">V</span>
            </div>
            <span className="text-slate-500 text-sm font-medium">Velnari</span>
          </div>
          <p className="text-slate-600 text-xs">
            &copy; 2026 Velnari &middot; Public Safety Tech &middot; Mexico
          </p>
          <Link href="/" className="text-slate-600 hover:text-slate-400 transition-colors text-xs">
            Volver al inicio
          </Link>
        </div>
      </footer>
    </div>
  );
}
