const puppeteer = require('puppeteer');
const path = require('path');

const BASE = 'http://localhost';
const OUT = __dirname;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, name, desc) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${name}.png  —  ${desc}`);
  return file;
}

async function loginViaApi(page, email, password) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await sleep(300);
  const result = await page.evaluate(async (email, password) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return { status: r.status };
  }, email, password);
  if (result.status !== 200) { console.log(`Login failed for ${email}`); return false; }
  await page.goto(BASE + '/lobby', { waitUntil: 'networkidle2', timeout: 12000 });
  await sleep(500);
  return true;
}

async function apiPost(page, relUrl, body) {
  const result = await page.evaluate(async (relUrl, body) => {
    const r = await fetch(relUrl, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.text() };
  }, relUrl, body);
  if (result.status === 200 || result.status === 201) {
    try { return JSON.parse(result.body); } catch { return null; }
  }
  console.log(`  API ${relUrl} → ${result.status}: ${result.body?.slice(0,60)}`);
  return null;
}

// click a button containing the given text using a single evaluate
async function clickButton(page, regex) {
  return page.evaluate((pattern) => {
    const re = new RegExp(pattern, 'i');
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => re.test(b.textContent || ''));
    if (btn) { btn.click(); return true; }
    return false;
  }, regex.source);
}

async function startGame(p1, p2, roomId) {
  await p1.goto(BASE + '/room/' + roomId, { waitUntil: 'networkidle2', timeout: 12000 });
  await p2.goto(BASE + '/room/' + roomId, { waitUntil: 'networkidle2', timeout: 12000 });
  await sleep(1500);
  await clickButton(p1, /готов|ready/);
  await sleep(400);
  await clickButton(p2, /готов|ready/);
  await sleep(700);
  await clickButton(p1, /начать|start игру/);
  await sleep(3500);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 },
    protocolTimeout: 90000,
  });

  const files = [];

  try {
    const p1 = await browser.newPage();
    const p2 = await browser.newPage();

    // ── 1. Login page ──────────────────────────────────────────────────
    await p1.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(600);
    files.push(await shot(p1, '01_login', 'Страница входа в систему'));

    // ── 2. Register page ───────────────────────────────────────────────
    await p1.goto(BASE + '/register', { waitUntil: 'networkidle2', timeout: 10000 });
    await sleep(600);
    files.push(await shot(p1, '02_register', 'Страница регистрации'));

    // ── Login both players ─────────────────────────────────────────────
    await loginViaApi(p1, 'demo@example.com', 'DemoUser123!');
    await loginViaApi(p2, 'admin@example.com', 'AdminUser123!');

    // ── 3. Lobby ───────────────────────────────────────────────────────
    files.push(await shot(p1, '03_lobby', 'Лобби — список игровых комнат'));

    // ── 4. Profile ─────────────────────────────────────────────────────
    await p1.goto(BASE + '/profile', { waitUntil: 'networkidle2', timeout: 10000 });
    await sleep(800);
    files.push(await shot(p1, '04_profile', 'Страница профиля пользователя'));

    // ── 5. Chess ───────────────────────────────────────────────────────
    const chess = await apiPost(p1, '/api/rooms', { name: 'Шахматы — демо', gameType: 'chess', maxPlayers: 2, isPublic: true });
    if (chess?.id) {
      await startGame(p1, p2, chess.id);
      files.push(await shot(p1, '05_chess', 'Игра — Шахматы (игровое поле)'));
    }

    // ── 6. Checkers ────────────────────────────────────────────────────
    const checkers = await apiPost(p1, '/api/rooms', { name: 'Шашки — демо', gameType: 'checkers', maxPlayers: 2, isPublic: true });
    if (checkers?.id) {
      await startGame(p1, p2, checkers.id);
      files.push(await shot(p1, '06_checkers', 'Игра — Шашки (игровое поле)'));
    }

    // ── 7. Durak ───────────────────────────────────────────────────────
    const durak = await apiPost(p1, '/api/rooms', { name: 'Дурак — демо', gameType: 'durak', maxPlayers: 2, isPublic: true });
    if (durak?.id) {
      await startGame(p1, p2, durak.id);
      files.push(await shot(p1, '07_durak', 'Игра — Дурак (карточная игра)'));
    }

    // ── 8. Alias room (waiting, needs 4+ players) ──────────────────────
    const alias = await apiPost(p1, '/api/rooms', { name: 'Алиас — демо', gameType: 'alias', maxPlayers: 4, isPublic: true });
    if (alias?.id) {
      await p1.goto(BASE + '/room/' + alias.id, { waitUntil: 'networkidle2', timeout: 10000 });
      await sleep(1200);
      files.push(await shot(p1, '08_alias_room', 'Комната — Алиас (ожидание игроков)'));
    }

    // ── 9. Mafia room (waiting, needs 6+ players) ──────────────────────
    const mafia = await apiPost(p1, '/api/rooms', { name: 'Мафия — демо', gameType: 'mafia', maxPlayers: 6, isPublic: true });
    if (mafia?.id) {
      await p1.goto(BASE + '/room/' + mafia.id, { waitUntil: 'networkidle2', timeout: 10000 });
      await sleep(1200);
      files.push(await shot(p1, '09_mafia_room', 'Комната — Мафия (ожидание игроков)'));
    }

    // ── 10. Admin panel ────────────────────────────────────────────────
    await p2.goto(BASE + '/admin', { waitUntil: 'networkidle2', timeout: 12000 });
    await sleep(1500);
    files.push(await shot(p2, '10_admin', 'Административная панель'));

    // ── 11. Lobby final ────────────────────────────────────────────────
    await p1.goto(BASE + '/lobby', { waitUntil: 'networkidle2', timeout: 10000 });
    await sleep(1200);
    files.push(await shot(p1, '11_lobby_final', 'Лобби с созданными комнатами'));

    await p1.close(); await p2.close();

  } finally {
    await browser.close();
  }

  console.log('\n=== Done ===');
  files.forEach(f => console.log(' ', path.basename(f)));
})().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
