const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const PORT = 5178;
const base = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ['index.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(PORT), JWT_SECRET: 'test-only-secret', SESSION_SECRET: 'test-only-session' },
  stdio: 'ignore',
});

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { await fetch(base); return; } catch (_) { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  throw new Error('Server did not start.');
}

async function request(path, method = 'GET', body, token, cookie) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  return { status: response.status, data, setCookie: response.headers.get('set-cookie') };
}

async function run() {
  await waitForServer();
  let result = await request('/');
  assert.equal(result.status, 200); assert.equal(Object.keys(result.data).length, 10);
  assert.equal((await request('/isbn/1')).data.title, 'Things Fall Apart');
  assert.equal((await request('/isbn/999')).status, 404);
  assert.ok((await request('/author/chinua')).data['1']);
  assert.ok((await request('/title/PRIDE')).data['8']);
  assert.deepEqual((await request('/review/1')).data, {});
  assert.deepEqual((await request('/author/no%20such%20author')).data, {});
  assert.equal((await request('/register', 'POST', { username: 'test-one', password: 'pass-one-123' })).status, 201);
  assert.equal((await request('/register', 'POST', { username: 'test-one', password: 'pass-one-123' })).status, 409);
  assert.equal((await request('/register', 'POST', { username: 'bad', password: 'short' })).status, 400);
  assert.equal((await request('/customer/login', 'POST', { username: 'test-one', password: 'wrong' })).status, 401);
  const firstLogin = await request('/customer/login', 'POST', { username: 'test-one', password: 'pass-one-123' });
  assert.equal(firstLogin.status, 200);
  const token1 = firstLogin.data.token;
  assert.ok(firstLogin.setCookie);
  const sessionCookie = firstLogin.setCookie.split(';')[0];
  assert.equal((await request('/customer/auth/review/2', 'PUT', { review: 'Session based review' }, null, sessionCookie)).status, 200);
  assert.equal((await request('/customer/auth/review/2', 'DELETE', null, null, sessionCookie)).status, 200);
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: 'unauthenticated' })).status, 401);
  assert.equal((await request('/customer/auth/review/1', 'DELETE')).status, 401);
  assert.equal((await request('/customer/auth/review/404', 'PUT', { review: 'unknown book' }, token1)).status, 404);
  assert.equal((await request('/customer/auth/review/1', 'PUT', {}, token1)).status, 400);
  assert.equal((await request('/customer/auth/review/1', 'PUT', { review: 'First review' }, token1)).status, 200);
  assert.equal((await request('/review/1')).data['test-one'], 'First review');
  assert.equal((await request('/customer/auth/review/1', 'PATCH', { review: 'Edited review' }, token1)).status, 200);
  assert.equal((await request('/review/1')).data['test-one'], 'Edited review');

  await request('/register', 'POST', { username: 'test-two', password: 'pass-two-123' });
  const secondLogin = await request('/customer/login', 'POST', { username: 'test-two', password: 'pass-two-123' });
  const token2 = secondLogin.data.token;
  assert.equal((await request('/customer/auth/review/1', 'PATCH', { review: 'steal' }, token2)).status, 404);
  assert.equal((await request('/customer/auth/review/1', 'DELETE', null, token2)).status, 404);
  assert.equal((await request('/review/1')).data['test-one'], 'Edited review');
  assert.equal((await request('/customer/auth/review/1', 'DELETE', null, token1)).status, 200);
  assert.deepEqual((await request('/review/1')).data, {});

  const malformed = await fetch(`${base}/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json' });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { message: 'Malformed JSON request body.' });

  // Exercise the four Axios helpers against the same running API.
  process.env.BOOK_API_URL = base;
  const helpers = require('./router/general.js');
  const all = await new Promise((resolve, reject) => helpers.getAllBooks((error, data) => error ? reject(error) : resolve(data)));
  assert.equal(Object.keys(all).length, 10);
  assert.equal((await helpers.getBookByISBN('1'))['title'], 'Things Fall Apart');
  assert.ok((await helpers.getBooksByAuthor('chinua'))['1']);
  assert.ok((await helpers.getBooksByTitle('pride'))['8']);
  console.log('All API integration checks and four Axios client methods passed.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => server.kill());
