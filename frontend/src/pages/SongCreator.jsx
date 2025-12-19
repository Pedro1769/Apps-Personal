import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Music4, Wand2, Save, Loader2, Play, Pause,
  SkipBack, SkipForward, Volume2, VolumeX, Download,
  Layers, Settings2, ChevronDown, ChevronUp, Sparkles,
  Upload, FileAudio, X, Check, Mic, User
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
  
  // Voice profiles
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

  // Fetch voice profiles on mount
  useEffect(() => {
    const fetchVoiceProfiles = async () => {
      try {
        const response = await axios.get(`${API}/voice-profiles`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setVoiceProfiles(response.data);
        // Auto-select first ready profile
        const readyProfile = response.data.find(p => p.status === 'ready' && p.audio_samples?.length > 0);
        if (readyProfile) {
          setSelectedVoiceProfile(readyProfile.id);
        }
      } catch (error) {
        console.error('Error fetching voice profiles:', error);
      } finally {
        setLoadingProfiles(false);
      }
    };

    if (token) {
      fetchVoiceProfiles();
    }
  }, [token]);

  // Audio player setup
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
      if (audio && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress([0]);
      setCurrentTime(0);
    };

    const handleError = (e) => {
      console.error('Audio error:', e);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
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
      // Build enhanced prompt with voice profile info
      let enhancedPrompt = lyricsPrompt;
      
      if (selectedVoiceProfile) {
        const profile = voiceProfiles.find(p => p.id === selectedVoiceProfile);
        if (profile) {
          enhancedPrompt += `\n\n[Contexto del cantante: Voz ${profile.vocal_range}, timbre ${profile.timbre}, estilo ${profile.style}. ${profile.description || ''}]`;
        }
      }

      // Add song details to prompt for better context
      enhancedPrompt += `\n\n[Configuración musical: Tempo ${song.tempo} BPM, Tonalidad ${song.key}, Género ${song.genre}, Atmósfera ${song.mood}]`;
      enhancedPrompt += `\n[Instrumentación: ${song.instruments.join(', ')}]`;

      const response = await axios.post(
        `${API}/lyrics/generate`,
        {
          prompt: enhancedPrompt,
          style: song.style,
          theme: lyricsTheme,
          language: 'es',
          structure: song.structure,
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

  const handleAudioUpload = async (e, stemType = 'master') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!savedSongId) {
      toast.error('Guarda la canción primero antes de subir audio');
      return;
    }

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
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          },
        }
      );

      if (stemType === 'master') {
        setSong({ ...song, audio_url: response.data.url });
        if (audioRef.current) {
          audioRef.current.src = `${BACKEND_URL}${response.data.url}`;
        }
      } else {
        const newStems = { ...(song.stems || {}), [stemType]: response.data };
        setSong({ ...song, stems: newStems });
      }

      toast.success(`Audio ${stemType === 'master' ? 'principal' : stemType} subido correctamente`);
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al subir audio';
      toast.error(message);
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
      toast.error('Sube un archivo de audio primero');
      return;
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current.src || audioRef.current.src === '') {
        audioRef.current.src = `${BACKEND_URL}${song.audio_url}`;
      }
      audioRef.current.play().catch(err => {
        console.error('Play error:', err);
        toast.error('Error al reproducir audio');
      });
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
    if (!savedSongId) {
      toast.error('Guarda la canción primero');
      return;
    }

    try {
      toast.info(`Exportando a ${format.toUpperCase()}...`);
      const response = await axios.post(
        `${API}/songs/${savedSongId}/export?format=${format}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
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
      toast.error('Error al exportar. Asegúrate de tener audio subido.');
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

  const getSelectedProfileInfo = () => {
    if (!selectedVoiceProfile) return null;
    return voiceProfiles.find(p => p.id === selectedVoiceProfile);
  };

  return (
    <div className="min-h-screen pt-20 pb-32">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleAudioUpload(e, 'master')}
        accept="audio/*"
        className="hidden"
      />
      <input
        type="file"
        ref={stemFileInputRef}
        onChange={(e) => handleAudioUpload(e, currentStemUpload || 'master')}
        accept="audio/*"
        className="hidden"
      />

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
                {projectId ? (savedSongId ? `ID: ${savedSongId.slice(0,8)}` : 'Nueva canción') : 'Sin proyecto'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!savedSongId || uploadingAudio}
              data-testid="upload-audio-btn"
              className="btn-secondary"
            >
              <Upload className="w-4 h-4 mr-2" />
              Subir Audio
            </Button>
            <Button
              onClick={handleSaveSong}
              disabled={loading}
              data-testid="save-song-btn"
              className="btn-primary"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {savedSongId ? 'Actualizar' : 'Guardar'}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Upload Progress */}
        {uploadingAudio && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-[#D8A45A]/10 border border-[#D8A45A]/30"
          >
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 text-[#D8A45A] animate-spin" />
              <span className="text-[#E6E7E9]">
                Subiendo {currentStemUpload === 'master' ? 'audio principal' : currentStemUpload}...
              </span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </motion.div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Controls */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Voice Profile Selector */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-divine"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#7C5AB9]/20 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-[#A680FF]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#E6E7E9]">Tu Perfil de Voz</h3>
                  <p className="text-xs text-[#6B7280]">Usa tu identidad vocal</p>
                </div>
              </div>

              {loadingProfiles ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-[#7C5AB9] animate-spin" />
                </div>
              ) : voiceProfiles.length === 0 ? (
                <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <p className="text-orange-400 text-sm">
                    No tienes perfiles de voz. Ve a Voice Studio para crear uno y subir muestras de tu voz.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Select value={selectedVoiceProfile} onValueChange={setSelectedVoiceProfile}>
                    <SelectTrigger data-testid="voice-profile-select" className="input-divine">
                      <SelectValue placeholder="Selecciona tu perfil de voz" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1D23] border-white/10">
                      <SelectItem value="" className="text-[#6B7280]">
                        Sin perfil de voz
                      </SelectItem>
                      {voiceProfiles.map((profile) => (
                        <SelectItem 
                          key={profile.id} 
                          value={profile.id}
                          className="text-[#E6E7E9] hover:bg-white/10"
                          disabled={profile.status !== 'ready' || !profile.audio_samples?.length}
                        >
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{profile.name}</span>
                            {profile.status === 'ready' && profile.audio_samples?.length > 0 && (
                              <Check className="w-3 h-3 text-green-500" />
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Selected profile info */}
                  {getSelectedProfileInfo() && (
                    <div className="p-3 rounded-lg bg-[#7C5AB9]/10 border border-[#7C5AB9]/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Mic className="w-4 h-4 text-[#A680FF]" />
                        <span className="text-sm font-medium text-[#E6E7E9]">
                          {getSelectedProfileInfo().name}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-[#6B7280]">Rango:</span>{' '}
                          <span className="text-[#A9ADB1] capitalize">{getSelectedProfileInfo().vocal_range}</span>
                        </div>
                        <div>
                          <span className="text-[#6B7280]">Timbre:</span>{' '}
                          <span className="text-[#A9ADB1] capitalize">{getSelectedProfileInfo().timbre}</span>
                        </div>
                        <div>
                          <span className="text-[#6B7280]">Muestras:</span>{' '}
                          <span className="text-[#D8A45A]">{getSelectedProfileInfo().audio_samples?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* AI Lyrics Generator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card-divine"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#D8A45A]/20 flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-[#D8A45A]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#E6E7E9]">Generador de Letras</h3>
                  <p className="text-xs text-[#6B7280]">Powered by GPT-5.1</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-[#A9ADB1] text-sm">Tema Espiritual</Label>
                  <Select value={lyricsTheme} onValueChange={setLyricsTheme}>
                    <SelectTrigger data-testid="lyrics-theme-select" className="input-divine mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1D23] border-white/10">
                      {themes.map((theme) => (
                        <SelectItem 
                          key={theme.value} 
                          value={theme.value}
                          className="text-[#E6E7E9] hover:bg-white/10"
                        >
                          {theme.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[#A9ADB1] text-sm">
                    Descripción Detallada (sin límites)
                  </Label>
                  <Textarea
                    value={lyricsPrompt}
                    onChange={(e) => setLyricsPrompt(e.target.value)}
                    placeholder="Describe tu canción en detalle: el mensaje, la atmósfera, versículos bíblicos de inspiración, emociones, momentos congregacionales que quieres crear... Mientras más detalles, mejor resultado."
                    data-testid="lyrics-prompt-input"
                    className="input-divine mt-1 min-h-[180px]"
                  />
                  <p className="text-xs text-[#6B7280] mt-1">
                    {selectedVoiceProfile && '✓ Se usará tu perfil de voz para personalizar las letras'}
                  </p>
                </div>

                <Button
                  onClick={handleGenerateLyrics}
                  disabled={generatingLyrics}
                  data-testid="generate-lyrics-btn"
                  className="btn-primary w-full"
                >
                  {generatingLyrics ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generar Letras con IA
                    </>
                  )}
                </Button>
              </div>
            </motion.div>

            {/* Music Controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card-divine"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#7C5AB9]/20 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-[#A680FF]" />
                </div>
                <h3 className="font-semibold text-[#E6E7E9]">Controles Musicales</h3>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-[#A9ADB1] text-sm">Tempo</Label>
                    <span className="text-[#D8A45A] font-mono text-sm">{song.tempo} BPM</span>
                  </div>
                  <Slider
                    value={[song.tempo]}
                    onValueChange={([value]) => setSong({ ...song, tempo: value })}
                    min={60}
                    max={180}
                    step={1}
                    data-testid="tempo-slider"
                    className="[&_[role=slider]]:bg-[#D8A45A]"
                  />
                </div>

                <div>
                  <Label className="text-[#A9ADB1] text-sm">Tonalidad</Label>
                  <Select value={song.key} onValueChange={(value) => setSong({ ...song, key: value })}>
                    <SelectTrigger data-testid="key-select" className="input-divine mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1D23] border-white/10">
                      {musicalKeys.map((key) => (
                        <SelectItem 
                          key={key} 
                          value={key}
                          className="text-[#E6E7E9] hover:bg-white/10"
                        >
                          {key} Mayor
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[#A9ADB1] text-sm">Género</Label>
                  <Select value={song.genre} onValueChange={(value) => setSong({ ...song, genre: value })}>
                    <SelectTrigger data-testid="genre-select" className="input-divine mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1D23] border-white/10">
                      {genres.map((genre) => (
                        <SelectItem 
                          key={genre} 
                          value={genre}
                          className="text-[#E6E7E9] hover:bg-white/10 capitalize"
                        >
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[#A9ADB1] text-sm">Atmósfera</Label>
                  <Select value={song.mood} onValueChange={(value) => setSong({ ...song, mood: value })}>
                    <SelectTrigger data-testid="mood-select" className="input-divine mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1D23] border-white/10">
                      {moods.map((mood) => (
                        <SelectItem 
                          key={mood} 
                          value={mood}
                          className="text-[#E6E7E9] hover:bg-white/10 capitalize"
                        >
                          {mood}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Panel - Main Editor */}
          <div className="col-span-12 lg:col-span-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-[#111318] border border-white/5 p-1 rounded-xl mb-6">
                <TabsTrigger 
                  value="details" 
                  data-testid="tab-details"
                  className="data-[state=active]:bg-[#D8A45A]/20 data-[state=active]:text-[#D8A45A] rounded-lg"
                >
                  Detalles
                </TabsTrigger>
                <TabsTrigger 
                  value="lyrics" 
                  data-testid="tab-lyrics"
                  className="data-[state=active]:bg-[#D8A45A]/20 data-[state=active]:text-[#D8A45A] rounded-lg"
                >
                  Letras
                </TabsTrigger>
                <TabsTrigger 
                  value="structure" 
                  data-testid="tab-structure"
                  className="data-[state=active]:bg-[#D8A45A]/20 data-[state=active]:text-[#D8A45A] rounded-lg"
                >
                  Estructura
                </TabsTrigger>
                <TabsTrigger 
                  value="stems" 
                  data-testid="tab-stems"
                  className="data-[state=active]:bg-[#D8A45A]/20 data-[state=active]:text-[#D8A45A] rounded-lg"
                >
                  Stems
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-divine"
                >
                  <div className="space-y-6">
                    <div>
                      <Label className="text-[#A9ADB1]">Descripción de la Canción</Label>
                      <Textarea
                        value={song.description}
                        onChange={(e) => setSong({ ...song, description: e.target.value })}
                        placeholder="Describe el propósito y contexto de esta canción..."
                        data-testid="song-description-input"
                        className="input-divine mt-2 min-h-[100px]"
                      />
                    </div>

                    <div>
                      <Label className="text-[#A9ADB1] mb-3 block">Instrumentación</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {instruments.map((instrument) => (
                          <button
                            key={instrument.id}
                            onClick={() => toggleInstrument(instrument.id)}
                            data-testid={`instrument-${instrument.id}`}
                            className={`instrument-chip ${
                              song.instruments.includes(instrument.id) ? 'selected' : ''
                            }`}
                          >
                            <span>{instrument.icon}</span>
                            <span>{instrument.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-[#A9ADB1]">Estructura de la Canción</Label>
                        <button
                          onClick={() => setShowStructure(!showStructure)}
                          className="text-[#6B7280] hover:text-[#A9ADB1]"
                        >
                          {showStructure ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>
                      {showStructure && (
                        <div className="flex flex-wrap gap-2">
                          {structureParts.map((part) => (
                            <button
                              key={part}
                              onClick={() => toggleStructurePart(part)}
                              data-testid={`structure-${part}`}
                              className={`structure-pill ${
                                song.structure.includes(part) ? 'active' : ''
                              }`}
                            >
                              {part}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 p-3 rounded-lg bg-white/5">
                        <p className="text-sm text-[#6B7280]">Orden actual:</p>
                        <p className="text-[#E6E7E9] mt-1">
                          {song.structure.join(' → ')}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>

              {/* Lyrics Tab */}
              <TabsContent value="lyrics">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-divine"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#E6E7E9]">Letras</h3>
                    {song.lyrics && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(song.lyrics);
                          toast.success('Copiado al portapapeles');
                        }}
                        className="text-[#A9ADB1] hover:text-[#D8A45A]"
                      >
                        Copiar
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={song.lyrics}
                    onChange={(e) => setSong({ ...song, lyrics: e.target.value })}
                    placeholder="Escribe o genera las letras de tu canción..."
                    data-testid="lyrics-editor"
                    className="lyrics-editor"
                  />
                </motion.div>
              </TabsContent>

              {/* Structure Tab */}
              <TabsContent value="structure">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-divine"
                >
                  <h3 className="text-lg font-semibold text-[#E6E7E9] mb-4">
                    Estructura de la Canción
                  </h3>
                  <div className="space-y-3">
                    {song.structure.map((part, index) => (
                      <div
                        key={`${part}-${index}`}
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#D8A45A]/20 flex items-center justify-center text-[#D8A45A] font-mono text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-[#E6E7E9] capitalize font-medium">{part}</p>
                        </div>
                        <button
                          onClick={() => {
                            const newStructure = [...song.structure];
                            newStructure.splice(index, 1);
                            setSong({ ...song, structure: newStructure });
                          }}
                          className="p-2 text-[#6B7280] hover:text-[#D05B5B]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </TabsContent>

              {/* Stems Tab */}
              <TabsContent value="stems">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-divine"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <Layers className="w-6 h-6 text-[#7C5AB9]" />
                    <div>
                      <h3 className="text-lg font-semibold text-[#E6E7E9]">Capas de Audio</h3>
                      <p className="text-sm text-[#6B7280]">Sube pistas individuales para cada stem</p>
                    </div>
                  </div>

                  {!savedSongId && (
                    <div className="mb-6 p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                      <p className="text-orange-400 text-sm">
                        Guarda la canción primero para poder subir stems de audio.
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {stemTypes.map((stem) => {
                      const stemData = song.stems?.[stem.id];
                      return (
                        <div key={stem.id} className="stem-layer">
                          <div className="w-10 h-10 rounded-lg bg-[#7C5AB9]/20 flex items-center justify-center">
                            <span className="text-lg">{stem.icon}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-[#E6E7E9] font-medium">{stem.name}</p>
                            {stemData && (
                              <p className="text-xs text-[#6B7280]">
                                {formatTime(stemData.duration)} subido
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {stemData ? (
                              <Check className="w-5 h-5 text-green-500" />
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!savedSongId || uploadingAudio}
                                onClick={() => {
                                  setCurrentStemUpload(stem.id);
                                  setTimeout(() => stemFileInputRef.current?.click(), 100);
                                }}
                                className="text-[#A9ADB1] hover:text-[#D8A45A]"
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                Subir
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 pt-6 border-t border-white/5 flex gap-3">
                    <Button 
                      onClick={() => handleExport('mp3')}
                      disabled={!savedSongId || !song.audio_url}
                      data-testid="export-mp3-btn" 
                      className="btn-secondary flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exportar MP3
                    </Button>
                    <Button 
                      onClick={() => handleExport('wav')}
                      disabled={!savedSongId || !song.audio_url}
                      data-testid="export-wav-btn" 
                      className="btn-secondary flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exportar WAV
                    </Button>
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Bottom Audio Player */}
      <div className="fixed bottom-0 left-0 right-0 audio-player px-6 py-4">
        <div className="container-divine flex items-center gap-6">
          {/* Song Info */}
          <div className="flex items-center gap-3 min-w-[200px]">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#D8A45A]/20 to-[#7C5AB9]/20 flex items-center justify-center">
              {song.audio_url ? (
                <FileAudio className="w-6 h-6 text-[#D8A45A]" />
              ) : (
                <Music4 className="w-6 h-6 text-[#6B7280]" />
              )}
            </div>
            <div>
              <p className="text-[#E6E7E9] font-medium truncate">
                {song.title || 'Sin título'}
              </p>
              <p className="text-sm text-[#6B7280]">
                {song.audio_url ? `${song.key} • ${song.tempo} BPM` : 'Sin audio'}
              </p>
            </div>
          </div>

          {/* Player Controls */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
                  }
                }}
                disabled={!song.audio_url}
                className="text-[#6B7280] hover:text-[#E6E7E9]"
              >
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button
                onClick={handlePlayPause}
                data-testid="play-pause-btn"
                disabled={!song.audio_url}
                className="w-12 h-12 rounded-full bg-[#D8A45A] hover:bg-[#E6B86E] text-[#0B0C0E] disabled:opacity-50"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  if (audioRef.current && duration) {
                    audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
                  }
                }}
                disabled={!song.audio_url}
                className="text-[#6B7280] hover:text-[#E6E7E9]"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>
            <div className="w-full max-w-xl flex items-center gap-3">
              <span className="text-xs text-[#6B7280] font-mono w-10">{formatTime(currentTime)}</span>
              <Slider
                value={progress}
                onValueChange={handleSeek}
                max={100}
                step={0.1}
                disabled={!song.audio_url}
                className="flex-1 [&_[role=slider]]:bg-[#D8A45A]"
              />
              <span className="text-xs text-[#6B7280] font-mono w-10">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-3 min-w-[150px]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
              className="text-[#6B7280] hover:text-[#E6E7E9]"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            <Slider
              value={isMuted ? [0] : volume}
              onValueChange={setVolume}
              max={100}
              step={1}
              className="w-24 [&_[role=slider]]:bg-[#7C5AB9]"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SongCreator;
