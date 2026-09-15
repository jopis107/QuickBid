// Uvoz hookova i komponenti za profil i kreiranje predmeta
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

const STATUS_LABELS = {
  active: { label: 'U tijeku', className: 'bg-accent/20 text-accentSoft' },
  awaiting_payment: { label: 'Čeka uplatu', className: 'bg-amber-500/20 text-amber-300' },
  completed: { label: 'Završeno', className: 'bg-emerald-500/20 text-emerald-300' },
  failed: { label: 'Neuspjelo', className: 'bg-red-500/20 text-red-300' }
};

function formatDeadline(deadline) {
  if (!deadline) return '';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Rok je istekao';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `još ${days}d ${hours}h`;
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / 60000);
  return `još ${hours}h ${minutes}min`;
}

export default function Profile() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  
  // Stanje forme za unos novog predmeta
  const [form, setForm] = useState({
    title: '',
    description: '',
    starting_price: '',
    currency: 'EUR',
    duration_minutes: 60
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState('');
  const [restartingId, setRestartingId] = useState(null);

  function loadProfile() {
    api.get('/users/me').then(({ data }) => setProfile(data));
  }

  function loadNotifications() {
    api.get('/notifications').then(({ data }) => setNotifications(data.notifications));
  }

  useEffect(() => {
    loadProfile();
    loadNotifications();
  }, []);

  // Osluškivanje novih notifikacija uživo preko socketa
  useEffect(() => {
    if (!socket) return;
    function handleNewNotification() {
      loadNotifications();
      loadProfile();
    }
    socket.on('notification:new', handleNewNotification);
    return () => socket.off('notification:new', handleNewNotification);
  }, [socket]);

  async function markAllNotificationsRead() {
    await api.post('/notifications/read-all');
    loadNotifications();
  }

  // Slanje forme za kreiranje novog predmeta s uploadom slike
  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      if (file) body.append('image', file);
      
      await api.post('/items', body, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Resetiranje forme nakon uspješne objave
      setForm({
        title: '',
        description: '',
        starting_price: '',
        currency: 'EUR',
        duration_minutes: 60
      });
      setFile(null);
      loadProfile();
    } catch (err) {
      setError(err?.response?.data?.error || 'Greška pri objavi predmeta.');
    } finally {
      setSubmitting(false);
    }
  }

  // Preuzimanje PDF računa
  async function downloadReceipt(itemId) {
    setDownloadError('');
    setDownloadingId(itemId);
    try {
      const response = await api.get(`/items/${itemId}/receipt`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `racun_${itemId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError('Preuzimanje računa nije uspjelo. Pokušajte ponovno.');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(itemId) {
    if (!confirm('Sigurno želite obrisati ovu aukciju?')) return;
    await api.delete(`/items/${itemId}`);
    loadProfile();
  }

  async function handleRestart(itemId) {
    setRestartingId(itemId);
    try {
      await api.post(`/items/${itemId}/restart`, { duration_minutes: 60 });
      loadProfile();
    } catch (err) {
      setError(err?.response?.data?.error || 'Greška pri ponovnom pokretanju aukcije.');
    } finally {
      setRestartingId(null);
    }
  }

  if (!user || !profile) return <div className="mx-auto max-w-4xl px-6 py-10 text-slate-400">Učitavanje…</div>;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-white">Moj profil</h1>
      <p className="mt-1 text-slate-400">{profile.user.username} · {profile.user.email}</p>

      {/* Sekcija s obavijestima */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-white">
            Obavijesti {unreadCount > 0 && <span className="text-sm text-accentSoft">({unreadCount} novih)</span>}
          </h2>
          {notifications.length > 0 && (
            <button onClick={markAllNotificationsRead} className="text-sm text-slate-400 hover:text-white">
              Označi sve kao pročitano
            </button>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {notifications.length === 0 && (
            <p className="text-sm text-slate-400">Nemate obavijesti.</p>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-md border px-4 py-3 text-sm ${
                n.is_read ? 'border-line bg-panel text-slate-400' : 'border-accent/50 bg-accent/5 text-slate-200'
              }`}
            >
              {n.item_id ? (
                <Link to={`/items/${n.item_id}`} className="hover:underline">
                  {n.message}
                </Link>
              ) : (
                n.message
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Obrazac za objavu novog predmeta */}
      <section className="mt-10 rounded-xl border border-line bg-panel p-6">
        <h2 className="font-display text-xl font-semibold text-white">Objavi novi predmet</h2>
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input
            required
            placeholder="Naziv predmeta"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-md border border-line bg-base px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-accent sm:col-span-2"
          />
          <textarea
            required
            placeholder="Opis predmeta"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-md border border-line bg-base px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-accent sm:col-span-2"
          />
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Početna cijena"
            value={form.starting_price}
            onChange={(e) => setForm({ ...form, starting_price: e.target.value })}
            className="rounded-md border border-line bg-base px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-accent"
          />
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="rounded-md border border-line bg-base px-3 py-2 text-white outline-none focus:border-accent"
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
          <input
            type="number"
            min="1"
            placeholder="Trajanje (min)"
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
            className="rounded-md border border-line bg-base px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-accent"
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
            className="rounded-md border border-line bg-base px-3 py-2 text-slate-300 outline-none focus:border-accent file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1 file:text-white"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-accent px-4 py-2 font-medium text-white transition hover:bg-accentSoft disabled:opacity-50 sm:col-span-2"
          >
            {submitting ? 'Objavljivanje…' : 'Objavi aukciju'}
          </button>
          {error && <p className="text-sm text-red-400 sm:col-span-2">{error}</p>}
        </form>
      </section>

      {/* Popis mojih objavljenih aukcija */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold text-white">Moje objave</h2>
        <div className="mt-4 flex flex-col gap-2">
          {profile.listings.length === 0 && (
            <p className="text-sm text-slate-400">Još niste objavili nijedan predmet.</p>
          )}
          {profile.listings.map((it) => {
            const statusInfo = STATUS_LABELS[it.status] || STATUS_LABELS.active;
            return (
              <div
                key={it.id}
                className="flex flex-col gap-2 rounded-md border border-line bg-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  <Link to={`/items/${it.id}`} className="text-slate-200 hover:text-white">
                    {it.title}
                  </Link>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-accentSoft">{it.current_price.toFixed(2)} {it.currency}</span>
                  {it.status === 'failed' && (
                    <button
                      onClick={() => handleRestart(it.id)}
                      disabled={restartingId === it.id}
                      className="rounded-md bg-accent px-3 py-1 text-white transition hover:bg-accentSoft disabled:opacity-50"
                    >
                      {restartingId === it.id ? 'Pokretanje…' : 'Ponovno pokreni'}
                    </button>
                  )}
                  {it.status === 'active' && (
                    <button onClick={() => handleDelete(it.id)} className="text-red-400 hover:text-red-300">
                      Obriši
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Popis aukcija koje čekaju uplatu */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold text-white">Aukcije koje čekam platiti</h2>
        <div className="mt-4 flex flex-col gap-2">
          {profile.pendingPayments.length === 0 && (
            <p className="text-sm text-slate-400">Trenutno nemate aukcija na čekanju uplate.</p>
          )}
          {profile.pendingPayments.map((p) => (
            <Link
              key={p.id}
              to={`/items/${p.id}`}
              className="flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 hover:border-amber-400 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-slate-200">{p.title}</span>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-accentSoft">{p.current_price.toFixed(2)} {p.currency}</span>
                <span className="text-amber-300">{formatDeadline(p.payment_deadline)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Popis pobjeda na aukcijama */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold text-white">Moje pobjede</h2>
        <div className="mt-4 flex flex-col gap-2">
          {profile.wins.length === 0 && (
            <p className="text-sm text-slate-400">Još nemate osvojenih aukcija.</p>
          )}
          {profile.wins.map((win) => (
            <div
              key={win.id}
              className="flex flex-col gap-3 rounded-md border border-line bg-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link to={`/items/${win.id}`} className="text-slate-200 hover:text-white">
                {win.title}
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-accentSoft">
                  {win.current_price.toFixed(2)} {win.currency}
                </span>
                <button
                  onClick={() => downloadReceipt(win.id)}
                  disabled={downloadingId === win.id}
                  className="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accentSoft disabled:opacity-50"
                >
                  Preuzmi račun (PDF)
                </button>
              </div>
            </div>
          ))}
          {downloadError && <p className="text-sm text-red-400">{downloadError}</p>}
        </div>
      </section>
    </div>
  );
}