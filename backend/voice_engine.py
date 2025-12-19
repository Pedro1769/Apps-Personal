"""
PGospelMusic Voice Engine - Sistema de síntesis de voz local
Sin dependencias de APIs externas de pago
"""
import os
import asyncio
import subprocess
import uuid
import json
import numpy as np
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging
import wave
import struct

logger = logging.getLogger(__name__)

# Try to import audio processing libraries
try:
    import librosa
    import soundfile as sf
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    logger.warning("librosa not available, using basic audio processing")

try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False
    logger.warning("edge_tts not available")


class VoiceProfile:
    """Represents a user's voice characteristics extracted from samples"""
    
    def __init__(self, profile_id: str, name: str):
        self.profile_id = profile_id
        self.name = name
        self.pitch_shift = 0.0  # Semitones to shift
        self.speed_factor = 1.0
        self.voice_characteristics = {}
        self.reference_samples = []
        
    def to_dict(self) -> dict:
        return {
            "profile_id": self.profile_id,
            "name": self.name,
            "pitch_shift": self.pitch_shift,
            "speed_factor": self.speed_factor,
            "voice_characteristics": self.voice_characteristics,
            "sample_count": len(self.reference_samples)
        }


class LocalVoiceEngine:
    """
    Local voice synthesis engine that doesn't rely on external paid APIs.
    Uses edge-tts for base synthesis and applies voice transformations.
    """
    
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.voice_profiles: Dict[str, VoiceProfile] = {}
        
        # Available edge-tts voices for Spanish
        self.base_voices = {
            "es-male": "es-MX-JorgeNeural",
            "es-female": "es-MX-DaliaNeural",
            "es-male-ar": "es-AR-TomasNeural",
            "es-female-ar": "es-AR-ElenaNeural",
            "en-male": "en-US-GuyNeural",
            "en-female": "en-US-JennyNeural",
        }
        
    async def analyze_voice_sample(self, audio_path: str) -> dict:
        """Analyze a voice sample to extract characteristics"""
        characteristics = {
            "duration": 0,
            "avg_pitch": 0,
            "pitch_range": 0,
            "energy": 0,
            "tempo_estimate": 0,
            "is_male": True,  # Default assumption
        }
        
        try:
            if LIBROSA_AVAILABLE:
                # Load audio
                y, sr = librosa.load(audio_path, sr=22050)
                
                # Duration
                characteristics["duration"] = librosa.get_duration(y=y, sr=sr)
                
                # Pitch analysis using piptrack
                pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
                pitch_values = []
                for t in range(pitches.shape[1]):
                    index = magnitudes[:, t].argmax()
                    pitch = pitches[index, t]
                    if pitch > 0:
                        pitch_values.append(pitch)
                
                if pitch_values:
                    avg_pitch = np.mean(pitch_values)
                    characteristics["avg_pitch"] = float(avg_pitch)
                    characteristics["pitch_range"] = float(np.std(pitch_values))
                    # Estimate gender based on pitch (rough heuristic)
                    # Male voices typically < 165 Hz, Female > 165 Hz
                    characteristics["is_male"] = avg_pitch < 180
                
                # Energy/loudness
                rms = librosa.feature.rms(y=y)[0]
                characteristics["energy"] = float(np.mean(rms))
                
                # Tempo estimate
                tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
                characteristics["tempo_estimate"] = float(tempo) if isinstance(tempo, (int, float)) else float(tempo[0]) if len(tempo) > 0 else 0
                
            else:
                # Basic analysis using ffprobe
                cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', audio_path]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                if result.returncode == 0:
                    data = json.loads(result.stdout)
                    characteristics["duration"] = float(data.get("format", {}).get("duration", 0))
                    
        except Exception as e:
            logger.error(f"Error analyzing voice sample: {e}")
            
        return characteristics
    
    async def create_voice_profile(self, profile_id: str, name: str, sample_paths: List[str]) -> VoiceProfile:
        """Create a voice profile from audio samples"""
        profile = VoiceProfile(profile_id, name)
        
        all_characteristics = []
        for path in sample_paths:
            if os.path.exists(path):
                chars = await self.analyze_voice_sample(path)
                all_characteristics.append(chars)
                profile.reference_samples.append(path)
        
        if all_characteristics:
            # Aggregate characteristics
            avg_pitch = np.mean([c["avg_pitch"] for c in all_characteristics if c["avg_pitch"] > 0])
            is_male = sum(1 for c in all_characteristics if c["is_male"]) > len(all_characteristics) / 2
            
            profile.voice_characteristics = {
                "avg_pitch": float(avg_pitch) if not np.isnan(avg_pitch) else 150,
                "is_male": is_male,
                "total_duration": sum(c["duration"] for c in all_characteristics),
                "sample_count": len(all_characteristics),
            }
            
            # Calculate pitch shift needed
            # Target: shift base TTS voice to match user's voice
            if is_male:
                base_pitch = 120  # Approximate male TTS pitch
            else:
                base_pitch = 200  # Approximate female TTS pitch
            
            if avg_pitch > 0 and not np.isnan(avg_pitch):
                # Pitch shift in semitones: 12 * log2(target/source)
                profile.pitch_shift = 12 * np.log2(avg_pitch / base_pitch) if base_pitch > 0 else 0
                profile.pitch_shift = max(-12, min(12, profile.pitch_shift))  # Clamp to reasonable range
        
        self.voice_profiles[profile_id] = profile
        return profile
    
    async def synthesize_speech(
        self, 
        text: str, 
        output_path: str,
        profile_id: Optional[str] = None,
        language: str = "es"
    ) -> str:
        """Synthesize speech from text, optionally using a voice profile"""
        
        profile = self.voice_profiles.get(profile_id) if profile_id else None
        
        # Select base voice
        if profile and profile.voice_characteristics.get("is_male") is False:
            base_voice = self.base_voices.get(f"{language}-female", self.base_voices["es-female"])
        else:
            base_voice = self.base_voices.get(f"{language}-male", self.base_voices["es-male"])
        
        # Generate temporary file with edge-tts
        temp_path = str(self.output_dir / f"temp_{uuid.uuid4()}.mp3")
        
        if EDGE_TTS_AVAILABLE:
            try:
                communicate = edge_tts.Communicate(text, base_voice)
                await communicate.save(temp_path)
            except Exception as e:
                logger.error(f"Edge TTS error: {e}")
                # Fallback to basic synthesis
                await self._fallback_synthesis(text, temp_path)
        else:
            await self._fallback_synthesis(text, temp_path)
        
        # Apply voice transformation if profile exists
        if profile and os.path.exists(temp_path):
            await self._apply_voice_transformation(temp_path, output_path, profile)
        else:
            # Just convert to final format
            await self._convert_audio(temp_path, output_path)
        
        # Cleanup temp file
        if os.path.exists(temp_path) and temp_path != output_path:
            os.remove(temp_path)
            
        return output_path
    
    async def _fallback_synthesis(self, text: str, output_path: str):
        """Fallback TTS using espeak or festival"""
        try:
            # Try espeak-ng first
            cmd = ['espeak-ng', '-v', 'es', '-w', output_path, text]
            result = subprocess.run(cmd, capture_output=True, timeout=60)
            if result.returncode != 0:
                raise Exception("espeak-ng failed")
        except:
            try:
                # Try espeak
                cmd = ['espeak', '-v', 'es', '-w', output_path, text]
                subprocess.run(cmd, capture_output=True, timeout=60)
            except:
                # Create silent audio as last resort
                self._create_silent_audio(output_path, duration=len(text) * 0.1)
    
    def _create_silent_audio(self, output_path: str, duration: float = 1.0):
        """Create a silent audio file"""
        sample_rate = 22050
        num_samples = int(sample_rate * duration)
        
        with wave.open(output_path.replace('.mp3', '.wav'), 'w') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(b'\x00' * num_samples * 2)
    
    async def _apply_voice_transformation(self, input_path: str, output_path: str, profile: VoiceProfile):
        """Apply voice transformation using ffmpeg"""
        try:
            filters = []
            
            # Pitch shift
            if abs(profile.pitch_shift) > 0.5:
                # Convert semitones to frequency ratio
                pitch_ratio = 2 ** (profile.pitch_shift / 12)
                # Use rubberband for pitch shifting if available, otherwise asetrate
                filters.append(f"asetrate=22050*{pitch_ratio},aresample=22050")
            
            # Speed adjustment
            if abs(profile.speed_factor - 1.0) > 0.05:
                filters.append(f"atempo={profile.speed_factor}")
            
            # Build ffmpeg command
            if filters:
                filter_str = ",".join(filters)
                cmd = [
                    'ffmpeg', '-y', '-i', input_path,
                    '-af', filter_str,
                    '-acodec', 'libmp3lame', '-q:a', '2',
                    output_path
                ]
            else:
                cmd = [
                    'ffmpeg', '-y', '-i', input_path,
                    '-acodec', 'libmp3lame', '-q:a', '2',
                    output_path
                ]
            
            result = subprocess.run(cmd, capture_output=True, timeout=120)
            if result.returncode != 0:
                logger.error(f"FFmpeg transformation failed: {result.stderr.decode()}")
                # Fallback: just copy
                await self._convert_audio(input_path, output_path)
                
        except Exception as e:
            logger.error(f"Voice transformation error: {e}")
            await self._convert_audio(input_path, output_path)
    
    async def _convert_audio(self, input_path: str, output_path: str):
        """Convert audio to output format"""
        try:
            cmd = ['ffmpeg', '-y', '-i', input_path, '-acodec', 'libmp3lame', '-q:a', '2', output_path]
            subprocess.run(cmd, capture_output=True, timeout=60)
        except Exception as e:
            logger.error(f"Audio conversion error: {e}")
            # Just copy the file
            import shutil
            shutil.copy(input_path, output_path)


