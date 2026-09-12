/**
 * app.js — HASH AI
 * Fuente de verdad: HASH Cloud → Google Sheets del usuario.
 */

const HASH_CLOUD_URL = 'https://livre-cloud-production.up.railway.app';

async function apiCrm(path) {
  const token = getToken();
  const res = await fetch(HASH_CLOUD_URL + '/crm/' + path, {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Error ' + res.status);
  return await res.json();
}

async function apiOperational() {
  const token = getToken();
  const res = await fetch(HASH_CLOUD_URL + '/crm/operational', {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Error ' + res.status);
  return await res.json();
}

const CRM_LABELS = { passengers: 'Clientes', drivers: 'Choferes', vehicles: 'Vehículos', travels: 'Viajes' };
const CRM_FIELD_LABELS = {
  id: 'ID', magiis_id: 'ID', passengerUserId: 'ID del cliente', driverUserId: 'ID del conductor', vehicleId: 'ID del vehículo', travelId: 'ID del viaje',
  code: 'Código', dni: 'DNI', firstName: 'Nombre', name: 'Nombre', lastName: 'Apellido', surname: 'Apellido',
  phone: 'Teléfono', cellphone: 'Celular', email: 'Correo electrónico', city: 'Ciudad', address: 'Domicilio', country: 'País',
  rate: 'Tarifa', family: 'Familia', paxNote: 'Observaciones', isPaxVip: 'Cliente VIP',
  state: 'Estado', status: 'Estado', origin: 'Origen', destination: 'Destino', channel: 'Canal', travelDate: 'Fecha del viaje',
  creationDate: 'Fecha de creación', driverId: 'ID del conductor', passengerId: 'ID del cliente', vehicle: 'Vehículo', vehicleId: 'ID del vehículo',
  brand: 'Marca', model: 'Modelo', plate: 'Patente', domain: 'Patente', year: 'Año', enabled: 'Habilitado',
  vehicleOwner: 'Titular', ownerId: 'ID del titular', vehicleType: 'Tipo de vehículo', type: 'Tipo', additionalTypes: 'Tipos adicionales',
  characteristics: 'Características', documents: 'Documentación', photo: 'Foto', currentBase: 'Base actual',
  haveGas: 'Tiene GNC', 'Have Gas': 'Tiene GNC', gas: 'Tiene GNC',
  haveDiesel: 'Tiene diésel', 'Have Diesel': 'Tiene diésel', diesel: 'Tiene diésel',
  havePetrol: 'Tiene nafta', 'Have Petrol': 'Tiene nafta', petrol: 'Tiene nafta',
  airConditioning: 'Aire acondicionado', hasAirConditioning: 'Aire acondicionado',
};
const CRM_FIELD_ORDER = {
  passengers: ['code', 'passengerUserId', 'firstName', 'lastName', 'dni', 'phone', 'email', 'city', 'address', 'rate', 'family', 'paxNote', 'isPaxVip'],
  drivers: ['driverUserId', 'driverId', 'lastName', 'surname', 'firstName', 'name', 'phone', 'email', 'state'],
  vehicles: ['vehicleId', 'id', 'brand', 'model', 'plate', 'domain', 'year', 'photo', 'vehicleType', 'enabled', 'vehicleOwner', 'characteristics', 'documents'],
};
let crmVisible = false;
let crmSearchTimer;
let crmMode = 'control';
let crmOffset = 0;
let travelStateFilter = '';

function crmValue(value, key = '') {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(item => crmValue(item, key)).join(', ');
  if (typeof value === 'object') {
    const preferred = ['name', 'description', 'label', 'value', 'number', 'plate', 'domain', 'brand', 'model'];
    const readable = preferred.find(field => value[field] !== null && value[field] !== undefined && value[field] !== '');
    if (readable) return crmValue(value[readable], readable);
    return Object.entries(value).map(([field, item]) => `${crmFieldLabel(field)}: ${crmValue(item, field)}`).join(' · ');
  }
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if ((key.toLowerCase().includes('date') || key.toLowerCase().endsWith('at')) && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toLocaleString('es-AR');
  }
  return String(value);
}

function crmFieldLabel(key) {
  const normalized = String(key).replace(/[ _-]/g, '').toLowerCase();
  const match = Object.keys(CRM_FIELD_LABELS).find(label => label.replace(/[ _-]/g, '').toLowerCase() === normalized);
  return (match && CRM_FIELD_LABELS[match]) || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
}

function crmEscape(value, key = '') {
  return crmValue(value, key).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function renderCrmCards(data) {
  const cards = document.getElementById('crm-cards');
  cards.innerHTML = Object.entries(CRM_LABELS).map(([key, label]) =>
    `<article class="crm-card"><strong>${data[key] ?? 0}</strong><span>${label}</span></article>`
  ).join('');
}

function crmColumns(resource, items) {
  const available = new Set(items.flatMap(item => Object.keys(item.raw_payload || {})));
  if (resource === 'travels') ['state', 'travelDate', 'passengerId', 'driverId'].forEach(key => available.add(key));
  const preferred = CRM_FIELD_ORDER[resource] || [];
  const ordered = [...preferred.filter(key => available.has(key)), ...available].filter((key, index, all) => all.indexOf(key) === index);
  return ordered.filter(key => !['photo', 'documents', 'additionalTypes'].includes(key) || resource === 'vehicles').slice(0, 12);
}

function crmPhotoUrl(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.find(item => crmPhotoUrl(item)) ? crmPhotoUrl(value.find(item => crmPhotoUrl(item))) : '';
  if (value && typeof value === 'object') {
    for (const key of ['url', 'src', 'photo', 'path']) {
      const url = crmPhotoUrl(value[key]);
      if (url) return url;
    }
  }
  return '';
}

function renderCrmCell(value, key) {
  const url = key === 'photo' ? crmPhotoUrl(value) : '';
  if (url && /^https?:\/\//i.test(url)) {
    const safeUrl = crmEscape(url);
    return `<button type="button" class="vehicle-photo-button" data-photo-url="${safeUrl}"><img src="${safeUrl}" alt="Foto del vehículo" loading="lazy"></button>`;
  }
  return crmEscape(value, key);
}

function renderCrmTable(data) {
  const wrap = document.getElementById('crm-table-wrap');
  if (!data.items.length) { wrap.innerHTML = '<p class="crm-empty">No hay resultados.</p>'; return; }
  const resource = data.resource;
  const columns = crmColumns(resource, data.items);
  const rows = data.items.map(item => {
    const payload = { ...(item.raw_payload || {}),
      ...(item.state !== undefined ? { state: item.state } : {}),
      ...(item.travel_date !== undefined ? { travelDate: item.travel_date } : {}),
      ...(item.passenger_magiis_id !== undefined ? { passengerId: item.passenger_magiis_id } : {}),
      ...(item.driver_magiis_id !== undefined ? { driverId: item.driver_magiis_id } : {}),
    };
    return `<tr><td>${crmEscape(item.magiis_id, 'magiis_id')}</td>${columns.map(key => `<td title="${crmEscape(payload[key], key)}">${renderCrmCell(payload[key], key)}</td>`).join('')}</tr>`;
  });
  wrap.innerHTML = `<div class="crm-table-scroll"><table><thead><tr><th>ID</th>${columns.map(key => `<th>${crmEscape(crmFieldLabel(key))}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div><small>Mostrando ${data.items.length} de ${data.total}</small>`;
  wrap.querySelectorAll('.vehicle-photo-button').forEach(button => {
    button.addEventListener('click', () => openVehiclePhoto(button.dataset.photoUrl));
  });
}

function renderOperationalDashboard(snapshot) {
  const summary = snapshot.status || {};
  const dashboard = snapshot.drivers || {};
  const items = Array.isArray(dashboard) ? dashboard : dashboard.content || dashboard.page?.content || [];
  const drivers = { items, total: Array.isArray(dashboard) ? dashboard.length : dashboard.totalElements || items.length };
  const value = (key) => summary[key] ?? '—';
  const kpis = [
    ['Viajes realizados', value('travelsQuantity'), 'operational-kpi--primary'],
    ['Kilómetros', value('kilometersTotal'), ''],
    ['Vehículos operando', value('workingVehiclesQuantity'), ''],
    ['Viajes / vehículo', value('travelsPerVehicle'), ''],
    ['Choferes operando', value('drivers'), ''],
    ['Viajes / chofer', value('travelsPerDriver'), ''],
    ['Clientes del día', value('clientsIndividualsAmount'), ''],
    ['Clientes totales', value('clientsTotalAmount'), ''],
    ['Distribución por canal', value('webTotal'), 'operational-kpi--wide'],
  ];
  document.getElementById('operational-kpis').innerHTML = kpis.map(([label, amount, modifier]) =>
    `<article class="operational-kpi ${modifier}"><span>${crmEscape(label)}</span><strong>${crmEscape(amount)}</strong></article>`
  ).join('');

  const rows = (drivers.items || []).map(item => {
    const data = item;
    const name = [data.firstName || data.name, data.lastName || data.surname].filter(Boolean).join(' ') || '—';
    const vehicle = data.vehicle || '—';
    const state = data.driverState || '—';
    return `<tr><td>${crmEscape(data.driverUserId)}</td><td>${crmEscape(name)}</td><td>${crmEscape(typeof vehicle === 'object' ? vehicle.domain || vehicle.model || '—' : vehicle)}</td><td>${crmEscape(state)}</td><td>—</td></tr>`;
  }).join('');
  document.getElementById('operational-drivers').innerHTML = rows
    ? `<div class="operational-table-scroll"><table><thead><tr><th>ID</th><th>Chofer</th><th>Vehículo</th><th>Estado informado</th><th>Viaje actual</th></tr></thead><tbody>${rows}</tbody></table></div><small>Mostrando ${drivers.items.length} de ${drivers.total}</small>`
    : '<p class="crm-empty">No hay choferes registrados.</p>';
}

function renderDriverManagement(data) {
  const table = document.getElementById('driver-management-table');
  const rows = data.items.map(item => {
    const p = item.raw_payload || {};
    const name = p.name || [p.lastName || p.lastname, p.firstName || p.firstname].filter(Boolean).join(' ') || p.fullName || '—';
    const phone = p.phone || p.telephone || p.mobile || '—';
    const email = p.email || '—';
    const vehicle = p.vehicle || p.vehicleName || p.vehicleDomain || p.plate || '—';
    const active = p.active ?? p.isActive ?? p.enabled;
    const rating = p.rating ?? p.score ?? p.qualification;
    const evaluations = p.evaluations ?? p.ratingsCount ?? p.reviewCount;
    const vehicleText = typeof vehicle === 'object' ? (vehicle.domain || vehicle.plate || vehicle.name || '—') : vehicle;
    return `<tr><td>${crmEscape(item.magiis_id)}</td><td>${crmEscape(name)}</td><td><span class="driver-phone"><b>🇦🇷</b>${crmEscape(phone)}</span></td><td>${crmEscape(email)}</td><td class="driver-vehicle">${crmEscape(vehicleText)}</td><td>${crmEscape(p.vehicleType || p.type || 'Livre Taxi')}</td><td><span class="vehicle-active-dot ${active === false ? 'vehicle-inactive' : 'vehicle-active'}">●</span></td><td>${rating == null || rating === '' ? '—' : `${crmEscape(rating)}${evaluations == null ? '' : ` (${crmEscape(evaluations)})`}`}</td><td><button type="button" class="driver-action">◉</button><button type="button" class="driver-action">✎</button><button type="button" class="driver-action">☰</button></td></tr>`;
  }).join('');
  table.innerHTML = `<div class="driver-table-scroll"><table><thead><tr><th>Código<br><input data-driver-filter="code" placeholder="⌕"></th><th>Apellido y Nombre<br><input data-driver-filter="name" placeholder="⌕"></th><th>Teléfono<br><input data-driver-filter="phone" placeholder="⌕"></th><th>Email<br><input data-driver-filter="email" placeholder="⌕"></th><th>Vehículo<br><input data-driver-filter="vehicle" placeholder="⌕"></th><th>Tipo de Veh.</th><th>Activo</th><th>Calificación</th><th>Acciones</th></tr></thead><tbody>${rows || '<tr><td colspan="9">No hay choferes registrados.</td></tr>'}</tbody></table></div><div class="driver-table-footer"><span>${data.total} Filas　 <b>10</b>　20　50</span><span>‹　<b>1</b>　2　3　4　5　6　7　8　9　10　❯</span></div>`;
}

function renderVehicleManagement(data) {
  const table = document.getElementById('vehicle-management-table');
  const rows = data.items.map(item => {
    const p = item.raw_payload || {};
    const photo = crmPhotoUrl(p.photo || p.image || p.images);
    const name = [p.brand || p.make, p.model].filter(Boolean).join(' ') || '—';
    const owner = p.ownerName || p.owner || p.proprietor || '—';
    const active = p.active ?? p.isActive ?? p.enabled;
    const activeClass = active === false ? 'vehicle-inactive' : 'vehicle-active';
    return `<tr><td>${crmEscape(item.magiis_id)}</td><td><span class="vehicle-domain-cell">${photo && /^https?:\/\//i.test(photo) ? `<img src="${crmEscape(photo)}" alt="Vehículo" loading="lazy">` : '<span class="vehicle-image-empty">—</span>'}${crmEscape(p.domain || p.plate || p.licensePlate || '—')}</span></td><td>${crmEscape(p.brand || p.make || '—')}</td><td>${crmEscape(p.model || '—')}</td><td>${crmEscape(p.type || p.vehicleType || 'Livre Taxi')}</td><td class="vehicle-owner">${crmEscape(owner)}</td><td><span class="vehicle-active-dot ${activeClass}">●</span></td><td><button type="button" class="vehicle-action" aria-label="Ver vehículo">◉</button><button type="button" class="vehicle-action" aria-label="Editar vehículo">✎</button></td></tr>`;
  }).join('');
  table.innerHTML = `<div class="vehicle-table-scroll"><table><thead><tr><th>↕ Código</th><th>↕ Dominio</th><th>↕ Marca</th><th>↕ Modelo</th><th>↕ Tipo</th><th>↕ Propietario</th><th>Activo</th><th>Acciones</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No hay vehículos registrados.</td></tr>'}</tbody></table></div><div class="vehicle-table-footer"><span>Total: ${data.total}</span><span>Mostrar <b>20⌄</b>　1 de ${Math.max(1, Math.ceil(data.total / 20))}　❯❯</span><span>⟳</span></div>`;
}

function renderTravelManagement(data, summary) {
  const table = document.getElementById('travel-management-table');
  const pick = (payload, keys) => { for (const key of keys) if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') return payload[key]; return '—'; };
  const rows = data.items.map(item => {
    const p = item.raw_payload || item;
    const state = pick(p, ['state', 'status', 'travelStatus']);
    const driver = [p.driverFirstName, p.driverLastName].filter(Boolean).join(' ') || p.driverName || p.driver || '—';
    const passenger = [p.passengerFirstName, p.passengerLastName].filter(Boolean).join(' ') || p.passengerName || p.passenger || '—';
    return `<tr><td>${crmEscape(p.travelId ?? item.magiis_id)}</td><td>${crmEscape(p.serviceType || p.type || p.travelType || '—')}</td><td>${crmEscape(p.travelDate || p.creationDate || p.scheduledAt)}</td><td>${crmEscape(driver)}</td><td>${crmEscape(passenger)}</td><td>${crmEscape(p.origin || p.from || '—')}</td><td>${crmEscape(p.destination || p.to || '—')}</td><td>${crmEscape(p.finalPrice ?? p.budget ?? p.price ?? p.amount)}</td><td>${crmEscape(p.vehicleMark && p.vehicleModel ? `${p.vehicleMark} ${p.vehicleModel}` : p.vehicleType || p.vehicle || '—')}</td><td><span class="travel-state">${crmEscape(state)}</span></td><td>${crmEscape(p.etafromBase)}</td><td>${crmEscape(p.distanceToPPUP)}</td><td>${crmEscape(p.travelDuration)}</td><td>${crmEscape(p.candidateCanceledQty)}</td></tr>`;
  }).join('');
  table.innerHTML = `<div class="travel-table-scroll"><table><thead><tr><th>Código</th><th>Tipo</th><th>Fecha</th><th>Chofer</th><th>Pasajero</th><th>Origen</th><th>Destino</th><th>Presup.</th><th>Tipo de Vehículo</th><th>Estado</th><th>TEA</th><th>Distancia al Pasajero</th><th>T. en cola</th><th>Canc.-Cand</th></tr></thead><tbody>${rows || '<tr><td colspan="14">No hay viajes registrados.</td></tr>'}</tbody></table></div><div class="travel-table-footer"><span>Total: ${data.total}</span><span>Mostrar <b>${data.size || 20}</b> · página ${data.page || 1}</span></div>`;
  const sync = data.source === 'magiis' ? new Date().toLocaleString('es-AR') : summary.last_sync && (summary.last_sync.finished_at || summary.last_sync.started_at);
  document.getElementById('travel-management-sync').textContent = sync ? `Última actualización: ${sync}` : 'Última actualización: —';
}
async function loadCrmData() {
  const status = document.getElementById('crm-status');
  status.textContent = 'Cargando datos...';
  try {
    const resource = document.getElementById('crm-resource').value;
    const params = new URLSearchParams({ limit: resource === 'vehicles' ? '20' : '50', offset: String(crmOffset) });
    const query = resource === 'travels'
      ? document.getElementById('travel-management-search').value
      : resource === 'vehicles'
        ? document.getElementById('vehicle-management-search').value
        : document.getElementById('crm-search').value;
    if (query.trim()) params.set('q', query.trim());
    if (resource === 'travels') {
      const dateFrom = document.getElementById('travel-management-date-from').value;
      const dateTo = document.getElementById('travel-management-date').value;
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (travelStateFilter) params.set('state', travelStateFilter);
    }
    if (crmMode === 'control') {
      const snapshot = await apiOperational();
      renderOperationalDashboard(snapshot);
      status.textContent = 'Datos operativos actualizados.';
      return;
    }
    if (resource === 'travels') {
      const liveParams = new URLSearchParams({
        page: String(Math.floor(crmOffset / 20) + 1),
        size: '20',
        q: query.trim(),
        state: travelStateFilter,
        date_from: document.getElementById('travel-management-date-from').value,
        date_to: document.getElementById('travel-management-date').value,
      });
      const data = await apiCrm('travels/live?' + liveParams.toString());
      renderTravelManagement(data, {});
      const totals = data.totals || {};
      const counts = ['toAsignQuantity', 'inProgressQuantity', 'scheduledQuantity', 'inConflictQuantity', 'lostQuantity', 'cancelledQuantity', 'doneQuantity'];
      document.querySelectorAll('#travel-management-view .travel-status-tabs small').forEach((node, index) => {
        node.textContent = totals[counts[index]] ?? 0;
      });
      status.textContent = 'Viajes actualizados desde MAGIIS.';
      return;
    }
    const [summary, data] = await Promise.all([
      apiCrm('summary'),
      apiCrm(resource + '?' + params.toString()),
    ]);
    if (resource === 'drivers') renderDriverManagement(data);
    else if (resource === 'vehicles') renderVehicleManagement(data);
    else {
      renderCrmCards(summary);
      renderCrmTable(data);
    }
    status.textContent = summary.last_sync ? `Última sincronización: ${new Date(summary.last_sync.finished_at || summary.last_sync.started_at).toLocaleString('es-AR')}` : '';
  } catch (error) {
    status.textContent = 'No se pudieron cargar los datos del CRM.';
    console.error(error);
  }
}

function showCrm(resource) {
  crmVisible = true;
  crmMode = resource === 'control' ? 'control' : 'resource';
  if (resource === 'control') resource = 'travels';
  crmOffset = 0;
  travelStateFilter = '';
  const titles = {
    travels: ['Gestión de viajes', 'Listado y estado de los viajes.'],
    drivers: ['Choferes', 'Listado de choferes registrados.'],
    vehicles: ['Vehículos', 'Listado de vehículos registrados.'],
  };
  const title = crmMode === 'control' ? ['Control operacional', 'Resumen actualizado de la operación.'] : (titles[resource] || ['Gestión de datos', 'Datos registrados.']);
  document.getElementById('crm-title').textContent = title[0];
  document.getElementById('crm-subtitle').textContent = title[1];
  document.getElementById('crm-cards').hidden = true;
  document.getElementById('travel-management-view').hidden = crmMode !== 'resource' || resource !== 'travels';
  document.getElementById('driver-management-view').hidden = crmMode !== 'resource' || resource !== 'drivers';
  document.getElementById('vehicle-management-view').hidden = crmMode !== 'resource' || resource !== 'vehicles';
  document.getElementById('operational-view').hidden = crmMode !== 'control';
  document.querySelector('.crm-toolbar').hidden = crmMode === 'control' || (crmMode === 'resource' && (resource === 'travels' || resource === 'vehicles' || resource === 'drivers'));
  const genericTable = document.getElementById('crm-table-wrap');
  const usesDedicatedView = crmMode === 'resource' && ['travels', 'drivers', 'vehicles'].includes(resource);
  genericTable.hidden = crmMode === 'control' || usesDedicatedView;
  genericTable.style.display = usesDedicatedView || crmMode === 'control' ? 'none' : '';
  if (usesDedicatedView) genericTable.replaceChildren();
  if (resource) document.getElementById('crm-resource').value = resource;
  document.getElementById('message-list').hidden = true;
  document.getElementById('composer').hidden = true;
  document.getElementById('travel-form-view').hidden = true;
  document.getElementById('crm-dashboard').hidden = false;
  loadCrmData();
}

function hideCrm() {
  crmVisible = false;
  document.getElementById('crm-dashboard').hidden = true;
  document.getElementById('message-list').hidden = false;
  document.getElementById('composer').hidden = false;
}

function showChat() {
  document.getElementById('travel-form-view').hidden = true;
  document.getElementById('crm-dashboard').hidden = true;
  document.getElementById('message-list').hidden = false;
  document.getElementById('composer').hidden = false;
  crmVisible = false;
}

let travelMap = null;
let travelMapMarkers = [];
let travelRoute = null;
let geocodeTimers = {};

function initTravelMap() {
  if (travelMap || !window.L || !document.getElementById('travel-map')) return;
  travelMap = L.map('travel-map').setView([-38.7183, -62.2663], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(travelMap);
}

function refreshTravelMap() {
  const fields = [
    ['travel-origin', 'Origen'],
    ['travel-destination', 'Destino'],
  ];
  clearTimeout(geocodeTimers.map);
  geocodeTimers.map = setTimeout(async () => {
    initTravelMap();
    if (!travelMap) return;
    travelMapMarkers.forEach(marker => marker.remove());
    travelMapMarkers = [];
    travelRoute?.remove();
    travelRoute = null;
    const bounds = [];
    const routePoints = [];
    for (const [id, label] of fields) {
      const value = document.getElementById(id)?.value.trim();
      if (!value || value.length < 5) continue;
      try {
        const query = encodeURIComponent(`${value}, Bahía Blanca, Argentina`);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&q=${query}`, { headers: { Accept: 'application/json' } });
        const results = await response.json();
        if (!results.length) continue;
        const point = [Number(results[0].lat), Number(results[0].lon)];
        const marker = L.marker(point).addTo(travelMap).bindPopup(`${label}: ${value}`);
        travelMapMarkers.push(marker);
        bounds.push(point);
        routePoints.push([point[1], point[0]]);
      } catch (_) { /* el viaje sigue usando la resolución de MAGIIS */ }
    }
    if (routePoints.length === 2) {
      try {
        const route = encodeURIComponent(routePoints.map(point => point.join(',')).join(';'));
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${route}?overview=full&geometries=geojson`);
        const data = await response.json();
        if (data.routes?.[0]?.geometry) {
          travelRoute = L.geoJSON(data.routes[0].geometry, { style: { color: '#55b9a9', weight: 5, opacity: 0.85 } }).addTo(travelMap);
        }
      } catch (_) { /* los marcadores siguen visibles aunque OSRM no responda */ }
    }
    if (bounds.length) travelMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  }, 650);
}

function toggleTravelSchedule() {
  const enabled = document.getElementById('travel-programmed').checked;
  document.getElementById('travel-schedule-fields').hidden = !enabled;
  document.getElementById('travel-date').required = enabled;
  document.getElementById('travel-time').required = enabled;
}

function showTravelForm() {
  const lockScreen = document.getElementById('lock-screen');
  const app = document.getElementById('app');
  const view = document.getElementById('travel-form-view');
  const form = document.getElementById('travel-create-form');
  lockScreen.hidden = true;
  lockScreen.style.removeProperty('display');
  app.hidden = false;
  view.hidden = false;
  // Clear any stale inline state left by a previous panel/render transition.
  view.style.removeProperty('display');
  view.style.removeProperty('pointer-events');
  form.querySelectorAll('input, select, textarea').forEach(field => {
    field.disabled = false;
    field.readOnly = false;
    field.style.removeProperty('pointer-events');
  });
  document.getElementById('crm-dashboard').hidden = true;
  document.getElementById('message-list').hidden = true;
  document.getElementById('composer').hidden = true;
  crmVisible = false;
  initTravelMap();
  setTimeout(() => travelMap?.invalidateSize(), 0);
  form.elements.origin.focus();
}

function openVehiclePhoto(url) {
  const modal = document.getElementById('vehicle-photo-modal');
  const image = document.getElementById('vehicle-photo-large');
  image.src = url;
  modal.removeAttribute('hidden');
}

function closeVehiclePhoto() {
  const modal = document.getElementById('vehicle-photo-modal');
  const image = document.getElementById('vehicle-photo-large');
  modal.setAttribute('hidden', '');
  image.removeAttribute('src');
}

let travelQuote = null;
const PANEL_WHATSAPP_USER = '5492915650870';

async function createTravelFromForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById('travel-form-status');
  const quoteBox = document.getElementById('travel-quote');
  const cancelButton = document.getElementById('travel-cancel-button');
  const submit = form.querySelector('button[type="submit"]');
  const origin = form.elements.origin.value.trim();
  const destination = form.elements.destination.value.trim();
  const programmed = form.elements.programmed.checked;
  const date = form.elements.date.value;
  const time = form.elements.time.value;
  if (!origin || !destination) return;
  if (programmed && (!date || !time)) {
    status.textContent = 'Elegí fecha y hora para programar el viaje.';
    return;
  }

  const payload = {
    origen: origin,
    destino: destination,
    whatsapp_user: PANEL_WHATSAPP_USER,
    date_programmed: programmed ? `${date}T${time}:00` : null,
    conversation_id: travelQuote?.conversation_id || ('panel_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now())),
  };
  const confirming = Boolean(travelQuote
    && travelQuote.origin === origin
    && travelQuote.destination === destination
    && travelQuote.programmed === programmed
    && travelQuote.date === date
    && travelQuote.time === time);
  status.textContent = confirming ? 'Registrando viaje...' : 'Cotizando viaje...';
  submit.disabled = true;
  try {
    const endpoint = confirming ? '/elevenlabs/trip' : '/elevenlabs/quote';
    const response = await fetch(HASH_CLOUD_URL + endpoint, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'No se pudo procesar el viaje.');
    const result = data.result || '';

    if (!confirming) {
      if (!result || /no pude cotizar|error:/i.test(result) || !/\$\s*[\d.,]+/.test(result)) {
        throw new Error(result || 'No se pudo obtener la cotización.');
      }
      travelQuote = {
        conversation_id: payload.conversation_id,
        origin,
        destination,
        programmed,
        date,
        time,
      };
      quoteBox.textContent = result;
      quoteBox.hidden = false;
      status.textContent = 'Revisá la cotización y confirmá para crear el viaje.';
      submit.textContent = 'Confirmar y crear viaje';
      return;
    }

    status.textContent = result || 'Viaje creado correctamente.';
    const sentToMagiis = /Viaje pedido correctamente|Viaje ya registrado/i.test(result);
    cancelButton.hidden = !sentToMagiis;
    form.reset();
    quoteBox.hidden = true;
    quoteBox.textContent = '';
    submit.textContent = 'Cotizar viaje';
    travelQuote = null;
  } catch (error) {
    status.textContent = error.message || 'No se pudo procesar el viaje.';
  } finally {
    submit.disabled = false;
  }
}
async function cancelCreatedTravel() {
  const status = document.getElementById('travel-form-status');
  const cancelButton = document.getElementById('travel-cancel-button');
  cancelButton.disabled = true;
  status.textContent = 'Cancelando viaje...';
  try {
    const response = await fetch(HASH_CLOUD_URL + '/elevenlabs/cancel', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp_user: PANEL_WHATSAPP_USER, reason: 'Cancelación solicitada desde el panel' }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'No se pudo cancelar el viaje.');
    const result = data.result || '';
    status.textContent = result || 'Viaje cancelado.';
    if (/cancelado correctamente/i.test(result)) cancelButton.hidden = true;
  } catch (error) {
    status.textContent = error.message || 'No se pudo cancelar el viaje.';
  } finally {
    cancelButton.disabled = false;
  }
}


// ── Sesión ─────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'hash_token';
const TOKEN_EXPIRY_KEY = 'hash_token_expiry';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10);
  if (!token || Date.now() > expiry) {
    clearToken();
    return null;
  }
  return token;
}

function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

// Verificación periódica: si el token expiró, forzar logout
setInterval(() => {
  if (!getToken()) {
    clearToken();
    renderLoginScreen();
  }
}, 5 * 60 * 1000);

async function fetchIdentity() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(HASH_CLOUD_URL + '/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function apiLogin(username, password) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(HASH_CLOUD_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal
    });
    clearTimeout(id);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Credenciales inválidas');
    return data.token;
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') throw new Error('El servidor tardó demasiado en responder. Intentá de nuevo.');
    throw err;
  }
}


