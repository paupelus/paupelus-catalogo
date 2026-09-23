import { supabaseClient } from '../supabaseClient.js';

const productForm = document.getElementById('productForm');
const categoriaInput = document.getElementById('categoria');
const subcategoriaGroup = document.getElementById('subcategoriaGroup');
const subcategoriaSelect = document.getElementById('subcategoriaSelect');
const nombreInput = document.getElementById('nombre');
const colorInput = document.getElementById('color');
const largoInput = document.getElementById('largo_cm');
const tipoInput = document.getElementById('tipo');
const precioInput = document.getElementById('precio');
const descInput = document.getElementById('descripcion');
const fotoInput = document.getElementById('fotoInput');
const videoInput = document.getElementById('videoInput');
const fotoStatus = document.getElementById('fotoStatus');
const videoStatus = document.getElementById('videoStatus');
const panelMsg = document.getElementById('panelMsg');
const btnGuardarProducto = document.getElementById('btnGuardarProducto');

let productoEditandoId = null;
let productoEditandoData = null;

function actualizarVisibilidadSubcategoria() {
  if (!subcategoriaGroup) return;
  if (categoriaInput && categoriaInput.value === 'pelucas') {
    subcategoriaGroup.style.display = 'flex';
  } else {
    subcategoriaGroup.style.display = 'none';
    if (subcategoriaSelect) subcategoriaSelect.value = '';
  }
}

categoriaInput?.addEventListener('change', actualizarVisibilidadSubcategoria);
actualizarVisibilidadSubcategoria();

// Listeners de confirmación visual al seleccionar archivos
fotoInput?.addEventListener('change', () => {
  if (!fotoStatus) return;
  const file = fotoInput.files?.[0];
  if (file) {
    fotoStatus.innerText = `📷 Foto seleccionada: ${file.name}`;
    fotoStatus.style.color = 'var(--gold-light)';
  } else {
    fotoStatus.innerText = '';
  }
});

videoInput?.addEventListener('change', () => {
  if (!videoStatus) return;
  const file = videoInput.files?.[0];
  if (file) {
    videoStatus.innerText = `🎥 Video seleccionado: ${file.name}`;
    videoStatus.style.color = 'var(--gold-light)';
  } else {
    videoStatus.innerText = '';
  }
});

// Evitar que la rueda del mouse cambie el valor de los inputs numéricos al hacer scroll con el campo enfocado
precioInput?.addEventListener('wheel', function (e) {
  e.preventDefault();
});

largoInput?.addEventListener('wheel', function (e) {
  e.preventDefault();
});

export function getProductoEditandoId() {
  return productoEditandoId;
}

export function scrollAlFormulario() {
  if (productForm) {
    productForm.scrollIntoView({ behavior: 'smooth' });
  }
}

export function mostrarMensajeFormulario(texto, isError = false) {
  if (!panelMsg) return;
  panelMsg.innerText = texto;
  panelMsg.className = `admin-msg ${isError ? 'error' : 'success'}`;
  panelMsg.style.display = 'block';
}

export function limpiarMensajeFormulario() {
  if (!panelMsg) return;
  panelMsg.innerText = '';
  panelMsg.style.display = 'none';
}

export function cargarDatosEnFormulario(prod) {
  productoEditandoId = prod.id;
  productoEditandoData = prod;

  categoriaInput.value = prod.categoria || 'pelucas';
  actualizarVisibilidadSubcategoria();
  if (subcategoriaSelect) {
    subcategoriaSelect.value = prod.subcategoria || '';
  }

  nombreInput.value = prod.nombre || '';
  colorInput.value = prod.color || '';
  largoInput.value = prod.largo_cm != null ? prod.largo_cm : '';
  tipoInput.value = prod.tipo || '';
  precioInput.value = prod.precio != null ? prod.precio : '';
  descInput.value = prod.descripcion || '';

  if (fotoInput) {
    fotoInput.value = '';
    fotoInput.required = false;
  }
  if (videoInput) {
    videoInput.value = '';
  }

  if (fotoStatus) fotoStatus.innerText = '';
  if (videoStatus) videoStatus.innerText = '';

  if (btnGuardarProducto) {
    btnGuardarProducto.disabled = false;
    btnGuardarProducto.innerText = 'Actualizar producto';
  }
}

export function resetearFormulario() {
  productoEditandoId = null;
  productoEditandoData = null;
  if (productForm) productForm.reset();
  actualizarVisibilidadSubcategoria();
  if (fotoInput) fotoInput.required = true;
  if (fotoStatus) fotoStatus.innerText = '';
  if (videoStatus) videoStatus.innerText = '';
  if (btnGuardarProducto) {
    btnGuardarProducto.innerText = 'Guardar producto';
    btnGuardarProducto.disabled = true;
  }
}

