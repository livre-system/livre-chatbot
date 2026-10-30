const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const init = fs.readFileSync(path.join(root, 'js', 'theme-init.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('theme initializes before styles and accepts only light/dark', () => {
  assert.match(index, /js\/theme-init\.js/);
  assert.match(init, /saved === 'dark' \? 'dark' : 'light'/);
  assert.match(app, /applyTheme\(localStorage\.getItem\('livre_theme'\)\)/);
  assert.match(app, /document\.documentElement\.style\.colorScheme/);
});

test('dark theme covers the lock screen and uses dedicated surfaces', () => {
  assert.match(css, /html\[data-theme="dark"\] #lock-box/);
  assert.match(css, /--surface-0: #111216/);
  assert.match(css, /--surface-3: #2d333d/);
});

test('CRM keeps semantic surfaces and one source for each view title', () => {
  assert.match(css, /--surface: var\(--surface-1\)/);
  assert.match(css, /--color-surface: var\(--surface-1\)/);
  assert.match(css, /#agency-commissions-table,/);
  assert.match(css, /background: var\(--surface-1\); color: var\(--text\); border-color: var\(--border\)/);
  assert.doesNotMatch(index, /vehicle-management-view[\\s\\S]*?vehicle-page-heading/);
  assert.doesNotMatch(index, /owner-management-view[\\s\\S]*?vehicle-page-heading/);
  assert.doesNotMatch(index, /agency-commissions-view[\\s\\S]*?vehicle-page-heading/);
  assert.doesNotMatch(index, /driver-shift-closures-view[\\s\\S]*?vehicle-page-heading/);
});