function logout() {
  clearToken();
  renderLoginScreen();
}

// ── Red: Chats ────────────────────────────────────────────────────────────

async function apiListChats() {
  const token = getToken();
  const res = await fetch(HASH_CLOUD_URL + '/chat/list', {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Error ' + res.status);
  return await res.json(); // [{chat_id, title, updated_at}, ...]
}

async function apiNewChat() {
  const token = getToken();
  const res = await fetch(HASH_CLOUD_URL + '/chat/new', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Error ' + res.status);
  return await res.json(); // {chat_id, title}
}

async function apiGetMessages(chatId) {
  const token = getToken();
  const res = await fetch(HASH_CLOUD_URL + '/chat/' + chatId + '/messages', {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Error ' + res.status);
  return await res.json(); // {chat_id, title, messages: [{role, content}]}
}

async function apiRenameChat(chatId, title) {
  const token = getToken();
  await fetch(HASH_CLOUD_URL + '/chat/' + chatId + '/title', {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

async function apiDeleteChat(chatId) {
  const token = getToken();
  await fetch(HASH_CLOUD_URL + '/chat/' + chatId, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token },
  });
}

async function askHash(messages, onChunk) {
  const token = getToken();
  const res = await fetch(HASH_CLOUD_URL + '/chat/stream', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, provider: activeProvider, chat_id: activeChatId || null, mode: activeMode }),
  });
  if (res.status === 403) { showUpgradeModal(); return ''; }
  if (!res.ok) throw new Error('Error ' + res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullReply = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const chunk = line.slice(6);
      if (chunk === '[DONE]') return fullReply;
      if (chunk.startsWith('[CHAT_ID] ')) {
        activeChatId = chunk.slice(10).trim();
        localStorage.setItem('hash_active_chat', activeChatId);
        continue;
      }
      if (chunk.startsWith('[ERROR]')) throw new Error(chunk.slice(8));
      fullReply += chunk.replace(/\\n/g, '\n');
      onChunk(fullReply);
    }
  }
  return fullReply;
}

// ── Estado ─────────────────────────────────────────────────────────────────

let FRONTS = [];         // [{chat_id, title, updated_at}]
function getSavedChatId() {
  const raw = localStorage.getItem('hash_active_chat');
  if (!raw || !/^[a-zA-Z0-9_-]{4,128}$/.test(raw)) {
    localStorage.removeItem('hash_active_chat');
    return null;
  }
  return raw;
}

let activeChatId = getSavedChatId();
let activeFrontId = activeChatId; // alias para compatibilidad con render
let messages = [];       // [{id, role, content/message, created_at}]
const chatCache = {};    // {chat_id: [messages]} — caché en memoria
let activeProvider = localStorage.getItem('hash_provider') || 'gemini';
let activeMode = localStorage.getItem('hash_mode') || 'conspiranoico';
let activeVoiceId = localStorage.getItem('hash_voice_id') || '9d3c497f84c54a05866931b56e66a6c4';

const PROVIDERS = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'groq',   label: 'Groq'   },
];

