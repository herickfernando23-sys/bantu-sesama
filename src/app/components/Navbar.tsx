import { Logo } from './Logo';
import { Menu, X, Heart, User } from 'lucide-react';
import { useState } from 'react';


interface NavbarProps {
  onNavigate?: (page: string) => void;
  onHome?: () => void;
  user?: { name: string } | null;
  onLogout?: () => void;
}

export function Navbar({ onNavigate, onHome, user, onLogout }: NavbarProps) {

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Logo onClick={onHome} />

          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => (onNavigate && onNavigate('kampanye'))} className="text-gray-700 hover:text-blue-600">Kampanye</button>
            <button onClick={() => (onNavigate && onNavigate('cara-kerja'))} className="text-gray-700 hover:text-blue-600">Cara Kerja</button>
            <button onClick={() => (onNavigate && onNavigate('donasi-saya'))} className="text-gray-700 hover:text-blue-600 flex items-center gap-1">
              <Heart className="w-4 h-4" />
              Donasi Saya
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <button onClick={() => (onNavigate && onNavigate('panel'))} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                  Hi, {user.name}
                </button>
                <button onClick={onLogout} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                  Logout
                </button>
              </>
            ) : (
              <>
                <button onClick={() => (onNavigate && onNavigate('login'))} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Masuk
                </button>
                <button onClick={() => (onNavigate && onNavigate('buat-kampanye'))} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Mulai Kampanye
                </button>
              </>
            )}
          </div>

          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-3">
            <button onClick={() => { setMobileMenuOpen(false); onNavigate && onNavigate('kampanye'); }} className="block py-2 text-gray-700 w-full text-left">Kampanye</button>
            <button onClick={() => { setMobileMenuOpen(false); onNavigate && onNavigate('cara-kerja'); }} className="block py-2 text-gray-700 w-full text-left">Cara Kerja</button>
            <button onClick={() => { setMobileMenuOpen(false); onNavigate && onNavigate('donasi-saya'); }} className="block py-2 text-gray-700 w-full text-left">Donasi Saya</button>
            <button onClick={() => { setMobileMenuOpen(false); onNavigate && onNavigate('login'); }} className="w-full py-2 text-gray-700 border rounded-lg">Masuk</button>
            <button onClick={() => { setMobileMenuOpen(false); onNavigate && onNavigate('buat-kampanye'); }} className="w-full py-2 bg-blue-600 text-white rounded-lg">Mulai Kampanye</button>
          </div>
        )}
      </div>
    </nav>
  );
}
