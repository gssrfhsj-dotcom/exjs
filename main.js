/* =====================================================
   WANDERLUST - main.js  (OOP + History API routing)
   Classes: ApiService, PlansStorage, UI, Router, View (+ 8 views), App
   ===================================================== */
'use strict';

/* ==================== CONFIG ==================== */
const CONFIG = {
  NAGER: 'https://date.nager.at/api/v3',
  COUNTRIES: 'https://restcountries.com/v3.1',
  METEO: 'https://api.open-meteo.com/v1/forecast',
  GEO: 'https://geocoding-api.open-meteo.com/v1/search',
  CITIES: 'https://countriesnow.space/api/v0.1/countries/cities',
  SUN: 'https://api.sunrise-sunset.org/json',
  TICKETMASTER: 'https://app.ticketmaster.com/discovery/v2/events.json',
  TICKETMASTER_KEY: '', // <-- حط الـ API key بتاع Ticketmaster من الـ Postman هنا
  RATES: 'https://open.er-api.com/v6/latest/USD', // free, no key
  EXCHANGE_KEY: '', // <-- لو الـ Postman بيستخدم v6.exchangerate-api.com حط الـ key هنا
  STORAGE_KEY: 'wanderlust_plans',
};

const ROUTES = {
  '/dashboard': 'dashboard',
  '/holidays': 'holidays',
  '/events': 'events',
  '/weather': 'weather',
  '/long-weekends': 'long-weekends',
  '/currency': 'currency',
  '/sun-times': 'sun-times',
  '/plans': 'my-plans',
};

const META = {
  dashboard: ['Dashboard', 'Welcome back! Ready to plan your next adventure?'],
  holidays: ['Holidays', 'Explore public holidays and plan around them'],
  events: ['Events', 'Concerts, sports, theatre and more'],
  weather: ['Weather', '7-day forecast for your destination'],
  'long-weekends': ['Long Weekends', 'Find the best windows for a mini-trip'],
  currency: ['Currency Converter', 'Live exchange rates at your fingertips'],
  'sun-times': ['Sun Times', 'Sunrise, sunset and golden hour'],
  'my-plans': ['My Plans', 'Your saved holidays, events and long weekends'],
};

/* ==================== HELPERS ==================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const flagUrl = (cc, w = 40) => `https://flagcdn.com/w${w}/${cc.toLowerCase()}.png`;
const flagEmoji = (cc) => cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');
const num = (n) => Number(n).toLocaleString('en-US');
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

// 'YYYY-MM-DD' -> local Date (avoids timezone shifting)
const parseDate = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDate = (d, opts) => d.toLocaleDateString('en-US', opts);
const clock12 = (iso) => {
  const [h, m] = iso.slice(11, 16).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const hourLabel = (iso) => {
  const h = Number(iso.slice(11, 13));
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
};

const loadingBox = (msg) =>
  `<div class="country-info-loading" style="grid-column:1/-1"><i class="fa-solid fa-spinner fa-spin"></i><span>${esc(msg)}</span></div>`;

const placeholderBox = (icon, msg, { error = false, action = '' } = {}) =>
  `<div class="country-info-placeholder" style="grid-column:1/-1;margin:0 auto">
     <div class="placeholder-icon ${error ? 'error' : ''}"><i class="fa-solid ${icon}"></i></div>
     <p>${esc(msg)}</p>${action}
   </div>`;

const goDashboardBtn =
  '<button class="btn-primary" data-nav="dashboard" style="margin-top:16px;padding:10px 20px;border-radius:12px"><i class="fa-solid fa-compass"></i> Go to Dashboard</button>';

// WMO weather codes -> label / icon / hero style
const weatherInfo = (code) => {
  if (code === 0) return { label: 'Clear sky', icon: 'fa-sun', cls: 'sunny' };
  if (code === 1) return { label: 'Mainly clear', icon: 'fa-cloud-sun', cls: 'sunny' };
  if (code === 2) return { label: 'Partly cloudy', icon: 'fa-cloud-sun', cls: 'sunny' };
  if (code === 3) return { label: 'Overcast', icon: 'fa-cloud', cls: 'cloudy' };
  if (code === 45 || code === 48) return { label: 'Foggy', icon: 'fa-smog', cls: 'foggy' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'fa-cloud-rain', cls: 'rainy' };
  if (code >= 61 && code <= 67) return { label: 'Rain', icon: 'fa-cloud-showers-heavy', cls: 'rainy' };
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'fa-snowflake', cls: 'snowy' };
  if (code >= 80 && code <= 82) return { label: 'Rain showers', icon: 'fa-cloud-showers-heavy', cls: 'rainy' };
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'fa-snowflake', cls: 'snowy' };
  if (code >= 95) return { label: 'Thunderstorm', icon: 'fa-bolt', cls: 'stormy' };
  return { label: 'Unknown', icon: 'fa-cloud', cls: 'default' };
};

const uvLevel = (uv) => {
  if (uv < 3) return ['Low', 'low'];
  if (uv < 6) return ['Moderate', 'moderate'];
  if (uv < 8) return ['High', 'high'];
  if (uv < 11) return ['Very High', 'very-high'];
  return ['Extreme', 'extreme'];
};

const CURRENCY_FLAGS = {
  USD: 'us', EUR: 'eu', GBP: 'gb', EGP: 'eg', AED: 'ae', SAR: 'sa', JPY: 'jp', CAD: 'ca', INR: 'in',
};

/* ==================== API SERVICE ==================== */
class ApiService {
  constructor() {
    this.cache = new Map();
  }

