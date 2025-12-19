import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Music4, Mic2, Sparkles, Layers, Download, Shield, 
  Play, ChevronRight, Wand2, AudioWaveform, Heart
} from 'lucide-react';
import { Button } from '../components/ui/button';

const features = [
  {
    icon: Mic2,
    title: 'Voice Identity',
    description: 'Crea tu perfil vocal único. Tu voz, tu identidad, tu música.',
    color: '#D8A45A',
  },
  {
    icon: Wand2,
    title: 'IA Generativa',
    description: 'Letras profundas y bíblicamente coherentes generadas con IA.',
    color: '#7C5AB9',
  },
  {
    icon: AudioWaveform,
    title: 'Control Total',
    description: 'Tempo, tonalidad, estilo, estructura. Tú decides cada detalle.',
    color: '#D8A45A',
  },
  {
    icon: Layers,
    title: 'Stems & Capas',
    description: 'Exporta pistas separadas: voz, música, coros, instrumentales.',
    color: '#7C5AB9',
  },
  {
    icon: Download,
    title: 'Exportación Pro',
    description: 'WAV, MP3, y stems individuales en alta calidad.',
    color: '#D8A45A',
  },
  {
    icon: Shield,
    title: '100% Tuyo',
    description: 'Derechos de autor completos. Tu música te pertenece.',
    color: '#7C5AB9',
  },
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        <div className="container-divine text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D8A45A]/10 border border-[#D8A45A]/30 mb-8">
              <Sparkles className="w-4 h-4 text-[#D8A45A]" />
              <span className="text-sm text-[#D8A45A] font-medium">Plataforma de Música Gospel con IA</span>
            </div>

            {/* Main Title */}
            <h1 className="font-cinzel text-5xl md:text-7xl font-bold text-[#E6E7E9] mb-6 leading-tight">
              Tu Voz.<br />
              <span className="gradient-text">Tu Adoración.</span><br />
              Tu Música.
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-[#A9ADB1] max-w-2xl mx-auto mb-10 leading-relaxed">
              Crea canciones completas de adoración con inteligencia artificial. 
              Letras profundas, tu propia identidad vocal, control total creativo.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => navigate('/auth?mode=register')}
                data-testid="hero-cta-btn"
                className="btn-primary text-lg px-10 py-4 h-auto"
              >
                <Play className="w-5 h-5 mr-2" />
                Comenzar Gratis
              </Button>
              <Button
                variant="ghost"
                onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                data-testid="hero-features-btn"
                className="btn-secondary text-lg px-8 py-4 h-auto"
              >
                Explorar Funciones
                <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 relative"
          >
            <div className="relative mx-auto max-w-4xl rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <div className="aspect-video bg-gradient-to-br from-[#111318] to-[#1A1D23] p-8 flex items-center justify-center">
                {/* Simulated Interface Preview */}
                <div className="w-full h-full rounded-xl bg-[#0B0C0E]/80 border border-white/5 p-6 flex flex-col">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-[#D05B5B]" />
                      <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                      <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                    </div>
                    <div className="flex items-center gap-2 text-[#6B7280] text-sm">
                      <Music4 className="w-4 h-4" />
                      <span>Santo es el Señor.pgm</span>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 grid grid-cols-3 gap-4">
                    {/* Waveform */}
                    <div className="col-span-2 rounded-lg bg-white/5 p-4">
                      <div className="flex items-end justify-center gap-1 h-full">
                        {[...Array(40)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1.5 bg-gradient-to-t from-[#7C5AB9] to-[#D8A45A] rounded-full waveform-bar"
                            style={{
                              height: `${Math.random() * 60 + 20}%`,
                              animationDelay: `${i * 0.05}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    {/* Controls */}
                    <div className="space-y-3">
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-[#6B7280] mb-1">Tempo</div>
                        <div className="text-[#D8A45A] font-mono">120 BPM</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-[#6B7280] mb-1">Tonalidad</div>
                        <div className="text-[#7C5AB9] font-mono">G Major</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-[#6B7280] mb-1">Estilo</div>
                        <div className="text-[#E6E7E9]">Worship</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C0E] via-transparent to-transparent pointer-events-none" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4">
        <div className="container-divine">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-cinzel text-3xl md:text-4xl font-semibold text-[#E6E7E9] mb-4">
              Diseñado para <span className="text-[#D8A45A]">Adoradores</span>
            </h2>
            <p className="text-[#A9ADB1] max-w-xl mx-auto">
              Herramientas poderosas para crear música que toca corazones y glorifica a Dios.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="feature-card card-divine group"
                data-testid={`feature-card-${index}`}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${feature.color}20` }}
                >
                  <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                </div>
                <h3 className="text-lg font-semibold text-[#E6E7E9] mb-2">{feature.title}</h3>
                <p className="text-[#A9ADB1] text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="container-divine">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#D8A45A]/20 to-[#7C5AB9]/20" />
            <div className="relative glass p-12 md:p-16 text-center">
              <Heart className="w-12 h-12 text-[#D8A45A] mx-auto mb-6" />
              <h2 className="font-cinzel text-3xl md:text-4xl font-semibold text-[#E6E7E9] mb-4">
                Comienza Tu Ministerio Musical
              </h2>
              <p className="text-[#A9ADB1] max-w-xl mx-auto mb-8">
                Únete a miles de adoradores que están creando música para la gloria de Dios.
              </p>
              <Button
                onClick={() => navigate('/auth?mode=register')}
                data-testid="cta-register-btn"
                className="btn-primary text-lg px-10 py-4 h-auto"
              >
                Crear Cuenta Gratis
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="container-divine flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Music4 className="w-6 h-6 text-[#D8A45A]" />
            <span className="font-cinzel text-[#E6E7E9]">PGospelMusic</span>
          </div>
          <p className="text-[#6B7280] text-sm">
            © 2024 PGospelMusic. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
