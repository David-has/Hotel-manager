require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hotel',
  dateStrings: true
});

const h = fn => (req, res) => fn(req, res).catch(e => {
  console.error(e);
  res.status(e.status || 500).json({ error: e.message });
});
const fail = (status, message) => Object.assign(new Error(message), { status });

app.get('/api/stats', h(async (_req, res) => {
  const [[r]] = await db.query(`SELECT COUNT(*) total, SUM(status='occupied') occupied FROM rooms`);
  const [[a]] = await db.query(`SELECT COUNT(*) n FROM bookings WHERE check_in=CURDATE() AND status='confirmed'`);
  const [[d]] = await db.query(`SELECT COUNT(*) n FROM bookings WHERE check_out=CURDATE() AND status='checked_in'`);
  const [[m]] = await db.query(`SELECT COALESCE(SUM(total),0) revenue FROM bookings
    WHERE status<>'cancelled' AND DATE_FORMAT(check_in,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')`);
  res.json({ rooms: r.total, occupied: Number(r.occupied), arrivals: a.n, departures: d.n, revenue: Number(m.revenue) });
}));

app.get('/api/rooms', h(async (_req, res) => {
  const [rows] = await db.query(`SELECT r.*, t.name type, t.price, t.capacity
    FROM rooms r JOIN room_types t ON t.id=r.type_id ORDER BY r.number`);
  res.json(rows);
}));

app.patch('/api/rooms/:id', h(async (req, res) => {
  const ok = ['available', 'occupied', 'cleaning', 'maintenance'];
  if (!ok.includes(req.body.status)) throw fail(400, 'Status de cameră invalid.');
  await db.query('UPDATE rooms SET status=? WHERE id=?', [req.body.status, req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/guests', h(async (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const [rows] = await db.query(`SELECT * FROM guests WHERE full_name LIKE ? OR email LIKE ? ORDER BY full_name`, [q, q]);
  res.json(rows);
}));

app.post('/api/guests', h(async (req, res) => {
  const { full_name, email, phone, country } = req.body;
  if (!full_name || !full_name.trim()) throw fail(400, 'Numele oaspetelui este obligatoriu.');
  const [r] = await db.query('INSERT INTO guests (full_name,email,phone,country) VALUES (?,?,?,?)',
    [full_name.trim(), email || null, phone || null, country || null]);
  res.status(201).json({ id: r.insertId });
}));

app.get('/api/bookings', h(async (_req, res) => {
  const [rows] = await db.query(`SELECT b.*, g.full_name guest, r.number room, t.name type
    FROM bookings b JOIN guests g ON g.id=b.guest_id JOIN rooms r ON r.id=b.room_id
    JOIN room_types t ON t.id=r.type_id ORDER BY b.check_in DESC`);
  res.json(rows);
}));

app.post('/api/bookings', h(async (req, res) => {
  const { guest_id, room_id, check_in, check_out } = req.body;
  if (!guest_id || !room_id || !check_in || !check_out) throw fail(400, 'Completează oaspetele, camera și datele.');
  if (check_out <= check_in) throw fail(400, 'Data de plecare trebuie să fie după data de sosire.');
  const [[room]] = await db.query(`SELECT r.status, t.price FROM rooms r JOIN room_types t ON t.id=r.type_id WHERE r.id=?`, [room_id]);
  if (!room) throw fail(404, 'Camera nu există.');
  if (room.status === 'maintenance') throw fail(409, 'Camera este în mentenanță.');
  const [[c]] = await db.query(`SELECT COUNT(*) n FROM bookings WHERE room_id=? AND status IN ('confirmed','checked_in')
    AND check_in < ? AND check_out > ?`, [room_id, check_out, check_in]);
  if (c.n) throw fail(409, 'Camera este deja rezervată în această perioadă.');
  const nights = Math.round((new Date(check_out) - new Date(check_in)) / 86400000);
  const [r] = await db.query('INSERT INTO bookings (guest_id,room_id,check_in,check_out,total) VALUES (?,?,?,?,?)',
    [guest_id, room_id, check_in, check_out, nights * room.price]);
  res.status(201).json({ id: r.insertId, total: nights * room.price });
}));

app.patch('/api/bookings/:id', h(async (req, res) => {
  const next = { checked_in: 'occupied', checked_out: 'cleaning', cancelled: null };
  const { status } = req.body;
  if (!(status in next)) throw fail(400, 'Status de rezervare invalid.');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[b]] = await conn.query('SELECT room_id FROM bookings WHERE id=? FOR UPDATE', [req.params.id]);
    if (!b) throw fail(404, 'Rezervarea nu există.');
    await conn.query('UPDATE bookings SET status=? WHERE id=?', [status, req.params.id]);
    if (next[status]) await conn.query('UPDATE rooms SET status=? WHERE id=?', [next[status], b.room_id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

app.listen(process.env.PORT || 3000, () => console.log(`Hotel Manager pe http://localhost:${process.env.PORT || 3000}`));
