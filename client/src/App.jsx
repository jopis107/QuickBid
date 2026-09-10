// Uvoz React biblioteke
import React from 'react';
// Uvoz routing komponenti iz react-router-dom za rad sa stranicama bez osvježavanja preglednika
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// Uvoz konteksta koji svim komponentama omogućuje pristup podacima o prijavljenom korisniku
import { AuthProvider } from './context/AuthContext.jsx';
// Uvoz navigacijske trake (header)
import Navbar from './components/Navbar.jsx';
// Uvoz stranice za prijavu
import Login from './pages/Login.jsx';
// Uvoz stranice za registraciju
import Register from './pages/Register.jsx';

function App() {
  return (
    // AuthProvider omotava cijelu aplikaciju kako bi svaka podkomponenta znala tko je prijavljen
    <AuthProvider>
      {/* BrowserRouter omogućuje navigaciju i promjenu URL adresa u pregledniku */}
      <BrowserRouter>
        <div className="min-h-screen bg-base text-slate-100 flex flex-col">
          {/* Navigacijska traka uvijek stoji na vrhu ekrana */}
          <Navbar />

          {/* Glavni radni prostor stranice koji mijenja sadržaj ovisno o ruti */}
          <main className="flex-1">
            <Routes>
              {/* Početna ruta - jednostavna pozdravna poruka za fazu autentikacije */}
              <Route
                path="/"
                element={
                  <div className="mx-auto max-w-6xl px-6 py-16 text-center">
                    <h1 className="text-4xl font-bold text-white mb-4">
                      Dobrodošli na <span className="text-accent">QuickBid</span>
                    </h1>
                    <p className="text-slate-400 max-w-md mx-auto">
                      Sustav autentikacije je aktivan. Prijavite se na svoj račun ili izradite novi kako biste mogli sudjelovati na aukcijama.
                    </p>
                  </div>
                }
              />

              {/* Ruta za obrazac prijave (/login) */}
              <Route path="/login" element={<Login />} />

              {/* Ruta za obrazac registracije (/register) */}
              <Route path="/register" element={<Register />} />

              {/* Bilo koja nepostojeća adresa automatski preusmjerava natrag na početnu stranicu */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;