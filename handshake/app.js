let bookedDates = new Set([]);
let pendingDates = new Set([]);
let view = new Date();
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

async function fetchStatus() {
  try {
    const res = await fetch('/api/booking/dates');
    const data = await res.json();
    if (data.success) {
      bookedDates = new Set(data.booked || []);
      pendingDates = new Set(data.pending || []);
      view = new Date();
    }
  } catch (e) {}
  renderCalendar();
}

function moveMonth(delta) {
  view.setMonth(view.getMonth() + delta);
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const title = document.getElementById('monthDisplay');
  grid.innerHTML = '';
  const y = view.getFullYear();
  const m = view.getMonth();
  title.textContent = `${MONTHS[m]} ${y}`;

  WEEKDAYS.forEach((d) => {
    const el = document.createElement('div');
    el.className = 'weekday';
    if (d === 'SUN' || d === 'SAT') el.classList.add('weekend');
    grid.appendChild(el);
  });

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'day empty';
    grid.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    const dateObj = new Date(y, m, d);
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    el.className = 'day';

    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
      el.classList.add('weekend');
    }

    el.textContent = d;

    if (dateObj < today) el.classList.add('past');
    else if (bookedDates.has(dateStr)) el.classList.add('is-booked');
    else if (pendingDates.has(dateStr)) el.classList.add('is-pending');

    grid.appendChild(el);
  }
}
fetchStatus();
