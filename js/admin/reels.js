import { supabaseClient } from '../supabaseClient.js';

// Memoria local de los reels cargados
let reelsCargados = {};

/**
 * Muestra un mensaje de estado en el bloque de la posición dada
 */
function setReelMensaje(posicion, texto, esError = false) {
  const msgEl = document.getElementById(`reelMsg_${posicion}`);
  if (!msgEl) return;
  msgEl.innerText = texto;
  msgEl.className = `admin-msg ${esError ? 'error' : 'success'}`;
  msgEl.style.display = texto ? 'block' : 'none';
}

/**
 * Limpia el mensaje de una posición
 */
function limpiarReelMensaje(posicion) {
  const msgEl = document.getElementById(`reelMsg_${posicion}`);
  if (!msgEl) return;
  msgEl.innerText = '';
  msgEl.style.display = 'none';
}

/**
 * Trae los 4 reels de la tabla 'reels' y precarga cada bloque del formulario
 */
export async function cargarReels() {
  try {
    const { data, error } = await supabaseClient
      .from('reels')
      .select('*')
      .order('posicion', { ascending: true });

    if (error) {
      console.error('Error al consultar tabla reels en Supabase:', error);
      return;
    }

    reelsCargados = {};

    // Restablecer estados visuales por posición
    for (let pos = 1; pos <= 4; pos++) {
      limpiarReelMensaje(pos);
      const previewImg = document.getElementById(`reelPreview_${pos}`);
      const statusSpan = document.getElementById(`reelPortadaStatus_${pos}`);
      const badge = document.getElementById(`reelBadge_${pos}`);
      const inputTitulo = document.getElementById(`reelTitulo_${pos}`);
      const inputLink = document.getElementById(`reelLink_${pos}`);
      const selectPlat = document.getElementById(`reelPlataforma_${pos}`);
      const fileInput = document.getElementById(`reelPortada_${pos}`);

      if (fileInput) fileInput.value = '';
      if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
      }
      if (statusSpan) {
        statusSpan.innerText = 'Sin imagen personalizada';
        statusSpan.style.color = 'var(--text-muted)';
      }
      if (badge) badge.style.display = 'none';
      if (inputTitulo) inputTitulo.value = '';
      if (inputLink) inputLink.value = '';
      if (selectPlat) selectPlat.value = (pos % 2 === 1) ? 'TikTok' : 'Instagram';
    }

    // Precargar con los datos existentes en base de datos
    (data || []).forEach(reel => {
      const pos = Number(reel.posicion);
      if (pos >= 1 && pos <= 4) {
        reelsCargados[pos] = reel;

        const selectPlat = document.getElementById(`reelPlataforma_${pos}`);
        const inputTitulo = document.getElementById(`reelTitulo_${pos}`);
        const inputLink = document.getElementById(`reelLink_${pos}`);
        const previewImg = document.getElementById(`reelPreview_${pos}`);
        const statusSpan = document.getElementById(`reelPortadaStatus_${pos}`);
        const badge = document.getElementById(`reelBadge_${pos}`);

        if (selectPlat && reel.plataforma) selectPlat.value = reel.plataforma;
        if (inputTitulo && reel.titulo) inputTitulo.value = reel.titulo;
        if (inputLink && reel.link) inputLink.value = reel.link;

        if (reel.portada_url) {
          if (previewImg) {
            previewImg.src = reel.portada_url;
            previewImg.style.display = 'block';
          }
          if (statusSpan) {
            statusSpan.innerText = 'Portada guardada';
            statusSpan.style.color = 'var(--gold-light)';
          }
        }

        if (badge) {
          badge.style.display = 'inline-block';
        }
      }
    });
  } catch (err) {
    console.error('Error inesperado al cargar reels:', err);
  }
}

/**
 * Guarda o actualiza un reel en la posición indicada
 */
