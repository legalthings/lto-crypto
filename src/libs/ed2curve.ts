import * as nacl from 'tweetnacl';

const gf = function(init?: any) {
  let i, r = new Float64Array(16);
  if (init) for (i = 0; i < init.length; i++) r[i] = init[i];
  return r;
};

const gf0 = gf(),
  gf1 = gf([1]),
  D = gf([0x78a3, 0x1359, 0x4dca, 0x75eb, 0xd8ab, 0x4141, 0x0a4d, 0x0070, 0xe898, 0x7779, 0x4079, 0x8cc7, 0xfe73, 0x2b6f, 0x6cee, 0x5203]),
  I = gf([0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7, 0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83]);

function car25519(o: Float64Array | Uint8Array) {
  let c;
  let i;
  for (i = 0; i < 16; i++) {
    o[i] += 65536;
    c = Math.floor(o[i] / 65536);
    o[(i+1)*(i<15?1:0)] += c - 1 + 37 * (c-1) * (i===15?1:0);
    o[i] -= (c * 65536);
  }
}

function sel25519(p: Float64Array | Uint8Array, q: Float64Array | Uint8Array, b: number) {
  let t, c = ~(b-1);
  for (let i = 0; i < 16; i++) {
    t = c & (p[i] ^ q[i]);
    p[i] ^= t;
    q[i] ^= t;
  }
}

function unpack25519(o: Uint8Array, n: Uint8Array) {
  let i;
  for (i = 0; i < 16; i++) o[i] = n[2*i] + (n[2*i+1] << 8);
  o[15] &= 0x7fff;
}

// addition
function A(o: Float64Array | Uint8Array, a: any[] | Float64Array, b: any[] | Float64Array) {
  let i;
  for (i = 0; i < 16; i++) o[i] = (a[i] + b[i])|0;
}

// subtraction
function Z(o: Float64Array | Uint8Array, a: Float64Array | Uint8Array, b: Float64Array | Uint8Array) {
  let i;
  for (i = 0; i < 16; i++) o[i] = (a[i] - b[i])|0;
}

// multiplication
function M(o: Float64Array | Uint8Array, a: Float64Array | Uint8Array, b: Float64Array | Uint8Array) {
  let i, j, t = new Float64Array(31);
  for (i = 0; i < 31; i++) t[i] = 0;
  for (i = 0; i < 16; i++) {
    for (j = 0; j < 16; j++) {
      t[i+j] += a[i] * b[j];
    }
  }
  for (i = 0; i < 15; i++) {
    t[i] += 38 * t[i+16];
  }
  for (i = 0; i < 16; i++) o[i] = t[i];
  car25519(o);
  car25519(o);
}

// squaring
function S(o: Float64Array, a: Float64Array) {
  M(o, a, a);
}

// inversion
function inv25519(o: Float64Array | Uint8Array, i: Float64Array | Uint8Array) {
  let c = gf();
  let a;
  for (a = 0; a < 16; a++) c[a] = i[a];
  for (a = 253; a >= 0; a--) {
    S(c, c);
    if(a !== 2 && a !== 4) M(c, c, i);
  }
  for (a = 0; a < 16; a++) o[a] = c[a];
}

function pack25519(o: Uint8Array | Uint8Array, n: Float64Array | Uint8Array) {
  let i, j, b;
  let m = gf(), t = gf();
  for (i = 0; i < 16; i++) t[i] = n[i];
  car25519(t);
  car25519(t);
  car25519(t);
  for (j = 0; j < 2; j++) {
    m[0] = t[0] - 0xffed;
    for (i = 1; i < 15; i++) {
      m[i] = t[i] - 0xffff - ((m[i-1]>>16) & 1);
      m[i-1] &= 0xffff;
    }
    m[15] = t[15] - 0x7fff - ((m[14]>>16) & 1);
    b = (m[15]>>16) & 1;
    m[14] &= 0xffff;
    sel25519(t, m, 1-b);
  }
  for (i = 0; i < 16; i++) {
    o[2*i] = t[i] & 0xff;
    o[2*i+1] = t[i] >> 8;
  }
}