  async request(url, options = {}) {
    const key = url + (options.body || '');
    if (this.cache.has(key)) return this.cache.get(key);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      this.cache.set(key, data);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async getCountries() {
    const list = await this.request(`${CONFIG.NAGER}/AvailableCountries`);
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }

  getHolidays(year, code) {
    return this.request(`${CONFIG.NAGER}/PublicHolidays/${year}/${code}`);
  }

  getLongWeekends(year, code) {
    return this.request(`${CONFIG.NAGER}/LongWeekend/${year}/${code}`);
  }

  async getCountry(code) {
    const urls = [`${CONFIG.COUNTRIES}/alpha/${code}`, `${CONFIG.COUNTRIES}/alpha?codes=${code}`];
    for (const url of urls) {
      try {
        const data = await this.request(url);
        const c = Array.isArray(data) ? data[0] : data;
        if (c?.name) return c;
      } catch (e) {
        console.warn('REST Countries failed:', url, e.message);
      }
    }
    // Fallback: build a minimal country object from Nager so the app still works
    const n = await this.request(`${CONFIG.NAGER}/CountryInfo/${code}`);
    return {
      cca2: n.countryCode,
      name: { common: n.commonName, official: n.officialName },
      region: n.region || '—',
      subregion: '',
      capital: [],
      population: 0,
      area: 0,
      borders: (n.borders || []).map((b) => b.countryCode),
      flags: {},
      fallback: true,
    };
  }

  async getCities(countryName, capital) {
    let cities = [];
    try {
      const data = await this.request(CONFIG.CITIES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryName }),
      });
      cities = data.data || [];
    } catch (e) {
      /* fall back to capital only */
    }
    const set = new Set(cities);
    if (capital) set.delete(capital);
    const sorted = [...set].sort((a, b) => a.localeCompare(b)).slice(0, 300);
    return capital ? [capital, ...sorted] : sorted;
  }

  async geocode(city, code) {
    const url = `${CONFIG.GEO}?name=${encodeURIComponent(city)}&count=1&language=en&country_code=${code}`;
    const data = await this.request(url);
    return data.results?.[0] || null;
  }

  getWeather(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
      hourly: 'temperature_2m,weather_code,precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset',
      timezone: 'auto',
      forecast_days: 7,
    });
    return this.request(`${CONFIG.METEO}?${params}`);
  }

  async getEvents(city, code, year) {
    if (!CONFIG.TICKETMASTER_KEY) throw new Error('No Ticketmaster key');
    const params = new URLSearchParams({
      apikey: CONFIG.TICKETMASTER_KEY,
      city,
      countryCode: code,
      size: 20,
      sort: 'date,asc',
      startDateTime: `${year}-01-01T00:00:00Z`,
      endDateTime: `${year}-12-31T23:59:59Z`,
    });
    const data = await this.request(`${CONFIG.TICKETMASTER}?${params}`);
    const events = data._embedded?.events || [];
    return events.map((e) => {
      const img = [...(e.images || [])].sort((a, b) => a.width - b.width).find((i) => i.width >= 300) || e.images?.[0];
      const date = e.dates?.start?.localDate;
      const time = e.dates?.start?.localTime?.slice(0, 5);
      return {
        id: e.id,
        title: e.name,
        category: e.classifications?.[0]?.segment?.name || 'Event',
        image: img?.url || '',
        dateText: date
          ? fmtDate(parseDate(date), { month: 'short', day: 'numeric', year: 'numeric' }) + (time ? ` at ${time}` : '')
          : 'Date TBA',
        venue: e._embedded?.venues?.[0]?.name || city,
        url: e.url || '#',
        mock: false,
      };
    });
  }

  getRates() {
    const url = CONFIG.EXCHANGE_KEY
      ? `https://v6.exchangerate-api.com/v6/${CONFIG.EXCHANGE_KEY}/latest/USD`
      : CONFIG.RATES;
    return this.request(url);
  }

  async getSunTimes(lat, lon, date) {
    const data = await this.request(`${CONFIG.SUN}?lat=${lat}&lng=${lon}&date=${date}&formatted=0`);
    if (data.status !== 'OK') throw new Error('Sun times unavailable');
    return data.results;
  }
}

/* ==================== MOCK EVENTS (fallback per the guide) ==================== */
function buildMockEvents(city, code, year) {
  const img = (id) => `https://images.unsplash.com/${id}?w=400&h=200&fit=crop`;
  const tpl = [
    [`Jazz Night Live in ${city}`, 'Music', 'photo-1493225457124-a3eb161ffa5f', 'Opera House', '20:00', 2, 15],
    [`Football Match in ${city}`, 'Sports', 'photo-1461896836934-ffe607ba8211', 'National Stadium', '19:00', 2, 22],
    [`Theatre Play in ${city}`, 'Arts', 'photo-1507676184212-d03ab07a01bf', 'Cultural Center', '21:00', 3, 5],
    [`Symphony Orchestra in ${city}`, 'Music', 'photo-1514320291840-2e0a9bf2a9ae', 'Opera House', '19:30', 3, 12],
    [`Open-Air Concert in ${city}`, 'Music', 'photo-1493225457124-a3eb161ffa5f', 'City Park', '18:00', 4, 18],
    [`Basketball Night in ${city}`, 'Sports', 'photo-1461896836934-ffe607ba8211', 'Sports Hall', '20:30', 5, 2],
  ];
  return tpl.map(([title, category, photo, venue, time, m, d], i) => ({
    id: `mock-${code}-${i}`,
    title,
    category,
    image: img(photo),
    dateText: `${fmtDate(new Date(year, m - 1, d), { month: 'short', day: 'numeric', year: 'numeric' })} at ${time}`,
    venue: `${venue}, ${city}`,
    url: '#',
    mock: true,
  }));
}

/* ==================== PLANS STORAGE (LocalStorage) ==================== */
class PlansStorage {
  constructor(key = CONFIG.STORAGE_KEY) {
    this.key = key;
  }
  all() {
    try {
      const data = JSON.parse(localStorage.getItem(this.key));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }
  save(list) {
    try {
      localStorage.setItem(this.key, JSON.stringify(list));
    } catch (e) {
      /* storage full / blocked */
    }
  }
  has(id) {
    return this.all().some((p) => p.id === id);
  }
  add(plan) {
    const list = this.all();
    if (!list.some((p) => p.id === plan.id)) {
      list.push({ ...plan, savedAt: Date.now() });
      this.save(list);
    }
  }
  remove(id) {
    this.save(this.all().filter((p) => p.id !== id));
  }
  clear() {
    this.save([]);
  }
  count() {
    return this.all().length;
  }
}

/* ==================== UI HELPERS ==================== */
class UI {
  constructor() {
    this.overlay = $('#loading-overlay');
    this.text = $('#loading-text');
    this.toasts = $('#toast-container');
  }

  loading(show, msg = 'Loading...') {
    this.text.textContent = msg;
    this.overlay.classList.toggle('hidden', !show);
  }

  toast(msg, type = 'info', ms = 3200) {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${esc(msg)}</span>
      <button class="toast-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>`;
    $('.toast-close', el).addEventListener('click', () => el.remove());
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  async confirm(title, text, confirmText = 'Yes, do it') {
    if (window.Swal) {
      const res = await Swal.fire({
        title,
        text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: confirmText,
        confirmButtonColor: '#dc2626',
      });
      return res.isConfirmed;
    }
    return window.confirm(`${title}\n${text}`);
  }
}

/* ==================== ROUTER (History API) ==================== */
class Router {
  constructor(routes, onChange) {
    this.routes = routes;
    this.onChange = onChange;
    // file:// can't use real paths, so fall back to #/path
    this.useHash = location.protocol === 'file:';
    window.addEventListener('popstate', () => this.resolve());
  }

  pathFor(key) {
    return Object.keys(this.routes).find((p) => this.routes[p] === key) || '/dashboard';
  }

  current() {
    const raw = this.useHash ? location.hash.slice(1) : location.pathname;
    return '/' + (raw.split('/').filter(Boolean).pop() || '');
  }

