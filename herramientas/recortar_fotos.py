import os
import sys
from PIL import Image

CANVA_DIR = "canva_export"
OUTPUT_DIR = "fotos_limpias"
EXPECTED_WIDTH = 1414
EXPECTED_HEIGHT = 2000
CROP_BOX = (750, 0, 1414, 1580)

def main():
    if not os.path.exists(CANVA_DIR):
        os.makedirs(CANVA_DIR)
        print(f"Carpeta '{CANVA_DIR}' creada. Por favor, coloca allí las 52 tarjetas exportadas de Canva.")
        sys.exit(0)

    archivos = [f for f in os.listdir(CANVA_DIR) if f.lower().endswith(".png")]

    if not archivos:
        print(f"La carpeta '{CANVA_DIR}' está vacía. Coloca allí las 52 tarjetas exportadas de Canva para continuar.")
        sys.exit(0)

    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    procesadas = 0
    omitidas = 0

    for nombre_archivo in archivos:
        ruta_origen = os.path.join(CANVA_DIR, nombre_archivo)
        try:
            with Image.open(ruta_origen) as img:
                if img.size != (EXPECTED_WIDTH, EXPECTED_HEIGHT):
                    print(f"Omitida: {nombre_archivo} tiene dimensiones {img.size}, se esperaba ({EXPECTED_WIDTH}, {EXPECTED_HEIGHT})")
                    omitidas += 1
                    continue

                recorte = img.crop(CROP_BOX)
                ruta_destino = os.path.join(OUTPUT_DIR, nombre_archivo)
                recorte.save(ruta_destino, format="PNG")
                procesadas += 1
        except Exception as e:
            print(f"Error procesando {nombre_archivo}: {e}")
            omitidas += 1

    print("-" * 40)
    print(f"Resumen de procesamiento:")
    print(f"Imágenes procesadas exitosamente: {procesadas}")
    print(f"Imágenes omitidas: {omitidas}")

if __name__ == "__main__":
    main()
