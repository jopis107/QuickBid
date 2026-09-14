// Uvoz hookova, axios klijenta i socket konteksta
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import BidForm from '../components/BidForm.jsx';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

const STATUS_LABELS = {
  active: { label: 'U tijeku', className: 'bg-accent/20 text-accentSoft' },
  awaiting_payment: { label: 'Čeka uplatu', className: 'bg-amber-500/20 text-amber-300' },
  completed: { label: 'Završeno', className: 'bg-emerald-500/20 text-emerald-300' },
  failed: { label: 'Neuspjelo', className: 'bg-red-500/20 text-red-300' }
};

export default function AuctionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [item, setItem] = useState(null);
  const [bids, setBids] = useState([]);
  const [rankedBidders, setRankedBidders] = useState([]);
  const [error, setError] = useState('');

  // Dohvat početnih detalja o aukciji s poslužitelja
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

  // Spajanje na Socket.io sobu za ovu aukciju
  useEffect(() => {
    if (!socket) return;
    socket.emit('item:join', id);

    // Osluškivanje nove ponude uživo
    function handleBidUpdate(payload) {
      if (String(payload.itemId) !== String(id)) return;
      setItem((prev) => (prev ? { ...prev, current_price: payload.current_price } : prev));
      setBids(payload.bids);
    }

    socket.on('bid:update', handleBidUpdate);

    return () => {
      socket.emit('item:leave', id);
      socket.off('bid:update', handleBidUpdate);
    };
  }, [socket, id]);

  const countdown = useCountdown(item?.status === 'active' ? item.ends_at : null);

  // Funkcija za slanje ponude poslužitelju
  async function placeBid(amount) {
    const { data } = await api.post(`/items/${id}/bid`, { amount });
    setItem(data.item);
    setBids(data.bids);
  }

  if (!item) return <div className="mx-auto max-w-4xl px-6 py-10 text-slate-400">Učitavanje…</div>;

  const isOwner = user && user.id === item.owner_id;
  const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.active;
  const biddingLocked = item.status === 'active' && countdown.expired;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Prikaz slike predmeta */}
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

        {/* Informacije i forma za licitiranje */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">{item.title}</h1>
            <p className="mt-1 text-sm text-slate-400">Objavio: {item.owner_username}</p>
          </div>
          <p className="text-slate-300">{item.description}</p>

          <div className="rounded-xl border border-line bg-panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Trenutna cijena</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                {biddingLocked ? 'Aukcija je završena' : statusInfo.label}
              </span>
            </div>
            <p className="mt-1 font-display text-3xl font-semibold text-accentSoft">
              {item.current_price.toFixed(2)} {item.currency || 'EUR'}
            </p>

            {/* Odbrojavanje vremena uživo */}
            {item.status === 'active' && (
              <div className="mt-3 rounded-lg border border-line bg-base px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Preostalo vrijeme</p>
                <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-white">
                  {countdown.label}
                </p>
              </div>
            )}

            {/* Forma za unos ponude */}
            {item.status === 'active' && !isOwner && user && (
              <div className="mt-4">
                <BidForm
                  currentPrice={item.current_price}
                  currency={item.currency || 'EUR'}
                  disabled={biddingLocked}
                  onSubmit={placeBid}
                />
              </div>
            )}

            {item.status === 'active' && !user && (
              <p className="mt-4 text-sm text-slate-400">Prijavite se kako biste mogli licitirati.</p>
            )}

            {item.status === 'active' && isOwner && (
              <p className="mt-4 text-xs text-slate-500">Vlasnik ste ovog predmeta.</p>
            )}

            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>
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
                {bid.amount.toFixed(2)} {item.currency || 'EUR'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}