const VOICES = [
  { id: '9d3c497f84c54a05866931b56e66a6c4', label: 'Leo Messi' },
  { id: 'dfcda842af714d7ab87960f87a2b8deb', label: 'Javier Milei' },
  { id: '7294b76a7e4f4f3090f1c91cdcefe359', label: 'Cristina Kirchner' },
];

// ── Lógica ─────────────────────────────────────────────────────────────────

async function loadFronts() {
  try {
    const chats = await apiListChats();
    FRONTS = chats.map(c => ({ id: c.chat_id, name: c.title, chat_id: c.chat_id }));
  } catch {
    FRONTS = [];
  }

  if (!activeChatId || !FRONTS.find(f => f.chat_id === activeChatId)) {
    activeChatId = FRONTS[0]?.chat_id || null;
    activeFrontId = activeChatId;
  }

  renderFrontList();
  renderHeader();
  if (activeChatId) await syncFront(activeChatId);
}

async function syncFront(chatId) {
  // Si ya tenemos los mensajes en caché, los mostramos de inmediato
  if (chatCache[chatId]) {
    messages = chatCache[chatId];
    renderMessages();
    return;
  }
  setSyncStatus('loading', 'Cargando...');
  try {
    const data = await apiGetMessages(chatId);
    messages = data.messages.map((m, i) => ({
      id: String(i),
      role: m.role === 'assistant' ? 'hash' : m.role,
      message: m.content,
      created_at: new Date().toISOString(),
    }));
    chatCache[chatId] = messages;
    renderMessages();
    setSyncStatus('success', '');
  } catch {
    setSyncStatus('error', 'No se pudo cargar.');
  }
}



