// Komponenta forme za unos nove licitacije
import React, { useState } from 'react';

export default function BidForm({ currentPrice, currency, disabled, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const value = parseFloat(amount);

    // Provjera je li ponuđeni iznos veći od trenutne cijene
    if (isNaN(value) || value <= currentPrice) {
      setError(`Ponuda mora biti veća od ${currentPrice.toFixed(2)} ${currency}.`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(value);
      setAmount('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Ponuda nije uspjela.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="text-sm text-slate-400" htmlFor="bid-amount">
        Vaša ponuda ({currency})
      </label>
      <div className="flex gap-2">
        <input
          id="bid-amount"
          type="number"
          step="0.01"
          min={currentPrice + 0.01}
          placeholder={`min. ${(currentPrice + 0.01).toFixed(2)}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-line bg-base px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || submitting}
          className="shrink-0 rounded-md bg-accent px-4 py-2 font-medium text-white transition hover:bg-accentSoft disabled:opacity-50"
        >
          {submitting ? 'Šalje se…' : 'Licitiraj'}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}