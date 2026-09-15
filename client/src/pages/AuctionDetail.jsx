// Uvoz React hookova za rad sa stanjem, životnim ciklusom i parametrima URL-a
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
// Uvoz axios klijenta za HTTP komunikaciju
import api from '../api/axios.js';
// Uvoz konteksta za autentikaciju i websockets
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
// Pomoćni hook za odbrojavanje vremena uživo
import { useCountdown } from '../hooks/useCountdown.js';
// Komponenta forme za unos ponude
import BidForm from '../components/BidForm.jsx';

// Osnovna adresa poslužitelja za dohvat slika
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

// Definicija vizualnih stilova i naziva za svaki status aukcije
const STATUS_LABELS = {
  active: { label: 'U tijeku', className: 'bg-accent/20 text-accentSoft' },
  awaiting_payment: { label: 'Čeka uplatu', className: 'bg-amber-500/20 text-amber-300' },
  completed: { label: 'Završeno', className: 'bg-emerald-500/20 text-emerald-300' },
  failed: { label: 'Neuspjelo', className: 'bg-red-500/20 text-red-300' }
};

// Funkcija za formatiranje preostalog roka za uplatu
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

export default function AuctionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();

  // Stanja komponente
  const [item, setItem] = useState(null);
  const [bids, setBids] = useState([]);
  const [rankedBidders, setRankedBidders] = useState([]);
  const [error, setError] = useState('');
  const [restarting, setRestartingId] = useState(false);
  const [proofFile, setProofFile] = useState(null);
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [proofError, setProofError] = useState('');

  // Dohvat svih podataka o aukciji, ponudama i rangiranim kupcima
  function loadItem() {
    return api.get(`/items/${id}`).then(({ data }) => {
      setItem(data.item);
      setBids(data.bids || []);
      setRankedBidders(data.rankedBidders || []);
    });
  }

  useEffect(() => {
    let mounted = true;
    loadItem().catch(() => {});
    return () => {
      mounted = false;
    };
  }, [id]);

  // Slušanje promjena uživo preko socketa
  useEffect(() => {
    if (!socket) return;
    socket.emit('item:join', id);

    function handleBidUpdate(payload) {
      if (String(payload.itemId) !== String(id)) return;
      setItem((prev) => (prev ? { ...prev, current_price: payload.current_price } : prev));
      setBids(payload.bids);
    }

    function handleStatusChange(payload) {
      if (String(payload.itemId) !== String(id)) return;
      setItem(payload.item);
      loadItem().catch(() => {});
    }

    socket.on('bid:update', handleBidUpdate);
    socket.on('auction:ended', handleStatusChange);
    socket.on('auction:status_changed', handleStatusChange);

    return () => {
      socket.emit('item:leave', id);
      socket.off('bid:update', handleBidUpdate);
      socket.off('auction:ended', handleStatusChange);
      socket.off('auction:status_changed', handleStatusChange);
    };
  }, [socket, id]);

  // Odbrojavanje do isteka aukcije
  const countdown = useCountdown(item?.status === 'active' ? item.ends_at : null);

  // Slanje nove ponude
  async function placeBid(amount) {
    const { data } = await api.post(`/items/${id}/bid`, { amount });
    setItem(data.item);
    setBids(data.bids);
  }

  // Ponovno pokretanje aukcije ako je neuspjela
  async function handleRestart() {
    setRestartingId(true);
    setError('');
    try {
      const { data } = await api.post(`/items/${id}/restart`, { duration_minutes: 60 });
      setItem(data.item);
      await loadItem();
    } catch (err) {
      setError(err?.response?.data?.error || 'Greška pri ponovnom pokretanju aukcije.');
    } finally {
      setRestartingId(false);
    }
  }

  // Slanje potvrde o uplati
  async function handleProofSubmit(e) {
    e.preventDefault();
    setProofError('');
    if (!proofFile) {
      setProofError('Odaberite datoteku (slika ili PDF) s potvrdom o uplati.');
      return;
    }
    setProofSubmitting(true);
    try {
      const body = new FormData();
      body.append('proof', proofFile);
      const { data } = await api.post(`/items/${id}/payment-proof`, body, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setItem(data.item);
      setProofFile(null);
    } catch (err) {
      setProofError(err?.response?.data?.error || 'Slanje potvrde nije uspjelo.');
    } finally {
      setProofSubmitting(false);
    }
  }

  // Preuzimanje PDF računa
  async function downloadReceipt() {
    const response = await api.get(`/items/${id}/receipt`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `racun_${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  if (!item) return <div className="mx-auto max-w-4xl px-6 py-10 text-slate-400">Učitavanje…</div>;

  const isOwner = user && user.id === item.owner_id;
  const isCurrentPayer = user && item.status === 'awaiting_payment' && item.winner_id === user.id;
  const canDownloadReceipt =
    user &&
    item.winner_id === user.id &&
    (item.status === 'awaiting_payment' || item.status === 'completed');
  const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.active;
  const biddingLocked = item.status === 'active' && countdown.expired;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Slika predmeta */}
        <div className="aspect-[4/3] overflow-hidden rounded-xl border border-line bg-panel">
          {item.image_path ? (
            <img
              src={`${API_ORIGIN}${item.image_path}`}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500">
              Nema slike
            </div>
          )}
        </div>

        {/* Informacije i kontrole aukcije */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">{item.title}</h1>
            <p className="mt-1 text-sm text-slate-400">Objavio: {item.owner_username}</p>
          </div>
          <p className="text-slate-300">{item.description}</p>

          <div className="rounded-xl border border-line bg-panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Trenutna cijena</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  biddingLocked ? 'bg-red-500/20 text-red-300' : statusInfo.className
                }`}
              >
                {biddingLocked ? 'Aukcija je završena' : statusInfo.label}
              </span>
            </div>
            <p className="mt-1 font-display text-3xl font-semibold text-accentSoft">
              {item.current_price.toFixed(2)} {item.currency}
            </p>

            {/* Prikaz odbrojavanja vremena */}
            {item.status === 'active' && (
              <div className="mt-3 rounded-lg border border-line bg-base px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {biddingLocked ? 'Aukcija je završena' : 'Preostalo vrijeme'}
                </p>
                <p
                  className={`mt-1 font-display text-2xl font-semibold tabular-nums sm:text-3xl ${
                    biddingLocked ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {countdown.label}
                </p>
              </div>
            )}

            {/* Obrazac za unos ponude */}
            {item.status === 'active' && !isOwner && user && (
              <div className="mt-4">
                <BidForm
                  currentPrice={item.current_price}
                  currency={item.currency}
                  disabled={biddingLocked}
                  onSubmit={placeBid}
                />
                {biddingLocked && (
                  <p className="mt-2 text-sm text-red-400">
                    Vrijeme za licitiranje je isteklo. Rezultati će uskoro biti obrađeni.
                  </p>
                )}
              </div>
            )}
            {item.status === 'active' && !user && (
              <p className="mt-4 text-sm text-slate-400">Prijavite se za licitiranje.</p>
            )}
            {item.status === 'active' && isOwner && (
              <p className="mt-4 text-xs italic text-slate-400">
                Vi ste vlasnik ove aukcije. Aukcija će automatski završiti kada istekne zadano vrijeme.
              </p>
            )}

            {/* Sekcija za uplatu */}
            {item.status === 'awaiting_payment' && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                {isCurrentPayer ? (
                  <>
                    <p className="text-sm text-amber-200">
                      Vi ste trenutno {item.payment_rank}. mjesto na listi ponuda i imate pravo kupnje.
                      Rok za uplatu: <span className="font-medium">{formatDeadline(item.payment_deadline)}</span>.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={downloadReceipt}
                        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft"
                      >
                        Preuzmi račun (PDF)
                      </button>
                    </div>
                    <form onSubmit={handleProofSubmit} className="mt-3 flex flex-col gap-2">
                      <label className="text-xs text-slate-400">Potvrda o uplati (slika ili PDF)</label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => setProofFile(e.target.files[0])}
                          className="w-full rounded-md border border-line bg-base px-3 py-2 text-sm text-slate-300 outline-none focus:border-accent file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1 file:text-white"
                        />
                        <button
                          type="submit"
                          disabled={proofSubmitting}
                          className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft disabled:opacity-50"
                        >
                          {proofSubmitting ? 'Slanje…' : 'Pošalji potvrdu'}
                        </button>
                      </div>
                      {proofError && <p className="text-sm text-red-400">{proofError}</p>}
                    </form>
                  </>
                ) : (
                  <p className="text-sm text-amber-200">
                    Aukcija je završila i čeka potvrdu o uplati trenutno rangiranog kupca
                    ({item.payment_rank}. mjesto).
                  </p>
                )}
              </div>
            )}

            {/* Sekcija kada je aukcija uspješno završena */}
            {item.status === 'completed' && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="text-sm text-emerald-200">
                  Uplata je potvrđena — aukcija je uspješno zaključena.
                </p>
                {canDownloadReceipt && (
                  <button
                    onClick={downloadReceipt}
                    className="mt-3 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft"
                  >
                    Preuzmi potvrdu i podatke za uplatu (PDF)
                  </button>
                )}
              </div>
            )}

            {/* Sekcija za neuspjelu aukciju */}
            {item.status === 'failed' && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <p className="text-sm text-red-300">
                  Nijedan od ponuditelja nije izvršio uplatu u zadanom roku. Transakcija nije izvršena.
                </p>
                {isOwner && (
                  <button
                    onClick={handleRestart}
                    disabled={restarting}
                    className="mt-3 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft disabled:opacity-50"
                  >
                    {restarting ? 'Pokretanje…' : 'Ponovno pokreni aukciju'}
                  </button>
                )}
              </div>
            )}

            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>

          {/* Redoslijed rangiranih ponuđača */}
          {rankedBidders.length > 0 && (item.status === 'awaiting_payment' || item.status === 'failed') && (
            <div className="rounded-xl border border-line bg-panel p-4">
              <h3 className="text-sm font-medium text-slate-300">Lista ponuda (redoslijed plaćanja)</h3>
              <div className="mt-2 flex flex-col gap-1">
                {rankedBidders.map((b, idx) => (
                  <div key={b.user_id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      {idx + 1}. mjesto — {b.username}
                    </span>
                    <span className="text-slate-300">{b.amount.toFixed(2)} {item.currency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Popis ponuda uživo */}
      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold text-white">Ponude uživo</h2>
        <div className="mt-3 flex flex-col gap-2">
          {bids.length === 0 && <p className="text-sm text-slate-400">Još nema ponuda.</p>}
          {bids.map((bid) => (
            <div
              key={bid.id}
              className="flex items-center justify-between rounded-md border border-line bg-panel px-4 py-2 text-sm"
            >
              <span className="text-slate-300">{bid.username}</span>
              <span className="font-medium text-accentSoft">
                {bid.amount.toFixed(2)} {item.currency}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}