#!/usr/bin/env node
/**
 * Mineradio Cloud Server — 独立一体化服务器
 * 整合 API 代理 + 静态文件服务，可直接部署到 Railway/VPS/Render
 * 部署命令: node server/cloud-server.js
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const STATIC_DIR = path.join(__dirname, '..', 'www');

// Load NeteaseCloudMusicApi
let NeteaseAPI;
try { NeteaseAPI = require('NeteaseCloudMusicApi'); }
catch(e) { console.error('[Cloud] NeteaseCloudMusicApi missing — run: npm install'); process.exit(1); }

const CryptoJS = require('crypto-js');

const {
  search, cloudsearch, song_detail, song_url_v1,
  login_qr_key, login_qr_create, login_qr_check, login_status,
  user_account, user_playlist, playlist_detail,
  recommend_songs, personalized,
  lyric_new, artist_top_song, artist_detail,
  captcha_sent, login_cellphone,
} = NeteaseAPI;

const COOKIE_FILE = process.env.COOKIE_FILE || path.join(__dirname, '.cookie');
const QQ_COOKIE_FILE = process.env.QQ_COOKIE_FILE || path.join(__dirname, '.qq-cookie');

// ---------- helpers ----------
function jsonReply(res, data, status) {
  res.writeHead(status || 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise(function(resolve) {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try { resolve(JSON.parse(body)); }
      catch(e) { resolve({ raw: body }); }
    });
  });
}

function saveCookie(provider, cookieStr) {
  var file = provider === 'qq' ? QQ_COOKIE_FILE : COOKIE_FILE;
  try { fs.writeFileSync(file, cookieStr, 'utf8'); return true; }
  catch(e) { console.error('[Cloud] Cookie save failed:', e.message); return false; }
}

function loadCookie(provider) {
  try { return fs.readFileSync(provider === 'qq' ? QQ_COOKIE_FILE : COOKIE_FILE, 'utf8').trim(); }
  catch(e) { return ''; }
}

// ---------- API routes (subset of original server.js) ----------
async function handleAPI(req, res, url) {
  var p = url.pathname;
  var m = req.method;

  if (m === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(); return true;
  }

  // -- SEARCH --
  if (p === '/api/search' && m === 'GET') {
    try {
      var q = url.searchParams.get('keywords') || '';
      var limit = parseInt(url.searchParams.get('limit')) || 20;
      var r = await cloudsearch({ keywords: q, type: 1, limit: limit });
      var raw = (r.body && r.body.result && r.body.result.songs) || [];
      var songs = raw.map(function(s) {
        return {
          provider: 'netease', source: 'netease', type: 'song',
          id: s.id, name: s.name,
          artist: (s.ar && s.ar[0] && s.ar[0].name) || '',
          artists: (s.ar || []).map(function(a) { return { id: a.id, name: a.name }; }),
          artistId: (s.ar && s.ar[0] && s.ar[0].id) || 0,
          album: (s.al && s.al.name) || '',
          cover: (s.al && s.al.picUrl) || '',
          duration: s.dt || 0,
          fee: s.fee || 0,
        };
      });
      jsonReply(res, { songs: songs, source: 'netease', total: (r.body && r.body.result && r.body.result.songCount) || songs.length });
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  // -- SONG URL --
  if (p === '/api/song/url' && m === 'GET') {
    try {
      var id = url.searchParams.get('id');
      var level = url.searchParams.get('level') || 'hires';
      var cookie = loadCookie('netease');
      var r = await song_url_v1({ id: id, level: level, cookie: cookie });
      var d = (r.body && r.body.data && r.body.data[0]) || {};
      jsonReply(res, { url: d.url || '', quality: d.level || level, type: d.type || '', freeTrialInfo: d.freeTrialInfo || null });
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  // -- SONG DETAIL --
  if (p === '/api/song/detail' && m === 'GET') {
    try {
      var ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
      var r = await song_detail({ ids: ids.join(','), cookie: loadCookie('netease') });
      jsonReply(res, r.body || {});
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  // -- LYRIC --
  if (p === '/api/lyric' && m === 'GET') {
    try {
      var id = url.searchParams.get('id');
      var r = await lyric_new({ id: id, cookie: loadCookie('netease') });
      jsonReply(res, r.body || {});
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  // -- LOGIN STATUS --
  if (p === '/api/login/status' && m === 'GET') {
    try {
      var r = await login_status({ cookie: loadCookie('netease') });
      jsonReply(res, r.body || {});
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  // -- PHONE LOGIN --
  if (p === '/api/login/cellphone' && m === 'POST') {
    try {
      var body = await readBody(req);
      var phone = body.phone, password = body.password, captcha = body.captcha;
      if (!phone || (!password && !captcha)) {
        jsonReply(res, { code: 400, message: '请提供手机号和密码或验证码' }, 400); return true;
      }
      var loginQuery = { phone: phone, countrycode: '86', timestamp: Date.now() };
      if (captcha) { loginQuery.captcha = captcha; }
      else { loginQuery.md5_password = CryptoJS.MD5(password).toString(); }
      var r = await login_cellphone(loginQuery);
      if (r.body && r.body.cookie) {
        saveCookie('netease', r.body.cookie);
        jsonReply(res, { code: 200, message: '登录成功', account: r.body.account, profile: r.body.profile });
      } else {
        jsonReply(res, { code: (r.body && r.body.code) || 400, message: (r.body && r.body.message) || '登录失败' }, 400);
      }
    } catch(e) {
      jsonReply(res, { code: 500, message: '服务器错误: ' + ((e.body && e.body.message) || e.message || String(e)) }, 500);
    }
    return true;
  }

  // -- SMS CAPTCHA --
  if (p === '/api/login/cellphone/captcha' && m === 'POST') {
    try {
      var body = await readBody(req);
      var r = await captcha_sent({ cellphone: body.phone, ctcode: '86', timestamp: Date.now() });
      jsonReply(res, { code: (r.body && r.body.code) || 200, message: (r.body && r.body.message) || '已发送' });
    } catch(e) {
      jsonReply(res, { code: 500, message: '发送失败: ' + (e.message || String(e)) }, 500);
    }
    return true;
  }

  // -- QR LOGIN --
  if (p === '/api/login/qr/key' && m === 'GET') {
    try {
      var r = await login_qr_key({ timestamp: Date.now() });
      jsonReply(res, { key: (r.body && r.body.data && r.body.data.unikey) || '' });
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  if (p === '/api/login/qr/create' && m === 'GET') {
    try {
      var key = url.searchParams.get('key');
      var r = await login_qr_create({ key: key, qrimg: true, timestamp: Date.now() });
      var d = (r.body && r.body.data) || {};
      jsonReply(res, { img: d.qrimg || '', url: d.qrurl || '' });
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  if (p === '/api/login/qr/check' && m === 'GET') {
    try {
      var key = url.searchParams.get('key');
      var r = await login_qr_check({ key: key, noCookie: true, timestamp: Date.now() });
      if (r.body && r.body.code === 803 && r.body.cookie) {
        saveCookie('netease', r.body.cookie);
      }
      jsonReply(res, { code: (r.body && r.body.code) || -1, message: (r.body && r.body.message) || '', cookie: (r.body && r.body.cookie) || '' });
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  // -- PLAYLISTS --
  if (p === '/api/user/playlists' && m === 'GET') {
    try {
      var uid = url.searchParams.get('uid');
      var r = await user_playlist({ uid: uid, cookie: loadCookie('netease') });
      jsonReply(res, r.body || {});
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  if (p === '/api/playlist/detail' && m === 'GET') {
    try {
      var id = url.searchParams.get('id');
      var r = await playlist_detail({ id: id, cookie: loadCookie('netease') });
      jsonReply(res, r.body || {});
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  // -- DAILY RECOMMEND --
  if (p === '/api/recommend/songs' && m === 'GET') {
    try {
      var r = await recommend_songs({ cookie: loadCookie('netease') });
      jsonReply(res, r.body || {});
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  // -- ARTIST --
  if (p === '/api/artist/songs' && m === 'GET') {
    try {
      var id = url.searchParams.get('id');
      var r = await artist_top_song({ id: id, cookie: loadCookie('netease') });
      jsonReply(res, r.body || {});
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  // -- AUDIO PROXY --
  if (p === '/api/audio' && m === 'GET') {
    var audioUrl = url.searchParams.get('url');
    if (!audioUrl) { jsonReply(res, { error: 'missing url' }, 400); return true; }
    try {
      var parsed = new URL(audioUrl);
      var proto = parsed.protocol === 'https:' ? https : http;
      proto.get(audioUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36', 'Referer': parsed.origin } }, function(proxyRes) {
        var headers = Object.assign({}, proxyRes.headers, { 'Access-Control-Allow-Origin': '*' });
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
      }).on('error', function() { res.writeHead(502); res.end('Audio proxy error'); });
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  // -- COVER PROXY --
  if (p === '/api/cover' && m === 'GET') {
    var coverUrl = url.searchParams.get('url');
    if (!coverUrl) { jsonReply(res, { error: 'missing url' }, 400); return true; }
    try {
      var proto = coverUrl.startsWith('https') ? https : http;
      proto.get(coverUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, function(proxyRes) {
        var headers = Object.assign({}, proxyRes.headers, { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' });
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
      }).on('error', function() { res.writeHead(502); res.end('Cover proxy error'); });
    } catch(e) { jsonReply(res, { error: e.message }, 500); }
    return true;
  }

  // -- COOKIE MANAGEMENT --
  if (p === '/api/login/cookie' && m === 'POST') {
    try {
      var body = await readBody(req);
      var cookie = body.cookie;
      if (!cookie) { jsonReply(res, { code: 400, message: '请提供cookie' }, 400); return true; }
      saveCookie(body.provider || 'netease', cookie);
      jsonReply(res, { code: 200, message: 'Cookie已保存' });
    } catch(e) { jsonReply(res, { code: 500, message: e.message }, 500); }
    return true;
  }

  if (p === '/api/login/mobile-status' && m === 'GET') {
    var nc = loadCookie('netease');
    var qc = loadCookie('qq');
    jsonReply(res, {
      netease: { hasCookie: !!nc, cookieLen: nc.length },
      qq: { hasCookie: !!qc, cookieLen: qc.length },
    });
    return true;
  }

  return false;
}

// ---------- Static files ----------
var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.bin': 'application/octet-stream',
};

// ---------- Main ----------
var server = http.createServer(async function(req, res) {
  var url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (url.pathname.startsWith('/api/')) {
    var handled = await handleAPI(req, res, url);
    if (handled) return;
  }

  var filePath = path.join(STATIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!filePath.startsWith(STATIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(STATIC_DIR, 'index.html');
  }
  var ext = path.extname(filePath);
  try {
    var content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    });
    res.end(content);
  } catch(e) { res.writeHead(404); res.end('Not Found'); }
});

server.listen(PORT, HOST, function() {
  console.log('');
  console.log('  🎵 Mineradio Cloud Server');
  console.log('  http://' + HOST + ':' + PORT);
  console.log('');
});

process.on('SIGTERM', function() { server.close(); process.exit(0); });
process.on('SIGINT', function() { server.close(); process.exit(0); });
