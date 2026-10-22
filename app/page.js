'use client';

import { useEffect, useState } from 'react';

// The starter data — the same "My Group" you see in the course slide. You'll replace
// this with a real database in Hour 5. For now it lives in the browser (localStorage).
const SEED = [
  { id: 'seed-1', emoji: '🍽️', name: 'Dinner', paidBy: 'Aisha', amount: 1800 },
  { id: 'seed-2', emoji: '🚕', name: 'Cab', paidBy: 'Raj', amount: 400 },
];

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function Home() {
  const [expenses, setExpenses] = useState(SEED);
  const [expenseName, setExpenseName] = useState('');
  const [amount, setAmount] = useState('');
  const [people, setPeople] = useState('');
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

  const addExpense = () => {
    const name = expenseName.trim();
    const value = Number(amount);
    const personCount = Number(people);
    if (!name || !amount.trim() || !people.trim() || !Number.isFinite(value) || value <= 0 || !Number.isInteger(personCount) || personCount < 1) return;
    setExpenses((list) => [...list, {
      id: 'e-' + Date.now(), emoji: '🧾', name, description: name,
      paidBy: 'You', amount: value, people: personCount, each: value / personCount,
    }]);
    setExpenseName('');
    setAmount('');
    setPeople('');
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
        <div style={styles.addRow}>
          <input
            style={styles.input}
            value={expenseName}
            onChange={(e) => setExpenseName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addExpense()}
            placeholder="Expense name"
            aria-label="Expense name"
          />
          <input
            style={styles.amountInput}
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addExpense()}
            placeholder="₹ Amount"
            aria-label="Expense amount in rupees"
          />
          <input
            style={styles.peopleInput}
            type="number"
            min="1"
            step="1"
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addExpense()}
            placeholder="People"
            aria-label="Number of people"
          />
          <button style={styles.addBtn} onClick={addExpense} aria-label="Add expense">+</button>
        </div>

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
                {e.people > 0 && <div style={styles.itemShare}>{e.people} people · {inr(e.each ?? e.amount / e.people)} each</div>}
              </div>
              <button style={styles.remove} onClick={() => removeExpense(e.id)} aria-label={`Remove ${e.name}`}>×</button>
            </div>
          ))}
        </div>

        {/* Total */}
        <div style={styles.total}>Total {inr(total)}</div>
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
  addRow: { display: 'flex', gap: 8, marginBottom: 16 },
  input: {
    flex: 1, border: '1px solid var(--line)', borderRadius: 14, padding: '13px 15px',
    fontSize: 15, outline: 'none', background: '#f7f9fc', color: 'var(--ink)',
  },
  amountInput: {
    width: 112, minWidth: 0, border: '1px solid var(--line)', borderRadius: 14, padding: '13px 10px',
    fontSize: 14, outline: 'none', background: '#f7f9fc', color: 'var(--ink)',
  },
  peopleInput: {
    width: 78, minWidth: 0, border: '1px solid var(--line)', borderRadius: 14, padding: '13px 8px',
    fontSize: 14, outline: 'none', background: '#f7f9fc', color: 'var(--ink)',
  },
  addBtn: {
    flex: 'none', width: 48, borderRadius: 14, border: 'none', color: '#fff', fontSize: 24, fontWeight: 700,
    background: 'linear-gradient(135deg, var(--blue), var(--cyan))',
    boxShadow: '0 10px 22px -8px rgba(28,95,212,.6)',
  },
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
  footnote: { color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', lineHeight: 1.6, marginTop: 20, maxWidth: 420 },
};
