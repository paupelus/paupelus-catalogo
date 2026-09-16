import { supabaseClient } from '../supabaseClient.js';

let videoEditandoId = null;
let videoEditandoData = null;
let videosCargados = [];

// Elementos del DOM
const galeriaForm = document.getElementById('galeriaForm');
const galeriaTituloInput = document.getElementById('galeriaTitulo');
const galeriaDescInput = document.getElementById('galeriaDescripcion');
const galeriaVideoInput = document.getElementById('galeriaVideoFile');
const galeriaPortadaInput = document.getElementById('galeriaPortadaFile');
const galeriaOrdenInput = document.getElementById('galeriaOrden');
const galeriaVideoStatus = document.getElementById('galeriaVideoStatus');
const galeriaPortadaStatus = document.getElementById('galeriaPortadaStatus');
const galeriaMsg = document.getElementById('galeriaMsg');
const btnGuardarGaleria = document.getElementById('btnGuardarGaleria');
const btnCancelarGaleria = document.getElementById('btnCancelarGaleria');
const listaGaleriaContainer = document.getElementById('listaGaleriaVideos');

/**
 * Muestra mensaje de feedback en el formulario
 */
function mostrarMensajeGaleria(texto, esError = false) {
  if (!galeriaMsg) return;
  galeriaMsg.innerText = texto;
  galeriaMsg.className = `admin-msg ${esError ? 'error' : 'success'}`;
  galeriaMsg.style.display = 'block';
}

/**
 * Limpia el mensaje de feedback
 */
function limpiarMensajeGaleria() {
  if (!galeriaMsg) return;
  galeriaMsg.innerText = '';
  galeriaMsg.style.display = 'none';
}

/**
 * Sanitización básica HTML
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Resetea el formulario de galería a su estado inicial
 */
export function resetearFormularioGaleria() {
  videoEditandoId = null;
  videoEditandoData = null;
  if (galeriaForm) galeriaForm.reset();

  if (galeriaVideoInput) {
    galeriaVideoInput.value = '';
    galeriaVideoInput.required = true;
  }
  if (galeriaPortadaInput) {
    galeriaPortadaInput.value = '';
    galeriaPortadaInput.required = false;
  }

  if (galeriaVideoStatus) {
    galeriaVideoStatus.innerText = '';
    galeriaVideoStatus.style.color = 'var(--text-muted)';
  }
  if (galeriaPortadaStatus) {
    galeriaPortadaStatus.innerText = '';
    galeriaPortadaStatus.style.color = 'var(--text-muted)';
  }

  if (btnGuardarGaleria) {
    btnGuardarGaleria.disabled = false;
    btnGuardarGaleria.innerText = 'Guardar video';
  }

  if (btnCancelarGaleria) {
    btnCancelarGaleria.style.display = 'none';
  }

  limpiarMensajeGaleria();
}

/**
 * Carga los datos de un video en el formulario para editar
 */
