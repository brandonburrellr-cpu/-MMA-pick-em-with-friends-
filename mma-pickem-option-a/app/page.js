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

function messageStyles(text) {
  const lower = String(text || '').toLowerCase();

  if (lower.includes('saved')) {
    return {
      background: '#0f3321',
      border: '1px solid #1b6d45',
      color: '#9be3bc',
    };
  }

  if (lower.includes('locked')) {
    return {
      background: '#3a230d',
      border: '1px solid #714114',
      color: '#f3c281',
    };
  }

  return {
    background: '#2b1f08',
    border: '1px solid #5a4314',
    color: '#f5d58b',
  };
}

function FighterCard({ name, espnUrl, active, disabled, onPick }) {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      if (!espnUrl || espnUrl === '#') {
        setImageUrl(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/espn-image?url=${encodeURIComponent(espnUrl)}`
        );
        const data = await response.json();

        if (!cancelled) {
          setImageUrl(data?.image || null);
        }
      } catch {
        if (!cancelled) {
          setImageUrl(null);
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [espnUrl]);

  return (
    <div
      style={{
        background: active ? '#89142e' : '#151a32',
        border: active ? '1px solid #e11d48' : '1px solid #2a3158',
        borderRadius: 14,
        overflow: 'hidden',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <a
        href={espnUrl && espnUrl !== '#' ? espnUrl : undefined}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 10,
          textDecoration: 'none',
          color: '#fff',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            overflow: 'hidden',
            flexShrink: 0,
            background: '#0b1022',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <span style={{ fontSize: 12, color: '#b7bfdc' }}>IMG</span>
          )}
        </div>

        <div style={{ fontWeight: 700, lineHeight: 1.15 }}>{name}</div>
      </a>

      <button
        onClick={onPick}
        disabled={disabled}
        style={{
          width: '100%',
          background: 'transparent',
          color: '#fff',
          border: 'none',
          padding: '12px 10px',
          fontWeight: 700,
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [expandedPlayer, setExpandedPlayer] = useState(null);

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
  const locked = selectedEvent?.date ? new Date() >= new Date(selectedEvent.date) : false;

  async function loadEventData(eventId) {
    if (!supabase) {
      setMessage('Supabase client not available. Check env vars.');
      setSubmissions([]);
      setResults({});
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const submissionsResponse = await supabase
        .from('submissions')
        .select('*')
        .eq('event_id', eventId);

      const resultsResponse = await supabase
        .from('results')
        .select('*')
        .eq('event_id', eventId);

      if (submissionsResponse.error || resultsResponse.error) {
        const details = [
          submissionsResponse.error?.message,
          resultsResponse.error?.message,
        ]
          .filter(Boolean)
          .join(' | ');

        setMessage(`Could not load picks or results: ${details || 'unknown error'}`);
        setSubmissions([]);
        setResults({});
        setLoading(false);
        return;
      }

      const nextResults = {};
      for (const row of resultsResponse.data || []) {
        nextResults[row.fight_key] = row.winner;
      }

      setSubmissions(submissionsResponse.data || []);
      setResults(nextResults);
      setLoading(false);
    } catch (error) {
      setMessage(`Could not load picks or results: ${error?.message || 'Failed to fetch'}`);
      setSubmissions([]);
      setResults({});
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedEventId) {
      loadEventData(selectedEventId);
      setExpandedPlayer(null);
    }
  }, [selectedEventId]);

  function chooseWinner(fightKey, fighter) {
    if (locked || !fighter) return;
    setPicks((prev) => ({ ...prev, [fightKey]: fighter }));
  }

  async function submitPicks() {
    const cleanName = playerName.trim();

    if (!cleanName) {
      setMessage('Enter your name first.');
      return;
    }

    if (locked) {
      setMessage('Picks are locked for this card.');
      return;
    }

    if (!supabase) {
      setMessage('Supabase client not available. Check env vars.');
      return;
    }

    const complete = fights.every((fight) => fight.left && fight.right && picks[fight.key]);
    if (!complete) {
      setMessage('Pick a winner for every fight.');
      return;
    }

    const payload = {
      event_id: selectedEventId,
      player_name: cleanName,
      picks,
    };

    try {
      const response = await supabase.from('submissions').upsert(payload, {
        onConflict: 'event_id,player_name',
      });

      if (response.error) {
        setMessage(`Could not save picks: ${response.error.message || 'unknown error'}`);
        return;
      }

      setMessage('Picks saved.');
      await loadEventData(selectedEventId);
    } catch (error) {
      setMessage(`Could not save picks: ${error?.message || 'Failed to fetch'}`);
    }
  }

  async function saveResult(fightKey, winner) {
    if (!supabase) {
      setMessage('Supabase client not available. Check env vars.');
      return;
    }

    try {
      const response = await supabase.from('results').upsert(
        {
          event_id: selectedEventId,
          fight_key: fightKey,
          winner,
        },
        { onConflict: 'event_id,fight_key' }
      );

      if (response.error) {
        setMessage(`Could not save result: ${response.error.message || 'unknown error'}`);
        return;
      }

      setMessage('Result saved.');
      await loadEventData(selectedEventId);
    } catch (error) {
      setMessage(`Could not save result: ${error?.message || 'Failed to fetch'}`);
    }
  }

  const leaderboard = useMemo(() => {
    return [...submissions]
      .map((submission) => ({
        ...submission,
        score: scoreSubmission(submission, results),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.player_name).localeCompare(String(b.player_name));
      });
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
              Fighter pictures load automatically from ESPN profile pages. Click a picture to open
              ESPN, then click the pick button to choose that fighter.
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
            <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 16 }}>No manual uploads</h2>

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
              Add ESPN fighter profile links in <code>lib/events.js</code>. The site handles the
              images for you.
            </div>

            {message && (
              <div
                style={{
                  ...messageStyles(message),
                  padding: 14,
                  borderRadius: 12,
                  wordBreak: 'break-word',
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
            const eventId = getEventId(event, index);
            const active = eventId === selectedEventId;

            return (
              <button
                key={eventId}
                onClick={() => {
                  setSelectedEventId(eventId);
                  setPicks({});
                  setMessage('');
                }}
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
                  {formatDate(event?.date)}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.15, marginBottom: 8 }}>
                  {event?.name || 'Fight Card'}
                </div>
                <div style={{ color: '#b7bfdc', fontSize: 14, marginBottom: 10 }}>
                  {event?.location || ''}
                </div>
                <div style={{ fontSize: 14 }}>{event?.fights?.length || 0} fights</div>
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
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>{selectedEvent?.name || 'Fight Card'}</h2>
            <div style={{ color: '#b7bfdc', marginBottom: 12 }}>
              {[selectedEvent?.location, formatDate(selectedEvent?.date)].filter(Boolean).join(' · ')}
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FighterCard
                      name={fight.left}
                      espnUrl={fight.leftEspn}
                      active={selectedWinner === fight.left}
                      disabled={locked}
                      onPick={() => chooseWinner(fight.key, fight.left)}
                    />
                    <FighterCard
                      name={fight.right}
                      espnUrl={fight.rightEspn}
                      active={selectedWinner === fight.right}
                      disabled={locked}
                      onPick={() => chooseWinner(fight.key, fight.right)}
                    />
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
              {locked ? 'Picks locked' : loading ? 'Loading...' : 'Save my picks'}
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
                  {leaderboard.map((entry, index) => {
                    const isOpen = expandedPlayer === `${entry.event_id}-${entry.player_name}`;
                    return (
                      <div
                        key={`${entry.event_id}-${entry.player_name}`}
                        style={{
                          background: '#0b1022',
                          border: '1px solid #1d2242',
                          borderRadius: 14,
                          padding: 12,
                        }}
                      >
                        <button
                          onClick={() =>
                            locked
                              ? setExpandedPlayer(
                                  isOpen ? null : `${entry.event_id}-${entry.player_name}`
                                )
                              : null
                          }
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 0,
                            cursor: locked ? 'pointer' : 'default',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>
                            #{index + 1} {entry.player_name}
                          </div>
                          <div style={{ color: '#f5d58b', fontWeight: 800 }}>
                            {entry.score} pts
                          </div>
                        </button>

                        {locked && (
                          <div style={{ color: '#b7bfdc', fontSize: 12, marginTop: 8 }}>
                            Click to {isOpen ? 'hide' : 'show'} picks
                          </div>
                        )}

                        {locked && isOpen && (
                          <div
                            style={{
                              marginTop: 12,
                              display: 'grid',
                              gap: 8,
                              borderTop: '1px solid #1d2242',
                              paddingTop: 12,
                            }}
                          >
                            {fights.map((fight, fightIndex) => {
                              const pick = entry?.picks?.[fight.key];
                              const result = results?.[fight.key];
                              const correct = result ? pick === result : null;

                              return (
                                <div
                                  key={`${entry.player_name}-${fight.key}`}
                                  style={{
                                    background: '#10152b',
                                    border: '1px solid #1d2242',
                                    borderRadius: 10,
                                    padding: 10,
                                  }}
                                >
                                  <div style={{ color: '#b7bfdc', fontSize: 12, marginBottom: 4 }}>
                                    Fight {fightIndex + 1}
                                  </div>
                                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                                    {fight.left} vs. {fight.right}
                                  </div>
                                  <div style={{ fontSize: 14 }}>
                                    Pick: <span style={{ fontWeight: 700 }}>{pick || 'No pick'}</span>
                                  </div>
                                  {result && (
                                    <div
                                      style={{
                                        fontSize: 13,
                                        marginTop: 6,
                                        color: correct ? '#9be3bc' : '#f5b0b0',
                                      }}
                                    >
                                      {correct ? 'Correct' : 'Wrong'} · Result: {result}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {isAdmin && (
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
                        {[fight.left, fight.right].map((fighter, fighterIndex) => (
                          <button
                            key={`${fight.key}-result-${fighterIndex}`}
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
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
