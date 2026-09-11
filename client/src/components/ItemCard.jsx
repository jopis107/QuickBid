// Uvoz usmjerivača i prilagođenog hooka za odbrojavanje
import React from 'react';
import { Link } from 'react-router-dom';
import { useCountdown } from '../hooks/useCountdown.js';

// Određivanje osnovne adrese servera za dohvat slika
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

// Definicija vizualnih oznaka za pojedini status aukcije
const STATUS_LABELS = {
  active: { label: 'U tijeku', className: 'bg-accent/20 text-accentSoft' },
  awaiting_payment: { label: 'Čeka uplatu', className: 'bg-amber-500/20 text-amber-300' },
  completed: { label: 'Završeno', className: 'bg-emerald-500/20 text-emerald-300' },
  failed: { label: 'Neuspjelo', className: 'bg-red-500/20 text-red-300' }
};

export default function ItemCard({ item }) {
  const isActive = item.status === 'active';
  const countdown = useCountdown(isActive ? item.ends_at : null);
  const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.active;

  // Dinamičko određivanje bedža: ako aukcija traje, prikazuje odbrojavanje uživo
  let badgeLabel = statusInfo.label;
  let badgeClassName = statusInfo.className;
  if (isActive) {
    if (countdown.expired) {
      badgeLabel = 'Završeno';
      badgeClassName = 'bg-red-500/20 text-red-300';
    } else {
      badgeLabel = countdown.label;
    }
  }

  return (
    <Link
      to={`/items/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-panel transition hover:border-accent"
    >
      {/* Prikaz slike predmeta */}
      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-800">
        {item.image_path ? (
          <img
            src={`${API_ORIGIN}${item.image_path}`}
            alt={item.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500">
            Nema slike
          </div>
        )}
      </div>

      {/* Detalji predmeta: naziv, opis i trenutna cijena */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-white">{item.title}</h3>
          <span
            className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${badgeClassName}`}
          >
            {badgeLabel}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-slate-400">{item.description}</p>
        <div className="mt-auto flex items-center justify-between pt-2 text-sm">
          <span className="text-slate-400">Trenutna cijena</span>
          <span className="font-display text-lg font-semibold text-accentSoft">
            {item.current_price.toFixed(2)} {item.currency || 'EUR'}
          </span>
        </div>
      </div>
    </Link>
  );
}