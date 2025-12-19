from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'pgospelmusic_secret')
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI(title="PGospelMusic API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
    audio_samples: List[str]
    created_at: str
    status: str

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
    status: str
    created_at: str
    updated_at: str

class LyricsGenerateRequest(BaseModel):
    prompt: str
    style: Optional[str] = "worship"
    theme: Optional[str] = "praise"
    language: Optional[str] = "es"
    structure: Optional[List[str]] = ["verse", "chorus", "verse", "chorus", "bridge", "chorus"]

class LyricsResponse(BaseModel):
    lyrics: str
    sections: List[dict]

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
        "status": "pending"
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

@api_router.delete("/voice-profiles/{profile_id}")
async def delete_voice_profile(profile_id: str, user: dict = Depends(get_current_user)):
    result = await db.voice_profiles.delete_one({"id": profile_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
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

@api_router.put("/songs/{song_id}", response_model=SongResponse)
async def update_song(song_id: str, song_data: SongCreate, user: dict = Depends(get_current_user)):
    song = await db.songs.find_one({"id": song_id, "user_id": user["id"]})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    update_data = song_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.songs.update_one({"id": song_id}, {"$set": update_data})
    
    updated = await db.songs.find_one({"id": song_id}, {"_id": 0})
    return SongResponse(**updated)

@api_router.put("/songs/{song_id}/lyrics")
async def update_song_lyrics(song_id: str, lyrics: dict, user: dict = Depends(get_current_user)):
    song = await db.songs.find_one({"id": song_id, "user_id": user["id"]})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    await db.songs.update_one({"id": song_id}, {
        "$set": {"lyrics": lyrics.get("lyrics", ""), "updated_at": datetime.now(timezone.utc).isoformat()}
    })
    return {"message": "Lyrics updated"}

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

Descripción del usuario: {request.prompt}

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

# ==================== HEALTH & ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "PGospelMusic API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

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
