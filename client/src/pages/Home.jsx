// Uvoz React stanja, axios klijenta i kartice predmeta
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import ItemCard from '../components/ItemCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [rate, setRate] = useState(null);

  useEffect(() => {
    let mounted = true;

    // Dohvat liste predmeta s poslužitelja
    api.get('/items').then(({ data }) => {
      if (mounted) {
        setItems(data.items);
        setLoading(false);
      }
    });

    // Dohvat tečaja valuta s poslužitelja (poziv vanjskog Frankfurter API-ja)
    api
      .get('/items/currency/convert', { params: { amount: 1, from: 'EUR', to: 'USD' } })
      .then(({ data }) => mounted && setRate(data.result))
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  // Filtriranje predmeta po statusu (aktivne, završene, neuspjele)
  const visible = items.filter((item) => item.status === filter);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Zaglavlje početne stranice s tečajem i CTA gumbom */}
      <section className="mb-10 flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-white sm:text-4xl">
            Aukcije u tijeku
          </h1>
          <p className="mt-2 max-w-lg text-slate-400">
            Pratite ponude uživo i licitirajte u stvarnom vremenu. Cijene se ažuriraju
            trenutno kod svih korisnika koji gledaju istu aukciju.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          {rate && (
            <span className="rounded-md border border-line bg-panel px-3 py-1.5 text-xs text-slate-400">
              1 EUR ≈ {rate.toFixed(4)} USD
            </span>
          )}
          {user && (
            <Link
              to="/profile"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentSoft"
            >
              + Objavi novi predmet
            </Link>
          )}
        </div>
      </section>

      {/* Filter gumbi za odabir prikaza */}
      <div className="mb-6 flex gap-2">
        {[
          { key: 'active', label: 'Aktivne' },
          { key: 'awaiting_payment', label: 'Završene' },
          { key: 'failed', label: 'Neuspjele' }
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              filter === f.key
                ? 'bg-accent text-white'
                : 'border border-line text-slate-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Prikaz kartica aukcija ili poruke ako nema predmeta */}
      {loading ? (
        <p className="text-slate-400">Učitavanje aukcija…</p>
      ) : visible.length === 0 ? (
        <p className="text-slate-400">Trenutno nema aukcija u ovoj kategoriji.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}