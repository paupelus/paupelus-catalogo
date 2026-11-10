// Cloudflare Pages Function: Proxy y optimización de imágenes para Open Graph y WhatsApp
// Ruta: /og-img/:id (ej: /og-img/6d124074-906e-4eec-8e36-710ccec1d808.jpg)
// Optimización:
// 1. Redimensiona a 800x800 cuadrado (1:1) en formato JPEG para forzar la tarjeta GRANDE en WhatsApp.
// 2. Mismo dominio que la web (paupelus-catalogo.pages.dev) sin bloqueos de x-robots-tag.
// 3. Caché de borde CDN en Cloudflare (max-age 7 días).

const SUPABASE_URL = 'https://iisvihpihhawfrtrrpkz.supabase.co';
const SUPABASE_KEY = 'sb_publishable__0Y98Ehh3nu42r2KLa3Xfg_RUSUpzyE';

export async function onRequest(context) {
  const { params, request } = context;
  const rawId = params.id || '';
  // Limpiar extensión .webp, .jpg, etc.
  const id = rawId.replace(/\.[^/.]+$/, '');

  if (!id) {
    return Response.redirect(new URL('/og-image.jpg', request.url).href, 302);
  }

  try {
    // 1. Buscar foto_url en Supabase
    const apiUrl = `${SUPABASE_URL}/rest/v1/productos?id=eq.${encodeURIComponent(id)}&select=foto_url&limit=1`;
    const sbRes = await fetch(apiUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!sbRes.ok) {
      return Response.redirect(new URL('/og-image.jpg', request.url).href, 302);
    }

    const items = await sbRes.json();
    if (!items || items.length === 0 || !items[0].foto_url) {
      return Response.redirect(new URL('/og-image.jpg', request.url).href, 302);
    }

    const fotoUrl = items[0].foto_url;

    // 2. Intentar obtener la versión cuadrada 800x800 optimizada mediante Supabase Render API
    // El formato cuadrado 1:1 con >= 300px es el que activa la vista previa GRANDE en WhatsApp móvil.
    let targetUrl = fotoUrl;
    if (fotoUrl.includes('/storage/v1/object/public/')) {
      targetUrl = fotoUrl.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=800&height=800';
    }

    let imgRes = await fetch(targetUrl);
    if (!imgRes.ok && targetUrl !== fotoUrl) {
      // Fallback a la foto original si el renderizador falla
      imgRes = await fetch(fotoUrl);
    }

    if (!imgRes.ok) {
      return Response.redirect(new URL('/og-image.jpg', request.url).href, 302);
    }

    // 3. Crear cabeceras limpias para WhatsApp y Meta Crawler
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=604800, s-maxage=2592000');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-Robots-Tag', 'all, index');

    const contentLength = imgRes.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    // Responder a solicitudes HEAD
    if (request.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers
      });
    }

    return new Response(imgRes.body, {
      status: 200,
      headers
    });

  } catch (err) {
    console.error('Error en proxy de imagen og-img:', err);
    return Response.redirect(new URL('/og-image.jpg', request.url).href, 302);
  }
}
