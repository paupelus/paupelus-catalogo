import os
import csv
import re

FOTOS_DIR = "fotos_limpias"
OUTPUT_CSV = "productos_template.csv"
COLUMNAS = ["archivo", "categoria", "nombre", "color", "largo_cm", "tipo", "precio"]

def orden_natural(texto):
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', texto)]

def main():
    if not os.path.exists(FOTOS_DIR):
        print(f"No existe la carpeta '{FOTOS_DIR}'. Ejecuta primero herramientas/recortar_fotos.py.")
        return

    archivos = [f for f in os.listdir(FOTOS_DIR) if f.lower().endswith(".png")]

    if not archivos:
        print(f"No se encontraron imágenes en '{FOTOS_DIR}'. Ejecuta primero herramientas/recortar_fotos.py.")
        return

    archivos.sort(key=orden_natural)

    with open(OUTPUT_CSV, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter=",")
        writer.writerow(COLUMNAS)
        for archivo in archivos:
            writer.writerow([archivo, "", "", "", "", "", ""])

    print(f"Plantilla generada con éxito: {OUTPUT_CSV} ({len(archivos)} filas creadas).")

if __name__ == "__main__":
    main()