class MusicGenerator:
    """
    Simple music/backing track generator using audio synthesis.
    Creates basic accompaniment patterns.
    """
    
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.sample_rate = 44100
        
    def generate_chord(self, root_freq: float, chord_type: str = "major", duration: float = 1.0) -> np.ndarray:
        """Generate a simple chord"""
        t = np.linspace(0, duration, int(self.sample_rate * duration), False)
        
        # Chord intervals (in semitones from root)
        intervals = {
            "major": [0, 4, 7],
            "minor": [0, 3, 7],
            "seventh": [0, 4, 7, 10],
            "sus4": [0, 5, 7],
        }
        
        chord_intervals = intervals.get(chord_type, intervals["major"])
        chord = np.zeros_like(t)
        
        for interval in chord_intervals:
            freq = root_freq * (2 ** (interval / 12))
            chord += 0.3 * np.sin(2 * np.pi * freq * t)
        
        # Apply envelope
        envelope = np.exp(-t * 2)
        return chord * envelope
    
    def note_to_freq(self, note: str) -> float:
        """Convert note name to frequency"""
        notes = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
        note_name = note[0].upper()
        octave = int(note[-1]) if note[-1].isdigit() else 4
        sharp = '#' in note
        
        semitone = notes.get(note_name, 0) + (1 if sharp else 0)
        return 440 * (2 ** ((semitone - 9 + (octave - 4) * 12) / 12))
    
    async def generate_backing_track(
        self, 
        output_path: str,
        key: str = "G",
        tempo: int = 120,
        duration_seconds: float = 60,
        style: str = "worship"
    ) -> str:
        """Generate a simple backing track"""
        
        # Common chord progressions for worship music
        progressions = {
            "worship": ["I", "V", "vi", "IV"],  # Classic worship progression
            "gospel": ["I", "IV", "I", "V"],
            "hymn": ["I", "IV", "V", "I"],
        }
        
        # Scale degrees to chord roots (relative to key)
        degree_intervals = {
            "I": 0, "ii": 2, "iii": 4, "IV": 5, "V": 7, "vi": 9, "vii": 11
        }
        
        # Get chord progression
        progression = progressions.get(style, progressions["worship"])
        
        # Calculate timing
        beat_duration = 60 / tempo
        bar_duration = beat_duration * 4  # 4/4 time
        
        # Generate track
        root_freq = self.note_to_freq(f"{key}3")
        samples = []
        
        current_time = 0
        while current_time < duration_seconds:
            for chord_degree in progression:
                if current_time >= duration_seconds:
                    break
                    
                # Determine chord type
                chord_type = "minor" if chord_degree.islower() else "major"
                
                # Get interval
                interval = degree_intervals.get(chord_degree.upper().replace("I", "I"), 0)
                chord_freq = root_freq * (2 ** (interval / 12))
                
                # Generate chord
                chord = self.generate_chord(chord_freq, chord_type, bar_duration)
                samples.extend(chord.tolist())
                
                current_time += bar_duration
        
        # Convert to numpy array and normalize
        audio = np.array(samples, dtype=np.float32)
        audio = audio / np.max(np.abs(audio)) * 0.7
        
        # Save to file
        try:
            sf.write(output_path, audio, self.sample_rate)
        except:
            # Fallback to wave
            output_wav = output_path.replace('.mp3', '.wav')
            with wave.open(output_wav, 'w') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(self.sample_rate)
                audio_int = (audio * 32767).astype(np.int16)
                wav_file.writeframes(audio_int.tobytes())
            
            # Convert to mp3
            subprocess.run(['ffmpeg', '-y', '-i', output_wav, output_path], capture_output=True)
            os.remove(output_wav)
        
        return output_path


# Global instances
_voice_engine: Optional[LocalVoiceEngine] = None
_music_generator: Optional[MusicGenerator] = None


def get_voice_engine(output_dir: Path) -> LocalVoiceEngine:
    global _voice_engine
    if _voice_engine is None:
        _voice_engine = LocalVoiceEngine(output_dir)
    return _voice_engine


def get_music_generator(output_dir: Path) -> MusicGenerator:
    global _music_generator
    if _music_generator is None:
        _music_generator = MusicGenerator(output_dir)
    return _music_generator
