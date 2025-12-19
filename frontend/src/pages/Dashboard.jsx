import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plus, Music4, FolderOpen, Clock, MoreVertical, 
  Trash2, Edit, Loader2, Sparkles 
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
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

const genres = [
  { value: 'gospel', label: 'Gospel' },
  { value: 'worship', label: 'Adoración' },
  { value: 'contemporary', label: 'Contemporáneo' },
  { value: 'traditional', label: 'Tradicional' },
  { value: 'choir', label: 'Coro' },
];

const Dashboard = ({ token }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    genre: 'gospel',
  });

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(response.data);
    } catch (error) {
      toast.error('Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [token]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await axios.post(`${API}/projects`, newProject, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects([response.data, ...projects]);
      setShowNewProject(false);
      setNewProject({ name: '', description: '', genre: 'gospel' });
      toast.success('Proyecto creado exitosamente');
    } catch (error) {
      toast.error('Error al crear proyecto');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('¿Estás seguro de eliminar este proyecto?')) return;

    try {
      await axios.delete(`${API}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(projects.filter((p) => p.id !== projectId));
      toast.success('Proyecto eliminado');
    } catch (error) {
      toast.error('Error al eliminar proyecto');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container-divine">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-cinzel text-3xl font-bold text-[#E6E7E9] mb-2">
              Mis Proyectos
            </h1>
            <p className="text-[#A9ADB1]">
              Gestiona tus proyectos musicales y canciones
            </p>
          </div>
          <Button
            onClick={() => setShowNewProject(true)}
            data-testid="new-project-btn"
            className="btn-primary"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Proyecto
          </Button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#D8A45A] animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-[#D8A45A]/10 flex items-center justify-center mx-auto mb-6">
              <FolderOpen className="w-10 h-10 text-[#D8A45A]" />
            </div>
            <h2 className="text-xl font-semibold text-[#E6E7E9] mb-2">
              No tienes proyectos aún
            </h2>
            <p className="text-[#A9ADB1] mb-6">
              Crea tu primer proyecto y comienza a componer
            </p>
            <Button
              onClick={() => setShowNewProject(true)}
              data-testid="empty-new-project-btn"
              className="btn-primary"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Crear Proyecto
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                data-testid={`project-card-${project.id}`}
                className="group rounded-xl bg-[#1A1D23] border border-white/5 p-5 hover:bg-[#20242C] hover:border-[#D8A45A]/20 transition-all duration-300 cursor-pointer"
                onClick={() => navigate(`/create?project=${project.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D8A45A]/20 to-[#7C5AB9]/20 flex items-center justify-center">
                    <Music4 className="w-6 h-6 text-[#D8A45A]" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="p-2 rounded-lg hover:bg-white/10 text-[#6B7280] hover:text-[#E6E7E9] transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#1A1D23] border-white/10">
                      <DropdownMenuItem 
                        className="text-[#E6E7E9] hover:bg-white/10 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/create?project=${project.id}`);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-[#D05B5B] hover:bg-[#D05B5B]/10 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="text-lg font-semibold text-[#E6E7E9] mb-1 group-hover:text-[#D8A45A] transition-colors">
                  {project.name}
                </h3>
                <p className="text-sm text-[#6B7280] mb-4 line-clamp-2">
                  {project.description || 'Sin descripción'}
                </p>

                <div className="flex items-center justify-between text-sm">
                  <span className="px-3 py-1 rounded-full bg-[#7C5AB9]/20 text-[#A680FF]">
                    {project.genre}
                  </span>
                  <span className="flex items-center gap-1 text-[#6B7280]">
                    <Clock className="w-4 h-4" />
                    {formatDate(project.created_at)}
                  </span>
                </div>

                {project.songs?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <span className="text-sm text-[#A9ADB1]">
                      {project.songs.length} {project.songs.length === 1 ? 'canción' : 'canciones'}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* New Project Dialog */}
        <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
          <DialogContent className="bg-[#111318] border-white/10 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-cinzel text-xl text-[#E6E7E9]">
                Nuevo Proyecto
              </DialogTitle>
              <DialogDescription className="text-[#A9ADB1]">
                Crea un nuevo proyecto para organizar tus canciones
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateProject} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="project-name" className="text-[#A9ADB1]">
                  Nombre del Proyecto
                </Label>
                <Input
                  id="project-name"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Ej: Álbum de Adoración 2024"
                  required
                  data-testid="project-name-input"
                  className="input-divine"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-description" className="text-[#A9ADB1]">
                  Descripción (opcional)
                </Label>
                <Input
                  id="project-description"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Breve descripción del proyecto"
                  data-testid="project-description-input"
                  className="input-divine"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[#A9ADB1]">Género</Label>
                <Select
                  value={newProject.genre}
                  onValueChange={(value) => setNewProject({ ...newProject, genre: value })}
                >
                  <SelectTrigger data-testid="project-genre-select" className="input-divine">
                    <SelectValue placeholder="Selecciona un género" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1D23] border-white/10">
                    {genres.map((genre) => (
                      <SelectItem 
                        key={genre.value} 
                        value={genre.value}
                        className="text-[#E6E7E9] hover:bg-white/10"
                      >
                        {genre.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowNewProject(false)}
                  className="text-[#A9ADB1] hover:text-[#E6E7E9]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  data-testid="create-project-submit"
                  className="btn-primary"
                >
                  {creating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Crear Proyecto'
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

export default Dashboard;
