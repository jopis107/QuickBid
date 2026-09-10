import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-base/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-display text-xl font-semibold tracking-tight text-white">
          Quick<span className="text-accent">Bid</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-slate-300">
          <Link to="/" className="hover:text-white">Katalog</Link>
          {user ? (
            <>
              <Link to="/profile" className="hover:text-white">Moj profil</Link>
              <span className="hidden text-slate-500 sm:inline">•</span>
              <span className="hidden text-slate-400 sm:inline">{user.username}</span>
              <button
                onClick={handleLogout}
                className="rounded-md border border-line px-3 py-1.5 text-slate-200 transition hover:border-accent hover:text-white"
              >
                Odjava
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-white">Prijava</Link>
              <Link
                to="/register"
                className="rounded-md bg-accent px-3 py-1.5 font-medium text-white transition hover:bg-accentSoft"
              >
                Registracija
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
