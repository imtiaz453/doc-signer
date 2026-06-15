'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [users, setUsers] = useState([]);
  const [stamps, setStamps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ showSignatures: 'true' });
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SALESMAN' });
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('settings');

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status === 'authenticated' && !isAdmin) { router.push('/'); return; }
  }, [status, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/users').then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d); }).catch(() => {});
    fetch('/api/stamps').then(r => r.json()).then(d => { if (Array.isArray(d)) setStamps(d); }).catch(() => {});
    fetch('/api/settings').then(r => r.json()).then(d => { if (d) setSettings(d); }).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || tab !== 'logs') return;
    fetch('/api/stamp-logs').then(r => r.json()).then(d => { if (Array.isArray(d)) setLogs(d); }).catch(() => {});
  }, [isAdmin, tab]);

  const createUser = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setMsg('Error: ' + data.error); return; }
      setMsg('User created: ' + data.email);
      setForm({ name: '', email: '', password: '', role: 'SALESMAN' });
      fetch('/api/users').then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d); });
    } catch (err) { setMsg('Error: ' + err.message); }
  };

  const deleteStamp = async (id) => {
    if (!confirm('Delete this stamp?')) return;
    await fetch(`/api/stamps/${id}`, { method: 'DELETE' });
    setStamps(prev => prev.filter(s => s.id !== id));
  };

  const toggleSignatures = async () => {
    const newVal = settings.showSignatures === 'false' ? 'true' : 'false';
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showSignatures: newVal }),
    });
    const data = await res.json();
    if (data) setSettings(data);
  };

  if (status !== 'authenticated' || !isAdmin) return null;

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, color: '#1a1a2e' }}>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#666' }}>{session.user.name}</span>
          <a href="/" style={{ fontSize: 13, color: '#1a73e8' }}>← Back to Signer</a>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e0e0e0' }}>
        {[
          { key: 'settings', label: 'Settings' },
          { key: 'users', label: `Users (${users.length})` },
          { key: 'stamps', label: `Stamps (${stamps.length})` },
          { key: 'logs', label: 'Usage Logs' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 500, color: tab === t.key ? '#1a73e8' : '#666',
              borderBottom: tab === t.key ? '2px solid #1a73e8' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 16, marginBottom: 12, color: '#333' }}>Global Settings</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, color: '#444' }}>Allow Signatures in Sidebar</span>
              <button onClick={toggleSignatures}
                style={{
                  position: 'relative', width: 48, height: 26, borderRadius: 13, border: 'none',
                  background: settings.showSignatures === 'true' ? '#1a73e8' : '#ccc',
                  cursor: 'pointer', transition: 'background 0.2s',
                }}>
                <span style={{
                  position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                  left: settings.showSignatures === 'true' ? 25 : 3,
                }} />
              </button>
              <span style={{ fontSize: 12, color: '#888' }}>
                {settings.showSignatures === 'true' ? 'On — Signatures tab visible' : 'Off — Stamps only'}
              </span>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 16, marginBottom: 12, color: '#333' }}>Create New User</h2>
            <form onSubmit={createUser} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 400 }}>
              <input placeholder="Full Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={{ padding: '10px 14px', border: '2px solid #e8e8ec', borderRadius: 8, fontSize: 14 }} required />
              <input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                style={{ padding: '10px 14px', border: '2px solid #e8e8ec', borderRadius: 8, fontSize: 14 }} required />
              <input placeholder="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{ padding: '10px 14px', border: '2px solid #e8e8ec', borderRadius: 8, fontSize: 14 }} required />
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                style={{ padding: '10px 14px', border: '2px solid #e8e8ec', borderRadius: 8, fontSize: 14, background: '#fff' }}>
                <option value="SALESMAN">Salesman</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button type="submit"
                style={{ padding: '10px', border: 'none', borderRadius: 8, background: '#1a73e8', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Create User
              </button>
              {msg && <p style={{ fontSize: 13, color: msg.startsWith('Error') ? '#e53935' : '#2e7d32' }}>{msg}</p>}
            </form>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          {users.length === 0 ? (
            <p style={{ padding: 20, color: '#888', textAlign: 'center' }}>No users found.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderTop: '1px solid #e8eaed' }}>
                    <td style={{ padding: '10px 14px' }}>{u.name}</td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>{u.email}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                        background: u.role === 'ADMIN' ? '#e3f2fd' : '#f3e5f5',
                        color: u.role === 'ADMIN' ? '#1565c0' : '#7b1fa2',
                      }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'stamps' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          {stamps.length === 0 ? (
            <p style={{ padding: 20, color: '#888', textAlign: 'center' }}>No stamps uploaded yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Image</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Uploaded By</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}></th>
                </tr>
              </thead>
              <tbody>
                {stamps.map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid #e8eaed' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <img src={s.imageUrl} alt={s.name} style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 6, background: '#f8f9fa' }} />
                    </td>
                    <td style={{ padding: '10px 14px' }}>{s.name}</td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>{s.uploadedBy?.name || 'Unknown'}</td>
                    <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => deleteStamp(s.id)}
                        style={{ padding: '4px 12px', border: '1px solid #e53935', borderRadius: 6, background: '#fff', color: '#e53935', cursor: 'pointer', fontSize: 12 }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          {logs.length === 0 ? (
            <p style={{ padding: 20, color: '#888', textAlign: 'center' }}>No stamp usage recorded yet. Logs appear here once users place stamps on documents.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>User</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Stamp</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Document</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Page</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#666', fontWeight: 600 }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} style={{ borderTop: '1px solid #e8eaed' }}>
                    <td style={{ padding: '10px 14px' }}>{l.user?.name || l.userId}</td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>{l.stamp?.name || l.stampId}</td>
                    <td style={{ padding: '10px 14px' }}>{l.documentName}</td>
                    <td style={{ padding: '10px 14px' }}>Page {l.pageNumber}</td>
                    <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>{new Date(l.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
