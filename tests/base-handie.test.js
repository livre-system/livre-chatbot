const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

test('base handie separa conversaciones por chofer', () => {
  assert.match(js, /session_id/);
  assert.match(js, /driver_name/);
  assert.match(js, /12 \* 60 \* 60 \* 1000/);
  assert.match(html, /base-handie-windows/);
  assert.match(css, /base-driver-bubble/);
});

test('base handie exige seleccionar el destinatario antes de responder', () => {
  assert.match(js, /Elegí primero la ventana del chofer/);
  assert.match(js, /client_message_id/);
});
