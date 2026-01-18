# 🎰 Master Scraper - Lotería

Sistema automatizado de extracción de resultados de lotería desde Instagram mediante Playwright y OCR.

## 🚀 Características
- **Multi-Perfil**: Extrae resultados de múltiples cuentas de Instagram.
- **OCR Inteligente**: Normalización de imágenes y extracción de números mediante OCR.space.
- **Puntualidad**: Configurado para ejecutarse cada 5 minutos mediante GitHub Actions.
- **Eficiencia**: 
  - Evita re-procesar imágenes ya escaneadas.
  - Horario restringido (11 AM - 12 PM) para optimizar recursos.
  - Autolimpieza diaria (retención de 24h).
- **Auto-corrección**: Corrige automáticamente errores de año (2025 -> 2026) comunes en enero.

## 🛠️ Configuración (Secrets)
Para que el scraper funcione en GitHub, se deben configurar los siguientes `Secrets`:
- `SUPABASE_URL`: URL de tu proyecto maestro de Supabase.
- `SUPABASE_KEY`: Service Role Key o Anon Key con permisos de escritura.
- `OCR_SPACE_KEY`: API Key gratuita de OCR.space.
- `INSTAGRAM_COOKIES`: JSON con las cookies de sesión para evitar el Login Wall.

## 🧹 Mantenimiento
- Si el scraper falla por "Login Wall", es necesario actualizar el secreto `INSTAGRAM_COOKIES`.
- Para agregar cuentas, edita el array `TARGET_PROFILES` en `src/scrapers/instagram.js`.

---
*Desarrollado para el sistema de gestión de lotería.*