  resolve() {
    this.onChange(this.routes[this.current()] || 'dashboard');
  }

  navigate(key) {
    const path = this.pathFor(key);
    if (this.current() !== path) {
      try {
        history.pushState({ key }, '', this.useHash ? `#${path}` : path);
      } catch (e) {
        this.useHash = true;
        history.pushState({ key }, '', `#${path}`);
      }
    }
    this.onChange(key);
  }
}

/* ==================== BASE VIEW ==================== */
class View {
  constructor(app, key, containerSel = null) {
    this.app = app;
    this.key = key;
    this.containerSel = containerSel;
    this.loadedKey = null;
  }

  get el() {
    return document.getElementById(`${this.key}-view`);
  }
  get container() {
    return this.containerSel ? $(this.containerSel) : null;
  }
  get needsSelection() {
    return true;
  }
  subtitle() {
    return null;
  }
  stale(key) {
    return key !== this.app.selectionKey();
  }

  updateHeader() {
    const { country, city, year } = this.app.state;
    if (!country) return;
    const badge = $('.current-selection-badge', this.el);
    if (badge) {
      const img = $('img', badge);
      img.src = flagUrl(country.code);
      img.alt = country.name;
      $('span', badge).textContent = country.name;
      const c = $('.selection-city', badge);
      if (c) c.textContent = `• ${city}`;
      const y = $('.selection-year', badge);
      if (y) y.textContent = year;
    }
    const p = $('.view-header-content p', this.el);
    const sub = this.subtitle(country.name, city);
    if (p && sub) p.textContent = sub;
  }

  showPrompt() {
    if (this.container)
      this.container.innerHTML = placeholderBox('fa-earth-americas', 'Pick a country, city and year from the Dashboard first.', {
        action: goDashboardBtn,
      });
  }

  showError(err) {
    if (this.container)
      this.container.innerHTML = placeholderBox('fa-triangle-exclamation', err?.message || 'Something went wrong. Please try again.', {
        error: true,
      });
  }

  async enter() {
    this.updateHeader();
    if (this.needsSelection && !this.app.state.country) {
      this.loadedKey = null;
      this.showPrompt();
      return;
    }
    const key = this.app.selectionKey();
    if (this.loadedKey !== key) {
      this.loadedKey = key;
      try {
        await this.load(key);
      } catch (err) {
        this.loadedKey = null;
        if (!this.stale(key)) this.showError(err);
      }
    }
    this.app.syncSaved(this.el);
  }

  async load() {}
}

/* ==================== DASHBOARD ==================== */
class DashboardView extends View {
  constructor(app) {
    super(app, 'dashboard', '#dashboard-country-info');
  }
  get needsSelection() {
    return true;
  }
  updateHeader() {}

  showPrompt() {
    this.container.innerHTML = placeholderBox('fa-earth-americas', 'Select a country above and press Explore to see its details.');
    ['#stat-holidays', '#stat-events'].forEach((s) => ($(s).textContent = '—'));
  }

  async load(key) {
    const { country, year, info } = this.app.state;
    this.container.innerHTML = this.renderInfo(info);
    this.app.tickClock();

    const [hol, ev] = await Promise.allSettled([this.app.api.getHolidays(year, country.code), this.app.loadEvents()]);
    if (this.stale(key)) return;
    $('#stat-holidays').textContent = hol.status === 'fulfilled' ? hol.value.length : '—';
    $('#stat-events').textContent = ev.status === 'fulfilled' ? ev.value.list.length : '—';
  }

  renderInfo(c) {
    const currencies = Object.entries(c.currencies || {}).map(([code, v]) => `${v.name} (${code}${v.symbol ? ' ' + v.symbol : ''})`);
    const languages = Object.values(c.languages || {});
    const borders = c.borders || [];
    const calling = c.idd?.root ? c.idd.root + (c.idd.suffixes?.length === 1 ? c.idd.suffixes[0] : '') : '—';
    const tags = (arr, empty) =>
      arr.length ? arr.map((t) => `<span class="extra-tag">${esc(t)}</span>`).join('') : `<span class="extra-tag">${empty}</span>`;
    const detail = (icon, label, value) =>
      `<div class="dashboard-country-detail"><i class="fa-solid ${icon}"></i><span class="label">${label}</span><span class="value">${esc(value)}</span></div>`;

    return `
      <div class="dashboard-country-header">
        <img src="${c.flags?.png || flagUrl(c.cca2, 160)}" alt="${esc(c.name.common)}" class="dashboard-country-flag">
        <div class="dashboard-country-title">
          <h3>${esc(c.name.common)}</h3>
          <p class="official-name">${esc(c.name.official)}</p>
          <span class="region"><i class="fa-solid fa-location-dot"></i> ${esc(c.region)}${c.subregion ? ' • ' + esc(c.subregion) : ''}</span>
        </div>
      </div>

      <div class="dashboard-local-time">
        <div class="local-time-display">
          <i class="fa-solid fa-clock"></i>
          <span class="local-time-value" id="country-local-time">--:--:--</span>
          <span class="local-time-zone">${esc(c.timezones?.[0] || 'UTC')}</span>
        </div>
      </div>

      <div class="dashboard-country-grid">
        ${detail('fa-building-columns', 'Capital', c.capital?.[0] || '—')}
        ${detail('fa-users', 'Population', num(c.population))}
        ${detail('fa-ruler-combined', 'Area', `${num(c.area)} km²`)}
        ${detail('fa-globe', 'Continent', c.continents?.[0] || c.region)}
        ${detail('fa-phone', 'Calling Code', calling)}
        ${detail('fa-car', 'Driving Side', cap(c.car?.side))}
        ${detail('fa-calendar-week', 'Week Starts', cap(c.startOfWeek))}
      </div>

      <div class="dashboard-country-extras">
        <div class="dashboard-country-extra">
          <h4><i class="fa-solid fa-coins"></i> Currency</h4>
          <div class="extra-tags">${tags(currencies, 'N/A')}</div>
        </div>
        <div class="dashboard-country-extra">
          <h4><i class="fa-solid fa-language"></i> Languages</h4>
          <div class="extra-tags">${tags(languages, 'N/A')}</div>
        </div>
        <div class="dashboard-country-extra">
          <h4><i class="fa-solid fa-map-location-dot"></i> Neighbors</h4>
          <div class="extra-tags">
            ${
              borders.length
                ? borders.map((b) => `<span class="extra-tag border-tag" data-border="${esc(b)}">${esc(b)}</span>`).join('')
                : '<span class="extra-tag">No land borders</span>'
            }
          </div>
        </div>
      </div>

      <div class="dashboard-country-actions">
        <a href="${esc(c.maps?.googleMaps || '#')}" target="_blank" rel="noopener" class="btn-map-link">
          <i class="fa-solid fa-map"></i> View on Google Maps
        </a>
      </div>`;
  }
}

/* ==================== HOLIDAYS ==================== */
class HolidaysView extends View {
  constructor(app) {
    super(app, 'holidays', '#holidays-content');
  }
  subtitle(country) {
    return `Browse public holidays for ${country} and plan your trips around them`;
  }

