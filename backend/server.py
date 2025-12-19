from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import aiofiles
import subprocess
import json
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Import local voice engine
from voice_engine import get_voice_engine, get_music_generator, LocalVoiceEngine, MusicGenerator

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

# Initialize local voice engine
voice_engine = get_voice_engine(AUDIO_DIR)
music_generator = get_music_generator(AUDIO_DIR)

app = FastAPI(title="PGospelMusic API - Local Voice Engine")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Mount static files
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ALLOWED_AUDIO_FORMATS = {'.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.webm'}
MAX_FILE_SIZE = 50 * 1024 * 1024

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
    voice_cloned: bool = False

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
    backing_track_url: Optional[str] = None
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

class GenerateAudioRequest(BaseModel):
    voice_profile_id: str
    include_backing_track: bool = True

# ==================== AUDIO HELPERS ====================

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
            }
    except Exception as e:
        logger.error(f"Error analyzing audio: {e}")
    return {}

# ==================== AUTH ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {"user_id": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
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

@api_router.post("/auth/register")
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

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(**user)

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
        "voice_cloned": False
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
        raise HTTPException(status_code=400, detail="Invalid format")
    
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
    
    sample_id = str(uuid.uuid4())
    filename = f"{user['id']}_{profile_id}_{sample_id}{file_ext}"
    file_path = AUDIO_DIR / filename
    
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    analysis = analyze_audio_file(str(file_path))
    
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
        {"$push": {"audio_samples": sample}, "$set": {"status": "processing"}}
    )
    
    background_tasks.add_task(process_voice_profile_local, profile_id, user["id"])
    
    return {"message": "Audio uploaded successfully", "sample": sample}

async def process_voice_profile_local(profile_id: str, user_id: str):
    """Process voice profile using local voice engine"""
    try:
        profile = await db.voice_profiles.find_one({"id": profile_id}, {"_id": 0})
        if not profile or not profile.get("audio_samples"):
            return
        
        samples = profile["audio_samples"]
        sample_paths = [str(AUDIO_DIR / s["filename"]) for s in samples if (AUDIO_DIR / s["filename"]).exists()]
        
        if sample_paths:
            # Create voice profile in local engine
            voice_profile = await voice_engine.create_voice_profile(
                profile_id, 
                profile["name"], 
                sample_paths
            )
            
            # Update database
            aggregated = {
                "total_samples": len(samples),
                "total_duration": sum(s.get("analysis", {}).get("duration", 0) for s in samples),
                "voice_characteristics": voice_profile.voice_characteristics,
                "pitch_shift": voice_profile.pitch_shift,
                "analyzed_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.voice_profiles.update_one(
                {"id": profile_id},
                {"$set": {
                    "analysis": aggregated,
                    "status": "ready",
                    "voice_cloned": True
                }}
            )
            logger.info(f"Voice profile {profile_id} processed successfully")
    except Exception as e:
        logger.error(f"Error processing voice profile: {e}")

