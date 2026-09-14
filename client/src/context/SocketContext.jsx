// Uvoz React hookova i biblioteke za Socket klijent
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Spajanje na websocket poslužitelj na portu 4000
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';
    const socket = io(url, { transports: ['websocket'] });
    socketRef.current = socket;

    // Prilikom spajanja bilježimo status i pridružujemo korisnika njegovoj sobi ako je prijavljen
    socket.on('connect', () => {
      setConnected(true);
      if (user) socket.emit('user:join', user.id);
    });

    socket.on('disconnect', () => setConnected(false));

    // Čišćenje veze pri gašenju aplikacije
    return () => {
      socket.disconnect();
    };
  }, []);

  // Ponovno pridruživanje osobnoj sobi prilikom prijave ili odjave
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && connected && user) {
      socket.emit('user:join', user.id);
    }
  }, [user, connected]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

// Prilagođeni hook za jednostavno korištenje socketa u bilo kojoj komponenti
export function useSocket() {
  return useContext(SocketContext);
}