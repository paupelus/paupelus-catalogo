import {
  mostrarPanel,
  mostrarLogin,
  mostrarErrorLogin,
  limpiarErrorLogin,
  getLoginCredentials,
  iniciarSesion,
  cerrarSesion,
  revisarSesionActiva
} from './auth.js';

import {
  obtenerFotoProcesadaBlob,
  limpiarFotoProcesadaBlob,
  setProcessStatus,
  limpiarCanvas,
  dibujarFotoCover,
  procesarFoto
} from './fotoProcesador.js';

import {
  cargarDatosEnFormulario,
  guardarOActualizarProducto,
  mostrarMensajeFormulario,
  limpiarMensajeFormulario,
  scrollAlFormulario
} from './formularioProducto.js';

import {
  cargarListaProductos,
  purgarProductosAntiguos,
  cambiarVista,
  obtenerProductoPorId,
  setCallbackEditar
} from './listaProductos.js';

import {
  cargarReels,
  inicializarEventosReels
} from './reels.js';

import {
  inicializarAvisarLive
} from './avisarLive.js';

import {
  inicializarGaleriaAdmin,
  cargarListaGaleria
} from './galeria.js';

import {
  inicializarTutorialesAdmin,
  cargarListaTutoriales
} from './tutoriales.js';

// Elementos del DOM
const loginForm = document.getElementById('loginForm');
const btnLogout = document.getElementById('btnLogout');
const btnProcesarFoto = document.getElementById('btnProcesarFoto');
const btnGuardarProducto = document.getElementById('btnGuardarProducto');
const tabActivos = document.getElementById('tabActivos');
const tabPapelera = document.getElementById('tabPapelera');

// Pestañas principales del panel admin
const tabNavProductos = document.getElementById('tabNavProductos');
const tabNavReels = document.getElementById('tabNavReels');
const tabNavGaleria = document.getElementById('tabNavGaleria');
const tabNavTutoriales = document.getElementById('tabNavTutoriales');
const tabNavLives = document.getElementById('tabNavLives');

const panelSeccionProductos = document.getElementById('panelSeccionProductos');
const seccionReels = document.getElementById('seccionReels');
const seccionGaleria = document.getElementById('seccionGaleria');
const seccionTutoriales = document.getElementById('seccionTutoriales');
const seccionAvisarLive = document.getElementById('seccionAvisarLive');

function cambiarPestanaPrincipal(pestana) {
  const tabs = [
    { btn: tabNavProductos, el: panelSeccionProductos, id: 'productos' },
    { btn: tabNavReels, el: seccionReels, id: 'reels' },
    { btn: tabNavGaleria, el: seccionGaleria, id: 'galeria' },
    { btn: tabNavTutoriales, el: seccionTutoriales, id: 'tutoriales' },
    { btn: tabNavLives, el: seccionAvisarLive, id: 'lives' }
  ];

  tabs.forEach(item => {
    const isTarget = (item.id === pestana);
    if (item.btn) item.btn.classList.toggle('active', isTarget);
    if (item.el) item.el.style.display = isTarget ? 'block' : 'none';
  });

  if (pestana === 'galeria') {
    cargarListaGaleria();
  } else if (pestana === 'tutoriales') {
    cargarListaTutoriales();
  }
}

tabNavProductos?.addEventListener('click', () => cambiarPestanaPrincipal('productos'));
tabNavReels?.addEventListener('click', () => cambiarPestanaPrincipal('reels'));
tabNavGaleria?.addEventListener('click', () => cambiarPestanaPrincipal('galeria'));
tabNavTutoriales?.addEventListener('click', () => cambiarPestanaPrincipal('tutoriales'));
tabNavLives?.addEventListener('click', () => cambiarPestanaPrincipal('lives'));

// 1. Manejo de Login
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarErrorLogin();

  const { email, password } = getLoginCredentials();
  try {
    const { error } = await iniciarSesion(email, password);
    if (error) {
      mostrarErrorLogin(error.message || 'Credenciales incorrectas.');
      return;
    }
    mostrarPanel();
    await purgarProductosAntiguos();
    await cargarListaProductos();
    await cargarReels();
    await cargarListaGaleria();
    await cargarListaTutoriales();
  } catch (err) {
    mostrarErrorLogin('Error de conexión con el servicio de autenticación.');
  }
});

// 2. Manejo de Logout
btnLogout?.addEventListener('click', async () => {
  await cerrarSesion();
  mostrarLogin();
});

// 3. Procesamiento de Foto
btnProcesarFoto?.addEventListener('click', async () => {
  limpiarMensajeFormulario();
  btnProcesarFoto.disabled = true;
  if (btnGuardarProducto) btnGuardarProducto.disabled = true;

  try {
    await procesarFoto();
    if (btnGuardarProducto) btnGuardarProducto.disabled = false;
  } catch (err) {
    setProcessStatus('Error al procesar la foto.');
    mostrarMensajeFormulario(err.message || 'Error al procesar la foto.', true);
  } finally {
    btnProcesarFoto.disabled = false;
  }
});

// 4. Guardar o Actualizar Producto
btnGuardarProducto?.addEventListener('click', async () => {
  try {
    const fotoBlob = obtenerFotoProcesadaBlob();
    await guardarOActualizarProducto(fotoBlob);
    limpiarCanvas();
    limpiarFotoProcesadaBlob();
    setProcessStatus('Selecciona una foto y presiona "Procesar foto"');
    await cargarListaProductos();
  } catch (err) {
    console.error('Error al guardar o actualizar producto:', err);
    mostrarMensajeFormulario(err.message || 'Error al guardar.', true);
  }
});

// 5. Pestañas de Lista / Papelera
tabActivos?.addEventListener('click', () => cambiarVista('activos'));
tabPapelera?.addEventListener('click', () => cambiarVista('papelera'));

// 6. Conexión de Edición de Producto
setCallbackEditar(async (id) => {
  const prod = obtenerProductoPorId(id);
  if (!prod) return;

  limpiarMensajeFormulario();
  limpiarFotoProcesadaBlob();
  cargarDatosEnFormulario(prod);

  if (prod.foto_url) {
    dibujarFotoCover(prod.foto_url);
    setProcessStatus('Foto actual en vista previa. Si deseas cambiarla, selecciona una foto y presiona "Procesar foto".');
  } else {
    limpiarCanvas();
    setProcessStatus('Sin foto previa registrada.');
  }

  scrollAlFormulario();
});

// 7. Inicialización de eventos de Reels, Avisar Live, Galería y Tutoriales
inicializarEventosReels();
inicializarAvisarLive();
inicializarGaleriaAdmin();
inicializarTutorialesAdmin();

// 8. Inicialización al cargar
(async function init() {
  const sesion = await revisarSesionActiva();
  if (sesion) {
    mostrarPanel();
    await purgarProductosAntiguos();
    await cargarListaProductos();
    await cargarReels();
    await cargarListaGaleria();
    await cargarListaTutoriales();
  } else {
    mostrarLogin();
  }
})();


