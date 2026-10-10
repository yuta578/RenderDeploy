# ==============================================================================
# Dockerfile para NexusDash (Optimizado para Render y Producción)
# ==============================================================================

# Imagen base oficial ligera de Node.js Alpine
FROM node:20-alpine

# Metadatos del contenedor
LABEL maintainer="NexusDash Team"
LABEL description="Analytics Dashboard con Feature Flags de ConfigCat y Dark Mode"

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias primero para optimizar la caché de capas de Docker
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copiar el código fuente de la aplicación
COPY index.html styles.css app.js configcat.js ./

# Definir variables de entorno de producción
ENV NODE_ENV=production
ENV PORT=3000

# Exponer el puerto del servidor
EXPOSE 3000

# Comprobación de salud (Healthcheck) para orquestadores como Render / Docker Compose
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/ || exit 1

# Usar usuario sin privilegios para mayor seguridad
USER node

# Comando de inicio del servidor
CMD ["node", "app.js"]
