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

  it('does not render historical driver sessions in the map viewer', () => {
    assert.match(app, /function isLiveMapLocation\(item\)/);
    assert.match(app, /items\.filter\(isLiveMapLocation\)\.map/);
    assert.match(app, /const list = rawList\.filter\(isLiveMapLocation\)/);
    assert.match(app, /sessionActive === true/);
  });

  it('exposes the CRM control and does not couple it to GPS or trip polling', () => {
    assert.match(index, /operational-status-filters/);
    assert.match(app, /class="operational-status-control"/);
    assert.match(app, /data-driver-user-id/);
    assert.doesNotMatch(app, /stopGps\(\).*out_of_service/s);
  });
});
