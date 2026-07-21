// tests/assert.js
export function assertEqual(actual, expected, msg = "") {
  if (actual !== expected) {
    throw new Error(`${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
export function assertDeepEqual(a, b, msg = "") {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg} expected ${sb}, got ${sa}`);
}
export function assertThrows(fn, msg = "") {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(`${msg} expected throw`);
}
export function test(name, fn) {
  try {
    fn();
    console.log("%cPASS", "color:green", name);
    return true;
  } catch (e) {
    console.error("FAIL", name, e);
    return false;
  }
}
