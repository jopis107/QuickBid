// Uvoz React biblioteke
import React from 'react';
// Uvoz routing komponenti iz react-router-dom za rad sa stranicama bez osvježavanja preglednika
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// Uvoz konteksta koji svim komponentama omogućuje pristup podacima o prijavljenom korisniku
import { AuthProvider } from './context/AuthContext.jsx';
// Uvoz navigacijske trake (header)
import Navbar from './components/Navbar.jsx';
//Uvoz stranice za prijavu
import Home from './pages/Home.jsx';
// Uvoz stranice za prijavu
import Login from './pages/Login.jsx';
// Uvoz stranice za registraciju
import Register from './pages/Register.jsx';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-base text-slate-100 flex flex-col">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Naslovna stranica sada prikazuje stvarni katalog predmeta */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;