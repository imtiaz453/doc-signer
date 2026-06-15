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
    <div style={{ padding: '20px', maxWidth: '100%', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 20, color: '#1a1a2e' }}>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#666', textAlign: 'right', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.user.name}</span>
          <a href="/" style={{ fontSize: 12, color: '#1a73e8' }}>← Back</a>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid #e0e0e0', overflowX: 'auto' }}>
        {[
          { key: 'settings', label: 'Settings' },
          { key: 'users', label: `Users (${users.length})` },
          { key: 'stamps', label: `Stamps (${stamps.length})` },
          { key: 'logs', label: 'Usage Logs' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, color: tab === t.key ? '#1a73e8' : '#666',
              borderBottom: tab === t.key ? '2px solid #1a73e8' : '2px solid transparent',
              marginBottom: -2, whiteSpace: 'nowrap',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 16, marginBottom: 12, color: '#333' }}>Global Settings</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, color: '#444', minWidth: 180 }}>Allow Signatures in Sidebar</span>
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
            <form onSubmit={createUser} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>Full Name *</label>
                <input placeholder="Full Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  style={{ padding: '10px 14px', border: '2px solid #e8e8ec', borderRadius: 8, fontSize: 14 }} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>Email *</label>
                <input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={{ padding: '10px 14px', border: '2px solid #e8e8ec', borderRadius: 8, fontSize: 14 }} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>Password *</label>
                <input placeholder="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={{ padding: '10px 14px', border: '2px solid #e8e8ec', borderRadius: 8, fontSize: 14 }} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>Role *</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  style={{ padding: '10px 14px', border: '2px solid #e8e8ec', borderRadius: 8, fontSize: 14, background: '#fff', width: '100%' }}>
                  <option value="SALESMAN">Salesman</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <button type="submit"
                style={{ padding: '12px', border: 'none', borderRadius: 8, background: '#1a73e8', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
                Create User
              </button>
              {msg && <p style={{ fontSize: 13, color: msg.startsWith('Error') ? '#e53935' : '#2e7d32', marginTop: 8 }}>{msg}</p>}
            </form>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          {users.length === 0 ? (
            <p style={{ padding: 20, color: '#888', textAlign: 'center' }}>No users found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>Name</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>Email</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>Role</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderTop: '1px solid #e8eaed' }}>
                      <td style={{ padding: '8px 10px', fontSize: 13 }}>{u.name}</td>
                      <td style={{ padding: '8px 10px', color: '#555', fontSize: 13 }}>{u.email}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: u.role === 'ADMIN' ? '#e3f2fd' : '#f3e5f5',
                          color: u.role === 'ADMIN' ? '#1565c0' : '#7b1fa2',
                        }}>{u.role}</span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#888', fontSize: 11 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'stamps' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          {stamps.length === 0 ? (
            <p style={{ padding: 20, color: '#888', textAlign: 'center' }}>No stamps uploaded yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>Image</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>Name</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>Uploaded By</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>Date</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {stamps.map(s => (
                    <tr key={s.id} style={{ borderTop: '1px solid #e8eaed' }}>
                      <td style={{ padding: '8px 10px' }}>
                        <img src={s.imageUrl} alt={s.name} style={{ width: 50, height: 50, objectFit: 'contain', borderRadius: 6, background: '#f8f9fa' }} />
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 13 }}>{s.name}</td>
                      <td style={{ padding: '8px 10px', color: '#555', fontSize: 13 }}>{s.uploadedBy?.name || 'Unknown'}</td>
                      <td style={{ padding: '8px 10px', color: '#888', fontSize: 11 }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <button onClick={() => deleteStamp(s.id)}
                          style={{ padding: '4px 8px', border: '1px solid #e53935', borderRadius: 6, background: '#fff', color: '#e53935', cursor: 'pointer', fontSize: 11 }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
          {logs.length === 0 ? (
            <p style={{ padding: 20, color: '#888', textAlign: 'center' }}>No stamp usage recorded yet. Logs appear here once users place stamps on documents.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>User</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>Stamp</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>Document</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>Page</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#666', fontWeight: 600, whiteSpace: 'nowrap' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} style={{ borderTop: '1px solid #e8eaed' }}>
                      <td style={{ padding: '8px 10px', fontSize: 13, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.user?.name || l.userId}</td>
                      <td style={{ padding: '8px 10px', color: '#555', fontSize: 13, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.stamp?.name || l.stampId}</td>
                      <td style={{ padding: '8px 10px', fontSize: 13, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.documentName}</td>
                      <td style={{ padding: '8px 10px', fontSize: 13 }}>Page {l.pageNumber}</td>
                      <td style={{ padding: '8px 10px', color: '#888', fontSize: 11 }}>{new Date(l.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
