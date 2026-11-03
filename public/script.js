const $ = (selector, root = document) => root.querySelector(selector);

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

const ST = {
  available: 'Liberă',
  occupied: 'Ocupată',
  cleaning: 'Curățenie',
  maintenance: 'Mentenanță'
};

const BS = {
  confirmed: 'Confirmată',
  checked_in: 'Cazat',
  checked_out: 'Plecat',
  cancelled: 'Anulată'
};

const money = n => Number(n).toLocaleString('ro-RO') + ' lei';

const TODAY = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);

const addDays = (dateStr, n) =>
  new Date(Date.parse(dateStr) + n * 86400000).toISOString().slice(0, 10);

const dayIdx = (dateStr, base) =>
  Math.round((Date.parse(dateStr) - Date.parse(base)) / 86400000);

const range = n => [...Array(n).keys()];

let D = {};
let view = 'overview';
let tl = TODAY;

const F = {
  bq: '',
  bs: '',
  rs: '',
  gq: ''
};


function toast(message, isError) {
  const el = $('#toast');
  el.textContent = message;
  el.className = isError ? 'err' : '';
  el.style.display = 'block';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.style.display = 'none';
  }, 3500);
}

async function api(path, method = 'GET', body) {
  const response = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Eroare necunoscută');
  }
  return data;
}

async function load() {
  [D.rooms, D.guests, D.bookings, D.stats] = await Promise.all([
    api('/rooms'),
    api('/guests'),
    api('/bookings'),
    api('/stats')
  ]);
}

async function act(fn, successMessage, closeDialog) {
  try {
    await fn();
    if (closeDialog) {
      $('#dlg').close();
    }
    if (successMessage) {
      toast(successMessage);
    }
    await show(view);
  } catch (error) {
    toast(error.message, true);
  }
}