function openNewChat() {
  activeChatId = null;
  activeFrontId = null;
  localStorage.removeItem('hash_active_chat');
  messages = [];
  // Quitar selección activa del sidebar sin agregar item temporal
  renderFrontList();
  renderHeader();
  renderMessages();
  document.getElementById('message-input').focus();
}

async function createFront(name, _description) {
  // En el nuevo sistema el chat se crea en el back al mandar el primer mensaje.
  // Esta función solo actualiza el título una vez que ya tenemos activeChatId.
  if (activeChatId) {
    await apiRenameChat(activeChatId, name);
    FRONTS = FRONTS.map(f => f.chat_id === activeChatId ? { ...f, name } : f);
    renderFrontList();
    renderHeader();
  }
}

let isSending = false;



async function apiListMemoryDocs() {
  const token = getToken();
  const res = await fetch(HASH_CLOUD_URL + '/memory', {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Error ' + res.status);
  const data = await res.json();
  // Filtrar solo los TXTs subidos manualmente (no chat logs)
  return (data.documents || []).filter(d => !d.key.startsWith('chat_log'));
}

async function apiDeleteMemoryDoc(key) {
  const token = getToken();
  const res = await fetch(HASH_CLOUD_URL + '/memory/' + encodeURIComponent(key), {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Error ' + res.status);
  return await res.json();
}

async function uploadMemoryTxt(file) {
  const token = getToken();
  if (!token) return;
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(HASH_CLOUD_URL + '/memory/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData,
  });
  if (!res.ok) throw new Error('Error al subir el archivo');
  return await res.json();
}



async function uploadTextAsMemory(text) {
  const token = getToken();
  if (!token) return;
  const blob = new Blob([text], { type: 'text/plain' });
  const file = new File([blob], 'paste_' + Date.now() + '.txt', { type: 'text/plain' });
  const formData = new FormData();
  formData.append('file', file);
  const uploadUrl = new URL(HASH_CLOUD_URL + '/memory/upload');
  if (activeChatId) uploadUrl.searchParams.set('chat_id', activeChatId);
  const res = await fetch(uploadUrl.toString(), {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData,
  });
  if (res.status === 403) { showUpgradeModal(); return null; }
  if (!res.ok) throw new Error('Error al guardar en memoria');
  return await res.json();
}

async function saveMessage(texto, attachedFile) {
  if (isSending) return;
  // Mostrar mensaje del usuario de inmediato
  const userMsg = {
    id: crypto.randomUUID(),
    role: 'user',
    message: texto,
    attachedFile: attachedFile || null,
    created_at: new Date().toISOString(),
  };
  messages = [...messages, userMsg];
  renderMessages();

  // Burbuja de espera
  const tempMsg = {
    id: crypto.randomUUID(),
    role: 'hash',
    message: '',
    created_at: new Date().toISOString(),
    loading: true,
  };
  messages = [...messages, tempMsg];
  renderMessages();
  setSyncStatus('loading', 'LIVRE está pensando...');

  isSending = true;
  try {
    // Construir historial para el back (sin el tempMsg)
    const contextMessages = messages
      .filter(m => !m.loading && m.message && m.message.trim())
      .map(m => ({
        role: m.role === 'hash' ? 'assistant' : 'user',
        content: m.message,
      }));

    const reply = await askHash(contextMessages, (partial) => {
      messages[messages.length - 1].message = partial;
      messages[messages.length - 1].loading = false;
      renderMessages();
    });

    messages[messages.length - 1].message = reply;
    messages[messages.length - 1].loading = false;
    // Si la respuesta es vacía (ej: límite alcanzado), quitamos la burbuja
    if (!reply) {
      messages = messages.filter(m => m.id !== tempMsg.id);
      renderMessages();
      return;
    }
    if (activeChatId) chatCache[activeChatId] = messages;
    renderMessages();

    // Si es el primer mensaje, agregar el chat al sidebar
    if (!FRONTS.find(f => f.chat_id === activeChatId)) {
      const autoTitle = texto.slice(0, 50).trim();
      FRONTS = [{ id: activeChatId, chat_id: activeChatId, name: autoTitle }, ...FRONTS];
      activeFrontId = activeChatId;
      renderFrontList();
      renderHeader();
    }

    setSyncStatus('success', '');
  } catch (err) {
    messages = messages.filter(m => !m.loading);
    renderMessages();
    setSyncStatus('error', 'No se pudo enviar el mensaje. Intentá de nuevo.');
    console.error('saveMessage error:', err);
  } finally {
    isSending = false;
  }
}

async function deleteFront(frontId) {
  await apiDeleteChat(frontId);
  FRONTS = FRONTS.filter(f => f.chat_id !== frontId);
  if (activeChatId === frontId) {
    activeChatId = FRONTS[0]?.chat_id || null;
    activeFrontId = activeChatId;
    if (activeChatId) localStorage.setItem('hash_active_chat', activeChatId);
    else localStorage.removeItem('hash_active_chat');
    messages = [];
  }
  renderFrontList();
  renderHeader();
  renderMessages();
}

async function renameFront(frontId, newName) {
  await apiRenameChat(frontId, newName);
  FRONTS = FRONTS.map(f => f.chat_id === frontId ? { ...f, name: newName } : f);
  renderFrontList();
  renderHeader();
}

function confirmDeleteFront(front) {
  const modal = document.getElementById('confirm-delete-modal');
  document.getElementById('confirm-delete-name').textContent = front.name;
  modal.removeAttribute('hidden');
  document.getElementById('confirm-delete-ok').onclick = async () => {
    modal.setAttribute('hidden', '');
    try {
      await deleteFront(front.chat_id);
    } catch (err) {
      setSyncStatus('error', 'No se pudo eliminar el chat. Intentá de nuevo.');
    }
  };
  document.getElementById('confirm-delete-cancel').onclick = () => modal.setAttribute('hidden', '');
}

function openRenameModal(front) {
  const modal = document.getElementById('rename-modal');
  const input = document.getElementById('rename-input');
  const status = document.getElementById('rename-status');
  input.value = front.name;
  status.textContent = '';
  modal.removeAttribute('hidden');
  input.focus();
  input.select();
  document.getElementById('rename-cancel').onclick = () => modal.setAttribute('hidden', '');
  document.getElementById('rename-submit').onclick = async () => {
    const newName = input.value.trim();
    if (!newName || newName === front.name) { modal.setAttribute('hidden', ''); return; }
    document.getElementById('rename-submit').disabled = true;
    status.textContent = 'Guardando...';
    try {
      await renameFront(front.id, newName);
      modal.setAttribute('hidden', '');
    } catch (err) {
      status.textContent = 'No se pudo renombrar. Intentá de nuevo.';
      console.error('renameFront error:', err);
      document.getElementById('rename-submit').disabled = false;
    }
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') document.getElementById('rename-submit').click();
    if (e.key === 'Escape') modal.setAttribute('hidden', '');
  };
}

const draftCache = {};

function saveDraft() {
  const input = document.getElementById('message-input');
  if (activeChatId && input) {
    draftCache[activeChatId] = input.value;
  }
}

function restoreDraft(chatId) {
  const input = document.getElementById('message-input');
  if (input) {
    input.value = draftCache[chatId] || '';
    input.style.height = 'auto';
    if (input.value) input.style.height = input.scrollHeight + 'px';
  }
}

function selectFront(chatId) {
  saveDraft();
  activeChatId = chatId;
  activeFrontId = chatId;
  localStorage.setItem('hash_active_chat', chatId);
  renderFrontList();
  renderHeader();
  syncFront(chatId);
  restoreDraft(chatId);
}

// ── Render ─────────────────────────────────────────────────────────────────

function renderLoginScreen() {
  document.getElementById('app').setAttribute('hidden', '');
  const screen = document.getElementById('lock-screen');
  screen.removeAttribute('hidden');

  // Estilos inline del lock-screen para centrar y cubrir toda la pantalla
  Object.assign(screen.style, {
    position: 'fixed', inset: '0', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: '#f4f4f4',
  });

  const box = document.getElementById('lock-box');
  Object.assign(box.style, {
    background: '#fff', borderRadius: '16px',
    padding: '40px 36px', width: '100%', maxWidth: '360px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    boxSizing: 'border-box',
  });

  box.innerHTML =
    '<img src="images/logo_livre.png" alt="LIVRE" style="height:56px;margin-bottom:8px;">' +
    '<input id="auth-username" type="text" placeholder="Usuario" autocomplete="username" style="width:100%;padding:12px 14px;border:1px solid #ddd;border-radius:8px;font-size:15px;outline:none;box-sizing:border-box;">' +
    '<input id="auth-password" type="password" placeholder="Contraseña" autocomplete="current-password" style="width:100%;padding:12px 14px;border:1px solid #ddd;border-radius:8px;font-size:15px;outline:none;box-sizing:border-box;">' +
    '<p id="auth-error" style="color:#e03;font-size:13px;margin:0;display:none;width:100%;"></p>' +
    '<button id="auth-submit" type="button" style="width:100%;padding:13px;background:#e8154b;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;letter-spacing:0.04em;margin-top:4px;">ENTRAR</button>';

  const usernameEl = document.getElementById('auth-username');
  const passwordEl = document.getElementById('auth-password');
  const submitBtn  = document.getElementById('auth-submit');
  const errEl      = document.getElementById('auth-error');

  async function doLogin() {
    const username = usernameEl.value.trim();
    const password = passwordEl.value;
    errEl.style.display = 'none';
    if (!username || !password) { errEl.textContent = 'Completá todos los campos.'; errEl.style.display = 'block'; return; }
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Entrando...';
      console.log('Login iniciado...');
      const token = await apiLogin(username, password);
      console.log('Token recibido, bootApp iniciado...');
      setToken(token);
      await bootApp();
      console.log('bootApp finalizado.');
    } catch (err) {
      console.error('Error en doLogin:', err);
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'ENTRAR';
    }
  }

  submitBtn.addEventListener('click', doLogin);
  passwordEl.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  usernameEl.addEventListener('keydown', e => { if (e.key === 'Enter') passwordEl.focus(); });
}

function closeSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  if (s) s.classList.remove('sidebar--open');
  if (o) o.classList.remove('sidebar-overlay--visible');
}

function renderFrontList() {
  // La navegación principal reemplaza el historial de conversaciones.
}

function renderHeader() {
  const front = FRONTS.find(f => f.chat_id === activeChatId);
  document.getElementById('active-front-name').textContent = front ? front.name : '—';
  const desc = document.getElementById('active-front-description');
  if (desc) desc.textContent = '';
}

function renderMessages(lastReply) {
  const list = document.getElementById('message-list');
  list.innerHTML = '';

  if (!messages.length) {
    const p = document.createElement('p');
    p.className = 'message-list-empty message-list-empty--centered';
    p.textContent = 'Tus chats están cifrados de extremo a extremo.';
    list.appendChild(p);
    return;
  }

  [...messages]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach((msg, i) => {
      const isHash = msg.role === 'hash';
      const text = msg.message;
      const isLast = i === messages.length - 1;

      const item = document.createElement('div');
      item.className = 'message-item' + (isHash ? ' message-item--hash' : '');
      item.dataset.messageId = msg.id;

      if (isHash && msg.loading) {
        const safeDate = formatDate(msg.created_at);
        const dateSpan = document.createElement('span');
        dateSpan.className = 'message-item-date';
        dateSpan.textContent = safeDate;
        const thinking = document.createElement('div');
        thinking.className = 'hash-thinking';
        thinking.innerHTML = '<span></span><span></span><span></span>';
        item.appendChild(dateSpan);
        item.appendChild(thinking);
      } else {
        const safeDate = formatDate(msg.created_at);
        const dateSpan = document.createElement('span');
        dateSpan.className = 'message-item-date';
        dateSpan.textContent = safeDate;

        const textP = document.createElement('p');
        textP.className = 'message-item-text';
        textP.innerHTML = renderMarkdown(escapeHtml(text));

        item.appendChild(dateSpan);

        // Chip de archivo adjunto
        if (msg.attachedFile) {
          const fileChip = document.createElement('div');
          fileChip.className = 'message-file-chip';
          fileChip.innerHTML = '<span class="memory-chip-icon">📄</span><span class="memory-chip-label">' + escapeHtml(msg.attachedFile) + '</span>';
          item.appendChild(fileChip);
        }

        if (textP.innerHTML) item.appendChild(textP);

        if (isHash) {
          const actions = document.createElement('div');
          actions.innerHTML = messageActionsHtml();
          item.appendChild(actions.firstChild);
        }
      }



      list.appendChild(item);
    });

  list.scrollTop = list.scrollHeight;
}

// ── Acciones de mensaje (parlante + copy) ─────────────────────────────────

const ICON_SPEAKER =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';

const ICON_STOP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1"></rect></svg>';

const ICON_COPY =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

const ICON_CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

function messageActionsHtml() {
  return (
    '<div class="message-actions">' +
      '<button type="button" class="message-action-btn message-action-btn--speak" aria-label="Escuchar mensaje">' + ICON_SPEAKER + '</button>' +
      '<button type="button" class="message-action-btn message-action-btn--copy" aria-label="Copiar mensaje">' + ICON_COPY + '</button>' +
    '</div>'
  );
}

let speakingMessageId = null;
let activeAudioCtx = null;
let activeAudioSource = null;

function stopSpeaking(btn) {
  if (activeAudioCtx) {
    try { activeAudioCtx.close(); } catch {}
    activeAudioCtx = null;
    activeAudioSource = null;
  }
  speakingMessageId = null;
  if (btn) {
    btn.classList.remove('message-action-btn--active');
    btn.innerHTML = ICON_SPEAKER;
  }
  document.querySelectorAll('.message-action-btn--speak.message-action-btn--active').forEach(b => {
    b.classList.remove('message-action-btn--active');
    b.innerHTML = ICON_SPEAKER;
  });
}

async function speakMessage(btn, text) {
  const item = btn.closest('.message-item');
  const id = item ? item.dataset.messageId : null;

  // Toggle: si ya está sonando este mensaje, lo paramos
  if (speakingMessageId === id) {
    stopSpeaking(btn);
    return;
  }

  stopSpeaking(null);

  btn.classList.add('message-action-btn--active');
  btn.innerHTML = ICON_STOP;
  speakingMessageId = id;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-AR';
  utterance.onend = () => stopSpeaking(btn);
  utterance.onerror = () => stopSpeaking(btn);
  activeAudioCtx = { close: () => speechSynthesis.cancel() };
  speechSynthesis.speak(utterance);
}

async function playChunks(chunks, btn) {
  try {
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { merged.set(c, offset); offset += c.length; }

    const blob = new Blob([merged], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    activeAudioCtx = { close: () => { audio.pause(); URL.revokeObjectURL(url); } };

    audio.onended = () => { URL.revokeObjectURL(url); stopSpeaking(btn); };
    audio.onerror = () => { URL.revokeObjectURL(url); stopSpeaking(btn); };
    await audio.play();
  } catch {
    stopSpeaking(btn);
  }
}

async function copyMessage(btn, text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return;
  }
  btn.classList.add('message-action-btn--active');
  btn.innerHTML = ICON_CHECK;
  setTimeout(() => {
    btn.classList.remove('message-action-btn--active');
    btn.innerHTML = ICON_COPY;
  }, 1200);
}

function initMessageActions() {
  const list = document.getElementById('message-list');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const speakBtn = e.target.closest('.message-action-btn--speak');
    const copyBtn = e.target.closest('.message-action-btn--copy');
    if (!speakBtn && !copyBtn) return;

    const item = e.target.closest('.message-item');
    if (!item) return;
    const id = item.dataset.messageId;
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    if (speakBtn) speakMessage(speakBtn, msg.message);
    if (copyBtn) copyMessage(copyBtn, msg.message);
  });
}

