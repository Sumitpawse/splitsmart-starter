'use client';

import { useEffect, useState } from 'react';

// The starter data — the same "My Group" you see in the course slide. You'll replace
// this with a real database in Hour 5. For now it lives in the browser (localStorage).
const SEED = [
  { id: 'seed-1', emoji: '🍽️', name: 'Dinner', paidBy: 'Aisha', amount: 1800 },
  { id: 'seed-2', emoji: '🚕', name: 'Cab', paidBy: 'Raj', amount: 400 },
];

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function parseExpenseSentence(sentence) {
  const text = sentence.trim();
  if (!text) return null;

  const friendMatch = text.match(/\bwith\s+(\d+)\s+friends?\b/i);
  const friendCount = friendMatch ? Number(friendMatch[1]) : null;
  const amounts = [...text.matchAll(/(?:₹\s*)?(\d[\d,]*(?:\.\d+)?)/g)];
  const amountMatch = amounts.find((match) => /(?:₹|\bfor|\bcost(?:s|ing)?)\s*$/i.test(text.slice(0, match.index)))
    || amounts.find((match) => match.index === text.search(/\d/))
    || amounts.find((match) => !friendMatch || match.index !== friendMatch.index + friendMatch[0].indexOf(friendMatch[1]));
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  let participantNames = ['You'];
  if (friendCount !== null) {
    participantNames = ['You', ...Array.from({ length: friendCount }, (_, index) => `Friend ${index + 1}`)];
  } else if (/\bjust\s+me\b/i.test(text)) {
  } else {
    const attendees = text.match(/^(.+?)\s+had\b/i);
    if (attendees) {
      participantNames = attendees[1].split(/,|\band\b/i).map((person) => {
        const name = person.trim();
        return /^me$/i.test(name) ? 'You' : name.charAt(0).toUpperCase() + name.slice(1);
      }).filter(Boolean);
    }
  }

  const description = text
    .replace(amountMatch[0], ' ')
    .replace(/\bjust\s+me\b/ig, ' ')
    .replace(/\b(?:split\s+)?with\s+\d+\s+friends?\b/ig, ' ')
    .replace(/^.+?\s+had\s+/i, '')
    .replace(/\b(?:split\s+(?:with|between|among)|between|among)\b.*$/i, ' ')
    .replace(/\b(?:for|costs?|costing)\b/ig, ' ')
    .replace(/[,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Expense';

  return {
    amount,
    participantNames,
    description: description.charAt(0).toUpperCase() + description.slice(1),
  };
}

export default function Home() {
  const [expenses, setExpenses] = useState(SEED);
  const [sentence, setSentence] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('You');
  const [participants, setParticipants] = useState([{ name: 'You', share: '' }, { name: 'Friend', share: '' }]);
  const [splitMode, setSplitMode] = useState('equal');
  const [ready, setReady] = useState(false);

  // Load any saved expenses from the browser on first render.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('splitsmart.expenses');
      if (saved) setExpenses(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, []);

  // Save whenever the list changes.
  useEffect(() => {
    if (ready) {
      try { localStorage.setItem('splitsmart.expenses', JSON.stringify(expenses)); } catch {}
    }
  }, [expenses, ready]);

  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const amountValue = Number(amount);
  const peopleValue = participants.length;
  const participantNames = participants.map((person) => person.name.trim());
  const customShares = participants.map((person) => Number(person.share));
  const customTotal = customShares.reduce((sum, share) => sum + share, 0);
  const sharesAreValid = splitMode === 'equal'
    || (participants.every((person) => person.share.trim() && Number.isFinite(Number(person.share)) && Number(person.share) >= 0)
      && Math.abs(customTotal - amountValue) < 0.005);
  const canAddExpense = description.trim() && paidBy.trim() && amount.trim()
    && Number.isFinite(amountValue) && amountValue > 0
    && peopleValue > 0 && participantNames.every(Boolean) && sharesAreValid;
  const totalPaise = Math.round(amountValue * 100);
  const baseSharePaise = peopleValue ? Math.floor(totalPaise / peopleValue) : 0;
  const extraPaise = peopleValue ? totalPaise % peopleValue : 0;
  const splits = splitMode === 'equal'
    ? participants.map((person, index) => ({ name: person.name.trim(), amount: (baseSharePaise + (index < extraPaise ? 1 : 0)) / 100 }))
    : participants.map((person, index) => ({ name: person.name.trim(), amount: customShares[index] || 0 }));
  const balances = expenses.reduce((totals, expense) => {
    if (!Array.isArray(expense.splits)) return totals;
    totals[expense.paidBy] = (totals[expense.paidBy] || 0) + Number(expense.amount || 0);
    expense.splits.forEach((split) => {
      totals[split.name] = (totals[split.name] || 0) - Number(split.amount || 0);
    });
    return totals;
  }, {});
  const nonzeroBalances = Object.entries(balances).filter(([, balance]) => Math.abs(balance) >= 0.01);

  const updateSentence = (value) => {
    setSentence(value);
    const parsed = parseExpenseSentence(value);
    if (parsed) {
      setDescription(parsed.description);
      setAmount(String(parsed.amount));
      setParticipants(parsed.participantNames.map((name) => ({ name, share: '' })));
    }
  };

  const addExpense = () => {
    if (!canAddExpense) return;
    setExpenses((list) => [...list, {
      id: 'e-' + Date.now(), emoji: '🧾', name: description.trim(),
      description: description.trim(), paidBy: paidBy.trim(),
      amount: amountValue, people: peopleValue,
      each: splitMode === 'equal' ? amountValue / peopleValue : null,
      splitMode, splits,
    }]);
    setSentence('');
    setDescription('');
    setAmount('');
    setPaidBy('You');
    setParticipants([{ name: 'You', share: '' }, { name: 'Friend', share: '' }]);
    setSplitMode('equal');
  };

  const removeExpense = (id) => setExpenses((list) => list.filter((e) => e.id !== id));

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.brand}>
            <div style={styles.logo}>S</div>
            <div style={styles.title}>Sumit Pawse</div>
          </div>
          <div style={styles.groupPill}>My Group</div>
        </div>

        {/* Add an expense */}
        <div style={styles.sectionTitle}>Add an expense</div>
        <div style={styles.examples}>Enter the details below, or use a sentence to fill them in quickly.</div>
        <div style={styles.addRow}>
          <input
            style={styles.input}
            value={sentence}
            onChange={(e) => updateSentence(e.target.value)}
            placeholder="e.g. dinner for 1200, split with 2 friends"
            aria-label="Quickly describe the expense and split"
          />
        </div>
        <div style={styles.formGrid}>
          <label style={styles.fieldLabel}>What was it for?
            <input style={styles.fieldInput} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Dinner" />
          </label>
          <label style={styles.fieldLabel}>Amount (₹)
            <input style={styles.fieldInput} type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1200" />
          </label>
          <label style={styles.fieldLabel}>Who paid?
            <input style={styles.fieldInput} value={paidBy} onChange={(e) => setPaidBy(e.target.value)} placeholder="Sumit" />
          </label>
          <div style={styles.fieldLabel}>Split type
            <div style={styles.modeToggle}>
              <button type="button" onClick={() => setSplitMode('equal')} style={splitMode === 'equal' ? styles.modeActive : styles.modeButton}>Equal</button>
              <button type="button" onClick={() => setSplitMode('custom')} style={splitMode === 'custom' ? styles.modeActive : styles.modeButton}>Custom</button>
            </div>
          </div>
        </div>
        <div style={styles.participantsHeader}>
          <span>People and their shares</span>
          <button type="button" style={styles.addPerson} onClick={() => setParticipants((list) => [...list, { name: '', share: '' }])}>+ Add person</button>
        </div>
        <div style={styles.participantList}>
          {participants.map((person, index) => (
            <div style={styles.participantRow} key={index}>
              <input style={styles.fieldInput} value={person.name} onChange={(e) => setParticipants((list) => list.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} placeholder={`Person ${index + 1}`} aria-label={`Person ${index + 1} name`} />
              <div style={styles.shareCell}>
                {splitMode === 'custom'
                  ? <input style={styles.fieldInput} type="number" min="0" step="0.01" value={person.share} onChange={(e) => setParticipants((list) => list.map((item, i) => i === index ? { ...item, share: e.target.value } : item))} placeholder="Share ₹" aria-label={`${person.name || `Person ${index + 1}`} share in rupees`} />
                  : <span style={styles.equalShare}>{amountValue > 0 && peopleValue ? inr(amountValue / peopleValue) : '—'} share</span>}
                {participants.length > 1 && <button type="button" style={styles.removePerson} onClick={() => setParticipants((list) => list.filter((_, i) => i !== index))} aria-label={`Remove person ${index + 1}`}>×</button>}
              </div>
            </div>
          ))}
        </div>
        <div style={canAddExpense ? styles.preview : styles.previewError} aria-live="polite">
          {canAddExpense
            ? splitMode === 'equal'
              ? `${inr(amountValue)} split among ${peopleValue} people · ${inr(amountValue / peopleValue)} each`
              : Math.abs(customTotal - amountValue) < 0.005
                ? `Custom shares add up to ${inr(customTotal)}`
                : `Custom shares total ${inr(customTotal)}; adjust them to match ${inr(amountValue)}.`
            : 'Enter the expense, payer, and at least one person.'}
        </div>
        <button style={styles.submitBtn} onClick={addExpense} aria-label="Add expense" disabled={!canAddExpense}>Add expense</button>

        {/* Expense list */}
        <div style={styles.list}>
          {expenses.length === 0 && (
            <div style={styles.empty}>No expenses yet — add your first one above.</div>
          )}
          {expenses.map((e) => (
            <div key={e.id} style={styles.item}>
              <div style={styles.itemEmoji}>{e.emoji}</div>
              <div style={styles.itemMain}>
                <div style={styles.itemName}>{e.name}</div>
                <div style={styles.itemPaid}>paid by {e.paidBy}</div>
              </div>
              <div style={styles.itemAmount}>
                <div>{inr(e.amount)}</div>
                {Array.isArray(e.splits)
                  ? <div style={styles.itemShare}>{e.splits.map((split) => `${split.name}: ${inr(split.amount)}`).join(' · ')}</div>
                  : e.people > 0 && <div style={styles.itemShare}>{e.people} people · {inr(e.each ?? e.amount / e.people)} each</div>}
              </div>
              <button style={styles.remove} onClick={() => removeExpense(e.id)} aria-label={`Remove ${e.name}`}>×</button>
            </div>
          ))}
        </div>

        {/* Total */}
        <div style={styles.total}>Total {inr(total)}</div>
        {nonzeroBalances.length > 0 && <div style={styles.balancePanel}>
          <div style={styles.sectionTitle}>Group balances</div>
          {nonzeroBalances.map(([name, balance]) => <div key={name} style={styles.balanceRow}>
            <span>{name}</span><span>{balance > 0 ? `gets back ${inr(balance)}` : `owes ${inr(Math.abs(balance))}`}</span>
          </div>)}
        </div>}
      </div>

      <p style={styles.footnote}>
        Sumit Pawse · Expense tracker
      </p>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '28px 16px 48px',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--card)',
    borderRadius: 24,
    boxShadow: '0 24px 60px -24px rgba(13,27,62,.28)',
    border: '1px solid var(--line)',
    padding: 20,
    marginTop: 12,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: {
    width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center',
    color: '#fff', fontWeight: 800, fontSize: 18,
    background: 'linear-gradient(135deg, var(--blue), var(--cyan))',
    boxShadow: '0 8px 18px -6px rgba(28,95,212,.55)',
  },
  title: { fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' },
  groupPill: {
    fontSize: 12.5, fontWeight: 800, color: 'var(--blue)',
    background: 'rgba(28,95,212,.1)', padding: '6px 12px', borderRadius: 999,
  },
  sectionTitle: { fontSize: 15, fontWeight: 800, marginBottom: 5 },
  addRow: { display: 'flex', gap: 8, marginBottom: 12 },
  input: {
    flex: 1, border: '1px solid var(--line)', borderRadius: 14, padding: '13px 15px',
    fontSize: 15, outline: 'none', background: '#f7f9fc', color: 'var(--ink)',
  },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 },
  fieldLabel: { display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--muted)', fontSize: 11.5, fontWeight: 700 },
  fieldInput: {
    width: '100%', minWidth: 0, boxSizing: 'border-box', border: '1px solid var(--line)', borderRadius: 12,
    padding: '11px 12px', fontSize: 14, outline: 'none', background: '#f7f9fc', color: 'var(--ink)',
  },
  modeToggle: { display: 'flex', gap: 5, padding: 3, borderRadius: 12, background: '#f0f3f9' },
  modeButton: { flex: 1, border: 0, borderRadius: 9, padding: '9px 5px', background: 'transparent', color: 'var(--muted)', fontSize: 12, fontWeight: 700 },
  modeActive: { flex: 1, border: 0, borderRadius: 9, padding: '9px 5px', background: '#fff', color: 'var(--blue)', fontSize: 12, fontWeight: 800, boxShadow: '0 1px 4px rgba(13,27,62,.12)' },
  participantsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 800, marginBottom: 7 },
  addPerson: { border: 0, background: 'transparent', color: 'var(--blue)', fontSize: 12, fontWeight: 700, padding: 4 },
  participantList: { display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 },
  participantRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' },
  shareCell: { display: 'flex', gap: 5, alignItems: 'center', minWidth: 0 },
  equalShare: { flex: 1, color: 'var(--muted)', fontSize: 12, padding: '10px 4px', textAlign: 'center' },
  removePerson: { flex: 'none', border: 0, background: 'transparent', color: 'var(--muted)', fontSize: 18, padding: '3px 5px' },
  submitBtn: {
    width: '100%', borderRadius: 14, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
    padding: '13px 16px',
    background: 'linear-gradient(135deg, var(--blue), var(--cyan))',
    boxShadow: '0 10px 22px -8px rgba(28,95,212,.6)',
  },
  examples: { color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.5, marginBottom: 8 },
  preview: { color: 'var(--blue)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 },
  previewError: { color: 'var(--muted)', fontSize: 11.5, marginBottom: 10 },
  list: { display: 'flex', flexDirection: 'column', gap: 10, minHeight: 60 },
  empty: { color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: '24px 0' },
  item: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#f7f9fc', border: '1px solid var(--line)', borderRadius: 16, padding: '12px 14px',
  },
  itemEmoji: {
    width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center',
    background: '#fff', border: '1px solid var(--line)', fontSize: 19, flex: 'none',
  },
  itemMain: { flex: 1, minWidth: 0 },
  itemName: { fontWeight: 700, fontSize: 15 },
  itemPaid: { color: 'var(--muted)', fontSize: 12.5, marginTop: 1 },
  itemAmount: { fontWeight: 800, fontSize: 15.5, fontVariantNumeric: 'tabular-nums' },
  itemShare: { color: 'var(--muted)', fontSize: 11, fontWeight: 500, marginTop: 3, whiteSpace: 'nowrap' },
  remove: {
    flex: 'none', width: 26, height: 26, borderRadius: 8, border: 'none',
    background: 'transparent', color: 'var(--muted)', fontSize: 20, lineHeight: 1,
  },
  total: {
    textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)',
    fontWeight: 800, fontSize: 16, color: 'var(--ink)',
  },
  balancePanel: { marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 },
  balanceRow: { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', color: 'var(--muted)', fontSize: 12.5 },
  footnote: { color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', lineHeight: 1.6, marginTop: 20, maxWidth: 420 },
};
