// Vercel serverless handler — wraps cloud-server API logic
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

let NeteaseAPI;
try { NeteaseAPI = require('NeteaseCloudMusicApi'); } catch(e) {}

const CryptoJS = require('crypto-js');
const COOKIE_FILE = '/tmp/.cookie';
const QQ_COOKIE_FILE = '/tmp/.qq-cookie';

// ---- helpers ----
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
      try { resolve(JSON.parse(body)); } catch(e) { resolve({ raw: body }); }
    });
  });
}

function saveCookie(provider, cookieStr) {
  try { fs.writeFileSync(provider === 'qq' ? QQ_COOKIE_FILE : COOKIE_FILE, cookieStr, 'utf8'); return true; }
  catch(e) { return false; }
}

function loadCookie(provider) {
  try { return fs.readFileSync(provider === 'qq' ? QQ_COOKIE_FILE : COOKIE_FILE, 'utf8').trim(); }
  catch(e) { return ''; }
}

// ---- main handler ----
module.exports = async function(req, res) {
  var url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  var p = url.pathname;
  var m = req.method;

  if (m === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end(); return;
  }

  if (!NeteaseAPI) { jsonReply(res, { error: 'API not loaded' }, 500); return; }

  var api = NeteaseAPI;

  try {
    // SEARCH
    if (p === '/api/search' && m === 'GET') {
      var q = url.searchParams.get('keywords') || '';
      var limit = parseInt(url.searchParams.get('limit')) || 20;
      var r = await api.cloudsearch({ keywords: q, type: 1, limit: limit });
      var raw = (r.body && r.body.result && r.body.result.songs) || [];
      jsonReply(res, { songs: raw.map(function(s) { return { provider:'netease', source:'netease', type:'song', id:s.id, name:s.name, artist:(s.ar&&s.ar[0]&&s.ar[0].name)||'', artists:(s.ar||[]).map(function(a){return{id:a.id,name:a.name}}), artistId:(s.ar&&s.ar[0]&&s.ar[0].id)||0, album:(s.al&&s.al.name)||'', cover:(s.al&&s.al.picUrl)||'', duration:s.dt||0, fee:s.fee||0 }; }), source:'netease' });
      return;
    }
    // SONG URL
    if (p === '/api/song/url' && m === 'GET') {
      var id = url.searchParams.get('id');
      var r = await api.song_url_v1({ id, level:'hires', cookie:loadCookie('netease') });
      var d = (r.body&&r.body.data&&r.body.data[0])||{};
      jsonReply(res, { url:d.url||'', quality:d.level||'hires' });
      return;
    }
    // SONG DETAIL
    if (p === '/api/song/detail' && m === 'GET') {
      var ids = (url.searchParams.get('ids')||'').split(',').filter(Boolean);
      var r = await api.song_detail({ ids:ids.join(','), cookie:loadCookie('netease') });
      jsonReply(res, r.body||{});
      return;
    }
    // LYRIC
    if (p === '/api/lyric' && m === 'GET') {
      var id = url.searchParams.get('id');
      var r = await api.lyric_new({ id, cookie:loadCookie('netease') });
      jsonReply(res, r.body||{});
      return;
    }
    // LOGIN STATUS
    if (p === '/api/login/status' && m === 'GET') {
      var r = await api.login_status({ cookie:loadCookie('netease') });
      jsonReply(res, r.body||{});
      return;
    }
    // PHONE LOGIN
    if (p === '/api/login/cellphone' && m === 'POST') {
      var body = await readBody(req);
      var phone = body.phone, password = body.password, captcha = body.captcha;
      if (!phone || (!password && !captcha)) { jsonReply(res, { code:400, message:'请提供手机号和密码或验证码' },400); return; }
      var loginQuery = { phone, countrycode:'86', timestamp:Date.now() };
      if (captcha) loginQuery.captcha = captcha;
      else loginQuery.md5_password = CryptoJS.MD5(password).toString();
      var r = await api.login_cellphone(loginQuery);
      if (r.body&&r.body.cookie) { saveCookie('netease', r.body.cookie); jsonReply(res, { code:200, message:'登录成功', account:r.body.account }); }
      else jsonReply(res, { code:(r.body&&r.body.code)||400, message:(r.body&&r.body.message)||'登录失败' },400);
      return;
    }
    // SMS
    if (p === '/api/login/cellphone/captcha' && m === 'POST') {
      var body = await readBody(req);
      var r = await api.captcha_sent({ cellphone:body.phone, ctcode:'86', timestamp:Date.now() });
      jsonReply(res, { code:(r.body&&r.body.code)||200, message:(r.body&&r.body.message)||'已发送' });
      return;
    }
    // QR LOGIN
    if (p === '/api/login/qr/key' && m === 'GET') {
      var r = await api.login_qr_key({ timestamp:Date.now() });
      jsonReply(res, { key:(r.body&&r.body.data&&r.body.data.unikey)||'' });
      return;
    }
    if (p === '/api/login/qr/create' && m === 'GET') {
      var key = url.searchParams.get('key');
      var r = await api.login_qr_create({ key, qrimg:true, timestamp:Date.now() });
      jsonReply(res, { img:(r.body&&r.body.data&&r.body.data.qrimg)||'', url:(r.body&&r.body.data&&r.body.data.qrurl)||'' });
      return;
    }
    if (p === '/api/login/qr/check' && m === 'GET') {
      var key = url.searchParams.get('key');
      var r = await api.login_qr_check({ key, noCookie:true, timestamp:Date.now() });
      if (r.body&&r.body.code===803&&r.body.cookie) saveCookie('netease', r.body.cookie);
      jsonReply(res, { code:(r.body&&r.body.code)||-1, message:(r.body&&r.body.message)||'', cookie:(r.body&&r.body.cookie)||'' });
      return;
    }
    // PLAYLISTS
    if (p === '/api/user/playlists' && m === 'GET') {
      var uid = url.searchParams.get('uid');
      var r = await api.user_playlist({ uid, cookie:loadCookie('netease') });
      jsonReply(res, r.body||{});
      return;
    }
    if (p === '/api/playlist/detail' && m === 'GET') {
      var id = url.searchParams.get('id');
      var r = await api.playlist_detail({ id, cookie:loadCookie('netease') });
      jsonReply(res, r.body||{});
      return;
    }
    // RECOMMEND
    if (p === '/api/recommend/songs' && m === 'GET') {
      var r = await api.recommend_songs({ cookie:loadCookie('netease') });
      jsonReply(res, r.body||{});
      return;
    }
    // ARTIST
    if (p === '/api/artist/songs' && m === 'GET') {
      var id = url.searchParams.get('id');
      var r = await api.artist_top_song({ id, cookie:loadCookie('netease') });
      jsonReply(res, r.body||{});
      return;
    }
    // AUDIO PROXY
    if (p === '/api/audio' && m === 'GET') {
      var audioUrl = url.searchParams.get('url');
      if (!audioUrl) { jsonReply(res, { error:'missing url' },400); return; }
      var parsed = new URL(audioUrl);
      var proto = parsed.protocol === 'https:' ? https : http;
      proto.get(audioUrl, { headers:{ 'User-Agent':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36', Referer:parsed.origin } }, function(pr) {
        var h = Object.assign({}, pr.headers, { 'Access-Control-Allow-Origin':'*' });
        res.writeHead(pr.statusCode, h);
        pr.pipe(res);
      }).on('error', function(){ res.writeHead(502); res.end('Audio proxy error'); });
      return;
    }
    // COVER PROXY
    if (p === '/api/cover' && m === 'GET') {
      var coverUrl = url.searchParams.get('url');
      if (!coverUrl) { jsonReply(res, { error:'missing url' },400); return; }
      var proto = coverUrl.startsWith('https') ? https : http;
      proto.get(coverUrl, { headers:{ 'User-Agent':'Mozilla/5.0' } }, function(pr) {
        var h = Object.assign({}, pr.headers, { 'Access-Control-Allow-Origin':'*', 'Cache-Control':'public, max-age=86400' });
        res.writeHead(pr.statusCode, h);
        pr.pipe(res);
      }).on('error', function(){ res.writeHead(502); res.end('Cover proxy error'); });
      return;
    }
    // COOKIE
    if (p === '/api/login/cookie' && m === 'POST') {
      var body = await readBody(req);
      if (!body.cookie) { jsonReply(res, { code:400, message:'请提供cookie' },400); return; }
      saveCookie(body.provider||'netease', body.cookie);
      jsonReply(res, { code:200, message:'Cookie已保存' });
      return;
    }
    if (p === '/api/login/mobile-status' && m === 'GET') {
      var nc = loadCookie('netease'); var qc = loadCookie('qq');
      jsonReply(res, { netease:{ hasCookie:!!nc, cookieLen:nc.length }, qq:{ hasCookie:!!qc, cookieLen:qc.length } });
      return;
    }

    jsonReply(res, { error:'Unknown API endpoint', path:p }, 404);
  } catch(e) {
    jsonReply(res, { code:500, message:e.body&&e.body.message||e.message||String(e) }, 500);
  }
};
