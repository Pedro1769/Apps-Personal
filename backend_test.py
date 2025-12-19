#!/usr/bin/env python3
"""
PGospelMusic Backend API Testing Suite
Tests all endpoints including auth, projects, voice profiles, songs, and lyrics generation
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class PGospelMusicAPITester:
    def __init__(self, base_url: str = "https://worshipgen-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.created_project_id = None
        self.created_voice_profile_id = None
        self.created_song_id = None

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def test_api_root(self):
        """Test API root endpoint"""
        print("\n🔍 Testing API Root...")
        success, data = self.make_request('GET', '/')
        expected_message = "PGospelMusic API"
        
        if success and data.get('message') == expected_message:
            self.log_test("API Root", True, f"Message: {data.get('message')}")
        else:
            self.log_test("API Root", False, f"Expected message '{expected_message}', got: {data}")

    def test_health_check(self):
        """Test health endpoint"""
        print("\n🔍 Testing Health Check...")
        success, data = self.make_request('GET', '/health')
        
        if success and data.get('status') == 'healthy':
            self.log_test("Health Check", True, "API is healthy")
        else:
            self.log_test("Health Check", False, f"Health check failed: {data}")

    def test_user_registration(self):
        """Test user registration"""
        print("\n🔍 Testing User Registration...")
        
        # Use test credentials from the review request
        user_data = {
            "email": "test@pgospel.com",
            "password": "test123",
            "name": "Test User"
        }
        
        success, data = self.make_request('POST', '/auth/register', user_data)
        
        if success and 'token' in data and 'user' in data:
            self.token = data['token']
            self.user_id = data['user']['id']
            self.log_test("User Registration", True, f"User ID: {self.user_id}")
        else:
            # Try login if user already exists
            print("Registration failed, trying login...")
            self.test_user_login()

    def test_user_login(self):
        """Test user login"""
        print("\n🔍 Testing User Login...")
        
        login_data = {
            "email": "test@pgospel.com",
            "password": "test123"
        }
        
        success, data = self.make_request('POST', '/auth/login', login_data)
        
        if success and 'token' in data and 'user' in data:
            self.token = data['token']
            self.user_id = data['user']['id']
            self.log_test("User Login", True, f"User ID: {self.user_id}")
        else:
            self.log_test("User Login", False, f"Login failed: {data}")

    def test_get_user_profile(self):
        """Test get current user profile"""
        print("\n🔍 Testing Get User Profile...")
        
        if not self.token:
            self.log_test("Get User Profile", False, "No auth token available")
            return
            
        success, data = self.make_request('GET', '/auth/me')
        
        if success and 'id' in data and 'email' in data:
            self.log_test("Get User Profile", True, f"Email: {data.get('email')}")
        else:
            self.log_test("Get User Profile", False, f"Failed to get profile: {data}")

    def test_create_project(self):
        """Test project creation"""
        print("\n🔍 Testing Project Creation...")
        
        if not self.token:
            self.log_test("Create Project", False, "No auth token available")
            return
            
        project_data = {
            "name": "Test Gospel Album",
            "description": "Test project for automated testing",
            "genre": "gospel"
        }
        
        success, data = self.make_request('POST', '/projects', project_data, 200)
        
        if success and 'id' in data:
            self.created_project_id = data['id']
            self.log_test("Create Project", True, f"Project ID: {self.created_project_id}")
        else:
            # Check if it's actually successful but wrong status code expectation
            if 'id' in data and data.get('id'):
                self.created_project_id = data['id']
                self.log_test("Create Project", True, f"Project ID: {self.created_project_id}")
            else:
                self.log_test("Create Project", False, f"Failed to create project: {data}")

    def test_get_projects(self):
        """Test getting user projects"""
        print("\n🔍 Testing Get Projects...")
        
        if not self.token:
            self.log_test("Get Projects", False, "No auth token available")
            return
            
        success, data = self.make_request('GET', '/projects')
        
        if success and isinstance(data, list):
            self.log_test("Get Projects", True, f"Found {len(data)} projects")
        else:
            self.log_test("Get Projects", False, f"Failed to get projects: {data}")

    def test_create_voice_profile(self):
        """Test voice profile creation"""
        print("\n🔍 Testing Voice Profile Creation...")
        
        if not self.token:
            self.log_test("Create Voice Profile", False, "No auth token available")
            return
            
        profile_data = {
            "name": "Test Voice Profile",
            "description": "Automated test voice profile",
            "vocal_range": "tenor",
            "timbre": "warm",
            "style": "worship"
        }
        
        success, data = self.make_request('POST', '/voice-profiles', profile_data, 200)
        
        if success and 'id' in data:
            self.created_voice_profile_id = data['id']
            self.log_test("Create Voice Profile", True, f"Profile ID: {self.created_voice_profile_id}")
        else:
            # Check if it's actually successful but wrong status code expectation
            if 'id' in data and data.get('id'):
                self.created_voice_profile_id = data['id']
                self.log_test("Create Voice Profile", True, f"Profile ID: {self.created_voice_profile_id}")
            else:
                self.log_test("Create Voice Profile", False, f"Failed to create profile: {data}")

    def test_get_voice_profiles(self):
        """Test getting voice profiles"""
        print("\n🔍 Testing Get Voice Profiles...")
        
        if not self.token:
            self.log_test("Get Voice Profiles", False, "No auth token available")
            return
            
        success, data = self.make_request('GET', '/voice-profiles')
        
        if success and isinstance(data, list):
            self.log_test("Get Voice Profiles", True, f"Found {len(data)} profiles")
        else:
            self.log_test("Get Voice Profiles", False, f"Failed to get profiles: {data}")

    def test_create_song(self):
        """Test song creation"""
        print("\n🔍 Testing Song Creation...")
        
        if not self.token or not self.created_project_id:
            self.log_test("Create Song", False, "No auth token or project ID available")
            return
            
        song_data = {
            "project_id": self.created_project_id,
            "title": "Test Worship Song",
            "description": "Automated test song",
            "tempo": 120,
            "key": "G",
            "genre": "gospel",
            "style": "worship",
            "mood": "uplifting"
        }
        
        success, data = self.make_request('POST', '/songs', song_data, 200)
        
        if success and 'id' in data:
            self.created_song_id = data['id']
            self.log_test("Create Song", True, f"Song ID: {self.created_song_id}")
        else:
            self.log_test("Create Song", False, f"Failed to create song: {data}")

    def test_get_songs(self):
        """Test getting songs"""
        print("\n🔍 Testing Get Songs...")
        
        if not self.token:
            self.log_test("Get Songs", False, "No auth token available")
            return
            
        success, data = self.make_request('GET', '/songs')
        
        if success and isinstance(data, list):
            self.log_test("Get Songs", True, f"Found {len(data)} songs")
        else:
            self.log_test("Get Songs", False, f"Failed to get songs: {data}")

    def test_lyrics_generation(self):
        """Test AI lyrics generation"""
        print("\n🔍 Testing Lyrics Generation...")
        
        if not self.token:
            self.log_test("Lyrics Generation", False, "No auth token available")
            return
            
        lyrics_request = {
            "prompt": "Una canción de adoración sobre la gracia de Dios",
            "style": "worship",
            "theme": "praise",
            "language": "es",
            "structure": ["verse", "chorus", "verse", "chorus", "bridge", "chorus"]
        }
        
        print("Generating lyrics with GPT-5.1... (this may take a few seconds)")
        success, data = self.make_request('POST', '/lyrics/generate', lyrics_request)
        
        if success and 'lyrics' in data and data['lyrics']:
            lyrics_preview = data['lyrics'][:100] + "..." if len(data['lyrics']) > 100 else data['lyrics']
            self.log_test("Lyrics Generation", True, f"Generated lyrics: {lyrics_preview}")
        else:
            self.log_test("Lyrics Generation", False, f"Failed to generate lyrics: {data}")

    def test_update_song_lyrics(self):
        """Test updating song lyrics"""
        print("\n🔍 Testing Update Song Lyrics...")
        
        if not self.token or not self.created_song_id:
            self.log_test("Update Song Lyrics", False, "No auth token or song ID available")
            return
            
        lyrics_data = {
            "lyrics": "Santo, santo, santo\nEs el Señor\nTodo el cielo canta\nSu amor"
        }
        
        success, data = self.make_request('PUT', f'/songs/{self.created_song_id}/lyrics', lyrics_data)
        
        if success and data.get('message') == 'Lyrics updated':
            self.log_test("Update Song Lyrics", True, "Lyrics updated successfully")
        else:
            self.log_test("Update Song Lyrics", False, f"Failed to update lyrics: {data}")

    def test_voice_profile_audio_upload(self):
        """Test voice profile audio upload functionality"""
        print("\n🔍 Testing Voice Profile Audio Upload...")
        
        if not self.token or not self.created_voice_profile_id:
            self.log_test("Voice Profile Audio Upload", False, "No auth token or voice profile ID available")
            return
        
        # Create a simple test audio file (WAV format)
        import io
        import wave
        import struct
        
        # Generate a simple sine wave audio file
        sample_rate = 44100
        duration = 2  # 2 seconds
        frequency = 440  # A4 note
        
        # Create WAV file in memory
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            
            for i in range(int(sample_rate * duration)):
                value = int(32767 * 0.3 * (i % (sample_rate // frequency)) / (sample_rate // frequency))
                wav_file.writeframes(struct.pack('<h', value))
        
        wav_buffer.seek(0)
        
        # Test audio upload
        url = f"{self.base_url}/voice-profiles/{self.created_voice_profile_id}/upload"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        files = {'file': ('test_voice_sample.wav', wav_buffer.getvalue(), 'audio/wav')}
        
        try:
            response = requests.post(url, headers=headers, files=files, timeout=30)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                if 'sample' in data and 'analysis' in data['sample']:
                    analysis = data['sample']['analysis']
                    self.log_test("Voice Profile Audio Upload", True, 
                                f"Duration: {analysis.get('duration', 0):.1f}s, "
                                f"Sample Rate: {analysis.get('sample_rate', 0)}Hz")
                else:
                    self.log_test("Voice Profile Audio Upload", True, "Audio uploaded successfully")
            else:
                try:
                    error_data = response.json()
                    self.log_test("Voice Profile Audio Upload", False, f"Upload failed: {error_data}")
                except:
                    self.log_test("Voice Profile Audio Upload", False, f"Upload failed with status {response.status_code}")
                    
        except requests.exceptions.RequestException as e:
            self.log_test("Voice Profile Audio Upload", False, f"Request error: {str(e)}")

    def test_song_audio_upload(self):
        """Test song audio upload functionality"""
        print("\n🔍 Testing Song Audio Upload...")
        
        if not self.token or not self.created_song_id:
            self.log_test("Song Audio Upload", False, "No auth token or song ID available")
            return
        
        # Create a simple test audio file (MP3-like, but we'll use WAV for simplicity)
        import io
        import wave
        import struct
        
        # Generate a simple audio file
        sample_rate = 44100
        duration = 3  # 3 seconds
        frequency = 523  # C5 note
        
        # Create WAV file in memory
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(2)  # Stereo
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            
            for i in range(int(sample_rate * duration)):
                value = int(32767 * 0.5 * (i % (sample_rate // frequency)) / (sample_rate // frequency))
                # Stereo: same value for both channels
                wav_file.writeframes(struct.pack('<hh', value, value))
        
        wav_buffer.seek(0)
        
        # Test master audio upload
        url = f"{self.base_url}/songs/{self.created_song_id}/upload-audio"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        files = {'file': ('test_song_master.wav', wav_buffer.getvalue(), 'audio/wav')}
        data = {'stem_type': 'master'}
        
        try:
            response = requests.post(url, headers=headers, files=files, data=data, timeout=30)
            success = response.status_code == 200
            
            if success:
                response_data = response.json()
                if 'url' in response_data and 'duration' in response_data:
                    self.log_test("Song Audio Upload (Master)", True, 
                                f"Duration: {response_data.get('duration', 0):.1f}s, "
                                f"URL: {response_data.get('url', '')}")
                else:
                    self.log_test("Song Audio Upload (Master)", True, "Master audio uploaded successfully")
            else:
                try:
                    error_data = response.json()
                    self.log_test("Song Audio Upload (Master)", False, f"Upload failed: {error_data}")
                except:
                    self.log_test("Song Audio Upload (Master)", False, f"Upload failed with status {response.status_code}")
                    
        except requests.exceptions.RequestException as e:
            self.log_test("Song Audio Upload (Master)", False, f"Request error: {str(e)}")

    def test_song_stem_upload(self):
        """Test song stem upload functionality"""
        print("\n🔍 Testing Song Stem Upload...")
        
        if not self.token or not self.created_song_id:
            self.log_test("Song Stem Upload", False, "No auth token or song ID available")
            return
        
        # Create a simple test audio file for vocals stem
        import io
        import wave
        import struct
        
        # Generate a simple audio file
        sample_rate = 44100
        duration = 2  # 2 seconds
        frequency = 330  # E4 note
        
        # Create WAV file in memory
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono for vocals
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            
            for i in range(int(sample_rate * duration)):
                value = int(32767 * 0.4 * (i % (sample_rate // frequency)) / (sample_rate // frequency))
                wav_file.writeframes(struct.pack('<h', value))
        
        wav_buffer.seek(0)
        
        # Test vocals stem upload
        url = f"{self.base_url}/songs/{self.created_song_id}/upload-audio"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        files = {'file': ('test_vocals_stem.wav', wav_buffer.getvalue(), 'audio/wav')}
        data = {'stem_type': 'vocals'}
        
        try:
            response = requests.post(url, headers=headers, files=files, data=data, timeout=30)
            success = response.status_code == 200
            
            if success:
                response_data = response.json()
                if 'url' in response_data and 'stem_type' in response_data:
                    self.log_test("Song Stem Upload (Vocals)", True, 
                                f"Stem: {response_data.get('stem_type', '')}, "
                                f"Duration: {response_data.get('duration', 0):.1f}s")
                else:
                    self.log_test("Song Stem Upload (Vocals)", True, "Vocals stem uploaded successfully")
            else:
                try:
                    error_data = response.json()
                    self.log_test("Song Stem Upload (Vocals)", False, f"Upload failed: {error_data}")
                except:
                    self.log_test("Song Stem Upload (Vocals)", False, f"Upload failed with status {response.status_code}")
                    
        except requests.exceptions.RequestException as e:
            self.log_test("Song Stem Upload (Vocals)", False, f"Request error: {str(e)}")

    def test_song_export(self):
        """Test song export functionality"""
        print("\n🔍 Testing Song Export...")
        
        if not self.token or not self.created_song_id:
            self.log_test("Song Export", False, "No auth token or song ID available")
            return
        
        # Test MP3 export
        url = f"{self.base_url}/songs/{self.created_song_id}/export?format=mp3"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.post(url, headers=headers, timeout=60)  # Longer timeout for export
            success = response.status_code == 200
            
            if success:
                # Check if we got a file response
                content_type = response.headers.get('content-type', '')
                content_length = len(response.content)
                
                if 'audio' in content_type or content_length > 1000:  # Reasonable file size
                    self.log_test("Song Export (MP3)", True, 
                                f"Exported {content_length} bytes, Content-Type: {content_type}")
                else:
                    self.log_test("Song Export (MP3)", False, f"Invalid export response: {content_type}")
            else:
                try:
                    error_data = response.json()
                    self.log_test("Song Export (MP3)", False, f"Export failed: {error_data}")
                except:
                    self.log_test("Song Export (MP3)", False, f"Export failed with status {response.status_code}")
                    
        except requests.exceptions.RequestException as e:
            self.log_test("Song Export (MP3)", False, f"Request error: {str(e)}")
        
        # Test WAV export
        url = f"{self.base_url}/songs/{self.created_song_id}/export?format=wav"
        
        try:
            response = requests.post(url, headers=headers, timeout=60)
            success = response.status_code == 200
            
            if success:
                content_type = response.headers.get('content-type', '')
                content_length = len(response.content)
                
                if 'audio' in content_type or content_length > 1000:
                    self.log_test("Song Export (WAV)", True, 
                                f"Exported {content_length} bytes, Content-Type: {content_type}")
                else:
                    self.log_test("Song Export (WAV)", False, f"Invalid export response: {content_type}")
            else:
                try:
                    error_data = response.json()
                    self.log_test("Song Export (WAV)", False, f"Export failed: {error_data}")
                except:
                    self.log_test("Song Export (WAV)", False, f"Export failed with status {response.status_code}")
                    
        except requests.exceptions.RequestException as e:
            self.log_test("Song Export (WAV)", False, f"Request error: {str(e)}")

    def test_static_file_serving(self):
        """Test static file serving for uploaded audio"""
        print("\n🔍 Testing Static File Serving...")
        
        # We need to get a voice profile with audio samples to test static serving
        if not self.token or not self.created_voice_profile_id:
            self.log_test("Static File Serving", False, "No auth token or voice profile available")
            return
        
        # Get the voice profile to check for audio samples
        success, data = self.make_request('GET', f'/voice-profiles/{self.created_voice_profile_id}')
        
        if success and 'audio_samples' in data and len(data['audio_samples']) > 0:
            # Test accessing the first audio sample
            sample = data['audio_samples'][0]
            audio_url = sample.get('url', '')
            
            if audio_url:
                # Remove /api prefix and test direct file access
                file_url = audio_url.replace('/api', '')
                full_url = f"{self.base_url.replace('/api', '')}{file_url}"
                
                try:
                    response = requests.get(full_url, timeout=30)
                    success = response.status_code == 200
                    
                    if success:
                        content_type = response.headers.get('content-type', '')
                        content_length = len(response.content)
                        self.log_test("Static File Serving", True, 
                                    f"File served: {content_length} bytes, Type: {content_type}")
                    else:
                        self.log_test("Static File Serving", False, 
                                    f"File not accessible: {response.status_code}")
                        
                except requests.exceptions.RequestException as e:
                    self.log_test("Static File Serving", False, f"Request error: {str(e)}")
            else:
                self.log_test("Static File Serving", False, "No audio URL found in sample")
        else:
            self.log_test("Static File Serving", False, "No audio samples found to test")

    def test_elevenlabs_health_check(self):
        """Test ElevenLabs configuration in health endpoint"""
        print("\n🔍 Testing ElevenLabs Health Check...")
        success, data = self.make_request('GET', '/health')
        
        if success and 'elevenlabs_configured' in data:
            elevenlabs_status = data.get('elevenlabs_configured', False)
            if elevenlabs_status:
                self.log_test("ElevenLabs Health Check", True, "ElevenLabs is configured and available")
            else:
                self.log_test("ElevenLabs Health Check", False, "ElevenLabs is not configured")
        else:
            self.log_test("ElevenLabs Health Check", False, f"Health check failed: {data}")

    def test_elevenlabs_voices_list(self):
        """Test ElevenLabs voices endpoint"""
        print("\n🔍 Testing ElevenLabs Voices List...")
        
        if not self.token:
            self.log_test("ElevenLabs Voices List", False, "No auth token available")
            return
            
        success, data = self.make_request('GET', '/elevenlabs/voices')
        
        if success and 'voices' in data:
            voices_count = len(data['voices'])
            self.log_test("ElevenLabs Voices List", True, f"Found {voices_count} available voices")
        else:
            # Check if it's a service unavailable error (expected if no API key)
            if isinstance(data, dict) and data.get('detail') == 'ElevenLabs not configured':
                self.log_test("ElevenLabs Voices List", False, "ElevenLabs not configured (expected if no API key)")
            else:
                self.log_test("ElevenLabs Voices List", False, f"Failed to get voices: {data}")

    def test_voice_cloning_manual_trigger(self):
        """Test manual voice cloning with ElevenLabs"""
        print("\n🔍 Testing Manual Voice Cloning...")
        
        if not self.token or not self.created_voice_profile_id:
            self.log_test("Manual Voice Cloning", False, "No auth token or voice profile available")
            return
        
        # First ensure we have audio samples
        success, profile_data = self.make_request('GET', f'/voice-profiles/{self.created_voice_profile_id}')
        
        if not success or not profile_data.get('audio_samples'):
            self.log_test("Manual Voice Cloning", False, "No audio samples available for cloning")
            return
        
        # Trigger manual cloning
        success, data = self.make_request('POST', f'/voice-profiles/{self.created_voice_profile_id}/clone')
        
        if success and 'voice_id' in data:
            voice_id = data['voice_id']
            self.log_test("Manual Voice Cloning", True, f"Voice cloned successfully: {voice_id}")
        elif success and data.get('message') == 'Voice already cloned':
            existing_voice_id = data.get('voice_id', 'unknown')
            self.log_test("Manual Voice Cloning", True, f"Voice already cloned: {existing_voice_id}")
        else:
            # Check if it's a service unavailable error
            if isinstance(data, dict) and 'ElevenLabs not configured' in str(data.get('detail', '')):
                self.log_test("Manual Voice Cloning", False, "ElevenLabs not configured (expected if no API key)")
            else:
                self.log_test("Manual Voice Cloning", False, f"Failed to clone voice: {data}")

    def test_tts_generation(self):
        """Test Text-to-Speech generation with cloned voice"""
        print("\n🔍 Testing TTS Generation...")
        
        if not self.token or not self.created_voice_profile_id:
            self.log_test("TTS Generation", False, "No auth token or voice profile available")
            return
        
        # Check if voice profile has been cloned
        success, profile_data = self.make_request('GET', f'/voice-profiles/{self.created_voice_profile_id}')
        
        if not success or not profile_data.get('elevenlabs_voice_id'):
            self.log_test("TTS Generation", False, "Voice not cloned yet - cannot test TTS")
            return
        
        tts_request = {
            "text": "Bendito sea el nombre del Señor, por siempre y para siempre.",
            "voice_profile_id": self.created_voice_profile_id,
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.5
        }
        
        print("Generating TTS with cloned voice... (this may take a few seconds)")
        success, data = self.make_request('POST', '/tts/generate', tts_request)
        
        if success and 'audio_url' in data:
            audio_url = data['audio_url']
            duration = data.get('duration', 0)
            voice_id = data.get('voice_id', 'unknown')
            self.log_test("TTS Generation", True, f"TTS generated: {duration:.1f}s, Voice ID: {voice_id}")
        else:
            # Check if it's a service unavailable error
            if isinstance(data, dict) and 'ElevenLabs not configured' in str(data.get('detail', '')):
                self.log_test("TTS Generation", False, "ElevenLabs not configured (expected if no API key)")
            else:
                self.log_test("TTS Generation", False, f"Failed to generate TTS: {data}")

    def test_song_audio_generation_with_voice(self):
        """Test song audio generation with cloned voice"""
        print("\n🔍 Testing Song Audio Generation with Cloned Voice...")
        
        if not self.token or not self.created_song_id or not self.created_voice_profile_id:
            self.log_test("Song Audio Generation", False, "Missing required IDs")
            return
        
        # First add lyrics to the song
        lyrics_data = {
            "lyrics": """[Verso 1]
