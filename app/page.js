'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient, hasSupabaseConfig } from './supabase';

// The starter data — the same "My Group" you see in the course slide. You'll replace
// this with a real database in Hour 5. For now it lives in the browser (localStorage).
const SEED = [
  { id: 'seed-1', emoji: '🍽️', name: 'Dinner', paidBy: 'Aisha', amount: 1800 },
  { id: 'seed-2', emoji: '🚕', name: 'Cab', paidBy: 'Raj', amount: 400 },
];

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function calculateBalances(expenses) {
  const paiseByPerson = new Map();
  expenses.forEach((expense) => {
    // Older saved entries lack participant shares, so their payer bears the cost.
    if (!Array.isArray(expense.splits) || !expense.paidBy) return;
    const amountPaise = Math.round(Number(expense.amount || 0) * 100);
    paiseByPerson.set(expense.paidBy, (paiseByPerson.get(expense.paidBy) || 0) + amountPaise);
    expense.splits.forEach((split) => {
      const sharePaise = Math.round(Number(split.amount || 0) * 100);
      paiseByPerson.set(split.name, (paiseByPerson.get(split.name) || 0) - sharePaise);
    });
  });
  return [...paiseByPerson.entries()].map(([name, paise]) => ({ name, paise })).filter(({ paise }) => paise !== 0);
}

