import { supabaseClient } from '../supabaseClient.js';

let tutorialEditandoId = null;
let tutorialEditandoData = null;
let tutorialesCargados = [];

// Elementos del DOM
const tutorialForm = document.getElementById('tutorialForm');
const tutorialFormTitle = document.getElementById('tutorialFormTitle');
const tutorialTituloInput = document.getElementById('tutorialTitulo');
const tutorialTipoSelect = document.getElementById('tutorialTipo');
const tutorialLinkGroup = document.getElementById('tutorialLinkGroup');
const tutorialLinkInput = document.getElementById('tutorialLinkExterno');
const tutorialArchivoGroup = document.getElementById('tutorialArchivoGroup');
const tutorialVideoInput = document.getElementById('tutorialVideoFile');
const tutorialVideoStatus = document.getElementById('tutorialVideoStatus');
const tutorialPortadaInput = document.getElementById('tutorialPortadaFile');
const tutorialPortadaStatus = document.getElementById('tutorialPortadaStatus');
const tutorialOrdenInput = document.getElementById('tutorialOrden');
const tutorialDescInput = document.getElementById('tutorialDescripcion');
const tutorialActivoCheck = document.getElementById('tutorialActivo');
const btnGuardarTutorial = document.getElementById('btnGuardarTutorial');
const btnCancelarTutorial = document.getElementById('btnCancelarTutorial');
const tutorialMsg = document.getElementById('tutorialMsg');
const listaTutorialesContainer = document.getElementById('listaTutoriales');

/**
 * Muestra mensaje de feedback
 */
function mostrarMensajeTutorial(texto, esError = false) {
  if (!tutorialMsg) return;
  tutorialMsg.innerText = texto;
  tutorialMsg.className = `admin-msg ${esError ? 'error' : 'success'}`;
  tutorialMsg.style.display = 'block';
}

/**
 * Limpia el mensaje de feedback
 */
function limpiarMensajeTutorial() {
  if (!tutorialMsg) return;
  tutorialMsg.innerText = '';
  tutorialMsg.style.display = 'none';
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
 * Extrae la ruta relativa de un archivo en el bucket 'videos-tutoriales'
 */
function obtenerRutaBucket(url, bucket = 'videos-tutoriales') {
  if (!url) return null;
  const token = `/${bucket}/`;
  const idx = url.indexOf(token);
  if (idx !== -1) {
    return decodeURIComponent(url.substring(idx + token.length).split('?')[0]);
  }
  return null;
}

/**
 * Borra un archivo del bucket
 */
async function borrarArchivoBucket(url, bucket = 'videos-tutoriales') {
  const ruta = obtenerRutaBucket(url, bucket);
  if (!ruta) return;
  try {
    const { error } = await supabaseClient.storage.from(bucket).remove([ruta]);
    if (error) console.warn(`Aviso al borrar ${ruta} de ${bucket}:`, error);
  } catch (err) {
    console.warn(`Error al intentar borrar ${ruta} de storage:`, err);
  }
}

/**
 * Convierte un archivo de imagen a WebP máx 800px de ancho con calidad 0.82
 */
async function procesarPortadaAWebp(file) {
  let imgBitmap;
  try {
    imgBitmap = await createImageBitmap(file);
  } catch (err) {
    imgBitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const u = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(u); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(u); reject(e); };
      img.src = u;
    });
  }

  const maxW = 800;
  let targetW = imgBitmap.width || imgBitmap.naturalWidth;
  let targetH = imgBitmap.height || imgBitmap.naturalHeight;

  if (targetW > maxW) {
    targetH = Math.round(targetH * (maxW / targetW));
    targetW = maxW;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgBitmap, 0, 0, targetW, targetH);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Fallo al generar WebP de portada'));
    }, 'image/webp', 0.82);
  });

  return blob;
}

/**
 * Sube la portada procesada a videos-tutoriales/portadas/
 */
