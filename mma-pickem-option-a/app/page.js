'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { EVENTS } from '../lib/events';

function formatDate(value) {
  if (!value) return 'Date TBD';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getEventId(event, index) {
  return event?.id || `event_${index + 1}`;
}

function normalizeFights(event) {
  const fights = Array.isArray(event?.fights) ? event.fights : [];
  return fights.map((fight, index) => ({
    key: fight?.id || `fight_${index + 1}`,
    left: fight?.red || '',
    right: fight?.blue || '',
    leftEspn: fight?.redEspn || '#',
    rightEspn: fight?.blueEspn || '#',
  }));
}

function scoreSubmission(submission, results) {
  let score = 0;
  for (const [fightKey, winner] of Object.entries(results || {})) {
    if (submission?.picks?.[fightKey] === winner) score += 1;
  }
  return score;
}

function FighterCard({ name, espnUrl, active, disabled, onPick }) {
  return (
    <div
      style={{
        background: active ? '#89142e' : '#151a32',
        border: active ? '1px solid #e11d48' : '1px solid #2a3158',
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* CLICKABLE ESPN SECTION */}
      <a
        href={espnUrl && espnUrl !== '#' ? espnUrl : undefined}
        target="_blank"
        rel="noreferrer"
        style={{
          padding: 14,
          textDecoration: 'none',
          color: '#fff',
          display: 'block',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          cursor: espnUrl ? 'pointer' : 'default',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16 }}>
          {name}
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: '#b7bfdc',
          }}
        >
          View ESPN Profile →
        </div>
      </a>

      {/* PICK BUTTON */}
      <button
        onClick={onPick}
        disabled={disabled}
        style={{
          width: '100%',
          background: 'transparent',
          color: '#fff',
          border: 'none',
          padding: '12px 10px',
          fontWeight: 800,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        Pick {name}
      </button>
    </div>
  );
}

export default function HomePage() {
  const supabase = getSupabase();

  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(
    EVENTS?.[0]?.id || 'event_1'
  );
  const [playerName, setPlayerName] = useState('');
  const [picks, setPicks] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [results, setResults] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsAdmin(params.get('admin') === 'true');
  }, []);

  const selectedEvent = useMemo(() => {
    return (
      EVENTS.find((event, index) => getEventId(event, index) === selectedEventId) ||
      EVENTS[0] ||
      {}
    );
  }, [selectedEventId]);

  const fights = normalizeFights(selectedEvent);

  async function loadData() {
    if (!supabase) return;

    const { data: subs } = await supabase
      .from('submissions')
      .select('*')
      .eq('event_id', selectedEventId);

    const { data: res } = await supabase
      .from('results')
      .select('*')
      .eq('event_id', selectedEventId);

    const r = {};
    res?.forEach((row) => (r[row.fight_key] = row.winner));

    setSubmissions(subs || []);
    setResults(r);
  }

  useEffect(() => {
    loadData();
  }, [selectedEventId]);

  function chooseWinner(fightKey, fighter) {
    setPicks((prev) => ({ ...prev, [fightKey]: fighter }));
  }

  async function submitPicks() {
    if (!playerName) return setMessage('Enter your name');

    await supabase.from('submissions').upsert({
      event_id: selectedEventId,
      player_name: playerName,
      picks,
    });

    setMessage('Saved!');
    loadData();
  }

  async function saveResult(fightKey, winner) {
    await supabase.from('results').upsert({
      event_id: selectedEventId,
      fight_key: fightKey,
      winner,
    });

    loadData();
  }

  const leaderboard = [...submissions]
    .map((s) => ({
      ...s,
      score: scoreSubmission(s, results),
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <main style={{ padding: 30, color: 'white' }}>
      <h1>MMA Pick’Em</h1>

      <input
        placeholder="Your name"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        style={{ marginBottom: 20 }}
      />

      {fights.map((fight) => (
        <div key={fight.key} style={{ marginBottom: 20 }}>
          <h3>{fight.left} vs {fight.right}</h3>

          <div style={{ display: 'flex', gap: 10 }}>
            <FighterCard
              name={fight.left}
              espnUrl={fight.leftEspn}
              active={picks[fight.key] === fight.left}
              onPick={() => chooseWinner(fight.key, fight.left)}
            />
            <FighterCard
              name={fight.right}
              espnUrl={fight.rightEspn}
              active={picks[fight.key] === fight.right}
              onPick={() => chooseWinner(fight.key, fight.right)}
            />
          </div>
        </div>
      ))}

      <button onClick={submitPicks}>Save Picks</button>

      <h2>Leaderboard</h2>
      {leaderboard.map((p) => (
        <div key={p.player_name}>
          {p.player_name} — {p.score}
        </div>
      ))}

      {isAdmin && (
        <>
          <h2>Admin</h2>
          {fights.map((fight) => (
            <div key={fight.key}>
              {fight.left} vs {fight.right}
              <button onClick={() => saveResult(fight.key, fight.left)}>Left</button>
              <button onClick={() => saveResult(fight.key, fight.right)}>Right</button>
            </div>
          ))}
        </>
      )}

      <p>{message}</p>
    </main>
  );
}
