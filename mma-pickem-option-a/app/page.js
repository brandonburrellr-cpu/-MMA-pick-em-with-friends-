'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { EVENTS } from '../lib/events';

export default function HomePage() {
  const supabase = getSupabase();

  // ✅ ADMIN TOGGLE (URL BASED)
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsAdmin(params.get('admin') === 'true');
  }, []);

  function formatDate(value) {
    if (!value) return 'Date TBD';
    const d = new Date(value);
    return d.toLocaleString();
  }

  function getEventId(event, index) {
    return event?.id || `event_${index + 1}`;
  }

  function normalizeFights(event) {
    const fights = event?.fights || [];
    return fights.map((fight, index) => ({
      key: fight.id || `fight_${index + 1}`,
      left: fight.red,
      right: fight.blue,
      leftImage: fight.redImage,
      rightImage: fight.blueImage,
      leftEspn: fight.redEspn,
      rightEspn: fight.blueEspn,
    }));
  }

  function scoreSubmission(submission, results) {
    let score = 0;
    for (const [fightKey, winner] of Object.entries(results || {})) {
      if (submission?.picks?.[fightKey] === winner) score++;
    }
    return score;
  }

  const [selectedEventId, setSelectedEventId] = useState(
    EVENTS?.[0]?.id || 'event_1'
  );
  const [playerName, setPlayerName] = useState('');
  const [picks, setPicks] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [results, setResults] = useState({});
  const [message, setMessage] = useState('');

  const selectedEvent = useMemo(() => {
    return EVENTS.find((e) => e.id === selectedEventId) || EVENTS[0];
  }, [selectedEventId]);

  const fights = normalizeFights(selectedEvent);
  const locked = new Date() >= new Date(selectedEvent?.date);

  async function loadData() {
    if (!supabase) return;

    const subs = await supabase
      .from('submissions')
      .select('*')
      .eq('event_id', selectedEventId);

    const res = await supabase
      .from('results')
      .select('*')
      .eq('event_id', selectedEventId);

    if (subs.error || res.error) {
      setMessage('Error loading data');
      return;
    }

    const r = {};
    res.data.forEach((row) => {
      r[row.fight_key] = row.winner;
    });

    setSubmissions(subs.data);
    setResults(r);
  }

  useEffect(() => {
    loadData();
  }, [selectedEventId]);

  function chooseWinner(fightKey, fighter) {
    if (locked) return;
    setPicks((p) => ({ ...p, [fightKey]: fighter }));
  }

  async function submitPicks() {
    if (!playerName) return setMessage('Enter name');
    if (locked) return setMessage('Picks locked');

    const res = await supabase.from('submissions').upsert({
      event_id: selectedEventId,
      player_name: playerName,
      picks,
    });

    if (res.error) {
      setMessage(res.error.message);
      return;
    }

    setMessage('Picks saved!');
    loadData();
  }

  async function saveResult(fightKey, winner) {
    const res = await supabase.from('results').upsert({
      event_id: selectedEventId,
      fight_key: fightKey,
      winner,
    });

    if (res.error) {
      setMessage(res.error.message);
      return;
    }

    setMessage('Result saved');
    loadData();
  }

  const leaderboard = useMemo(() => {
    return [...submissions]
      .map((s) => ({
        ...s,
        score: scoreSubmission(s, results),
      }))
      .sort((a, b) => b.score - a.score);
  }, [submissions, results]);

  function Fighter({ f, fightKey, selected }) {
    return (
      <div style={{ display: 'grid', gap: 6 }}>
        <a href={f.espn} target="_blank">
          <Image src={f.image} width={80} height={80} alt={f.name} />
        </a>
        <button
          onClick={() => chooseWinner(fightKey, f.name)}
          style={{
            background: selected ? '#e11d48' : '#222',
            color: '#fff',
            padding: 8,
            borderRadius: 6,
          }}
        >
          {f.name}
        </button>
      </div>
    );
  }

  return (
    <main style={{ padding: 20, color: 'white', background: '#000' }}>
      <h1>MMA Pick'em</h1>

      <h2>Events</h2>
      {EVENTS.map((e) => (
        <button key={e.id} onClick={() => setSelectedEventId(e.id)}>
          {e.name}
        </button>
      ))}

      <h2>{selectedEvent.name}</h2>

      <input
        placeholder="Your name"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
      />

      {fights.map((fight) => (
        <div key={fight.key} style={{ marginBottom: 20 }}>
          <h3>
            {fight.left} vs {fight.right}
          </h3>

          <div style={{ display: 'flex', gap: 20 }}>
            <Fighter
              f={{
                name: fight.left,
                image: fight.leftImage,
                espn: fight.leftEspn,
              }}
              fightKey={fight.key}
              selected={picks[fight.key] === fight.left}
            />
            <Fighter
              f={{
                name: fight.right,
                image: fight.rightImage,
                espn: fight.rightEspn,
              }}
              fightKey={fight.key}
              selected={picks[fight.key] === fight.right}
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

      {/* ✅ ADMIN ONLY */}
      {isAdmin && (
        <>
          <h2>Admin Results</h2>
          {fights.map((fight) => (
            <div key={fight.key}>
              <button onClick={() => saveResult(fight.key, fight.left)}>
                {fight.left}
              </button>
              <button onClick={() => saveResult(fight.key, fight.right)}>
                {fight.right}
              </button>
            </div>
          ))}
        </>
      )}

      <p>{message}</p>
    </main>
  );
}
