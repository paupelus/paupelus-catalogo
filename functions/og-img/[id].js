// Cloudflare Pages Function: Proxy de imágenes para Open Graph y WhatsApp
// Ruta: /og-img/:id (ej: /og-img/6d124074-906e-4eec-8e36-710ccec1d808.webp)
// Beneficios:
// 1. Mismo dominio que la web (paupelus-catalogo.pages.dev) para máxima confianza en WhatsApp / Meta.
// 2. Elimina la cabecera 'x-robots-tag: none' propia de Supabase Storage.
// 3. Caché de borde CDN en Cloudflare (max-age 7 días) para entrega ultra-rápida.

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

    // 2. Descargar la imagen desde Supabase Storage
    const imgRes = await fetch(fotoUrl);
    if (!imgRes.ok) {
      return Response.redirect(new URL('/og-image.jpg', request.url).href, 302);
    }

    // 3. Crear cabeceras limpias aptas para WhatsApp y Meta Scraper
    const contentType = imgRes.headers.get('content-type') || 'image/webp';
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=604800, s-maxage=2592000');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-Robots-Tag', 'all, index');

    const contentLength = imgRes.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    // Si la petición es HEAD, retornar sólo cabeceras sin cuerpo
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
