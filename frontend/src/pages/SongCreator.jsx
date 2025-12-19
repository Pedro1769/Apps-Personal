import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Music4, Wand2, Save, Loader2, Play, Pause,
  SkipBack, SkipForward, Volume2, VolumeX, Download,
  Layers, Settings2, ChevronDown, ChevronUp, Sparkles,
  Upload, FileAudio, X, Check, Mic, User, Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Slider } from '../components/ui/slider';
import { Progress } from '../components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const musicalKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const genres = ['gospel', 'worship', 'contemporary', 'traditional', 'choir', 'hymn'];
const moods = ['uplifting', 'intimate', 'powerful', 'peaceful', 'joyful', 'reflective'];
const structureParts = ['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'vamp', 'outro'];
const instruments = [
  { id: 'piano', name: 'Piano', icon: '🎹' },
  { id: 'guitar', name: 'Guitarra', icon: '🎸' },
  { id: 'drums', name: 'Batería', icon: '🥁' },
  { id: 'bass', name: 'Bajo', icon: '🎸' },
  { id: 'strings', name: 'Cuerdas', icon: '🎻' },
  { id: 'synth', name: 'Sintetizador', icon: '🎛️' },
  { id: 'organ', name: 'Órgano', icon: '🎹' },
  { id: 'choir', name: 'Coro', icon: '🎤' },
];

const stemTypes = [
  { id: 'vocals', name: 'Voz Principal', icon: '🎤' },
  { id: 'backing', name: 'Coros', icon: '🎶' },
  { id: 'piano', name: 'Piano', icon: '🎹' },
  { id: 'drums', name: 'Batería', icon: '🥁' },
  { id: 'bass', name: 'Bajo', icon: '🎸' },
  { id: 'strings', name: 'Cuerdas', icon: '🎻' },
];

const themes = [
  { value: 'praise', label: 'Alabanza' },
  { value: 'worship', label: 'Adoración' },
  { value: 'gratitude', label: 'Gratitud' },
  { value: 'spiritual_warfare', label: 'Guerra Espiritual' },
  { value: 'intimacy', label: 'Intimidad' },
  { value: 'congregational', label: 'Congregacional' },
  { value: 'salvation', label: 'Salvación' },
  { value: 'hope', label: 'Esperanza' },
];

const SongCreator = ({ token }) => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const stemFileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(false);
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [progress, setProgress] = useState([0]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showStructure, setShowStructure] = useState(true);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStemUpload, setCurrentStemUpload] = useState(null);
  const [savedSongId, setSavedSongId] = useState(null);
  
  const [voiceProfiles, setVoiceProfiles] = useState([]);
  const [selectedVoiceProfile, setSelectedVoiceProfile] = useState('');
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  const [song, setSong] = useState({
    title: '',
    description: '',
    tempo: 120,
    key: 'G',
    genre: 'worship',
    style: 'modern',
    mood: 'uplifting',
    structure: ['intro', 'verse', 'chorus', 'verse', 'chorus', 'bridge', 'chorus', 'outro'],
    instruments: ['piano', 'drums', 'bass', 'strings'],
    lyrics: '',
    audio_url: null,
    stems: null,
  });

  const [lyricsPrompt, setLyricsPrompt] = useState('');
  const [lyricsTheme, setLyricsTheme] = useState('worship');

  useEffect(() => {
    const fetchVoiceProfiles = async () => {
      try {
        const response = await axios.get(`${API}/voice-profiles`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setVoiceProfiles(response.data);
        const readyProfile = response.data.find(p => p.status === 'ready' && p.voice_cloned);
        if (readyProfile) {
          setSelectedVoiceProfile(readyProfile.id);
        } else {
          const anyProfile = response.data.find(p => p.audio_samples?.length > 0);
          if (anyProfile) setSelectedVoiceProfile(anyProfile.id);
        }
      } catch (error) {
        console.error('Error fetching voice profiles:', error);
      } finally {
        setLoadingProfiles(false);
      }
    };
    if (token) fetchVoiceProfiles();
  }, [token]);

  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => {
      if (audio && !isNaN(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration)) {
          setProgress([(audio.currentTime / audio.duration) * 100]);
        }
      }
    };
    
    const handleLoadedMetadata = () => {
      if (audio && !isNaN(audio.duration)) setDuration(audio.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress([0]);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume[0] / 100;
    }
  }, [volume, isMuted]);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveSong = async () => {
    if (!projectId) {
      toast.error('Selecciona un proyecto primero');
      return;
    }
    if (!song.title) {
      toast.error('El título es requerido');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        project_id: projectId,
        title: song.title,
        description: song.description,
        tempo: song.tempo,
        key: song.key,
        genre: song.genre,
        style: song.style,
        mood: song.mood,
        structure: song.structure,
        instruments: song.instruments,
        voice_profile_id: selectedVoiceProfile || null,
      };
      
      const response = await axios.post(`${API}/songs`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setSavedSongId(response.data.id);
      
      if (song.lyrics) {
        await axios.put(
          `${API}/songs/${response.data.id}/lyrics`,
          { lyrics: song.lyrics },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      toast.success('Canción guardada exitosamente');
    } catch (error) {
      toast.error('Error al guardar la canción');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLyrics = async () => {
    if (!lyricsPrompt.trim()) {
      toast.error('Describe la canción que quieres crear');
      return;
    }

    setGeneratingLyrics(true);
    try {
      const response = await axios.post(
        `${API}/lyrics/generate`,
        {
          prompt: lyricsPrompt,
          style: song.style,
          theme: lyricsTheme,
          language: 'es',
          structure: song.structure,
          voice_profile_id: selectedVoiceProfile || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSong({ ...song, lyrics: response.data.lyrics });
      toast.success('¡Letras generadas exitosamente!');
      setActiveTab('lyrics');
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al generar letras';
      toast.error(message);
    } finally {
      setGeneratingLyrics(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!savedSongId) {
      toast.error('Guarda la canción primero');
      return;
    }
    if (!song.lyrics) {
      toast.error('Genera o escribe las letras primero');
      return;
    }
    if (!selectedVoiceProfile) {
      toast.error('Selecciona un perfil de voz');
      return;
    }

    const profile = voiceProfiles.find(p => p.id === selectedVoiceProfile);
    if (!profile?.voice_cloned) {
      toast.error('Tu voz no ha sido procesada aún. Sube muestras de voz primero.');
      return;
    }

    setGeneratingAudio(true);
    toast.info('Generando audio con tu voz... Esto puede tomar unos segundos.');

    try {
      const response = await axios.post(
        `${API}/songs/${savedSongId}/generate-audio?voice_profile_id=${selectedVoiceProfile}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSong({ ...song, audio_url: response.data.audio_url });
      
      if (audioRef.current) {
        audioRef.current.src = `${BACKEND_URL}${response.data.audio_url}`;
      }

      toast.success(`¡Audio generado! Duración: ${formatTime(response.data.duration)}`);
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al generar audio';
      toast.error(message);
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleCloneVoice = async () => {
    if (!selectedVoiceProfile) {
      toast.error('Selecciona un perfil de voz primero');
      return;
    }

    try {
      toast.info('Clonando tu voz con ElevenLabs...');
      const response = await axios.post(
        `${API}/voice-profiles/${selectedVoiceProfile}/clone`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh profiles
      const profilesResponse = await axios.get(`${API}/voice-profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVoiceProfiles(profilesResponse.data);
      
      toast.success('¡Voz clonada exitosamente!');
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al clonar voz';
      toast.error(message);
    }
  };

  const handleAudioUpload = async (e, stemType = 'master') => {
    const file = e.target.files?.[0];
    if (!file || !savedSongId) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('stem_type', stemType);

    try {
      setUploadingAudio(true);
      setCurrentStemUpload(stemType);
      setUploadProgress(0);

      const response = await axios.post(
        `${API}/songs/${savedSongId}/upload-audio`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total)),
        }
      );

      if (stemType === 'master') {
        setSong({ ...song, audio_url: response.data.url });
        if (audioRef.current) audioRef.current.src = `${BACKEND_URL}${response.data.url}`;
      } else {
        setSong({ ...song, stems: { ...(song.stems || {}), [stemType]: response.data } });
      }

      toast.success('Audio subido correctamente');
    } catch (error) {
      toast.error('Error al subir audio');
    } finally {
      setUploadingAudio(false);
      setCurrentStemUpload(null);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (stemFileInputRef.current) stemFileInputRef.current.value = '';
    }
  };

  const handlePlayPause = useCallback(() => {
    if (!song.audio_url) {
      toast.error('No hay audio. Genera o sube uno.');
      return;
    }
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current.src) audioRef.current.src = `${BACKEND_URL}${song.audio_url}`;
      audioRef.current.play().catch(() => toast.error('Error al reproducir'));
      setIsPlaying(true);
    }
  }, [song.audio_url, isPlaying]);

  const handleSeek = (value) => {
    if (!audioRef.current || !duration) return;
    const newTime = (value[0] / 100) * duration;
    audioRef.current.currentTime = newTime;
    setProgress(value);
    setCurrentTime(newTime);
  };

  const handleExport = async (format = 'mp3') => {
    if (!savedSongId || !song.audio_url) {
      toast.error('Genera audio primero');
      return;
    }

    try {
      toast.info(`Exportando a ${format.toUpperCase()}...`);
      const response = await axios.post(
        `${API}/songs/${savedSongId}/export?format=${format}`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${song.title || 'song'}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Exportado como ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Error al exportar');
    }
  };

  const toggleStructurePart = (part) => {
    const newStructure = song.structure.includes(part)
      ? song.structure.filter((p) => p !== part)
      : [...song.structure, part];
    setSong({ ...song, structure: newStructure });
  };

  const toggleInstrument = (instrumentId) => {
    const newInstruments = song.instruments.includes(instrumentId)
      ? song.instruments.filter((i) => i !== instrumentId)
      : [...song.instruments, instrumentId];
    setSong({ ...song, instruments: newInstruments });
  };

  const getSelectedProfileInfo = () => voiceProfiles.find(p => p.id === selectedVoiceProfile);

  return (
    <div className="min-h-screen pt-20 pb-32">
      <input type="file" ref={fileInputRef} onChange={(e) => handleAudioUpload(e, 'master')} accept="audio/*" className="hidden" />
      <input type="file" ref={stemFileInputRef} onChange={(e) => handleAudioUpload(e, currentStemUpload || 'master')} accept="audio/*" className="hidden" />

      <div className="container-divine">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-6 border-b border-white/5 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D8A45A] to-[#7C5AB9] flex items-center justify-center">
              <Music4 className="w-6 h-6 text-[#0B0C0E]" />
            </div>
            <div>
              <Input
                value={song.title}
                onChange={(e) => setSong({ ...song, title: e.target.value })}
                placeholder="Título de la canción"
                data-testid="song-title-input"
                className="text-2xl font-cinzel font-bold bg-transparent border-none text-[#E6E7E9] focus:ring-0 p-0 h-auto"
              />
              <p className="text-sm text-[#6B7280]">
                {projectId ? (savedSongId ? `Guardada • ${savedSongId.slice(0,8)}` : 'Nueva canción') : 'Sin proyecto'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSaveSong} disabled={loading} data-testid="save-song-btn" className="btn-primary">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />{savedSongId ? 'Actualizar' : 'Guardar'}</>}
            </Button>
          </div>
        </div>

        {uploadingAudio && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-xl bg-[#D8A45A]/10 border border-[#D8A45A]/30">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 text-[#D8A45A] animate-spin" />
              <span className="text-[#E6E7E9]">Subiendo audio...</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </motion.div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Voice Profile */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-divine">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#7C5AB9]/20 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-[#A680FF]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#E6E7E9]">Tu Voz</h3>
                  <p className="text-xs text-[#6B7280]">Motor de voz local</p>
                </div>
              </div>

              {loadingProfiles ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 text-[#7C5AB9] animate-spin" /></div>
              ) : voiceProfiles.length === 0 ? (
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <p className="text-orange-400 text-sm">No tienes perfiles de voz. Ve a Voice Studio para crear uno.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Select value={selectedVoiceProfile} onValueChange={setSelectedVoiceProfile}>
                    <SelectTrigger data-testid="voice-profile-select" className="input-divine">
                      <SelectValue placeholder="Selecciona tu perfil" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1D23] border-white/10">
                      {voiceProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id} className="text-[#E6E7E9] hover:bg-white/10">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{profile.name}</span>
                            {profile.voice_cloned && <Check className="w-3 h-3 text-green-500" />}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {getSelectedProfileInfo() && (
                    <div className="p-3 rounded-lg bg-[#7C5AB9]/10 border border-[#7C5AB9]/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[#E6E7E9]">{getSelectedProfileInfo().name}</span>
                        {getSelectedProfileInfo().elevenlabs_voice_id ? (
                          <span className="text-xs text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Clonada</span>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={handleCloneVoice} className="text-xs text-[#D8A45A] h-6">
                            <Zap className="w-3 h-3 mr-1" /> Clonar Voz
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><span className="text-[#6B7280]">Rango:</span> <span className="text-[#A9ADB1] capitalize">{getSelectedProfileInfo().vocal_range}</span></div>
                        <div><span className="text-[#6B7280]">Timbre:</span> <span className="text-[#A9ADB1] capitalize">{getSelectedProfileInfo().timbre}</span></div>
                        <div><span className="text-[#6B7280]">Muestras:</span> <span className="text-[#D8A45A]">{getSelectedProfileInfo().audio_samples?.length || 0}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* AI Lyrics Generator */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-divine">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#D8A45A]/20 flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-[#D8A45A]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#E6E7E9]">Generador de Letras</h3>
                  <p className="text-xs text-[#6B7280]">GPT-5.1</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-[#A9ADB1] text-sm">Tema Espiritual</Label>
                  <Select value={lyricsTheme} onValueChange={setLyricsTheme}>
                    <SelectTrigger className="input-divine mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1A1D23] border-white/10">
                      {themes.map((theme) => (<SelectItem key={theme.value} value={theme.value} className="text-[#E6E7E9] hover:bg-white/10">{theme.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[#A9ADB1] text-sm">Descripción Detallada</Label>
                  <Textarea
                    value={lyricsPrompt}
                    onChange={(e) => setLyricsPrompt(e.target.value)}
                    placeholder="Describe tu canción en detalle: el mensaje, atmósfera, versículos de inspiración..."
                    data-testid="lyrics-prompt-input"
                    className="input-divine mt-1 min-h-[150px]"
                  />
                </div>

                <Button onClick={handleGenerateLyrics} disabled={generatingLyrics} data-testid="generate-lyrics-btn" className="btn-primary w-full">
                  {generatingLyrics ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Generando...</> : <><Sparkles className="w-5 h-5 mr-2" />Generar Letras</>}
                </Button>
              </div>
            </motion.div>

            {/* Generate Audio Button */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-divine bg-gradient-to-br from-[#D8A45A]/10 to-[#7C5AB9]/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#D8A45A] to-[#7C5AB9] flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#E6E7E9]">Generar Audio</h3>
                  <p className="text-xs text-[#6B7280]">Con tu voz clonada</p>
                </div>
              </div>
              
              <p className="text-sm text-[#A9ADB1] mb-4">
                Usa tu voz clonada para generar el audio de la canción basado en las letras.
              </p>

              <Button 
                onClick={handleGenerateAudio} 
                disabled={generatingAudio || !savedSongId || !song.lyrics || !selectedVoiceProfile}
                data-testid="generate-audio-btn"
                className="w-full bg-gradient-to-r from-[#D8A45A] to-[#7C5AB9] hover:from-[#E6B86E] hover:to-[#8B6BC4] text-white font-semibold"
              >
                {generatingAudio ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" />Generando con tu voz...</>
                ) : (
                  <><Mic className="w-5 h-5 mr-2" />Generar Audio con Mi Voz</>
                )}
              </Button>
              
              {!savedSongId && <p className="text-xs text-orange-400 mt-2">Guarda la canción primero</p>}
              {savedSongId && !song.lyrics && <p className="text-xs text-orange-400 mt-2">Genera las letras primero</p>}
              {savedSongId && song.lyrics && !selectedVoiceProfile && <p className="text-xs text-orange-400 mt-2">Selecciona un perfil de voz</p>}
            </motion.div>

            {/* Music Controls */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-divine">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#7C5AB9]/20 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-[#A680FF]" />
                </div>
                <h3 className="font-semibold text-[#E6E7E9]">Controles Musicales</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2"><Label className="text-[#A9ADB1] text-sm">Tempo</Label><span className="text-[#D8A45A] font-mono text-sm">{song.tempo} BPM</span></div>
                  <Slider value={[song.tempo]} onValueChange={([v]) => setSong({ ...song, tempo: v })} min={60} max={180} className="[&_[role=slider]]:bg-[#D8A45A]" />
                </div>
                <div>
                  <Label className="text-[#A9ADB1] text-sm">Tonalidad</Label>
                  <Select value={song.key} onValueChange={(v) => setSong({ ...song, key: v })}>
                    <SelectTrigger className="input-divine mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1A1D23] border-white/10">
                      {musicalKeys.map((k) => (<SelectItem key={k} value={k} className="text-[#E6E7E9]">{k} Mayor</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[#A9ADB1] text-sm">Género</Label>
                  <Select value={song.genre} onValueChange={(v) => setSong({ ...song, genre: v })}>
                    <SelectTrigger className="input-divine mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#1A1D23] border-white/10">
                      {genres.map((g) => (<SelectItem key={g} value={g} className="text-[#E6E7E9] capitalize">{g}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Panel */}
          <div className="col-span-12 lg:col-span-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-[#111318] border border-white/5 p-1 rounded-xl mb-6">
                <TabsTrigger value="details" className="data-[state=active]:bg-[#D8A45A]/20 data-[state=active]:text-[#D8A45A] rounded-lg">Detalles</TabsTrigger>
                <TabsTrigger value="lyrics" className="data-[state=active]:bg-[#D8A45A]/20 data-[state=active]:text-[#D8A45A] rounded-lg">Letras</TabsTrigger>
                <TabsTrigger value="structure" className="data-[state=active]:bg-[#D8A45A]/20 data-[state=active]:text-[#D8A45A] rounded-lg">Estructura</TabsTrigger>
                <TabsTrigger value="export" className="data-[state=active]:bg-[#D8A45A]/20 data-[state=active]:text-[#D8A45A] rounded-lg">Exportar</TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-divine">
                  <div className="space-y-6">
                    <div>
                      <Label className="text-[#A9ADB1]">Descripción</Label>
                      <Textarea value={song.description} onChange={(e) => setSong({ ...song, description: e.target.value })} placeholder="Describe tu canción..." className="input-divine mt-2 min-h-[100px]" />
                    </div>
                    <div>
                      <Label className="text-[#A9ADB1] mb-3 block">Instrumentación</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {instruments.map((inst) => (
                          <button key={inst.id} onClick={() => toggleInstrument(inst.id)} className={`instrument-chip ${song.instruments.includes(inst.id) ? 'selected' : ''}`}>
                            <span>{inst.icon}</span><span>{inst.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-3">
                        <Label className="text-[#A9ADB1]">Estructura</Label>
                        <button onClick={() => setShowStructure(!showStructure)} className="text-[#6B7280]">{showStructure ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</button>
                      </div>
                      {showStructure && (
                        <div className="flex flex-wrap gap-2">
                          {structureParts.map((part) => (<button key={part} onClick={() => toggleStructurePart(part)} className={`structure-pill ${song.structure.includes(part) ? 'active' : ''}`}>{part}</button>))}
                        </div>
                      )}
                      <div className="mt-4 p-3 rounded-lg bg-white/5">
                        <p className="text-sm text-[#6B7280]">Orden:</p>
                        <p className="text-[#E6E7E9] mt-1">{song.structure.join(' → ')}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="lyrics">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-divine">
                  <div className="flex justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#E6E7E9]">Letras</h3>
                    {song.lyrics && <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(song.lyrics); toast.success('Copiado'); }} className="text-[#A9ADB1]">Copiar</Button>}
                  </div>
                  <Textarea value={song.lyrics} onChange={(e) => setSong({ ...song, lyrics: e.target.value })} placeholder="Escribe o genera las letras..." data-testid="lyrics-editor" className="lyrics-editor" />
                </motion.div>
              </TabsContent>

              <TabsContent value="structure">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-divine">
                  <h3 className="text-lg font-semibold text-[#E6E7E9] mb-4">Estructura</h3>
                  <div className="space-y-3">
                    {song.structure.map((part, i) => (
                      <div key={`${part}-${i}`} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="w-8 h-8 rounded-lg bg-[#D8A45A]/20 flex items-center justify-center text-[#D8A45A] font-mono text-sm">{i + 1}</div>
                        <div className="flex-1"><p className="text-[#E6E7E9] capitalize font-medium">{part}</p></div>
                        <button onClick={() => { const n = [...song.structure]; n.splice(i, 1); setSong({ ...song, structure: n }); }} className="p-2 text-[#6B7280] hover:text-[#D05B5B]"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="export">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-divine">
                  <div className="flex items-center gap-3 mb-6">
                    <Layers className="w-6 h-6 text-[#7C5AB9]" />
                    <div>
                      <h3 className="text-lg font-semibold text-[#E6E7E9]">Exportar Canción</h3>
                      <p className="text-sm text-[#6B7280]">Descarga tu canción en diferentes formatos</p>
                    </div>
                  </div>

                  {!song.audio_url && (
                    <div className="mb-6 p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                      <p className="text-orange-400 text-sm">Genera audio primero usando el botón "Generar Audio con Mi Voz"</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <Button onClick={() => handleExport('mp3')} disabled={!song.audio_url} className="btn-secondary h-20 flex-col">
                      <Download className="w-6 h-6 mb-2" />
                      <span>Exportar MP3</span>
                    </Button>
                    <Button onClick={() => handleExport('wav')} disabled={!song.audio_url} className="btn-secondary h-20 flex-col">
                      <Download className="w-6 h-6 mb-2" />
                      <span>Exportar WAV</span>
                    </Button>
                  </div>

                  <div className="mt-6 pt-6 border-t border-white/5">
                    <Button onClick={() => fileInputRef.current?.click()} disabled={!savedSongId} variant="outline" className="w-full btn-secondary">
                      <Upload className="w-4 h-4 mr-2" />Subir Audio Propio
                    </Button>
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Audio Player */}
      <div className="fixed bottom-0 left-0 right-0 audio-player px-6 py-4">
        <div className="container-divine flex items-center gap-6">
          <div className="flex items-center gap-3 min-w-[200px]">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#D8A45A]/20 to-[#7C5AB9]/20 flex items-center justify-center">
              {song.audio_url ? <FileAudio className="w-6 h-6 text-[#D8A45A]" /> : <Music4 className="w-6 h-6 text-[#6B7280]" />}
            </div>
            <div>
              <p className="text-[#E6E7E9] font-medium truncate">{song.title || 'Sin título'}</p>
              <p className="text-sm text-[#6B7280]">{song.audio_url ? `${song.key} • ${song.tempo} BPM` : 'Sin audio'}</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => { if (audioRef.current) audioRef.current.currentTime -= 10; }} disabled={!song.audio_url} className="text-[#6B7280]"><SkipBack className="w-5 h-5" /></Button>
              <Button onClick={handlePlayPause} disabled={!song.audio_url} className="w-12 h-12 rounded-full bg-[#D8A45A] hover:bg-[#E6B86E] text-[#0B0C0E] disabled:opacity-50">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { if (audioRef.current) audioRef.current.currentTime += 10; }} disabled={!song.audio_url} className="text-[#6B7280]"><SkipForward className="w-5 h-5" /></Button>
            </div>
            <div className="w-full max-w-xl flex items-center gap-3">
              <span className="text-xs text-[#6B7280] font-mono w-10">{formatTime(currentTime)}</span>
              <Slider value={progress} onValueChange={handleSeek} max={100} step={0.1} disabled={!song.audio_url} className="flex-1 [&_[role=slider]]:bg-[#D8A45A]" />
              <span className="text-xs text-[#6B7280] font-mono w-10">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 min-w-[150px]">
            <Button variant="ghost" size="sm" onClick={() => setIsMuted(!isMuted)} className="text-[#6B7280]">{isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</Button>
            <Slider value={isMuted ? [0] : volume} onValueChange={setVolume} max={100} className="w-24 [&_[role=slider]]:bg-[#7C5AB9]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongCreator;