export function cargarVideoEnFormulario(video) {
  videoEditandoId = video.id;
  videoEditandoData = video;

  if (galeriaTituloInput) galeriaTituloInput.value = video.titulo || '';
  if (galeriaDescInput) galeriaDescInput.value = video.descripcion || '';
  if (galeriaOrdenInput) galeriaOrdenInput.value = video.orden != null ? video.orden : 1;

  if (galeriaVideoInput) {
    galeriaVideoInput.value = '';
    galeriaVideoInput.required = false;
  }
  if (galeriaPortadaInput) {
    galeriaPortadaInput.value = '';
    galeriaPortadaInput.required = false;
  }

  if (galeriaVideoStatus) {
    galeriaVideoStatus.innerText = video.video_url ? '🎥 Video actual guardado (selecciona otro si deseas reemplazarlo)' : '';
    galeriaVideoStatus.style.color = 'var(--gold-light)';
  }
  if (galeriaPortadaStatus) {
    galeriaPortadaStatus.innerText = video.portada_url ? '📷 Portada actual guardada (selecciona otra si deseas reemplazarla)' : '';
    galeriaPortadaStatus.style.color = 'var(--gold-light)';
  }

  if (btnGuardarGaleria) {
    btnGuardarGaleria.disabled = false;
    btnGuardarGaleria.innerText = 'Actualizar video';
  }

  if (btnCancelarGaleria) {
    btnCancelarGaleria.style.display = 'inline-flex';
  }

  limpiarMensajeGaleria();

  if (galeriaForm) {
    galeriaForm.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * Sube archivo de video al bucket 'videos-galeria'
 */
async function subirVideoStorage(file) {
  if (galeriaVideoStatus) {
    galeriaVideoStatus.innerText = '⏳ Subiendo video...';
    galeriaVideoStatus.style.color = 'var(--gold-light)';
  }

  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${crypto.randomUUID()}-${cleanFileName}`;

    const { error } = await supabaseClient
      .storage
      .from('videos-galeria')
      .upload(uniqueName, file);

    if (error) throw error;

    const { data: publicData } = supabaseClient
      .storage
      .from('videos-galeria')
      .getPublicUrl(uniqueName);

    if (galeriaVideoStatus) {
      galeriaVideoStatus.innerText = '✅ Video subido';
      galeriaVideoStatus.style.color = '#6fcf97';
    }

    return publicData.publicUrl;
  } catch (err) {
    if (galeriaVideoStatus) {
      galeriaVideoStatus.innerText = '❌ Error al subir video';
      galeriaVideoStatus.style.color = '#ff8585';
    }
    throw new Error(`Error al subir video: ${err.message || err}`);
  }
}

/**
 * Sube archivo de portada al bucket 'fotos-pelucas'
 */
async function subirPortadaStorage(file) {
  if (galeriaPortadaStatus) {
    galeriaPortadaStatus.innerText = '⏳ Subiendo portada...';
    galeriaPortadaStatus.style.color = 'var(--gold-light)';
  }

  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `portada-galeria-${crypto.randomUUID()}-${cleanFileName}`;

    const { error } = await supabaseClient
      .storage
      .from('fotos-pelucas')
      .upload(uniqueName, file);

    if (error) throw error;

    const { data: publicData } = supabaseClient
      .storage
      .from('fotos-pelucas')
      .getPublicUrl(uniqueName);

    if (galeriaPortadaStatus) {
      galeriaPortadaStatus.innerText = '✅ Portada subida';
      galeriaPortadaStatus.style.color = '#6fcf97';
    }

    return publicData.publicUrl;
  } catch (err) {
    if (galeriaPortadaStatus) {
      galeriaPortadaStatus.innerText = '❌ Error al subir portada';
      galeriaPortadaStatus.style.color = '#ff8585';
    }
    throw new Error(`Error al subir portada: ${err.message || err}`);
  }
}

/**
 * Guardar o actualizar registro en 'videos_promocionales'
 */
export async function guardarOActualizarVideoGaleria() {
  limpiarMensajeGaleria();

  const titulo = galeriaTituloInput?.value.trim() || '';
  const descripcion = galeriaDescInput?.value.trim() || '';
  const ordenVal = parseInt(galeriaOrdenInput?.value, 10);
  const orden = isNaN(ordenVal) ? 1 : ordenVal;

  if (!titulo) {
    mostrarMensajeGaleria('El título del video es obligatorio.', true);
    return;
  }

  const esEdicion = Boolean(videoEditandoId);
  const videoFile = galeriaVideoInput?.files?.[0];
  const portadaFile = galeriaPortadaInput?.files?.[0];

  if (!esEdicion && !videoFile) {
    mostrarMensajeGaleria('Debes seleccionar un archivo de video para subir.', true);
    return;
  }

  if (btnGuardarGaleria) {
    btnGuardarGaleria.disabled = true;
    btnGuardarGaleria.innerText = esEdicion ? 'Actualizando...' : 'Guardando...';
  }

  try {
    let video_url = esEdicion ? videoEditandoData?.video_url : null;
    let portada_url = esEdicion ? videoEditandoData?.portada_url : null;

    // Subida de video si se seleccionó uno nuevo
    if (videoFile) {
      video_url = await subirVideoStorage(videoFile);
    }

    // Subida de portada si se seleccionó una nueva
    if (portadaFile) {
      portada_url = await subirPortadaStorage(portadaFile);
    }

    const payload = {
      titulo,
      descripcion,
      orden,
      video_url,
      portada_url,
      activo: esEdicion && videoEditandoData ? videoEditandoData.activo : true
    };

    if (esEdicion) {
      const { error: updateErr } = await supabaseClient
        .from('videos_promocionales')
        .update(payload)
        .eq('id', videoEditandoId);

      if (updateErr) throw updateErr;
      mostrarMensajeGaleria('¡Video actualizado con éxito!');
    } else {
      const { error: insertErr } = await supabaseClient
        .from('videos_promocionales')
        .insert([payload]);

      if (insertErr) throw insertErr;
      mostrarMensajeGaleria('¡Video guardado con éxito!');
    }

    resetearFormularioGaleria();
    await cargarListaGaleria();
  } catch (err) {
    console.error('Error al guardar video de galería:', err);
    mostrarMensajeGaleria(err.message || 'Error inesperado al guardar.', true);
  } finally {
    if (btnGuardarGaleria) {
      btnGuardarGaleria.disabled = false;
      btnGuardarGaleria.innerText = videoEditandoId ? 'Actualizar video' : 'Guardar video';
    }
  }
}

/**
 * Alternar estado activo / inactivo de un video
 */
export async function toggleActivoGaleria(id, estadoActual) {
  try {
    const nuevoEstado = !estadoActual;
    const { error } = await supabaseClient
      .from('videos_promocionales')
      .update({ activo: nuevoEstado })
      .eq('id', id);

    if (error) throw error;
    await cargarListaGaleria();
  } catch (err) {
    console.error('Error al cambiar estado activo del video:', err);
    alert('Error al actualizar el estado del video: ' + (err.message || err));
  }
}

/**
 * Eliminar video de la galería
 */
export async function eliminarVideoGaleria(id) {
  const confirmacion = window.confirm('¿Estás seguro de eliminar este video de la galería? Esta acción no se puede deshacer.');
  if (!confirmacion) return;

  try {
    const { error } = await supabaseClient
      .from('videos_promocionales')
      .delete()
      .eq('id', id);

    if (error) throw error;

    if (videoEditandoId === id) {
      resetearFormularioGaleria();
    }

    await cargarListaGaleria();
  } catch (err) {
    console.error('Error al eliminar video de galería:', err);
    alert('Error al eliminar el video: ' + (err.message || err));
  }
}

/**
 * Renderiza la lista administrativa de videos
 */
function renderListaGaleria(videos) {
  if (!listaGaleriaContainer) return;

  if (!videos || videos.length === 0) {
    listaGaleriaContainer.innerHTML = `
      <div style="text-align:center; padding: 2rem; color: var(--text-muted);">
        <p style="font-size: 0.95rem; margin-bottom: 0.3rem;">Aún no has agregado videos a la galería.</p>
        <p style="font-size: 0.8rem;">Usa el formulario superior para subir tu primer video promocional.</p>
      </div>
    `;
    return;
  }

  listaGaleriaContainer.innerHTML = videos.map(video => {
    const portadaSrc = video.portada_url || 'logo dorado transparente.png';
    const esActivo = Boolean(video.activo);
    const badgeHtml = esActivo
      ? `<span class="badge-status badge-active">Activo</span>`
      : `<span class="badge-status badge-inactive">Inactivo</span>`;

    return `
      <div class="product-row" data-video-id="${video.id}">
        <img src="${escapeHtml(portadaSrc)}" alt="${escapeHtml(video.titulo)}" class="product-thumb" style="width:55px; height:80px; object-fit:cover; border-radius:6px; background:#121018;" onerror="this.onerror=null; this.src='logo dorado transparente.png';">
        <div class="product-info">
          <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; margin-bottom:0.3rem;">
            <h4 style="margin:0; font-size:1rem; color:var(--text-main);">${escapeHtml(video.titulo)}</h4>
            ${badgeHtml}
            <span style="font-size:0.75rem; background:rgba(230,200,135,0.12); color:var(--gold-light); border:1px solid rgba(230,200,135,0.25); padding:0.15rem 0.5rem; border-radius:4px;">
              Orden: ${video.orden != null ? video.orden : 1}
            </span>
          </div>
          <div class="product-meta" style="font-size:0.8rem; color:var(--text-muted); line-height:1.4;">
            ${video.descripcion ? escapeHtml(video.descripcion) : '<em>Sin descripción</em>'}
          </div>
          ${video.video_url ? `
            <div style="margin-top:0.3rem;">
              <a href="${escapeHtml(video.video_url)}" target="_blank" rel="noopener noreferrer" style="font-size:0.75rem; color:var(--gold-primary); text-decoration:none; display:inline-flex; align-items:center; gap:0.3rem;">
                ▶ Ver archivo de video
              </a>
            </div>
          ` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:0.4rem; align-items:flex-end;">
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end;">
            <button type="button" class="card-action-btn btn-editar-prod btn-editar-galeria" data-id="${video.id}" title="Editar video">
              Editar
            </button>
            <button type="button" class="card-action-btn btn-toggle-status btn-toggle-galeria" data-id="${video.id}" data-activo="${esActivo}" title="${esActivo ? 'Desactivar video' : 'Activar video'}">
              ${esActivo ? 'Desactivar' : 'Activar'}
            </button>
            <button type="button" class="card-action-btn btn-delete-definitivo btn-eliminar-galeria" data-id="${video.id}" title="Eliminar definitivamente">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Vincular eventos de botones
  listaGaleriaContainer.querySelectorAll('.btn-editar-galeria').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const v = videosCargados.find(item => String(item.id) === String(id));
      if (v) cargarVideoEnFormulario(v);
    });
  });

  listaGaleriaContainer.querySelectorAll('.btn-toggle-galeria').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const activo = btn.getAttribute('data-activo') === 'true';
      toggleActivoGaleria(id, activo);
    });
  });

  listaGaleriaContainer.querySelectorAll('.btn-eliminar-galeria').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      eliminarVideoGaleria(id);
    });
  });
}

