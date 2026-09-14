import imglyRemoveBackground from 'https://esm.sh/@imgly/background-removal@1.4.5';

const fotoInput = document.getElementById('fotoInput');
const skipBgRemoval = document.getElementById('skipBgRemoval');
const previewCanvas = document.getElementById('previewCanvas');
const ctx = previewCanvas ? previewCanvas.getContext('2d') : null;
const processStatus = document.getElementById('processStatus');

let fotoProcesadaBlob = null;

export function obtenerFotoProcesadaBlob() {
  return fotoProcesadaBlob;
}

export function limpiarFotoProcesadaBlob() {
  fotoProcesadaBlob = null;
}

export function setProcessStatus(mensaje) {
  if (processStatus) {
    processStatus.innerText = mensaje;
  }
}

export function limpiarCanvas() {
  if (ctx) {
    ctx.clearRect(0, 0, 1000, 1250);
  }
}

export function dibujarFotoCover(fotoUrl) {
  if (!ctx || !fotoUrl) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    ctx.clearRect(0, 0, 1000, 1250);
    const canvasAspect = 1000 / 1250;
    const imgAspect = img.width / img.height;
    let drawW, drawH, drawX, drawY;

    if (imgAspect > canvasAspect) {
      drawH = 1250;
      drawW = img.width * (1250 / img.height);
      drawX = (1000 - drawW) / 2;
      drawY = 0;
    } else {
      drawW = 1000;
      drawH = img.height * (1000 / img.width);
      drawX = 0;
      drawY = (1250 - drawH) / 2;
    }
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  };
  img.src = fotoUrl;
}

export async function procesarFoto() {
  const file = fotoInput ? fotoInput.files[0] : null;
  if (!file) {
    throw new Error('Por favor selecciona un archivo de foto antes de procesar.');
  }

  const esModoManual = Boolean(skipBgRemoval && skipBgRemoval.checked);
  setProcessStatus(esModoManual
    ? 'Encuadrando y preparando foto...'
    : 'Procesando foto con IA... (la primera vez puede tardar descargando el modelo)');

  // 1. Obtener imagen transparente: directa del archivo (manual) o procesada con IA
  const transparentBlob = esModoManual ? file : await imglyRemoveBackground(file);

  // 2. Cargar blob en elemento Image
  const imgUrl = URL.createObjectURL(transparentBlob);
  const img = new Image();

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imgUrl;
  });

  // 3. Bounding box sobre canvas auxiliar
  const offCanvas = document.createElement('canvas');
  offCanvas.width = img.naturalWidth || img.width;
  offCanvas.height = img.naturalHeight || img.height;
  const offCtx = offCanvas.getContext('2d');
  offCtx.drawImage(img, 0, 0);

  const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
  const pixels = imgData.data;

  let minX = offCanvas.width;
  let minY = offCanvas.height;
  let maxX = 0;
  let maxY = 0;
  let foundPixels = false;

  for (let y = 0; y < offCanvas.height; y++) {
    for (let x = 0; x < offCanvas.width; x++) {
      const i = (y * offCanvas.width + x) * 4;
      let esSujeto = false;

      if (esModoManual) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        const esBlanco = r > 245 && g > 245 && b > 245;
        esSujeto = !esBlanco;
      } else {
        esSujeto = pixels[i + 3] > 10;
      }

      if (esSujeto) {
        foundPixels = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!foundPixels) {
    minX = 0;
    minY = 0;
    maxX = offCanvas.width - 1;
    maxY = offCanvas.height - 1;
  }

  const cutW = maxX - minX + 1;
  const cutH = maxY - minY + 1;

  // 4. Preparar canvas principal (1000x1250) con fondo blanco
  ctx.clearRect(0, 0, 1000, 1250);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1000, 1250);

  // Escalar para ocupar ~85% de la altura del canvas
  const targetHeight = 1250 * 0.85;
  const scale = targetHeight / cutH;
  const destW = cutW * scale;
  const destH = targetHeight;
  const destX = (1000 - destW) / 2;
  const destY = (1250 - destH) / 2;

  // 5. Dibujar sombra elíptica borrosa debajo de la base del sujeto
  const shadowY = destY + destH - 10;
  const shadowX = 1000 / 2;
  const shadowRadiusX = Math.min(destW * 0.38, 220);
  const shadowRadiusY = 22;

  ctx.save();
  ctx.filter = 'blur(20px)';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(shadowX, shadowY, shadowRadiusX, shadowRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 6. Dibujar sujeto recortado y centrado
  ctx.drawImage(offCanvas, minX, minY, cutW, cutH, destX, destY, destW, destH);
  URL.revokeObjectURL(imgUrl);

  // 7. Generar blob PNG del canvas
  await new Promise((resolve) => {
    previewCanvas.toBlob((blob) => {
      fotoProcesadaBlob = blob;
      setProcessStatus('¡Listo! Foto procesada correctamente.');
      resolve(blob);
    }, 'image/png');
  });

  return fotoProcesadaBlob;
}