function setSyncStatus(state, text) {
  const el = document.getElementById('sync-status');
  if (el) { el.dataset.state = state; el.textContent = text; }
  const busy = state === 'loading';
  const syncBtn = document.getElementById('sync-button');
  if (syncBtn) syncBtn.disabled = busy;
  const submitBtn = document.getElementById('message-submit');
  if (submitBtn) submitBtn.disabled = busy;
}

// ── Utilidades ─────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function renderMarkdown(str) {
  // Aplicar después de escapeHtml, así los tags HTML ya están escapados
  return str
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Init ───────────────────────────────────────────────────────────────────

// ── Modal upgrade ─────────────────────────────────────────────────────────

function showUpgradeModal() {
  let modal = document.getElementById('upgrade-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'upgrade-modal';
    modal.innerHTML = `
      <div id="upgrade-modal-box">
        <button type="button" id="upgrade-modal-close">✕</button>
        <div id="upgrade-modal-icon"><img src="images/favicon.png" alt="HASH" style="width:48px;height:48px;"></div>
        <h3 style="text-transform:uppercase;">Alcanzaste el límite del plan free</h3>
        <p style="font-size:0.78rem;color:#aaa;margin:0 0 10px;">Tus mensajes se restablecen en 24 hs. O pasate a Pro y chateá sin límites.</p>
        <ul>
          <li>✓ Mensajes ilimitados</li>
          <li>✓ Hasta 20 documentos en memoria</li>
          <li>✓ Búsqueda semántica avanzada</li>
        </ul>
        <p class="upgrade-price">$5 USD / mes</p>
        <div class="upgrade-pay-btns">
          <a class="upgrade-pay-btn" href="https://www.paypal.com/ncp/payment/VPXEFLL833YWN" target="_blank" rel="noopener">
            <img class="pay-logo" src="images/paypal-icon.svg" alt="PayPal">
          </a>
          <button type="button" class="upgrade-pay-btn" id="upgrade-btn-mp">
            <img class="pay-logo" src="images/mercado_pago.svg" alt="Mercado Pago">
          </button>
          <button type="button" class="upgrade-pay-btn" id="upgrade-btn-usdt">
            <img class="pay-logo" src="images/btc-usdt.svg" alt="Crypto">
          </button>
        </div>
        <div id="upgrade-usdt-panel" hidden>
          <p class="usdt-wallet-label">Enviá exactamente <strong>10 USDT</strong> por red Tron (TRC20):</p>
          <div class="usdt-wallet-row">
            <span class="usdt-wallet-addr">TDPfrfpipHtENAANT2zkgLZNFmZE6MaJRw</span>
            <button type="button" id="upgrade-usdt-copy">Copiar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.setAttribute('hidden', ''); });
    document.getElementById('upgrade-modal-close').addEventListener('click', () => modal.setAttribute('hidden', ''));

    // Mercado Pago
    document.getElementById('upgrade-btn-mp').addEventListener('click', async () => {
      const btn = document.getElementById('upgrade-btn-mp');
      btn.disabled = true;
      btn.querySelector('span:last-child').textContent = '...';
      const token = getToken();
      try {
        const res = await fetch(HASH_CLOUD_URL + '/payments/mercadopago/create', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 5, description: "HASH Pro" }),
        });
        const data = await res.json();
        if (data.init_point) window.open(data.init_point, '_blank');
      } catch { }
      btn.disabled = false;
      btn.querySelector('span:last-child').textContent = 'Mercado Pago';
    });

    // USDT — despliega wallet inline
    document.getElementById('upgrade-btn-usdt').addEventListener('click', () => {
      const panel = document.getElementById('upgrade-usdt-panel');
      panel.hasAttribute('hidden') ? panel.removeAttribute('hidden') : panel.setAttribute('hidden', '');
    });
    document.getElementById('upgrade-usdt-copy').addEventListener('click', () => {
      const btn = document.getElementById('upgrade-usdt-copy');
      fallbackCopy('TDPfrfpipHtENAANT2zkgLZNFmZE6MaJRw', null);
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
    });
  }
  modal.removeAttribute('hidden');
}


function fallbackCopy(text, statusEl) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    if (statusEl) { statusEl.textContent = "✓ Dirección copiada"; setTimeout(() => { statusEl.textContent = ""; }, 2500); }
  } catch(e) {}
  document.body.removeChild(ta);
}

let _paypalRendered = false;

function showCryptoModal() {
  const modal = document.getElementById("crypto-modal");
  if (!modal) return;
  modal.removeAttribute("hidden");
  document.getElementById("crypto-modal-close").onclick = () => modal.setAttribute("hidden", "");
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.setAttribute("hidden", ""); });

  // Registrar email pendiente de pago
  const token = getToken();
  if (token) {
    fetch(HASH_CLOUD_URL + '/auth/payment/pending', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    }).catch(() => {});
  }

  // Copiar wallet USDT
  const copyBtn = document.getElementById("crypto-copy-btn");
  const WALLET = "TDPfrfpipHtENAANT2zkgLZNFmZE6MaJRw";
  if (copyBtn) copyBtn.onclick = () => fallbackCopy(WALLET, null);

  // Selector de método de pago
  const methodBtns = document.querySelectorAll(".pay-method-btn");
  const panels = document.querySelectorAll(".pay-panel");

  methodBtns.forEach(btn => {
    btn.onclick = () => {
      methodBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const method = btn.dataset.method;
      panels.forEach(p => p.setAttribute("hidden", ""));
      const panel = document.getElementById("pay-panel-" + method);
      if (panel) panel.removeAttribute("hidden");

      // Renderizar PayPal solo una vez
      if (method === "paypal" && !_paypalRendered && window.paypal) {
        _paypalRendered = true;
        paypal.HostedButtons({ hostedButtonId: "VPXEFLL833YWN" }).render("#paypal-container-VPXEFLL833YWN");
      }
    };
  });

  // Mercado Pago
  const mpBtn = document.getElementById("mp-pay-btn");
  if (mpBtn) {
    mpBtn.onclick = async () => {
      mpBtn.disabled = true;
      mpBtn.textContent = "Generando link...";
      try {
        const res = await fetch(HASH_CLOUD_URL + '/payments/mercadopago/create', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 5, description: "HASH Pro" }),
        });
        const data = await res.json();
        if (data.init_point) {
          window.open(data.init_point, '_blank');
        } else {
          mpBtn.textContent = "Error, intentá de nuevo";
        }
      } catch {
        mpBtn.textContent = "Error, intentá de nuevo";
      } finally {
        mpBtn.disabled = false;
        setTimeout(() => { mpBtn.textContent = "Pagar con Mercado Pago"; }, 3000);
      }
    };
  }
}
function initApp() {
  initMessageActions();
  initVoiceChat();

  // Selector de modo
  document.querySelectorAll('.mode-btn').forEach(btn => {
    if (btn.dataset.mode === activeMode) btn.classList.add('mode-btn--active');
    btn.addEventListener('click', () => {
      activeMode = btn.dataset.mode;
      localStorage.setItem('hash_mode', activeMode);
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('mode-btn--active'));
      btn.classList.add('mode-btn--active');
    });
  });


  const syncBtn = document.getElementById('sync-button');
  if (syncBtn) syncBtn.addEventListener('click', () => syncFront(activeFrontId));



  document.getElementById('message-submit').addEventListener('click', async () => {
    const input = document.getElementById('message-input');
    const texto = input.value.trim();
    if (!texto) return;
    input.value = '';
    input.style.height = 'auto';
    await saveMessage(texto);
  });

  document.getElementById('message-input').addEventListener('keydown', async (e) => {
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      if (isSending) return;
      const input = document.getElementById('message-input');
      const texto = input.value.trim();
      if (!texto) return;
      input.value = '';
      input.style.height = 'auto';
      await saveMessage(texto);
    }
  });

  const msgInput = document.getElementById('message-input');
  msgInput.addEventListener('input', () => {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 200) + 'px';
  });

  const modal       = document.getElementById('new-front-modal');
  const cancelBtn   = document.getElementById('new-front-cancel');
  const submitBtn   = document.getElementById('new-front-submit');
  const nameInput   = document.getElementById('new-front-name');
  const descInput   = document.getElementById('new-front-description');
  const modalStatus = document.getElementById('new-front-status');

  function closeModal() { modal.setAttribute('hidden', ''); }
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  submitBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    modalStatus.textContent = 'Guardando...';
    try {
      await createFront(name, descInput.value);
      closeModal();
    } catch (err) {
      modalStatus.textContent = 'No se pudo guardar. Intentá de nuevo.';
      console.error('createFront error:', err);
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });

  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitBtn.click(); });

  // Settings
  const settingsModal = document.getElementById('settings-modal');
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.setAttribute('hidden', '');
  });
  settingsModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') settingsModal.setAttribute('hidden', '');
  });

  // Cargar memoria desde ajustes
  const settingsMemoryInput = document.createElement('input');
  settingsMemoryInput.type = 'file';
  settingsMemoryInput.accept = '.txt';
  settingsMemoryInput.style.display = 'none';
  settingsMemoryInput.id = 'settings-memory-input';
  settingsMemoryInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    const btn = document.getElementById('settings-load-memory');
    if (btn) { btn.textContent = ''; btn.innerHTML = '<span class="btn-spinner"></span>'; btn.disabled = true; }
    try {
      const res = await fetch(HASH_CLOUD_URL + '/memory/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData,
      });
      if (!res.ok) throw new Error('Error ' + res.status);
      if (btn) { btn.innerHTML = '<span class="btn-check">✓</span> Cargada'; btn.classList.add('btn-success'); }
      setTimeout(() => {
        if (btn) { btn.innerHTML = 'Cargar memoria'; btn.disabled = false; btn.classList.remove('btn-success'); }
      }, 3000);
    } catch (err) {
      if (btn) { btn.innerHTML = 'Error ✕'; btn.disabled = false; }
      setTimeout(() => {
        if (btn) { btn.innerHTML = 'Cargar memoria'; }
      }, 3000);
    }
    settingsMemoryInput.value = '';
  };
  document.body.appendChild(settingsMemoryInput);

  const loadMemoryBtn = document.getElementById('settings-load-memory');
  if (loadMemoryBtn) loadMemoryBtn.addEventListener('click', () => settingsMemoryInput.click());

  // Lista de TXTs cargados
  async function renderMemoryDocList() {
    const container = document.getElementById('memory-doc-list');
    if (!container) return;
    container.innerHTML = '<span class="memory-doc-loading">Cargando...</span>';
    try {
      const docs = await apiListMemoryDocs();
      if (!docs.length) {
        container.innerHTML = '<span class="memory-doc-empty">Sin archivos cargados.</span>';
        return;
      }
      container.innerHTML = '';
      docs.forEach(doc => {
        const row = document.createElement('div');
        row.className = 'memory-doc-row';
        const name = document.createElement('span');
        name.className = 'memory-doc-name';
        name.textContent = doc.name;
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'memory-doc-delete';
        delBtn.textContent = 'Eliminar';
        delBtn.onclick = async () => {
          delBtn.disabled = true;
          delBtn.textContent = '...';
          try {
            await apiDeleteMemoryDoc(doc.key);
            row.remove();
            if (!container.children.length) {
              container.innerHTML = '<span class="memory-doc-empty">Sin archivos cargados.</span>';
            }
          } catch {
            delBtn.textContent = 'Error';
            setTimeout(() => { delBtn.textContent = 'Eliminar'; delBtn.disabled = false; }, 2000);
          }
        };
        row.appendChild(name);
        row.appendChild(delBtn);
        container.appendChild(row);
      });
    } catch {
      container.innerHTML = '<span class="memory-doc-empty">No se pudo cargar la lista.</span>';
    }
  }

  // Cargar lista cuando se abre el modal de ajustes
  const settingsModalEl = document.getElementById('settings-modal');
  const settingsObserver = new MutationObserver(() => {
    if (!settingsModalEl.hasAttribute('hidden')) renderMemoryDocList();
  });
  settingsObserver.observe(settingsModalEl, { attributes: true, attributeFilter: ['hidden'] });

  // Cerrar sesión desde ajustes
  const settingsLogoutBtn = document.getElementById('settings-logout');
  if (settingsLogoutBtn) settingsLogoutBtn.addEventListener('click', logout);

  const exportMemoryBtn = document.getElementById('settings-export-memory');
  if (exportMemoryBtn) {
    exportMemoryBtn.addEventListener('click', async () => {
      const token = getToken();
      if (!token) return;
      exportMemoryBtn.textContent = 'Descargando...';
      exportMemoryBtn.disabled = true;
      try {
        const res = await fetch(HASH_CLOUD_URL + '/memory/export', {
          headers: { 'Authorization': 'Bearer ' + token },
        });
        if (!res.ok) throw new Error('Error al exportar');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'memoria_hash.txt';
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert('No se pudo descargar la memoria.');
      } finally {
        exportMemoryBtn.textContent = 'Descargar memoria';
        exportMemoryBtn.disabled = false;
      }
    });
  }

  const fontRange = document.getElementById('settings-font-size');
  const fontLabel = document.getElementById('settings-font-label');
  const savedFont = localStorage.getItem('hash_font_size') || '18';
  fontRange.value = savedFont;
  fontLabel.textContent = savedFont + 'px';
  document.documentElement.style.setProperty('--font-size-base', savedFont + 'px');
  fontRange.addEventListener('input', () => {
    const val = fontRange.value;
    fontLabel.textContent = val + 'px';
    document.documentElement.style.setProperty('--font-size-base', val + 'px');
    localStorage.setItem('hash_font_size', val);
  });
  const hamburger = document.getElementById('hamburger');
  const overlay = document.getElementById('sidebar-overlay');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      if (window.innerWidth > 640) {
        document.getElementById('sidebar').classList.toggle('sidebar--hidden');
        return;
      }
      document.getElementById('sidebar').classList.toggle('sidebar--open');
      if (overlay) overlay.classList.toggle('sidebar-overlay--visible');
    });
  }
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Abrir sidebar al entrar a la app (mobile y desktop)
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 640) {
    sidebar.classList.add('sidebar--open');
    if (overlay) overlay.classList.add('sidebar-overlay--visible');
  }

  // Swipe: izquierda a derecha abre, derecha a izquierda cierra
  // Sin passive:true para poder bloquear el gesto de Safari/PWA
  let touchStartX = null;
  let touchStartY = null;
  let swipeFromEdge = false;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    swipeFromEdge = touchStartX < 40;
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!swipeFromEdge) return;
    e.preventDefault(); // bloquea navegación de Safari cuando viene del borde
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const reset = () => { touchStartX = null; touchStartY = null; swipeFromEdge = false; };
    if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 40) { reset(); return; }
    if (dx > 0) {
      sidebar.classList.add('sidebar--open');
      if (overlay) overlay.classList.add('sidebar-overlay--visible');
    } else {
      closeSidebar();
    }
    reset();
  }, { passive: true });
}

// ── Auth ───────────────────────────────────────────────────────────────────

async function bootApp() {
  const identity = await fetchIdentity();
  if (!identity) {
    clearToken();
    renderLoginScreen();
    return;
  }
  const lockScreen = document.getElementById('lock-screen');
  lockScreen.setAttribute('hidden', '');
  lockScreen.style.removeProperty('display');
  document.getElementById('app').removeAttribute('hidden');
  try {
    initApp();
    document.querySelectorAll('#main-navigation .main-nav-item').forEach(item => item.classList.toggle('main-nav-item--active', item.dataset.view === 'control'));
    showCrm('control');
  } catch (err) {
    console.error('Error en initApp:', err);
  }
  void loadFronts().catch(err => console.warn('Carga secundaria (chats) falló:', err));
}

async function checkAuth() {
  await bootApp();
}

document.addEventListener('DOMContentLoaded', () => {
  const savedFont = localStorage.getItem('hash_font_size') || '18';
  document.documentElement.style.setProperty('--font-size-base', savedFont + 'px');
  document.querySelectorAll('#main-navigation .main-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#main-navigation .main-nav-item').forEach(item => item.classList.remove('main-nav-item--active'));
      btn.classList.add('main-nav-item--active');
      const view = btn.dataset.view;
      if (view === 'control') {
        showCrm('control');
      } else if (view === 'travels' || view === 'drivers' || view === 'vehicles') {
        showCrm(view);
      } else if (view === 'crear-viaje') {
        showTravelForm();
      } else {
        showChat();
      }
      closeSidebar();
    });
  });
  document.getElementById('crm-back').addEventListener('click', showChat);
  document.getElementById('crm-refresh').addEventListener('click', loadCrmData);
  document.getElementById('travel-create-form').addEventListener('submit', createTravelFromForm);
  document.getElementById('travel-cancel-button').addEventListener('click', cancelCreatedTravel);
  document.getElementById('travel-programmed').addEventListener('change', toggleTravelSchedule);
  document.getElementById('travel-origin').addEventListener('input', refreshTravelMap);
  document.getElementById('travel-destination').addEventListener('input', refreshTravelMap);
  document.getElementById('vehicle-photo-close').addEventListener('click', closeVehiclePhoto);
  document.getElementById('vehicle-photo-modal').addEventListener('click', event => {
    if (event.target.id === 'vehicle-photo-modal') closeVehiclePhoto();
  });
  document.getElementById('crm-resource').addEventListener('change', () => {
    crmOffset = 0;
    travelStateFilter = '';
    loadCrmData();
  });
  const reloadFromStart = () => {
    clearTimeout(crmSearchTimer);
    crmOffset = 0;
    crmSearchTimer = setTimeout(loadCrmData, 350);
  };
  document.getElementById('crm-search').addEventListener('input', reloadFromStart);
  document.getElementById('travel-management-search').addEventListener('input', reloadFromStart);
  document.getElementById('travel-management-date-from').addEventListener('change', reloadFromStart);
  document.getElementById('travel-management-date').addEventListener('change', reloadFromStart);
  document.getElementById('vehicle-management-search').addEventListener('input', reloadFromStart);
  const travelStates = [
    'SEARCHING_DRIVER-WITH_DRIVER_ASSIGNED-RESERVED',
    'CLOSING_TRAVEL-GOING_TO_CLIENT-GOING_TO_DESTINATION',
    'SCHEDULED-SEARCHING_DRIVER-WITH_DRIVER_ASSIGNED',
    'NO_AUTH-NO_PAY',
    'LOST',
    'CANCELLED',
    'DONE',
  ];
  document.querySelectorAll('#travel-management-view .travel-status-tabs button').forEach((button, index) => {
    button.addEventListener('click', () => {
      travelStateFilter = travelStates[index] || '';
      crmOffset = 0;
      document.querySelectorAll('#travel-management-view .travel-status-tabs button').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      loadCrmData();
    });
  });
  checkAuth();
});

// ── Red Neural ────────────────────────────────────────────────────────────────
(function () {
  const LIME = "#b4ff00";

  // Datos por defecto — se reemplazarán con datos del back
  const DEFAULT_NODES = [
    { id: "cerebro",          label: "Cerebro",          main: true },
    { id: "salud",            label: "Salud" },
    { id: "proyectos",        label: "Proyectos" },
    { id: "disciplina",       label: "Disciplina" },
    { id: "vulnerabilidades", label: "Vulnerabilidades" },
    { id: "vinculos",         label: "Vínculos" },
    { id: "mente",            label: "Mente" },
  ];
  const DEFAULT_EDGES = [
    ["cerebro","salud"],["cerebro","proyectos"],["cerebro","disciplina"],
    ["cerebro","vulnerabilidades"],["cerebro","vinculos"],["cerebro","mente"],
    ["salud","mente"],["salud","disciplina"],
    ["mente","vulnerabilidades"],["mente","disciplina"],
    ["proyectos","disciplina"],["proyectos","salud"],
    ["vinculos","vulnerabilidades"],
  ];

  let nodes = [], edges = [], raf = null;

  function initPhysics(nodeData, edgeData, W, H) {
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.28;
    const outerNodes = nodeData.filter(n => !n.main && !n.sub);
    const subNodes = nodeData.filter(n => n.sub);

    nodes = nodeData.map((n) => {
      if (n.main) return { ...n, x: cx, y: cy, vx: 0, vy: 0, r: 36, pinned: true };
      if (n.sub) {
        const subIdx = subNodes.indexOf(n);
        const subTotal = subNodes.length;
        const subAngle = (subIdx / subTotal) * Math.PI * 2 - Math.PI / 2;
        const subR = R * 2.1;
        const words2 = n.label.split(" ");
        const longest2 = Math.max(...words2.map(w => w.length));
        const dynR = words2.length > 1 ? Math.max(14, longest2 * 2.8) : Math.max(12, n.label.length * 2.4);
        return {
          ...n,
          x: cx + subR * Math.cos(subAngle) + (Math.random() - 0.5) * 15,
          y: cy + subR * Math.sin(subAngle) + (Math.random() - 0.5) * 15,
          vx: 0, vy: 0, r: dynR, pinned: false
        };
      }
      const idx = outerNodes.indexOf(n);
      const angle = (idx / outerNodes.length) * Math.PI * 2 - Math.PI / 2;
      return {
        ...n,
        x: cx + R * Math.cos(angle) + (Math.random() - 0.5) * 10,
        y: cy + R * Math.sin(angle) + (Math.random() - 0.5) * 10,
        vx: 0, vy: 0, r: 26, pinned: false
      };
    });
    edges = edgeData;
  }

  let mouse = { x: -1000, y: -1000 };

  function stepPhysics(W, H) {
    const cx = W / 2, cy = H / 2;
    const SPRING = 0.012, DAMP = 0.82;

    // Repulsión entre nodos
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (a.pinned && b.pinned) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const isSubPair = a.sub || b.sub;
        const force = (isSubPair ? 1800 : 4500) / (dist * dist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
        if (!b.pinned) { b.vx += fx; b.vy += fy; }
      }
    }

    // Atracción por aristas
    edges.forEach(([aid, bid]) => {
      const a = nodes.find(n => n.id === aid);
      const b = nodes.find(n => n.id === bid);
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const isSub = (a.sub || b.sub);
      const target = a.main || b.main ? (b.sub || a.sub ? 120 : 85) : isSub ? 55 : 65;
      const force = (dist - target) * SPRING;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      if (!a.pinned) { a.vx += fx; a.vy += fy; }
      if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
    });

    nodes.forEach(n => {
      if (n.pinned) return;

      // Mouse repel — igual que METHOD
      const mdx = n.x - mouse.x, mdy = n.y - mouse.y;
      const md = Math.sqrt(mdx*mdx + mdy*mdy);
      if (md < 220 && md > 30) {
        const force = (220 - md) / 220 * 5.0;
        n.vx += (mdx / md) * force;
        n.vy += (mdy / md) * force;
      } else if (md <= 30 && md > 0) {
        n.vx += (mdx / md) * 2.0;
        n.vy += (mdy / md) * 2.0;
      }

      const gravityStrength = n.sub ? 0.004 : 0.006;
      n.vx += (cx - n.x) * gravityStrength;
      n.vy += (cy - n.y) * gravityStrength;

      n.vx *= DAMP; n.vy *= DAMP;
      n.x += n.vx; n.y += n.vy;

      // Rebote suave en bordes
      if (n.x < n.r + 4)     { n.x = n.r + 4;     n.vx *= -0.4; }
      if (n.x > W - n.r - 4) { n.x = W - n.r - 4; n.vx *= -0.4; }
      if (n.y < n.r + 4)     { n.y = n.r + 4;     n.vy *= -0.4; }
      if (n.y > H - n.r - 4) { n.y = H - n.r - 4; n.vy *= -0.4; }
    });
  }

  function drawFrame(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);

    // Aristas
    edges.forEach(([aid, bid]) => {
      const a = nodes.find(n => n.id === aid);
      const b = nodes.find(n => n.id === bid);
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      const isCentral = a.main || b.main;
      ctx.strokeStyle = isCentral ? "rgba(180,255,0,0.3)" : "rgba(180,255,0,0.1)";
      ctx.lineWidth = isCentral ? 1.5 : 1;
      ctx.stroke();
    });

    // Nodos
    nodes.forEach(n => {
      // Glow
      const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2.2);
      grd.addColorStop(0, n.main ? "rgba(180,255,0,0.2)" : "rgba(180,255,0,0.08)");
      grd.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Círculo
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.main ? "rgba(180,255,0,0.13)" : "#0e0e0e";
      ctx.strokeStyle = LIME;
      ctx.lineWidth = n.main ? 2 : 1;
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = LIME;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const words = n.label.split(" ");
      if (words.length > 1 && !n.main) {
        const longest = Math.max(...words.map(w => w.length));
        const fs = longest > 6 ? 7 : 8;
        ctx.font = `500 ${fs}px Inter, sans-serif`;
        ctx.fillText(words[0], n.x, n.y - 5);
        ctx.fillText(words.slice(1).join(" "), n.x, n.y + 6);
      } else {
        const fs = n.main ? 11 : n.label.length > 7 ? 8 : 9.5;
        ctx.font = `${n.main ? 600 : 500} ${fs}px Inter, sans-serif`;
        ctx.fillText(n.label, n.x, n.y);
      }
    });
  }

  function stopLoop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  async function openGraph(canvas) {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Mostrar nodos default mientras carga
    initPhysics(DEFAULT_NODES, DEFAULT_EDGES, canvas.width, canvas.height);
    startLoop(canvas);

    // Pedir grafo al back
    try {
      const token = getToken();
      const res = await fetch(HASH_CLOUD_URL + "/memory/graph", {
        headers: { "Authorization": "Bearer " + token }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.nodes || data.nodes.length === 0) return;

      // Convertir formato del back al formato interno
      const newNodes = data.nodes.map(n => ({
        id: n.id,
        label: n.label,
        main: !!n.main,
        sub: !!n.sub,
      }));
      const newEdges = data.edges.map(e => [e.from, e.to]);

      stopLoop();
      initPhysics(newNodes, newEdges, canvas.width, canvas.height);
      startLoop(canvas);
    } catch (e) {
      // Si falla el back, dejamos los nodos default
      console.warn("No se pudo cargar el grafo:", e);
    }
  }

  let hoveredNode = null;

  function getNodeAt(canvas, mx, my) {
    const rect = canvas.getBoundingClientRect();
    const x = mx - rect.left, y = my - rect.top;
    return nodes.find(n => Math.hypot(n.x - x, n.y - y) < n.r + 8) || null;
  }

  function drawFrameWithHover(ctx, W, H) {
    ctx.clearRect(0, 0, W, H);

    edges.forEach(([aid, bid]) => {
      const a = nodes.find(n => n.id === aid);
      const b = nodes.find(n => n.id === bid);
      if (!a || !b) return;
      const isHovered = hoveredNode && (hoveredNode.id === aid || hoveredNode.id === bid);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      const isCentral = a.main || b.main;
      ctx.strokeStyle = isHovered
        ? "rgba(180,255,0,0.7)"
        : isCentral ? "rgba(180,255,0,0.3)" : "rgba(180,255,0,0.1)";
      ctx.lineWidth = isHovered ? 2 : isCentral ? 1.5 : 1;
      ctx.stroke();
    });

    nodes.forEach(n => {
      const isHov = hoveredNode && hoveredNode.id === n.id;
      const scale = isHov ? 1.25 : 1;
      const r = n.r * scale;

      const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 2.4);
      grd.addColorStop(0, isHov ? "rgba(180,255,0,0.4)" : n.main ? "rgba(180,255,0,0.2)" : "rgba(180,255,0,0.08)");
      grd.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 2.4, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isHov ? "rgba(180,255,0,0.2)" : n.main ? "rgba(180,255,0,0.13)" : "#0e0e0e";
      ctx.strokeStyle = "#b4ff00";
      ctx.lineWidth = isHov ? 2.5 : n.main ? 2 : 1;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#b4ff00";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const words = n.label.split(" ");
      if (words.length > 1 && !n.main) {
        const longest = Math.max(...words.map(w => w.length));
        const fs = isHov ? (longest > 6 ? 8 : 9) : (longest > 6 ? 7 : 8);
        ctx.font = `500 ${fs}px Inter, sans-serif`;
        ctx.fillText(words[0], n.x, n.y - 5);
        ctx.fillText(words.slice(1).join(" "), n.x, n.y + 6);
      } else {
        const fs = n.main ? (isHov ? 13 : 11) : isHov ? 10 : n.label.length > 7 ? 8 : 9.5;
        ctx.font = `${n.main ? 600 : 500} ${fs}px Inter, sans-serif`;
        ctx.fillText(n.label, n.x, n.y);
      }
    });
  }

  function startLoop(canvas) {
    const ctx = canvas.getContext("2d");
    function loop() {
      const W = canvas.width, H = canvas.height;
      stepPhysics(W, H);
      drawFrameWithHover(ctx, W, H);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn    = document.getElementById("neural-btn");
    const modal  = document.getElementById("neural-modal");
    const close  = document.getElementById("neural-close");
    const canvas = document.getElementById("neural-canvas");
    if (!btn) return;

    btn.addEventListener("click", () => {
      modal.hidden = false;
      requestAnimationFrame(() => openGraph(canvas));
    });
    close.addEventListener("click", () => { modal.hidden = true; stopLoop(); });
    modal.addEventListener("click", e => { if (e.target === modal) { modal.hidden = true; stopLoop(); } });

    canvas.addEventListener("mousemove", e => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      hoveredNode = getNodeAt(canvas, e.clientX, e.clientY);
      canvas.style.cursor = hoveredNode ? "pointer" : "default";
    });
    canvas.addEventListener("mouseleave", () => {
      mouse.x = -1000; mouse.y = -1000;
      hoveredNode = null;
      canvas.style.cursor = "default";
    });
    canvas.addEventListener("touchmove", e => {
      e.preventDefault();
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      mouse.x = t.clientX - rect.left;
      mouse.y = t.clientY - rect.top;
      hoveredNode = getNodeAt(canvas, t.clientX, t.clientY);
    }, { passive: false });
    canvas.addEventListener("touchstart", e => {
      e.stopPropagation();
    }, { passive: false });
    canvas.addEventListener("touchend", e => {
      e.stopPropagation();
      mouse.x = -1000; mouse.y = -1000;
      hoveredNode = null;
    });

    window.addEventListener("resize", () => {
      if (!modal.hidden) {
        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const c = nodes.find(n => n.main);
        if (c) { c.x = canvas.width/2; c.y = canvas.height/2; }
      }
    });
  });
})();

// ── Chat de voz ────────────────────────────────────────────────────────────

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

function initVoiceChat() {
  const btn = document.getElementById('voice-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (isRecording) stopRecording();
    else startRecording();
  });
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); sendVoiceMessage(); };
    mediaRecorder.start();
    isRecording = true;
    const btn = document.getElementById('voice-btn');
    btn.textContent = '⏹';
    btn.style.color = '#b4ff00';
  } catch {
    setSyncStatus('error', 'No se pudo acceder al micrófono.');
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    const btn = document.getElementById('voice-btn');
    btn.textContent = '🎤';
    btn.style.color = '';
  }
}

async function sendVoiceMessage() {
  if (!audioChunks.length) return;
  const blob = new Blob(audioChunks, { type: 'audio/webm' });
  const formData = new FormData();
  formData.append('audio', blob, 'audio.webm');
  if (activeChatId) formData.append('chat_id', activeChatId);

  const tempUser = { id: crypto.randomUUID(), role: 'user', message: '🎤 Procesando...', created_at: new Date().toISOString() };
  const tempHash = { id: crypto.randomUUID(), role: 'hash', message: '', created_at: new Date().toISOString(), loading: true };
  messages = [...messages, tempUser, tempHash];
  renderMessages();
  setSyncStatus('loading', 'Hash está escuchando...');

  try {
    const token = getToken();
    const res = await fetch(HASH_CLOUD_URL + '/chat/voice', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData,
    });
    if (res.status === 403) { showUpgradeModal(); return; }
    if (!res.ok) throw new Error('Error ' + res.status);

    const data = await res.json();
    const transcript = data.transcript || '🎤 Mensaje de voz';
    const reply = data.reply || '';
    const chatId = data.chat_id;

    if (chatId && !activeChatId) {
      activeChatId = chatId;
      activeFrontId = chatId;
      localStorage.setItem('hash_active_chat', chatId);
    }

    tempUser.message = transcript;
    tempHash.message = reply;
    tempHash.loading = false;
    if (activeChatId) chatCache[activeChatId] = messages;
    renderMessages();

    if (chatId && !FRONTS.find(f => f.chat_id === chatId)) {
      FRONTS = [{ id: chatId, chat_id: chatId, name: transcript.slice(0, 50) }, ...FRONTS];
      activeFrontId = chatId;
      renderFrontList();
      renderHeader();
    }

    // Reproducir respuesta con voz del navegador
    const utterance = new SpeechSynthesisUtterance(reply);
    utterance.lang = 'es-AR';
    speechSynthesis.speak(utterance);
    setSyncStatus('success', '');
  } catch (err) {
    messages = messages.filter(m => !m.loading);
    renderMessages();
    setSyncStatus('error', 'No se pudo enviar el audio.');
  }
}
