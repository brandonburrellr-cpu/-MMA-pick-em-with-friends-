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

function formatPacificDate(value) {
  if (!value) return 'Date TBD';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

function getEventId(event, index) {
  return event?.id || `event_${index + 1}`;
}

function normalizeName(value = '') {
  return value.trim().toLowerCase();
}

function normalizeFights(event) {
  const fights = Array.isArray(event?.fights) ? event.fights : [];
  return fights.map((fight, index) => ({
    key: fight?.id || `fight_${index + 1}`,
    left: fight?.red || '',
    right: fight?.blue || '',
    leftEspn: fight?.redEspn || '#',
    rightEspn: fight?.blueEspn || '#',
    card: fight?.card || 'main',
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

  if (lower.includes('saved') || lower.includes('cleared')) {
    return {
      background: 'rgba(16, 185, 129, 0.18)',
      border: '1px solid rgba(52, 211, 153, 0.5)',
      color: '#d1fae5',
    };
  }

  if (lower.includes('locked')) {
    return {
      background: 'rgba(245, 158, 11, 0.18)',
      border: '1px solid rgba(251, 191, 36, 0.45)',
      color: '#fde68a',
    };
  }

  return {
    background: 'rgba(239, 68, 68, 0.16)',
    border: '1px solid rgba(248, 113, 113, 0.4)',
    color: '#fecaca',
  };
}

function getPacificLockTime(eventDateValue) {
  if (!eventDateValue) return null;
  const base = new Date(eventDateValue);
  if (Number.isNaN(base.getTime())) return null;

  const pacificDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base);

  const year = pacificDateParts.find((p) => p.type === 'year')?.value;
  const month = pacificDateParts.find((p) => p.type === 'month')?.value;
  const day = pacificDateParts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) return null;

  const standardGuess = new Date(`${year}-${month}-${day}T15:00:00-08:00`);
  const daylightGuess = new Date(`${year}-${month}-${day}T15:00:00-07:00`);

  const standardParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(standardGuess);

  const standardHour = standardParts.find((p) => p.type === 'hour')?.value;
  const standardMinute = standardParts.find((p) => p.type === 'minute')?.value;

  if (standardHour === '15' && standardMinute === '00') {
    return standardGuess;
  }

  return daylightGuess;
}

function FighterCard({ name, espnUrl, active, disabled, onPick }) {
  const canOpen = espnUrl && espnUrl !== '#';

  function openEspn() {
    if (!canOpen) return;
    window.open(espnUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      style={{
        background: active
          ? 'linear-gradient(135deg, rgba(236,72,153,0.35), rgba(168,85,247,0.28))'
          : 'linear-gradient(135deg, rgba(30,41,59,0.88), rgba(17,24,39,0.88))',
        border: active
          ? '1px solid rgba(244,114,182,0.8)'
          : '1px solid rgba(99,102,241,0.25)',
        borderRadius: 18,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: disabled ? 0.75 : 1,
      }}
    >
      <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontWeight: 900, fontSize: 17, lineHeight: 1.2, marginBottom: 10 }}>
          {name}
        </div>

        <button
          type="button"
          onClick={openEspn}
          disabled={!canOpen}
          style={{
            display: 'inline-block',
            fontSize: 12,
            fontWeight: 800,
            color: canOpen ? '#bfdbfe' : '#94a3b8',
            background: canOpen ? 'rgba(59,130,246,0.14)' : 'rgba(71,85,105,0.2)',
            border: canOpen
              ? '1px solid rgba(96,165,250,0.25)'
              : '1px solid rgba(100,116,139,0.2)',
            padding: '8px 12px',
            borderRadius: 999,
            cursor: canOpen ? 'pointer' : 'not-allowed',
          }}
        >
          {canOpen ? 'Open ESPN Profile →' : 'No ESPN Profile'}
        </button>
      </div>

      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        style={{
          width: '100%',
          background: 'transparent',
          color: '#fff',
          border: 'none',
          padding: '14px 12px',
          fontWeight: 900,
          fontSize: 14,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        Pick {name}
      </button>
    </div>
  );
}

function FightSection({ title, fights, picks, results, locked, chooseWinner }) {
  if (!fights.length) return null;

  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          display: 'inline-block',
          marginBottom: 14,
          padding: '7px 12px',
          borderRadius: 999,
          background:
            title === 'Main Card'
              ? 'linear-gradient(90deg, #f43f5e, #ec4899)'
              : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          color: '#fff',
          fontWeight: 900,
          fontSize: 12,
          letterSpacing: 0.4,
        }}
      >
        {title}
      </div>

      {fights.map((fight, index) => {
        const selectedWinner = picks[fight.key];
        const officialWinner = results[fight.key];

        return (
          <div
            key={fight.key}
            style={{
              background: 'linear-gradient(135deg, rgba(15,23,42,0.86), rgba(17,24,39,0.86))',
              border: '1px solid rgba(99,102,241,0.15)',
              borderRadius: 18,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <div style={{ color: '#c4b5fd', marginBottom: 6, fontWeight: 700 }}>
              {title} Fight {index + 1}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>
              {fight.left} vs. {fight.right}
            </div>

            {officialWinner && (
              <div
                style={{
                  marginBottom: 12,
                  background:
                    officialWinner === 'Draw'
                      ? 'rgba(245, 158, 11, 0.14)'
                      : 'rgba(34,197,94,0.14)',
                  border:
                    officialWinner === 'Draw'
                      ? '1px solid rgba(251,191,36,0.3)'
                      : '1px solid rgba(74,222,128,0.3)',
                  color: officialWinner === 'Draw' ? '#fde68a' : '#bbf7d0',
                  padding: '10px 12px',
                  borderRadius: 12,
                  fontWeight: 800,
                }}
              >
                Official result: {officialWinner}
              </div>
            )}

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
    </div>
  );
}

function PicksReveal({ entry, fights, results }) {
  return (
    <div
      style={{
        marginTop: 12,
        display: 'grid',
        gap: 8,
        borderTop: '1px solid rgba(99,102,241,0.12)',
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
              background: 'rgba(17,24,39,0.74)',
              border: '1px solid rgba(99,102,241,0.12)',
              borderRadius: 12,
              padding: 10,
            }}
          >
            <div style={{ color: '#c4b5fd', fontSize: 12, marginBottom: 4 }}>
              {fight.card === 'main' ? 'Main Card' : 'Prelim'} · Fight {fightIndex + 1}
            </div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              {fight.left} vs. {fight.right}
            </div>
            <div style={{ fontSize: 14 }}>
              Pick: <span style={{ fontWeight: 900 }}>{pick || 'No pick'}</span>
            </div>
            {result && (
              <div
                style={{
                  fontSize: 13,
                  marginTop: 6,
                  color:
                    result === 'Draw'
                      ? '#fde68a'
                      : correct
                      ? '#86efac'
                      : '#fca5a5',
                  fontWeight: 700,
                }}
              >
                {result === 'Draw'
                  ? 'Official result: Draw'
                  : `${correct ? 'Correct' : 'Wrong'} · Result: ${result}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const supabase = getSupabase();

  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(EVENTS?.[0]?.id || 'event_1');
  const [playerName, setPlayerName] = useState('');
  const [picks, setPicks] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [results, setResults] = useState({});
  const [message, setMessage] = useState('');
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsAdmin(params.get('admin') === 'true');
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const selectedEvent = useMemo(() => {
    return (
      EVENTS.find((event, index) => getEventId(event, index) === selectedEventId) ||
      EVENTS[0] ||
      {}
    );
  }, [selectedEventId]);

  const fights = normalizeFights(selectedEvent);
  const mainCardFights = fights.filter((fight) => fight.card === 'main');
  const prelimFights = fights.filter((fight) => fight.card !== 'main');

  const lockTime = getPacificLockTime(selectedEvent?.date);
  const locked = lockTime ? nowMs >= lockTime.getTime() : false;

  const mySavedEntry = useMemo(() => {
    const clean = normalizeName(playerName);
    if (!clean) return null;
    return submissions.find((entry) => normalizeName(entry.player_name) === clean) || null;
  }, [playerName, submissions]);

  async function loadData() {
    if (!supabase) return;

    const { data: subs, error: subsError } = await supabase
      .from('submissions')
      .select('*')
      .eq('event_id', selectedEventId);

    const { data: res, error: resError } = await supabase
      .from('results')
      .select('*')
      .eq('event_id', selectedEventId);

    if (subsError || resError) {
      setMessage('Could not load data.');
      return;
    }

    const nextResults = {};
    (res || []).forEach((row) => {
      nextResults[row.fight_key] = row.winner;
    });

    setSubmissions(subs || []);
    setResults(nextResults);
  }

  useEffect(() => {
    loadData();
    setExpandedPlayer(null);
  }, [selectedEventId]);

  useEffect(() => {
    if (!supabase || !selectedEventId) return;

    const submissionsChannel = supabase
      .channel(`submissions-${selectedEventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          filter: `event_id=eq.${selectedEventId}`,
        },
        () => loadData()
      )
      .subscribe();

    const resultsChannel = supabase
      .channel(`results-${selectedEventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'results',
          filter: `event_id=eq.${selectedEventId}`,
        },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(submissionsChannel);
      supabase.removeChannel(resultsChannel);
    };
  }, [supabase, selectedEventId]);

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
      setMessage('Picks lock at 3:00 PM Pacific for this card.');
      return;
    }

    if (!supabase) {
      setMessage('Supabase client not available.');
      return;
    }

    const complete = fights.every((fight) => fight.left && fight.right && picks[fight.key]);
    if (!complete) {
      setMessage('Pick a winner for every fight.');
      return;
    }

    const { error } = await supabase.from('submissions').upsert(
      {
        event_id: selectedEventId,
        player_name: cleanName,
        picks,
      },
      { onConflict: 'event_id,player_name' }
    );

    if (error) {
      setMessage(`Could not save picks: ${error.message}`);
      return;
    }

    setMessage('Picks saved.');
    loadData();
  }

  async function saveResult(fightKey, winner) {
    if (!supabase) {
      setMessage('Supabase client not available.');
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
      setMessage(`Could not save result: ${error.message}`);
      return;
    }

    setMessage('Result saved.');
    loadData();
  }

  async function clearResult(fightKey) {
    if (!supabase) {
      setMessage('Supabase client not available.');
      return;
    }

    const { error } = await supabase
      .from('results')
      .delete()
      .eq('event_id', selectedEventId)
      .eq('fight_key', fightKey);

    if (error) {
      setMessage(`Could not clear result: ${error.message}`);
      return;
    }

    setMessage('Result cleared.');
    loadData();
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
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        backgroundImage:
          "linear-gradient(rgba(2,6,23,0.82), rgba(3,7,18,0.9)), url('/background.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div style={{ minHeight: '100vh', backdropFilter: 'blur(2px)', padding: '32px 20px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.1fr',
              gap: 18,
              marginBottom: 28,
            }}
          >
            <section
              style={{
                background: 'linear-gradient(135deg, rgba(30,41,59,0.7), rgba(17,24,39,0.72))',
                border: '1px solid rgba(99,102,241,0.22)',
                borderRadius: 26,
                padding: 28,
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(90deg, #f43f5e, #ec4899)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 900,
                  padding: '7px 12px',
                  borderRadius: 999,
                  marginBottom: 16,
                }}
              >
                MMA PICK&apos;EM
              </div>
              <h1
                style={{
                  fontSize: 30,
                  lineHeight: 1.08,
                  margin: 0,
                  marginBottom: 14,
                  fontWeight: 900,
                }}
              >
                Pick the winners. Beat your friends.
              </h1>
              <p style={{ color: '#dbeafe', margin: 0, maxWidth: 700, fontSize: 16 }}>
                After 3 PM Pacific, every saved entry gets a View Picks button so nobody has to guess where to click.
              </p>
            </section>

            <section
              style={{
                background: 'linear-gradient(135deg, rgba(30,41,59,0.72), rgba(17,24,39,0.74))',
                border: '1px solid rgba(168,85,247,0.25)',
                borderRadius: 26,
                padding: 24,
              }}
            >
              <div style={{ fontSize: 14, color: '#c4b5fd', marginBottom: 4 }}>How it works</div>
              <h2 style={{ fontSize: 22, marginTop: 0, marginBottom: 16, fontWeight: 900 }}>
                View picks after lock
              </h2>

              <div
                style={{
                  background: 'rgba(251,146,60,0.14)',
                  border: '1px solid rgba(251,146,60,0.3)',
                  color: '#fdba74',
                  padding: 14,
                  borderRadius: 14,
                  marginBottom: 12,
                  fontWeight: 700,
                }}
              >
                Once the card locks, use the View Picks button under any saved name.
              </div>

              {locked && mySavedEntry && (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedPlayer(`${mySavedEntry.event_id}-${mySavedEntry.player_name}`)
                  }
                  style={{
                    width: '100%',
                    marginBottom: 12,
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '12px 14px',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  View my picks
                </button>
              )}

              {message && (
                <div
                  style={{
                    ...messageStyles(message),
                    padding: 14,
                    borderRadius: 14,
                    wordBreak: 'break-word',
                    fontWeight: 700,
                  }}
                >
                  {message}
                </div>
              )}
            </section>
          </div>

          <h2 style={{ marginBottom: 14, fontSize: 18, fontWeight: 900 }}>Upcoming events</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 14,
              marginBottom: 20,
            }}
          >
            {EVENTS.map((event, index) => {
              const eventId = getEventId(event, index);
              const active = eventId === selectedEventId;
              const eventLockTime = getPacificLockTime(event?.date);

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
                    background: active
                      ? 'linear-gradient(135deg, rgba(236,72,153,0.28), rgba(99,102,241,0.22))'
                      : 'linear-gradient(135deg, rgba(30,41,59,0.74), rgba(17,24,39,0.74))',
                    border: active
                      ? '1px solid rgba(244,114,182,0.85)'
                      : '1px solid rgba(99,102,241,0.18)',
                    borderRadius: 20,
                    padding: 16,
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 10 }}>
                    {formatDate(event?.date)}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.15, marginBottom: 8 }}>
                    {event?.name || 'Fight Card'}
                  </div>
                  <div style={{ color: '#bfdbfe', fontSize: 14, marginBottom: 10 }}>
                    {event?.location || ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#fde68a', fontWeight: 800 }}>
                    Locks: {eventLockTime ? `${formatPacificDate(eventLockTime)} PT` : '3:00 PM PT'}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.35fr 1fr',
              gap: 18,
              alignItems: 'start',
            }}
          >
            <section
              style={{
                background: 'linear-gradient(135deg, rgba(15,23,42,0.75), rgba(17,24,39,0.72))',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 26,
                padding: 20,
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 22, fontWeight: 900 }}>
                {selectedEvent?.name || 'Fight Card'}
              </h2>
              <div style={{ color: '#bfdbfe', marginBottom: 8 }}>
                {[selectedEvent?.location, formatDate(selectedEvent?.date)].filter(Boolean).join(' · ')}
              </div>
              <div style={{ color: '#fde68a', marginBottom: 14, fontWeight: 800 }}>
                Locks at: {lockTime ? `${formatPacificDate(lockTime)} PT` : '3:00 PM PT'}
              </div>

              <div
                style={{
                  background: locked ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.16)',
                  color: locked ? '#fde68a' : '#bbf7d0',
                  border: locked ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(74,222,128,0.35)',
                  borderRadius: 14,
                  padding: 13,
                  marginBottom: 18,
                  fontWeight: 800,
                }}
              >
                {locked
                  ? 'Picks are locked. View Picks buttons are now available on the right.'
                  : 'Picks are open for this card.'}
              </div>

              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                style={{
                  width: '100%',
                  background: 'rgba(2,6,23,0.72)',
                  color: '#fff',
                  border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 12,
                  padding: '13px 14px',
                  marginBottom: 18,
                  outline: 'none',
                  fontSize: 15,
                }}
              />

              <FightSection
                title="Main Card"
                fights={mainCardFights}
                picks={picks}
                results={results}
                locked={locked}
                chooseWinner={chooseWinner}
              />

              <FightSection
                title="Prelims"
                fights={prelimFights}
                picks={picks}
                results={results}
                locked={locked}
                chooseWinner={chooseWinner}
              />

              <button
                onClick={submitPicks}
                disabled={locked}
                style={{
                  width: '100%',
                  background: locked
                    ? 'linear-gradient(90deg, #475569, #334155)'
                    : 'linear-gradient(90deg, #f43f5e, #ec4899, #8b5cf6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 14,
                  padding: '15px 16px',
                  fontWeight: 900,
                  fontSize: 15,
                  cursor: locked ? 'not-allowed' : 'pointer',
                }}
              >
                {locked ? 'Picks locked at 3 PM Pacific' : 'Save my picks'}
              </button>
            </section>

            <div style={{ display: 'grid', gap: 18 }}>
              <section
                style={{
                  background: 'linear-gradient(135deg, rgba(15,23,42,0.76), rgba(17,24,39,0.74))',
                  border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 26,
                  padding: 18,
                }}
              >
                <h2 style={{ marginTop: 0, fontSize: 22, fontWeight: 900 }}>Saved picks / Leaderboard</h2>

                {leaderboard.length === 0 ? (
                  <div style={{ color: '#cbd5e1' }}>No picks saved yet.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {leaderboard.map((entry, index) => {
                      const playerKey = `${entry.event_id}-${entry.player_name}`;
                      const isOpen = expandedPlayer === playerKey;

                      return (
                        <div
                          key={playerKey}
                          style={{
                            background: 'rgba(15,23,42,0.78)',
                            border: '1px solid rgba(99,102,241,0.14)',
                            borderRadius: 16,
                            padding: 12,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 12,
                            }}
                          >
                            <div style={{ fontWeight: 900 }}>
                              #{index + 1} {entry.player_name}
                            </div>
                            <div style={{ color: '#fde68a', fontWeight: 900 }}>
                              {entry.score} pts
                            </div>
                          </div>

                          <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 8 }}>
                            {locked
                              ? 'Use the button below to see picks'
                              : 'Picks become visible at 3:00 PM Pacific'}
                          </div>

                          {locked && (
                            <button
                              type="button"
                              onClick={() => setExpandedPlayer(isOpen ? null : playerKey)}
                              style={{
                                marginTop: 10,
                                background: isOpen
                                  ? 'rgba(71,85,105,0.9)'
                                  : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 10,
                                padding: '10px 12px',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              {isOpen ? `Hide ${entry.player_name}'s picks` : `View ${entry.player_name}'s picks`}
                            </button>
                          )}

                          {locked && isOpen && (
                            <PicksReveal entry={entry} fights={fights} results={results} />
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
                    background: 'linear-gradient(135deg, rgba(15,23,42,0.76), rgba(17,24,39,0.74))',
                    border: '1px solid rgba(168,85,247,0.22)',
                    borderRadius: 26,
                    padding: 18,
                  }}
                >
                  <h2 style={{ marginTop: 0, fontSize: 22, fontWeight: 900 }}>Admin results</h2>
                  <p style={{ color: '#cbd5e1', marginTop: 0 }}>
                    After the fights, click the official result for each matchup. Use Clear Result if needed.
                  </p>

                  {[{ title: 'Main Card', fights: mainCardFights }, { title: 'Prelims', fights: prelimFights }].map((section) =>
                    section.fights.length ? (
                      <div key={section.title} style={{ marginBottom: 18 }}>
                        <div
                          style={{
                            display: 'inline-block',
                            marginBottom: 12,
                            padding: '7px 12px',
                            borderRadius: 999,
                            background:
                              section.title === 'Main Card'
                                ? 'linear-gradient(90deg, #f43f5e, #ec4899)'
                                : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: 12,
                            letterSpacing: 0.4,
                          }}
                        >
                          {section.title}
                        </div>

                        {section.fights.map((fight) => {
                          const selectedResult = results[fight.key];

                          return (
                            <div
                              key={fight.key}
                              style={{
                                background: 'rgba(15,23,42,0.78)',
                                border: '1px solid rgba(99,102,241,0.14)',
                                borderRadius: 16,
                                padding: 14,
                                marginBottom: 12,
                              }}
                            >
                              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>
                                {fight.left} vs. {fight.right}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                                {[fight.left, fight.right, 'Draw'].map((resultOption, resultIndex) => (
                                  <button
                                    key={`${fight.key}-result-${resultIndex}`}
                                    onClick={() => saveResult(fight.key, resultOption)}
                                    style={{
                                      background:
                                        selectedResult === resultOption
                                          ? resultOption === 'Draw'
                                            ? 'linear-gradient(90deg, #f59e0b, #eab308)'
                                            : 'linear-gradient(90deg, #f43f5e, #ec4899)'
                                          : 'rgba(30,41,59,0.8)',
                                      color: '#fff',
                                      border:
                                        selectedResult === resultOption
                                          ? resultOption === 'Draw'
                                            ? '1px solid rgba(251,191,36,0.7)'
                                            : '1px solid rgba(244,114,182,0.7)'
                                          : '1px solid rgba(99,102,241,0.18)',
                                      borderRadius: 12,
                                      padding: '12px 10px',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {resultOption}
                                  </button>
                                ))}

                                <button
                                  onClick={() => clearResult(fight.key)}
                                  style={{
                                    background: 'rgba(71,85,105,0.9)',
                                    color: '#fff',
                                    border: '1px solid rgba(148,163,184,0.35)',
                                    borderRadius: 12,
                                    padding: '12px 10px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Clear Result
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