export async function guardarOActualizarProducto(fotoProcesadaBlob) {
  limpiarMensajeFormulario();
  const esEdicion = Boolean(productoEditandoId);

  if (!esEdicion && !fotoProcesadaBlob) {
    throw new Error('Debes procesar la foto antes de guardar el producto.');
  }

  const nombre = nombreInput.value.trim();
  const precio = parseInt(precioInput.value, 10);
  const categoria = categoriaInput.value;

  if (!nombre) {
    throw new Error('El nombre del producto es obligatorio.');
  }
  if (isNaN(precio) || precio < 0) {
    throw new Error('Por favor ingresa un precio válido.');
  }

  let subcategoria = null;
  if (categoria === 'pelucas') {
    subcategoria = subcategoriaSelect ? subcategoriaSelect.value : '';
    if (!subcategoria) {
      throw new Error('Debes seleccionar una subcategoría para la peluca.');
    }
  }

  if (btnGuardarProducto) {
    btnGuardarProducto.disabled = true;
    btnGuardarProducto.innerText = esEdicion ? 'Actualizando...' : 'Guardando...';
  }

  try {
    let foto_url = null;

    if (fotoProcesadaBlob) {
      if (fotoStatus) {
        fotoStatus.innerText = '⏳ Subiendo foto...';
        fotoStatus.style.color = 'var(--gold-light)';
      }
      try {
        const photoFileName = `${crypto.randomUUID()}.webp`;
        const { error: photoErr } = await supabaseClient
          .storage
          .from('fotos-pelucas')
          .upload(photoFileName, fotoProcesadaBlob, { contentType: 'image/webp' });

        if (photoErr) throw photoErr;

        const { data: photoData } = supabaseClient
          .storage
          .from('fotos-pelucas')
          .getPublicUrl(photoFileName);

        foto_url = photoData.publicUrl;
        if (fotoStatus) {
          fotoStatus.innerText = '✅ Foto subida';
          fotoStatus.style.color = '#6fcf97';
        }
      } catch (errFoto) {
        if (fotoStatus) {
          fotoStatus.innerText = '❌ Error al subir';
          fotoStatus.style.color = '#ff8585';
        }
        throw errFoto;
      }
    } else if (esEdicion && productoEditandoData) {
      foto_url = productoEditandoData.foto_url;
    }

    let video_url = null;
    const videoFile = videoInput ? videoInput.files[0] : null;
    if (videoFile) {
      if (videoStatus) {
        videoStatus.innerText = '⏳ Subiendo video...';
        videoStatus.style.color = 'var(--gold-light)';
      }
      try {
        const cleanVideoName = videoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const videoFileName = `${crypto.randomUUID()}-${cleanVideoName}`;
        const { error: vidErr } = await supabaseClient
          .storage
          .from('videos-pelucas')
          .upload(videoFileName, videoFile);

        if (vidErr) throw vidErr;

        const { data: vidData } = supabaseClient
          .storage
          .from('videos-pelucas')
          .getPublicUrl(videoFileName);

        video_url = vidData.publicUrl;
        if (videoStatus) {
          videoStatus.innerText = '✅ Video subido';
          videoStatus.style.color = '#6fcf97';
        }
      } catch (errVid) {
        if (videoStatus) {
          videoStatus.innerText = '❌ Error al subir';
          videoStatus.style.color = '#ff8585';
        }
        throw errVid;
      }
    } else if (esEdicion && productoEditandoData) {
      video_url = productoEditandoData.video_url;
    }

    const payload = {
      categoria,
      subcategoria,
      nombre,
      color: colorInput.value.trim() || null,
      largo_cm: largoInput.value ? parseInt(largoInput.value, 10) : null,
      tipo: tipoInput.value.trim() || null,
      precio,
      descripcion: descInput.value.trim() || null,
      foto_url,
      video_url,
      activo: true
    };

    if (esEdicion) {
      const { error: updateErr } = await supabaseClient
        .from('productos')
        .update(payload)
        .eq('id', productoEditandoId);

      if (updateErr) throw updateErr;
      mostrarMensajeFormulario(`¡Producto "${nombre}" actualizado con éxito!`);
    } else {
      const { error: insertErr } = await supabaseClient
        .from('productos')
        .insert([payload]);

      if (insertErr) throw insertErr;
      mostrarMensajeFormulario(`¡Producto "${nombre}" guardado con éxito!`);
    }

    resetearFormulario();
    return true;

  } catch (err) {
    if (btnGuardarProducto) {
      btnGuardarProducto.disabled = false;
      btnGuardarProducto.innerText = esEdicion ? 'Actualizar producto' : 'Guardar producto';
    }
    throw err;
  }
}
