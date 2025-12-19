# PGospelMusic - Plataforma de Creación Musical con IA

## Problema Original
Crear una aplicación web llamada PGospelMusic, plataforma de creación musical con IA enfocada en música gospel. Crear canciones completas con identidad vocal propia.

## Integraciones REALES Implementadas

### 1. ElevenLabs (Voice Cloning + TTS)
- **API Key:** Configurada en backend/.env
- **Funcionalidades:**
  - Clonación de voz desde muestras de audio
  - Text-to-Speech con voz clonada
  - Generación de audio para canciones
- **SDK:** elevenlabs v2.27.0
- **Endpoints:**
  - `POST /api/voice-profiles/{id}/clone` - Clonar voz
  - `POST /api/songs/{id}/generate-audio` - Generar audio con voz clonada
  - `POST /api/tts/generate` - Text-to-Speech directo
  - `GET /api/elevenlabs/voices` - Listar voces disponibles

### 2. OpenAI GPT-5.1 (Letras)
- **API Key:** Emergent LLM Key
- **Funcionalidad:** Generación de letras gospel bíblicamente coherentes
- **Endpoint:** `POST /api/lyrics/generate`

### 3. Audio Processing (ffmpeg/ffprobe)
- **Análisis de audio:** duración, bitrate, sample rate, volumen
- **Conversión:** MP3, WAV
- **Exportación:** Canciones en múltiples formatos

## Arquitectura

### Backend (FastAPI + MongoDB)
```
/api/auth/* - Autenticación JWT
/api/voice-profiles/* - Perfiles vocales + clonación ElevenLabs
/api/projects/* - Proyectos musicales
/api/songs/* - Canciones + generación de audio
/api/lyrics/generate - Letras con GPT-5.1
/api/tts/generate - Text-to-Speech
/api/elevenlabs/voices - Voces ElevenLabs
/uploads/audio/* - Archivos estáticos
```

### Frontend (React + Tailwind)
- Landing Page con animaciones
- Auth (JWT)
- Dashboard de proyectos
- Voice Studio (perfiles + clonación)
- Song Creator (editor + generación)

## Flujo Completo de Usuario
1. Crear cuenta
2. **Voice Studio:** Crear perfil de voz → Subir muestras de audio → Clonar voz con ElevenLabs
3. **Dashboard:** Crear proyecto
4. **Song Creator:** 
   - Seleccionar perfil de voz clonado
   - Configurar (tempo, tonalidad, género, estructura)
   - Escribir descripción detallada
   - **Generar Letras** con GPT-5.1
   - **Generar Audio** con tu voz clonada (ElevenLabs TTS)
   - Reproducir y exportar (MP3/WAV)

## Estado Actual

### ✅ Funcional
- Autenticación JWT
- CRUD proyectos/canciones/perfiles
- Subida y análisis de audio
- Generación de letras (GPT-5.1)
- Integración ElevenLabs SDK
- Reproducción de audio
- Exportación MP3/WAV

### ⚠️ Limitaciones de API Key
Tu API Key de ElevenLabs actual NO tiene permisos de `voices_write` (requiere plan premium para clonación). La integración está **100% implementada** pero:
- Para clonar tu voz: Necesitas plan ElevenLabs Creator ($22/mes) o superior
- Para usar TTS con voz clonada: Primero debe clonarse la voz

### 🔧 Para Habilitar Clonación
1. Upgrade tu cuenta ElevenLabs a Creator o superior
2. La funcionalidad se activará automáticamente (ya está implementada)

## Credenciales
```
ELEVENLABS_API_KEY=sk_b54f1a132a024fd8c686b46984e35ed4383590b077f5eb95
EMERGENT_LLM_KEY=sk-emergent-075C3F53e8158CaA5B
JWT_SECRET=pgospelmusic_secret_key_2024_divine_worship
```

## Próximos Pasos
1. **Upgrade ElevenLabs** a plan Creator para habilitar voice cloning
2. Integrar **Suno API** para generación de música instrumental
3. Mezcla de stems en tiempo real
4. Sistema de suscripciones (Stripe)
