import { useEffect, useState } from 'react';
import { Mail, Lock, User } from 'lucide-react';
import { apiUrl } from '../lib/apiBaseUrl';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const registeredUsersKey = 'bantusesama-registered-users';

type StoredUser = {
  name: string;
  email: string;
  password: string;
};

const getStoredUsers = () => {
  if (typeof window === 'undefined') {
    return [] as StoredUser[];
  }

  try {
    const raw = window.localStorage.getItem(registeredUsersKey);
    const parsed = raw ? (JSON.parse(raw) as StoredUser[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as StoredUser[];
  }
};

const saveStoredUsers = (users: StoredUser[]) => {
  window.localStorage.setItem(registeredUsersKey, JSON.stringify(users));
};

const seedDemoUser = () => {
  const users = getStoredUsers();
  if (users.some((user) => user.email === 'demo@example.com')) {
    return users;
  }

  const seededUsers = [
    ...users,
    { name: 'demo', email: 'demo@example.com', password: 'password' }
  ];
  saveStoredUsers(seededUsers);
  return seededUsers;
};

interface LoginRegisterProps {
  onLogin: (user: { name: string; email?: string }) => void;
}

export function LoginRegister({ onLogin }: LoginRegisterProps) {
  const isLocalDev = import.meta.env.DEV && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const syncLocalUser = (user: StoredUser) => {
    const existing = getStoredUsers();
    if (!existing.some((item) => item.email.toLowerCase() === user.email.toLowerCase())) {
      saveStoredUsers([...existing, user]);
    }
  };

  const loginWithServer = async (email: string, password: string) => {
    const response = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || body.error || 'Login gagal');
    }

    return response.json() as Promise<{ token: string; user: { name: string; email: string } }>;
  };

  const registerWithServer = async (name: string, email: string, password: string) => {
    const response = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || body.error || 'Registrasi gagal');
    }

    return response.json() as Promise<{ token: string; user: { name: string; email: string } }>;
  };

  const migrateUserToServer = async (user: StoredUser) => {
    try {
      const result = await registerWithServer(user.name, user.email, user.password);
      window.localStorage.setItem('token', result.token);
      window.localStorage.setItem('bantusesama-user-session', JSON.stringify(result.user));
    } catch (err) {
      // Ignore migration conflicts or when the backend is unavailable.
    }
  };

  useEffect(() => {
    if (!isLocalDev) {
      return;
    }

    const users = seedDemoUser();
    users.forEach((user) => {
      void migrateUserToServer(user);
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const email = formData.email.trim();
        const users = isLocalDev ? seedDemoUser() : [];
        const matchedUser = users.find((user) => user.email.toLowerCase() === email.toLowerCase());

        // Login validation
        if (!email || !formData.password) {
          setError('Email dan password harus diisi');
          setLoading(false);
          return;
        }

        if (!emailPattern.test(email)) {
          setError('Email tidak valid');
          setLoading(false);
          return;
        }

        try {
          const serverLogin = await loginWithServer(email, formData.password);
          window.localStorage.setItem('token', serverLogin.token);
          window.localStorage.setItem('bantusesama-user-session', JSON.stringify(serverLogin.user));
          if (isLocalDev) {
            syncLocalUser({ name: serverLogin.user.name, email: serverLogin.user.email, password: formData.password });
          }
          onLogin({
            name: serverLogin.user.name,
            email: serverLogin.user.email
          });
        } catch {
          if (!isLocalDev || !matchedUser || matchedUser.password !== formData.password) {
            setError('Akun belum terdaftar di server atau password salah');
            setLoading(false);
            return;
          }

          // Fallback akun demo/lokal hanya untuk localhost development.
          syncLocalUser(matchedUser);
          void migrateUserToServer(matchedUser);
          onLogin({
            name: matchedUser.name,
            email: matchedUser.email
          });
        }
      } else {
        const email = formData.email.trim();

        // Registration validation
        if (!formData.name.trim() || !email || !formData.password || !formData.confirmPassword) {
          setError('Semua field harus diisi');
          setLoading(false);
          return;
        }

        if (!emailPattern.test(email)) {
          setError('Email tidak valid');
          setLoading(false);
          return;
        }

        if (formData.password.length < 6) {
          setError('Password minimal 6 karakter');
          setLoading(false);
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          setError('Password tidak cocok');
          setLoading(false);
          return;
        }

        const users = isLocalDev ? seedDemoUser() : [];

        try {
          const serverAccount = await registerWithServer(formData.name.trim(), email, formData.password);
          window.localStorage.setItem('token', serverAccount.token);
          window.localStorage.setItem('bantusesama-user-session', JSON.stringify(serverAccount.user));
          if (isLocalDev) {
            syncLocalUser({
              name: serverAccount.user.name,
              email: serverAccount.user.email,
              password: formData.password
            });
          }
          onLogin({
            name: serverAccount.user.name,
            email: serverAccount.user.email
          });
        } catch (serverErr) {
          if (!isLocalDev) {
            setError(serverErr instanceof Error ? serverErr.message : 'Registrasi gagal di server');
            setLoading(false);
            return;
          }

          // Fallback lokal agar mode demo masih jalan ketika backend tidak tersedia.
          saveStoredUsers([
            ...users,
            {
              name: formData.name.trim(),
              email,
              password: formData.password
            }
          ]);

          onLogin({
            name: formData.name.trim(),
            email
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (isLogin ? 'Login gagal' : 'Registrasi gagal'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isLogin ? 'Masuk' : 'Daftar'}
            </h1>
            <p className="text-gray-600">
              {isLogin ? 'Masuk ke akun Anda' : 'Buat akun baru'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field (only for registration) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nama lengkap"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Password"
                />
              </div>
            </div>

            {/* Confirm Password Field (only for registration) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Konfirmasi password"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition mt-6"
            >
              {loading ? (isLogin ? 'Masuk...' : 'Daftar...') : (isLogin ? 'Masuk' : 'Daftar')}
            </button>
          </form>

          {/* Toggle between Login/Register */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setFormData({
                    name: '',
                    email: '',
                    password: '',
                    confirmPassword: ''
                  });
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                {isLogin ? 'Daftar di sini' : 'Masuk di sini'}
              </button>
            </p>
          </div>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-xs text-gray-600">
            <p className="font-semibold mb-1">Demo Credentials:</p>
            <p>Email: demo@example.com</p>
            <p>Password: password</p>
          </div>
        </div>
      </div>
    </div>
  );
}
