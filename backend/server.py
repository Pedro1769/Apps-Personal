from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import aiofiles
import subprocess
import json
import base64
import io
from emergentintegrations.llm.chat import LlmChat, UserMessage
from elevenlabs import ElevenLabs, VoiceSettings

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create upload directories
UPLOAD_DIR = ROOT_DIR / "uploads"
AUDIO_DIR = UPLOAD_DIR / "audio"
EXPORTS_DIR = UPLOAD_DIR / "exports"
VOICES_DIR = UPLOAD_DIR / "voices"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
VOICES_DIR.mkdir(parents=True, exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'pgospelmusic_secret')
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY', '')

# ElevenLabs client
eleven_client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else None

app = FastAPI(title="PGospelMusic API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Allowed audio formats
ALLOWED_AUDIO_FORMATS = {'.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma', '.webm'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    created_at: str

class VoiceProfileCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    vocal_range: Optional[str] = "medium"
    timbre: Optional[str] = "warm"
    style: Optional[str] = "worship"

class VoiceProfileResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    name: str
    description: str
    vocal_range: str
    timbre: str
    style: str
    audio_samples: List[dict]
    created_at: str
    status: str
    analysis: Optional[dict] = None
    elevenlabs_voice_id: Optional[str] = None

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    genre: Optional[str] = "gospel"

class ProjectResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    name: str
    description: str
    genre: str
    songs: List[str]
    created_at: str
    updated_at: str

class SongCreate(BaseModel):
    project_id: str
    title: str
    description: Optional[str] = ""
    tempo: Optional[int] = 120
    key: Optional[str] = "C"
    genre: Optional[str] = "gospel"
    style: Optional[str] = "worship"
    mood: Optional[str] = "uplifting"
    structure: Optional[List[str]] = ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "outro"]
    instruments: Optional[List[str]] = ["piano", "drums", "bass", "strings"]
    voice_profile_id: Optional[str] = None

class SongResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    user_id: str
    title: str
    description: str
    tempo: int
    key: str
    genre: str
    style: str
    mood: str
    structure: List[str]
    instruments: List[str]
    lyrics: Optional[str]
    audio_url: Optional[str] = None
    stems: Optional[dict] = None
    voice_profile_id: Optional[str] = None
    status: str
    created_at: str
    updated_at: str

class LyricsGenerateRequest(BaseModel):
    prompt: str
    style: Optional[str] = "worship"
    theme: Optional[str] = "praise"
    language: Optional[str] = "es"
    structure: Optional[List[str]] = ["verse", "chorus", "verse", "chorus", "bridge", "chorus"]
    voice_profile_id: Optional[str] = None

class LyricsResponse(BaseModel):
    lyrics: str
    sections: List[dict]

class TTSRequest(BaseModel):
    text: str
    voice_profile_id: str
    stability: Optional[float] = 0.5
    similarity_boost: Optional[float] = 0.75
    style: Optional[float] = 0.5

class GenerateSongAudioRequest(BaseModel):
    song_id: str
    voice_profile_id: str

# ==================== AUDIO ANALYSIS ====================

def analyze_audio_file(file_path: str) -> dict:
    try:
        cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', str(file_path)]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            format_info = data.get('format', {})
            audio_stream = next((s for s in data.get('streams', []) if s.get('codec_type') == 'audio'), {})
            return {
                'duration': float(format_info.get('duration', 0)),
                'bitrate': int(format_info.get('bit_rate', 0)),
                'sample_rate': int(audio_stream.get('sample_rate', 0)),
                'channels': audio_stream.get('channels', 0),
                'codec': audio_stream.get('codec_name', 'unknown'),
            }
    except Exception as e:
        logger.error(f"Error analyzing audio: {e}")
    return {}

def extract_vocal_characteristics(file_path: str) -> dict:
    try:
        analysis = analyze_audio_file(file_path)
        cmd = ['ffmpeg', '-i', str(file_path), '-af', 'volumedetect', '-f', 'null', '-']
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        stderr = result.stderr
        
        mean_volume = max_volume = None
        for line in stderr.split('\n'):
            if 'mean_volume' in line:
                try:
                    mean_volume = float(line.split(':')[1].strip().replace(' dB', ''))
                except:
                    pass
            if 'max_volume' in line:
                try:
                    max_volume = float(line.split(':')[1].strip().replace(' dB', ''))
                except:
                    pass
        
        dynamic_range = abs(max_volume - mean_volume) if mean_volume and max_volume else 0
        
        return {
            **analysis,
            'mean_volume_db': mean_volume,
            'max_volume_db': max_volume,
            'dynamic_range_db': dynamic_range,
            'estimated_intensity': 'high' if dynamic_range > 15 else 'medium' if dynamic_range > 8 else 'soft',
            'quality': 'good' if analysis.get('sample_rate', 0) >= 44100 else 'acceptable',
        }
    except Exception as e:
        logger.error(f"Error extracting vocal characteristics: {e}")
        return {}

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=dict)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(id=user["id"], email=user["email"], name=user["name"], created_at=user["created_at"])

