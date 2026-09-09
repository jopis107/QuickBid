import React, { useState, useEffect } from 'react';

function App() {
  const [serverStatus, setServerStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:4000/api/health')
      .then((res) => res.json())
      .then((data) => {
        setServerStatus(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Greška pri dohvaćanju statusa:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          Quick<span className="text-brand-blue">Bid</span>
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          Platforma za aukcije uživo — Inicijalni setup
        </p>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-700 text-left">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Status poslužitelja:
          </div>
          {loading ? (
            <p className="text-slate-500 text-sm">Provjera veze...</p>
          ) : serverStatus ? (
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
                ● Povezano
              </span>
              <p className="text-sm text-slate-300">{serverStatus.message}</p>
            </div>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              ● Poslužitelj nije dostupan
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;