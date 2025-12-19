import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Mic, Upload, Plus, Trash2, Loader2, CheckCircle, 
  AlertCircle, AudioWaveform, Settings2 
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const vocalRanges = [
  { value: 'bass', label: 'Bajo' },
  { value: 'baritone', label: 'Barítono' },
  { value: 'tenor', label: 'Tenor' },
  { value: 'alto', label: 'Alto' },
  { value: 'mezzo', label: 'Mezzo-soprano' },
  { value: 'soprano', label: 'Soprano' },
];

const timbres = [
  { value: 'warm', label: 'Cálido' },
  { value: 'bright', label: 'Brillante' },
  { value: 'rich', label: 'Rico' },
  { value: 'airy', label: 'Aéreo' },
  { value: 'powerful', label: 'Poderoso' },
];

const styles = [
  { value: 'worship', label: 'Adoración' },
  { value: 'gospel', label: 'Gospel' },
  { value: 'contemporary', label: 'Contemporáneo' },
  { value: 'traditional', label: 'Tradicional' },
  { value: 'choir', label: 'Coral' },
];

const VoiceStudio = ({ token }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: '',
    description: '',
    vocal_range: 'tenor',
    timbre: 'warm',
    style: 'worship',
  });

  const fetchProfiles = async () => {
    try {
      const response = await axios.get(`${API}/voice-profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfiles(response.data);
    } catch (error) {
      toast.error('Error al cargar perfiles de voz');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [token]);

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await axios.post(`${API}/voice-profiles`, newProfile, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfiles([response.data, ...profiles]);
      setShowNewProfile(false);
      setNewProfile({
        name: '',
        description: '',
        vocal_range: 'tenor',
        timbre: 'warm',
        style: 'worship',
      });
      toast.success('Perfil de voz creado exitosamente');
    } catch (error) {
      toast.error('Error al crear perfil de voz');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProfile = async (profileId) => {
    if (!window.confirm('¿Estás seguro de eliminar este perfil de voz?')) return;

    try {
      await axios.delete(`${API}/voice-profiles/${profileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfiles(profiles.filter((p) => p.id !== profileId));
      toast.success('Perfil eliminado');
    } catch (error) {
      toast.error('Error al eliminar perfil');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-[#D8A45A] animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-[#6B7280]" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'ready':
        return 'Listo';
      case 'processing':
        return 'Procesando';
      default:
        return 'Pendiente';
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container-divine">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-cinzel text-3xl font-bold text-[#E6E7E9] mb-2">
              Voice Studio
            </h1>
            <p className="text-[#A9ADB1]">
              Crea y gestiona tus perfiles vocales únicos
            </p>
          </div>
          <Button
            onClick={() => setShowNewProfile(true)}
            data-testid="new-voice-profile-btn"
            className="btn-primary"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Perfil de Voz
          </Button>
        </div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-[#7C5AB9]/10 border border-[#7C5AB9]/30 p-6 mb-8"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#7C5AB9]/20 flex items-center justify-center flex-shrink-0">
              <Mic className="w-6 h-6 text-[#A680FF]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#E6E7E9] mb-2">
                Tu Identidad Vocal Única
              </h3>
              <p className="text-[#A9ADB1] text-sm leading-relaxed">
                El sistema de Voice Identity Modeling analiza el timbre, textura, rango vocal, 
                vibrato, dinámica y color de tu voz para crear un perfil vocal único. 
                <span className="text-[#D8A45A]"> Tu voz, tu identidad, tu música.</span>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Profiles Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#D8A45A] animate-spin" />
          </div>
        ) : profiles.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-[#D8A45A]/10 flex items-center justify-center mx-auto mb-6">
              <AudioWaveform className="w-10 h-10 text-[#D8A45A]" />
            </div>
            <h2 className="text-xl font-semibold text-[#E6E7E9] mb-2">
              No tienes perfiles de voz
            </h2>
            <p className="text-[#A9ADB1] mb-6">
              Crea tu primer perfil vocal para comenzar
            </p>
            <Button
              onClick={() => setShowNewProfile(true)}
              data-testid="empty-new-voice-btn"
              className="btn-primary"
            >
              <Mic className="w-5 h-5 mr-2" />
              Crear Perfil de Voz
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {profiles.map((profile, index) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                data-testid={`voice-profile-card-${profile.id}`}
                className="voice-card"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D8A45A]/20 to-[#7C5AB9]/20 flex items-center justify-center">
                      <Mic className="w-7 h-7 text-[#D8A45A]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[#E6E7E9]">
                        {profile.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(profile.status)}
                        <span className="text-sm text-[#A9ADB1]">
                          {getStatusText(profile.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteProfile(profile.id)}
                    className="text-[#6B7280] hover:text-[#D05B5B] hover:bg-[#D05B5B]/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {profile.description && (
                  <p className="text-sm text-[#A9ADB1] mb-4">
                    {profile.description}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-white/5 p-3">
                    <div className="text-xs text-[#6B7280] mb-1">Rango</div>
                    <div className="text-sm text-[#E6E7E9] capitalize">{profile.vocal_range}</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <div className="text-xs text-[#6B7280] mb-1">Timbre</div>
                    <div className="text-sm text-[#E6E7E9] capitalize">{profile.timbre}</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <div className="text-xs text-[#6B7280] mb-1">Estilo</div>
                    <div className="text-sm text-[#E6E7E9] capitalize">{profile.style}</div>
                  </div>
                </div>

                {profile.status === 'pending' && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <Button
                      variant="outline"
                      className="w-full btn-secondary"
                      data-testid={`upload-samples-${profile.id}`}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Subir Muestras de Voz
                    </Button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* New Profile Dialog */}
        <Dialog open={showNewProfile} onOpenChange={setShowNewProfile}>
          <DialogContent className="bg-[#111318] border-white/10 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-cinzel text-xl text-[#E6E7E9]">
                Nuevo Perfil de Voz
              </DialogTitle>
              <DialogDescription className="text-[#A9ADB1]">
                Define las características de tu perfil vocal
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateProfile} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name" className="text-[#A9ADB1]">
                  Nombre del Perfil
                </Label>
                <Input
                  id="profile-name"
                  value={newProfile.name}
                  onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                  placeholder="Ej: Mi Voz Principal"
                  required
                  data-testid="voice-profile-name-input"
                  className="input-divine"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-description" className="text-[#A9ADB1]">
                  Descripción (opcional)
                </Label>
                <Textarea
                  id="profile-description"
                  value={newProfile.description}
                  onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
                  placeholder="Describe las características de tu voz..."
                  data-testid="voice-profile-description-input"
                  className="input-divine min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#A9ADB1]">Rango Vocal</Label>
                  <Select
                    value={newProfile.vocal_range}
                    onValueChange={(value) => setNewProfile({ ...newProfile, vocal_range: value })}
                  >
                    <SelectTrigger data-testid="voice-range-select" className="input-divine">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1D23] border-white/10">
                      {vocalRanges.map((range) => (
                        <SelectItem 
                          key={range.value} 
                          value={range.value}
                          className="text-[#E6E7E9] hover:bg-white/10"
                        >
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[#A9ADB1]">Timbre</Label>
                  <Select
                    value={newProfile.timbre}
                    onValueChange={(value) => setNewProfile({ ...newProfile, timbre: value })}
                  >
                    <SelectTrigger data-testid="voice-timbre-select" className="input-divine">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1D23] border-white/10">
                      {timbres.map((timbre) => (
                        <SelectItem 
                          key={timbre.value} 
                          value={timbre.value}
                          className="text-[#E6E7E9] hover:bg-white/10"
                        >
                          {timbre.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[#A9ADB1]">Estilo</Label>
                  <Select
                    value={newProfile.style}
                    onValueChange={(value) => setNewProfile({ ...newProfile, style: value })}
                  >
                    <SelectTrigger data-testid="voice-style-select" className="input-divine">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1D23] border-white/10">
                      {styles.map((style) => (
                        <SelectItem 
                          key={style.value} 
                          value={style.value}
                          className="text-[#E6E7E9] hover:bg-white/10"
                        >
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowNewProfile(false)}
                  className="text-[#A9ADB1] hover:text-[#E6E7E9]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  data-testid="create-voice-profile-submit"
                  className="btn-primary"
                >
                  {creating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Crear Perfil'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default VoiceStudio;
