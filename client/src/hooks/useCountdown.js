import { useState, useEffect } from 'react';

// Hook koji svake sekunde računa preostalo vrijeme do isteka aukcije
export function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState({ expired: false, label: '' });

  useEffect(() => {
    if (!targetDate) return;

    function calculate() {
      const difference = new Date(targetDate).getTime() - Date.now();

      if (difference <= 0) {
        setTimeLeft({ expired: true, label: 'Završeno' });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      let label = '';
      if (days > 0) label = `${days}d ${hours}h`;
      else if (hours > 0) label = `${hours}h ${minutes}m`;
      else label = `${minutes}m ${seconds}s`;

      setTimeLeft({ expired: false, label });
    }

    calculate();
    // Pokrećemo interval koji ažurira odbrojavanje svake sekunde
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}