import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Music4, User, LogOut, LayoutDashboard, Mic, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';

const Navbar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/voice-studio', label: 'Voice Studio', icon: Mic },
    { path: '/create', label: 'Crear Canción', icon: Music4 },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="container-divine">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            to={user ? '/dashboard' : '/'} 
            className="flex items-center gap-3 group"
            data-testid="navbar-logo"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D8A45A] to-[#7C5AB9] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Music4 className="w-5 h-5 text-[#0B0C0E]" />
            </div>
            <span className="font-cinzel text-xl font-bold text-[#E6E7E9] hidden sm:block">
              PGospel<span className="text-[#D8A45A]">Music</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  data-testid={`nav-link-${link.path.slice(1)}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                    isActive(link.path)
                      ? 'bg-[#D8A45A]/10 text-[#D8A45A] border border-[#D8A45A]/30'
                      : 'text-[#A9ADB1] hover:text-[#E6E7E9] hover:bg-white/5'
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              ))}
            </div>
          )}

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <User className="w-4 h-4 text-[#D8A45A]" />
                  <span className="text-sm text-[#E6E7E9]">{user.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onLogout}
                  data-testid="logout-btn"
                  className="text-[#A9ADB1] hover:text-[#D8A45A] hover:bg-white/5"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/auth')}
                  data-testid="login-btn"
                  className="text-[#A9ADB1] hover:text-[#E6E7E9]"
                >
                  Iniciar Sesión
                </Button>
                <Button
                  onClick={() => navigate('/auth?mode=register')}
                  data-testid="register-btn"
                  className="btn-primary"
                >
                  Comenzar
                </Button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            {user && (
              <button
                className="md:hidden p-2 text-[#A9ADB1] hover:text-[#E6E7E9]"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="mobile-menu-toggle"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {user && mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/5">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 ${
                  isActive(link.path)
                    ? 'bg-[#D8A45A]/10 text-[#D8A45A]'
                    : 'text-[#A9ADB1]'
                }`}
              >
                <link.icon className="w-5 h-5" />
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
