const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cloudRouter = fs.readFileSync(path.resolve(__dirname, '../../livre-cloud/app/crm/router.py'), 'utf8');
const app = fs.readFileSync(path.resolve(__dirname, '../js/app.js'), 'utf8');
const index = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

test('CRM backend reads historical entities from local Livre tables', () => {
  for (const table of ['livre_crm_passengers', 'livre_crm_vehicle_owners']) {
    assert.match(cloudRouter, new RegExp(`_local_page\\(cur, "${table}"`));
  }
  assert.match(cloudRouter, /FROM livre_crm_vehicles/);
  assert.doesNotMatch(cloudRouter, /(?:magiis_passengers|magiis_vehicles|magiis_drivers)/i);
});

test('Historial y cierres queda unificado dentro de Histórico de viajes', () => {
  assert.match(cloudRouter, /@router\.get\("\/driver-shift-closures"\)/);
  assert.match(cloudRouter, /FROM livre_driver_shift_closures/);
  assert.doesNotMatch(app, /showDriverShiftClosures\(\)/);
  assert.doesNotMatch(app, /data-view="driver-shift-closures"/);
  assert.match(index, /id="history-driver"/);
  assert.match(app, /driver_id: driver\.value/);
  assert.match(app, /commission_rule/);
});

test('CRM no muestra el canal Base / Handie en los items', () => {
  assert.doesNotMatch(app, /base-handie|Base \/ Handie/i);
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

test('histórico de viajes usa el contrato real de Livre Cloud y no columnas inexistentes', () => {
  assert.match(cloudRouter, /@router\.get\("\/travel-history"\)/);
  for (const field of ['id', 'origen', 'destino', 'status', 'created_at']) {
    assert.match(cloudRouter, new RegExp(`\\b${field}\\b`));
    assert.match(app, new RegExp(`\\['${field}',`));
  }
  assert.doesNotMatch(app, /\['Col1', 'ID viaje'\]/);
  assert.match(app, /formatHistoryAmount\(summary\.gross_amount\)/);
  assert.match(cloudRouter, /commission_rule/);
  assert.match(cloudRouter, /service_type_id = '1'/);
  assert.match(cloudRouter, /driver_id: str/);
});

test('histórico no queda superpuesto al cambiar de sección', () => {
  assert.match(app, /function hideTravelHistory\(\)/);
  assert.match(app, /function showCrm\(resource\) \{\s+hideTravelHistory\(\)/);
  assert.match(app, /function showChat\(\) \{\s+hideTravelHistory\(\)/);
  for (const view of ['showTariff', 'showAgencyCommissions', 'showVehicleOwnerManagement', 'showTravelForm']) {
    assert.match(app, new RegExp(`function ${view}\\(\\) \\{\\s+hideTravelHistory\\(\\)`));
  }
});
