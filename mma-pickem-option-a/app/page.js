'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { EVENTS } from '../lib/events';

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function scoreSubmission(submission, results) {
  let score = 0;
  for (const [fightKey, winner] of Object.entries(results || {})) {
    if (submission.picks?.[fightKey] === winner) score += 1;
  }
  return score;
}

export default function HomePage() {
  const supabase = getSupabase();
  const [selectedEventId, setSelectedEventId] = useState(EVENTS[0].id);
  const [playerName, setPlayerName] = useState('');
  const [picks, setPicks] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const selectedEvent = useMemo(
    () => EVENTS.find((event) => event.id === selectedEventId) || EVENTS[0],
    [selectedEventId]
  );

  const locked = new Date() >= new Date(selectedEvent.date);

  async function loadEventData(eventId) {
    if (!supabase) {
      setLoading(false);
      setMessage('Add your Supabase URL and anon key to make shared picks work.');
      return;
    }

    setLoading(true);
    const [{ data: subs, error: subsError }, { data: res, error: resError }] = await Promise.all([
      supabase
        .from('submissions')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }),
      supabase
        .from('results')
        .select('*')
        .eq('event_id', eventId)
    ]);

    if (subsError || resError) {
      setMessage('Could not load picks yet. Check your Supabase setup.');
      setSubmissions([]);
      setResults({});
    } else {
      setSubmissions(subs || []);
      const nextResults = {};
      (res || []).forEach((row) => {
        nextResults[row.fight_key] = row.winner;
      });
      setResults(nextResults);
      setMessage('');
    }
    setLoading(false);
  }

  useEffect(() => {
    loadEventData(selectedEventId);
  }, [selectedEventId]);

  function chooseWinner(fightKey, fighter) {
    if (locked) return;
    setPicks((prev) => ({ ...prev, [fightKey]: fighter }));
  }

  async function submitPicks() {
    const cleanName = playerName.trim();
    if (!cleanName) {
      setMessage('Enter your name first.');
      return;
    }
    if (!supabase) {
      setMessage('Add Supabase keys first.');
      return;
    }
    const requiredKeys = selectedEvent.fights.map((_, index) => `fight_${index + 1}`);
    const complete = requiredKeys.every((key) => picks[key]);
    if (!complete) {
      setMessage('Pick a winner for every fight.');
      return;
    }

    const payload = {
      event_id: selectedEvent.id,
      player_name: cleanName,
      picks
    };

    const { error } = await supabase.from('submissions').upsert(payload, {
      onConflict: 'event_id,player_name'
    });

    if (error) {
      setMessage('Could not save picks.');
      return;
    }

    setMessage('Picks saved.');
    await loadEventData(selectedEvent.id);
  }

  async function saveResult(fightKey, winner) {
    if (!supabase) {
      setMessage('Add Supabase keys first.');
      return;
    }
    const { error } = await supabase.from('results').upsert({
      event_id: selectedEvent.id,
      fight_key: fightKey,
      winner
    }, {
      onConflict: 'event_id,fight_key'
    });

    if (error) {
      setMessage('Could not save result.');
      return;
    }

    setResults((prev) => ({ ...prev, [fightKey]: winner }));
    setMessage('Result saved.');
    await loadEventData(selectedEvent.id);
  }

  const leaderboard = useMemo(() => {
    return submissions
      .map((submission) => ({
        ...submission,
        score: scoreSubmission(submission, results)
      }))
      .sort((a, b) => b.score - a.score || new Date(a.created_at) - new Date(b.created_at));
  }, [submissions, results]);

  return (
    <main className="container grid" style={{ gap: 24 }}>
      <section className="hero">
        <div className="card">
          <div className="badge">MMA PICK'EM</div>
          <h1 style={{ fontSize: 38, marginBottom: 8 }}>Pick the winners. Beat your friends.</h1>
          <p className="subtle" style={{ fontSize: 18, lineHeight: 1.5 }}>
            Choose an upcoming UFC card, click the fighter you think wins, save your picks, and let the leaderboard tally who got the most right.
          </p>
        </div>
        <div className="card grid">
          <div>
            <div className="subtle">How it works</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>No login needed</div>
          </div>
          <div className="notice">Enter your name, make your picks, and share the site with friends after you deploy it.</div>
          {message ? <div className={message.includes('saved') ? 'notice success' : 'notice'}>{message}</div> : null}
        </div>
      </section>

      <section className="grid" style={{ gap: 12 }}>
        <h2 style={{ margin: 0 }}>Upcoming events</h2>
        <div className="event-grid">
          {EVENTS.map((event) => (
            <div
              key={event.id}
              className={`card event-card ${event.id === selectedEventId ? 'active' : ''}`}
              onClick={() => {
                setSelectedEventId(event.id);
                setPicks({});
              }}
            >
              <div className="subtle">{formatDate(event.date)}</div>
              <div style={{ fontSize: 22, fontWeight: 700, margin: '8px 0' }}>{event.title}</div>
              <div className="subtle">{event.venue}</div>
              <div style={{ marginTop: 12 }}>{event.fights.length} fights</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card grid">
          <div>
            <h2 style={{ margin: '0 0 6px' }}>{selectedEvent.title}</h2>
            <div className="subtle">{selectedEvent.venue} · {formatDate(selectedEvent.date)}</div>
            <div style={{ marginTop: 8 }} className={locked ? 'notice' : 'notice success'}>
              {locked ? 'Picks are locked for this card.' : 'Picks are open for this card.'}
            </div>
          </div>

          <div className="grid" style={{ gap: 12 }}>
            <input
              className="input"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
            {selectedEvent.fights.map((fight, index) => {
              const fightKey = `fight_${index + 1}`;
              return (
                <div className="fight-card" key={fightKey}>
                  <div className="subtle">Fight {index + 1}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{fight[0]} vs. {fight[1]}</div>
                  <div className="fighter-row">
                    {fight.map((fighter) => (
                      <button
                        key={fighter}
                        className={`fighter-btn ${picks[fightKey] === fighter ? 'selected' : ''}`}
                        onClick={() => chooseWinner(fightKey, fighter)}
                        disabled={locked}
                      >
                        {fighter}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <button className="button" onClick={submitPicks} disabled={locked}>Save my picks</button>
          </div>
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Leaderboard</h2>
            {loading ? <div className="subtle">Loading...</div> : leaderboard.length === 0 ? <div className="subtle">No picks saved yet.</div> : (
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => (
                    <tr key={`${entry.event_id}-${entry.player_name}`}>
                      <td>{index + 1}</td>
                      <td>{entry.player_name}</td>
                      <td>{entry.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card grid" style={{ gap: 12 }}>
            <h2 style={{ margin: 0 }}>Admin results</h2>
            <div className="subtle">After the fights, click the official winner for each matchup to tally the scores.</div>
            {selectedEvent.fights.map((fight, index) => {
              const fightKey = `fight_${index + 1}`;
              return (
                <div key={fightKey} className="fight-card">
                  <div style={{ fontWeight: 700 }}>{fight[0]} vs. {fight[1]}</div>
                  <div className="fighter-row">
                    {fight.map((fighter) => (
                      <button
                        key={fighter}
                        className={`fighter-btn ${results[fightKey] === fighter ? 'selected' : ''}`}
                        onClick={() => saveResult(fightKey, fighter)}
                      >
                        {fighter}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
