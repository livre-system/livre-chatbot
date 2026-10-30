const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

describe('CRM operational status contract', () => {
  it('renders and sends only the canonical statuses', () => {
    for (const status of ['available', 'unavailable', 'out_of_service']) {
      assert.match(app, new RegExp(status));
    }
    assert.match(app, /OPERATIONAL_STATUS_LABELS/);
    assert.doesNotMatch(app, /operationalStatus\s*[:=]\s*['"]active['"]/);
  });

  it('updates through Livre Cloud and rereads the backend snapshot', () => {
    assert.match(app, /\/crm\/operational\/driver\/\$\{encodeURIComponent\(driverUserId\)\}\/status/);
    assert.match(app, /method:\s*'PUT'/);
    assert.match(app, /body:\s*JSON\.stringify\(\{ status \}\)/);
    assert.match(app, /const snapshot = await apiOperational\(\)/);
    assert.match(app, /renderOperationalDashboard\(snapshot\)/);
  });

  it('keeps trip visibility separate from the canonical operational status', () => {
    assert.match(app, /function isDriverInTravel\(item\)/);
    assert.match(app, /function operationalFilterMatches\(item, filter\)/);
    assert.match(app, /tripStatus/);
    assert.match(app, /assigned.*arriving.*in_progress/);
  });

  it('starts the operational list filtered to drivers in travel', () => {
    assert.match(app, /let operationalStatusFilter = 'EN VIAJE'/);
    assert.match(app, /\|\| operationalStatusFilter/);
    assert.match(app, /operationalStatusFilter = button\.dataset\.filter \|\| 'EN VIAJE'/);
  });

  it('calculates KPI cards from the same filtered rows shown in the table', () => {
    assert.match(app, /const countByState = state => filtered\.filter/);
    assert.match(app, /\['Choferes visibles', filtered\.length/);
    assert.match(app, /\['En viaje', countByState\('EN VIAJE'\)/);
    assert.match(app, /filtered\.filter\(item => item\.sessionActive === true\)\.length/);
    assert.doesNotMatch(app, /\['Choferes visibles', totalDrivers/);
    assert.match(app, /\['Pedidos WhatsApp', whatsappRequests/);
    assert.match(app, /\['Pedidos CRM', crmRequests/);
    assert.match(app, /renderOperationalMap\(items\)/);
    assert.doesNotMatch(app, /const filters = \[\['TODOS', totals\./);
  });

  it('renders valid last-known positions and labels stale GPS separately', () => {
    assert.match(app, /function isLiveMapLocation\(item\)/);
    assert.match(app, /items\.filter\(isLiveMapLocation\)\.map/);
    assert.match(app, /const list = rawList\.filter\(isLiveMapLocation\)/);
    assert.match(app, /Number\.isFinite\(latitude\)/);
    assert.match(app, /Última ubicación conocida/);
  });

  it('exposes the CRM control and does not couple it to GPS or trip polling', () => {
    assert.match(index, /operational-status-filters/);
    assert.match(app, /class="operational-status-control"/);
    assert.match(app, /data-driver-user-id/);
    assert.doesNotMatch(app, /stopGps\(\).*out_of_service/s);
  });

  it('shows tariff to CRM operators and keeps editing restricted to administrators', () => {
    assert.match(index, /data-view="tariff" id="tariff-nav-item" hidden/);
    assert.match(index, /id="tariff-form"/);
    assert.match(app, /identityRoles\.has\('crm'\)/);
    assert.match(app, /identityRoles\.has\('crm_admin'\)/);
    assert.match(app, /window\.canEditTariff/);
    assert.match(app, /Modo lectura: solo un administrador/);
    assert.match(app, /apiCrm\('tariff'\)/);
    assert.match(app, /apiCrm\('tariff', \{ method: 'PUT'/);
    assert.match(app, /ahorro_discount_percentage/);
    assert.match(app, /premium_price_per_km/);
    assert.match(index, /Los viajes ya creados conservan su importe/);
  });
});