function tbl(heads, rows) {
  const headHtml = heads
    .map(h => {
      const right = h[0] === '>';
      return `<th${right ? ' class="r"' : ''}>${h.replace('>', '')}</th>`;
    })
    .join('');

  const rowsHtml = rows
    .map(row => {
      const cells = row
        .map((cell, i) => {
          const right = heads[i][0] === '>';
          const label = heads[i].replace('>', '');
          return `<td data-label="${label}"${right ? ' class="r"' : ''}>${cell}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<table><tr>${headHtml}</tr>${rowsHtml}</table>`;
}

function chips(key, options, onClickAfter) {
  return options
    .map(([value, label]) => `
      <button class="chip" aria-pressed="${F[key] === value}"
        onclick="F.${key}='${value}';${onClickAfter}">${label}</button>
    `)
    .join('');
}

function live() {
  return D.bookings.filter(b => b.status !== 'cancelled');
}

function bookingBtns(booking) {
  if (booking.status === 'confirmed') {
    return `
      <button class="btn sm" onclick="setB(${booking.id},'checked_in','Check-in efectuat')">Check-in</button>
      <button class="btn sm red" onclick="setB(${booking.id},'cancelled','Rezervare anulată')">Anulează</button>
    `;
  }
  if (booking.status === 'checked_in') {
    return `<button class="btn sm" onclick="setB(${booking.id},'checked_out','Check-out efectuat')">Check-out</button>`;
  }
  return '';
}

function setB(id, status, message) {
  return act(() => api('/bookings/' + id, 'PATCH', { status }), message);
}


const views = {
  overview() {
    const stats = D.stats;
    const percent = stats.rooms ? Math.round((stats.occupied / stats.rooms) * 100) : 0;
    const activeBookings = live();
    const days = range(14).map(i => addDays(TODAY, i));

    const occupancy = days.map(day => {
      const busyRooms = new Set(
        activeBookings
          .filter(b => b.check_in <= day && b.check_out > day)
          .map(b => b.room_id)
      );
      return Math.round((busyRooms.size / stats.rooms) * 100);
    });

    const revenue = {};
    activeBookings.forEach(b => {
      revenue[b.type] = (revenue[b.type] || 0) + Number(b.total);
    });
    const maxRevenue = Math.max(1, ...Object.values(revenue));

    const movements = D.bookings.filter(b =>
      (b.check_in === TODAY && b.status === 'confirmed') ||
      (b.check_out === TODAY && b.status === 'checked_in')
    );

    const dateLabel = new Date().toLocaleDateString('ro-RO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const chartHtml = occupancy
      .map((value, i) => `
        <div title="${days[i]}: ${value}%">
          <i style="height:${Math.max(value, 3)}%"></i>
          <span>${days[i].slice(8)}</span>
        </div>
      `)
      .join('');

    const revenueHtml =
      Object.entries(revenue)
        .map(([type, value]) => `
          <div>
            <p><span>${esc(type)}</span><span>${money(value)}</span></p>
            <i style="width:${(value / maxRevenue) * 100}%"></i>
          </div>
        `)
        .join('') || 'Încă nu există rezervări.';

    const movementsHtml = movements.length
      ? tbl(
          ['Oaspete', 'Cameră', 'Tip', 'Acțiune'],
          movements.map(m => [
            esc(m.guest),
            esc(m.room),
            m.check_in === TODAY && m.status === 'confirmed' ? 'Sosire' : 'Plecare',
            bookingBtns(m)
          ])
        )
      : '<div class="empty">Nicio sosire sau plecare programată azi.</div>';

    return `
      <h1>Bună ziua</h1>
      <p class="sub">${dateLabel}</p>

      <div class="stats">
        <div class="stat hero">
          <b>${percent}%</b>
          <span>ocupare acum · ${stats.occupied} din ${stats.rooms} camere</span>
        </div>
        <div class="stat"><b>${stats.arrivals}</b><span>sosiri azi</span></div>
        <div class="stat"><b>${stats.departures}</b><span>plecări azi</span></div>
        <div class="stat"><b>${money(stats.revenue)}</b><span>venit luna aceasta</span></div>
      </div>

      <div class="two">
        <div>
          <h3>Ocupare în următoarele 14 zile</h3>
          <div class="panel"><div class="chart">${chartHtml}</div></div>
        </div>
        <div>
          <h3>Venit pe tip de cameră</h3>
          <div class="panel"><div class="rev">${revenueHtml}</div></div>
        </div>
      </div>

      <h3>Mișcări de azi</h3>
      ${movementsHtml}
    `;
  },

  calendar() {
    const days = range(14).map(i => addDays(tl, i));

    const rowsHtml = D.rooms
      .map(room => {
        const bars = live()
          .filter(b =>
            b.room_id === room.id &&
            b.check_out > days[0] &&
            b.check_in <= days[13]
          )
          .map(b => {
            const start = Math.max(0, dayIdx(b.check_in, tl)) + 1;
            const end = Math.min(14, dayIdx(b.check_out, tl)) + 1;
            return `
              <div class="tl-bar ${b.status}"
                style="grid-column:${start}/${end}"
                title="${esc(b.guest)} · ${b.check_in} → ${b.check_out}">${esc(b.guest)}</div>
            `;
          })
          .join('');

        return `
          <div class="tl-row">
            <div class="tl-room">${esc(room.number)}</div>
            <div class="tl-days">${bars}</div>
          </div>
        `;
      })
      .join('');

    const headDays = days
      .map(day => {
        const weekday = new Date(day).toLocaleDateString('ro-RO', {
          weekday: 'short',
          timeZone: 'UTC'
        });
        return `
          <span class="${day === TODAY ? 'today' : ''}">
            ${day.slice(8)}<small>${weekday}</small>
          </span>
        `;
      })
      .join('');

    return `
      <h2>Calendar</h2>

      <div class="bar">
        <button class="btn ghost sm" onclick="tl=addDays(tl,-7);show('calendar')">‹ Săptămâna trecută</button>
        <button class="btn ghost sm" onclick="tl=TODAY;show('calendar')">Azi</button>
        <button class="btn ghost sm" onclick="tl=addDays(tl,7);show('calendar')">Săptămâna viitoare ›</button>
      </div>

      <div class="tl">
        <div>
          <div class="tl-row tl-head">
            <div class="tl-room">Cameră</div>
            <div class="tl-days">${headDays}</div>
          </div>
          ${rowsHtml}
        </div>
      </div>
    `;
  },

  rooms() {
    const filterChips = chips(
      'rs',
      [['', 'Toate'], ...Object.entries(ST)],
      "show('rooms')"
    );

    const cards = D.rooms
      .filter(room => !F.rs || room.status === F.rs)
      .map(room => {
        const options = Object.entries(ST)
          .map(([value, label]) =>
            `<option value="${value}" ${value === room.status ? 'selected' : ''}>${label}</option>`
          )
          .join('');

        const bookButton = room.status !== 'maintenance'
          ? `<button class="btn sm" onclick="bookingDlg(${room.id})">Rezervă</button>`
          : '';

        return `
          <div class="room">
            <b>${esc(room.number)}</b>
            <span>${esc(room.type)}</span>
            <small>Etaj ${room.floor} · ${room.capacity} persoane</small>
            <small>${money(room.price)} / noapte</small>
            <div class="row">
              <select aria-label="Status camera ${esc(room.number)}"
                onchange="act(()=>api('/rooms/${room.id}','PATCH',{status:this.value}),'Status actualizat')">
                ${options}
              </select>
              ${bookButton}
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <h2>Camere</h2>
      <div class="bar">${filterChips}</div>
      <div class="grid">${cards}</div>
    `;
  },

  bookings() {
    const statusChips = chips(
      'bs',
      [['', 'Toate'], ...Object.entries(BS)],
      "show('bookings')"
    );

    return `
      <h2>Rezervări</h2>

      <div class="bar">
        <input class="search" id="bq" placeholder="Caută oaspete sau cameră"
          value="${esc(F.bq)}" oninput="F.bq=this.value;list('bookings')">
        <div class="sp"></div>
        <button class="btn" onclick="bookingDlg()">Rezervare nouă</button>
      </div>

      <div class="bar">${statusChips}</div>

      <div id="list">${bookingList()}</div>
    `;
  },

  guests() {
    return `
      <h2>Oaspeți</h2>

      <div class="bar">
        <input class="search" id="gq" placeholder="Caută după nume sau email"
          value="${esc(F.gq)}" oninput="F.gq=this.value;list('guests')">
        <div class="sp"></div>
        <button class="btn" onclick="guestDlg()">Oaspete nou</button>
      </div>

      <div id="list">${guestList()}</div>
    `;
  }
};


function bookingList() {
  const query = F.bq.toLowerCase();

  const filtered = D.bookings.filter(b => {
    const statusOk = !F.bs || b.status === F.bs;
    const queryOk = !query || b.guest.toLowerCase().includes(query) || b.room.includes(query);
    return statusOk && queryOk;
  });

  if (!filtered.length) {
    return '<div class="empty">Nicio rezervare găsită. Creează una cu butonul „Rezervare nouă”.</div>';
  }

  return tbl(
    ['Oaspete', 'Cameră', 'Perioadă', '>Total', 'Status', 'Acțiuni'],
    filtered.map(b => [
      esc(b.guest),
      `${esc(b.room)} · ${esc(b.type)}`,
      `${b.check_in} → ${b.check_out}`,
      money(b.total),
      `<span class="tag ${b.status}">${BS[b.status]}</span>`,
      bookingBtns(b)
    ])
  );
}

function guestList() {
  const query = F.gq.toLowerCase();

  const filtered = D.guests.filter(g =>
    !query ||
    g.full_name.toLowerCase().includes(query) ||
    (g.email || '').toLowerCase().includes(query)
  );

  if (!filtered.length) {
    return '<div class="empty">Niciun oaspete găsit.</div>';
  }

  return tbl(
    ['Nume', 'Contact', 'Țara', '>Sejururi', '>Total cheltuit'],
    filtered.map(g => {
      const stays = live().filter(b => b.guest_id === g.id);
      const spent = stays.reduce((sum, b) => sum + Number(b.total), 0);
      return [
        esc(g.full_name),
        esc(g.email || g.phone || '—'),
        esc(g.country || '—'),
        stays.length,
        money(spent)
      ];
    })
  );
}

function list(viewName) {
  $('#list').innerHTML = viewName === 'bookings' ? bookingList() : guestList();
}


function bookingDlg(roomId) {
  if (!D.guests.length) {
    return toast('Adaugă mai întâi un oaspete.', true);
  }

  const guestOptions = D.guests
    .map(g => `<option value="${g.id}">${esc(g.full_name)}</option>`)
    .join('');

  const roomOptions = D.rooms
    .filter(r => r.status !== 'maintenance')
    .map(r => `
      <option value="${r.id}" ${r.id === roomId ? 'selected' : ''}>
        ${esc(r.number)} · ${esc(r.type)} · ${money(r.price)}
      </option>
    `)
    .join('');

  const dialog = $('#dlg');

  dialog.innerHTML = `
    <form onsubmit="event.preventDefault();act(()=>api('/bookings','POST',Object.fromEntries(new FormData(this))),'Rezervare creată',true)">
      <h2>Rezervare nouă</h2>

      <label>Oaspete
        <select name="guest_id">${guestOptions}</select>
      </label>

      <label>Cameră
        <select name="room_id" onchange="est()">${roomOptions}</select>
      </label>

      <div class="two2">
        <label>Sosire
          <input type="date" name="check_in" value="${TODAY}" min="${TODAY}" required onchange="est()">
        </label>
        <label>Plecare
          <input type="date" name="check_out" value="${addDays(TODAY, 1)}" required onchange="est()">
        </label>
      </div>

      <div class="est" id="est"></div>

      <div class="actions">
        <button type="button" class="btn ghost" onclick="$('#dlg').close()">Renunță</button>
        <button class="btn">Creează rezervarea</button>
      </div>
    </form>
  `;

  dialog.showModal();
  est();
}

function est() {
  const form = $('#dlg form');
  const room = D.rooms.find(r => r.id == form.room_id.value);
  const nights = dayIdx(form.check_out.value, form.check_in.value);

  $('#est').textContent = nights > 0 && room
    ? `${nights} ${nights === 1 ? 'noapte' : 'nopți'} · ${money(nights * room.price)}`
    : 'Data de plecare trebuie să fie după sosire.';
}

function guestDlg() {
  const dialog = $('#dlg');

  dialog.innerHTML = `
    <form onsubmit="event.preventDefault();act(()=>api('/guests','POST',Object.fromEntries(new FormData(this))),'Oaspete adăugat',true)">
      <h2>Oaspete nou</h2>

      <label>Nume complet
        <input name="full_name" required>
      </label>

      <label>Email
        <input type="email" name="email">
      </label>

      <div class="two2">
        <label>Telefon
          <input name="phone">
        </label>
        <label>Țara
          <input name="country">
        </label>
      </div>

      <div class="actions">
        <button type="button" class="btn ghost" onclick="$('#dlg').close()">Renunță</button>
        <button class="btn">Adaugă oaspetele</button>
      </div>
    </form>
  `;

  dialog.showModal();
}


async function show(viewName) {
  view = viewName;

  document.querySelectorAll('#nav button').forEach(button => {
    button.setAttribute('aria-current', button.dataset.view === viewName);
  });

  try {
    await load();
    $('#app').innerHTML = views[viewName]();
  } catch (error) {
    $('#app').innerHTML = `
      <div class="empty">
        Nu m-am putut conecta la server: ${esc(error.message)}.
        Verifică dacă MySQL rulează și dacă fișierul .env este configurat.
      </div>
    `;
  }
}

document.querySelectorAll('#nav button').forEach(button => {
  button.onclick = () => {
    show(button.dataset.view);
    window.scrollTo(0, 0);
  };
});

show('overview');