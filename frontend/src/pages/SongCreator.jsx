import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Music4, Wand2, Save, Loader2, Plus, Play, Pause,
  SkipBack, SkipForward, Volume2, VolumeX, Download,
  Layers, Settings2, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Slider } from '../components/ui/slider';
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

  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(false);
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [progress, setProgress] = useState([0]);
  const [showStructure, setShowStructure] = useState(true);

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
  });

  const [lyricsPrompt, setLyricsPrompt] = useState('');
  const [lyricsTheme, setLyricsTheme] = useState('worship');

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
        ...song,
      };
      await axios.post(`${API}/songs`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  return (
    <div className="min-h-screen pt-20 pb-32">
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
                {projectId ? 'Creando nueva canción' : 'Sin proyecto seleccionado'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {}}
              data-testid="preview-btn"
              className="btn-secondary"
            >
              <Play className="w-4 h-4 mr-2" />
              Preview
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
                  Guardar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Controls */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* AI Lyrics Generator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
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
                  <Label className="text-[#A9ADB1] text-sm">Tema</Label>
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
                    Descripción (sin límites)
                  </Label>
                  <Textarea
                    value={lyricsPrompt}
                    onChange={(e) => setLyricsPrompt(e.target.value)}
                    placeholder="Describe la canción que quieres crear. Puedes ser tan detallado como quieras: el mensaje, la atmósfera, versículos bíblicos de inspiración, emociones específicas, momentos congregacionales..."
                    data-testid="lyrics-prompt-input"
                    className="input-divine mt-1 min-h-[150px]"
                  />
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
                      Generar Letras
                    </>
                  )}
                </Button>
              </div>
            </motion.div>

            {/* Music Controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card-divine"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#7C5AB9]/20 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-[#A680FF]" />
                </div>
                <h3 className="font-semibold text-[#E6E7E9]">Controles Musicales</h3>
              </div>

              <div className="space-y-5">
                {/* Tempo */}
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

                {/* Key */}
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

                {/* Genre */}
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

                {/* Mood */}
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

                    {/* Instruments */}
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

                    {/* Structure Preview */}
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
                        onClick={() => navigator.clipboard.writeText(song.lyrics)}
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
                          <p className="text-sm text-[#6B7280]">
                            {part === 'intro' && '4-8 compases'}
                            {part === 'verse' && '8-16 compases'}
                            {part === 'pre-chorus' && '4-8 compases'}
                            {part === 'chorus' && '8-16 compases'}
                            {part === 'bridge' && '8 compases'}
                            {part === 'vamp' && 'Variable'}
                            {part === 'outro' && '4-8 compases'}
                          </p>
                        </div>
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
                      <p className="text-sm text-[#6B7280]">Controla cada pista individualmente</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {['Voz Principal', 'Coros', 'Piano', 'Batería', 'Bajo', 'Cuerdas'].map((stem, index) => (
                      <div key={stem} className="stem-layer">
                        <div className="w-10 h-10 rounded-lg bg-[#7C5AB9]/20 flex items-center justify-center">
                          <span className="text-lg">
                            {index === 0 && '🎤'}
                            {index === 1 && '🎶'}
                            {index === 2 && '🎹'}
                            {index === 3 && '🥁'}
                            {index === 4 && '🎸'}
                            {index === 5 && '🎻'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-[#E6E7E9] font-medium">{stem}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Slider
                            defaultValue={[100]}
                            max={100}
                            step={1}
                            className="w-24 [&_[role=slider]]:bg-[#7C5AB9]"
                          />
                          <Button variant="ghost" size="sm" className="text-[#6B7280] hover:text-[#E6E7E9]">
                            <Volume2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-6 border-t border-white/5">
                    <Button data-testid="export-stems-btn" className="btn-secondary w-full">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar Stems
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
              <Music4 className="w-6 h-6 text-[#D8A45A]" />
            </div>
            <div>
              <p className="text-[#E6E7E9] font-medium truncate">
                {song.title || 'Sin título'}
              </p>
              <p className="text-sm text-[#6B7280]">{song.key} • {song.tempo} BPM</p>
            </div>
          </div>

          {/* Player Controls */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="text-[#6B7280] hover:text-[#E6E7E9]">
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button
                onClick={() => setIsPlaying(!isPlaying)}
                data-testid="play-pause-btn"
                className="w-12 h-12 rounded-full bg-[#D8A45A] hover:bg-[#E6B86E] text-[#0B0C0E]"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </Button>
              <Button variant="ghost" size="sm" className="text-[#6B7280] hover:text-[#E6E7E9]">
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>
            <div className="w-full max-w-xl flex items-center gap-3">
              <span className="text-xs text-[#6B7280] font-mono">0:00</span>
              <Slider
                value={progress}
                onValueChange={setProgress}
                max={100}
                step={1}
                className="flex-1 [&_[role=slider]]:bg-[#D8A45A]"
              />
              <span className="text-xs text-[#6B7280] font-mono">3:45</span>
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