@api_router.post("/voice-profiles/{profile_id}/clone")
async def clone_voice_local(profile_id: str, user: dict = Depends(get_current_user)):
    """Manually trigger local voice cloning"""
    profile = await db.voice_profiles.find_one({"id": profile_id, "user_id": user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    samples = profile.get("audio_samples", [])
    if not samples:
        raise HTTPException(status_code=400, detail="No audio samples to clone from")
    
    sample_paths = [str(AUDIO_DIR / s["filename"]) for s in samples if (AUDIO_DIR / s["filename"]).exists()]
    
    if not sample_paths:
        raise HTTPException(status_code=400, detail="No valid audio files found")
    
    # Create voice profile in local engine
    voice_profile = await voice_engine.create_voice_profile(profile_id, profile["name"], sample_paths)
    
    await db.voice_profiles.update_one(
        {"id": profile_id},
        {"$set": {
            "voice_cloned": True,
            "status": "ready",
            "analysis": {
                "voice_characteristics": voice_profile.voice_characteristics,
                "pitch_shift": voice_profile.pitch_shift,
                "cloned_at": datetime.now(timezone.utc).isoformat()
            }
        }}
    )
    
    return {
        "message": "Voice cloned successfully using local engine",
        "characteristics": voice_profile.to_dict()
    }

@api_router.delete("/voice-profiles/{profile_id}/samples/{sample_id}")
async def delete_voice_sample(profile_id: str, sample_id: str, user: dict = Depends(get_current_user)):
    profile = await db.voice_profiles.find_one({"id": profile_id, "user_id": user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    sample = next((s for s in profile.get("audio_samples", []) if s["id"] == sample_id), None)
    if sample:
        file_path = AUDIO_DIR / sample["filename"]
        if file_path.exists():
            file_path.unlink()
    
    await db.voice_profiles.update_one({"id": profile_id}, {"$pull": {"audio_samples": {"id": sample_id}}})
    return {"message": "Sample deleted"}

@api_router.delete("/voice-profiles/{profile_id}")
async def delete_voice_profile(profile_id: str, user: dict = Depends(get_current_user)):
    profile = await db.voice_profiles.find_one({"id": profile_id, "user_id": user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    for sample in profile.get("audio_samples", []):
        file_path = AUDIO_DIR / sample["filename"]
        if file_path.exists():
            file_path.unlink()
    
    await db.voice_profiles.delete_one({"id": profile_id})
    return {"message": "Profile deleted"}

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
        "backing_track_url": None,
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
    await db.songs.update_one({"id": song_id}, {"$set": {"lyrics": lyrics.get("lyrics", ""), "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Lyrics updated"}

@api_router.post("/songs/{song_id}/generate-audio")
async def generate_song_audio_local(
    song_id: str,
    voice_profile_id: str,
    include_backing: bool = True,
    user: dict = Depends(get_current_user)
):
    """Generate audio using local voice engine - NO external APIs"""
    song = await db.songs.find_one({"id": song_id, "user_id": user["id"]})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    if not song.get("lyrics"):
        raise HTTPException(status_code=400, detail="Song has no lyrics")
    
    profile = await db.voice_profiles.find_one({"id": voice_profile_id, "user_id": user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")
    
    if not profile.get("voice_cloned"):
        raise HTTPException(status_code=400, detail="Voice not cloned yet. Upload samples first.")
    
    try:
        # Clean lyrics for TTS
        import re
        lyrics_text = song["lyrics"]
        clean_lyrics = re.sub(r'\[.*?\]|\(.*?\)|Verso \d+:|Coro:|Puente:|Pre-coro:|Intro:|Outro:', '', lyrics_text)
        clean_lyrics = '\n'.join(line.strip() for line in clean_lyrics.split('\n') if line.strip())
        
        # Generate voice audio using local engine
        voice_filename = f"song_{song_id}_voice_{uuid.uuid4()}.mp3"
        voice_path = str(AUDIO_DIR / voice_filename)
        
        await voice_engine.synthesize_speech(
            text=clean_lyrics,
            output_path=voice_path,
            profile_id=voice_profile_id,
            language="es"
        )
        
        voice_url = f"/uploads/audio/{voice_filename}"
        backing_url = None
        final_url = voice_url
        
        # Generate backing track if requested
        if include_backing:
            backing_filename = f"song_{song_id}_backing_{uuid.uuid4()}.mp3"
            backing_path = str(AUDIO_DIR / backing_filename)
            
            # Get voice duration for backing track
            voice_analysis = analyze_audio_file(voice_path)
            voice_duration = voice_analysis.get("duration", 60)
            
            await music_generator.generate_backing_track(
                output_path=backing_path,
                key=song.get("key", "G"),
                tempo=song.get("tempo", 120),
                duration_seconds=voice_duration + 10,
                style=song.get("style", "worship")
            )
            
            backing_url = f"/uploads/audio/{backing_filename}"
            
            # Mix voice and backing track
            mixed_filename = f"song_{song_id}_mixed_{uuid.uuid4()}.mp3"
            mixed_path = str(AUDIO_DIR / mixed_filename)
            
            # Use ffmpeg to mix
            mix_cmd = [
                'ffmpeg', '-y',
                '-i', voice_path,
                '-i', backing_path,
                '-filter_complex', '[0:a]volume=1.2[a1];[1:a]volume=0.4[a2];[a1][a2]amix=inputs=2:duration=longest',
                '-acodec', 'libmp3lame', '-q:a', '2',
                mixed_path
            ]
            result = subprocess.run(mix_cmd, capture_output=True, timeout=120)
            
            if result.returncode == 0:
                final_url = f"/uploads/audio/{mixed_filename}"
        
        # Update song
        await db.songs.update_one(
            {"id": song_id},
            {"$set": {
                "audio_url": final_url,
                "backing_track_url": backing_url,
                "voice_profile_id": voice_profile_id,
                "status": "generated",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        final_analysis = analyze_audio_file(str(AUDIO_DIR / final_url.split('/')[-1]))
        
        return {
            "message": "Audio generated successfully with local engine",
            "audio_url": final_url,
            "voice_url": voice_url,
            "backing_track_url": backing_url,
            "duration": final_analysis.get("duration", 0)
        }
        
    except Exception as e:
        logger.error(f"Error generating audio: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating audio: {str(e)}")

@api_router.post("/songs/{song_id}/generate-backing-track")
async def generate_backing_track(song_id: str, user: dict = Depends(get_current_user)):
    """Generate only backing track for a song"""
    song = await db.songs.find_one({"id": song_id, "user_id": user["id"]})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    try:
        backing_filename = f"song_{song_id}_backing_{uuid.uuid4()}.mp3"
        backing_path = str(AUDIO_DIR / backing_filename)
        
        await music_generator.generate_backing_track(
            output_path=backing_path,
            key=song.get("key", "G"),
            tempo=song.get("tempo", 120),
            duration_seconds=120,
            style=song.get("style", "worship")
        )
        
        backing_url = f"/uploads/audio/{backing_filename}"
        
        await db.songs.update_one(
            {"id": song_id},
            {"$set": {"backing_track_url": backing_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"message": "Backing track generated", "backing_track_url": backing_url}
        
    except Exception as e:
        logger.error(f"Error generating backing track: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        raise HTTPException(status_code=400, detail="No file")
    
    file_ext = Path(file.filename).suffix.lower()
    content = await file.read()
    
    filename = f"song_{song_id}_{stem_type}_{uuid.uuid4()}{file_ext}"
    file_path = AUDIO_DIR / filename
    
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    audio_url = f"/uploads/audio/{filename}"
    analysis = analyze_audio_file(str(file_path))
    
    if stem_type == "master":
        await db.songs.update_one({"id": song_id}, {"$set": {"audio_url": audio_url}})
    
    return {"message": "Audio uploaded", "url": audio_url, "duration": analysis.get("duration", 0)}

@api_router.delete("/songs/{song_id}")
async def delete_song(song_id: str, user: dict = Depends(get_current_user)):
    song = await db.songs.find_one({"id": song_id, "user_id": user["id"]})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    await db.songs.delete_one({"id": song_id})
    await db.projects.update_one({"id": song["project_id"]}, {"$pull": {"songs": song_id}})
    return {"message": "Song deleted"}

# ==================== LYRICS ====================

@api_router.post("/lyrics/generate", response_model=LyricsResponse)
async def generate_lyrics(request: LyricsGenerateRequest, user: dict = Depends(get_current_user)):
    try:
        enhanced_prompt = request.prompt
        
        if request.voice_profile_id:
            profile = await db.voice_profiles.find_one({"id": request.voice_profile_id, "user_id": user["id"]})
            if profile:
                enhanced_prompt += f"\n\n[Cantante: voz {profile.get('vocal_range', 'media')}, timbre {profile.get('timbre', 'cálido')}, estilo {profile.get('style', 'worship')}]"
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"lyrics-{user['id']}-{uuid.uuid4()}",
            system_message="""Eres un compositor experto en música cristiana y gospel. 
Crea letras originales, profundas espiritualmente y poéticamente bellas.
Las letras deben ser bíblicamente coherentes e inspiradoras.
NUNCA copies letras existentes. Crea contenido 100% original.
Responde SOLO con las letras estructuradas por secciones."""
        ).with_model("openai", "gpt-5.1")
        
        structure_text = " -> ".join(request.structure)
        prompt = f"""Crea una canción de {request.style} con tema de {request.theme}.
Estructura: {structure_text}
Idioma: {request.language}

Descripción: {enhanced_prompt}

Genera letras originales para esta canción de adoración."""
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        sections = []
        current_section = {"type": "unknown", "content": ""}
        for line in response.split("\n"):
            line = line.strip()
            if not line:
                continue
            lower = line.lower()
            if any(s in lower for s in ["verso", "verse", "coro", "chorus", "puente", "bridge", "intro", "outro"]):
                if current_section["content"]:
                    sections.append(current_section)
                section_type = "verse"
                if "coro" in lower or "chorus" in lower:
                    section_type = "chorus"
                elif "puente" in lower or "bridge" in lower:
                    section_type = "bridge"
                current_section = {"type": section_type, "title": line, "content": ""}
            else:
                current_section["content"] += line + "\n"
        
        if current_section["content"]:
            sections.append(current_section)
        
        return LyricsResponse(lyrics=response, sections=sections)
    except Exception as e:
        logger.error(f"Error generating lyrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== EXPORT ====================

@api_router.post("/songs/{song_id}/export")
async def export_song(song_id: str, format: str = "mp3", user: dict = Depends(get_current_user)):
    song = await db.songs.find_one({"id": song_id, "user_id": user["id"]})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    if not song.get("audio_url"):
        raise HTTPException(status_code=400, detail="No audio to export")
    
    audio_url = song["audio_url"]
    source_path = AUDIO_DIR / Path(audio_url).name
    
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    safe_title = "".join(c for c in song["title"] if c.isalnum() or c in " -_").strip() or "song"
    export_filename = f"{safe_title}_{song_id[:8]}.{format}"
    export_path = EXPORTS_DIR / export_filename
    
    if format == "wav":
        cmd = ['ffmpeg', '-y', '-i', str(source_path), '-acodec', 'pcm_s16le', '-ar', '44100', str(export_path)]
    else:
        cmd = ['ffmpeg', '-y', '-i', str(source_path), '-acodec', 'libmp3lame', '-q:a', '2', str(export_path)]
    
    subprocess.run(cmd, capture_output=True, timeout=120)
    
    return FileResponse(path=str(export_path), filename=export_filename, media_type=f"audio/{format}")

# ==================== TTS DIRECT ====================

@api_router.post("/tts/generate")
async def generate_tts_local(text: str, voice_profile_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Generate TTS using local engine - NO external APIs"""
    try:
        filename = f"tts_{user['id']}_{uuid.uuid4()}.mp3"
        output_path = str(AUDIO_DIR / filename)
        
        await voice_engine.synthesize_speech(
            text=text,
            output_path=output_path,
            profile_id=voice_profile_id,
            language="es"
        )
        
        return {
            "audio_url": f"/uploads/audio/{filename}",
            "text": text,
            "engine": "local"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== HEALTH ====================

@api_router.get("/")
async def root():
    return {
        "message": "PGospelMusic API",
        "version": "3.0.0",
        "engine": "local",
        "features": ["voice_cloning", "tts", "music_generation", "lyrics_ai"]
    }

@api_router.get("/health")
async def health():
    return {"status": "healthy", "engine": "local", "external_apis": False}

# Include router
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
