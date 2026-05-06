import { useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, Mail } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (admin: { name: string; email: string }) => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const adminUsername = 'admin';
    const adminPassword = 'bantu2024';

    window.setTimeout(() => {
      if (username.trim().toLowerCase() !== adminUsername || password !== adminPassword) {
        setError('Username atau password admin salah');
        setLoading(false);
        return;
      }

      onLogin({ name: 'Admin BantuSesama', email: 'admin' });
      setLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl p-8 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-2xl bg-cyan-400/15 p-3 text-cyan-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-300">BantuSesama Admin Center</p>
              <h1 className="text-3xl font-bold">Login Admin</h1>
            </div>
          </div>

          <p className="text-sm text-slate-300 mb-6">
            Masuk menggunakan akun admin khusus untuk mengelola user, kampanye, dan verifikasi.
          </p>

          {error && (
            <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Username Admin</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 py-3 pl-10 pr-4 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400"
                  placeholder="admin"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Password Admin</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 py-3 pl-10 pr-12 text-white placeholder:text-slate-500 outline-none focus:border-cyan-400"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white transition"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {loading ? 'Memeriksa...' : 'Masuk Admin'}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-xs text-cyan-100">
            Demo login: admin / bantu2024
          </div>
        </div>
      </div>
    </div>
  );
}