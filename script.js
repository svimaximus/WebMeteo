const API_KEY = '3c97da0b60684d6f970130747260506';

const DAYS_UA   = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];
const MONTHS_UA = ['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру'];

// ── Weather theme ─────────────────────────────────────────────────────────────

const WEATHER_THEMES = [
  // storm / thunder
  { codes: [1087,1273,1276,1279,1282], theme: 'weather-storm' },
  // heavy rain / freezing rain
  { codes: [1192,1195,1198,1201,1204,1207,1243,1246,1249,1252], theme: 'weather-rain' },
  // any rain / drizzle
  { codes: [1063,1072,1150,1153,1168,1171,1180,1183,1186,1189,1240], theme: 'weather-rain' },
  // snow / sleet / blizzard
  { codes: [1066,1069,1114,1117,1210,1213,1216,1219,1222,1225,1255,1258,1261,1264], theme: 'weather-snow' },
  // fog / mist / blowing snow
  { codes: [1030,1135,1147], theme: 'weather-fog' },
  // overcast / cloudy
  { codes: [1006,1009], theme: 'weather-cloudy' },
  // partly cloudy — keep orange default (no class override)
  { codes: [1003], theme: null },
  // clear night (code 1000 + is_day 0)
  { codes: [], theme: 'weather-clear-night', nightOnly: true },
  // sunny / clear day
  { codes: [1000], theme: 'weather-sunny' },
];

const ALL_THEMES = ['weather-sunny','weather-clear-night','weather-rain',
                    'weather-snow','weather-storm','weather-cloudy','weather-fog','weather-hot'];

function applyWeatherTheme(conditionCode, isDay, tempC) {
  // Remove all theme classes first
  document.body.classList.remove(...ALL_THEMES);

  // Hot override: 35°C+
  if (tempC >= 35) { document.body.classList.add('weather-hot'); return; }

  // Night clear
  if (conditionCode === 1000 && !isDay) { document.body.classList.add('weather-clear-night'); return; }

  for (const entry of WEATHER_THEMES) {
    if (entry.nightOnly) continue;
    if (entry.codes.includes(conditionCode)) {
      if (entry.theme) document.body.classList.add(entry.theme);
      return;
    }
  }
  // fallback — default dark (no class)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(localtime) {
  const [datePart, timePart] = localtime.split(' ');
  const [year, month, day]   = datePart.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return `${DAYS_UA[d.getDay()]}, ${day} ${MONTHS_UA[month - 1]} ${year}<br>${timePart}`;
}

