import { supabaseClient } from '../js/supabaseClient.js';

// Elementos DOM
const loginView = document.getElementById('loginView');
const toolView = document.getElementById('toolView');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const btnLogout = document.getElementById('btnLogout');

const statTotalProds = document.getElementById('statTotalProds');
const statPendingProds = document.getElementById('statPendingProds');
const statWebpProds = document.getElementById('statWebpProds');

const btnIniciarConversion = document.getElementById('btnIniciarConversion');
const btnRecargarLista = document.getElementById('btnRecargarLista');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const logTerminal = document.getElementById('logTerminal');
const logCounter = document.getElementById('logCounter');

let productosCargados = [];
let isConverting = false;

// Funciones de Vistas
function mostrarLogin() {
  if (loginView) loginView.style.display = 'block';
  if (toolView) toolView.style.display = 'none';
  if (loginError) {
    loginError.style.display = 'none';
    loginError.innerText = '';
  }
}

function mostrarTool() {
  if (loginView) loginView.style.display = 'none';
  if (toolView) toolView.style.display = 'block';
}

function esFotoConvertible(url) {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.jpeg');
}

function appendLog(mensaje, clase = '') {
  if (!logTerminal) return;
  const line = document.createElement('div');
  line.className = `log-line ${clase}`;
  line.textContent = mensaje;
  logTerminal.appendChild(line);
  logTerminal.scrollTop = logTerminal.scrollHeight;
}

// Cargar estado del catálogo
async function cargarEstadisticas() {
  try {
    if (logCounter) logCounter.innerText = 'Consultando base de datos...';
    const { data, error } = await supabaseClient
      .from('productos')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    productosCargados = data || [];
    const total = productosCargados.length;
    const pendientes = productosCargados.filter(p => esFotoConvertible(p.foto_url));
    const optimizados = total - pendientes.length;

    if (statTotalProds) statTotalProds.innerText = total;
    if (statPendingProds) statPendingProds.innerText = pendientes.length;
    if (statWebpProds) statWebpProds.innerText = optimizados;

    if (logCounter) {
      logCounter.innerText = `${pendientes.length} fotos pendientes de conversión`;
    }

    if (pendientes.length === 0) {
      if (btnIniciarConversion) btnIniciarConversion.disabled = true;
      appendLog('ℹ️ Todas las fotos de los productos ya se encuentran en formato WebP.', 'log-info');
    } else {
      if (btnIniciarConversion && !isConverting) btnIniciarConversion.disabled = false;
    }
  } catch (err) {
    console.error('Error al cargar productos:', err);
    appendLog(`❌ Error al conectar con Supabase: ${err.message}`, 'log-error');
  }
}

