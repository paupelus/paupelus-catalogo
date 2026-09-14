# Herramientas de Preparación de Catálogo - Paupelus

Este módulo contiene los scripts de preprocesamiento de imágenes y generación de plantilla para el catálogo de productos.

## Requisitos
- Python 3.x
- Pillow (`pip install Pillow`)

---

## Orden de Ejecución

### Paso 1: Recortar Fotos
Coloca las 52 tarjetas descargadas de Canva dentro de la carpeta `canva_export/`. Luego ejecuta:

```bash
python herramientas/recortar_fotos.py
```

- Valida que cada imagen tenga la dimensión esperada (1414x2000 px).
- Recorta la zona limpia de la fotografía `(750, 0, 1414, 1580)`.
- Almacena los resultados en `fotos_limpias/` manteniendo el nombre original.

---

### Paso 2: Generar Plantilla CSV
Una vez procesadas las imágenes en `fotos_limpias/`, ejecuta:

```bash
python herramientas/generar_plantilla_csv.py
```

- Lee los archivos disponibles en `fotos_limpias/`.
- Genera `productos_template.csv` con las columnas:
  `archivo,categoria,nombre,color,largo_cm,tipo,precio`.
- La columna `archivo` se diligencia automáticamente y las demás quedan vacías para su completitud manual.
