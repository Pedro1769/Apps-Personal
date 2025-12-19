import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Music4, Play, Pause, Clock, Calendar, Trash2, 
  Download, Edit, Loader2, Volume2, MoreVertical,
  Mic, FileAudio, FolderOpen
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const MySongs = ({ token }) => {
  const navigate = useNavigate();
  const audioRef = useRef(new Audio());
  const [songs, setSongs] = useState([]);
  const [projects, setProjects] = useState({});
  const [loading, setLoading] = useState(true);
  const [playingSong, setPlayingSong] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    fetchSongs();
    
    const audio = audioRef.current;
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('ended', () => setPlayingSong(null));
    
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', () => {});
      audio.removeEventListener('loadedmetadata', () => {});
      audio.removeEventListener('ended', () => {});
    };
  }, []);

  const fetchSongs = async () => {
    try {
      const [songsRes, projectsRes] = await Promise.all([
        axios.get(`${API}/songs`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/projects`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setSongs(songsRes.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      
      const projectMap = {};
      projectsRes.data.forEach(p => { projectMap[p.id] = p; });
      setProjects(projectMap);
    } catch (error) {
      toast.error('Error al cargar canciones');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (song) => {
    if (!song.audio_url) {
      toast.error('Esta canción no tiene audio generado');
      return;
    }

    if (playingSong === song.id) {
      audioRef.current.pause();
      setPlayingSong(null);
    } else {
      audioRef.current.src = `${BACKEND_URL}${song.audio_url}`;
      audioRef.current.play();
      setPlayingSong(song.id);
    }
  };

  const handleDelete = async (songId) => {
    if (!window.confirm('¿Eliminar esta canción?')) return;
    
    try {
      await axios.delete(`${API}/songs/${songId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSongs(songs.filter(s => s.id !== songId));
      if (playingSong === songId) {
        audioRef.current.pause();
        setPlayingSong(null);
      }
      toast.success('Canción eliminada');
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleExport = async (songId, format) => {
    try {
      toast.info(`Exportando ${format.toUpperCase()}...`);
      const response = await axios.post(
        `${API}/songs/${songId}/export?format=${format}`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      
      const song = songs.find(s => s.id === songId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${song?.title || 'cancion'}.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Descargado');
    } catch (error) {
      toast.error('Error al exportar');
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (song) => {
    if (song.audio_url) {
      return <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">Con Audio</span>;
    }
    if (song.lyrics) {
      return <span className="px-2 py-1 rounded-full text-xs bg-[#D8A45A]/20 text-[#D8A45A]">Con Letras</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs bg-white/10 text-[#6B7280]">Borrador</span>;
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container-divine">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-cinzel text-3xl font-bold text-[#E6E7E9] mb-2">
              Mis Canciones
            </h1>
            <p className="text-[#A9ADB1]">
              {songs.length} {songs.length === 1 ? 'canción creada' : 'canciones creadas'}
            </p>
          </div>
          <Button
            onClick={() => navigate('/create')}
            data-testid="create-new-song-btn"
            className="btn-primary"
          >
            <Music4 className="w-5 h-5 mr-2" />
            Crear Nueva Canción
          </Button>
        </div>

        {/* Songs List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#D8A45A] animate-spin" />
          </div>
        ) : songs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-[#D8A45A]/10 flex items-center justify-center mx-auto mb-6">
              <Music4 className="w-10 h-10 text-[#D8A45A]" />
            </div>
            <h2 className="text-xl font-semibold text-[#E6E7E9] mb-2">
              No tienes canciones aún
            </h2>
            <p className="text-[#A9ADB1] mb-6">
              Crea tu primera canción con inteligencia artificial
            </p>
            <Button onClick={() => navigate('/dashboard')} className="btn-primary">
              Ir al Dashboard
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {songs.map((song, index) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                data-testid={`song-item-${song.id}`}
                className={`rounded-xl bg-[#1A1D23] border ${
                  playingSong === song.id ? 'border-[#D8A45A]/50' : 'border-white/5'
                } p-5 hover:bg-[#20242C] transition-all duration-300`}
              >
                <div className="flex items-center gap-4">
                  {/* Play Button */}
                  <button
                    onClick={() => handlePlay(song)}
                    disabled={!song.audio_url}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                      song.audio_url 
                        ? 'bg-gradient-to-br from-[#D8A45A] to-[#7C5AB9] hover:scale-105' 
                        : 'bg-white/10 cursor-not-allowed'
                    }`}
                  >
                    {playingSong === song.id ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white ml-1" />
                    )}
                  </button>

                  {/* Song Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-[#E6E7E9] truncate">
                        {song.title || 'Sin título'}
                      </h3>
                      {getStatusBadge(song)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-[#6B7280]">
                      <span className="flex items-center gap-1">
                        <FolderOpen className="w-4 h-4" />
                        {projects[song.project_id]?.name || 'Sin proyecto'}
                      </span>
                      <span>{song.key} • {song.tempo} BPM</span>
                      <span className="capitalize">{song.genre}</span>
                    </div>

                    {/* Progress bar when playing */}
                    {playingSong === song.id && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-[#D8A45A]">{formatTime(currentTime)}</span>
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#D8A45A] transition-all"
                            style={{ width: `${(currentTime / duration) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#6B7280]">{formatTime(duration)}</span>
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div className="hidden md:block text-right">
                    <p className="text-sm text-[#A9ADB1] flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(song.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 rounded-lg hover:bg-white/10 text-[#6B7280]">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#1A1D23] border-white/10">
                      <DropdownMenuItem 
                        className="text-[#E6E7E9] hover:bg-white/10 cursor-pointer"
                        onClick={() => navigate(`/create?project=${song.project_id}&song=${song.id}`)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {song.audio_url && (
                        <>
                          <DropdownMenuItem 
                            className="text-[#E6E7E9] hover:bg-white/10 cursor-pointer"
                            onClick={() => handleExport(song.id, 'mp3')}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Descargar MP3
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-[#E6E7E9] hover:bg-white/10 cursor-pointer"
                            onClick={() => handleExport(song.id, 'wav')}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Descargar WAV
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem 
                        className="text-[#D05B5B] hover:bg-[#D05B5B]/10 cursor-pointer"
                        onClick={() => handleDelete(song.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Lyrics Preview */}
                {song.lyrics && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-sm text-[#A9ADB1] line-clamp-2">
                      {song.lyrics.split('\n').slice(0, 2).join(' • ')}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MySongs;