async function subirPortadaTutorial(file) {
  if (tutorialPortadaStatus) {
    tutorialPortadaStatus.innerText = '⏳ Procesando y subiendo portada a WebP...';
    tutorialPortadaStatus.style.color = 'var(--gold-light)';
  }

  try {
    const webpBlob = await procesarPortadaAWebp(file);
    const uniqueName = `portadas/${crypto.randomUUID()}.webp`;

    const { error } = await supabaseClient
      .storage
      .from('videos-tutoriales')
      .upload(uniqueName, webpBlob, { contentType: 'image/webp' });

    if (error) throw error;

    const { data: publicData } = supabaseClient
      .storage
      .from('videos-tutoriales')
      .getPublicUrl(uniqueName);

    if (tutorialPortadaStatus) {
      tutorialPortadaStatus.innerText = '✅ Portada subida (WebP 800px)';
      tutorialPortadaStatus.style.color = '#6fcf97';
    }

    return publicData.publicUrl;
  } catch (err) {
    if (tutorialPortadaStatus) {
      tutorialPortadaStatus.innerText = '❌ Error al procesar portada';
      tutorialPortadaStatus.style.color = '#ff8585';
    }
    throw new Error(`Error al subir portada: ${err.message || err}`);
  }
}

/**
 * Sube el archivo de video a videos-tutoriales/videos/
 */
async function subirVideoTutorial(file) {
  if (tutorialVideoStatus) {
    tutorialVideoStatus.innerText = '⏳ Subiendo archivo de video...';
    tutorialVideoStatus.style.color = 'var(--gold-light)';
  }

  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `videos/${crypto.randomUUID()}-${cleanFileName}`;

    const { error } = await supabaseClient
      .storage
      .from('videos-tutoriales')
      .upload(uniqueName, file);

    if (error) throw error;

    const { data: publicData } = supabaseClient
      .storage
      .from('videos-tutoriales')
      .getPublicUrl(uniqueName);

    if (tutorialVideoStatus) {
      tutorialVideoStatus.innerText = '✅ Video subido';
      tutorialVideoStatus.style.color = '#6fcf97';
    }

    return publicData.publicUrl;
  } catch (err) {
    if (tutorialVideoStatus) {
      tutorialVideoStatus.innerText = '❌ Error al subir video';
      tutorialVideoStatus.style.color = '#ff8585';
    }
    throw new Error(`Error al subir video: ${err.message || err}`);
  }
}

/**
 * Resetea el formulario de tutoriales
 */
export function resetearFormularioTutorial() {
  tutorialEditandoId = null;
  tutorialEditandoData = null;

  if (tutorialForm) tutorialForm.reset();

  if (tutorialFormTitle) {
    tutorialFormTitle.innerText = 'Nuevo Tutorial';
  }

  if (tutorialTipoSelect) {
    tutorialTipoSelect.value = 'link';
  }

  if (tutorialLinkGroup) tutorialLinkGroup.style.display = 'block';
  if (tutorialArchivoGroup) tutorialArchivoGroup.style.display = 'none';

  if (tutorialLinkInput) {
    tutorialLinkInput.value = '';
    tutorialLinkInput.required = true;
  }

  if (tutorialVideoInput) {
    tutorialVideoInput.value = '';
    tutorialVideoInput.required = false;
  }

  if (tutorialPortadaInput) {
    tutorialPortadaInput.value = '';
  }

  if (tutorialOrdenInput) {
    tutorialOrdenInput.value = '1';
  }

  if (tutorialActivoCheck) {
    tutorialActivoCheck.checked = true;
  }

  if (tutorialVideoStatus) {
    tutorialVideoStatus.innerText = '';
    tutorialVideoStatus.style.color = 'var(--text-muted)';
  }

  if (tutorialPortadaStatus) {
    tutorialPortadaStatus.innerText = '';
    tutorialPortadaStatus.style.color = 'var(--text-muted)';
  }

  if (btnGuardarTutorial) {
    btnGuardarTutorial.disabled = false;
    btnGuardarTutorial.innerText = 'Guardar tutorial';
  }

  if (btnCancelarTutorial) {
    btnCancelarTutorial.style.display = 'none';
  }

  limpiarMensajeTutorial();
}

/**
 * Carga un tutorial en el formulario para editarlo
 */
