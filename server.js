const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── In-memory state ──────────────────────────────────────────────────────────
// Node.js è single-threaded: tutte le operazioni sulle variabili sono atomiche.
let roundId = 1;                              // incrementato ad ogni reset
let votes   = { collabora: 0, nonCollabora: 0 };
let voters  = new Set();                      // voterIds che hanno già votato

app.use(express.json({ limit: '1kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Status (lightweight — chiamato al caricamento pagina) ────────────────────
// Ritorna solo il roundId corrente, usato dal client per rilevare un reset.
app.get('/api/status', (_req, res) => {
  res.json({ roundId });
});

// ─── Votazione ────────────────────────────────────────────────────────────────
app.post('/api/vote', (req, res) => {
  const { voterId, choice, roundId: clientRound } = req.body;

  // Validazione input
  if (
    typeof voterId !== 'string' ||
    voterId.length < 8 ||
    voterId.length > 64 ||
    !['collabora', 'nonCollabora'].includes(choice)
  ) {
    return res.status(400).json({ error: 'Richiesta non valida.' });
  }

  // Il client sta votando per un round già resettato → invitalo a ricaricare
  if (typeof clientRound === 'number' && clientRound !== roundId) {
    return res.status(409).json({ error: 'Votazione resettata.', resetDetected: true, roundId });
  }

  // Doppio voto
  if (voters.has(voterId)) {
    return res.status(409).json({ error: 'Hai già votato.', alreadyVoted: true, roundId });
  }

  voters.add(voterId);
  votes[choice]++;

  console.log(`[VOTE] round=${roundId} ${choice} — tot: ${voters.size}`);
  res.json({ success: true, choice, roundId });
});

// ─── Risultati (admin) ────────────────────────────────────────────────────────
app.get('/api/results', (_req, res) => {
  const total = voters.size;
  res.json({
    roundId,
    collabora:      votes.collabora,
    nonCollabora:   votes.nonCollabora,
    total,
    pctCollabora:    total ? ((votes.collabora    / total) * 100).toFixed(1) : '0.0',
    pctNonCollabora: total ? ((votes.nonCollabora / total) * 100).toFixed(1) : '0.0',
  });
});

// ─── Reset ────────────────────────────────────────────────────────────────────
app.post('/api/reset', (_req, res) => {
  roundId++;                                  // invalida tutti i localStorage client
  votes  = { collabora: 0, nonCollabora: 0 };
  voters.clear();

  console.log(`[RESET] Votazione azzerata — nuovo round: ${roundId}`);
  res.json({ success: true, message: 'Votazione azzerata con successo.', roundId });
});

// ─── Health check (Render lo usa) ────────────────────────────────────────────
app.get('/health', (_req, res) => res.sendStatus(200));

app.listen(PORT, () => {
  console.log(`Server avviato su porta ${PORT}`);
});