  async load(key) {
    this.container.innerHTML = loadingBox('Loading holidays...');
    const { country, year } = this.app.state;
    const list = await this.app.api.getHolidays(year, country.code);
    if (this.stale(key)) return;

    if (!list.length) {
      this.container.innerHTML = placeholderBox('fa-calendar-xmark', `No public holidays found for ${country.name} in ${year}.`);
      return;
    }

    this.container.innerHTML = list
      .map((h) => {
        const d = parseDate(h.date);
        const id = `holiday-${country.code}-${h.date}-${slug(h.name)}`;
        this.app.register({
          id,
          type: 'holiday',
          title: h.localName || h.name,
          subtitle: h.name,
          date: fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
          place: country.name,
        });
        return `
          <div class="holiday-card">
            <div class="holiday-card-header">
              <div class="holiday-date-box"><span class="day">${d.getDate()}</span><span class="month">${fmtDate(d, { month: 'short' })}</span></div>
              ${this.app.saveBtn('holiday-action-btn', id)}
            </div>
            <h3>${esc(h.localName || h.name)}</h3>
            <p class="holiday-name">${esc(h.name)}</p>
            <div class="holiday-card-footer">
              <span class="holiday-day-badge"><i class="fa-regular fa-calendar"></i> ${fmtDate(d, { weekday: 'long' })}</span>
              <span class="holiday-type-badge">${esc(h.types?.[0] || 'Public')}</span>
            </div>
          </div>`;
      })
      .join('');
  }
}

/* ==================== EVENTS ==================== */
class EventsView extends View {
  constructor(app) {
    super(app, 'events', '#events-content');
  }
  subtitle(country, city) {
    return `Discover concerts, sports, theatre and more in ${city}`;
  }

  async load(key) {
    this.container.innerHTML = loadingBox('Finding events...');
    const { list, mock } = await this.app.loadEvents();
    if (this.stale(key)) return;
    const { country, city } = this.app.state;

    this.container.innerHTML = list
      .map((e) => {
        const id = `event-${e.id}`;
        this.app.register({
          id,
          type: 'event',
          title: e.title,
          subtitle: e.category,
          date: e.dateText,
          place: e.venue,
          country: country.name,
        });
        return `
          <div class="event-card">
            <div class="event-card-image">
              <img src="${esc(e.image)}" alt="${esc(e.title)}" onerror="this.style.visibility='hidden'">
              <span class="event-card-category">${esc(e.category)}</span>
              ${this.app.saveBtn('event-card-save', id)}
            </div>
            <div class="event-card-body">
              <h3>${esc(e.title)}</h3>
              <div class="event-card-info">
                <div><i class="fa-regular fa-calendar"></i>${esc(e.dateText)}</div>
                <div><i class="fa-solid fa-location-dot"></i>${esc(e.venue)}</div>
              </div>
              <div class="event-card-footer">
                ${this.app.saveBtn('btn-event', id)}
                <a href="${esc(e.url)}" target="_blank" rel="noopener" class="btn-buy-ticket"><i class="fa-solid fa-ticket"></i> Buy Tickets</a>
              </div>
            </div>
          </div>`;
      })
      .join('');

    if (mock) this.app.ui.toast(`Showing sample events for ${city} (no live events found).`, 'info', 4200);
  }
}

/* ==================== WEATHER ==================== */
class WeatherView extends View {
  constructor(app) {
    super(app, 'weather', '#weather-content');
  }
  subtitle(country, city) {
    return `Check 7-day weather forecasts for ${city}`;
  }