function shortDay(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return DAYS_UA[new Date(year, month - 1, day).getDay()];
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

let autocompleteTimer = null;
let currentFocus = -1;        // index of highlighted suggestion

const searchInput = document.getElementById('searchInput');

// Create dropdown container and inject after search-box
const dropdown = document.createElement('div');
dropdown.id = 'autocompleteDropdown';
dropdown.className = 'autocomplete-dropdown';
document.querySelector('.search-wrap').appendChild(dropdown);

// Inject styles
const acStyle = document.createElement('style');
acStyle.textContent = `
  .autocomplete-dropdown {
    display: none;
    position: absolute;
    top: calc(100% + 6px);
    left: 0; right: 0;
    background: var(--card2);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    z-index: 9999;
    box-shadow: 0 12px 32px rgba(0,0,0,0.65);
    animation: fadeUp 0.18s ease both;
  }
  .autocomplete-dropdown.open { display: block; }
  .search-wrap { position: relative; z-index: 9999; }

  .ac-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 16px;
    cursor: pointer;
    transition: background 0.15s;
    border-bottom: 1px solid var(--border);
  }
  .ac-item:last-child { border-bottom: none; }
  .ac-item:hover, .ac-item.ac-active {
    background: rgba(249,115,22,0.12);
  }
  .ac-item .fa-map-marker-alt {
    color: var(--accent);
    font-size: 13px;
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }
  .ac-city {
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
  }
  .ac-region {
    font-size: 12px;
    color: var(--muted);
    margin-left: auto;
    text-align: right;
    white-space: nowrap;
  }
`;
document.head.appendChild(acStyle);

// ── Ukrainian → Latin ─────────────────────────────────────────────────────────

// Known Ukrainian city names → query that WeatherAPI understands
const UA_CITY_MAP = {
  'київ': 'Kyiv', 'киев': 'Kyiv',
  'харків': 'Kharkiv', 'харьков': 'Kharkiv',
  'одеса': 'Odessa', 'одесса': 'Odessa',
  'дніпро': 'Dnipro', 'днепр': 'Dnipro',
  'запоріжжя': 'Zaporizhzhia', 'запорожье': 'Zaporizhzhia',
  'львів': 'Lviv', 'львов': 'Lviv',
  'кривий ріг': 'Kryvyi Rih', 'кривой рог': 'Kryvyi Rih',
  'миколаїв': 'Mykolaiv', 'николаев': 'Mykolaiv',
  'маріуполь': 'Mariupol',
  'луганськ': 'Luhansk', 'луганск': 'Luhansk',
  'вінниця': 'Vinnytsia', 'винница': 'Vinnytsia',
  'херсон': 'Kherson',
  'полтава': 'Poltava',
  'чернігів': 'Chernihiv', 'чернигов': 'Chernihiv',
  'черкаси': 'Cherkasy', 'черкассы': 'Cherkasy',
  'хмельницький': 'Khmelnytskyi', 'хмельницкий': 'Khmelnytskyi',
  'житомир': 'Zhytomyr',
  'суми': 'Sumy', 'сумы': 'Sumy',
  'рівне': 'Rivne', 'ровно': 'Rivne',
  'тернопіль': 'Ternopil', 'тернополь': 'Ternopil',
  'івано-франківськ': 'Ivano-Frankivsk', 'ивано-франковск': 'Ivano-Frankivsk',
  'луцьк': 'Lutsk', 'луцк': 'Lutsk',
  'ужгород': 'Uzhhorod',
  'чернівці': 'Chernivtsi', 'черновцы': 'Chernivtsi',
  'кропивницький': 'Kropyvnytskyi', 'кировоград': 'Kropyvnytskyi',
  'донецьк': 'Donetsk', 'донецк': 'Donetsk',
  'мелітополь': 'Melitopol', 'мелитополь': 'Melitopol',
  'бердянськ': 'Berdyansk', 'бердянск': 'Berdyansk',
  'біла церква': 'Bila Tserkva', 'белая церковь': 'Bila Tserkva',
  'краматорськ': 'Kramatorsk', 'краматорск': 'Kramatorsk',
  'дрогобич': 'Drohobych',
  'мукачево': 'Mukachevo',
  'трускавець': 'Truskavets',
  'бровари': 'Brovary',
  'бориспіль': 'Boryspil', 'борисполь': 'Boryspil',
};

// General Ukrainian → Latin transliteration (КМУ-2010 based)
const UA_TRANSLIT = {
  'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ie',
  'ж':'zh','з':'z','и':'y','і':'i','ї':'i','й':'i','к':'k','л':'l',
  'м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
  'ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'',
  'ю':'iu','я':'ia','ъ':'','ы':'y','э':'e'
};

function transliterateUA(text) {
  // First check the known-city map (handles multi-word names too)
  const lower = text.toLowerCase().trim();
  if (UA_CITY_MAP[lower]) return UA_CITY_MAP[lower];

  // Partial match: if input is a prefix of a known city, return the full mapped name
  for (const [ua, lat] of Object.entries(UA_CITY_MAP)) {
    if (ua.startsWith(lower) && lower.length >= 3) return lat;
  }

  // Fallback: character-by-character transliteration
  return text.split('').map(ch => {
    const lo = ch.toLowerCase();
    const mapped = UA_TRANSLIT[lo];
    if (mapped === undefined) return ch; // keep as-is (Latin, digits, spaces…)
    return ch === ch.toUpperCase() && ch !== lo
      ? mapped.charAt(0).toUpperCase() + mapped.slice(1)
      : mapped;
  }).join('');
}

function prepareQuery(raw) {
  // If the string contains Cyrillic, transliterate it
  return /[а-яёіїєґА-ЯЁІЇЄҐ]/.test(raw) ? transliterateUA(raw) : raw;
}

async function fetchSuggestions(query) {
  try {
    const res = await fetch(
      `https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(prepareQuery(query))}`
    );
    if (!res.ok) return [];
    return await res.json(); // array of { id, name, region, country, lat, lon, url }
  } catch {
    return [];
  }
}

function renderSuggestions(items) {
  dropdown.innerHTML = '';
  currentFocus = -1;

  if (!items.length) {
    dropdown.classList.remove('open');
    return;
  }

  items.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'ac-item';
    div.innerHTML = `
      <i class="fas fa-map-marker-alt"></i>
      <span class="ac-city">${item.name}</span>
      <span class="ac-region">${item.region ? item.region + ', ' : ''}${item.country}</span>
    `;
    div.addEventListener('mousedown', e => {
      // mousedown fires before blur, so we can intercept
      e.preventDefault();
      selectSuggestion(item);
    });
    dropdown.appendChild(div);
  });

  dropdown.classList.add('open');
}

