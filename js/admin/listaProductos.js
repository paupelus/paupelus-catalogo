import { supabaseClient } from '../supabaseClient.js';

const listaProductos = document.getElementById('listaProductos');
const tabActivos = document.getElementById('tabActivos');
const tabPapelera = document.getElementById('tabPapelera');
const adminSearchInput = document.getElementById('adminSearchInput');
const adminSearchClear = document.getElementById('adminSearchClear');
const adminSearchMeta = document.getElementById('adminSearchMeta');
const adminSearchCount = document.getElementById('adminSearchCount');

let listaProductosMemoria = [];
let vistaActual = 'activos';
let callbackEditar = null;
let filtroBusqueda = '';
let buscadorInicializado = false;

export function setCallbackEditar(fn) {
  callbackEditar = fn;
}

export function obtenerProductoPorId(id) {
  return listaProductosMemoria.find(p => p.id === id) || null;
}

function normalizarTexto(texto) {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function escapeHtml(str) {
  return (str || '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function coincideBusqueda(producto, query) {
  if (!query) return true;
  const qNormal = normalizarTexto(query);
  if (!qNormal) return true;

  // Búsqueda directa por número exacto o prefijos: "12", "#12", "n° 12", "no 12", "numero 12"
  const soloNumeroMatch = qNormal.match(/^(?:n[o°.]*|#|numero|num)?\s*(\d+)$/i);
  const numeroBuscado = soloNumeroMatch ? parseInt(soloNumeroMatch[1], 10) : null;

  if (numeroBuscado !== null && producto.numero_exhibicion === numeroBuscado) {
    return true;
  }

  const nombreNorm = normalizarTexto(producto.nombre);
  const colorNorm = normalizarTexto(producto.color);
  const tipoNorm = normalizarTexto(producto.tipo);
  const catNorm = normalizarTexto(producto.categoria);
  const subcatNorm = normalizarTexto(producto.subcategoria);
  const numExhibicionStr = producto.numero_exhibicion != null ? String(producto.numero_exhibicion) : '';

  // Búsqueda por palabras (permite "chocolate 12", "peluca chocolate", etc.)
  const palabras = qNormal.split(/\s+/).filter(Boolean);
  return palabras.every(palabra => {
    const numPalabraMatch = palabra.match(/^(?:n[o°.]*|#)?(\d+)$/i);
    const numPalabra = numPalabraMatch ? parseInt(numPalabraMatch[1], 10) : null;
    if (numPalabra !== null && producto.numero_exhibicion === numPalabra) {
      return true;
    }
    return nombreNorm.includes(palabra) ||
           colorNorm.includes(palabra) ||
           tipoNorm.includes(palabra) ||
           catNorm.includes(palabra) ||
           subcatNorm.includes(palabra) ||
           (numExhibicionStr && numExhibicionStr === palabra);
  });
}

function formatPrice(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(amount);
}

function calcularDiasRestantes(eliminadoEn) {
  if (!eliminadoEn) return 30;
  const diffMs = Date.now() - new Date(eliminadoEn).getTime();
  const diasPasados = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, 30 - diasPasados);
}

export async function purgarProductosAntiguos() {
  try {
    const limite30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseClient
      .from('productos')
      .delete()
      .lt('eliminado_en', limite30Dias);
  } catch (err) {
    console.error('Error en purga automática:', err);
  }
}

export async function cambiarVista(nuevaVista) {
  if (vistaActual === nuevaVista) return;
  vistaActual = nuevaVista;

  if (tabActivos && tabPapelera) {
    if (vistaActual === 'activos') {
      tabActivos.classList.add('active');
      tabPapelera.classList.remove('active');
    } else {
      tabPapelera.classList.add('active');
      tabActivos.classList.remove('active');
    }
  }

  renderizarListaProductos();
}

export function inicializarBuscadorAdmin() {
  if (buscadorInicializado || !adminSearchInput) return;
  buscadorInicializado = true;

  adminSearchInput.addEventListener('input', () => {
    filtroBusqueda = adminSearchInput.value.trim();
    if (adminSearchClear) {
      adminSearchClear.style.display = filtroBusqueda ? 'flex' : 'none';
    }
    renderizarListaProductos();
  });

  adminSearchClear?.addEventListener('click', () => {
    limpiarBuscadorAdmin();
  });

  adminSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      limpiarBuscadorAdmin();
    }
  });
}

export function limpiarBuscadorAdmin() {
  filtroBusqueda = '';
  if (adminSearchInput) {
    adminSearchInput.value = '';
    adminSearchInput.focus();
  }
  if (adminSearchClear) {
    adminSearchClear.style.display = 'none';
  }
  if (adminSearchMeta) {
    adminSearchMeta.style.display = 'none';
  }
  renderizarListaProductos();
}

export async function cargarListaProductos(consultar = true) {
  if (!listaProductos) return;

  try {
    if (consultar) {
      let query = supabaseClient.from('productos').select('*');
      const { data, error } = await query.order('creado_en', { ascending: false });

      let items = data;
      if (error) {
        const fallbackRes = await supabaseClient.from('productos').select('*').order('id', { ascending: false });
        if (fallbackRes.error) throw fallbackRes.error;
        items = fallbackRes.data;
      }

      listaProductosMemoria = items || [];
      listaProductosMemoria.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
    }

    renderizarListaProductos();
  } catch (err) {
    console.error('Error cargando lista de productos:', err);
    listaProductos.innerHTML = `<p style="color:#ff8585; font-size:0.9rem;">Error al cargar la lista: ${err.message || 'Error desconocido'}</p>`;
  }
}

export function renderizarListaProductos() {
  if (!listaProductos) return;

  try {
    const itemsBase = listaProductosMemoria.filter(p => {
      return vistaActual === 'activos' ? p.activo : !p.activo;
    });

    const itemsAMostrar = itemsBase.filter(p => coincideBusqueda(p, filtroBusqueda));

    // Si la búsqueda es por número exacto, priorizar el producto que coincide con ese número
    const qNormal = normalizarTexto(filtroBusqueda);
    const soloNumeroMatch = qNormal.match(/^(?:n[o°.]*|#|numero|num)?\s*(\d+)$/i);
    const numBuscado = soloNumeroMatch ? parseInt(soloNumeroMatch[1], 10) : null;

    itemsAMostrar.sort((a, b) => {
      if (numBuscado !== null) {
        if (a.numero_exhibicion === numBuscado && b.numero_exhibicion !== numBuscado) return -1;
        if (b.numero_exhibicion === numBuscado && a.numero_exhibicion !== numBuscado) return 1;
      }
      return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
    });

    // Contador de búsqueda
    if (adminSearchMeta && adminSearchCount) {
      if (filtroBusqueda) {
        adminSearchMeta.style.display = 'flex';
        const total = itemsBase.length;
        const coincidencias = itemsAMostrar.length;
        adminSearchCount.innerHTML = `Mostrando <strong>${coincidencias}</strong> de ${total} productos para "<em>${escapeHtml(filtroBusqueda)}</em>"`;
      } else {
        adminSearchMeta.style.display = 'none';
        adminSearchCount.innerHTML = '';
      }
    }

    if (itemsAMostrar.length === 0) {
      if (filtroBusqueda) {
        listaProductos.innerHTML = `
          <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
            <p style="font-size:1.1rem; margin-bottom:0.4rem; color:var(--text-main);">
              🔍 No se encontró ninguna peluca o producto para "<strong>${escapeHtml(filtroBusqueda)}</strong>"
            </p>
            <p style="font-size:0.85rem; max-width:440px; margin:0 auto 1.2rem auto;">
              Verifica el nombre (ej. Chocolate) o busca directamente por el número en que está exhibida en el Live (1 - 14).
            </p>
            <button type="button" class="card-action-btn" id="btnRestablecerBusqueda" style="padding:0.6rem 1.2rem; font-size:0.85rem; background:rgba(212,175,55,0.15); color:var(--gold-primary); border-color:var(--gold-primary);">
              ✕ Limpiar búsqueda
            </button>
          </div>
        `;
        const btnRestablecer = document.getElementById('btnRestablecerBusqueda');
        btnRestablecer?.addEventListener('click', () => {
          limpiarBuscadorAdmin();
        });
      } else if (vistaActual === 'papelera') {
        listaProductos.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">La papelera está vacía.</p>`;
      } else {
        listaProductos.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No hay productos registrados en el catálogo.</p>`;
      }
      return;
    }

    listaProductos.innerHTML = itemsAMostrar.map(p => {
      const diasRestantes = calcularDiasRestantes(p.eliminado_en);
      const badgeExhibicionHtml = p.numero_exhibicion != null
        ? `<span class="badge-status badge-exhibicion" title="Número exhibido en Live">N° ${p.numero_exhibicion} en Live</span>`
        : '';

      return `
        <div class="product-row" data-id="${p.id}">
          <img src="${p.foto_url}" alt="${p.nombre}" class="product-thumb" onerror="this.onerror=null; this.src='logo dorado transparente.png'">
          <div class="product-info">
            <h4 style="display:flex; align-items:center; flex-wrap:wrap; gap:0.4rem;">
              <span>${p.nombre}</span>
              ${badgeExhibicionHtml}
              ${p.agotado ? `<span class="badge-status badge-inactive" style="font-size:0.65rem;">AGOTADO</span>` : ''}
            </h4>
            <div class="product-meta">
              <span>${p.categoria}</span> | 
              ${p.color ? `<span>Color: <strong>${p.color}</strong></span> | ` : ''}
              <span>${formatPrice(p.precio)}</span> | 
              <span class="badge-status ${p.activo ? 'badge-active' : 'badge-inactive'}">
                ${p.activo ? 'Activo' : `En papelera · se elimina en ${diasRestantes} días`}
              </span>
            </div>
          </div>
          <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
            <input type="number" class="input-numero-exhibicion" data-id="${p.id}" data-original-val="${p.numero_exhibicion ?? ''}" value="${p.numero_exhibicion ?? ''}" placeholder="N°" min="1" step="1" title="Número de Exhibición en Live (1 - 14)">
            <button class="card-action-btn btn-copiar-link" data-id="${p.id}">
              🔗 Copiar link
            </button>
            <button class="card-action-btn btn-copiar-ficha" data-id="${p.id}" title="Copiar ficha de venta lista para WhatsApp">
              📲 Ficha WhatsApp
            </button>
            <button class="card-action-btn btn-editar-prod" data-id="${p.id}">
              Editar
            </button>
            ${p.activo ? `
              <button class="card-action-btn btn-toggle-agotado" data-id="${p.id}" data-agotado="${Boolean(p.agotado)}">
                ${p.agotado ? 'Marcar disponible' : 'Marcar agotado'}
              </button>
              <button class="card-action-btn btn-toggle-status" data-id="${p.id}" data-activo="false">
                Eliminar
              </button>
            ` : `
              <button class="card-action-btn btn-toggle-status" data-id="${p.id}" data-activo="true">
                Restaurar
              </button>
              <button class="card-action-btn btn-delete-definitivo" data-id="${p.id}">
                Eliminar definitivo
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Eventos Número de Exhibición (edición rápida en línea)
    listaProductos.querySelectorAll('.input-numero-exhibicion').forEach(input => {
      input.addEventListener('wheel', (e) => {
        e.preventDefault();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      });

      input.addEventListener('blur', async () => {
        const id = input.getAttribute('data-id');
        const rawVal = input.value.trim();
        const nuevoNumero = rawVal === '' ? null : parseInt(rawVal, 10);
        const originalVal = input.getAttribute('data-original-val');
        const anteriorNumero = (originalVal === '' || originalVal === null || originalVal === undefined) ? null : parseInt(originalVal, 10);

        if (nuevoNumero === anteriorNumero) return;

        try {
          const { error } = await supabaseClient
            .from('productos')
            .update({ numero_exhibicion: nuevoNumero })
            .eq('id', id);

          if (error) throw error;

          const prod = listaProductosMemoria.find(p => String(p.id) === String(id));
          if (prod) prod.numero_exhibicion = nuevoNumero;
          input.setAttribute('data-original-val', nuevoNumero != null ? nuevoNumero : '');

          // Actualizar insignia en vivo sin recargar todo el DOM
          const rowEl = input.closest('.product-row');
          if (rowEl) {
            const h4El = rowEl.querySelector('h4');
            let badgeEl = h4El?.querySelector('.badge-exhibicion');
            if (nuevoNumero != null) {
              if (!badgeEl) {
                badgeEl = document.createElement('span');
                badgeEl.className = 'badge-status badge-exhibicion';
                badgeEl.title = 'Número exhibido en Live';
                const firstSpan = h4El?.querySelector('span');
                if (firstSpan && firstSpan.nextSibling) {
                  h4El.insertBefore(badgeEl, firstSpan.nextSibling);
                } else if (h4El) {
                  h4El.appendChild(badgeEl);
                }
              }
              if (badgeEl) badgeEl.textContent = `N° ${nuevoNumero} en Live`;
            } else if (badgeEl) {
              badgeEl.remove();
            }
          }

          input.classList.remove('error');
          input.classList.add('saved');
          setTimeout(() => {
            input.classList.remove('saved');
          }, 1500);
        } catch (err) {
          console.error('Error al actualizar número de exhibición:', err);
          input.classList.remove('saved');
          input.classList.add('error');
          alert(`No se pudo actualizar el N° de exhibición: ${err.message || err}`);
          setTimeout(() => {
            input.classList.remove('error');
          }, 3000);
        }
      });
    });

    // Eventos Copiar Link
    listaProductos.querySelectorAll('.btn-copiar-link').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const url = `${window.location.origin}/?producto=${id}`;

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
          } else {
            const textarea = document.createElement('textarea');
            textarea.value = url;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          }

          const btnEl = e.currentTarget;
          btnEl.innerText = '✅ Copiado';
          setTimeout(() => {
            btnEl.innerText = '🔗 Copiar link';
          }, 2000);
        } catch (err) {
          console.error('Error al copiar link:', err);
          prompt('Copia el link del producto:', url);
        }
      });
    });

    // Eventos Copiar Ficha WhatsApp
    listaProductos.querySelectorAll('.btn-copiar-ficha').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const p = listaProductosMemoria.find(item => String(item.id) === String(id));
        if (!p) return;

        let tagLabel = 'Peluca';
        if (p.categoria === 'pelucas') {
          tagLabel = p.subcategoria === 'lacefront' ? 'Peluca Lace Front' : 'Peluca Clásica';
        } else if (p.categoria === 'accesorios') {
          tagLabel = 'Accesorio Especializado';
        }

        const url = `${window.location.origin}/?producto=${p.id}`;
        const videoHint = p.video_url
          ? '🎥 *Toca el enlace de abajo para verla en VIDEO con movimiento real:*'
          : '✨ *Toca el enlace de abajo para ver fotos en detalle y disponibilidad:*';

        const specsParts = [];
        if (p.numero_exhibicion != null) specsParts.push(`✨ *N° en Live:* ${p.numero_exhibicion}`);
        if (p.color) specsParts.push(`✨ *Tono:* ${p.color}`);
        if (p.largo_cm && p.tipo) {
          specsParts.push(`✨ *Largo:* ${p.largo_cm} cm | Textura: ${p.tipo}`);
        } else if (p.largo_cm) {
          specsParts.push(`✨ *Largo:* ${p.largo_cm} cm`);
        } else if (p.tipo) {
          specsParts.push(`✨ *Textura:* ${p.tipo}`);
        }
        specsParts.push(`✨ *Precio:* ${formatPrice(p.precio)} COP`);
        if (p.categoria === 'pelucas') {
          specsParts.push('✨ *Material:* Fibra termorresistente de alta gama (soporta 180°C)');
          specsParts.push('✨ *Acabado:* Simulación ultra realista de cuero cabelludo');
        }

        const mensajeFicha = `¡Hola! 💖 Con gusto, aquí tienes los detalles de la *${tagLabel} ${p.nombre}*:\n\n${specsParts.join('\n')}\n\n${videoHint}\n${url}`;

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(mensajeFicha);
          } else {
            const textarea = document.createElement('textarea');
            textarea.value = mensajeFicha;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          }

          const btnEl = e.currentTarget;
          btnEl.innerText = '✅ Ficha copiada';
          setTimeout(() => {
            btnEl.innerText = '📲 Ficha WhatsApp';
          }, 2000);
        } catch (err) {
          console.error('Error al copiar ficha:', err);
          prompt('Copia la ficha de la peluca:', mensajeFicha);
        }
      });
    });

    // Eventos Editar
    listaProductos.querySelectorAll('.btn-editar-prod').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (callbackEditar) {
          callbackEditar(id);
        }
      });
    });

    // Eventos Marcar Agotado / Disponible
    listaProductos.querySelectorAll('.btn-toggle-agotado').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const valorActual = e.currentTarget.getAttribute('data-agotado') === 'true';
        btn.disabled = true;
        btn.innerText = valorActual ? 'Activando...' : 'Agotando...';

        try {
          const { error: errAgotado } = await supabaseClient
            .from('productos')
            .update({ agotado: !valorActual })
            .eq('id', id);

          if (errAgotado) throw errAgotado;
          cargarListaProductos();
        } catch (err) {
          console.error('Error al actualizar disponibilidad:', err);
          alert(`No se pudo actualizar la disponibilidad: ${err.message || err}`);
          btn.disabled = false;
        }
      });
    });

    // Eventos Eliminar / Restaurar
    listaProductos.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const nuevoEstado = e.currentTarget.getAttribute('data-activo') === 'true';
        btn.disabled = true;
        btn.innerText = nuevoEstado ? 'Restaurando...' : 'Eliminando...';

        const payload = nuevoEstado
          ? { activo: true, eliminado_en: null }
          : { activo: false, eliminado_en: new Date().toISOString() };

        try {
          const { error: updErr } = await supabaseClient
            .from('productos')
            .update(payload)
            .eq('id', id);

          if (updErr) throw updErr;
          cargarListaProductos();
        } catch (err) {
          console.error('Error al actualizar estado del producto:', err);
          alert(`No se pudo actualizar el estado: ${err.message || err}`);
          btn.disabled = false;
        }
      });
    });

    // Eventos Eliminar Definitivo
    listaProductos.querySelectorAll('.btn-delete-definitivo').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('¿Eliminar este producto para siempre? No se puede deshacer.')) {
          btn.disabled = true;
          btn.innerText = 'Eliminando...';
          try {
            const { error: delErr } = await supabaseClient
              .from('productos')
              .delete()
              .eq('id', id);

            if (delErr) throw delErr;
            cargarListaProductos();
          } catch (err) {
            console.error('Error al eliminar definitivamente el producto:', err);
            alert(`No se pudo eliminar el producto: ${err.message || err}`);
            btn.disabled = false;
          }
        }
      });
    });

  } catch (err) {
    console.error('Error cargando lista de productos:', err);
    listaProductos.innerHTML = `<p style="color:#ff8585; font-size:0.9rem;">Error al cargar la lista: ${err.message || 'Error desconocido'}</p>`;
  }
}