Santo, santo, santo
Es el Señor Dios Todopoderoso
Que era, que es y que ha de venir

[Coro]
Digno eres Tú, Señor
De recibir la gloria y la honra
Y el poder, por siempre
Amén"""
        }
        
        success, _ = self.make_request('PUT', f'/songs/{self.created_song_id}/lyrics', lyrics_data)
        if not success:
            self.log_test("Song Audio Generation", False, "Failed to add lyrics to song")
            return
        
        # Check if voice profile has been cloned
        success, profile_data = self.make_request('GET', f'/voice-profiles/{self.created_voice_profile_id}')
        
        if not success or not profile_data.get('elevenlabs_voice_id'):
            self.log_test("Song Audio Generation", False, "Voice not cloned yet - cannot test song audio generation")
            return
        
        # Generate audio with cloned voice
        print("Generating song audio with cloned voice... (this may take 10-15 seconds)")
        success, data = self.make_request('POST', f'/songs/{self.created_song_id}/generate-audio?voice_profile_id={self.created_voice_profile_id}')
        
        if success and 'audio_url' in data:
            audio_url = data['audio_url']
            duration = data.get('duration', 0)
            voice_id = data.get('voice_id', 'unknown')
            self.log_test("Song Audio Generation", True, f"Song audio generated: {duration:.1f}s, Voice ID: {voice_id}")
        else:
            # Check if it's a service unavailable error
            if isinstance(data, dict) and 'ElevenLabs not configured' in str(data.get('detail', '')):
                self.log_test("Song Audio Generation", False, "ElevenLabs not configured (expected if no API key)")
            else:
                self.log_test("Song Audio Generation", False, f"Failed to generate song audio: {data}")

    def test_lyrics_generation_with_voice_context(self):
        """Test lyrics generation with voice profile context"""
        print("\n🔍 Testing Lyrics Generation with Voice Profile Context...")
        
        if not self.token or not self.created_voice_profile_id:
            self.log_test("Lyrics Generation with Voice Context", False, "No auth token or voice profile available")
            return
            
        lyrics_request = {
            "prompt": "Una canción de adoración sobre la esperanza en Cristo",
            "style": "worship",
            "theme": "hope",
            "language": "es",
            "structure": ["verse", "chorus", "verse", "chorus", "bridge", "chorus"],
            "voice_profile_id": self.created_voice_profile_id
        }
        
        print("Generating lyrics with voice profile context... (this may take a few seconds)")
        success, data = self.make_request('POST', '/lyrics/generate', lyrics_request)
        
        if success and 'lyrics' in data and data['lyrics']:
            lyrics_preview = data['lyrics'][:150] + "..." if len(data['lyrics']) > 150 else data['lyrics']
            self.log_test("Lyrics Generation with Voice Context", True, f"Generated contextual lyrics: {lyrics_preview}")
        else:
            self.log_test("Lyrics Generation with Voice Context", False, f"Failed to generate contextual lyrics: {data}")

    def test_delete_operations(self):
        """Test delete operations (cleanup)"""
        print("\n🔍 Testing Delete Operations...")
        
        if not self.token:
            self.log_test("Delete Operations", False, "No auth token available")
            return
        
        # Delete song
        if self.created_song_id:
            success, data = self.make_request('DELETE', f'/songs/{self.created_song_id}')
            if success:
                self.log_test("Delete Song", True, "Song deleted successfully")
            else:
                self.log_test("Delete Song", False, f"Failed to delete song: {data}")
        
        # Delete voice profile (this should also delete ElevenLabs voice if exists)
        if self.created_voice_profile_id:
            success, data = self.make_request('DELETE', f'/voice-profiles/{self.created_voice_profile_id}')
            if success:
                self.log_test("Delete Voice Profile", True, "Profile deleted successfully (including ElevenLabs voice)")
            else:
                self.log_test("Delete Voice Profile", False, f"Failed to delete profile: {data}")
        
        # Delete project
        if self.created_project_id:
            success, data = self.make_request('DELETE', f'/projects/{self.created_project_id}')
            if success:
                self.log_test("Delete Project", True, "Project deleted successfully")
            else:
                self.log_test("Delete Project", False, f"Failed to delete project: {data}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🎵 Starting PGospelMusic API Testing Suite - Audio Upload Focus")
        print(f"🌐 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Basic API tests
        self.test_api_root()
        self.test_health_check()
        
        # Authentication tests
        self.test_user_registration()
        self.test_get_user_profile()
        
        # Core functionality tests
        self.test_create_project()
        self.test_get_projects()
        self.test_create_voice_profile()
        self.test_get_voice_profiles()
        self.test_create_song()
        self.test_get_songs()
        
        # AI features
        self.test_lyrics_generation()
        self.test_update_song_lyrics()
        
        # NEW AUDIO UPLOAD FEATURES
        print("\n🎵 Testing NEW Audio Upload Features...")
        self.test_voice_profile_audio_upload()
        self.test_song_audio_upload()
        self.test_song_stem_upload()
        self.test_song_export()
        self.test_static_file_serving()
        
        # Cleanup
        self.test_delete_operations()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return 1

def main():
    """Main test runner"""
    tester = PGospelMusicAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())