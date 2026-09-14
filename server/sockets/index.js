function registerSocketHandlers(io) {
  
  io.on('connection', (socket) => {
    
    // Klijent se pridružuje sobi određene aukcije kako bi primao samo njene ponude
    socket.on('item:join', (itemId) => {
      socket.join(`item_${itemId}`);
    });

    // Napuštanje pripadajuće sobe
    socket.on('item:leave', (itemId) => {
      socket.leave(`item_${itemId}`);
    });

    // Osobna soba korisnika za primanje ciljanih obavijesti
    socket.on('user:join', (userId) => {
      if (userId) socket.join(`user_${userId}`);
    });

    // Izlazak korisnika iz osobne sobe
    socket.on('user:leave', (userId) => {
      if (userId) socket.leave(`user_${userId}`);
    });

    // Socket automatski čisti sve sobe u kojima je klijent bio kada se veza prekine
    socket.on('disconnect', () => {});
  });
}

module.exports = registerSocketHandlers;