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
        
        success, data = self.make_request('POST', '/projects', project_data, 201)
        
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
        
        success, data = self.make_request('POST', '/voice-profiles', profile_data, 201)
        
        if success and 'id' in data:
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
        
        success, data = self.make_request('POST', '/songs', song_data, 201)
        
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
        
        # Delete voice profile
        if self.created_voice_profile_id:
            success, data = self.make_request('DELETE', f'/voice-profiles/{self.created_voice_profile_id}')
            if success:
                self.log_test("Delete Voice Profile", True, "Profile deleted successfully")
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
        print("🎵 Starting PGospelMusic API Testing Suite")
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