  async load(key) {
    this.container.innerHTML = loadingBox('Fetching forecast...');
    const { city } = this.app.state;
    const loc = await this.app.getLocation();
    const w = await this.app.api.getWeather(loc.lat, loc.lon);
    if (this.stale(key)) return;

    const cur = w.current;
    const d = w.daily;
    const h = w.hourly;
    const info = weatherInfo(cur.weather_code);
    const [uvText, uvCls] = uvLevel(d.uv_index_max[0]);
    const precipToday = d.precipitation_probability_max[0] ?? 0;
    const t = (s) => new Date(s).getTime();
    const sunProgress = clamp(((t(cur.time) - t(d.sunrise[0])) / (t(d.sunset[0]) - t(d.sunrise[0]))) * 100, 0, 100);

    // hourly: from the current hour, next 24 hours
    const start = Math.max(0, h.time.findIndex((x) => x.startsWith(cur.time.slice(0, 13))));
    const hourly = h.time
      .slice(start, start + 24)
      .map((time, i) => {
        const idx = start + i;
        const p = h.precipitation_probability[idx];
        return `
          <div class="hourly-item ${i === 0 ? 'now' : ''}">
            <span class="hourly-time">${i === 0 ? 'Now' : hourLabel(time)}</span>
            <div class="hourly-icon"><i class="fa-solid ${weatherInfo(h.weather_code[idx]).icon}"></i></div>
            <span class="hourly-temp">${Math.round(h.temperature_2m[idx])}°</span>
            ${p >= 20 ? `<span class="hourly-precip"><i class="fa-solid fa-droplet"></i>${p}%</span>` : ''}
          </div>`;
      })
      .join('');

    const days = d.time
      .map((day, i) => {
        const date = parseDate(day);
        const p = d.precipitation_probability_max[i];
        return `
          <div class="forecast-day ${i === 0 ? 'today' : ''}">
            <div class="forecast-day-name">
              <span class="day-label">${i === 0 ? 'Today' : fmtDate(date, { weekday: 'short' })}</span>
              <span class="day-date">${date.getDate()} ${fmtDate(date, { month: 'short' })}</span>
            </div>
            <div class="forecast-icon"><i class="fa-solid ${weatherInfo(d.weather_code[i]).icon}"></i></div>
            <div class="forecast-temps">
              <span class="temp-max">${Math.round(d.temperature_2m_max[i])}°</span>
              <span class="temp-min">${Math.round(d.temperature_2m_min[i])}°</span>
            </div>
            <div class="forecast-precip">${p >= 10 ? `<i class="fa-solid fa-droplet"></i><span>${p}%</span>` : ''}</div>
            <div class="forecast-precip"><i class="fa-solid fa-wind"></i><span>${Math.round(d.wind_speed_10m_max[i])} km/h</span></div>
          </div>`;
      })
      .join('');

    this.container.innerHTML = `
      <div class="weather-hero-card weather-${info.cls}">
        <div class="weather-hero-bg"></div>
        <div class="weather-hero-content">
          <div class="weather-location">
            <i class="fa-solid fa-location-dot"></i>
            <span>${esc(city)}</span>
            <span class="weather-time">${fmtDate(parseDate(cur.time), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div class="weather-hero-main">
            <div class="weather-hero-left">
              <div class="weather-hero-icon"><i class="fa-solid ${info.icon}"></i></div>
              <div class="weather-hero-temp">
                <span class="temp-value">${Math.round(cur.temperature_2m)}</span>
                <span class="temp-unit">°C</span>
              </div>
            </div>
            <div class="weather-hero-right">
              <div class="weather-condition">${info.label}</div>
              <div class="weather-feels">Feels like ${Math.round(cur.apparent_temperature)}°C</div>
              <div class="weather-high-low">
                <span class="high"><i class="fa-solid fa-arrow-up"></i> ${Math.round(d.temperature_2m_max[0])}°</span>
                <span class="low"><i class="fa-solid fa-arrow-down"></i> ${Math.round(d.temperature_2m_min[0])}°</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="weather-details-grid">
        <div class="weather-detail-card">
          <div class="detail-icon humidity"><i class="fa-solid fa-droplet"></i></div>
          <div class="detail-info">
            <span class="detail-label">Humidity</span>
            <span class="detail-value">${cur.relative_humidity_2m}%</span>
          </div>
          <div class="detail-bar"><div class="detail-bar-fill" style="width:${cur.relative_humidity_2m}%"></div></div>
        </div>
        <div class="weather-detail-card">
          <div class="detail-icon wind"><i class="fa-solid fa-wind"></i></div>
          <div class="detail-info">
            <span class="detail-label">Wind</span>
            <span class="detail-value">${Math.round(cur.wind_speed_10m)} km/h</span>
          </div>
        </div>
        <div class="weather-detail-card">
          <div class="detail-icon uv"><i class="fa-solid fa-sun"></i></div>
          <div class="detail-info">
            <span class="detail-label">UV Index</span>
            <span class="detail-value">${Math.round(d.uv_index_max[0])}</span>
          </div>
          <span class="uv-level ${uvCls}">${uvText}</span>
        </div>
        <div class="weather-detail-card">
          <div class="detail-icon precip"><i class="fa-solid fa-cloud-rain"></i></div>
          <div class="detail-info">
            <span class="detail-label">Precipitation</span>
            <span class="detail-value">${precipToday}%</span>
          </div>
        </div>
        <div class="weather-detail-card sunrise-sunset">
          <div class="sun-times-visual">
            <div class="sun-time sunrise"><i class="fa-solid fa-sun"></i><span class="sun-label">Sunrise</span><span class="sun-value">${clock12(d.sunrise[0])}</span></div>
            <div class="sun-arc"><div class="sun-arc-path"></div><div class="sun-position" style="--sun-progress:${sunProgress.toFixed(0)}%"></div></div>
            <div class="sun-time sunset"><i class="fa-solid fa-sun"></i><span class="sun-label">Sunset</span><span class="sun-value">${clock12(d.sunset[0])}</span></div>
          </div>
        </div>
      </div>

      <div class="weather-section">
        <h3 class="weather-section-title"><i class="fa-solid fa-clock"></i> Hourly Forecast</h3>
        <div class="hourly-scroll">${hourly}</div>
      </div>

      <div class="weather-section">
        <h3 class="weather-section-title"><i class="fa-solid fa-calendar-week"></i> 7-Day Forecast</h3>
        <div class="forecast-list">${days}</div>
      </div>`;
  }
}

/* ==================== LONG WEEKENDS ==================== */
class LongWeekendsView extends View {
  constructor(app) {
    super(app, 'long-weekends', '#lw-content');
  }

  async load(key) {
    this.container.innerHTML = loadingBox('Looking for long weekends...');
    const { country, year } = this.app.state;
    const [lwRes, holRes] = await Promise.allSettled([
      this.app.api.getLongWeekends(year, country.code),
      this.app.api.getHolidays(year, country.code),
    ]);
    if (this.stale(key)) return;
    if (lwRes.status === 'rejected') throw lwRes.reason;

    const list = lwRes.value;
    const holidayDates = new Set(holRes.status === 'fulfilled' ? holRes.value.map((h) => h.date) : []);

    if (!list.length) {
      this.container.innerHTML = placeholderBox('fa-umbrella-beach', `No long weekends found for ${country.name} in ${year}.`);
      return;
    }

    this.container.innerHTML = list
      .map((lw, i) => {
        const start = parseDate(lw.startDate);
        const end = parseDate(lw.endDate);
        const days = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));

        const id = `longweekend-${country.code}-${lw.startDate}-${lw.endDate}`;
        const range = `${fmtDate(start, { month: 'short', day: 'numeric' })} - ${fmtDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
        this.app.register({
          id,
          type: 'longweekend',
          title: `Long Weekend #${i + 1} (${lw.dayCount} days)`,
          subtitle: lw.needBridgeDays ? 'Needs a bridge day' : 'No extra days off needed',
          date: range,
          place: country.name,
        });

        return `
          <div class="lw-card">
            <div class="lw-card-header">
              <span class="lw-badge"><i class="fa-solid fa-calendar-days"></i> ${lw.dayCount} Days</span>
              ${this.app.saveBtn('holiday-action-btn', id)}
            </div>
            <h3>Long Weekend #${i + 1}</h3>
            <div class="lw-dates"><i class="fa-regular fa-calendar"></i> ${range}</div>
            ${
              lw.needBridgeDays
                ? '<div class="lw-info-box warning"><i class="fa-solid fa-info-circle"></i> Requires taking a bridge day off</div>'
                : '<div class="lw-info-box success"><i class="fa-solid fa-check-circle"></i> No extra days off needed!</div>'
            }
            <div class="lw-days-visual">
              ${days
                .map((d) => {
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  const holiday = holidayDates.has(toISO(d));
                  return `<div class="lw-day${weekend ? ' weekend' : ''}${holiday ? ' holiday' : ''}">
                    <span class="name">${fmtDate(d, { weekday: 'short' })}</span><span class="num">${d.getDate()}</span></div>`;
                })
                .join('')}
            </div>
          </div>`;
      })
      .join('');
  }
}

/* ==================== CURRENCY ==================== */
class CurrencyView extends View {
  constructor(app) {
    super(app, 'currency');
    this.rates = null;
    this.updated = '';
    this.names = new Intl.DisplayNames(['en'], { type: 'currency' });
    this.bind();
  }
  get needsSelection() {
    return false;
  }

  name(code) {
    try {
      return this.names.of(code) || code;
    } catch (e) {
      return code;
    }
  }

