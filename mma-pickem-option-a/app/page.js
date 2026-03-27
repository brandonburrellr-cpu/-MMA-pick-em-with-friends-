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

function getEventName(event) {
  return (
    event?.name ||
    event?.title ||
    event?.headline ||
    event?.mainEvent ||
    'Fight Card'
  );
}

function getEventLocation(event) {
  return (
    event?.location ||
    event?.venue ||
    event?.city ||
    event?.arena ||
    ''
  );
}

function getEventDate(event) {
  return event?.date || event?.datetime || event?.startsAt || event?.start_time || '';
}

function getFightKey(index, fight) {
  return (
    fight?.key ||
    fight?.id ||
    `fight_${index + 1}`
  );
}

function getFightLeft(fight) {
  return (
    fight?.red ||
    fight?.fighter1 ||
    fight?.fighterA ||
    fight?.left ||
    fight?.a ||
    fight?.home ||
    ''
  );
}

function getFightRight(fight) {
  return (
    fight?.blue ||
    fight?.fighter2 ||
    fight?.fighterB ||
    fight?.right ||
    fight?.b ||
    fight?.away ||
    ''
  );
}

function normalizeFights(event) {
  const fights = Array.isArray(event?.fights) ? event.fights : [];
  return fights.map((fight, index) => ({
    key: getFightKey(index, fight),
    left: getFightLeft(fight),
    right: getFightRight(fight),
  }));
}

function scoreSubmission(submission, results) {
  let score = 0;
  for (const [fightKey, winner] of Object.entries(results || {})) {
    if (submission?.picks?.[fightKey] === winner) score += 1;
  }
  return score;
}