/**
 * Consulta los videos de 'videos_promocionales' en Supabase
 */
export async function cargarListaGaleria() {
  if (listaGaleriaContainer) {
    listaGaleriaContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem; padding:1rem;">Cargando videos de la galería...</p>';
  }

  try {
    const { data, error } = await supabaseClient
      .from('videos_promocionales')
      .select('*')
      .order('orden', { ascending: true, nullsFirst: false });

    if (error) throw error;

    videosCargados = data || [];
    renderListaGaleria(videosCargados);
  } catch (err) {
    console.error('Error al cargar lista de videos de galería:', err);
    if (listaGaleriaContainer) {
      listaGaleriaContainer.innerHTML = `
        <div style="padding:1.5rem; color:#ff8585; font-size:0.9rem;">
          Error al cargar videos de la galería: ${escapeHtml(err.message || 'Error de conexión')}
        </div>
      `;
    }
  }
}

/**
 * Inicializa listeners del módulo de galería
 */
export function inicializarGaleriaAdmin() {
  // Escucha del submit o botón guardar
  galeriaForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    guardarOActualizarVideoGaleria();
  });

  btnGuardarGaleria?.addEventListener('click', (e) => {
    e.preventDefault();
    guardarOActualizarVideoGaleria();
  });

  btnCancelarGaleria?.addEventListener('click', () => {
    resetearFormularioGaleria();
  });

  // Prevenir wheel scroll en el input de orden
  galeriaOrdenInput?.addEventListener('wheel', (e) => {
    e.preventDefault();
  });

  // Feedback inmediato al seleccionar video
  galeriaVideoInput?.addEventListener('change', () => {
    if (!galeriaVideoStatus) return;
    const file = galeriaVideoInput.files?.[0];
    if (file) {
      galeriaVideoStatus.innerText = `🎥 Video seleccionado: ${file.name}`;
      galeriaVideoStatus.style.color = 'var(--gold-light)';
    } else {
      galeriaVideoStatus.innerText = '';
    }
  });

  // Feedback inmediato al seleccionar portada
  galeriaPortadaInput?.addEventListener('change', () => {
    if (!galeriaPortadaStatus) return;
    const file = galeriaPortadaInput.files?.[0];
    if (file) {
      galeriaPortadaStatus.innerText = `📷 Portada seleccionada: ${file.name}`;
      galeriaPortadaStatus.style.color = 'var(--gold-light)';
    } else {
      galeriaPortadaStatus.innerText = '';
    }
  });
}
