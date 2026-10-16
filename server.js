// Back-end mẫu cho trang web phòng trọ (Node.js thuần, không cần cài thư viện).
// Chạy:  node server.js   rồi mở http://localhost:3000
// API:   GET  /api/ping      kiểm tra back-end
//        GET  /api/sensors   dữ liệu cảm biến IoT (mô phỏng phía máy chủ)
//        POST /api/bill      nhận chỉ số điện nước, tính hóa đơn ở back-end và lưu vào bills.json
//        GET  /api/bills     danh sách hóa đơn đã lập
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const PORT = process.env.PORT || 3000, DIR = __dirname, DB = path.join(DIR, 'bills.json');
const EP = 3500, WP = 20000, SIM = {};

const load = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch (e) { return []; } };
const send = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};

function sensors(ids) {
  const out = {};
  ids.forEach(id => {
    const s = SIM[id] || (SIM[id] = { kwh: 100 + Math.random() * 900, m3: 5 + Math.random() * 30, w: 200, t: 27, door: false });
    s.w = Math.min(900, Math.max(60, s.w + (Math.random() - .5) * 120));
    s.t = Math.min(34, Math.max(24, s.t + (Math.random() - .5) * .6));
    s.kwh += s.w / 1000 * 0.02; s.m3 += Math.random() * .004; s.door = Math.random() < .08;
    out[id] = { ...s };
  });
  return out;
}

function makeBill(x) {
  const ok = n => typeof n === 'number' && isFinite(n) && n >= 0;
  if (!/^\d{4}-\d{2}$/.test(x.month) || typeof x.roomId !== 'string' || typeof x.roomName !== 'string') return null;
  if (![x.price, x.e0, x.e1, x.w0, x.w1].every(ok) || x.e1 < x.e0 || x.w1 < x.w0) return null;
  const elec = Math.round((x.e1 - x.e0) * EP), water = Math.round((x.w1 - x.w0) * WP);
  return { id: 'b' + Date.now(), at: new Date().toISOString(), month: x.month, roomId: x.roomId,
           roomName: x.roomName.slice(0, 100), price: x.price, elec, water, total: x.price + elec + water };
}

http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  if (u.pathname === '/api/ping') return send(res, 200, { ok: true });
  if (u.pathname === '/api/sensors') return send(res, 200, sensors((u.query.ids || '').split(',').filter(Boolean)));
  if (u.pathname === '/api/bills') return send(res, 200, load());
  if (u.pathname === '/api/bill' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const bill = makeBill(JSON.parse(body));
        if (!bill) return send(res, 400, { error: 'Dữ liệu không hợp lệ' });
        const list = load(); list.push(bill);
        fs.writeFileSync(DB, JSON.stringify(list, null, 2));
        send(res, 200, bill);
      } catch (e) { send(res, 400, { error: 'Dữ liệu không hợp lệ' }); }
    });
    return;
  }
  if (u.pathname === '/' || u.pathname === '/phong-tro.html') {
    return fs.readFile(path.join(DIR, 'phong-tro.html'), (e, d) => {
      if (e) return send(res, 500, { error: 'Không đọc được phong-tro.html (hãy để cùng thư mục với server.js)' });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d);
    });
  }
  send(res, 404, { error: 'Không tìm thấy' });
}).listen(PORT, () => console.log('Phòng Trọ Xanh đang chạy tại http://localhost:' + PORT));