function suggestSettlements(balanceEntries) {
  const debtors = balanceEntries.filter(({ paise }) => paise < 0).map(({ name, paise }) => ({ name, paise: -paise })).sort((a, b) => b.paise - a.paise);
  const creditors = balanceEntries.filter(({ paise }) => paise > 0).map(({ name, paise }) => ({ name, paise })).sort((a, b) => b.paise - a.paise);
  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amountPaise = Math.min(debtors[debtorIndex].paise, creditors[creditorIndex].paise);
    if (amountPaise > 0) {
      settlements.push({ from: debtors[debtorIndex].name, to: creditors[creditorIndex].name, paise: amountPaise });
      debtors[debtorIndex].paise -= amountPaise;
      creditors[creditorIndex].paise -= amountPaise;
    }
    if (debtors[debtorIndex].paise === 0) debtorIndex += 1;
    if (creditors[creditorIndex].paise === 0) creditorIndex += 1;
  }
  return settlements;
}

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
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!hasSupabaseConfig);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [authType, setAuthType] = useState('username');
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [dataMessage, setDataMessage] = useState('');
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [groupsReady, setGroupsReady] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [expenses, setExpenses] = useState(SEED);
  const [sentence, setSentence] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('You');
  const [participants, setParticipants] = useState([{ name: 'You', share: '' }, { name: 'Friend', share: '' }]);
  const [splitMode, setSplitMode] = useState('equal');
  const [ready, setReady] = useState(false);

  // Use Supabase auth when configured; otherwise keep browser-only storage.
  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) setAuthMessage(error.message);
        setUser(data?.session?.user || null);
        setAuthReady(true);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user || null);
        if (!session?.user) {
          setGroups([]);
          setActiveGroupId('');
          setGroupsReady(false);
          setExpenses([]);
        }
        if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
        setAuthReady(true);
      });
      return () => subscription.unsubscribe();
    }
    try {
      const saved = localStorage.getItem('splitsmart.expenses');
      if (saved) setExpenses(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;
    const loadGroups = async () => {
      setGroupsReady(false);
      setReady(false);
      const { data, error } = await supabase.from('groups').select('id,name,join_code,created_at').order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        setDataMessage(`Could not load groups: ${error.message}. Run supabase/schema_hour6.sql in Supabase SQL Editor first.`);
        setGroups([]); setActiveGroupId(''); setGroupsReady(true); setReady(true);
        return;
      }
      let available = data || [];
      if (available.length === 0) {
        const { error: createError } = await supabase.rpc('create_group', { group_name: 'My Group' });
        if (createError) {
          setDataMessage(`Could not create your first group: ${createError.message}`);
          setGroups([]); setActiveGroupId(''); setGroupsReady(true); setReady(true);
          return;
        }
        const { data: refreshed, error: refreshError } = await supabase.from('groups').select('id,name,join_code,created_at').order('created_at', { ascending: true });
        if (refreshError) {
          setDataMessage(`Could not load groups: ${refreshError.message}`);
          setGroups([]); setActiveGroupId(''); setGroupsReady(true); setReady(true);
          return;
        }
        available = refreshed || [];
      }
      if (cancelled) return;
      const savedId = localStorage.getItem('splitsmart.activeGroupId');
      const selected = available.find((group) => group.id === savedId) || available[0];
      setGroups(available);
      setActiveGroupId(selected?.id || '');
      setGroupsReady(true);
    };
    loadGroups();
    return () => { cancelled = true; };
  }, [supabase, user]);

  useEffect(() => {
    if (!supabase || !user || !groupsReady || !activeGroupId) return;
    let cancelled = false;
    const loadExpenses = async () => {
      setReady(false);
      setExpenses([]);
      setDataMessage('');
      const { data, error } = await supabase.from('expenses').select('*').eq('group_id', activeGroupId).order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        setDataMessage(`Could not load expenses: ${error.message}`);
      } else {
        let rows = data || [];
        if (rows.length === 0) {
          try {
            const saved = JSON.parse(localStorage.getItem('splitsmart.expenses') || '[]');
            if (Array.isArray(saved) && saved.length) {
              const importRows = saved.map((expense) => ({
                user_id: user.id,
                group_id: activeGroupId,
                name: expense.name || expense.description || 'Expense',
                description: expense.description || expense.name || 'Expense',
                emoji: expense.emoji || '🧾',
                paid_by: expense.paidBy || 'You',
                amount: Number(expense.amount || 0),
                people: Number(expense.people || expense.splits?.length || 1),
                each: expense.each ?? null,
                split_mode: expense.splitMode || 'equal',
                splits: Array.isArray(expense.splits) ? expense.splits : [],
              }));
              const { data: imported, error: importError } = await supabase.from('expenses').insert(importRows).select();
              if (importError) setDataMessage(`Could not import browser expenses: ${importError.message}`);
              else {
                rows = imported || [];
                localStorage.removeItem('splitsmart.expenses');
              }
            }
          } catch (importError) {
            setDataMessage(`Could not import browser expenses: ${importError.message}`);
          }
        }
        setExpenses(rows.map((row) => ({
          id: row.id, emoji: row.emoji || '🧾', name: row.name, description: row.description || row.name,
          paidBy: row.paid_by, amount: Number(row.amount), people: row.people,
          each: row.each === null ? null : Number(row.each), splitMode: row.split_mode || 'equal',
          splits: Array.isArray(row.splits) ? row.splits : [],
        })));
      }
      setReady(true);
    };
    loadExpenses();
    return () => { cancelled = true; };
  }, [supabase, user, groupsReady, activeGroupId]);

  // Save locally only when Supabase is not configured.
  useEffect(() => {
    if (ready && !supabase) {
      try { localStorage.setItem('splitsmart.expenses', JSON.stringify(expenses)); } catch {}
    }
  }, [expenses, ready, supabase]);

  const submitAuth = async (event) => {
    event.preventDefault();
    if (!supabase || !authEmail.trim() || !authPassword) return;
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const username = authEmail.trim().toLowerCase();
      if (authType === 'username' && !/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
        throw new Error('Use a username with 3–30 letters, numbers, dots, dashes, or underscores.');
      }
      const authIdentity = authType === 'username' ? `${username}@users.splitsmart.invalid` : authEmail.trim();
      const result = authMode === 'signup'
        ? await supabase.auth.signUp({ email: authIdentity, password: authPassword, options: authType === 'username' ? { data: { username } } : undefined })
        : await supabase.auth.signInWithPassword({ email: authIdentity, password: authPassword });
      if (result.error) {
        const message = result.error.message || 'Unknown authentication error.';
        setAuthMessage(message.toLowerCase().includes('email rate limit exceeded')
          ? 'Supabase has reached its email sending limit. In Supabase, open Authentication → Providers → Email and turn off Confirm Email, then try Create account again. Password sign-in itself does not send email.'
          : `Could not ${authMode === 'signup' ? 'create account' : 'sign in'}: ${message}`);
      } else if (authMode === 'signup' && result.data.user?.identities?.length === 0) {
        setAuthMessage(`An account already exists for this ${authType}. Switch to Sign in.`);
      } else if (authMode === 'signup' && !result.data.session) {
        setAuthMessage(authType === 'username'
          ? 'Supabase is still requiring email confirmation. Turn off Confirm Email in Supabase → Authentication → Sign In / Providers → Email, then create this username again.'
          : 'Account created. Supabase requires email confirmation before the first sign in.');
      } else {
        setAuthMessage(authMode === 'signup' ? 'Account created and signed in.' : 'Signed in.');
      }
    } catch (error) {
      const message = error.message || 'Check your internet connection and try again.';
      setAuthMessage(message.toLowerCase().includes('email rate limit exceeded')
        ? 'Supabase has reached its email sending limit. In Supabase, open Authentication → Providers → Email and turn off Confirm Email, then try Create account again. Password sign-in itself does not send email.'
        : `Could not ${authMode === 'signup' ? 'create account' : 'sign in'}: ${message}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const requestPasswordReset = async () => {
    if (authType === 'username') {
      setAuthMessage('Username accounts do not use email. To recover an account, switch to email login before requesting a reset.');
      return;
    }
    if (!supabase || !authEmail.trim()) {
      setAuthMessage('Enter your account email first.');
      return;
    }
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), { redirectTo: window.location.origin });
      setAuthMessage(error
        ? `Could not send password reset: ${error.message}`
        : 'Check your email for a one-time password reset link. After setting a password, future sign-ins will not need email.');
    } catch (error) {
      setAuthMessage(`Could not send password reset: ${error.message || 'Try again later.'}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const saveNewPassword = async (event) => {
    event.preventDefault();
    if (!supabase || authPassword.length < 6) return;
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password: authPassword });
      if (error) setAuthMessage(`Could not update password: ${error.message}`);
      else {
        setPasswordRecovery(false);
        setAuthPassword('');
        setAuthMessage('Password saved. You can use it for future sign-ins.');
      }
    } catch (error) {
      setAuthMessage(`Could not update password: ${error.message || 'Try again.'}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setDataMessage(`Could not sign out: ${error.message}`);
      return;
    }
    setExpenses([]);
  };

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
  const balanceEntries = calculateBalances(expenses);
  const settlements = suggestSettlements(balanceEntries);

  const updateSentence = (value) => {
    setSentence(value);
    const parsed = parseExpenseSentence(value);
    if (parsed) {
      setDescription(parsed.description);
      setAmount(String(parsed.amount));
      setParticipants(parsed.participantNames.map((name) => ({ name, share: '' })));
    }
  };

  const createGroup = async (event) => {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!supabase || !name) return;
    setDataMessage('');
    const { data: groupId, error } = await supabase.rpc('create_group', { group_name: name });
    if (error) {
      setDataMessage(`Could not create group: ${error.message}`);
      return;
    }
    const { data: updatedGroups, error: loadError } = await supabase.from('groups').select('id,name,join_code,created_at').order('created_at', { ascending: true });
    if (loadError) {
      setDataMessage(`Group created, but could not refresh the list: ${loadError.message}`);
      return;
    }
    setGroups(updatedGroups || []);
    setActiveGroupId(groupId);
    localStorage.setItem('splitsmart.activeGroupId', groupId);
    setNewGroupName('');
    setExpenses([]);
    setReady(false);
  };

  const joinGroup = async (event) => {
    event.preventDefault();
    if (!supabase || !groupCode.trim()) return;
    setDataMessage('');
    const { data: groupId, error } = await supabase.rpc('join_group', { code: groupCode.trim() });
    if (error) {
      setDataMessage(`Could not join group: ${error.message}`);
      return;
    }
    const { data: updatedGroups, error: loadError } = await supabase.from('groups').select('id,name,join_code,created_at').order('created_at', { ascending: true });
    if (loadError) {
      setDataMessage(`Joined group, but could not refresh the list: ${loadError.message}`);
      return;
    }
    setGroups(updatedGroups || []);
    if (groupId !== activeGroupId) {
      setActiveGroupId(groupId);
      localStorage.setItem('splitsmart.activeGroupId', groupId);
      setExpenses([]);
      setReady(false);
    }
    setGroupCode('');
  };

  const switchGroup = (groupId) => {
    setActiveGroupId(groupId);
    localStorage.setItem('splitsmart.activeGroupId', groupId);
    setExpenses([]);
    setReady(false);
  };

  const addExpense = async () => {
    if (!canAddExpense) return;
    const expense = {
      id: 'e-' + Date.now(), emoji: '🧾', name: description.trim(),
      description: description.trim(), paidBy: paidBy.trim(),
      amount: amountValue, people: peopleValue,
      each: splitMode === 'equal' ? amountValue / peopleValue : null,
      splitMode, splits,
    };
    if (supabase) {
      setDataMessage('');
      const { data, error } = await supabase.from('expenses').insert({
        user_id: user.id, group_id: activeGroupId, name: expense.name, description: expense.description, emoji: expense.emoji,
        paid_by: expense.paidBy, amount: expense.amount, people: expense.people, each: expense.each,
        split_mode: expense.splitMode, splits: expense.splits,
      }).select().single();
      if (error) {
        setDataMessage(`Could not add expense: ${error.message}`);
        return;
      }
      expense.id = data.id;
    }
    setExpenses((list) => [...list, expense]);
    setSentence('');
    setDescription('');
    setAmount('');
    setPaidBy('You');
    setParticipants([{ name: 'You', share: '' }, { name: 'Friend', share: '' }]);
    setSplitMode('equal');
  };

  const removeExpense = async (id) => {
    if (supabase) {
      setDataMessage('');
      const { error } = await supabase.from('expenses').delete().eq('id', id).eq('group_id', activeGroupId);
      if (error) {
        setDataMessage(`Could not remove expense: ${error.message}`);
        return;
      }
    }
    setExpenses((list) => list.filter((e) => e.id !== id));
  };

  if (supabase && (!authReady || (user && (!groupsReady || !ready)))) {
    return <main style={styles.page}><div style={styles.card}>Loading your SplitSmart account…</div></main>;
  }

  if (supabase && passwordRecovery && user) {
    return <main style={styles.page}><div style={styles.card}>
      <div style={styles.header}><div style={styles.brand}><div style={styles.logo}>S</div><div style={styles.title}>SplitSmart</div></div></div>
      <div style={styles.sectionTitle}>Set a password</div>
      <div style={styles.examples}>This is a one-time step for your existing account. Your saved expenses stay with it.</div>
      <form onSubmit={saveNewPassword} style={styles.authForm}>
        <input style={styles.fieldInput} type="password" required minLength={6} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="New password (at least 6 characters)" aria-label="New password" autoComplete="new-password" />
        <button style={styles.submitBtn} type="submit" disabled={authBusy}>{authBusy ? 'Saving…' : 'Save password'}</button>
      </form>
      {authMessage && <div style={styles.authMessage} role="status">{authMessage}</div>}
    </div></main>;
  }

  if (supabase && !user) {
    return <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}><div style={styles.brand}><div style={styles.logo}>S</div><div style={styles.title}>SplitSmart</div></div><div style={styles.groupPill}>My Group</div></div>
        <div style={styles.sectionTitle}>Sign in to SplitSmart</div>
        <div style={styles.examples}>{authType === 'username' ? 'Use a username and password. After email confirmation is disabled in Supabase, this login sends no emails.' : 'Use the email and password from your existing account.'}</div>
        <form onSubmit={submitAuth} style={styles.authForm}>
          <input style={styles.fieldInput} type={authType === 'username' ? 'text' : 'email'} required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder={authType === 'username' ? 'Username' : 'you@example.com'} aria-label={authType === 'username' ? 'Username' : 'Email address'} autoComplete={authType === 'username' ? 'username' : 'email'} />
          <input style={styles.fieldInput} type="password" required minLength={6} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password (at least 6 characters)" aria-label="Password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} />
          <button style={styles.submitBtn} type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'}</button>
        </form>
        <button type="button" style={styles.authModeToggle} onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthMessage(''); }}>
          {authMode === 'signup' ? 'Already have an account? Sign in' : 'New to SplitSmart? Create an account'}
        </button>
        <button type="button" style={styles.authModeToggle} onClick={() => { setAuthType(authType === 'username' ? 'email' : 'username'); setAuthMessage(''); }}>
          {authType === 'username' ? 'Use existing email account' : 'Use username account (no email)'}
        </button>
        {authType === 'email' && authMode === 'signin' && <button type="button" style={styles.authModeToggle} onClick={requestPasswordReset} disabled={authBusy}>Forgot password? (one-time email)</button>}
        {authMessage && <div style={{ ...styles.authMessage, color: authMessage.startsWith('Could not') || authMessage.startsWith('An account') ? '#a13d30' : 'var(--blue)' }} role="status">{authMessage}</div>}
      </div>
    </main>;
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.brand}>
            <div style={styles.logo}>S</div>
            <div style={styles.title}>Sumit Pawse</div>
          </div>
          <div style={styles.headerActions}>
            <div style={styles.groupPill}>{groups.find((group) => group.id === activeGroupId)?.name || 'My Group'}</div>
            {supabase && <button type="button" style={styles.signOut} onClick={signOut}>Sign out</button>}
          </div>
        </div>
        {supabase && user && activeGroupId && <section style={styles.groupsPanel} aria-label="Group management">
          <label style={styles.fieldLabel}>Current group
            <select style={styles.fieldInput} value={activeGroupId} onChange={(event) => switchGroup(event.target.value)}>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <div style={styles.groupInvite}>Invite code: <strong>{groups.find((group) => group.id === activeGroupId)?.join_code || '—'}</strong></div>
          <form style={styles.groupAction} onSubmit={createGroup}>
            <input style={styles.fieldInput} value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} maxLength={80} placeholder="New group name" aria-label="New group name" required />
            <button style={styles.smallAction} type="submit">Create group</button>
          </form>
          <form style={styles.groupAction} onSubmit={joinGroup}>
            <input style={styles.fieldInput} value={groupCode} onChange={(event) => setGroupCode(event.target.value)} maxLength={12} placeholder="Friend's invite code" aria-label="Group invite code" required />
            <button style={styles.smallAction} type="submit">Join group</button>
          </form>
        </section>}
        {dataMessage && <div style={styles.dataMessage} role="alert">{dataMessage}</div>}
        {supabase && user && <div style={styles.signedIn}>Signed in as {user.user_metadata?.username || user.email}</div>}

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
        <button style={styles.submitBtn} onClick={addExpense} aria-label="Add expense" disabled={!canAddExpense || (supabase && !activeGroupId)}>Add expense</button>

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
        <div style={styles.balancePanel}>
          <div style={styles.sectionTitle}>Group balances</div>
          {balanceEntries.length === 0 && <div style={styles.balanceEmpty}>Everyone is settled up.</div>}
          {balanceEntries.map(({ name, paise }) => <div key={name} style={styles.balanceRow}>
            <span>{name}</span><span>{paise > 0 ? `gets back ${inr(paise / 100)}` : `owes ${inr(-paise / 100)}`}</span>
          </div>)}
          <div style={styles.settleTitle}>Settle up</div>
          {settlements.length === 0
            ? <div style={styles.balanceEmpty}>No payments needed right now.</div>
            : settlements.map((settlement, index) => <div style={styles.settlementRow} key={`${settlement.from}-${settlement.to}-${index}`}>
              <span><strong>{settlement.from}</strong> pays <strong>{settlement.to}</strong></span>
              <strong style={styles.settlementAmount}>{inr(settlement.paise / 100)}</strong>
            </div>)}
        </div>
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
    maxWidth: 560,
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
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  signOut: { border: '1px solid var(--line)', borderRadius: 999, padding: '6px 10px', color: 'var(--muted)', background: '#fff', fontSize: 11.5, fontWeight: 700 },
  authForm: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 },
  authModeToggle: { border: 0, background: 'transparent', color: 'var(--blue)', cursor: 'pointer', font: 'inherit', fontSize: 13, marginTop: 12, padding: 0 },
  authMessage: { color: 'var(--blue)', fontSize: 12.5, marginTop: 12 },
  groupsPanel: { display: 'grid', gap: 9, marginBottom: 16, padding: 12, border: '1px solid var(--line)', borderRadius: 14, background: '#fbfcff' },
  groupInvite: { fontSize: 12, color: 'var(--muted)' },
  groupAction: { display: 'flex', gap: 8, alignItems: 'center' },
  smallAction: { flex: 'none', border: 0, borderRadius: 10, padding: '10px 12px', color: '#fff', background: 'linear-gradient(135deg, var(--blue), var(--cyan))', fontSize: 12, fontWeight: 800, cursor: 'pointer' },
  dataMessage: { color: '#a13d30', fontSize: 12.5, padding: '10px 12px', borderRadius: 12, background: '#fff3f1', marginBottom: 12 },
  signedIn: { color: 'var(--muted)', fontSize: 11.5, marginTop: -10, marginBottom: 14, overflowWrap: 'anywhere' },
  balanceRow: { display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', color: 'var(--muted)', fontSize: 12.5 },
  balanceEmpty: { color: 'var(--muted)', fontSize: 12.5, padding: '6px 0' },
  settleTitle: { fontSize: 14, fontWeight: 800, marginTop: 12, marginBottom: 4 },
  settlementRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', marginTop: 7, borderRadius: 12, background: '#f7f9fc', border: '1px solid var(--line)', fontSize: 12.5 },
  settlementAmount: { color: 'var(--blue)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  footnote: { color: 'var(--muted)', fontSize: 12.5, textAlign: 'center', lineHeight: 1.6, marginTop: 20, maxWidth: 420 },
};