  bind() {
    $('#convert-btn').addEventListener('click', () => this.convert());
    $('#currency-amount').addEventListener('input', () => this.convert());
    $('#currency-from').addEventListener('change', () => {
      this.convert();
      this.renderPopular();
    });
    $('#currency-to').addEventListener('change', () => this.convert());
    $('#swap-currencies-btn').addEventListener('click', () => {
      const from = $('#currency-from');
      const to = $('#currency-to');
      [from.value, to.value] = [to.value, from.value];
      this.convert();
      this.renderPopular();
    });
    $('#popular-currencies').addEventListener('click', (e) => {
      const card = e.target.closest('[data-code]');
      if (!card) return;
      $('#currency-to').value = card.dataset.code;
      this.convert();
    });
  }

  async load() {
    if (!this.rates) {
      this.app.ui.loading(true, 'Fetching live rates...');
      try {
        const data = await this.app.api.getRates();
        this.rates = data.rates || data.conversion_rates;
        if (!this.rates) throw new Error('Could not read exchange rates');
        this.updated = data.time_last_update_utc ? new Date(data.time_last_update_utc) : new Date();
        this.populate();
      } finally {
        this.app.ui.loading(false);
      }
    }
    // default "to" currency = selected country's currency
    const code = Object.keys(this.app.state.info?.currencies || {})[0];
    if (code && this.rates[code]) $('#currency-to').value = code;
    this.convert();
    this.renderPopular();
  }

  showError(err) {
    this.app.ui.toast(err?.message || 'Could not load exchange rates', 'error');
  }

  populate() {
    const codes = Object.keys(this.rates).sort();
    const opts = codes.map((c) => `<option value="${c}">${c} - ${esc(this.name(c))}</option>`).join('');
    $('#currency-from').innerHTML = opts;
    $('#currency-to').innerHTML = opts;
    $('#currency-from').value = 'USD';
    $('#currency-to').value = this.rates.EGP ? 'EGP' : 'EUR';
  }

  convert() {
    if (!this.rates) return;
    const amount = parseFloat($('#currency-amount').value);
    const from = $('#currency-from').value;
    const to = $('#currency-to').value;
    if (!(amount >= 0) || !this.rates[from] || !this.rates[to]) return;

    const rate = this.rates[to] / this.rates[from];
    const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const rateTxt = rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

    $('#currency-result').innerHTML = `
      <div class="conversion-display">
        <div class="conversion-from"><span class="amount">${money(amount)}</span><span class="currency-code">${from}</span></div>
        <div class="conversion-equals"><i class="fa-solid fa-equals"></i></div>
        <div class="conversion-to"><span class="amount">${money(amount * rate)}</span><span class="currency-code">${to}</span></div>
      </div>
      <div class="exchange-rate-info">
        <p>1 ${from} = ${rateTxt} ${to}</p>
        <small>Last updated: ${fmtDate(this.updated, { month: 'long', day: 'numeric', year: 'numeric' })}</small>
      </div>`;
  }

  renderPopular() {
    if (!this.rates) return;
    const from = $('#currency-from').value;
    const codes = ['EUR', 'GBP', 'EGP', 'AED', 'SAR', 'JPY', 'CAD', 'INR', 'USD'].filter((c) => c !== from && this.rates[c]).slice(0, 8);
    $('#popular-currencies').innerHTML = codes
      .map((c) => {
        const rate = this.rates[c] / this.rates[from];
        return `
          <div class="popular-currency-card" data-code="${c}" style="cursor:pointer">
            <img src="${flagUrl(CURRENCY_FLAGS[c] || 'un')}" alt="${c}" class="flag">
            <div class="info"><div class="code">${c}</div><div class="name">${esc(this.name(c))}</div></div>
            <div class="rate">${rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
          </div>`;
      })
      .join('');
  }
}

/* ==================== SUN TIMES ==================== */
class SunTimesView extends View {
  constructor(app) {
    super(app, 'sun-times', '#sun-times-content');
  }
  subtitle() {
    return 'Plan your activities around golden hour - perfect for photographers';
  }

  async load(key) {
    this.container.innerHTML = loadingBox('Calculating sun times...');
    const { city } = this.app.state;
    const loc = await this.app.getLocation();
    if (!loc.timezone) {
      const w = await this.app.api.getWeather(loc.lat, loc.lon);
      loc.timezone = w.timezone;
    }
    const tz = loc.timezone;
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD in the city's timezone
    const r = await this.app.api.getSunTimes(loc.lat, loc.lon, dateStr);
    if (this.stale(key)) return;

    const f = (iso) => new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    const secs = Number(r.day_length);
    const hm = (s) => `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
    const pct = ((secs / 86400) * 100).toFixed(1);

    const card = (cls, icon, label, time, sub) =>
      `<div class="sun-time-card ${cls}"><div class="icon"><i class="fa-solid ${icon}"></i></div>
        <div class="label">${label}</div><div class="time">${time}</div><div class="sub-label">${sub}</div></div>`;

    this.container.innerHTML = `
      <div class="sun-main-card">
        <div class="sun-main-header">
          <div class="sun-location">
            <h2><i class="fa-solid fa-location-dot"></i> ${esc(city)}</h2>
            <p>Sun times for your selected location</p>
          </div>
          <div class="sun-date-display">
            <div class="date">${today.toLocaleDateString('en-US', { timeZone: tz, month: 'long', day: 'numeric', year: 'numeric' })}</div>
            <div class="day">${today.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' })}</div>
          </div>
        </div>
        <div class="sun-times-grid">
          ${card('dawn', 'fa-moon', 'Dawn', f(r.civil_twilight_begin), 'Civil Twilight')}
          ${card('sunrise', 'fa-sun', 'Sunrise', f(r.sunrise), 'Golden Hour Start')}
          ${card('noon', 'fa-sun', 'Solar Noon', f(r.solar_noon), 'Sun at Highest')}
          ${card('sunset', 'fa-sun', 'Sunset', f(r.sunset), 'Golden Hour End')}
          ${card('dusk', 'fa-moon', 'Dusk', f(r.civil_twilight_end), 'Civil Twilight')}
          ${card('daylight', 'fa-hourglass-half', 'Day Length', hm(secs), 'Total Daylight')}
        </div>
      </div>

      <div class="day-length-card">
        <h3><i class="fa-solid fa-chart-pie"></i> Daylight Distribution</h3>
        <div class="day-progress"><div class="day-progress-bar"><div class="day-progress-fill" style="width:${pct}%"></div></div></div>
        <div class="day-length-stats">
          <div class="day-stat"><div class="value">${hm(secs)}</div><div class="label">Daylight</div></div>
          <div class="day-stat"><div class="value">${pct}%</div><div class="label">of 24 Hours</div></div>
          <div class="day-stat"><div class="value">${hm(86400 - secs)}</div><div class="label">Darkness</div></div>
        </div>
      </div>`;
  }
}

/* ==================== MY PLANS ==================== */
class PlansView extends View {
  constructor(app) {
    super(app, 'my-plans', '#plans-content');
    this.filter = 'all';
  }
  get needsSelection() {
    return false;
  }

  async enter() {
    this.render();
  }

  setFilter(filter) {
    this.filter = filter;
    this.render();
  }

  updateCounts() {
    const all = this.app.plans.all();
    const count = (t) => all.filter((p) => p.type === t).length;
    $('#filter-all-count').textContent = all.length;
    $('#filter-holiday-count').textContent = count('holiday');
    $('#filter-event-count').textContent = count('event');
    $('#filter-lw-count').textContent = count('longweekend');
  }

  render() {
    const all = this.app.plans.all();
    const list = this.filter === 'all' ? all : all.filter((p) => p.type === this.filter);
    this.updateCounts();
    $$('.plan-filter', this.el).forEach((b) => b.classList.toggle('active', b.dataset.filter === this.filter));

    if (!list.length) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-heart-crack"></i></div>
          <h3>${all.length ? 'Nothing in this category' : 'No Saved Plans Yet'}</h3>
          <p>Start exploring and save holidays, events, or long weekends you like!</p>
          <button class="btn-primary" data-nav="dashboard"><i class="fa-solid fa-compass"></i> Start Exploring</button>
        </div>`;
      return;
    }

    const labels = { holiday: 'Holiday', event: 'Event', longweekend: 'Long Weekend' };
    this.container.innerHTML = list
      .map(
        (p) => `
        <div class="plan-card">
          <span class="plan-card-type ${esc(p.type)}">${labels[p.type] || 'Plan'}</span>
          <div class="plan-card-content">
            <h4>${esc(p.title)}</h4>
            <div class="plan-card-details">
              <div><i class="fa-regular fa-calendar"></i> ${esc(p.date)}</div>
              ${p.place ? `<div><i class="fa-solid fa-location-dot"></i> ${esc(p.place)}</div>` : ''}
              ${p.subtitle ? `<div><i class="fa-solid fa-circle-info"></i> ${esc(p.subtitle)}</div>` : ''}
            </div>
            <div class="plan-card-actions">
              <button class="btn-plan-remove" data-remove="${esc(p.id)}"><i class="fa-solid fa-trash"></i> Remove</button>
            </div>
          </div>
        </div>`
      )
      .join('');
  }
}

