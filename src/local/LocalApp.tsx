import React, { useEffect, useState } from 'react';
import '../demo/demo.css';
import './local.css';

type User = { id: string; name: string; username: string; role: 'owner' | 'worker'; active?: number };
type Farm = { id: string; name: string; timezone: string };
type Field = { id: string; name: string; crop: string; area_ha: number };
type Harvest = { id: string; field_name: string; kg: number; recorded_at: string; recorded_by: string };
async function api<T>(route: string, input?: object): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/local/${route}`, { credentials: 'same-origin', cache: 'no-store', ...(input ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) } : {}) }); }
  catch { throw new Error('Farm server unavailable. Check your Wi-Fi and server. No cloud fallback was attempted.'); }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('No local server is connected here. Install and open the farm server to use local mode.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}
export default function LocalApp() {
  const [session, setSession] = useState<{ user: User; farm: Farm } | null>(null);
  const [fields, setFields] = useState<Field[]>([]), [harvests, setHarvests] = useState<Harvest[]>([]);
  const [users, setUsers] = useState<User[]>([]), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [initialized, setInitialized] = useState<boolean | null>(null), [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const refresh = async (current = session) => {
    const [newFields, newHarvests, newUsers] = await Promise.all([api<Field[]>('fields'), api<Harvest[]>('harvests'), current?.user.role === 'owner' ? api<User[]>('users') : Promise.resolve([])]);
    setFields(newFields); setHarvests(newHarvests); setUsers(newUsers);
  };
  useEffect(() => { let active = true;
    (async () => { try {
      const status = await api<{ initialized: boolean }>('status'); if (!active) return; setInitialized(status.initialized);
      if (status.initialized) {
        try { const current = await api<{ user: User; farm: Farm }>('me'); if (active) { setSession(current); await refresh(current); } } catch (e) { if (!(e as Error).message.includes('Sign in') && !(e as Error).message.includes('expired')) throw e; }
      }
    } catch (e) { if (active) setError((e as Error).message); } })();
    return () => { active = false; };
  }, []);
  const submit = (task: (data: FormData) => Promise<void>) => async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setError(''); setNotice('');
    try { await task(new FormData(form)); form.reset(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="demo-shell local-shell"><header className="demo-header"><a className="demo-brand" href="/local">✦ AgriMap <b>Local</b></a><span className="demo-tag">Farm server · cloud not connected</span><a href="/demo">Explore demo</a></header>
    <main className="local-main"><p className="demo-eyebrow">YOUR FARM, ON YOUR NETWORK</p><h1>{session ? session.farm.name : 'Connect to your farm'}</h1>
      <p>Local mode currently supports fields, harvest records, and owner-managed worker accounts. Other farm modules remain in the cloud application.</p>
      {error && <p className="local-message local-error" role="alert">{error}</p>}{notice && <p className="local-message" role="status">{notice}</p>}
      {!session ? <article className="demo-card"><h2>Local sign in</h2>
        {initialized === false ? <p>On the server computer, run <code>npm run local:init</code> to create your farm and owner account. Public self-registration is disabled on farm servers.</p> : <form onSubmit={submit(async data => { const current = await api<{ user: User; farm: Farm }>('login', { username: data.get('username'), password: data.get('password') }); setSession(current); await refresh(current); })}>
          <label>Username<input name="username" required autoComplete="username" maxLength={80}/></label><label>Password<input name="password" type="password" required autoComplete="current-password" maxLength={200}/></label><button disabled={busy || initialized === null}>Sign in locally</button>
        </form>}
        <p>Internet and Firebase are not required. Your device must be able to reach this farm server.</p><a href="/start">Compare cloud and local options</a>
      </article> : <>
        <div className="local-session"><p>Signed in as <b>{session.user.name}</b> · {session.user.role} · {session.farm.timezone}</p><button disabled={busy} onClick={async () => { setBusy(true); try { await api('logout', {}); setSession(null); setFields([]); setHarvests([]); setUsers([]); setNotice('Signed out'); setError(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Sign out</button><button disabled={busy} onClick={async () => { setError(''); try { await refresh(); setNotice('Records refreshed from the farm server'); } catch (e) { setError((e as Error).message); } }}>Refresh records</button></div>
        <div className="demo-two-col"><article className="demo-card"><h2>Fields</h2>{!fields.length && <p>No fields yet. The owner can add the first field below.</p>}<ul>{fields.map(field => <li key={field.id}><b>{field.name}</b> · {field.crop} · {field.area_ha} ha</li>)}</ul>
          {session.user.role === 'owner' && <form onSubmit={submit(async data => { await api('fields', { name: data.get('name'), crop: data.get('crop'), area_ha: Number(data.get('area')) }); setNotice('Field saved on farm server'); await refresh(); })}><h3>Add a field</h3><label>Field name<input name="name" required maxLength={120}/></label><label>Crop or variety<input name="crop" required maxLength={120}/></label><label>Area (ha)<input name="area" type="number" min="0.0001" max="100000" step="any" required/></label><button disabled={busy}>Save field</button></form>}
        </article><article className="demo-card"><h2>Record harvest</h2><form onSubmit={submit(async data => { await api('harvests', { field_id: data.get('field'), kg: Number(data.get('kg')), request_id: requestId }); setRequestId(crypto.randomUUID()); setNotice('Harvest saved on farm server'); await refresh(); })}><label>Field<select name="field" aria-label="Field" required><option value="">Choose a field</option>{fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label><label>Harvest weight (kg)<input name="kg" type="number" min="0.001" max="1000000" step="any" required/></label><button disabled={busy || !fields.length}>Save harvest</button></form><p>Save is confirmed by the server. If a response is interrupted, retry the same entry before changing its details. Nothing is queued on this device.</p></article></div>
        <article className="demo-card"><h2>Harvest records</h2><p>Total recorded: {harvests.reduce((total, entry) => total + entry.kg, 0).toLocaleString()} kg</p><div className="local-table"><table><thead><tr><th>Field</th><th>Weight</th><th>Recorded by</th><th>Saved at ({session.farm.timezone})</th></tr></thead><tbody>{harvests.map(entry => <tr key={entry.id}><td>{entry.field_name}</td><td>{entry.kg} kg</td><td>{entry.recorded_by}</td><td>{new Date(entry.recorded_at).toLocaleString(undefined, { timeZone: session.farm.timezone })}</td></tr>)}</tbody></table></div></article>
        {session.user.role === 'owner' && <div className="demo-two-col"><article className="demo-card"><h2>Farm users</h2><ul>{users.map(user => <li key={user.id}>{user.name} · {user.username} · {user.role}{user.role === 'worker' && <> · {user.active ? 'active' : 'disabled'} <button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await api('worker-access', { id: user.id, active: !user.active }); await refresh(); setNotice('Worker access updated; existing sessions revoked'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{user.active ? 'Disable' : 'Enable'} {user.name}</button></>}</li>)}</ul><form onSubmit={submit(async data => { await api('users', { name: data.get('name'), username: data.get('username'), password: data.get('password') }); setNotice('Worker created. Share their credentials privately.'); await refresh(); })}><h3>Add a worker</h3><label>Worker name<input name="name" required maxLength={120}/></label><label>Worker username<input name="username" required maxLength={80} autoComplete="off"/></label><label>Initial password<input name="password" type="password" minLength={12} maxLength={200} required autoComplete="new-password"/></label><button disabled={busy}>Create worker</button></form><form onSubmit={submit(async data => { await api('worker-access', { id: data.get('worker'), new_password: data.get('password') }); setNotice('Worker password reset; existing sessions revoked'); await refresh(); })}><h3>Reset worker password</h3><label>Worker<select name="worker" required><option value="">Choose worker</option>{users.filter(user => user.role === 'worker').map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label>New worker password<input name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password"/></label><button disabled={busy}>Reset worker password</button></form></article>
          <article className="demo-card"><h2>Data and backup</h2><p>All records are on this farm server. Cloud backup and account linking are not connected yet. Permanent farm and user IDs are included in exports for future linking.</p><a className="demo-primary" href="/api/local/export">Download farm data</a><p>This JSON export excludes passwords and sessions. For full recovery, use the server’s SQLite backup command and keep a copy on another device.</p><p>Camera gateway, device offline queue, and cloud sync will be added in later migration stages.</p></article></div>}
        <article className="demo-card"><h2>Change your password</h2><form onSubmit={submit(async data => { if (data.get('new_password') !== data.get('confirm_password')) throw new Error('New passwords do not match'); await api('password', { current_password: data.get('current_password'), new_password: data.get('new_password') }); setSession(null); setFields([]); setHarvests([]); setUsers([]); setNotice('Password changed. Sign in again. All previous sessions were revoked.'); })}><label>Current password<input name="current_password" type="password" required autoComplete="current-password" maxLength={200}/></label><label>New password<input name="new_password" type="password" required minLength={12} maxLength={200} autoComplete="new-password"/></label><label>Confirm new password<input name="confirm_password" type="password" required minLength={12} maxLength={200} autoComplete="new-password"/></label><button disabled={busy}>Change password</button></form></article>
      </>}
    </main></div>;
}