function selectSuggestion(item) {
  searchInput.value = item.name;
  dropdown.classList.remove('open');
  setActiveQC(null);
  loadWeather(item.name);
}

function closeDropdown() {
  dropdown.classList.remove('open');
  currentFocus = -1;
}

// Input handler with debounce
searchInput.addEventListener('input', () => {
  const val = searchInput.value.trim();
  clearTimeout(autocompleteTimer);

  if (val.length < 2) {
    dropdown.classList.remove('open');
    return;
  }

  autocompleteTimer = setTimeout(async () => {
    const items = await fetchSuggestions(val);
    renderSuggestions(items);
  }, 280);
});

// Keyboard navigation
searchInput.addEventListener('keydown', e => {
  const items = dropdown.querySelectorAll('.ac-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    currentFocus = Math.min(currentFocus + 1, items.length - 1);
    updateFocus(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    currentFocus = Math.max(currentFocus - 1, -1);
    updateFocus(items);
  } else if (e.key === 'Enter') {
    if (currentFocus >= 0 && items[currentFocus]) {
      e.preventDefault();
      items[currentFocus].dispatchEvent(new MouseEvent('mousedown'));
    } else {
      doSearch();
    }
  } else if (e.key === 'Escape') {
    closeDropdown();
  }
});

function updateFocus(items) {
  items.forEach((el, i) => el.classList.toggle('ac-active', i === currentFocus));
  if (currentFocus >= 0) items[currentFocus].scrollIntoView({ block: 'nearest' });
}

// Close on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) closeDropdown();
});

searchInput.addEventListener('blur', () => {
  // Small delay so mousedown on item fires first
  setTimeout(closeDropdown, 150);
});

// ── Core loader ───────────────────────────────────────────────────────────────