/* ==================== APP ==================== */
class App {
  constructor() {
    this.api = new ApiService();
    this.plans = new PlansStorage();
    this.ui = new UI();
    this.registry = new Map(); // plan id -> plan data (filled while rendering cards)
    this.state = { countries: [], country: null, city: '', year: 2026, info: null };
    this.current = 'dashboard';
    this.eventsCache = null;
    this.locCache = null;

    this.views = {
      dashboard: new DashboardView(this),
      holidays: new HolidaysView(this),
      events: new EventsView(this),
      weather: new WeatherView(this),
      'long-weekends': new LongWeekendsView(this),
      currency: new CurrencyView(this),
      'sun-times': new SunTimesView(this),
      'my-plans': new PlansView(this),
    };
    this.router = new Router(ROUTES, (key) => this.show(key));
  }

  /* ---------- boot ---------- */
  async init() {
    this.bindEvents();
    this.startClock();
    this.updatePlansUI();

    this.ui.loading(true, 'Loading destinations...');
    try {
      this.state.countries = await this.api.getCountries();
      $('#stat-countries').textContent = `${this.state.countries.length}`;
      this.populateCountries();
      await this.onCountryChange($('#global-country').value);
      await this.applySelection();
    } catch (err) {
      this.ui.toast('Could not load countries. Check your connection and refresh.', 'error', 5000);
    } finally {
      this.ui.loading(false);
    }
    this.router.resolve();
  }

  bindEvents() {
    $('#global-search-btn').addEventListener('click', () => this.onExplore());
    $('#global-country').addEventListener('change', (e) => this.onCountryChange(e.target.value));
    $('#clear-selection-btn').addEventListener('click', () => this.clearSelection());
    $('#mobile-menu-btn').addEventListener('click', () => this.toggleSidebar(true));
    $('#sidebar-overlay').addEventListener('click', () => this.toggleSidebar(false));
    $('#clear-all-plans-btn').addEventListener('click', () => this.clearAllPlans());
    document.addEventListener('click', (e) => this.onDocumentClick(e));
  }

  // one delegated listener for everything rendered dynamically
  onDocumentClick(e) {
    const nav = e.target.closest('[data-view], [data-nav]');
    if (nav) {
      e.preventDefault();
      return this.router.navigate(nav.dataset.view || nav.dataset.nav);
    }
    const save = e.target.closest('[data-plan-id]');
    if (save) return this.togglePlan(save.dataset.planId);

    const remove = e.target.closest('[data-remove]');
    if (remove) return this.removePlan(remove.dataset.remove);

    const filter = e.target.closest('.plan-filter');
    if (filter) return this.views['my-plans'].setFilter(filter.dataset.filter);

    const border = e.target.closest('[data-border]');
    if (border) return this.selectByAlpha3(border.dataset.border);

    if (e.target.closest('#start-exploring-btn')) this.router.navigate('dashboard');
  }

