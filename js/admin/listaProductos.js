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
      listaProductosMemoria.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
    }

    const itemsAMostrar = listaProductosMemoria
      .filter(p => {
        return vistaActual === 'activos' ? p.activo : !p.activo;
      })
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

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
            <input type="number" class="input-numero-exhibicion" data-id="${p.id}" data-original-val="${p.numero_exhibicion ?? ''}" value="${p.numero_exhibicion ?? ''}" placeholder="N°" min="1" step="1" title="Número de Exhibición">
            <button class="card-action-btn btn-copiar-link" data-id="${p.id}">
              🔗 Copiar link
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