async function loadWeather(city) {
  const loader      = document.getElementById('loader');
  const weatherCard = document.getElementById('weatherCard');
  const errorMsg    = document.getElementById('errorMsg');

  loader.style.display      = 'flex';
  weatherCard.style.display = 'none';
  errorMsg.style.display    = 'none';

  try {
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${encodeURIComponent(prepareQuery(city))}&aqi=no`),
      fetch(`https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${encodeURIComponent(prepareQuery(city))}&days=3&aqi=no&alerts=no`)
    ]);

    if (!currentRes.ok || !forecastRes.ok) throw new Error('API error');

    const cData = await currentRes.json();
    const fData = await forecastRes.json();

    const loc = cData.location;
    const cur = cData.current;

    document.getElementById('cityName').textContent   = loc.name;
    document.getElementById('country').textContent    = loc.country === 'Ukraine' ? 'UA' : loc.country;
    document.getElementById('datetime').innerHTML     = formatDateTime(loc.localtime);
    document.getElementById('temp').textContent       = Math.round(cur.temp_c);
    document.getElementById('feelsLike').textContent  = Math.round(cur.feelslike_c);
    document.getElementById('condText').textContent   = cur.condition.text;
    document.getElementById('condIcon').src           = 'https:' + cur.condition.icon.replace('64x64', '128x128');
    document.getElementById('condIcon').alt           = cur.condition.text;
    document.getElementById('wind').textContent       = Math.round(cur.wind_kph);
    document.getElementById('humidity').textContent   = cur.humidity;
    document.getElementById('visibility').textContent = cur.vis_km;
    document.getElementById('pressure').textContent   = cur.pressure_mb;
    document.getElementById('uv').textContent         = cur.uv;
    document.getElementById('cloud').textContent      = cur.cloud;

    // Apply background theme based on weather condition
    applyWeatherTheme(cur.condition.code, cur.is_day, cur.temp_c);

    const forecastRow = document.getElementById('forecastRow');
    forecastRow.innerHTML = '';
    fData.forecast.forecastday.forEach(day => {
      const div = document.createElement('div');
      div.className = 'forecast-day';
      div.innerHTML = `
        <span class="fc-date">${shortDay(day.date)}</span>
        <img  class="fc-icon" src="https:${day.day.condition.icon}" alt="${day.day.condition.text}" />
        <span class="fc-high">${Math.round(day.day.maxtemp_c)}°</span>
        <span class="fc-low">${Math.round(day.day.mintemp_c)}°</span>
      `;
      forecastRow.appendChild(div);
    });

    document.getElementById('updatedAt').textContent =
      new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    loader.style.display      = 'none';
    weatherCard.style.display = 'block';

  } catch (e) {
    console.error(e);
    loader.style.display   = 'none';
    errorMsg.style.display = 'flex';
  }
}

// ── Search ────────────────────────────────────────────────────────────────────

function doSearch() {
  const val = searchInput.value.trim();
  if (!val) return;
  closeDropdown();
  setActiveQC(null);
  loadWeather(val);
}

document.getElementById('searchBtn').addEventListener('click', doSearch);

// ── Quick-city buttons ────────────────────────────────────────────────────────

function setActiveQC(activeBtn) {
  document.querySelectorAll('.qc').forEach(btn => btn.classList.remove('active'));
  if (activeBtn) activeBtn.classList.add('active');
}

document.querySelectorAll('.qc').forEach(btn => {
  btn.addEventListener('click', () => {
    setActiveQC(btn);
    searchInput.value = '';
    closeDropdown();
    loadWeather(btn.dataset.city);
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────

const kyivBtn = document.querySelector('.qc[data-city="Kyiv"]');
if (kyivBtn) setActiveQC(kyivBtn);

loadWeather('Kyiv');
// ── (patch: see below) ──

// ── Weather Particle Engine ───────────────────────────────────────────────────

(function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'weatherCanvas';
  canvas.style.cssText = `
    position: fixed; inset: 0; z-index: 0;
    pointer-events: none; width: 100%; height: 100%;
    opacity: 0; transition: opacity 1.4s ease;
  `;
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, particles = [], animId = null, currentMode = null;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function makeRaindrop(heavy) {
    return {
      x: Math.random() * W,
      y: Math.random() * H - H,
      len:   heavy ? 18 + Math.random() * 20 : 10 + Math.random() * 14,
      speed: heavy ? 18 + Math.random() * 14 : 12 + Math.random() * 10,
      thick: heavy ? 1.5 + Math.random() * 1  : 0.8 + Math.random() * 0.8,
      alpha: heavy ? 0.35 + Math.random() * 0.35 : 0.2 + Math.random() * 0.25,
      angle: heavy ? 0.25 : 0.15,
    };
  }

  function makeSnowflake() {
    return {
      x:     Math.random() * W,
      y:     Math.random() * H - H,
      r:     1 + Math.random() * 3.5,
      speed: 0.6 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 0.5,
      alpha: 0.5 + Math.random() * 0.5,
      sway:  Math.random() * Math.PI * 2,
      swayS: 0.005 + Math.random() * 0.01,
    };
  }

  function makeFogPuff() {
    return {
      x:      Math.random() * W * 1.4 - W * 0.2,
      y:      Math.random() * H,
      r:      80 + Math.random() * 160,
      speedX: 0.2 + Math.random() * 0.5,
      alpha:  0.03 + Math.random() * 0.05,
    };
  }

  function makeStarParticle() {
    return {
      x:           Math.random() * W,
      y:           Math.random() * H,
      r:           0.3 + Math.random() * 1.4,
      alpha:       0.2 + Math.random() * 0.7,
      twinkleSpeed:0.01 + Math.random() * 0.02,
      phase:       Math.random() * Math.PI * 2,
    };
  }

  function makeSunRay() {
    return {
      angle: Math.random() * Math.PI * 2,
      len:   Math.max(W, H) * (0.5 + Math.random() * 0.5),
      width: 30 + Math.random() * 80,
      alpha: 0.018 + Math.random() * 0.025,
    };
  }

  function initParticles(mode) {
    particles = [];
    const counts = { rain: 220, heavy_rain: 380, snow: 130, storm: 300, fog: 22, stars: 120, sunny: 10 };
    if (mode === 'rain')       for (let i = 0; i < counts.rain;       i++) particles.push(makeRaindrop(false));
    if (mode === 'heavy_rain') for (let i = 0; i < counts.heavy_rain; i++) particles.push(makeRaindrop(true));
    if (mode === 'snow') {
      for (let i = 0; i < counts.snow; i++) {
        const p = makeSnowflake(); p.y = Math.random() * H; particles.push(p);
      }
    }
    if (mode === 'storm') {
      for (let i = 0; i < counts.storm; i++) particles.push(makeRaindrop(true));
      particles.push({ life: 999, maxLife: 10, isLightning: true });
    }
    if (mode === 'fog')   for (let i = 0; i < counts.fog;   i++) particles.push(makeFogPuff());
    if (mode === 'stars') for (let i = 0; i < counts.stars; i++) particles.push(makeStarParticle());
    if (mode === 'sunny') for (let i = 0; i < counts.sunny; i++) particles.push(makeSunRay());
  }

  function drawRain(heavy) {
    particles.forEach(p => {
      if (p.isLightning) return;
      ctx.save();
      ctx.strokeStyle = heavy ? `rgba(120,190,255,${p.alpha})` : `rgba(160,210,255,${p.alpha})`;
      ctx.lineWidth = p.thick;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.sin(p.angle) * p.len, p.y + Math.cos(p.angle) * p.len);
      ctx.stroke();
      ctx.restore();
      p.x += Math.sin(p.angle) * p.speed * 0.4;
      p.y += p.speed;
      if (p.y > H + p.len) { p.x = Math.random() * W; p.y = -p.len; }
    });
  }

  let lightningTimer = 0;
  function drawStorm() {
    drawRain(true);
    lightningTimer++;
    const bolt = particles.find(p => p.isLightning);
    if (!bolt) return;
    if (lightningTimer > 200 + Math.random() * 180) {
      lightningTimer = 0; bolt.life = 0; bolt.maxLife = 8 + Math.random() * 10;
    }
    if (bolt.life < bolt.maxLife) {
      const flash = 1 - bolt.life / bolt.maxLife;
      ctx.save(); ctx.globalAlpha = flash * 0.1; ctx.fillStyle = '#ddd6fe';
      ctx.fillRect(0, 0, W, H); ctx.restore();
      ctx.save();
      ctx.strokeStyle = `rgba(220,200,255,${flash * 0.85})`;
      ctx.lineWidth = 2; ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 24;
      let bx = W * 0.2 + Math.random() * W * 0.6, by = 0;
      ctx.beginPath(); ctx.moveTo(bx, by);
      while (by < H * 0.65) { bx += (Math.random() - 0.5) * 80; by += 40 + Math.random() * 55; ctx.lineTo(bx, by); }
      ctx.stroke(); ctx.restore();
      bolt.life++;
    }
  }

  function drawSnow() {
    particles.forEach(p => {
      p.sway += p.swayS; p.x += Math.sin(p.sway) * 0.6 + p.drift; p.y += p.speed;
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = '#e0f2fe';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
  }

  function drawFog() {
    particles.forEach(p => {
      p.x += p.speedX; if (p.x - p.r > W) p.x = -p.r;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, `rgba(180,200,220,${p.alpha})`); g.addColorStop(1, 'rgba(180,200,220,0)');
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    });
  }

  function drawStars() {
    particles.forEach(p => {
      p.phase += p.twinkleSpeed;
      const a = p.alpha * (0.5 + 0.5 * Math.sin(p.phase));
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#e0e8ff';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
  }

  let sunAngle = 0;
  function drawSunny() {
    sunAngle += 0.0006;
    const cx = W * 0.75, cy = H * 0.15;
    particles.forEach((p, i) => {
      const a = p.angle + sunAngle * (i % 2 === 0 ? 1 : -0.7);
      const x1 = cx + Math.cos(a) * 55, y1 = cy + Math.sin(a) * 55;
      const x2 = cx + Math.cos(a) * p.len, y2 = cy + Math.sin(a) * p.len;
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, `rgba(251,191,36,${p.alpha})`); g.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.save(); ctx.lineWidth = p.width; ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
    });
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 110);
    grd.addColorStop(0, 'rgba(253,224,71,0.2)'); grd.addColorStop(1, 'rgba(253,224,71,0)');
    ctx.beginPath(); ctx.arc(cx, cy, 110, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill();
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    if (currentMode === 'rain')       drawRain(false);
    else if (currentMode === 'heavy_rain') drawRain(true);
    else if (currentMode === 'snow')  drawSnow();
    else if (currentMode === 'storm') drawStorm();
    else if (currentMode === 'fog')   drawFog();
    else if (currentMode === 'stars') drawStars();
    else if (currentMode === 'sunny') drawSunny();
    animId = requestAnimationFrame(loop);
  }

  window.setWeatherAnimation = function (mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    canvas.style.opacity = mode ? '1' : '0';
    initParticles(mode);
  };

  loop();
})();

// ── Map theme → animation & hook into applyWeatherTheme ──────────────────────

const THEME_TO_ANIM = {
  'weather-rain':        'rain',
  'weather-snow':        'snow',
  'weather-storm':       'storm',
  'weather-fog':         'fog',
  'weather-clear-night': 'stars',
  'weather-sunny':       'sunny',
  'weather-hot':         'sunny',
  'weather-cloudy':       null,
};

const _origApply = applyWeatherTheme;
applyWeatherTheme = function (code, isDay, tempC) {
  _origApply(code, isDay, tempC);
  const heavyRain = [1192, 1195, 1243, 1246];
  if (heavyRain.includes(code)) { window.setWeatherAnimation('heavy_rain'); return; }
  const theme = [...document.body.classList].find(c => c.startsWith('weather-'));
  window.setWeatherAnimation(theme ? (THEME_TO_ANIM[theme] ?? null) : null);
};