import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.error || 'Prijava nije uspjela.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-16">
      <h1 className="font-display text-2xl font-semibold text-white">Prijava</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input
          required
          placeholder="Korisničko ime"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-md border border-line bg-panel px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-accent"
        />
        <input
          required
          type="password"
          placeholder="Lozinka"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-line bg-panel px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-4 py-2 font-medium text-white transition hover:bg-accentSoft disabled:opacity-50"
        >
          {submitting ? 'Prijava…' : 'Prijavi se'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
      <p className="mt-4 text-sm text-slate-400">
        Nemate račun? <Link to="/register" className="text-accentSoft hover:underline">Registrirajte se</Link>
      </p>
    </div>
  );
}