export function cargarTutorialEnFormulario(tut) {
  tutorialEditandoId = tut.id;
  tutorialEditandoData = tut;

  if (tutorialFormTitle) {
    tutorialFormTitle.innerText = `Editar Tutorial: ${tut.titulo}`;
  }

  if (tutorialTituloInput) tutorialTituloInput.value = tut.titulo || '';
  if (tutorialDescInput) tutorialDescInput.value = tut.descripcion || '';
  if (tutorialOrdenInput) tutorialOrdenInput.value = tut.orden != null ? tut.orden : 1;
  if (tutorialActivoCheck) tutorialActivoCheck.checked = tut.activo !== false;

  const tipo = tut.tipo || 'link';
  if (tutorialTipoSelect) tutorialTipoSelect.value = tipo;

  if (tipo === 'link') {
    if (tutorialLinkGroup) tutorialLinkGroup.style.display = 'block';
    if (tutorialArchivoGroup) tutorialArchivoGroup.style.display = 'none';
    if (tutorialLinkInput) {
      tutorialLinkInput.value = tut.link_externo || '';
      tutorialLinkInput.required = true;
    }
    if (tutorialVideoInput) {
      tutorialVideoInput.value = '';
      tutorialVideoInput.required = false;
    }
  } else {
    if (tutorialLinkGroup) tutorialLinkGroup.style.display = 'none';
    if (tutorialArchivoGroup) tutorialArchivoGroup.style.display = 'block';
    if (tutorialLinkInput) {
      tutorialLinkInput.value = '';
      tutorialLinkInput.required = false;
    }
    if (tutorialVideoInput) {
      tutorialVideoInput.value = '';
      tutorialVideoInput.required = false;
    }
  }

  if (tutorialPortadaInput) {
    tutorialPortadaInput.value = '';
  }

  if (tutorialVideoStatus) {
    tutorialVideoStatus.innerText = tut.video_url
      ? '🎥 Video actual guardado (selecciona otro si deseas reemplazarlo)'
      : '';
    tutorialVideoStatus.style.color = 'var(--gold-light)';
  }

  if (tutorialPortadaStatus) {
    tutorialPortadaStatus.innerText = tut.portada_url
      ? '📷 Portada actual guardada (selecciona otra si deseas reemplazarla)'
      : '';
    tutorialPortadaStatus.style.color = 'var(--gold-light)';
  }

  if (btnGuardarTutorial) {
    btnGuardarTutorial.disabled = false;
    btnGuardarTutorial.innerText = 'Actualizar tutorial';
  }

  if (btnCancelarTutorial) {
    btnCancelarTutorial.style.display = 'inline-flex';
  }

  limpiarMensajeTutorial();

  if (tutorialForm) {
    tutorialForm.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * Guardar o actualizar registro de tutorial
 */
export async function guardarOActualizarTutorial() {
  limpiarMensajeTutorial();

  const titulo = tutorialTituloInput?.value.trim() || '';
  const tipo = tutorialTipoSelect?.value || 'link';
  const descripcion = tutorialDescInput?.value.trim() || '';
  const ordenVal = parseInt(tutorialOrdenInput?.value, 10);
  const orden = isNaN(ordenVal) ? 1 : ordenVal;
  const activo = Boolean(tutorialActivoCheck?.checked);

  if (!titulo) {
    mostrarMensajeTutorial('El título del tutorial es obligatorio.', true);
    return;
  }

  const esEdicion = Boolean(tutorialEditandoId);
  const videoFile = tutorialVideoInput?.files?.[0];
  const portadaFile = tutorialPortadaInput?.files?.[0];
  const linkExternoVal = tutorialLinkInput?.value.trim() || '';

  // Validaciones según el tipo
  if (tipo === 'link') {
    if (!linkExternoVal) {
      mostrarMensajeTutorial('Debes ingresar la URL del video.', true);
      return;
    }
    if (!linkExternoVal.startsWith('https://')) {
      mostrarMensajeTutorial('La URL del video debe comenzar con https://', true);
      return;
    }
  } else {
    // tipo === 'archivo'
    if (!esEdicion && !videoFile) {
      mostrarMensajeTutorial('Debes seleccionar un archivo de video para subir.', true);
      return;
    }
    if (esEdicion && !videoFile && !tutorialEditandoData?.video_url) {
      mostrarMensajeTutorial('Debes seleccionar un archivo de video para subir.', true);
      return;
    }
  }

  if (btnGuardarTutorial) {
    btnGuardarTutorial.disabled = true;
    btnGuardarTutorial.innerText = esEdicion ? 'Actualizando...' : 'Guardando...';
  }

  try {
    let video_url = esEdicion ? tutorialEditandoData?.video_url : null;
    let portada_url = esEdicion ? tutorialEditandoData?.portada_url : null;
    let link_externo = null;

    if (tipo === 'link') {
      link_externo = linkExternoVal;
      // Si antes era archivo y ahora es link, borrar archivo viejo del bucket
      if (esEdicion && tutorialEditandoData?.video_url) {
        await borrarArchivoBucket(tutorialEditandoData.video_url, 'videos-tutoriales');
        video_url = null;
      }
    } else {
      // tipo === 'archivo'
      link_externo = null;
      if (videoFile) {
        // Si ya tenía video anterior, borrarlo antes de reemplazarlo
        if (esEdicion && tutorialEditandoData?.video_url) {
          await borrarArchivoBucket(tutorialEditandoData.video_url, 'videos-tutoriales');
        }
        video_url = await subirVideoTutorial(videoFile);
      }
    }

    // Subida y procesamiento de portada si se seleccionó una nueva
    if (portadaFile) {
      if (esEdicion && tutorialEditandoData?.portada_url) {
        await borrarArchivoBucket(tutorialEditandoData.portada_url, 'videos-tutoriales');
      }
      portada_url = await subirPortadaTutorial(portadaFile);
    }

    const payload = {
      titulo,
      descripcion: descripcion || null,
      tipo,
      link_externo,
      video_url,
      portada_url,
      orden,
      activo
    };

    if (esEdicion) {
      const { error: updateErr } = await supabaseClient
        .from('tutoriales')
        .update(payload)
        .eq('id', tutorialEditandoId);

      if (updateErr) throw updateErr;
      mostrarMensajeTutorial('¡Tutorial actualizado con éxito!');
    } else {
      const { error: insertErr } = await supabaseClient
        .from('tutoriales')
        .insert([payload]);

      if (insertErr) throw insertErr;
      mostrarMensajeTutorial('¡Tutorial guardado con éxito!');
    }

    resetearFormularioTutorial();
    await cargarListaTutoriales();
  } catch (err) {
    console.error('Error al guardar tutorial:', err);
    mostrarMensajeTutorial(err.message || 'Error inesperado al guardar.', true);
  } finally {
    if (btnGuardarTutorial) {
      btnGuardarTutorial.disabled = false;
      btnGuardarTutorial.innerText = tutorialEditandoId ? 'Actualizar tutorial' : 'Guardar tutorial';
    }
  }
}

/**
 * Alternar estado activo / inactivo de un tutorial
 */
export async function toggleActivoTutorial(id, estadoActual) {
  try {
    const nuevoEstado = !estadoActual;
    const { error } = await supabaseClient
      .from('tutoriales')
      .update({ activo: nuevoEstado })
      .eq('id', id);

    if (error) throw error;
    await cargarListaTutoriales();
  } catch (err) {
    console.error('Error al cambiar estado activo del tutorial:', err);
    alert('Error al actualizar estado: ' + (err.message || err));
  }
}

/**
 * Eliminar tutorial y sus archivos asociados
 */
export async function eliminarTutorial(id) {
  const confirmacion = window.confirm('¿Estás seguro de eliminar este tutorial? Se eliminarán permanentemente el registro y sus archivos del almacenamiento.');
  if (!confirmacion) return;

  try {
    const tut = tutorialesCargados.find(item => String(item.id) === String(id));
    if (tut) {
      if (tut.video_url) await borrarArchivoBucket(tut.video_url, 'videos-tutoriales');
      if (tut.portada_url) await borrarArchivoBucket(tut.portada_url, 'videos-tutoriales');
    }

    const { error } = await supabaseClient
      .from('tutoriales')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await cargarListaTutoriales();
  } catch (err) {
    console.error('Error al eliminar tutorial:', err);
    alert('Error al eliminar el tutorial: ' + (err.message || err));
  }
}

/**
 * Renderiza la lista de tutoriales en el DOM
 */
function renderListaTutoriales(tutoriales = []) {
  if (!listaTutorialesContainer) return;

  if (!tutoriales || tutoriales.length === 0) {
    listaTutorialesContainer.innerHTML = `
      <div style="text-align:center; padding: 2.5rem 1rem; color: var(--text-muted);">
        <p style="font-size: 1rem; margin-bottom: 0.3rem;">Aún no hay tutoriales registrados.</p>
        <p style="font-size: 0.85rem;">Completa el formulario superior para añadir tu primer tutorial.</p>
      </div>
    `;
    return;
  }

  listaTutorialesContainer.innerHTML = tutoriales.map(tut => {
    const portadaSrc = tut.portada_url || 'logo-dorado.webp';
    const esActivo = Boolean(tut.activo);
    const esLink = tut.tipo === 'link';

    const badgeEstadoHtml = esActivo
      ? `<span class="badge-status badge-active" style="background:rgba(39,174,96,0.18); color:#6fcf97; border:1px solid rgba(39,174,96,0.4); padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem;">Activo</span>`
      : `<span class="badge-status badge-inactive" style="background:rgba(255,80,80,0.15); color:#ff8585; border:1px solid rgba(255,80,80,0.4); padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem;">Inactivo</span>`;

    const badgeTipoHtml = esLink
      ? `<span style="font-size:0.75rem; background:rgba(41,128,185,0.18); color:#70bbfd; border:1px solid rgba(41,128,185,0.4); padding:0.2rem 0.5rem; border-radius:4px;">🔗 Link</span>`
      : `<span style="font-size:0.75rem; background:rgba(155,89,182,0.18); color:#d2a8ff; border:1px solid rgba(155,89,182,0.4); padding:0.2rem 0.5rem; border-radius:4px;">📁 Archivo</span>`;

    let linkPreviewHtml = '';
    if (esLink && tut.link_externo) {
      linkPreviewHtml = `
        <div style="margin-top:0.35rem;">
          <a href="${escapeHtml(tut.link_externo)}" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem; color:var(--gold-primary); text-decoration:none; display:inline-flex; align-items:center; gap:0.3rem;">
            🔗 ${escapeHtml(tut.link_externo)}
          </a>
        </div>
      `;
    } else if (!esLink && tut.video_url) {
      linkPreviewHtml = `
        <div style="margin-top:0.35rem;">
          <a href="${escapeHtml(tut.video_url)}" target="_blank" rel="noopener noreferrer" style="font-size:0.78rem; color:var(--gold-primary); text-decoration:none; display:inline-flex; align-items:center; gap:0.3rem;">
            ▶ Ver video alojado
          </a>
        </div>
      `;
    }

    return `
      <div class="product-row" data-tutorial-id="${tut.id}" style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem; border-bottom:1px solid var(--border-subtle); flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:1rem; flex:1; min-width:240px;">
          <img src="${escapeHtml(portadaSrc)}" alt="${escapeHtml(tut.titulo)}" class="product-thumb" style="width:65px; height:85px; object-fit:cover; border-radius:6px; background:#121018; border:1px solid var(--border-subtle);" onerror="this.onerror=null; this.src='logo-dorado.webp';">
          <div class="product-info" style="flex:1;">
            <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; margin-bottom:0.3rem;">
              <h4 style="margin:0; font-size:1rem; color:var(--text-main); font-weight:500;">${escapeHtml(tut.titulo)}</h4>
              ${badgeEstadoHtml}
              ${badgeTipoHtml}
              <span style="font-size:0.75rem; background:rgba(230,200,135,0.12); color:var(--gold-light); border:1px solid rgba(230,200,135,0.25); padding:0.15rem 0.5rem; border-radius:4px;">
                Orden: ${tut.orden != null ? tut.orden : 1}
              </span>
            </div>
            <div class="product-meta" style="font-size:0.8rem; color:var(--text-muted); line-height:1.4;">
              ${tut.descripcion ? escapeHtml(tut.descripcion) : '<em>Sin descripción</em>'}
            </div>
            ${linkPreviewHtml}
          </div>
        </div>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end;">
          <button type="button" class="card-action-btn btn-editar-prod btn-editar-tutorial" data-id="${tut.id}" title="Editar tutorial">
            Editar
          </button>
          <button type="button" class="card-action-btn btn-toggle-status btn-toggle-tutorial" data-id="${tut.id}" data-activo="${esActivo}" title="${esActivo ? 'Desactivar tutorial' : 'Activar tutorial'}">
            ${esActivo ? 'Desactivar' : 'Activar'}
          </button>
          <button type="button" class="card-action-btn btn-delete-definitivo btn-eliminar-tutorial" data-id="${tut.id}" title="Eliminar tutorial">
            Eliminar
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Vincular eventos de botones
  listaTutorialesContainer.querySelectorAll('.btn-editar-tutorial').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const tut = tutorialesCargados.find(t => String(t.id) === String(id));
      if (tut) cargarTutorialEnFormulario(tut);
    });
  });

  listaTutorialesContainer.querySelectorAll('.btn-toggle-tutorial').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const activo = btn.getAttribute('data-activo') === 'true';
      toggleActivoTutorial(id, activo);
    });
  });

  listaTutorialesContainer.querySelectorAll('.btn-eliminar-tutorial').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      eliminarTutorial(id);
    });
  });
}

/**
 * Consulta los tutoriales en Supabase
 */
export async function cargarListaTutoriales() {
  if (listaTutorialesContainer) {
    listaTutorialesContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem; padding:1rem;">Cargando tutoriales...</p>';
  }

  try {
    const { data, error } = await supabaseClient
      .from('tutoriales')
      .select('*')
      .order('orden', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    tutorialesCargados = data || [];
    renderListaTutoriales(tutorialesCargados);
  } catch (err) {
    console.error('Error al cargar lista de tutoriales:', err);
    if (listaTutorialesContainer) {
      listaTutorialesContainer.innerHTML = `
        <div style="padding:1.5rem; text-align:center; color:#ff8585;">
          <p style="margin-bottom:0.4rem;">Error al cargar tutoriales.</p>
          <small style="color:var(--text-muted);">${escapeHtml(err.message || 'Error de conexión')}</small>
        </div>
      `;
    }
  }
}

/**
 * Inicialización del módulo de Tutoriales
 */
export function inicializarTutorialesAdmin() {
  // Cambio de selector de tipo (link vs archivo)
  tutorialTipoSelect?.addEventListener('change', () => {
    const val = tutorialTipoSelect.value;
    if (val === 'link') {
      if (tutorialLinkGroup) tutorialLinkGroup.style.display = 'block';
      if (tutorialArchivoGroup) tutorialArchivoGroup.style.display = 'none';
      if (tutorialLinkInput) tutorialLinkInput.required = true;
      if (tutorialVideoInput) tutorialVideoInput.required = false;
    } else {
      if (tutorialLinkGroup) tutorialLinkGroup.style.display = 'none';
      if (tutorialArchivoGroup) tutorialArchivoGroup.style.display = 'block';
      if (tutorialLinkInput) tutorialLinkInput.required = false;
      if (tutorialVideoInput) tutorialVideoInput.required = !tutorialEditandoId;
    }
  });

  // Prevención de scroll wheel en orden
  tutorialOrdenInput?.addEventListener('wheel', (e) => {
    e.preventDefault();
  });

  // Confirmación al seleccionar archivo de video
  tutorialVideoInput?.addEventListener('change', () => {
    if (!tutorialVideoStatus) return;
    const file = tutorialVideoInput.files?.[0];
    if (file) {
      tutorialVideoStatus.innerText = `🎥 Video seleccionado: ${file.name}`;
      tutorialVideoStatus.style.color = 'var(--gold-light)';
    } else {
      tutorialVideoStatus.innerText = '';
    }
  });

  // Confirmación al seleccionar archivo de portada
  tutorialPortadaInput?.addEventListener('change', () => {
    if (!tutorialPortadaStatus) return;
    const file = tutorialPortadaInput.files?.[0];
    if (file) {
      tutorialPortadaStatus.innerText = `📷 Portada seleccionada: ${file.name}`;
      tutorialPortadaStatus.style.color = 'var(--gold-light)';
    } else {
      tutorialPortadaStatus.innerText = '';
    }
  });

  // Envío del formulario
  tutorialForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardarOActualizarTutorial();
  });

  // Cancelar edición
  btnCancelarTutorial?.addEventListener('click', () => {
    resetearFormularioTutorial();
  });
}
