/**
 * Paupelus - Interactive Luxury Web Experience Engine
 */

import { supabaseClient } from './js/supabaseClient.js';

let CATALOG_PRODUCTS = [];

// Función para obtener productos activos desde Supabase
async function fetchProductos() {
  try {
    const { data, error } = await supabaseClient
      .from('productos')
      .select('*')
      .eq('activo', true)
      .eq('agotado', false);

    if (error) {
      console.error('Error al consultar productos en Supabase:', error);
      const container = document.getElementById('catalogGrid');
      if (container) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
            <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">Error al cargar el catálogo de productos.</p>
            <p style="font-size: 0.85rem;">Por favor intenta recargar la página más tarde.</p>
          </div>
        `;
      }
      return;
    }

    CATALOG_PRODUCTS = (data || []).map(row => {
      let tagLabel = 'Accesorio';
      if (row.categoria === 'pelucas') {
        tagLabel = row.subcategoria === 'lacefront' ? 'Peluca Lace Front' : 'Peluca Clásica';
      }

      return {
        id: row.id,
        category: row.categoria,
        subcategoria: row.subcategoria || null,
        tag: tagLabel,
        name: row.nombre,
        specs: [row.color, row.largo_cm ? `${row.largo_cm} cm` : null, row.tipo].filter(Boolean),
        price: row.precio,
        primaryImg: row.foto_url,
        secondaryImg: row.foto_url,
        description: row.descripcion || '',
        videoUrl: row.video_url || null
      };
    });
  } catch (err) {
    console.error('Error inesperado al conectar con Supabase:', err);
    const container = document.getElementById('catalogGrid');
    if (container) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">Error al conectar con el servidor.</p>
          <p style="font-size: 0.85rem;">Por favor intenta recargar la página más tarde.</p>
        </div>
      `;
    }
  }
}

// Estado del Carrito con persistencia en localStorage
let cart = JSON.parse(localStorage.getItem('paupelus_cart') || '[]');

function saveCart() {
  localStorage.setItem('paupelus_cart', JSON.stringify(cart));
}

// Formateador de moneda en pesos colombianos
function formatPrice(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(amount);
}

// Render del catálogo interactivo
function renderCatalog(filter = 'all', searchQuery = '', subcategoria = '') {
  const container = document.getElementById('catalogGrid');
  if (!container) return;

  const filtered = CATALOG_PRODUCTS.filter(item => {
    const matchesCategory = filter === 'all' || item.category === filter;
    const matchesSubcategoria = !subcategoria || item.subcategoria === subcategoria;
    const matchesFilter = matchesCategory && matchesSubcategoria;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.specs.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">No se encontraron piezas con ese criterio.</p>
        <p style="font-size: 0.85rem;">Prueba explorando todas las categorías o borra el término de búsqueda.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    let categoryLabel = 'Accesorio Especializado';
    if (item.category === 'pelucas') {
      if (item.subcategoria === 'seminatural') {
        categoryLabel = 'Peluca Clásica';
      } else if (item.subcategoria === 'lacefront') {
        categoryLabel = 'Peluca Lace Front';
      } else {
        categoryLabel = 'Peluca Clásica';
      }
    }

    return `
    <article class="product-card reveal" data-category="${item.category}" data-id="${item.id}">
      <div class="card-media-wrap" onclick="openProductModal('${item.id}')">
        <span class="card-badge">${item.tag}</span>
        <img class="card-img-primary" src="${item.primaryImg}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='logo dorado transparente.png'">
        <img class="card-img-secondary" src="${item.secondaryImg}" alt="${item.name} detalle" loading="lazy" onerror="this.onerror=null; this.src='logo dorado transparente.png'">
        
        <div class="card-quick-actions" onclick="event.stopPropagation()">
          <button class="card-action-btn" onclick="openProductModal('${item.id}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            Vista Rápida
          </button>
          <button class="card-action-btn" onclick="addToCart('${item.id}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            Agregar
          </button>
        </div>
      </div>

      <div class="card-details">
        <div class="card-category">${categoryLabel}</div>
        <h3 class="card-title">${item.name}</h3>
        
        <div class="card-specs">
          ${item.specs.slice(0, 3).map(s => `<span class="spec-pill">${s}</span>`).join('')}
        </div>

        <div class="card-footer-row">
          <div class="card-price">${formatPrice(item.price)}</div>
          <button class="card-btn-add" title="Agregar a la selección" onclick="addToCart('${item.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>
      </div>
    </article>
  `;
  }).join('');

  initScrollReveal();
}

// Operaciones del Carrito
function addToCart(productId) {
  const item = CATALOG_PRODUCTS.find(p => p.id === productId);
  if (!item) return;

  const existing = cart.find(ci => ci.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      primaryImg: item.primaryImg,
      qty: 1
    });
  }

  saveCart();
  updateCartUI();
  openCartDrawer();
}

function updateCartQty(productId, delta) {
  const itemIndex = cart.findIndex(ci => ci.id === productId);
  if (itemIndex > -1) {
    cart[itemIndex].qty += delta;
    if (cart[itemIndex].qty <= 0) {
      cart.splice(itemIndex, 1);
    }
  }
  saveCart();
  updateCartUI();
}

function updateCartUI() {
  const countBadge = document.getElementById('cartCount');
  const itemsContainer = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('cartSubtotal');

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if (countBadge) countBadge.innerText = totalItems;
  if (subtotalEl) subtotalEl.innerText = formatPrice(totalAmount);

  if (!itemsContainer) return;

  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="empty-cart-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        <p>Tu selección está vacía.</p>
        <p style="font-size: 0.8rem; margin-top: 0.4rem;">Descubre piezas únicas en nuestro catálogo</p>
      </div>
    `;
    return;
  }

  itemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.primaryImg}" alt="${item.name}" class="cart-item-img" onerror="this.onerror=null; this.src='logo dorado transparente.png'">
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <span>${formatPrice(item.price)}</span>
        <div class="cart-qty-ctrl">
          <button onclick="updateCartQty('${item.id}', -1)" aria-label="Disminuir cantidad">−</button>
          <span>${item.qty}</span>
          <button onclick="updateCartQty('${item.id}', 1)" aria-label="Aumentar cantidad">+</button>
        </div>
      </div>
      <div style="font-weight: 600; font-size: 0.9rem; color: var(--gold-light);">
        ${formatPrice(item.price * item.qty)}
      </div>
    </div>
  `).join('');
}