  /* ---------- routing ---------- */
  async show(key) {
    if (!this.views[key]) key = 'dashboard';
    this.current = key;
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `${key}-view`));
    $$('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.view === key));
    const [title, sub] = META[key];
    $('#page-title').textContent = title;
    $('#page-subtitle').textContent = sub;
    document.title = `${title} | Wanderlust`;
    this.toggleSidebar(false);
    window.scrollTo(0, 0);
    $('#main-content').scrollTop = 0;
    await this.views[key].enter();
  }

  toggleSidebar(open) {
    $('#sidebar').classList.toggle('open', open);
    const overlay = $('#sidebar-overlay');
    overlay.classList.toggle('hidden', !open);
    overlay.classList.toggle('active', open);
  }

  /* ---------- selection ---------- */
  selectionKey() {
    const { country, city, year } = this.state;
    return `${country?.code || ''}|${city}|${year}`;
  }

  populateCountries() {
    const sel = $('#global-country');
    sel.innerHTML =
      '<option value="">Select Country</option>' +
      this.state.countries
        .map((c) => `<option value="${c.countryCode}">${flagEmoji(c.countryCode)} ${esc(c.name)}</option>`)
        .join('');
    const has = (code) => this.state.countries.some((c) => c.countryCode === code);
    sel.value = has('EG') ? 'EG' : this.state.countries[0]?.countryCode || '';
  }

  async onCountryChange(code) {
    const citySel = $('#global-city');
    if (!code) {
      citySel.innerHTML = '<option value="">Select City</option>';
      return;
    }
    citySel.disabled = true;
    citySel.innerHTML = '<option value="">Loading cities...</option>';
    let cities = [];
    let capital = '';
    try {
      const info = await this.api.getCountry(code);
      capital = info.capital?.[0] || '';
      cities = await this.api.getCities(info.name.common, capital);
    } catch (e) {
      /* handled below */
    }
    if (!cities.length) cities = [capital || this.countryName(code)];
    citySel.innerHTML = cities.map((c, i) => `<option value="${esc(c)}"${i === 0 ? ' selected' : ''}>${esc(c)}</option>`).join('');
    citySel.disabled = false;
  }

  countryName(code) {
    return this.state.countries.find((c) => c.countryCode === code)?.name || code;
  }

  async applySelection() {
    const code = $('#global-country').value;
    if (!code) throw new Error('No country selected');
    const info = await this.api.getCountry(code);
    const name = this.countryName(code);
    const city = $('#global-city').value || info.capital?.[0] || name;
    this.state = { ...this.state, country: { code, name }, city, year: Number($('#global-year').value), info };
    this.renderSelected();
  }

  renderSelected() {
    const { country, city } = this.state;
    $('#selected-country-flag').src = flagUrl(country.code, 80);
    $('#selected-country-flag').alt = country.name;
    $('#selected-country-name').textContent = country.name;
    $('#selected-city-name').textContent = `• ${city}`;
    $('#selected-destination').classList.remove('hidden');
  }

  async onExplore() {
    if (!$('#global-country').value) return this.ui.toast('Please select a country first', 'error');
    this.ui.loading(true, 'Exploring your destination...');
    try {
      await this.applySelection();
      this.ui.toast(`Exploring ${this.state.country.name} • ${this.state.city}`, 'success');
      await this.views[this.current].enter();
    } catch (err) {
      console.error('Explore failed:', err);
      this.ui.toast(`Could not load that destination: ${err.message}`, 'error', 5000);
    } finally {
      this.ui.loading(false);
    }
  }

  clearSelection() {
    this.state = { ...this.state, country: null, city: '', info: null };
    this.eventsCache = null;
    this.locCache = null;
    $('#global-country').value = '';
    $('#global-city').innerHTML = '<option value="">Select City</option>';
    $('#selected-destination').classList.add('hidden');
    this.views[this.current].enter();
  }

  async selectByAlpha3(code3) {
    try {
      const info = await this.api.getCountry(code3);
      if (!this.state.countries.some((c) => c.countryCode === info.cca2)) {
        return this.ui.toast(`${info.name.common} isn't available in the destination list`, 'info');
      }
      $('#global-country').value = info.cca2;
      await this.onCountryChange(info.cca2);
      await this.onExplore();
    } catch (e) {
      this.ui.toast('Could not load that country', 'error');
    }
  }

  /* ---------- shared data (cached per selection) ---------- */
  async getLocation() {
    const key = this.selectionKey();
    if (this.locCache?.key === key) return this.locCache.val;
    const { country, city, info } = this.state;
    let geo = null;
    try {
      geo = await this.api.geocode(city, country.code);
    } catch (e) {
      /* fall back to the capital's coordinates */
    }
    let val;
    if (geo) {
      val = { lat: geo.latitude, lon: geo.longitude, timezone: geo.timezone };
    } else {
      const ll = info.capitalInfo?.latlng || info.latlng;
      if (!ll) throw new Error('Could not find coordinates for this city');
      val = { lat: ll[0], lon: ll[1], timezone: null };
    }
    this.locCache = { key, val };
    return val;
  }

  async loadEvents() {
    const key = this.selectionKey();
    if (this.eventsCache?.key === key) return this.eventsCache.val;
    const { country, city, year } = this.state;
    let list = [];
    try {
      list = await this.api.getEvents(city, country.code, year);
    } catch (e) {
      /* fall through to mock events */
    }
    const mock = !list.length;
    if (mock) list = buildMockEvents(city, country.code, year);
    const val = { list, mock };
    this.eventsCache = { key, val };
    return val;
  }

  /* ---------- plans ---------- */
  register(plan) {
    this.registry.set(plan.id, plan);
  }

  saveBtn(cls, id) {
    const saved = this.plans.has(id);
    return `<button class="${cls}${saved ? ' saved' : ''}" data-plan-id="${esc(id)}" data-saved="${saved ? 1 : 0}" aria-label="Save">${this.saveBtnInner(cls, saved)}</button>`;
  }

  saveBtnInner(cls, saved) {
    const icon = `<i class="${saved ? 'fa-solid' : 'fa-regular'} fa-heart"></i>`;
    return cls === 'btn-event' ? `${icon} ${saved ? 'Saved' : 'Save'}` : icon;
  }

  // keep every heart in sync with LocalStorage
  syncSaved(root = document) {
    $$('[data-plan-id]', root).forEach((btn) => {
      const saved = this.plans.has(btn.dataset.planId);
      if (btn.dataset.saved === String(saved ? 1 : 0)) return;
      const cls = btn.classList.contains('btn-event') ? 'btn-event' : 'icon';
      btn.dataset.saved = saved ? 1 : 0;
      btn.classList.toggle('saved', saved);
      btn.innerHTML = this.saveBtnInner(cls, saved);
    });
  }

  togglePlan(id) {
    if (this.plans.has(id)) {
      this.plans.remove(id);
      this.ui.toast('Removed from My Plans', 'info');
    } else {
      const plan = this.registry.get(id);
      if (!plan) return;
      this.plans.add(plan);
      this.ui.toast('Saved to My Plans', 'success');
    }
    this.afterPlansChange();
  }

  removePlan(id) {
    this.plans.remove(id);
    this.ui.toast('Plan removed', 'info');
    this.afterPlansChange();
  }

  async clearAllPlans() {
    if (!this.plans.count()) return this.ui.toast('You have no saved plans', 'info');
    const ok = await this.ui.confirm('Clear all plans?', 'This will delete every saved plan.', 'Yes, clear all');
    if (!ok) return;
    this.plans.clear();
    this.ui.toast('All plans cleared', 'success');
    this.afterPlansChange();
  }

  afterPlansChange() {
    this.updatePlansUI();
    this.syncSaved($('#main-content'));
    if (this.current === 'my-plans') this.views['my-plans'].render();
  }

  updatePlansUI() {
    const n = this.plans.count();
    const badge = $('#plans-count');
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
    $('#stat-saved').textContent = n;
    this.views['my-plans'].updateCounts();
  }

  /* ---------- clocks ---------- */
  startClock() {
    this.tickClock();
    setInterval(() => this.tickClock(), 1000);
  }

  tickClock() {
    const now = new Date();
    $('#current-datetime').textContent = now.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const el = $('#country-local-time');
    const tz = this.state.info?.timezones?.[0];
    if (!el || !tz) return;
    const m = tz.match(/UTC([+-])(\d{2}):(\d{2})/);
    const offset = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
    el.textContent = new Date(now.getTime() + offset * 60000).toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}

/* ==================== START ==================== */
document.addEventListener('DOMContentLoaded', () => new App().init());