Registro de lectura — GitHub Pages

Contenido:
- index.html
- style.css
- app.js
- manifest.json
- service-worker.js
- icons/

Cómo subirlo a GitHub Pages:
1. Creá un repositorio nuevo, por ejemplo: registro-de-lectura
2. Subí todo el contenido de esta carpeta a la raíz del repositorio
3. En GitHub: Settings > Pages
4. En Build and deployment:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: /root
5. Guardá
6. Esperá a que GitHub publique la web

Notas:
- La app guarda los datos en IndexedDB, en el navegador y dispositivo donde la uses.
- Para no perder datos al cambiar de equipo o navegador, usá "Exportar copia JSON".
- La función offline mejora después de la primera carga completa.