function openCartDrawer() {
  document.getElementById('cartDrawer')?.classList.add('open');
  document.getElementById('cartOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  document.getElementById('cartDrawer')?.classList.remove('open');
  document.getElementById('cartOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// Variable en memoria de la sesión para el flujo de Checkout en 2 Pasos
let checkoutData = {
  pasoActual: 1,
  nombre: '',
  cedula: '',
  celular: '',
  direccion: '',
  ciudad: '',
  abono: 0,
  saldo: 0,
  totalCarrito: 0,
  pagarTodo: false,
  montoAPagar: 0,
  formaPago: '',
  items: []
};

// Apertura del modal de Checkout
function openCheckoutModal() {
  if (!cart || cart.length === 0) {
    alert('Tu carrito está vacío. Agrega tus piezas favoritas antes de ordenar.');
    return;
  }

  // Cerrar drawer del carrito para un flujo visual ordenado
  closeCartDrawer();

  const modal = document.getElementById('checkoutModal');
  const step1Form = document.getElementById('checkoutFormStep1');
  const step2Cont = document.getElementById('checkoutStep2');
  const step1Badge = document.getElementById('step1Badge');
  const step2Badge = document.getElementById('step2Badge');
  const titleEl = document.getElementById('checkoutStepTitle');
  const subtitleEl = document.getElementById('checkoutStepSubtitle');
  const errorMsg = document.getElementById('checkoutErrorMsg');

  if (errorMsg) {
    errorMsg.style.display = 'none';
    errorMsg.innerText = '';
  }

  // Pre-llenar campos del Paso 1 con datos guardados de un intento anterior si existen
  const nombreInput = document.getElementById('checkoutNombre');
  const cedulaInput = document.getElementById('checkoutCedula');
  const celularInput = document.getElementById('checkoutCelular');
  const direccionInput = document.getElementById('checkoutDireccion');
  const ciudadInput = document.getElementById('checkoutCiudad');

  if (nombreInput && checkoutData.nombre) nombreInput.value = checkoutData.nombre;
  if (cedulaInput && checkoutData.cedula) cedulaInput.value = checkoutData.cedula;
  if (celularInput && checkoutData.celular) celularInput.value = checkoutData.celular;
  if (direccionInput && checkoutData.direccion) direccionInput.value = checkoutData.direccion;
  if (ciudadInput && checkoutData.ciudad) ciudadInput.value = checkoutData.ciudad;

  // Actualizar montos en checkoutData con el total vigente del carrito
  const totalCarrito = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  checkoutData.totalCarrito = totalCarrito;
  if (checkoutData.ciudad) {
    const ciudadNorm = checkoutData.ciudad.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    checkoutData.abono = ciudadNorm.includes('bogota') ? 10000 : 25000;
    checkoutData.saldo = Math.max(0, totalCarrito - checkoutData.abono);
    checkoutData.montoAPagar = checkoutData.pagarTodo ? totalCarrito : checkoutData.abono;
  }
  checkoutData.items = [...cart];

  // Si el cliente había llegado hasta el Paso 2 (ya había dado "Continuar"),
  // al reabrir el modal debe abrir directo en el Paso 2
  if (checkoutData.pasoActual === 2) {
    if (step1Form) step1Form.style.display = 'none';
    if (step2Cont) step2Cont.style.display = 'block';
    if (step1Badge) step1Badge.classList.remove('active');
    if (step2Badge) step2Badge.classList.add('active');
    if (titleEl) titleEl.innerText = 'Confirmación de Pedido';
    if (subtitleEl) subtitleEl.innerText = 'Revisa los detalles de tu orden y método de pago.';
    renderCheckoutStep2();
  } else {
    // Abrir en Paso 1
    if (step1Form) step1Form.style.display = 'block';
    if (step2Cont) step2Cont.style.display = 'none';
    if (step1Badge) step1Badge.classList.add('active');
    if (step2Badge) step2Badge.classList.remove('active');
    if (titleEl) titleEl.innerText = 'Datos de Entrega';
    if (subtitleEl) subtitleEl.innerText = 'Ingresa tus datos personales para coordinar el envío y abono de tu orden.';
  }

  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

// Cierre del modal y reseteo TOTAL (usado por la X, tecla Escape y tras enviar a WhatsApp)
function closeCheckoutModal() {
  const modal = document.getElementById('checkoutModal');
  const step1Form = document.getElementById('checkoutFormStep1');
  const step2Cont = document.getElementById('checkoutStep2');
  const step1Badge = document.getElementById('step1Badge');
  const step2Badge = document.getElementById('step2Badge');
  const errorMsg = document.getElementById('checkoutErrorMsg');

  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Reseteo de formulario y estado visual
  if (step1Form) {
    step1Form.reset();
    step1Form.style.display = 'block';
  }
  if (step2Cont) {
    step2Cont.style.display = 'none';
  }
  if (step1Badge) step1Badge.classList.add('active');
  if (step2Badge) step2Badge.classList.remove('active');
  if (errorMsg) {
    errorMsg.style.display = 'none';
    errorMsg.innerText = '';
  }

  // Resetea campos del paso 2
  const payAllWrap = document.getElementById('checkoutPayAllWrap');
  const pagarTodoCheckbox = document.getElementById('checkoutPagarTodo');
  const selectMethod = document.getElementById('checkoutPaymentMethod');
  const boxTransferencia = document.getElementById('paymentContentTransferencia');
  const boxTarjeta = document.getElementById('paymentContentTarjeta');
  if (payAllWrap) payAllWrap.style.display = 'flex';
  if (pagarTodoCheckbox) pagarTodoCheckbox.checked = false;
  if (selectMethod) selectMethod.value = '';
  if (boxTransferencia) boxTransferencia.style.display = 'none';
  if (boxTarjeta) boxTarjeta.style.display = 'none';

  // Resetea datos guardados en memoria de la sesión
  checkoutData = {
    pasoActual: 1,
    nombre: '',
    cedula: '',
    celular: '',
    direccion: '',
    ciudad: '',
    abono: 0,
    saldo: 0,
    totalCarrito: 0,
    pagarTodo: false,
    montoAPagar: 0,
    formaPago: '',
    items: []
  };
}

// Cierre temporal del modal CONSERVANDO los datos (usado por botón "← Atrás" del Paso 1 y click de overlay)
function hideCheckoutModalKeepData() {
  // Guarda lo que el usuario haya escrito en los inputs del Paso 1 para conservarlo
  const nombreInput = document.getElementById('checkoutNombre');
  const cedulaInput = document.getElementById('checkoutCedula');
  const celularInput = document.getElementById('checkoutCelular');
  const direccionInput = document.getElementById('checkoutDireccion');
  const ciudadInput = document.getElementById('checkoutCiudad');

  if (nombreInput && nombreInput.value) checkoutData.nombre = nombreInput.value.trim();
  if (cedulaInput && cedulaInput.value) checkoutData.cedula = cedulaInput.value.trim();
  if (celularInput && celularInput.value) checkoutData.celular = celularInput.value.trim();
  if (direccionInput && direccionInput.value) checkoutData.direccion = direccionInput.value.trim();
  if (ciudadInput && ciudadInput.value) checkoutData.ciudad = ciudadInput.value.trim();

  const modal = document.getElementById('checkoutModal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Validación del Paso 1 y avance a Paso 2
function handleCheckoutStep1Submit(e) {
  e.preventDefault();

  const errorMsg = document.getElementById('checkoutErrorMsg');
  const nombreInput = document.getElementById('checkoutNombre');
  const cedulaInput = document.getElementById('checkoutCedula');
  const celularInput = document.getElementById('checkoutCelular');
  const direccionInput = document.getElementById('checkoutDireccion');
  const ciudadInput = document.getElementById('checkoutCiudad');

  if (errorMsg) {
    errorMsg.style.display = 'none';
    errorMsg.innerText = '';
  }

  const nombre = nombreInput?.value.trim() || '';
  const cedula = cedulaInput?.value.trim() || '';
  const celularRaw = celularInput?.value.trim() || '';
  const direccion = direccionInput?.value.trim() || '';
  const ciudad = ciudadInput?.value.trim() || '';

  // 1. Valida que todos los campos estén llenos
  if (!nombre || !cedula || !celularRaw || !direccion || !ciudad) {
    if (errorMsg) {
      errorMsg.style.display = 'block';
      errorMsg.innerText = 'Por favor completa todos los campos requeridos.';
    }
    return;
  }

  // 2. Cédula: solo números
  if (!/^\d+$/.test(cedula)) {
    if (errorMsg) {
      errorMsg.style.display = 'block';
      errorMsg.innerText = 'La cédula debe contener únicamente números.';
    }
    cedulaInput?.focus();
    return;
  }

  // 3. Celular: mínimo 10 dígitos numéricos
  const cleanCelular = celularRaw.replace(/[\s\-\(\)\+\.]/g, '');
  if (!/^\d{10,}$/.test(cleanCelular)) {
    if (errorMsg) {
      errorMsg.style.display = 'block';
      errorMsg.innerText = 'El número de celular debe tener al menos 10 dígitos numéricos.';
    }
    celularInput?.focus();
    return;
  }

  // 4. Si la ciudad (en minúsculas, sin tildes) contiene "bogota", abono = 10000; si no, 25000
  const ciudadNorm = ciudad
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const abono = ciudadNorm.includes('bogota') ? 10000 : 25000;

  // 5. Calcula saldo = total del carrito - abono
  const totalCarrito = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const saldo = Math.max(0, totalCarrito - abono);

  // 6. Guarda todos estos datos en variables (en memoria de la sesión)
  checkoutData.nombre = nombre;
  checkoutData.cedula = cedula;
  checkoutData.celular = cleanCelular;
  checkoutData.direccion = direccion;
  checkoutData.ciudad = ciudad;
  checkoutData.abono = abono;
  checkoutData.saldo = saldo;
  checkoutData.totalCarrito = totalCarrito;
  checkoutData.pasoActual = 2;
  if (checkoutData.pagarTodo === undefined) checkoutData.pagarTodo = false;
  checkoutData.montoAPagar = checkoutData.pagarTodo ? totalCarrito : abono;
  checkoutData.items = [...cart];

  // 7. Avanza al PASO 2 (oculta paso 1, muestra paso 2 dentro del mismo modal)
  const step1Form = document.getElementById('checkoutFormStep1');
  const step2Cont = document.getElementById('checkoutStep2');
  const step1Badge = document.getElementById('step1Badge');
  const step2Badge = document.getElementById('step2Badge');
  const titleEl = document.getElementById('checkoutStepTitle');
  const subtitleEl = document.getElementById('checkoutStepSubtitle');

  if (step1Form) step1Form.style.display = 'none';
  if (step2Cont) step2Cont.style.display = 'block';
  if (step1Badge) step1Badge.classList.remove('active');
  if (step2Badge) step2Badge.classList.add('active');
  if (titleEl) titleEl.innerText = 'Confirmación de Pedido';
  if (subtitleEl) subtitleEl.innerText = 'Revisa los detalles de tu orden y método de pago.';

  // Renderizar datos del Paso 2
  renderCheckoutStep2();
}

// Renderizado y sincronización visual del Paso 2
function renderCheckoutStep2() {
  const payAllWrap = document.getElementById('checkoutPayAllWrap');
  const pagarTodoCheckbox = document.getElementById('checkoutPagarTodo');
  const labelMonto = document.getElementById('step2LabelMonto');
  const valorAbono = document.getElementById('step2ValorAbono');
  const valorSaldo = document.getElementById('step2ValorSaldo');
  const selectMethod = document.getElementById('checkoutPaymentMethod');
  const boxTransferencia = document.getElementById('paymentContentTransferencia');
  const boxTarjeta = document.getElementById('paymentContentTarjeta');
  const transferMontoBold = document.getElementById('transferMontoBold');

  if (pagarTodoCheckbox) {
    pagarTodoCheckbox.checked = Boolean(checkoutData.pagarTodo);
  }

  // Pre-seleccionar forma de pago si ya se había elegido anteriormente
  if (selectMethod) {
    selectMethod.value = checkoutData.formaPago || '';
  }

  if (checkoutData.formaPago === 'tarjeta') {
    // Tarjeta de crédito: ocultar checkbox, pagar todo, saldo $0
    if (payAllWrap) payAllWrap.style.display = 'none';
    checkoutData.montoAPagar = checkoutData.totalCarrito;
    if (labelMonto) labelMonto.innerText = 'Total del Pedido';
    if (valorAbono) valorAbono.innerText = formatPrice(checkoutData.totalCarrito);
    if (valorSaldo) valorSaldo.innerText = formatPrice(0);

    if (boxTarjeta) boxTarjeta.style.display = 'block';
    if (boxTransferencia) boxTransferencia.style.display = 'none';
  } else {
    // Transferencia u otra opción: mostrar checkbox y aplicar su estado
    if (payAllWrap) payAllWrap.style.display = 'flex';

    if (checkoutData.pagarTodo) {
      checkoutData.montoAPagar = checkoutData.totalCarrito;
      if (labelMonto) labelMonto.innerText = 'Total del Pedido';
      if (valorAbono) valorAbono.innerText = formatPrice(checkoutData.totalCarrito);
      if (valorSaldo) valorSaldo.innerText = formatPrice(0);
    } else {
      checkoutData.montoAPagar = checkoutData.abono;
      if (labelMonto) labelMonto.innerText = 'Abono Inicial';
      if (valorAbono) valorAbono.innerText = formatPrice(checkoutData.abono);
      if (valorSaldo) valorSaldo.innerText = formatPrice(checkoutData.saldo);
    }

    if (transferMontoBold) {
      transferMontoBold.innerText = formatPrice(checkoutData.montoAPagar);
    }

    if (checkoutData.formaPago === 'transferencia') {
      if (boxTransferencia) boxTransferencia.style.display = 'block';
      if (boxTarjeta) boxTarjeta.style.display = 'none';
    } else {
      if (boxTransferencia) boxTransferencia.style.display = 'none';
      if (boxTarjeta) boxTarjeta.style.display = 'none';
    }
  }
}

// Manejo del checkbox "Pagar todo de una vez"
function handlePagarTodoChange(e) {
  const checked = e.target.checked;
  checkoutData.pagarTodo = checked;
  checkoutData.montoAPagar = checked ? checkoutData.totalCarrito : checkoutData.abono;

  const labelMonto = document.getElementById('step2LabelMonto');
  const valorAbono = document.getElementById('step2ValorAbono');
  const valorSaldo = document.getElementById('step2ValorSaldo');
  const transferMontoBold = document.getElementById('transferMontoBold');

  if (checked) {
    if (labelMonto) labelMonto.innerText = 'Total del Pedido';
    if (valorAbono) valorAbono.innerText = formatPrice(checkoutData.totalCarrito);
    if (valorSaldo) valorSaldo.innerText = formatPrice(0);
  } else {
    if (labelMonto) labelMonto.innerText = 'Abono Inicial';
    if (valorAbono) valorAbono.innerText = formatPrice(checkoutData.abono);
    if (valorSaldo) valorSaldo.innerText = formatPrice(checkoutData.saldo);
  }

  if (transferMontoBold) {
    transferMontoBold.innerText = formatPrice(checkoutData.montoAPagar);
  }
}

// Manejo del selector desplegable de Forma de Pago
function handlePaymentMethodChange(e) {
  const method = e.target.value;
  checkoutData.formaPago = method;

  const payAllWrap = document.getElementById('checkoutPayAllWrap');
  const pagarTodoCheckbox = document.getElementById('checkoutPagarTodo');
  const labelMonto = document.getElementById('step2LabelMonto');
  const valorAbono = document.getElementById('step2ValorAbono');
  const valorSaldo = document.getElementById('step2ValorSaldo');
  const boxTransferencia = document.getElementById('paymentContentTransferencia');
  const boxTarjeta = document.getElementById('paymentContentTarjeta');
  const transferMontoBold = document.getElementById('transferMontoBold');

  if (method === 'tarjeta') {
    // 1. Al seleccionar "Tarjeta de crédito":
    // - Oculta el checkbox "Pagar todo de una vez"
    if (payAllWrap) payAllWrap.style.display = 'none';
    // - Fuerza montoAPagar = total del carrito y saldo = $0
    checkoutData.montoAPagar = checkoutData.totalCarrito;
    if (labelMonto) labelMonto.innerText = 'Total del Pedido';
    if (valorAbono) valorAbono.innerText = formatPrice(checkoutData.totalCarrito);
    if (valorSaldo) valorSaldo.innerText = formatPrice(0);

    if (boxTarjeta) boxTarjeta.style.display = 'block';
    if (boxTransferencia) boxTransferencia.style.display = 'none';
  } else if (method === 'transferencia') {
    // 2. Al volver a seleccionar "Transferencia":
    // - Vuelve a mostrar el checkbox "Pagar todo de una vez"
    if (payAllWrap) payAllWrap.style.display = 'flex';

    // - Recalcula montoAPagar y saldo según el estado del checkbox
    const isPagarTodo = pagarTodoCheckbox ? pagarTodoCheckbox.checked : Boolean(checkoutData.pagarTodo);
    checkoutData.pagarTodo = isPagarTodo;
    checkoutData.montoAPagar = isPagarTodo ? checkoutData.totalCarrito : checkoutData.abono;

    if (isPagarTodo) {
      if (labelMonto) labelMonto.innerText = 'Total del Pedido';
      if (valorAbono) valorAbono.innerText = formatPrice(checkoutData.totalCarrito);
      if (valorSaldo) valorSaldo.innerText = formatPrice(0);
    } else {
      if (labelMonto) labelMonto.innerText = 'Abono Inicial';
      if (valorAbono) valorAbono.innerText = formatPrice(checkoutData.abono);
      if (valorSaldo) valorSaldo.innerText = formatPrice(checkoutData.saldo);
    }

    if (transferMontoBold) {
      transferMontoBold.innerText = formatPrice(checkoutData.montoAPagar);
    }

    if (boxTransferencia) boxTransferencia.style.display = 'block';
    if (boxTarjeta) boxTarjeta.style.display = 'none';
  } else {
    if (boxTransferencia) boxTransferencia.style.display = 'none';
    if (boxTarjeta) boxTarjeta.style.display = 'none';
  }
}

// Volver del Paso 2 al Paso 1 (conserva los datos)
function returnToCheckoutStep1() {
  checkoutData.pasoActual = 1;

  const step1Form = document.getElementById('checkoutFormStep1');
  const step2Cont = document.getElementById('checkoutStep2');
  const step1Badge = document.getElementById('step1Badge');
  const step2Badge = document.getElementById('step2Badge');
  const titleEl = document.getElementById('checkoutStepTitle');
  const subtitleEl = document.getElementById('checkoutStepSubtitle');

  // Asegurar que los inputs del paso 1 sigan teniendo los valores guardados
  const nombreInput = document.getElementById('checkoutNombre');
  const cedulaInput = document.getElementById('checkoutCedula');
  const celularInput = document.getElementById('checkoutCelular');
  const direccionInput = document.getElementById('checkoutDireccion');
  const ciudadInput = document.getElementById('checkoutCiudad');

  if (nombreInput && checkoutData.nombre) nombreInput.value = checkoutData.nombre;
  if (cedulaInput && checkoutData.cedula) cedulaInput.value = checkoutData.cedula;
  if (celularInput && checkoutData.celular) celularInput.value = checkoutData.celular;
  if (direccionInput && checkoutData.direccion) direccionInput.value = checkoutData.direccion;
  if (ciudadInput && checkoutData.ciudad) ciudadInput.value = checkoutData.ciudad;

  if (step1Form) step1Form.style.display = 'block';
  if (step2Cont) step2Cont.style.display = 'none';
  if (step1Badge) step1Badge.classList.add('active');
  if (step2Badge) step2Badge.classList.remove('active');
  if (titleEl) titleEl.innerText = 'Datos de Entrega';
  if (subtitleEl) subtitleEl.innerText = 'Ingresa tus datos personales para coordinar el envío y abono de tu orden.';
}

// Enviar pedido estructurado a WhatsApp y vaciar carrito
function sendOrderToWhatsApp(formaPago) {
  const items = (checkoutData.items && checkoutData.items.length > 0) ? checkoutData.items : cart;
  if (!items || items.length === 0) {
    alert('Tu carrito está vacío.');
    return;
  }

  let text = '✨ *¡Hola Paupelus! He confirmado mi pedido:* \n\n';

  text += '🛍️ *Artículos solicitados:*\n';
  items.forEach((item, index) => {
    text += `${index + 1}. *${item.name}* (x${item.qty}) - ${formatPrice(item.price * item.qty)}\n`;
  });

  text += `\n💎 *Total del Pedido:* ${formatPrice(checkoutData.totalCarrito)}\n\n`;

  text += '👤 *Datos del cliente:*\n';
  text += `• *Nombre:* ${checkoutData.nombre}\n`;
  text += `• *Cédula:* ${checkoutData.cedula}\n`;
  text += `• *Celular:* ${checkoutData.celular}\n`;
  text += `• *Dirección:* ${checkoutData.direccion}\n`;
  text += `• *Ciudad:* ${checkoutData.ciudad}\n\n`;

  const esTarjeta = (formaPago === 'Tarjeta de crédito');
  const montoFinal = esTarjeta ? checkoutData.totalCarrito : checkoutData.montoAPagar;
  const saldoFinal = esTarjeta ? 0 : (checkoutData.pagarTodo ? 0 : checkoutData.saldo);
  const detalleMonto = esTarjeta ? ' (Pago completo)' : (checkoutData.pagarTodo ? ' (Pago completo)' : ' (Abono inicial)');

  text += '💳 *Detalles del pago:*\n';
  text += `• *Forma de pago:* ${formaPago}\n`;
  text += `• *Monto a pagar ahora:* ${formatPrice(montoFinal)}${detalleMonto}\n`;
  text += `• *Saldo pendiente:* ${formatPrice(saldoFinal)}\n\n`;

  if (formaPago === 'Transferencia') {
    text += '📸 *Importante:* Una vez realices la transferencia, envíanos por este mismo chat la captura de pantalla del comprobante para confirmar tu pedido más rápido. ¡Gracias!\n\n';
  }

  text += '📍 *Por favor confírmenme la recepción del pedido y despacho. ¡Muchas gracias!*';

  const encoded = encodeURIComponent(text);
  const waUrl = `https://wa.me/573185182292?text=${encoded}`;
  window.open(waUrl, '_blank');

  // Cierra el modal y vacía el carrito
  closeCheckoutModal();
  cart = [];
  saveCart();
  updateCartUI();
}

// Lightbox Modal para Vista Detallada
function openProductModal(productId) {
  const item = CATALOG_PRODUCTS.find(p => String(p.id) === String(productId));
  if (!item) return;

  const modal = document.getElementById('lightboxModal');
  const imgEl = document.getElementById('lightboxImg');
  const tagEl = document.getElementById('lightboxTag');
  const titleEl = document.getElementById('lightboxTitle');
  const priceEl = document.getElementById('lightboxPrice');
  const descEl = document.getElementById('lightboxDesc');
  const specsEl = document.getElementById('lightboxSpecs');
  const addBtn = document.getElementById('lightboxAddBtn');

  if (!modal) return;

  let modalTag = 'Accesorio Especializado';
  if (item.category === 'pelucas') {
    if (item.subcategoria === 'seminatural') {
      modalTag = 'Peluca Clásica';
    } else if (item.subcategoria === 'lacefront') {
      modalTag = 'Peluca Lace Front';
    } else {
      modalTag = 'Peluca Clásica';
    }
  }

  // Foto principal siempre visible
  if (imgEl) {
    imgEl.src = item.primaryImg;
    imgEl.style.display = 'block';
  }

  tagEl.innerText = modalTag;
  titleEl.innerText = item.name;
  priceEl.innerText = formatPrice(item.price);

  // Manejo condicional de descripción
  if (item.description && item.description.trim() !== '') {
    descEl.innerText = item.description;
    descEl.style.display = 'block';
  } else {
    descEl.style.display = 'none';
  }

  // Manejo de pestañas multimedia (Foto / Video)
  const tabFotoBtn = document.getElementById('tabFotoBtn');
  const tabVideoBtn = document.getElementById('tabVideoBtn');
  const paneFoto = document.getElementById('paneFoto');
  const paneVideo = document.getElementById('paneVideo');
  const videoPoster = document.getElementById('lightboxVideoPoster');
  const videoOverlay = document.getElementById('lightboxVideoOverlay');
  const videoEl = document.getElementById('lightboxVideo');
  const playBtn = document.getElementById('lightboxPlayBtn');

  // Función para alternar pestañas
  function activarTab(tab) {
    if (tab === 'video') {
      tabFotoBtn?.classList.remove('active');
      tabVideoBtn?.classList.add('active');
      paneFoto?.classList.remove('active');
      paneVideo?.classList.add('active');
    } else {
      tabVideoBtn?.classList.remove('active');
      tabFotoBtn?.classList.add('active');
      paneVideo?.classList.remove('active');
      paneFoto?.classList.add('active');
      if (videoEl) {
        videoEl.pause();
      }
    }
  }

  // Configuración de video
  if (videoEl) {
    videoEl.pause();
    videoEl.currentTime = 0;
    videoEl.style.display = 'none';

    if (item.videoUrl) {
      videoEl.src = item.videoUrl;
      if (videoPoster) {
        videoPoster.src = item.primaryImg;
        videoPoster.style.display = 'block';
      }
      if (videoOverlay) {
        videoOverlay.style.display = 'flex';
      }
      if (tabVideoBtn) {
        tabVideoBtn.style.display = 'inline-flex';
      }

      if (playBtn) {
        playBtn.onclick = (e) => {
          e.stopPropagation();
          if (videoPoster) videoPoster.style.display = 'none';
          if (videoOverlay) videoOverlay.style.display = 'none';
          videoEl.style.display = 'block';
          videoEl.play().catch(err => {
            console.warn('Auto-play preventivo:', err);
          });
        };
      }
    } else {
      videoEl.src = '';
      if (videoPoster) videoPoster.src = '';
      if (tabVideoBtn) {
        tabVideoBtn.style.display = 'none';
      }
      if (playBtn) playBtn.onclick = null;
    }
  }

  // Conectar listeners de pestañas
  if (tabFotoBtn) {
    tabFotoBtn.onclick = () => activarTab('foto');
  }
  if (tabVideoBtn) {
    tabVideoBtn.onclick = () => activarTab('video');
  }

  // Siempre abrir por defecto en la pestaña FOTO
  activarTab('foto');

  specsEl.innerHTML = item.specs.map(s => `<span class="spec-pill">${s}</span>`).join('');

  addBtn.onclick = () => {
    addToCart(item.id);
    closeProductModal();
  };

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  const modal = document.getElementById('lightboxModal');
  const tabFotoBtn = document.getElementById('tabFotoBtn');
  const tabVideoBtn = document.getElementById('tabVideoBtn');
  const paneFoto = document.getElementById('paneFoto');
  const paneVideo = document.getElementById('paneVideo');
  const videoEl = document.getElementById('lightboxVideo');
  const videoPoster = document.getElementById('lightboxVideoPoster');
  const videoOverlay = document.getElementById('lightboxVideoOverlay');

  if (videoEl) {
    videoEl.pause();
    videoEl.currentTime = 0;
    videoEl.style.display = 'none';
  }

  // Restaurar poster y overlay para la próxima apertura
  if (videoPoster) {
    videoPoster.style.display = 'block';
  }
  if (videoOverlay) {
    videoOverlay.style.display = 'flex';
  }

  // Resetear a pestaña FOTO
  tabVideoBtn?.classList.remove('active');
  tabFotoBtn?.classList.add('active');
  paneVideo?.classList.remove('active');
  paneFoto?.classList.add('active');

  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Scroll Reveal con IntersectionObserver
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => observer.observe(el));
}

// Sanitización básica para HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Renderizado de las 4 tarjetas de "Paupelus en Acción"
function renderReels(reelsList = []) {
  const container = document.getElementById('socialReelsGrid');
  if (!container) return;

  const defaultPlatforms = ['TikTok', 'Instagram', 'TikTok', 'Instagram'];
  let html = '';

  for (let pos = 1; pos <= 4; pos++) {
    const reel = (reelsList || []).find(r => Number(r.posicion) === pos);
    const hasReel = Boolean(reel && (reel.titulo || reel.link || reel.portada_url));

    const plataforma = (hasReel && reel.plataforma) ? reel.plataforma : defaultPlatforms[pos - 1];
    const titulo = (hasReel && reel.titulo) ? reel.titulo : 'Próximamente';
    const link = (hasReel && reel.link) ? reel.link.trim() : '';
    const hasValidLink = Boolean(link && /^https?:\/\//i.test(link));

    // Portada: imagen personalizada si existe portada_url, de lo contrario fondo degradado oscuro con logo dorado
    let mediaCoverHtml = '';
    if (hasReel && reel.portada_url) {
      mediaCoverHtml = `<img src="${escapeHtml(reel.portada_url)}" alt="${escapeHtml(titulo)}" class="reel-cover" onerror="this.onerror=null; this.src='logo dorado transparente.png'">`;
    } else {
      mediaCoverHtml = `
        <div class="reel-cover" style="display:flex; align-items:center; justify-content:center; background: radial-gradient(circle at center, #241c28 0%, #0c0b0f 85%);">
          <img src="logo dorado transparente.png" alt="Paupelus" style="width: 75px; height: 75px; object-fit: contain; opacity: 0.28; filter: drop-shadow(0 2px 8px rgba(230,200,135,0.2));">
        </div>
      `;
    }

    const cardContent = `
      <div class="reel-media-wrap">
        ${mediaCoverHtml}
        <div class="reel-overlay">
          <div class="reel-top">
            <span class="reel-platform-tag">${escapeHtml(plataforma)}</span>
          </div>
          <div class="reel-play-btn" title="Reproducir">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>
          <div class="reel-bottom">
            <p class="reel-caption">${escapeHtml(titulo)}</p>
          </div>
        </div>
      </div>
    `;

    if (hasValidLink) {
      html += `
        <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="reel-card reveal" style="text-decoration:none; display:block; color:inherit; cursor:pointer;" title="${escapeHtml(titulo)}">
          ${cardContent}
        </a>
      `;
    } else {
      html += `
        <article class="reel-card reveal" style="cursor:default;">
          ${cardContent}
        </article>
      `;
    }
  }

  container.innerHTML = html;
  initScrollReveal();
}

// Obtener los 4 reels desde Supabase ordenados por posicion
async function fetchReels() {
  try {
    const { data, error } = await supabaseClient
      .from('reels')
      .select('*')
      .order('posicion', { ascending: true });

    if (error) {
      console.error('Error al consultar reels en Supabase:', error);
      renderReels([]);
      return;
    }

    renderReels(data || []);
  } catch (err) {
    console.error('Error inesperado al consultar reels:', err);
    renderReels([]);
  }
}

// Memoria local de videos de galería
let GALERIA_VIDEOS = [];

// Obtener videos activos de la galería desde Supabase
async function fetchGaleria() {
  try {
    const { data, error } = await supabaseClient
      .from('videos_promocionales')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error al consultar videos_promocionales en Supabase:', error);
      renderGaleria([]);
      return;
    }

    GALERIA_VIDEOS = data || [];
    renderGaleria(GALERIA_VIDEOS);
  } catch (err) {
    console.error('Error inesperado al consultar galería:', err);
    renderGaleria([]);
  }
}

// Renderizado de tarjetas de la galería
function renderGaleria(videos = []) {
  const container = document.getElementById('galleryGrid');
  if (!container) return;

  if (!videos || videos.length === 0) {
    container.innerHTML = `
      <div class="tutorials-placeholder-card" style="grid-column: 1 / -1; margin: 1rem auto 0;">
        <div class="tutorials-placeholder-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
        </div>
        <h3>Próximamente: Nuevos Videos</h3>
        <p>Estamos preparando nuevo contenido audiovisual exclusivo de nuestras piezas. ¡Vuelve a visitarnos pronto!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = videos.map(item => {
    const portada = item.portada_url || 'logo dorado transparente.png';
    const titulo = item.titulo || 'Video Exclusivo';
    const desc = item.descripcion || '';

    return `
      <article class="gallery-card reveal" onclick="openGalleryModal('${item.id}')" title="Reproducir: ${escapeHtml(titulo)}">
        <div class="gallery-card-media">
          <img src="${escapeHtml(portada)}" alt="${escapeHtml(titulo)}" class="gallery-card-cover" loading="lazy" onerror="this.onerror=null; this.src='logo dorado transparente.png';">
          <div class="gallery-card-overlay">
            <div class="gallery-card-badge">Paupelus Video</div>
            <div class="gallery-play-btn" aria-label="Reproducir video">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4"></polygon>
              </svg>
            </div>
            <div class="gallery-card-info">
              <h4 class="gallery-card-title">${escapeHtml(titulo)}</h4>
              ${desc ? `<p class="gallery-card-desc">${escapeHtml(desc)}</p>` : ''}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  initScrollReveal();
}

// Lightbox Modal para Videos de Galería (object-fit: contain, fondo negro, max-height 80vh)
function openGalleryModal(videoId) {
  const videoItem = GALERIA_VIDEOS.find(v => String(v.id) === String(videoId));
  if (!videoItem || !videoItem.video_url) return;

  const modal = document.getElementById('galleryLightboxModal');
  const videoEl = document.getElementById('galleryModalVideo');
  const titleEl = document.getElementById('galleryModalTitle');
  const descEl = document.getElementById('galleryModalDesc');

  if (!modal || !videoEl) return;

  if (titleEl) titleEl.innerText = videoItem.titulo || 'Video Paupelus';
  if (descEl) {
    if (videoItem.descripcion && videoItem.descripcion.trim()) {
      descEl.innerText = videoItem.descripcion;
      descEl.style.display = 'block';
    } else {
      descEl.innerText = '';
      descEl.style.display = 'none';
    }
  }

  videoEl.src = videoItem.video_url;
  if (videoItem.portada_url) {
    videoEl.poster = videoItem.portada_url;
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  videoEl.play().catch(err => {
    console.warn('Reproducción de video prevenida por política del navegador:', err);
  });
}

function closeGalleryModal() {
  const modal = document.getElementById('galleryLightboxModal');
  const videoEl = document.getElementById('galleryModalVideo');

  if (videoEl) {
    videoEl.pause();
    videoEl.currentTime = 0;
    videoEl.src = '';
  }

  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Eventos y escuchas al cargar el DOM
document.addEventListener('DOMContentLoaded', async () => {
  const catalogGrid = document.getElementById('catalogGrid');
  if (catalogGrid) {
    catalogGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--gold-light);">
        <p style="font-size: 1.1rem; letter-spacing: 0.05em;">Cargando catálogo...</p>
      </div>
    `;
  }

  await fetchProductos();
  fetchReels();
  fetchGaleria();
  renderCatalog('all');
  updateCartUI();

  // Apertura automática si existe el parámetro 'producto' en la URL
  const urlParams = new URLSearchParams(window.location.search);
  const productoId = urlParams.get('producto') || urlParams.get('peluca');
  if (productoId) {
    const itemEncontrado = CATALOG_PRODUCTS.find(p => String(p.id) === String(productoId));
    if (itemEncontrado) {
      openProductModal(itemEncontrado.id);
    }
  }

  // Función unificada para aplicar filtro y sincronizar controles
  function applyCatalogFilter(category = 'all', subcategoria = '') {
    const allFilterBtns = document.querySelectorAll('.filter-btn');
    allFilterBtns.forEach(b => {
      const bCat = b.getAttribute('data-category');
      const bSub = b.getAttribute('data-subcategoria') || '';
      if (category === 'all') {
        b.classList.toggle('active', bCat === 'all');
      } else {
        b.classList.toggle('active', bCat === category && (!subcategoria || bSub === subcategoria));
      }
    });

    // Sincronizar estado activo en items del dropdown desktop
    document.querySelectorAll('.nav-dropdown-item').forEach(dItem => {
      const dCat = dItem.getAttribute('data-category');
      const dSub = dItem.getAttribute('data-subcategoria') || '';
      dItem.classList.toggle('active', dCat === category && (!subcategoria || dSub === subcategoria));
    });

    const searchVal = document.getElementById('catalogSearch')?.value || '';
    renderCatalog(category, searchVal, subcategoria);

    const catalogoSection = document.getElementById('catalogo');
    if (catalogoSection) {
      catalogoSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Filtros de categoría y subcategoría (.filter-btn)
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const category = e.currentTarget.getAttribute('data-category');
      const subcategoria = e.currentTarget.getAttribute('data-subcategoria') || '';
      const searchVal = document.getElementById('catalogSearch')?.value || '';
      renderCatalog(category, searchVal, subcategoria);
    });
  });

  // Navegación de Escritorio: Dropdown Pelucas y Accesorios
  const navPelucasDropdownItem = document.getElementById('navPelucasDropdownItem');
  const navPelucasTrigger = document.getElementById('navPelucasTrigger');

  // Click en el trigger "PELUCAS" (Desktop): toggle del dropdown
  navPelucasTrigger?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = navPelucasDropdownItem?.classList.toggle('open');
    navPelucasTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Click en items del dropdown de Pelucas: Clásicas / Lace Front
  document.querySelectorAll('.nav-dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navPelucasDropdownItem?.classList.remove('open');
      navPelucasTrigger?.setAttribute('aria-expanded', 'false');

      const category = item.getAttribute('data-category') || 'pelucas';
      const subcategoria = item.getAttribute('data-subcategoria') || '';
      applyCatalogFilter(category, subcategoria);
    });
  });

  // Cerrar dropdown al hacer click fuera
  document.addEventListener('click', (e) => {
    if (navPelucasDropdownItem && !navPelucasDropdownItem.contains(e.target)) {
      navPelucasDropdownItem.classList.remove('open');
      navPelucasTrigger?.setAttribute('aria-expanded', 'false');
    }
  });

  // Click en "ACCESORIOS" (Nav Desktop): filtra directo por accesorios y hace scroll
  const navAccesorios = document.getElementById('navAccesoriosLink');
  navAccesorios?.addEventListener('click', (e) => {
    e.preventDefault();
    navPelucasDropdownItem?.classList.remove('open');
    navPelucasTrigger?.setAttribute('aria-expanded', 'false');
    applyCatalogFilter('accesorios', '');
  });

  // Click en "Colección" (Nav Desktop): resetea filtro a 'all' y hace scroll
  const navColeccion = document.getElementById('navColeccionLink');
  navColeccion?.addEventListener('click', (e) => {
    e.preventDefault();
    navPelucasDropdownItem?.classList.remove('open');
    navPelucasTrigger?.setAttribute('aria-expanded', 'false');
    applyCatalogFilter('all', '');
  });

  // Click en "GALERÍA" (Nav Desktop): scroll suave a la sección
  const navGaleria = document.getElementById('navGaleriaLink');
  navGaleria?.addEventListener('click', (e) => {
    navPelucasDropdownItem?.classList.remove('open');
    navPelucasTrigger?.setAttribute('aria-expanded', 'false');
    const targetSection = document.getElementById('galeria');
    if (targetSection) {
      e.preventDefault();
      targetSection.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Click en "TUTORIALES" (Nav Desktop): scroll suave a la sección
  const navTutoriales = document.getElementById('navTutorialesLink');
  navTutoriales?.addEventListener('click', (e) => {
    navPelucasDropdownItem?.classList.remove('open');
    navPelucasTrigger?.setAttribute('aria-expanded', 'false');
    const targetSection = document.getElementById('tutoriales');
    if (targetSection) {
      e.preventDefault();
      targetSection.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Búsqueda en vivo
  const searchInput = document.getElementById('catalogSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const activeBtn = document.querySelector('.filter-btn.active');
      const activeCategory = activeBtn?.getAttribute('data-category') || 'all';
      const activeSubcategoria = activeBtn?.getAttribute('data-subcategoria') || '';
      renderCatalog(activeCategory, e.target.value, activeSubcategoria);
    });
  }

  // Modales y Drawer
  // Menú Móvil Lateral de Categorías
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenuCloseBtn = document.getElementById('mobileMenuCloseBtn');
  const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');

  function openMobileMenu() {
    document.getElementById('mobileMenuDrawer')?.classList.add('open');
    document.getElementById('mobileMenuOverlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    document.getElementById('mobileMenuDrawer')?.classList.remove('open');
    document.getElementById('mobileMenuOverlay')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  mobileMenuBtn?.addEventListener('click', openMobileMenu);
  mobileMenuCloseBtn?.addEventListener('click', closeMobileMenu);
  mobileMenuOverlay?.addEventListener('click', closeMobileMenu);

  document.querySelectorAll('.mobile-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      closeMobileMenu();
      const targetId = item.getAttribute('data-target');
      if (targetId) {
        e.preventDefault();
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        const catalogoSection = document.getElementById('catalogo');
        if (catalogoSection) {
          catalogoSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  document.getElementById('lightboxClose')?.addEventListener('click', closeProductModal);
  document.getElementById('lightboxModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'lightboxModal') closeProductModal();
  });

  document.getElementById('galleryModalClose')?.addEventListener('click', closeGalleryModal);
  document.getElementById('galleryLightboxModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'galleryLightboxModal') closeGalleryModal();
  });

  document.getElementById('cartToggleBtn')?.addEventListener('click', openCartDrawer);
  document.getElementById('cartCloseBtn')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCartDrawer);
  // Modal de Checkout en 2 Pasos
  document.getElementById('checkoutWhatsAppBtn')?.addEventListener('click', openCheckoutModal);
  // La X: Cierra y resetea completamente el formulario y checkoutData
  document.getElementById('checkoutCloseBtn')?.addEventListener('click', closeCheckoutModal);
  // Botón "← Atrás": Conserva los datos y abre el carrito
  document.getElementById('checkoutBackBtn')?.addEventListener('click', () => {
    hideCheckoutModalKeepData();
    openCartDrawer();
  });
  // Click fuera del modal: cierra sin borrar datos
  document.getElementById('checkoutModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'checkoutModal') hideCheckoutModalKeepData();
  });
  document.getElementById('checkoutFormStep1')?.addEventListener('submit', handleCheckoutStep1Submit);

  // Paso 2: Checkbox pagar todo, medio de pago y envío de pedido
  document.getElementById('checkoutPagarTodo')?.addEventListener('change', handlePagarTodoChange);
  document.getElementById('checkoutPaymentMethod')?.addEventListener('change', handlePaymentMethodChange);
  document.getElementById('btnConfirmarTransferencia')?.addEventListener('click', () => sendOrderToWhatsApp('Transferencia'));
  document.getElementById('btnConfirmarTarjeta')?.addEventListener('click', () => sendOrderToWhatsApp('Tarjeta de crédito'));
  document.querySelectorAll('.btn-step2-back').forEach(btn => {
    btn.addEventListener('click', returnToCheckoutStep1);
  });

  // Restricción a solo números en el input de cédula
  document.getElementById('checkoutCedula')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '');
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProductModal();
      closeGalleryModal();
      closeCartDrawer();
      closeCheckoutModal();
      closeMobileMenu();
    }
  });

  // Formulario Club Paupelus (Suscripción WhatsApp a Lives)
  const clubForm = document.getElementById('clubPaupelusForm') || document.querySelector('.newsletter-form');
  const clubInput = document.getElementById('clubWhatsAppInput') || clubForm?.querySelector('input[type="tel"]');
  const clubMsg = document.getElementById('clubMsg');
  const clubSubmitBtn = document.getElementById('clubSubmitBtn') || clubForm?.querySelector('button[type="submit"]');

  clubForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (clubMsg) {
      clubMsg.style.display = 'none';
      clubMsg.innerText = '';
    }

    const rawValue = clubInput?.value || '';
    // Limpia espacios, guiones, paréntesis, puntos y signo +
    const cleanPhone = rawValue.replace(/[\s\-\(\)\+\.]/g, '');

    // Valida que tenga al menos 10 dígitos numéricos
    if (!/^\d{10,}$/.test(cleanPhone)) {
      if (clubMsg) {
        clubMsg.style.display = 'block';
        clubMsg.style.color = '#ff8585';
        clubMsg.innerText = 'Por favor ingresa un número de WhatsApp válido (mínimo 10 dígitos).';
      }
      return;
    }

    try {
      if (clubSubmitBtn) {
        clubSubmitBtn.disabled = true;
        clubSubmitBtn.innerText = 'Guardando...';
      }

      const { error } = await supabaseClient
        .from('suscriptores_live')
        .insert([{ telefono: cleanPhone }]);

      if (error) {
        throw error;
      }

      if (clubMsg) {
        clubMsg.style.display = 'block';
        clubMsg.style.color = '#6fcf97';
        clubMsg.innerText = '¡Listo! Te avisaremos por WhatsApp.';
      }

      if (clubInput) {
        clubInput.value = '';
      }
    } catch (err) {
      console.error('Error al suscribir en suscriptores_live:', err);
      if (clubMsg) {
        clubMsg.style.display = 'block';
        clubMsg.style.color = '#ff8585';
        clubMsg.innerText = 'Ocurrió un error al registrar tu número. Por favor intenta de nuevo.';
      }
    } finally {
      if (clubSubmitBtn) {
        clubSubmitBtn.disabled = false;
        clubSubmitBtn.innerText = 'Unirme';
      }
    }
  });

  window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 40) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  });
});

// Exposición global para callbacks inline de tarjetas y carrito
window.openProductModal = openProductModal;
window.openGalleryModal = openGalleryModal;
window.closeGalleryModal = closeGalleryModal;
window.addToCart = addToCart;
window.updateCartQty = updateCartQty;

