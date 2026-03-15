const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const RESET_PASSWORD = process.env.RESET_PASSWORD || 'admin2024';

// In-memory state — Node.js è single-threaded: nessuna race condition
let votes = { collabora: 0, nonCollabora: 0 };
let voters = new Set(); // Set di voterIds che hanno già votato

app.use(express.json({ limit: '1kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Votazione ────────────────────────────────────────────────────────────────
app.post('/api/vote', (req, res) => {
  const { voterId, choice } = req.body;

  if (
    typeof voterId !== 'string' ||
    voterId.length < 8 ||
    voterId.length > 64 ||
    !['collabora', 'nonCollabora'].includes(choice)
  ) {
    return res.status(400).json({ error: 'Richiesta non valida.' });
  }

  if (voters.has(voterId)) {
    return res.status(409).json({ error: 'Hai già votato.', alreadyVoted: true });
  }

  voters.add(voterId);
  votes[choice]++;

  console.log(`[VOTE] ${choice} — tot: ${voters.size}`);
  res.json({ success: true, choice });
});

// ─── Risultati (admin) ────────────────────────────────────────────────────────
app.get('/api/results', (req, res) => {
  const total = voters.size;
  res.json({
    collabora: votes.collabora,
    nonCollabora: votes.nonCollabora,
    total,
    pctCollabora: total ? ((votes.collabora / total) * 100).toFixed(1) : '0.0',
    pctNonCollabora: total ? ((votes.nonCollabora / total) * 100).toFixed(1) : '0.0',
  });
});

// ─── Reset (protetto da password) ────────────────────────────────────────────
app.post('/api/reset', (req, res) => {
  const { password } = req.body;
  if (password !== RESET_PASSWORD) {
    return res.status(401).json({ error: 'Password errata.' });
  }

  votes = { collabora: 0, nonCollabora: 0 };
  voters.clear();

  console.log('[RESET] Votazione azzerata.');
  res.json({ success: true, message: 'Votazione azzerata con successo.' });
});

// ─── Health check (Render lo usa) ────────────────────────────────────────────
app.get('/health', (_req, res) => res.sendStatus(200));

app.listen(PORT, () => {
  console.log(`Server avviato su porta ${PORT}`);
});
