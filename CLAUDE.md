# Instrucciones para Claude
- **Seguridad**: Antes de sugerir cambios, verifica que no existan vulnerabilidades de Inyección SQL (especialmente con Prisma), XSS o exposición de variables de entorno.
- **Estándares**: Sigue las convenciones de Next.js 14/15 y TypeScript estricto.
- **Chequeo**: Al pedir "verificar el repo", realiza un escaneo de la carpeta `/app`, `/lib` y `/prisma`.