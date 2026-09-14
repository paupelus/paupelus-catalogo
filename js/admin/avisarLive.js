import { supabaseClient } from '../supabaseClient.js';

let contactosPendientes = [];
let linkLiveActual = 'https://www.tiktok.com/@paupelus_beauty/live';

/**
 * Formatea la fecha de registro para visualización en el panel
 */
function formatearFecha(fechaStr) {
  if (!fechaStr) return '';
  try {
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return fechaStr;
  }
}

/**
 * Consulta en Supabase los suscriptores con notificado = false
 */
export async function consultarSuscriptoresPendientes() {
  const linkLive = prompt(
    "Link del live (TikTok/Instagram):",
    "https://www.tiktok.com/@paupelus_beauty/live"
  );

  // Si el usuario cancela el prompt (linkLive es null), se detiene el proceso completo
  if (linkLive === null) {
    return;
  }

  // Si el usuario deja el campo vacío y da OK, usa igual el link de TikTok por defecto
  linkLiveActual = linkLive.trim() !== '' ? linkLive.trim() : 'https://www.tiktok.com/@paupelus_beauty/live';

  const btnAvisar = document.getElementById('btnAvisarLive');
  const contenedor = document.getElementById('contenedorContactosLive');
  const msgEl = document.getElementById('msgAvisarLive');
  const contadorEl = document.getElementById('contadorContactosLive');

  if (msgEl) {
    msgEl.style.display = 'none';
    msgEl.innerText = '';
  }

  try {
    if (btnAvisar) {
      btnAvisar.disabled = true;
      btnAvisar.innerText = 'Consultando...';
    }

    const { data, error } = await supabaseClient
      .from('suscriptores_live')
      .select('*')
      .eq('notificado', false)
      .order('fecha_registro', { ascending: true });

    if (error) throw error;

    contactosPendientes = data || [];

    if (contactosPendientes.length === 0) {
      if (contenedor) contenedor.style.display = 'none';
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.className = 'admin-msg';
        msgEl.style.background = 'rgba(230, 200, 135, 0.12)';
        msgEl.style.border = '1px solid var(--border-subtle)';
        msgEl.style.color = 'var(--gold-light)';
        msgEl.innerText = 'No hay contactos pendientes por avisar';
      }
      return;
    }

    // Mostrar lista y actualizar contador
    if (contadorEl) contadorEl.innerText = contactosPendientes.length;
    renderizarListaContactos();
    if (contenedor) contenedor.style.display = 'block';

  } catch (err) {
    console.error('Error al consultar suscriptores_live:', err);
    if (msgEl) {
      msgEl.style.display = 'block';
      msgEl.className = 'admin-msg error';
      msgEl.innerText = 'Error al consultar suscriptores: ' + (err.message || 'Error desconocido.');
    }
  } finally {
    if (btnAvisar) {
      btnAvisar.disabled = false;
      btnAvisar.innerText = '📢 Avisar Live';
    }
  }
}

/**
 * Renderiza la lista de contactos en el contenedor
 */
function renderizarListaContactos() {
  const listaEl = document.getElementById('listaContactosLive');
  const contadorEl = document.getElementById('contadorContactosLive');

  if (!listaEl) return;

  if (contactosPendientes.length === 0) {
    listaEl.innerHTML = `
      <p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:1.5rem 0;">
        No hay contactos pendientes por avisar
      </p>
    `;
    if (contadorEl) contadorEl.innerText = '0';
    return;
  }

  if (contadorEl) contadorEl.innerText = contactosPendientes.length;

  listaEl.innerHTML = contactosPendientes.map(c => `
    <div class="product-row" id="contactoRow_${c.id}" style="align-items:center;">
      <div style="display:flex; align-items:center; gap:0.9rem;">
        <div style="width:42px; height:42px; border-radius:50%; background:rgba(37,211,102,0.12); color:#25d366; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">
          📱
        </div>
        <div>
          <div style="font-weight:600; font-size:1rem; color:var(--text-main); letter-spacing:0.02em;">
            +57 ${c.telefono}
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.15rem;">
            Registrado: ${formatearFecha(c.fecha_registro)}
          </div>
        </div>
      </div>
      <button type="button" class="btn-primary btn-enviar-live" data-id="${c.id}" data-telefono="${c.telefono}" style="padding:0.55rem 1.2rem; font-size:0.8rem; flex-shrink:0;">
        Enviar a este
      </button>
    </div>
  `).join('');

  // Conectar listeners de cada botón
  const botonesEnviar = listaEl.querySelectorAll('.btn-enviar-live');
  botonesEnviar.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const telefono = btn.getAttribute('data-telefono');
      enviarWhatsAppYActualizar(id, telefono);
    });
  });
}

/**
 * Abre WhatsApp y actualiza el registro en Supabase a notificado = true
 */
async function enviarWhatsAppYActualizar(id, telefono) {
  // 1. Preparar número con prefijo 57 de Colombia
  const numLimpio = String(telefono || '').replace(/\D/g, '');
  const numFinal = numLimpio.startsWith('57') && numLimpio.length > 10 ? numLimpio : `57${numLimpio}`;
  const mensaje = "¡Hola! 🎥 Estamos por comenzar un Live Shopping en Paupelus Beauty. ¡No te lo pierdas! ✨\n\nEntra aquí: " + linkLiveActual;
  const urlWhatsApp = `https://wa.me/${numFinal}?text=${encodeURIComponent(mensaje)}`;

  // 2. Abrir en pestaña nueva
  window.open(urlWhatsApp, '_blank', 'noopener,noreferrer');

  // 3. Quitar contacto inmediatamente de la vista en el panel
  contactosPendientes = contactosPendientes.filter(c => c.id !== id);
  const fila = document.getElementById(`contactoRow_${id}`);
  if (fila) {
    fila.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    fila.style.opacity = '0';
    fila.style.transform = 'translateX(20px)';
    setTimeout(() => {
      fila.remove();
      const contadorEl = document.getElementById('contadorContactosLive');
      if (contadorEl) contadorEl.innerText = contactosPendientes.length;

      if (contactosPendientes.length === 0) {
        const listaEl = document.getElementById('listaContactosLive');
        if (listaEl) {
          listaEl.innerHTML = `
            <p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:1.5rem 0;">
              No hay contactos pendientes por avisar
            </p>
          `;
        }
      }
    }, 300);
  }

  // 4. Actualizar registro en Supabase poniendo notificado = true
  try {
    const { error } = await supabaseClient
      .from('suscriptores_live')
      .update({ notificado: true })
      .eq('id', id);

    if (error) {
      console.error('Error al actualizar estado notificado en Supabase:', error);
    }
  } catch (err) {
    console.error('Error inesperado al actualizar estado en Supabase:', err);
  }
}

/**
 * Inicializa los eventos del módulo Avisar Live
 */
export function inicializarAvisarLive() {
  const btnAvisar = document.getElementById('btnAvisarLive');
  btnAvisar?.addEventListener('click', consultarSuscriptoresPendientes);

  const btnCerrar = document.getElementById('btnCerrarContactosLive');
  btnCerrar?.addEventListener('click', () => {
    const contenedor = document.getElementById('contenedorContactosLive');
    if (contenedor) contenedor.style.display = 'none';
  });
}