function par25519(a: any) {
  let d = new Uint8Array(32);
  pack25519(d, a);
  return d[0] & 1;
}

function vn(x: Uint8Array, xi: number, y: Uint8Array, yi: number, n: number) {
  let i, d = 0;
  for (i = 0; i < n; i++) d |= x[xi + i] ^ y[yi + i];
  return (1 & ((d - 1) >>> 8)) - 1;
}

function crypto_verify_32(x: Uint8Array, xi: number, y: Uint8Array, yi: number) {
  return vn(x, xi, y, yi, 32);
}

function neq25519(a: Float64Array, b: Float64Array) {
  const c = new Uint8Array(32), d = new Uint8Array(32);
  pack25519(c, a);
  pack25519(d, b);
  return crypto_verify_32(c, 0, d, 0);
}

function pow2523(o: Float64Array | Uint8Array, i: Float64Array | Uint8Array) {
  const c = gf();
  let a;
  for (a = 0; a < 16; a++) c[a] = i[a];
  for (a = 250; a >= 0; a--) {
    S(c, c);
    if (a !== 1) M(c, c, i);
  }
  for (a = 0; a < 16; a++) o[a] = c[a];
}

function set25519(r: Uint8Array, a: Float64Array | Uint8Array) {
  let i;
  for (i = 0; i < 16; i++) r[i] = a[i] | 0;
}

function unpackneg(r: any[], p: Uint8Array) {
  const t = gf(), chk = gf(), num = gf(),
    den = gf(), den2 = gf(), den4 = gf(),
    den6 = gf();

  set25519(r[2], gf1);
  unpack25519(r[1], p);
  S(num, r[1]);
  M(den, num, D);
  Z(num, num, r[2]);
  A(den, r[2], den);

  S(den2, den);
  S(den4, den2);
  M(den6, den4, den2);
  M(t, den6, num);
  M(t, t, den);

  pow2523(t, t);
  M(t, t, num);
  M(t, t, den);
  M(t, t, den);
  M(r[0], t, den);

  S(chk, r[0]);
  M(chk, chk, den);
  if (neq25519(chk, num)) M(r[0], r[0], I);

  S(chk, r[0]);
  M(chk, chk, den);
  if (neq25519(chk, num)) return -1;

  if (par25519(r[0]) === (p[31] >> 7)) Z(r[0], gf0, r[0]);

  M(r[3], r[0], r[1]);
  return 0;
}

// ----

// Converts Ed25519 public key to Curve25519 public key.
// montgomeryX = (edwardsY + 1)*inverse(1 - edwardsY) mod p
const convertPublicKey = function(pk: Uint8Array): Uint8Array | null {
  const z = new Uint8Array(32),
    q = [gf(), gf(), gf(), gf()],
    a = gf(), b = gf();

  if (unpackneg(q, pk)) return null; // reject invalid key

  let y = q[1];

  A(a, gf1, y);
  Z(b, gf1, y);
  inv25519(b, b);
  M(a, a, b);

  pack25519(z, a);
  return z;
};

// Converts Ed25519 secret key to Curve25519 secret key.
const convertSecretKey = function(sk: Uint8Array): Uint8Array {
  let i;
  const o = new Uint8Array(32);
  // const d = new Uint8Array(32);
  const d = nacl.hash(sk);

  //nacl.lowlevel.crypto_hash(d, sk, 32);
  d[0] &= 248;
  d[31] &= 127;
  d[31] |= 64;
  for (i = 0; i < 32; i++) o[i] = d[i];
  for (i = 0; i < 64; i++) d[i] = 0;
  return o;
};

const convertKeyPair = function(edKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array; }): { publicKey: Uint8Array; secretKey: Uint8Array; } | null {
  let publicKey = convertPublicKey(edKeyPair.publicKey);
  if (!publicKey) return null;
  return {
    publicKey: publicKey,
    secretKey: convertSecretKey(edKeyPair.secretKey)
  };
};

const ed2curve = {
    convertPublicKey,
    convertSecretKey,
    convertKeyPair,
}

export default ed2curve;