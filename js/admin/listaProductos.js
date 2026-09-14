import { supabaseClient } from '../supabaseClient.js';

const listaProductos = document.getElementById('listaProductos');
const tabActivos = document.getElementById('tabActivos');
const tabPapelera = document.getElementById('tabPapelera');

let listaProductosMemoria = [];
let vistaActual = 'activos';
let callbackEditar = null;

export function setCallbackEditar(fn) {
  callbackEditar = fn;
}

export function obtenerProductoPorId(id) {
  return listaProductosMemoria.find(p => p.id === id) || null;
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

  await cargarListaProductos(false);
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
    }

    const itemsAMostrar = listaProductosMemoria.filter(p => {
      return vistaActual === 'activos' ? p.activo : !p.activo;
    });

    if (itemsAMostrar.length === 0) {
      if (vistaActual === 'papelera') {
        listaProductos.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">La papelera está vacía.</p>`;
      } else {
        listaProductos.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">No hay productos registrados en el catálogo.</p>`;
      }
      return;
    }

    listaProductos.innerHTML = itemsAMostrar.map(p => {
      const diasRestantes = calcularDiasRestantes(p.eliminado_en);

      return `
        <div class="product-row" data-id="${p.id}">
          <img src="${p.foto_url}" alt="${p.nombre}" class="product-thumb" onerror="this.onerror=null; this.src='logo dorado transparente.png'">
          <div class="product-info">
            <h4>
              ${p.nombre}
              ${p.agotado ? `<span class="badge-status badge-inactive" style="margin-left:0.4rem; font-size:0.65rem;">AGOTADO</span>` : ''}
            </h4>
            <div class="product-meta">
              <span>${p.categoria}</span> | 
              <span>${formatPrice(p.precio)}</span> | 
              <span class="badge-status ${p.activo ? 'badge-active' : 'badge-inactive'}">
                ${p.activo ? 'Activo' : `En papelera · se elimina en ${diasRestantes} días`}
              </span>
            </div>
          </div>
          <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
            <button class="card-action-btn btn-copiar-link" data-id="${p.id}" style="padding:0.4rem 0.8rem; font-size:0.75rem; color:var(--gold-light); border-color:var(--border-subtle);">
              🔗 Copiar link
            </button>
            <button class="card-action-btn btn-editar-prod" data-id="${p.id}" style="padding:0.4rem 0.8rem; font-size:0.75rem; color:var(--gold-primary); border-color:var(--border-subtle);">
              Editar
            </button>
            ${p.activo ? `
              <button class="card-action-btn btn-toggle-agotado" data-id="${p.id}" data-agotado="${Boolean(p.agotado)}" style="padding:0.4rem 0.8rem; font-size:0.75rem; color:${p.agotado ? 'var(--gold-light)' : 'var(--text-muted)'}; border-color:var(--border-subtle);">
                ${p.agotado ? 'Marcar disponible' : 'Marcar agotado'}
              </button>
              <button class="card-action-btn btn-toggle-status" data-id="${p.id}" data-activo="false" style="padding:0.4rem 0.8rem; font-size:0.75rem; color:#ff8585; border-color:rgba(235,87,87,0.3);">
                Eliminar
              </button>
            ` : `
              <button class="card-action-btn btn-toggle-status" data-id="${p.id}" data-activo="true" style="padding:0.4rem 0.8rem; font-size:0.75rem; color:#6fcf97; border-color:rgba(39,174,96,0.3);">
                Restaurar
              </button>
              <button class="card-action-btn btn-delete-definitivo" data-id="${p.id}" style="padding:0.4rem 0.8rem; font-size:0.75rem; color:#ff5252; background:rgba(255,82,82,0.08); border-color:rgba(255,82,82,0.35);">
                Eliminar definitivo
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

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
