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

// Checkout estructurado por WhatsApp
function checkoutWhatsApp() {
  if (cart.length === 0) {
    alert('Tu carrito está vacío. Agrega tus piezas favoritas antes de ordenar.');
    return;
  }

  let text = '✨ *¡Hola Paupelus! Deseo ordenar las siguientes piezas de su catálogo:* \n\n';
  let total = 0;

  cart.forEach((item, index) => {
    const sub = item.price * item.qty;
    total += sub;
    text += `${index + 1}. *${item.name}* (x${item.qty}) - ${formatPrice(sub)}\n`;
  });

  text += `\n💎 *Total Estimado:* ${formatPrice(total)}\n`;
  text += '📍 *Por favor indíquenme disponibilidad para envío inmediato y métodos de pago.*';

  const encoded = encodeURIComponent(text);
  const waUrl = `https://wa.me/573185182292?text=${encoded}`;
  window.open(waUrl, '_blank');
}

// Lightbox Modal para Vista Detallada
function openProductModal(productId) {
  const item = CATALOG_PRODUCTS.find(p => p.id === productId);
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
  renderCatalog('all');
  updateCartUI();

  // Apertura automática si existe el parámetro 'peluca' en la URL
  const urlParams = new URLSearchParams(window.location.search);
  const pelucaId = urlParams.get('peluca');
  if (pelucaId && CATALOG_PRODUCTS.some(p => p.id === pelucaId)) {
    openProductModal(pelucaId);
  }

  // Filtros de categoría y subcategoría
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
  document.getElementById('lightboxClose')?.addEventListener('click', closeProductModal);
  document.getElementById('lightboxModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'lightboxModal') closeProductModal();
  });

  document.getElementById('cartToggleBtn')?.addEventListener('click', openCartDrawer);
  document.getElementById('cartCloseBtn')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCartDrawer);
  document.getElementById('checkoutWhatsAppBtn')?.addEventListener('click', checkoutWhatsApp);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProductModal();
      closeCartDrawer();
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
window.addToCart = addToCart;
window.updateCartQty = updateCartQty;