# ==================== VOICE PROFILES ====================

@api_router.post("/voice-profiles", response_model=VoiceProfileResponse)
async def create_voice_profile(profile_data: VoiceProfileCreate, user: dict = Depends(get_current_user)):
    profile = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": profile_data.name,
        "description": profile_data.description,
        "vocal_range": profile_data.vocal_range,
        "timbre": profile_data.timbre,
        "style": profile_data.style,
        "audio_samples": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "analysis": None,
        "elevenlabs_voice_id": None
    }
    await db.voice_profiles.insert_one(profile)
    return VoiceProfileResponse(**profile)

@api_router.get("/voice-profiles", response_model=List[VoiceProfileResponse])
async def get_voice_profiles(user: dict = Depends(get_current_user)):
    profiles = await db.voice_profiles.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return [VoiceProfileResponse(**p) for p in profiles]

@api_router.get("/voice-profiles/{profile_id}", response_model=VoiceProfileResponse)
async def get_voice_profile(profile_id: str, user: dict = Depends(get_current_user)):
    profile = await db.voice_profiles.find_one({"id": profile_id, "user_id": user["id"]}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return VoiceProfileResponse(**profile)

@api_router.post("/voice-profiles/{profile_id}/upload")
async def upload_voice_sample(
    profile_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    profile = await db.voice_profiles.find_one({"id": profile_id, "user_id": user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_AUDIO_FORMATS:
        raise HTTPException(status_code=400, detail=f"Invalid format. Allowed: {', '.join(ALLOWED_AUDIO_FORMATS)}")
    
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 50MB")
    
    sample_id = str(uuid.uuid4())
    filename = f"{user['id']}_{profile_id}_{sample_id}{file_ext}"
    file_path = AUDIO_DIR / filename
    
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    analysis = extract_vocal_characteristics(str(file_path))
    
    sample = {
        "id": sample_id,
        "filename": filename,
        "original_name": file.filename,
        "url": f"/uploads/audio/{filename}",
        "duration": analysis.get('duration', 0),
        "format": file_ext[1:],
        "size": len(content),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "analysis": analysis
    }
    
    await db.voice_profiles.update_one(
        {"id": profile_id},
        {
            "$push": {"audio_samples": sample},
            "$set": {"status": "processing", "updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    background_tasks.add_task(process_voice_profile, profile_id, user["id"])
    
    return {"message": "Audio uploaded successfully", "sample": sample}

async def process_voice_profile(profile_id: str, user_id: str):
    """Process voice profile and create ElevenLabs clone if enough samples"""
    try:
        profile = await db.voice_profiles.find_one({"id": profile_id}, {"_id": 0})
        if not profile or not profile.get("audio_samples"):
            return
        
        samples = profile["audio_samples"]
        total_duration = sum(s.get("analysis", {}).get("duration", 0) for s in samples)
        
        # Aggregate analysis
        avg_dynamic_range = []
        avg_intensity = []
        
        for s in samples:
            analysis = s.get("analysis", {})
            if analysis.get("dynamic_range_db"):
                avg_dynamic_range.append(analysis["dynamic_range_db"])
            if analysis.get("estimated_intensity"):
                intensity_map = {"soft": 1, "medium": 2, "high": 3}
                avg_intensity.append(intensity_map.get(analysis["estimated_intensity"], 2))
        
        aggregated = {
            "total_samples": len(samples),
            "total_duration": total_duration,
            "avg_dynamic_range": sum(avg_dynamic_range) / len(avg_dynamic_range) if avg_dynamic_range else 0,
            "estimated_intensity": "high" if avg_intensity and sum(avg_intensity)/len(avg_intensity) > 2.5 else "medium",
            "profile_quality": "excellent" if len(samples) >= 3 and total_duration >= 60 else "good" if len(samples) >= 2 else "needs_more_samples",
            "analyzed_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Clone voice with ElevenLabs if we have enough samples
        elevenlabs_voice_id = profile.get("elevenlabs_voice_id")
        
        if eleven_client and len(samples) >= 1 and total_duration >= 10 and not elevenlabs_voice_id:
            try:
                # Collect audio files for cloning
                audio_files = []
                for sample in samples[:5]:  # Max 5 samples for cloning
                    file_path = AUDIO_DIR / sample["filename"]
                    if file_path.exists():
                        audio_files.append(open(file_path, 'rb'))
                
                if audio_files:
                    # Create voice clone using ElevenLabs IVC
                    voice = eleven_client.voices.add(
                        name=f"PGospel_{profile['name']}_{profile_id[:8]}",
                        files=audio_files,
                        description=f"Voice profile for {profile['name']}. {profile.get('description', '')}"
                    )
                    elevenlabs_voice_id = voice.voice_id
                    logger.info(f"Created ElevenLabs voice clone: {elevenlabs_voice_id}")
                    
                    # Close files
                    for f in audio_files:
                        f.close()
                        
            except Exception as e:
                logger.error(f"Error creating ElevenLabs voice clone: {e}")
        
        # Update profile
        await db.voice_profiles.update_one(
            {"id": profile_id},
            {
                "$set": {
                    "analysis": aggregated,
                    "status": "ready" if elevenlabs_voice_id else ("ready" if aggregated["profile_quality"] != "needs_more_samples" else "processing"),
                    "elevenlabs_voice_id": elevenlabs_voice_id
                }
            }
        )
    except Exception as e:
        logger.error(f"Error processing voice profile: {e}")

@api_router.post("/voice-profiles/{profile_id}/clone")
async def clone_voice_elevenlabs(profile_id: str, user: dict = Depends(get_current_user)):
    """Manually trigger voice cloning with ElevenLabs"""
    if not eleven_client:
        raise HTTPException(status_code=503, detail="ElevenLabs not configured")
    
    profile = await db.voice_profiles.find_one({"id": profile_id, "user_id": user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    if profile.get("elevenlabs_voice_id"):
        return {"message": "Voice already cloned", "voice_id": profile["elevenlabs_voice_id"]}
    
    samples = profile.get("audio_samples", [])
    if not samples:
        raise HTTPException(status_code=400, detail="No audio samples to clone from")
    
    try:
        audio_files = []
        for sample in samples[:5]:
            file_path = AUDIO_DIR / sample["filename"]
            if file_path.exists():
                audio_files.append(open(file_path, 'rb'))
        
        if not audio_files:
            raise HTTPException(status_code=400, detail="No valid audio files found")
        
        voice = eleven_client.voices.add(
            name=f"PGospel_{profile['name']}_{profile_id[:8]}",
            files=audio_files,
            description=f"Voice profile for {profile['name']}. {profile.get('description', '')}"
        )
        
        for f in audio_files:
            f.close()
        
        await db.voice_profiles.update_one(
            {"id": profile_id},
            {"$set": {"elevenlabs_voice_id": voice.voice_id, "status": "ready"}}
        )
        
        return {"message": "Voice cloned successfully", "voice_id": voice.voice_id}
    except Exception as e:
        logger.error(f"Error cloning voice: {e}")
        raise HTTPException(status_code=500, detail=f"Error cloning voice: {str(e)}")

@api_router.delete("/voice-profiles/{profile_id}/samples/{sample_id}")
async def delete_voice_sample(profile_id: str, sample_id: str, user: dict = Depends(get_current_user)):
    profile = await db.voice_profiles.find_one({"id": profile_id, "user_id": user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    sample = next((s for s in profile.get("audio_samples", []) if s["id"] == sample_id), None)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    file_path = AUDIO_DIR / sample["filename"]
    if file_path.exists():
        file_path.unlink()
    
    await db.voice_profiles.update_one(
        {"id": profile_id},
        {"$pull": {"audio_samples": {"id": sample_id}}}
    )
    
    return {"message": "Sample deleted"}

@api_router.delete("/voice-profiles/{profile_id}")
async def delete_voice_profile(profile_id: str, user: dict = Depends(get_current_user)):
    profile = await db.voice_profiles.find_one({"id": profile_id, "user_id": user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Delete ElevenLabs voice if exists
    if eleven_client and profile.get("elevenlabs_voice_id"):
        try:
            eleven_client.voices.delete(profile["elevenlabs_voice_id"])
        except:
            pass
    
    # Delete all audio files
    for sample in profile.get("audio_samples", []):
        file_path = AUDIO_DIR / sample["filename"]
        if file_path.exists():
            file_path.unlink()
    
    await db.voice_profiles.delete_one({"id": profile_id})
    return {"message": "Profile deleted"}

# ==================== TEXT TO SPEECH ====================

@api_router.post("/tts/generate")
async def generate_tts(request: TTSRequest, user: dict = Depends(get_current_user)):
    """Generate speech from text using cloned voice"""
    if not eleven_client:
        raise HTTPException(status_code=503, detail="ElevenLabs not configured")
    
    profile = await db.voice_profiles.find_one({"id": request.voice_profile_id, "user_id": user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    
    voice_id = profile.get("elevenlabs_voice_id")
    if not voice_id:
        raise HTTPException(status_code=400, detail="Voice not cloned yet. Upload more samples or trigger cloning.")
    
    try:
        voice_settings = VoiceSettings(
            stability=request.stability,
            similarity_boost=request.similarity_boost,
            style=request.style,
            use_speaker_boost=True
        )
        
        audio_generator = eleven_client.text_to_speech.convert(
            text=request.text,
            voice_id=voice_id,
            model_id="eleven_multilingual_v2",
            voice_settings=voice_settings
        )
        
        audio_data = b""
        for chunk in audio_generator:
            audio_data += chunk
        
        # Save audio file
        filename = f"tts_{user['id']}_{uuid.uuid4()}.mp3"
        file_path = AUDIO_DIR / filename
        
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(audio_data)
        
        audio_url = f"/uploads/audio/{filename}"
        
        return {
            "audio_url": audio_url,
            "text": request.text,
            "voice_id": voice_id,
            "duration": analyze_audio_file(str(file_path)).get("duration", 0)
        }
    except Exception as e:
        logger.error(f"Error generating TTS: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating speech: {str(e)}")

@api_router.post("/songs/{song_id}/generate-audio")
async def generate_song_audio(song_id: str, voice_profile_id: str, user: dict = Depends(get_current_user)):
    """Generate audio for song lyrics using cloned voice"""
    if not eleven_client:
        raise HTTPException(status_code=503, detail="ElevenLabs not configured")
    
    song = await db.songs.find_one({"id": song_id, "user_id": user["id"]})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    if not song.get("lyrics"):
        raise HTTPException(status_code=400, detail="Song has no lyrics to generate audio from")
    
    profile = await db.voice_profiles.find_one({"id": voice_profile_id, "user_id": user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    
    voice_id = profile.get("elevenlabs_voice_id")
    if not voice_id:
        raise HTTPException(status_code=400, detail="Voice not cloned. Please clone your voice first.")
    
    try:
        # Clean lyrics for TTS
        lyrics_text = song["lyrics"]
        # Remove section headers for cleaner speech
        import re
        clean_lyrics = re.sub(r'\[.*?\]|\(.*?\)|Verso \d+:|Coro:|Puente:|Pre-coro:|Intro:|Outro:', '', lyrics_text)
        clean_lyrics = '\n'.join(line.strip() for line in clean_lyrics.split('\n') if line.strip())
        
        voice_settings = VoiceSettings(
            stability=0.5,
            similarity_boost=0.8,
            style=0.6,
            use_speaker_boost=True
        )
        
        audio_generator = eleven_client.text_to_speech.convert(
            text=clean_lyrics,
            voice_id=voice_id,
            model_id="eleven_multilingual_v2",
            voice_settings=voice_settings
        )
        
        audio_data = b""
        for chunk in audio_generator:
            audio_data += chunk
        
        # Save generated audio
        filename = f"song_{song_id}_generated_{uuid.uuid4()}.mp3"
        file_path = AUDIO_DIR / filename
        
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(audio_data)
        
        audio_url = f"/uploads/audio/{filename}"
        
        # Update song with generated audio
        await db.songs.update_one(
            {"id": song_id},
            {
                "$set": {
                    "audio_url": audio_url,
                    "voice_profile_id": voice_profile_id,
                    "status": "generated",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        duration = analyze_audio_file(str(file_path)).get("duration", 0)
        
        return {
            "message": "Audio generated successfully",
            "audio_url": audio_url,
            "duration": duration,
            "voice_id": voice_id
        }
    except Exception as e:
        logger.error(f"Error generating song audio: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating audio: {str(e)}")

# ==================== ELEVENLABS VOICES ====================

@api_router.get("/elevenlabs/voices")
async def get_elevenlabs_voices(user: dict = Depends(get_current_user)):
    """Get available ElevenLabs voices"""
    if not eleven_client:
        raise HTTPException(status_code=503, detail="ElevenLabs not configured")
    
    try:
        voices = eleven_client.voices.get_all()
        return {
            "voices": [
                {
                    "voice_id": v.voice_id,
                    "name": v.name,
                    "category": v.category if hasattr(v, 'category') else "custom",
                    "description": v.description if hasattr(v, 'description') else ""
                }
                for v in voices.voices
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== PROJECTS ====================

@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(project_data: ProjectCreate, user: dict = Depends(get_current_user)):
    project = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": project_data.name,
        "description": project_data.description,
        "genre": project_data.genre,
        "songs": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.projects.insert_one(project)
    return ProjectResponse(**project)

@api_router.get("/projects", response_model=List[ProjectResponse])
async def get_projects(user: dict = Depends(get_current_user)):
    projects = await db.projects.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return [ProjectResponse(**p) for p in projects]

@api_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(**project)

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    result = await db.projects.delete_one({"id": project_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.songs.delete_many({"project_id": project_id})
    return {"message": "Project deleted"}

# ==================== SONGS ====================

@api_router.post("/songs", response_model=SongResponse)
async def create_song(song_data: SongCreate, user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": song_data.project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    song = {
        "id": str(uuid.uuid4()),
        "project_id": song_data.project_id,
        "user_id": user["id"],
        "title": song_data.title,
        "description": song_data.description,
        "tempo": song_data.tempo,
        "key": song_data.key,
        "genre": song_data.genre,
        "style": song_data.style,
        "mood": song_data.mood,
        "structure": song_data.structure,
        "instruments": song_data.instruments,
        "lyrics": None,
        "audio_url": None,
        "stems": None,
        "voice_profile_id": song_data.voice_profile_id,
        "status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.songs.insert_one(song)
    await db.projects.update_one({"id": song_data.project_id}, {"$push": {"songs": song["id"]}})
    return SongResponse(**song)

@api_router.get("/songs", response_model=List[SongResponse])
async def get_songs(project_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if project_id:
        query["project_id"] = project_id
    songs = await db.songs.find(query, {"_id": 0}).to_list(100)
    return [SongResponse(**s) for s in songs]

@api_router.get("/songs/{song_id}", response_model=SongResponse)
async def get_song(song_id: str, user: dict = Depends(get_current_user)):
    song = await db.songs.find_one({"id": song_id, "user_id": user["id"]}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return SongResponse(**song)

@api_router.put("/songs/{song_id}/lyrics")
async def update_song_lyrics(song_id: str, lyrics: dict, user: dict = Depends(get_current_user)):
    song = await db.songs.find_one({"id": song_id, "user_id": user["id"]})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    await db.songs.update_one({"id": song_id}, {
        "$set": {"lyrics": lyrics.get("lyrics", ""), "updated_at": datetime.now(timezone.utc).isoformat()}
    })
    return {"message": "Lyrics updated"}

@api_router.post("/songs/{song_id}/upload-audio")
async def upload_song_audio(
    song_id: str,
    file: UploadFile = File(...),
    stem_type: str = Form(default="master"),
    user: dict = Depends(get_current_user)
):
    song = await db.songs.find_one({"id": song_id, "user_id": user["id"]})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_AUDIO_FORMATS:
        raise HTTPException(status_code=400, detail=f"Invalid format")
    
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
    
    filename = f"song_{song_id}_{stem_type}_{uuid.uuid4()}{file_ext}"
    file_path = AUDIO_DIR / filename
    
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    analysis = analyze_audio_file(str(file_path))
    audio_url = f"/uploads/audio/{filename}"
    
    if stem_type == "master":
        await db.songs.update_one(
            {"id": song_id},
            {"$set": {"audio_url": audio_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        stems = song.get("stems", {}) or {}
        stems[stem_type] = {"url": audio_url, "filename": filename, "duration": analysis.get("duration", 0)}
        await db.songs.update_one(
            {"id": song_id},
            {"$set": {"stems": stems, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Audio uploaded", "url": audio_url, "duration": analysis.get("duration", 0), "stem_type": stem_type}

@api_router.delete("/songs/{song_id}")
async def delete_song(song_id: str, user: dict = Depends(get_current_user)):
    song = await db.songs.find_one({"id": song_id, "user_id": user["id"]})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    await db.songs.delete_one({"id": song_id})
    await db.projects.update_one({"id": song["project_id"]}, {"$pull": {"songs": song_id}})
    return {"message": "Song deleted"}

# ==================== LYRICS GENERATION ====================

@api_router.post("/lyrics/generate", response_model=LyricsResponse)
async def generate_lyrics(request: LyricsGenerateRequest, user: dict = Depends(get_current_user)):
    try:
        # Build enhanced prompt with voice profile if provided
        enhanced_prompt = request.prompt
        
        if request.voice_profile_id:
            profile = await db.voice_profiles.find_one({"id": request.voice_profile_id, "user_id": user["id"]})
            if profile:
                enhanced_prompt += f"\n\n[Contexto del cantante: Voz {profile.get('vocal_range', 'media')}, timbre {profile.get('timbre', 'cálido')}, estilo {profile.get('style', 'worship')}. {profile.get('description', '')}]"
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"lyrics-{user['id']}-{uuid.uuid4()}",
            system_message="""Eres un compositor experto en música cristiana y gospel. 
Tu tarea es crear letras originales, profundas espiritualmente y poéticamente bellas.
Las letras deben ser bíblicamente coherentes, inspiradoras y aptas para adoración congregacional.
NUNCA copies letras existentes. Crea contenido 100% original.
Responde SOLO con las letras, estructuradas por secciones (Verso 1, Coro, etc.)."""
        ).with_model("openai", "gpt-5.1")
        
        structure_text = " -> ".join(request.structure)
        prompt = f"""Crea una canción de {request.style} con tema de {request.theme}.
Estructura: {structure_text}
Idioma: {request.language}

Descripción del usuario: {enhanced_prompt}

Genera letras originales y profundas para esta canción de adoración."""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        sections = []
        current_section = {"type": "unknown", "content": ""}
        for line in response.split("\n"):
            line = line.strip()
            if not line:
                continue
            lower = line.lower()
            if any(s in lower for s in ["verso", "verse", "coro", "chorus", "puente", "bridge", "intro", "outro", "pre-coro", "pre-chorus"]):
                if current_section["content"]:
                    sections.append(current_section)
                section_type = "verse"
                if "coro" in lower or "chorus" in lower:
                    section_type = "chorus"
                elif "puente" in lower or "bridge" in lower:
                    section_type = "bridge"
                elif "intro" in lower:
                    section_type = "intro"
                elif "outro" in lower:
                    section_type = "outro"
                elif "pre" in lower:
                    section_type = "pre-chorus"
                current_section = {"type": section_type, "title": line, "content": ""}
            else:
                current_section["content"] += line + "\n"
        
        if current_section["content"]:
            sections.append(current_section)
        
        return LyricsResponse(lyrics=response, sections=sections)
    except Exception as e:
        logger.error(f"Error generating lyrics: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating lyrics: {str(e)}")

# ==================== EXPORT ====================

@api_router.post("/songs/{song_id}/export")
async def export_song(song_id: str, format: str = "mp3", user: dict = Depends(get_current_user)):
    song = await db.songs.find_one({"id": song_id, "user_id": user["id"]})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    if not song.get("audio_url"):
        raise HTTPException(status_code=400, detail="Song has no audio to export")
    
    source_path = ROOT_DIR / song["audio_url"].lstrip("/")
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    safe_title = "".join(c for c in song["title"] if c.isalnum() or c in " -_").strip()
    export_filename = f"{safe_title}_{song_id[:8]}.{format}"
    export_path = EXPORTS_DIR / export_filename
    
    if format == "wav":
        cmd = ['ffmpeg', '-y', '-i', str(source_path), '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', str(export_path)]
    else:
        cmd = ['ffmpeg', '-y', '-i', str(source_path), '-acodec', 'libmp3lame', '-q:a', '2', str(export_path)]
    
    result = subprocess.run(cmd, capture_output=True, timeout=120)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail="Export failed")
    
    return FileResponse(path=str(export_path), filename=export_filename, media_type=f"audio/{format}")

# ==================== HEALTH ====================

@api_router.get("/")
async def root():
    return {"message": "PGospelMusic API", "version": "2.0.0", "elevenlabs": bool(eleven_client)}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "elevenlabs_configured": bool(eleven_client)}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
