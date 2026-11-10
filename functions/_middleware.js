// Cloudflare Pages Functions Middleware
// Inyecta dinámicamente Open Graph meta tags para productos específicos (?producto=UUID o ?peluca=UUID)
// Permite que WhatsApp, Facebook, Instagram y Telegram muestren la foto real, nombre y precio de la peluca.

const SUPABASE_URL = 'https://iisvihpihhawfrtrrpkz.supabase.co';
const SUPABASE_KEY = 'sb_publishable__0Y98Ehh3nu42r2KLa3Xfg_RUSUpzyE';

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  const productoId = url.searchParams.get('producto') || url.searchParams.get('peluca');

  // Si no se solicita un producto o si es un archivo estático (css, js, imagenes, etc.), continuar sin intervenir
  if (!productoId || url.pathname.match(/\.(css|js|json|png|jpg|jpeg|webp|svg|ico|txt|xml|mp4)$/i)) {
    return next();
  }

  // Obtener la respuesta estática base (index.html)
  const response = await next();

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') || response.status !== 200) {
    return response;
  }

  try {
    // Consultar el producto en Supabase REST API
    const apiUrl = `${SUPABASE_URL}/rest/v1/productos?id=eq.${encodeURIComponent(productoId)}&select=id,nombre,precio,foto_url,descripcion,color,largo_cm,tipo,categoria,subcategoria&limit=1`;
    
    const sbRes = await fetch(apiUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!sbRes.ok) {
      return response;
    }

    const items = await sbRes.json();
    if (!items || items.length === 0) {
      return response;
    }

    const prod = items[0];

    // Construcción del título legible para WhatsApp
    let tag = 'Peluca';
    if (prod.categoria === 'pelucas') {
      tag = prod.subcategoria === 'lacefront' ? 'Peluca Lace Front' : 'Peluca Clásica';
    } else if (prod.categoria === 'accesorios') {
      tag = 'Accesorio Especializado';
    }

    const title = `${tag} ${prod.nombre || ''} | Paupelus Beauty`.replace(/\s+/g, ' ').trim();

    // Formatear precio colombiano (ej: $ 160.000 COP)
    let precioTexto = '';
    if (prod.precio) {
      try {
        const fmt = new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0
        }).format(prod.precio);
        precioTexto = `${fmt} COP`;
      } catch (e) {
        precioTexto = `$ ${prod.precio} COP`;
      }
    }

    // Especificaciones técnicas breves
    const specs = [
      prod.color,
      prod.largo_cm ? `${prod.largo_cm} cm` : '',
      prod.tipo
    ].filter(Boolean).join(' • ');

    // Descripción optimizada para vista previa de WhatsApp
    const descParts = [];
    if (precioTexto) descParts.push(precioTexto);
    if (specs) descParts.push(specs);
    if (prod.descripcion) descParts.push(prod.descripcion);
    descParts.push('¡Asesoría VIP y envíos a toda Colombia!');
    const description = descParts.join(' — ');

    // URL de la imagen optimizada (a través de nuestro endpoint proxy de Cloudflare en el mismo dominio)
    // Esto evita bloqueos de x-robots-tag y garantiza caché global ultra-rápido en Cloudflare
    const origin = url.origin.replace(/^http:/, 'https:');
    const canonicalUrl = url.href.replace(/^http:/, 'https:');
    const ogImageUrl = prod.foto_url 
      ? `${origin}/og-img/${encodeURIComponent(prod.id)}.jpg`
      : `${origin}/og-image.jpg`;

    // Reescritura al vuelo con HTMLRewriter de Cloudflare Workers
    const rewriter = new HTMLRewriter()
      .on('title', {
        element(e) {
          e.setInnerContent(title);
        }
      })
      .on('meta[name="description"]', {
        element(e) {
          e.setAttribute('content', description);
        }
      })
      .on('link[rel="canonical"]', {
        element(e) {
          e.setAttribute('href', canonicalUrl);
        }
      })
      .on('meta[property="og:title"]', {
        element(e) {
          e.setAttribute('content', title);
        }
      })
      .on('meta[property="og:description"]', {
        element(e) {
          e.setAttribute('content', description);
        }
      })
      .on('meta[property="og:image"]', {
        element(e) {
          e.setAttribute('content', ogImageUrl);
          e.after(`<meta property="og:image:secure_url" content="${ogImageUrl}">\n  <meta property="og:image:type" content="image/jpeg">`, { html: true });
        }
      })
      .on('meta[property="og:image:width"]', {
        element(e) {
          e.setAttribute('content', '800');
        }
      })
      .on('meta[property="og:image:height"]', {
        element(e) {
          e.setAttribute('content', '800');
        }
      })
      .on('meta[property="og:image:alt"]', {
        element(e) {
          e.setAttribute('content', title);
        }
      })
      .on('meta[property="og:url"]', {
        element(e) {
          e.setAttribute('content', canonicalUrl);
        }
      })
      .on('meta[name="twitter:title"]', {
        element(e) {
          e.setAttribute('content', title);
        }
      })
      .on('meta[name="twitter:description"]', {
        element(e) {
          e.setAttribute('content', description);
        }
      })
      .on('meta[name="twitter:image"]', {
        element(e) {
          e.setAttribute('content', ogImageUrl);
        }
      })
      .on('meta[name="twitter:image:alt"]', {
        element(e) {
          e.setAttribute('content', title);
        }
      });

    const transformed = rewriter.transform(response);

    const headers = new Headers(transformed.headers);
    headers.set('Cache-Control', 'public, max-age=120, s-maxage=600');

    return new Response(transformed.body, {
      status: transformed.status,
      statusText: transformed.statusText,
      headers
    });

  } catch (err) {
    console.error('Error in Pages Functions _middleware:', err);
    return response;
  }
}
