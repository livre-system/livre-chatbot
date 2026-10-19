const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const start = source.indexOf('function normalizeCrmPassenger(');
assert.notEqual(start, -1, 'normalizeCrmPassenger must be defined in app.js');
let depth = 0;
let end = -1;
for (let index = source.indexOf('{', start); index < source.length; index += 1) {
  if (source[index] === '{') depth += 1;
  if (source[index] === '}') {
    depth -= 1;
    if (depth === 0) {
      end = index + 1;
      break;
    }
  }
}
assert.notEqual(end, -1, 'normalizeCrmPassenger function must be complete');
const context = {};
const columnsStart = source.indexOf('function crmColumns(');
assert.notEqual(columnsStart, -1, 'crmColumns must be defined in app.js');
let columnsDepth = 0;
let columnsEnd = -1;
for (let index = source.indexOf('{', columnsStart); index < source.length; index += 1) {
  if (source[index] === '{') columnsDepth += 1;
  if (source[index] === '}') {
    columnsDepth -= 1;
    if (columnsDepth === 0) {
      columnsEnd = index + 1;
      break;
    }
  }
}
assert.notEqual(columnsEnd, -1, 'crmColumns function must be complete');
context.CRM_HIDDEN_FIELDS = { passengers: new Set(['city']) };
vm.runInNewContext(`${source.slice(start, end)}\n${source.slice(columnsStart, columnsEnd)};globalThis.normalizeCrmPassenger = normalizeCrmPassenger;globalThis.crmColumns = crmColumns;`, context);

const normalizeCrmPassenger = context.normalizeCrmPassenger;
const crmColumns = context.crmColumns;

test('normalizes local passenger rows without losing raw client fields', () => {
  const row = normalizeCrmPassenger({
    id: 12345,
    raw_payload: {
      firstName: 'Ana',
      lastName: 'Pérez',
      phoneNumber: '+54 291 555-0101',
      passengerUserEmail: 'ana@example.com',
      city: 'Bahía Blanca',
      passengerType: 'Particular',
    },
  });

  assert.equal(row.id, 12345);
  assert.equal(row.raw_payload.firstName, 'Ana');
  assert.equal(row.raw_payload.lastName, 'Pérez');
  assert.equal(row.raw_payload.phoneNumber, '+54 291 555-0101');
  assert.equal(row.raw_payload.passengerUserEmail, 'ana@example.com');
  assert.equal(row.firstName, 'Ana');
  assert.equal(row.lastName, 'Pérez');
  assert.equal(row.city, 'Bahía Blanca');
  const columns = Array.from(crmColumns('passengers', [row]));
  assert.deepEqual(columns.slice(0, 4), ['firstName', 'lastName', 'passengerUserEmail', 'phoneNumber']);
  assert.ok(columns.includes('passengerType'));
  assert.ok(!columns.includes('city'));
});

test('keeps the local list contract for a full page of clients', () => {
  const response = {
    items: Array.from({ length: 100 }, (_, index) => normalizeCrmPassenger({
      id: index + 1,
      raw_payload: { firstName: `Cliente ${index + 1}` },
    })),
    total: 20492,
    page: 1,
    size: 100,
  };

  assert.equal(response.items.length, 100);
  assert.equal(response.total, 20492);
  assert.equal(response.page, 1);
  assert.equal(response.size, 100);
  assert.equal(response.items[99].firstName, 'Cliente 100');
});
