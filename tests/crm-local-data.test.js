const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cloudRouter = fs.readFileSync(path.resolve(__dirname, '../../livre-cloud/app/crm/router.py'), 'utf8');
const app = fs.readFileSync(path.resolve(__dirname, '../js/app.js'), 'utf8');

test('CRM backend reads historical entities from local Livre tables', () => {
  for (const table of ['livre_crm_passengers', 'livre_crm_vehicle_owners']) {
    assert.match(cloudRouter, new RegExp(`_local_page\\(cur, "${table}"`));
  }
  assert.match(cloudRouter, /FROM livre_crm_vehicles/);
  assert.doesNotMatch(cloudRouter, /(?:magiis_passengers|magiis_vehicles|magiis_drivers)/i);
});

test('CRM exposes the local driver shift closure history', () => {
  assert.match(cloudRouter, /@router\.get\("\/driver-shift-closures"\)/);
  assert.match(cloudRouter, /FROM livre_driver_shift_closures/);
  assert.match(app, /showDriverShiftClosures\(\)/);
  assert.match(app, /driver-shift-closures\?/);
});

test('driver endpoint exposes every local driver-vehicle link', () => {
  assert.match(cloudRouter, /ARRAY_AGG\(DISTINCT vehicle_label/);
  assert.match(cloudRouter, /"vehicles": vehicles/);
  assert.doesNotMatch(cloudRouter, /vehicle_label FROM livre_driver_vehicles[\\s\\S]{0,180}LIMIT 1/);
});

test('owners screen requests and renders pagination', () => {
  assert.match(app, /vehicle-owners\?page=\$\{ownerPage\}&size=\$\{ownerPageSize\}/);
  assert.match(app, /data-owner-page/);
  assert.match(app, /Página \$\{ownerPage\} de/);
});

test('drivers screen renders local vehicle links', () => {
  assert.match(app, /Array\.isArray\(item\.vehicles\)/);
  assert.match(app, /item\.vehicle\?\.plate/);
});