export default function HomePage() {
  const supabase = getSupabase();

  const firstEventId = EVENTS?.[0]?.id || EVENTS?.[0]?.slug || 'event_1';

  const [selectedEventId, setSelectedEventId] = useState(firstEventId);
  const [playerName, setPlayerName] = useState('');
  const [picks, setPicks] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const selectedEvent = useMemo(() => {
    return (
      EVENTS.find((event) => (event.id || event.slug || 'event_1') === selectedEventId) ||
      EVENTS[0] ||
      {}
    );
  }, [selectedEventId]);

  const eventDate = getEventDate(selectedEvent);
  const eventName = getEventName(selectedEvent);
  const eventLocation = getEventLocation(selectedEvent);
  const fights = normalizeFights(selectedEvent);
  const locked = eventDate ? new Date() >= new Date(eventDate) : false;

  async function loadEventData(eventId) {
    if (!supabase) {
      setMessage('Add Supabase keys first.');
      return;
    }

    setLoading(true);
    setMessage('');

    const submissionsQuery = supabase
      .from('submissions')
      .select('*')
      .eq('event_id', eventId);

    const resultsQuery = supabase
      .from('results')
      .select('*')
      .eq('event_id', eventId);

    const [{ data: subs, error: subsError }, { data: res, error: resError }] =
      await Promise.all([submissionsQuery, resultsQuery]);

    if (subsError || resError) {
      setMessage('Could not load picks or results.');
      setSubmissions([]);
      setResults({});
      setLoading(false);
      return;
    }

    const nextResults = {};
    for (const row of res || []) {
      const key = row.fight_key || row.fightId || row.fight_id;
      if (key) nextResults[key] = row.winner;
    }

    setSubmissions(subs || []);
    setResults(nextResults);
    setLoading(false);
  }

  useEffect(() => {
    if (selectedEventId) {
      loadEventData(selectedEventId);
    }
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

    const complete = fights.every((fight) => picks[fight.key]);
    if (!complete) {
      setMessage('Pick a winner for every fight.');
      return;
    }

    const payload = {
      event_id: selectedEventId,
      player_name: cleanName,
      picks,
    };

    const { error } = await supabase.from('submissions').upsert(payload, {
      onConflict: 'event_id,player_name',
    });

    if (error) {
      setMessage('Could not save picks.');
      return;
    }

    setMessage('Picks saved.');
    await loadEventData(selectedEventId);
  }

  async function saveResult(fightKey, winner) {
    if (!supabase) {
      setMessage('Add Supabase keys first.');
      return;
    }

    const { error } = await supabase.from('results').upsert(
      {
        event_id: selectedEventId,
        fight_key: fightKey,
        winner,
      },
      { onConflict: 'event_id,fight_key' }
    );

    if (error) {
      setMessage('Could not save result.');
      return;
    }

    setMessage('Result saved.');
    await loadEventData(selectedEventId);
  }

  const leaderboard = useMemo(() => {
    return [...submissions]
      .map((submission) => ({
        ...submission,
        score: scoreSubmission(submission, results),
      }))
      .sort((a, b) => b.score - a.score);
  }, [submissions, results]);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#050816',
        color: '#fff',
        padding: '32px 20px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.1fr',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <section
            style={{
              background: '#0f1328',
              border: '1px solid #1d2242',
              borderRadius: 20,
              padding: 24,
            }}
          >
            <div
              style={{
                display: 'inline-block',
                background: '#e11d48',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 10px',
                borderRadius: 999,
                marginBottom: 16,
              }}
            >
              MMA PICK&apos;EM
            </div>

            <h1 style={{ fontSize: 28, lineHeight: 1.15, margin: 0, marginBottom: 14 }}>
              Pick the winners. Beat your friends.
            </h1>

            <p style={{ color: '#b7bfdc', margin: 0, maxWidth: 650 }}>
              Choose an upcoming UFC card, click the fighter you think wins, save your picks,
              and let the leaderboard tally who got the most right.
            </p>
          </section>

          <section
            style={{
              background: '#0f1328',
              border: '1px solid #1d2242',
              borderRadius: 20,
              padding: 24,
            }}
          >
            <div style={{ fontSize: 14, color: '#b7bfdc', marginBottom: 4 }}>How it works</div>
            <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 16 }}>No login needed</h2>

            <div
              style={{
                background: '#2b1f08',
                border: '1px solid #5a4314',
                color: '#f5d58b',
                padding: 14,
                borderRadius: 12,
                marginBottom: 12,
              }}
            >
              Enter your name, make your picks, and share the site with friends after you deploy it.
            </div>

            {message && (
              <div
                style={{
                  background: message.toLowerCase().includes('saved')
                    ? '#0f3321'
                    : '#2b1f08',
                  border: message.toLowerCase().includes('saved')
                    ? '1px solid #1b6d45'
                    : '1px solid #5a4314',
                  color: message.toLowerCase().includes('saved') ? '#9be3bc' : '#f5d58b',
                  padding: 14,
                  borderRadius: 12,
                }}
              >
                {message}
              </div>
            )}
          </section>
        </div>

        <h2 style={{ marginBottom: 12 }}>Upcoming events</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 14,
            marginBottom: 18,
          }}
        >
          {EVENTS.map((event, index) => {
            const eventId = event.id || event.slug || `event_${index + 1}`;
            const active = eventId === selectedEventId;
            const eventFights = normalizeFights(event);

            return (
              <button
                key={eventId}
                onClick={() => setSelectedEventId(eventId)}
                style={{
                  textAlign: 'left',
                  background: '#10152b',
                  border: active ? '1px solid #c81e4b' : '1px solid #1d2242',
                  borderRadius: 18,
                  padding: 16,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: '#b7bfdc', fontSize: 13, marginBottom: 10 }}>
                  {formatDate(getEventDate(event))}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.15, marginBottom: 8 }}>
                  {getEventName(event)}
                </div>
                <div style={{ color: '#b7bfdc', fontSize: 14, marginBottom: 10 }}>
                  {getEventLocation(event)}
                </div>
                <div style={{ fontSize: 14 }}>{eventFights.length} fights</div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.25fr 1fr',
            gap: 18,
            alignItems: 'start',
          }}
        >
          <section
            style={{
              background: '#0f1328',
              border: '1px solid #1d2242',
              borderRadius: 20,
              padding: 18,
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>{eventName}</h2>
            <div style={{ color: '#b7bfdc', marginBottom: 12 }}>
              {[eventLocation, formatDate(eventDate)].filter(Boolean).join(' · ')}
            </div>

            <div
              style={{
                background: locked ? '#3a230d' : '#0f3321',
                color: locked ? '#f3c281' : '#9be3bc',
                border: locked ? '1px solid #714114' : '1px solid #1b6d45',
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
              }}
            >
              {locked ? 'Picks are locked for this card.' : 'Picks are open for this card.'}
            </div>

            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              style={{
                width: '100%',
                background: '#090d1c',
                color: '#fff',
                border: '1px solid #1d2242',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 14,
                outline: 'none',
              }}
            />

            {fights.map((fight, index) => {
              const selectedWinner = picks[fight.key];
              return (
                <div
                  key={fight.key}
                  style={{
                    background: '#0b1022',
                    border: '1px solid #1d2242',
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ color: '#b7bfdc', marginBottom: 6 }}>Fight {index + 1}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                    {fight.left} vs. {fight.right}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[fight.left, fight.right].map((fighter) => (
                      <button
                        key={fighter}
                        onClick={() => chooseWinner(fight.key, fighter)}
                        disabled={locked}
                        style={{
                          background: selectedWinner === fighter ? '#89142e' : '#151a32',
                          color: '#fff',
                          border:
                            selectedWinner === fighter
                              ? '1px solid #e11d48'
                              : '1px solid #2a3158',
                          borderRadius: 12,
                          padding: '12px 10px',
                          fontWeight: 700,
                          cursor: locked ? 'not-allowed' : 'pointer',
                          opacity: locked ? 0.7 : 1,
                        }}
                      >
                        {fighter}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            <button
              onClick={submitPicks}
              disabled={locked || loading}
              style={{
                width: '100%',
                background: locked ? '#3a3f5e' : '#e11d48',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '14px 16px',
                fontWeight: 800,
                cursor: locked || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Loading...' : 'Save my picks'}
            </button>
          </section>

          <div style={{ display: 'grid', gap: 18 }}>
            <section
              style={{
                background: '#0f1328',
                border: '1px solid #1d2242',
                borderRadius: 20,
                padding: 18,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Leaderboard</h2>

              {leaderboard.length === 0 ? (
                <div style={{ color: '#b7bfdc' }}>No picks saved yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {leaderboard.map((entry, index) => (
                    <div
                      key={`${entry.event_id}-${entry.player_name}`}
                      style={{
                        background: '#0b1022',
                        border: '1px solid #1d2242',
                        borderRadius: 14,
                        padding: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        #{index + 1} {entry.player_name}
                      </div>
                      <div style={{ color: '#f5d58b', fontWeight: 800 }}>{entry.score} pts</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section
              style={{
                background: '#0f1328',
                border: '1px solid #1d2242',
                borderRadius: 20,
                padding: 18,
              }}
            >
              <h2 style={{ marginTop: 0 }}>Admin results</h2>
              <p style={{ color: '#b7bfdc', marginTop: 0 }}>
                After the fights, click the official winner for each matchup to tally the scores.
              </p>

              {fights.map((fight) => {
                const selectedResult = results[fight.key];
                return (
                  <div
                    key={fight.key}
                    style={{
                      background: '#0b1022',
                      border: '1px solid #1d2242',
                      borderRadius: 16,
                      padding: 14,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                      {fight.left} vs. {fight.right}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[fight.left, fight.right].map((fighter) => (
                        <button
                          key={fighter}
                          onClick={() => saveResult(fight.key, fighter)}
                          style={{
                            background: selectedResult === fighter ? '#89142e' : '#151a32',
                            color: '#fff',
                            border:
                              selectedResult === fighter
                                ? '1px solid #e11d48'
                                : '1px solid #2a3158',
                            borderRadius: 12,
                            padding: '12px 10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {fighter}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