export async function guardarReel(posicion) {
  const selectPlat = document.getElementById(`reelPlataforma_${posicion}`);
  const inputTitulo = document.getElementById(`reelTitulo_${posicion}`);
  const inputLink = document.getElementById(`reelLink_${posicion}`);
  const fileInput = document.getElementById(`reelPortada_${posicion}`);
  const btnGuardar = document.getElementById(`btnGuardarReel_${posicion}`);
  const statusSpan = document.getElementById(`reelPortadaStatus_${posicion}`);
  const previewImg = document.getElementById(`reelPreview_${posicion}`);
  const badge = document.getElementById(`reelBadge_${posicion}`);

  limpiarReelMensaje(posicion);

  const plataforma = selectPlat?.value || 'TikTok';
  const titulo = inputTitulo?.value?.trim() || '';
  const link = inputLink?.value?.trim() || '';
  const file = fileInput?.files?.[0];

  const reelPrevio = reelsCargados[posicion];
  let portada_url = reelPrevio?.portada_url || null;

  try {
    if (btnGuardar) {
      btnGuardar.disabled = true;
      btnGuardar.innerText = 'Guardando...';
    }

    // 1. Subir archivo de portada nuevo si fue seleccionado
    if (file) {
      if (statusSpan) {
        statusSpan.innerText = '⏳ Subiendo portada...';
        statusSpan.style.color = 'var(--gold-light)';
      }

      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueName = `${crypto.randomUUID()}-${cleanFileName}`;

      const { error: uploadError } = await supabaseClient
        .storage
        .from('portadas-reels')
        .upload(uniqueName, file);

      if (uploadError) {
        throw new Error(`Error al subir imagen: ${uploadError.message}`);
      }

      const { data: publicData } = supabaseClient
        .storage
        .from('portadas-reels')
        .getPublicUrl(uniqueName);

      portada_url = publicData.publicUrl;

      if (statusSpan) {
        statusSpan.innerText = '✅ Portada subida';
        statusSpan.style.color = '#6fcf97';
      }
      if (previewImg) {
        previewImg.src = portada_url;
        previewImg.style.display = 'block';
      }
    }

    // 2. Upsert en la tabla 'reels' por posición
    const payload = {
      posicion: Number(posicion),
      plataforma,
      titulo,
      link,
      portada_url
    };

    const { data: upsertData, error: upsertError } = await supabaseClient
      .from('reels')
      .upsert(payload, { onConflict: 'posicion' })
      .select()
      .single();

    if (upsertError) {
      throw new Error(`Error al guardar datos en la tabla: ${upsertError.message}`);
    }

    reelsCargados[posicion] = upsertData || payload;

    if (badge) badge.style.display = 'inline-block';
    if (fileInput) fileInput.value = '';

    setReelMensaje(posicion, `¡Posición ${posicion} guardada con éxito!`);
  } catch (err) {
    console.error(`Error al guardar reel ${posicion}:`, err);
    setReelMensaje(posicion, err.message || 'Error al guardar el reel.', true);
  } finally {
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.innerText = `Guardar Posición ${posicion}`;
    }
  }
}

/**
 * Conecta los 4 botones "Guardar" y los inputs file para preview instantáneo
 */
export function inicializarEventosReels() {
  for (let pos = 1; pos <= 4; pos++) {
    const btn = document.getElementById(`btnGuardarReel_${pos}`);
    if (btn) {
      btn.addEventListener('click', () => guardarReel(pos));
    }

    const fileInput = document.getElementById(`reelPortada_${pos}`);
    const previewImg = document.getElementById(`reelPreview_${pos}`);
    const statusSpan = document.getElementById(`reelPortadaStatus_${pos}`);

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (file) {
          if (previewImg) {
            previewImg.src = URL.createObjectURL(file);
            previewImg.style.display = 'block';
          }
          if (statusSpan) {
            statusSpan.innerText = `📷 ${file.name}`;
            statusSpan.style.color = 'var(--gold-light)';
          }
        }
      });
    }
  }
}