// Convertir imagen individual a WebP 800x1000
async function procesarYSubirWebP(prod) {
  // 1. Descargar imagen existente
  const resp = await fetch(prod.foto_url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} al descargar imagen`);
  }
  const origBlob = await resp.blob();
  const origKB = Math.round(origBlob.size / 1024);

  // 2. Decodificar imagen
  let imgBitmap;
  try {
    imgBitmap = await createImageBitmap(origBlob);
  } catch (e) {
    // Fallback con HTMLImageElement
    imgBitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const objUrl = URL.createObjectURL(origBlob);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objUrl);
        reject(new Error('Fallo al decodificar imagen'));
      };
      img.src = objUrl;
    });
  }

  // 3. Dibujar en canvas máx 800x1000 con fondo blanco sólido
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 800, 1000);

  const imgW = imgBitmap.width || imgBitmap.naturalWidth;
  const imgH = imgBitmap.height || imgBitmap.naturalHeight;
  const imgAspect = imgW / imgH;
  const canvasAspect = 800 / 1000;
  let drawW, drawH, drawX, drawY;

  if (imgAspect > canvasAspect) {
    drawW = 800;
    drawH = 800 / imgAspect;
    drawX = 0;
    drawY = (1000 - drawH) / 2;
  } else {
    drawH = 1000;
    drawW = 1000 * imgAspect;
    drawX = (800 - drawW) / 2;
    drawY = 0;
  }

  ctx.drawImage(imgBitmap, drawX, drawY, drawW, drawH);

  // 4. Exportar toBlob WebP 0.82
  const webpBlob = await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Fallo al generar blob WebP'));
    }, 'image/webp', 0.82);
  });

  const newKB = Math.round(webpBlob.size / 1024);

  // 5. Subir al bucket 'fotos-pelucas' con extensión .webp
  const newFileName = `${crypto.randomUUID()}.webp`;
  const { error: uploadErr } = await supabaseClient
    .storage
    .from('fotos-pelucas')
    .upload(newFileName, webpBlob, { contentType: 'image/webp' });

  if (uploadErr) throw uploadErr;

  // 6. Obtener URL pública
  const { data: publicData } = supabaseClient
    .storage
    .from('fotos-pelucas')
    .getPublicUrl(newFileName);

  const newUrl = publicData.publicUrl;

  // 7. Actualizar registro en Supabase
  const { error: updateErr } = await supabaseClient
    .from('productos')
    .update({ foto_url: newUrl })
    .eq('id', prod.id);

  if (updateErr) throw updateErr;

  return { origKB, newKB };
}

// Proceso por lotes de conversión
async function ejecutarConversion() {
  if (isConverting) return;

  const pendientes = productosCargados.filter(p => esFotoConvertible(p.foto_url));
  const total = pendientes.length;

  if (total === 0) {
    alert('No hay productos con fotos PNG o JPG pendientes de convertir.');
    return;
  }

  const confirma = confirm(`¿Deseas iniciar la conversión de ${total} fotos a WebP (800x1000)?\nLos archivos originales no serán eliminados del bucket.`);
  if (!confirma) return;

  isConverting = true;
  if (btnIniciarConversion) {
    btnIniciarConversion.disabled = true;
    btnIniciarConversion.innerHTML = '<span>⏳ Convirtiendo fotos...</span>';
  }
  if (btnRecargarLista) btnRecargarLista.disabled = true;

  if (progressWrap) progressWrap.style.display = 'block';
  if (progressText) {
    progressText.style.display = 'block';
    progressText.innerText = `Iniciando proceso (0 de ${total})...`;
  }
  if (progressBar) progressBar.style.width = '0%';

  logTerminal.innerHTML = '';
  appendLog(`🚀 Iniciando conversión de ${total} fotos a WebP...`, 'log-info');

  let exitosos = 0;
  let fallidos = 0;
  let totalOrigKB = 0;
  let totalWebpKB = 0;

  for (let i = 0; i < total; i++) {
    const prod = pendientes[i];
    const num = i + 1;
    const pct = Math.round((num / total) * 100);

    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressText) progressText.innerText = `Procesando ${num} de ${total} (${pct}%)...`;
    if (logCounter) logCounter.innerText = `${num}/${total} procesados`;

    try {
      const { origKB, newKB } = await procesarYSubirWebP(prod);
      exitosos++;
      totalOrigKB += origKB;
      totalWebpKB += newKB;
      appendLog(`${num}/${total} — ${prod.nombre || 'Producto ' + prod.id}: ${origKB} KB → ${newKB} KB ✅`, 'log-success');
    } catch (err) {
      fallidos++;
      console.error(`Error convirtiendo ${prod.nombre} (ID ${prod.id}):`, err);
      appendLog(`${num}/${total} — ${prod.nombre || 'Producto ' + prod.id}: Error (${err.message}) ❌`, 'log-error');
    }

    // Pequeño descanso de 50ms para no saturar hilo de UI
    await new Promise(r => setTimeout(r, 50));
  }

  // Resumen final
  const ahorroKB = totalOrigKB - totalWebpKB;
  const ahorroPct = totalOrigKB > 0 ? Math.round((ahorroKB / totalOrigKB) * 100) : 0;
  const ahorroMB = (ahorroKB / 1024).toFixed(1);

  appendLog('───────────────────────────────────────────────────', 'log-info');
  appendLog(`🎉 Proceso finalizado: ${exitosos} convertidos con éxito, ${fallidos} errores.`, exitosos > 0 ? 'log-success' : 'log-error');
  if (exitosos > 0) {
    appendLog(`📊 Peso total: ${totalOrigKB} KB (~${(totalOrigKB/1024).toFixed(1)} MB) → ${totalWebpKB} KB (~${(totalWebpKB/1024).toFixed(1)} MB)`, 'log-info');
    appendLog(`💾 Ahorro estimado de ancho de banda: ${ahorroMB} MB (${ahorroPct}%)`, 'log-success');
  }

  if (progressText) {
    progressText.innerText = `¡Finalizado! ${exitosos} fotos convertidas a WebP.`;
  }

  isConverting = false;
  if (btnIniciarConversion) {
    btnIniciarConversion.disabled = false;
    btnIniciarConversion.innerHTML = '<span>🚀 Convertir fotos a WebP</span>';
  }
  if (btnRecargarLista) btnRecargarLista.disabled = false;

  await cargarEstadisticas();
}

// Inicialización de Eventos
document.addEventListener('DOMContentLoaded', async () => {
  // Autenticación inicial
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (session && !error) {
      mostrarTool();
      await cargarEstadisticas();
    } else {
      mostrarLogin();
    }
  } catch (err) {
    console.warn('Error verificando sesión:', err);
    mostrarLogin();
  }

  // Formulario de login
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (loginError) {
      loginError.style.display = 'none';
      loginError.innerText = '';
    }

    const email = loginEmail?.value.trim() || '';
    const password = loginPassword?.value || '';

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      mostrarTool();
      await cargarEstadisticas();
    } catch (err) {
      if (loginError) {
        loginError.style.display = 'block';
        loginError.innerText = err.message || 'Error al iniciar sesión.';
      }
    }
  });

  // Cerrar sesión
  btnLogout?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    mostrarLogin();
  });

  // Botón iniciar conversión
  btnIniciarConversion?.addEventListener('click', ejecutarConversion);

  // Botón recargar datos
  btnRecargarLista?.addEventListener('click', cargarEstadisticas);
});
