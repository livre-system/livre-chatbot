/**
 * app.js — HASH AI
 * Fuente de verdad: HASH Cloud → Google Sheets del usuario.
 */

const HASH_CLOUD_URL = 'https://livre-cloud-production.up.railway.app';

async function apiCrm(path, options = {}) {
  const token = getToken();
  const res = await fetch(HASH_CLOUD_URL + '/crm/' + path, {
    ...options,
    headers: { 'Authorization': 'Bearer ' + token, ...(options.headers || {}) },
    signal: options.signal,
    cache: 'no-store',
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
  id: 'ID', id: 'ID', passengerUserId: 'ID del cliente', driverUserId: 'ID del conductor', vehicleId: 'ID del vehículo', travelId: 'ID del viaje',
  code: 'Código', dni: 'DNI', firstName: 'Nombre', name: 'Nombre', lastName: 'Apellido', surname: 'Apellido',
  phone: 'Teléfono', phoneNumber: 'Phone Number', cellphone: 'Celular', email: 'Correo electrónico', passengerUserEmail: 'Passenger User Email', city: 'Ciudad', address: 'Domicilio', country: 'País',
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
  passengers: ['firstName', 'lastName', 'phone', 'email'],
  drivers: ['driverUserId', 'driverId', 'lastName', 'surname', 'firstName', 'name', 'phone', 'email', 'state'],
  vehicles: ['vehicleId', 'id', 'brand', 'model', 'plate', 'domain', 'year', 'photo', 'vehicleType', 'enabled', 'vehicleOwner', 'characteristics', 'documents'],
};
const CRM_HIDDEN_FIELDS = {
  passengers: new Set([
    'code', 'passengerUserId', 'passengerUserIdForCarrier', 'passenger_user_id_for_carrier',
    'dni', 'city', 'address', 'family', 'paxNote', 'country', 'countryCode', 'country_code',
    'province', 'defaultCarrierCode', 'default_carrier_code', 'isCellphone', 'is_cellphone',
    'streetName', 'street_name', 'streetNumber', 'street_number', 'addresses', 'isContractor', 'is_contractor',
    'operability', 'isPassenger', 'is_passenger', 'acceptSimultaneousTrips', 'accept_simultaneous_trips',
    'passengerImage', 'passenger_image', 'tokenToConfirm', 'token_to_confirm', 'rate', 'isPaxVip',
    'passengerAccountId', 'passenger_account_id', 'rateDetail', 'rate_detail',
    'notificationsQuantity', 'notifications_quantity',
  ]),
};
let crmVisible = false;
let crmSearchTimer;
let crmMode = 'control';
let crmOffset = 0;
let crmPageSize = 20;
let travelPageSize = 20;
let travelStateFilter = '';
let vehicleTypesPromise;
let crmLoadController;
let crmLoadSequence = 0;
const driverFilters = { code: '', name: '', phone: '', email: '', vehicle: '' };
const TRAVEL_STATE_FILTERS = [
  'SEARCHING_DRIVER',
  'CLOSING_TRAVEL-GOING_TO_CLIENT-GOING_TO_DESTINATION',
  'SCHEDULED',
  'IN_CONFLICT',
  'LOST',
  'CANCELED-CANCELLED',
  'DONE',
];

function currentLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function resetTravelDateFilterToToday() {
  const today = currentLocalDate();
  const from = document.getElementById('travel-management-date-from');
  const to = document.getElementById('travel-management-date');
  from.value = today;
  to.value = today;
}

function syncTravelDateFromFilter() {
  const filter = document.getElementById('travel-date-from-filter');
  const input = document.getElementById('travel-management-date-from');
  filter.hidden = false;
  input.disabled = false;
}

function openDatePickerOnClick(input) {
  if (!input || input.disabled) return;
  input.addEventListener('click', () => {
    if (typeof input.showPicker === 'function') input.showPicker();
  });
}

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
    `<article class="crm-card"><strong>${data[key] == null ? '—' : data[key]}</strong><span>${label}</span></article>`
  ).join('');
}

function normalizeCrmPassenger(item) {
  const rawPayload = item?.raw_payload;
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return item;
  return {
    ...rawPayload,
    id: item.id,
    raw_payload: rawPayload,
  };
}

function crmColumns(resource, items) {
  const available = new Set(items.flatMap(item => [...Object.keys(item.raw_payload || {}), ...Object.keys(item)]));
  if (resource === 'passengers') {
    const clientFields = [
      ['firstName'],
      ['lastName'],
      ['passengerUserEmail', 'email'],
      ['phoneNumber', 'phone', 'cellphone'],
    ];
    const preferred = clientFields.map(keys => keys.find(key => available.has(key))).filter(Boolean);
    const hidden = CRM_HIDDEN_FIELDS.passengers || new Set();
    return [...preferred, ...available]
      .filter((key, index, all) => all.indexOf(key) === index && !hidden.has(key))
      .slice(0, 12);
  }
  if (resource === 'travels') ['state', 'travelDate', 'passengerId', 'driverId'].forEach(key => available.add(key));
  const preferred = CRM_FIELD_ORDER[resource] || [];
  const ordered = [...preferred.filter(key => available.has(key)), ...available].filter((key, index, all) => all.indexOf(key) === index);
  const hidden = CRM_HIDDEN_FIELDS[resource] || new Set();
  return ordered.filter(key => {
    if (hidden.has(key)) return false;
    if (['photo', 'documents', 'additionalTypes'].includes(key)) return resource === 'vehicles' && key === 'photo';
    return true;
  }).slice(0, 12);
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
    const payload = { ...item,
      ...(item.raw_payload || {}),
      ...(item.state !== undefined ? { state: item.state } : {}),
      ...(item.status !== undefined ? { state: item.status } : {}),
      ...(item.created_at !== undefined ? { travelDate: item.created_at } : {}),
      ...(item.travel_date !== undefined ? { travelDate: item.travel_date } : {}),
      ...(item.origen !== undefined ? { origin: item.origen } : {}),
      ...(item.destino !== undefined ? { destination: item.destino } : {}),
      ...(item.passenger_id !== undefined ? { passengerId: item.passenger_id } : {}),
      ...(item.driver_id !== undefined ? { driverId: item.driver_id } : {}),
    };
    return `<tr><td>${crmEscape(item.id ?? item.id, 'id')}</td>${columns.map(key => `<td title="${crmEscape(payload[key], key)}">${renderCrmCell(payload[key], key)}</td>`).join('')}</tr>`;
  });
  const total = Number(data.total) || 0;
  const size = Number(data.size) || crmPageSize;
  const page = Number(data.page) || Math.floor(crmOffset / size) + 1;
  const totalPages = Math.max(1, Math.ceil(total / size));
  wrap.innerHTML = `<div class="crm-table-scroll"><table><thead><tr><th>ID</th>${columns.map(key => `<th>${crmEscape(crmFieldLabel(key))}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div><div class="crm-table-footer"><span>Total: ${total}</span><label>Mostrar <select data-crm-size><option value="20" ${size === 20 ? 'selected' : ''}>20</option><option value="50" ${size === 50 ? 'selected' : ''}>50</option><option value="100" ${size === 100 ? 'selected' : ''}>100</option></select></label><span>Página ${page} de ${totalPages}</span><button type="button" data-crm-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button><button type="button" data-crm-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Siguiente</button></div>`;
  wrap.querySelectorAll('.vehicle-photo-button').forEach(button => {
    button.addEventListener('click', () => openVehiclePhoto(button.dataset.photoUrl));
  });
  wrap.querySelectorAll('[data-crm-page]').forEach(button => button.addEventListener('click', () => {
    crmOffset = (Number(button.dataset.crmPage) - 1) * crmPageSize;
    loadCrmData();
  }));
  wrap.querySelector('[data-crm-size]').addEventListener('change', event => {
    crmPageSize = Number(event.target.value) || 20;
    crmOffset = 0;
    loadCrmData();
  });
}

let operationalSnapshot = null;
let operationalMap = null;
let operationalMapContainerId = null;
let operationalMarkerGroup = null;
let mapViewerFilter = 'TODOS';
let operationalStatusFilter = 'EN VIAJE';

function isDriverInTravel(item) {
  return ['assigned', 'arriving', 'in_progress'].includes(String(item.tripStatus || '').toLowerCase());
}

function canonicalOperationalStateLabel(item) {
  const status = String(item.operationalStatus || '').toLowerCase();
  if (status === 'available') return 'DISPONIBLE';
  if (status === 'unavailable') return 'NO DISPONIBLE';
  if (status === 'out_of_service') return 'FUERA DE SERVICIO';
  return null;
}

function operationalStateLabel(item) {
  if (isDriverInTravel(item)) return 'EN VIAJE';
  const canonical = canonicalOperationalStateLabel(item);
  if (canonical) return canonical;
  const legacyStatus = String(item.operationalState || item.driverState || item.vehicleState || item.operability || '').toUpperCase();
  if (['F', 'FREE', 'AVAILABLE', 'DISPONIBLE'].includes(legacyStatus)) return 'DISPONIBLE';
  if (['T', 'TRAVEL', 'EN_TRAVEL', 'EN VIAJE'].includes(legacyStatus)) return 'EN VIAJE';
  return 'NO DISPONIBLE';
}

function operationalFilterMatches(item, filter) {
  if (filter === 'TODOS') return true;
  return operationalStateLabel(item) === filter;
}

const OPERATIONAL_STATUS_LABELS = {
  available: 'Disponible',
  unavailable: 'No disponible',
  out_of_service: 'Fuera de servicio',
};

async function changeOperationalDriverStatus(driverUserId, status, control) {
  if (!Object.prototype.hasOwnProperty.call(OPERATIONAL_STATUS_LABELS, status)) return;
  control.disabled = true;
  try {
    const response = await fetch(`${HASH_CLOUD_URL}/crm/operational/driver/${encodeURIComponent(driverUserId)}/status`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok || data.status !== status) throw new Error(data.detail || 'No se pudo actualizar el estado operativo.');
    const snapshot = await apiOperational();
    renderOperationalDashboard(snapshot);
    document.getElementById('crm-status').textContent = `Estado actualizado: ${OPERATIONAL_STATUS_LABELS[data.status]}.`;
  } catch (error) {
    document.getElementById('crm-status').textContent = error.message || 'No se pudo actualizar el estado operativo.';
    if (operationalSnapshot) renderOperationalDashboard(operationalSnapshot);
  } finally {
    control.disabled = false;
  }
}

function renderOperationalDashboard(snapshot) {
  operationalSnapshot = snapshot;
  const totals = snapshot.driver_totals || {};
  const dashboard = snapshot.drivers || snapshot.drivers_by_vehicle || snapshot.driver_statuses || [];
  const items = Array.isArray(dashboard) ? dashboard : dashboard.items || dashboard.content || dashboard.page?.content || [];
  const stateLabel = operationalStateLabel;
  const search = (document.getElementById('operational-driver-search')?.value || '').toLowerCase();
  const activeFilter = document.querySelector('#operational-status-filters button.active')?.dataset.filter || operationalStatusFilter;
  const filtered = items.filter(item => {
    const vehicle = item.vehicle || {};
    const text = [item.driverIdForCarrier, item.driverUserId, item.firstName, item.lastName, vehicle.domain, vehicle.model, vehicle.mark].join(' ').toLowerCase();
    return (!search || text.includes(search)) && operationalFilterMatches(item, activeFilter);
  });
  const countByState = state => filtered.filter(item => operationalStateLabel(item) === state).length;
  const kpis = [
    ['Choferes visibles', filtered.length, 'operational-kpi--primary', 'Cuentas activas en esta vista'],
    ['Disponibles', countByState('DISPONIBLE'), '', 'Listos para recibir viaje'],
    ['En viaje', countByState('EN VIAJE'), '', 'Viaje activo no terminal'],
    ['Sesión GPS activa', filtered.filter(item => item.sessionActive === true).length, '', 'Choferes con sesión activa'],
  ];
  document.getElementById('operational-kpis').innerHTML = kpis.map(([label, amount, modifier, note]) =>
    `<article class="operational-kpi ${modifier}"><span>${crmEscape(label)}</span><strong>${crmEscape(amount)}</strong><small>${crmEscape(note)}</small></article>`
  ).join('');
  const rows = filtered.map(item => {
    const vehicle = item.vehicle || {};
    const name = [item.firstName, item.lastName].filter(Boolean).join(' ').trim() || item.driverName || '—';
    const state = stateLabel(item);
    const stateClass = state === 'DISPONIBLE' ? 'available' : state === 'EN VIAJE' ? 'travel' : state === 'FUERA DE SERVICIO' ? 'out-of-service' : 'unavailable';
    const gpsLabel = item.sessionActive === true ? 'ACTIVO' : 'SIN SEÑAL';
    const gpsClass = item.sessionActive === true ? 'available' : 'unavailable';
    const statusOptions = Object.entries(OPERATIONAL_STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${item.operationalStatus === value ? 'selected' : ''}>${label}</option>`).join('');
    return `<tr><td><strong>${crmEscape(name)}</strong><small>${crmEscape(item.driverIdForCarrier ?? item.driverUserId ?? '—')}</small></td><td>${crmEscape(vehicle.plate || vehicle.domain || '—')}<small>${crmEscape(`${vehicle.mark || ''} ${vehicle.model || ''}`.trim())}</small></td><td><span class="vehicle-state vehicle-state--${stateClass}">${state}</span></td><td><span class="vehicle-state vehicle-state--${gpsClass}">${gpsLabel}</span><small>${crmEscape(item.lastSee || 'Sin registro')}</small></td><td><select class="operational-status-control" data-driver-user-id="${crmEscape(item.driverUserId)}" aria-label="Estado operativo">${statusOptions}</select></td></tr>`;
  }).join('');
  document.getElementById('operational-drivers').innerHTML = `<div class="operational-table-scroll"><table><thead><tr><th>Chofer</th><th>Vehículo</th><th>Estado</th><th>GPS</th><th>Actualizar estado</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No hay choferes para este filtro.</td></tr>'}</tbody></table></div><small>Mostrando ${filtered.length} de ${items.length} choferes.</small>`;
  document.querySelectorAll('.operational-status-control').forEach(control => control.addEventListener('change', event => changeOperationalDriverStatus(control.dataset.driverUserId, event.target.value, control)));
  const filters = [['TODOS', totals.totalDrivers ?? items.length], ['DISPONIBLE', totals.available ?? items.filter(i => stateLabel(i) === 'DISPONIBLE').length], ['NO DISPONIBLE', totals.unavailable ?? items.filter(i => stateLabel(i) === 'NO DISPONIBLE').length], ['FUERA DE SERVICIO', totals.out_of_service ?? items.filter(i => stateLabel(i) === 'FUERA DE SERVICIO').length], ['EN VIAJE', totals.totalDriversInTravel ?? items.filter(i => stateLabel(i) === 'EN VIAJE').length]];
  const filterNode = document.getElementById('operational-status-filters');
  filterNode.innerHTML = filters.map(([label, count]) => `<button type="button" data-filter="${label}" class="${label === activeFilter ? 'active' : ''}">${label}<b>${crmEscape(count)}</b></button>`).join('');
  filterNode.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { operationalStatusFilter = button.dataset.filter || 'EN VIAJE'; filterNode.querySelectorAll('button').forEach(b => b.classList.remove('active')); button.classList.add('active'); renderOperationalDashboard(operationalSnapshot); }));
  renderOperationalMap(items);
}

function renderOperationalMap(items, targetId = 'operational-map') {
  const node = document.getElementById(targetId);
  if (!node || typeof L === 'undefined') return;
  if (!operationalMap || operationalMapContainerId !== targetId) {
    if (operationalMap) operationalMap.remove();
    operationalMap = L.map(node).setView([-38.7183, -62.2663], 12);
    operationalMapContainerId = targetId;
    L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(operationalMap);
    operationalMarkerGroup = typeof L.markerClusterGroup === 'function'
      ? L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 45,
        iconCreateFunction: cluster => L.divIcon({ className: 'operational-cluster-marker', html: `<span>${cluster.getChildCount()}</span>`, iconSize: [40, 40], iconAnchor: [20, 20] }),
      })
      : L.layerGroup();
    operationalMarkerGroup.addTo(operationalMap);
    requestAnimationFrame(() => requestAnimationFrame(() => operationalMap?.invalidateSize()));
  }
  operationalMarkerGroup.clearLayers();
  const points = items.filter(isLiveMapLocation).map(item => ({ item, lat: Number(item.lastPlace?.latitude), lng: Number(item.lastPlace?.longitude) })).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  const vehicleIcon = L.divIcon({ className: 'operational-vehicle-marker', html: '<span aria-hidden="true">🚗</span>', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });
  points.forEach(({ item, lat, lng }) => L.marker([lat, lng], { icon: vehicleIcon }).bindPopup(`<strong>${crmEscape(item.driverName || [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Conductor')}</strong><br>${crmEscape(item.vehicle?.plate || item.vehicle?.domain || 'Sin vehículo')}<br><strong>${crmEscape(operationalStateLabel(item))}</strong><br><small>Último dato: ${crmEscape(item.lastSee || '—')}</small>`).addTo(operationalMarkerGroup));
}

function isLiveMapLocation(item) {
  return item?.sessionActive === true;
}

async function loadMapViewer() {
  const status = document.getElementById('map-view-status');
  if (!status) return;
  status.textContent = 'Cargando ubicaciones...';
  try {
    const snapshot = await apiCrm('operational');
    const items = snapshot.drivers || snapshot.drivers_by_vehicle || snapshot.driver_statuses || [];
    const rawList = Array.isArray(items) ? items : items.items || items.content || items.page?.content || [];
    // El visor es operativo: no reutiliza posiciones de sesiones históricas.
    const list = rawList.filter(isLiveMapLocation);
    const totals = {
      available: list.filter(item => operationalFilterMatches(item, 'DISPONIBLE')).length,
      unavailable: list.filter(item => operationalFilterMatches(item, 'NO DISPONIBLE')).length,
      out_of_service: list.filter(item => operationalFilterMatches(item, 'FUERA DE SERVICIO')).length,
      totalDriversInTravel: list.filter(item => operationalFilterMatches(item, 'EN VIAJE')).length,
      totalDrivers: list.length,
    };
    const filters = [
      ['TODOS', 'TODOS', totals.totalDrivers ?? list.length],
      ['DISPONIBLE', 'DISPONIBLES', totals.available ?? '—'],
      ['NO DISPONIBLE', 'NO DISPONIBLES', totals.unavailable ?? '—'],
      ['FUERA DE SERVICIO', 'FUERA DE SERVICIO', totals.out_of_service ?? '—'],
      ['EN VIAJE', 'EN VIAJE', totals.totalDriversInTravel ?? '—'],
    ];
    const filterNode = document.getElementById('map-view-filters');
    if (!filters.some(([value]) => value === mapViewerFilter)) mapViewerFilter = 'TODOS';
    filterNode.innerHTML = filters.map(([value, label, count]) => `<button type="button" data-filter="${value}" class="${value === mapViewerFilter ? 'active' : ''}">${label}<b>${crmEscape(count)}</b></button>`).join('');
    filterNode.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      mapViewerFilter = button.dataset.filter || 'TODOS';
      filterNode.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
      const filtered = list.filter(item => operationalFilterMatches(item, mapViewerFilter));
      renderOperationalMap(filtered, 'map-view-map');
      status.textContent = `Última actualización: ${new Date().toLocaleTimeString('es-AR')}. ${filtered.length} vehículo(s) informados.`;
    }));
    const filtered = list.filter(item => operationalFilterMatches(item, mapViewerFilter));
    renderOperationalMap(filtered, 'map-view-map');
    status.textContent = `Última actualización: ${new Date().toLocaleTimeString('es-AR')}. ${filtered.length} vehículo(s) informados.`;
  } catch (error) {
    status.textContent = 'No se pudieron cargar las ubicaciones.';
    console.error(error);
  }
}

function setChatWorkspaceVisible(visible) {
  const workspace = document.getElementById('chat-workspace');
  if (workspace) workspace.hidden = !visible;
}

function showMapViewer() {
  crmVisible = true;
  setChatWorkspaceVisible(false);
  crmMode = 'map';
  document.getElementById('crm-title').textContent = 'Visor de mapa';
  document.getElementById('crm-subtitle').textContent = 'Ubicación en tiempo real de la operación.';
  ['crm-cards', 'travel-management-view', 'driver-management-view', 'vehicle-management-view', 'owner-management-view', 'agency-commissions-view', 'driver-shift-closures-view', 'conversations-view', 'operational-view', 'crm-toolbar', 'crm-table-wrap'].forEach(id => { const node = document.getElementById(id) || document.querySelector('.' + id); if (node) node.hidden = true; });
  document.getElementById('map-view').hidden = false;
  document.getElementById('message-list').hidden = true;
  document.getElementById('composer').hidden = true;
  document.getElementById('travel-form-view').hidden = true;
  document.getElementById('crm-dashboard').hidden = false;
  loadMapViewer();
}

function renderDriverManagement(data) {
  const table = document.getElementById('driver-management-table');
  const rows = data.items.map(item => {
    const p = item.raw_payload || item;
    const id = p.driverUserId ?? p.id ?? item.id;
    const name = p.driverName || [p.lastName, p.firstName].filter(Boolean).join(' ') || '—';
    const phone = p.phoneNumber || p.phone || '—';
    const email = p.driverUserEmail || p.mail || p.email || '—';
    const vehicleLabels = Array.isArray(item.vehicles) && item.vehicles.length ? item.vehicles.join(', ') : (item.vehicleDescription || item.vehicle?.plate || '—');
    const vehicle = vehicleLabels;
    const active = p.operability ?? item.active;
    const rating = p.rating;
    return `<tr><td>${crmEscape(id)}</td><td>${crmEscape(name)}</td><td><span class="driver-phone"><b>🇦🇷</b>${crmEscape(phone)}</span></td><td>${crmEscape(email)}</td><td class="driver-vehicle">${crmEscape(vehicle)}</td><td>${crmEscape(p.vehicleType || '—')}</td><td><span class="vehicle-active-dot ${String(active) === '0' || String(active).toLowerCase() === 'false' ? 'vehicle-inactive' : 'vehicle-active'}">●</span></td><td>${crmEscape(rating || '—')}</td><td><button type="button" class="driver-action" data-driver-detail="${crmEscape(id)}" aria-label="Ver chofer">◉</button><button type="button" class="driver-action" data-driver-edit="${crmEscape(id)}" aria-label="Editar chofer">✎</button></td></tr>`;
  }).join('');
  const size = Number(data.size) || crmPageSize;
  const page = Number(data.page) || Math.floor(crmOffset / size) + 1;
  const total = Number(data.total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / size));
  table.innerHTML = `<div class="driver-table-scroll"><table><thead><tr><th>Código<br><input data-driver-filter="code" placeholder="Buscar"></th><th>Apellido y Nombre<br><input data-driver-filter="name" placeholder="Buscar"></th><th>Teléfono<br><input data-driver-filter="phone" placeholder="Buscar"></th><th>Email<br><input data-driver-filter="email" placeholder="Buscar"></th><th>Vehículo<br><input data-driver-filter="vehicle" placeholder="Buscar"></th><th>Tipo de Veh.</th><th>Activo</th><th>Calificación</th><th>Acciones</th></tr></thead><tbody>${rows || '<tr><td colspan="9">No hay choferes registrados.</td></tr>'}</tbody></table></div><div class="driver-table-footer"><span>Total: ${total}</span><label>Mostrar <select data-driver-size><option value="20" ${size === 20 ? 'selected' : ''}>20</option><option value="50" ${size === 50 ? 'selected' : ''}>50</option><option value="100" ${size === 100 ? 'selected' : ''}>100</option></select></label><span>Página ${page} de ${totalPages}</span><button type="button" data-driver-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button><button type="button" data-driver-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Siguiente</button></div>`;
  table.querySelectorAll('[data-driver-page]').forEach(button => button.addEventListener('click', () => {
    crmOffset = (Number(button.dataset.driverPage) - 1) * crmPageSize;
    loadCrmData();
  }));
  table.querySelector('[data-driver-size]').addEventListener('change', event => {
    crmPageSize = Number(event.target.value) || 20;
    crmOffset = 0;
    loadCrmData();
  });
  table.querySelectorAll('[data-driver-detail]').forEach(button => button.addEventListener('click', () => loadDriverDetail(button.dataset.driverDetail)));
  table.querySelectorAll('[data-driver-edit]').forEach(button => button.addEventListener('click', () => {
    document.getElementById('crm-status').textContent = 'Editar chofer: Livre Cloud no expone una petición de edición en el contrato capturado; no se envió ningún cambio.';
  }));
  table.querySelectorAll('[data-driver-filter]').forEach(input => {
    const key = input.dataset.driverFilter;
    input.value = driverFilters[key] || '';
    input.addEventListener('input', () => {
      driverFilters[key] = input.value;
      clearTimeout(crmSearchTimer);
      crmSearchTimer = setTimeout(() => {
        crmOffset = 0;
        loadCrmData();
      }, 300);
    });
  });
}

async function loadDriverDetail(driverId) {
  try {
    const detail = await apiCrm(`drivers/${encodeURIComponent(driverId)}/detail`);
    document.getElementById('crm-status').textContent = `Detalle cargado: ${detail.firstName || ''} ${detail.lastName || ''} · ${detail.mail || detail.driverUserEmail || 'sin email'} · ${detail.phoneNumber || 'sin teléfono'}`;
  } catch (error) {
    document.getElementById('crm-status').textContent = 'No se pudo cargar el detalle del chofer.';
  }
}

function renderVehicleManagement(data) {
  const table = document.getElementById('vehicle-management-table');
  const rows = data.items.map(item => {
    const p = item.raw_payload || {};
    const photo = crmPhotoUrl(p.photo || p.image || p.images);
    const card = p.identificationCard || {};
    const owner = p.ownerTitularDescription || p.ownerName || p.owner || p.proprietor ||
      p.vehicleOwner?.name || p.vehicleOwner?.fullName || p.vehicleOwner?.description || '—';
    const active = p.active ?? p.isActive ?? p.enabled;
    const activeClass = active === false ? 'vehicle-inactive' : 'vehicle-active';
    return `<tr><td>${crmEscape(item.id)}</td><td><span class="vehicle-domain-cell">${photo && /^https?:\/\//i.test(photo) ? `<img src="${crmEscape(photo)}" alt="Vehículo" loading="lazy">` : '<span class="vehicle-image-empty">—</span>'}${crmEscape(card.domain || p.domain || p.plate || p.licensePlate || '—')}</span></td><td>${crmEscape(card.mark || p.brand || p.make || '—')}</td><td>${crmEscape(card.model || p.model || '—')}</td><td>${crmEscape(card.transportType?.name || card.typeTraslated || p.type || p.vehicleType || 'Livre Taxi')}</td><td class="vehicle-owner">${crmEscape(owner)}</td><td><span class="vehicle-active-dot ${activeClass}">●</span></td><td><button type="button" class="vehicle-action" aria-label="Ver vehículo">◉</button><button type="button" class="vehicle-action" aria-label="Editar vehículo">✎</button></td></tr>`;
  }).join('');
  const total = Number(data.total) || 0;
  const size = Number(data.size) || crmPageSize;
  const page = Number(data.page) || Math.floor(crmOffset / size) + 1;
  const totalPages = Math.max(1, Math.ceil(total / size));
  table.innerHTML = `<div class="vehicle-table-scroll"><table><thead><tr><th>Código</th><th>Dominio</th><th>Marca</th><th>Modelo</th><th>Tipo</th><th>Propietario</th><th>Activo</th><th>Acciones</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No hay vehículos registrados.</td></tr>'}</tbody></table></div><div class="vehicle-table-footer"><span>Total: ${total}</span><label>Mostrar <select data-vehicle-size><option value="20" ${size === 20 ? 'selected' : ''}>20</option><option value="50" ${size === 50 ? 'selected' : ''}>50</option><option value="100" ${size === 100 ? 'selected' : ''}>100</option></select></label><span>Página ${page} de ${totalPages}</span><button type="button" data-vehicle-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button><button type="button" data-vehicle-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Siguiente</button></div>`;
  table.querySelectorAll('[data-vehicle-page]').forEach(button => button.addEventListener('click', () => {
    crmOffset = (Number(button.dataset.vehiclePage) - 1) * crmPageSize;
    loadCrmData();
  }));
  table.querySelector('[data-vehicle-size]').addEventListener('change', event => {
    crmPageSize = Number(event.target.value) || 20;
    crmOffset = 0;
    loadCrmData();
  });
}

let ownerEditingId = null;
let ownerPage = 1;
const ownerPageSize = 50;

async function confirmManagedEmail(inputId, role, statusId, button) {
  const email = document.getElementById(inputId).value.trim();
  const status = document.getElementById(statusId);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) { status.textContent = 'Ingresá un email válido antes de confirmar.'; return; }
  button.disabled = true;
  status.textContent = 'Confirmando email...';
  try {
    const response = await fetch(`${HASH_CLOUD_URL}/crm/confirm-email`, { method: 'POST', headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Livre Cloud no confirmó el email.');
    status.textContent = 'Email confirmado en Livre Cloud.';
  } catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
}

function ownerPayloadFromForm() {
  const value = id => document.getElementById(id).value.trim();
  return {
    carrierId: '', titularType: 'PARTICULAR',
    titularDescription: `${value('new-owner-first-name')} ${value('new-owner-last-name')}`.trim(),
    firstName: value('new-owner-first-name'), lastName: value('new-owner-last-name'),
    cuitNumberTitular: value('new-owner-id-number') || null,
    contactEmail: value('new-owner-email') || null, contactPhone: value('new-owner-phone') || null,
    streetName: value('new-owner-street') || null, streetNumber: value('new-owner-street-number') || null,
    typeOfLivingPlace: 'APARTMENT', postalCode: null, city: value('new-owner-city') || null,
    numberFloor: '0', province: value('new-owner-province') || null,
    country: 'Argentina', identification: 'DNI', notes: value('new-owner-notes') || null,
    vehicles: [], documents: [], existsUser: null,
    cashCollector: true, isOwnerPlatformUser: true,
    paymentSettings: [
      { applyFinancing: true, paymentMethod: 'CHECKING_ACCOUNT' },
      { applyFinancing: true, paymentMethod: 'CREDIT_CARD' },
    ],
  };
}

async function loadVehicleOwners() {
  const q = document.getElementById('owner-management-search')?.value.trim() || '';
  const data = await apiCrm(`vehicle-owners?page=${ownerPage}&size=${ownerPageSize}&q=${encodeURIComponent(q)}`);
  renderVehicleOwners(data);
  const select = document.getElementById('new-driver-owner');
  if (select) {
    const totalPages = Math.max(1, Math.ceil((Number(data.total) || 0) / ownerPageSize));
    const pages = totalPages > 1
      ? await Promise.all(Array.from({ length: totalPages }, (_, index) => apiCrm(`vehicle-owners?page=${index + 1}&size=${ownerPageSize}&q=${encodeURIComponent(q)}`)))
      : [data];
    const owners = pages.flatMap(page => page.items || []);
    select.innerHTML = '<option value="">Sin propietario</option>' + owners.map(item => {
      const p = item.raw_payload || {}; const label = p.titularDescription || [p.firstName, p.lastName].filter(Boolean).join(' ') || `Propietario ${item.id}`;
      return `<option value="${crmEscape(item.id)}">${crmEscape(label)}</option>`;
    }).join('');
  }
}

function renderVehicleOwners(data) {
  const root = document.getElementById('owner-management-table');
  const rows = (data.items || []).map(item => { const p = item.raw_payload || {}; const name = p.titularDescription || [p.firstName, p.lastName].filter(Boolean).join(' ') || '—'; return `<tr><td>${crmEscape(item.id)}</td><td>${crmEscape(name)}</td><td>${crmEscape(p.cuitNumberTitular || p.idNumber || '—')}</td><td>${crmEscape(p.contactPhone || '—')}</td><td>${crmEscape(p.contactEmail || '—')}</td><td>${crmEscape(p.city || '—')}</td><td><button type="button" class="vehicle-action" data-owner-edit="${crmEscape(item.id)}">✎</button></td></tr>`; }).join('');
  const total = Number(data.total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / ownerPageSize));
  root.innerHTML = `<div class="vehicle-table-scroll"><table><thead><tr><th>Código</th><th>Nombre</th><th>DNI/CUIT</th><th>Teléfono</th><th>Email</th><th>Ciudad</th><th>Acciones</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No hay propietarios registrados.</td></tr>'}</tbody></table></div><div class="vehicle-table-footer"><span>Total: ${total}</span><span>Página ${ownerPage} de ${totalPages}</span><button type="button" data-owner-page="${ownerPage - 1}" ${ownerPage <= 1 ? 'disabled' : ''}>Anterior</button><button type="button" data-owner-page="${ownerPage + 1}" ${ownerPage >= totalPages ? 'disabled' : ''}>Siguiente</button></div>`;
  root.querySelectorAll('[data-owner-edit]').forEach(button => button.addEventListener('click', () => openOwnerModal(button.dataset.ownerEdit)));
  root.querySelectorAll('[data-owner-page]').forEach(button => button.addEventListener('click', () => {
    ownerPage = Number(button.dataset.ownerPage);
    loadVehicleOwners();
  }));
}

async function openOwnerModal(ownerId = null) {
  ownerEditingId = ownerId;
  document.getElementById('new-owner-form').reset();
  document.getElementById('new-owner-status').textContent = '';
  document.getElementById('new-owner-title').textContent = ownerId ? 'Editar propietario' : 'Nuevo propietario';
  document.getElementById('new-owner-submit').textContent = ownerId ? 'Guardar cambios' : 'Crear propietario';
  if (ownerId) {
    const p = await apiCrm(`vehicle-owners/${encodeURIComponent(ownerId)}`);
    const set = (id, value) => { document.getElementById(id).value = value || ''; };
    set('new-owner-first-name', p.firstName); set('new-owner-last-name', p.lastName); set('new-owner-id-number', p.cuitNumberTitular || p.idNumber); set('new-owner-email', p.contactEmail); set('new-owner-phone', p.contactPhone); set('new-owner-city', p.city); set('new-owner-province', p.province); set('new-owner-street', p.streetName); set('new-owner-street-number', p.streetNumber); set('new-owner-notes', p.notes);
  }
  document.getElementById('new-owner-modal').removeAttribute('hidden');
  document.getElementById('new-owner-first-name').focus();
}

function closeOwnerModal() { document.getElementById('new-owner-modal').setAttribute('hidden', ''); ownerEditingId = null; }

async function saveVehicleOwner(event) {
  event.preventDefault();
  const status = document.getElementById('new-owner-status'); const submit = document.getElementById('new-owner-submit');
  if (!event.currentTarget.reportValidity()) return;
  submit.disabled = true; status.textContent = ownerEditingId ? 'Guardando...' : 'Creando...';
  try {
    const response = await fetch(`${HASH_CLOUD_URL}/crm/vehicle-owners${ownerEditingId ? `/${encodeURIComponent(ownerEditingId)}` : ''}`, { method: ownerEditingId ? 'PUT' : 'POST', headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' }, body: JSON.stringify(ownerPayloadFromForm()) });
    const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'No se pudo guardar el propietario.');
    const wasEditing = Boolean(ownerEditingId); closeOwnerModal(); document.getElementById('crm-status').textContent = wasEditing ? 'Propietario actualizado correctamente.' : 'Propietario creado correctamente.'; loadVehicleOwners();
  } catch (error) { status.textContent = error.message; } finally { submit.disabled = false; }
}

function closeNewClientModal() { document.getElementById('new-client-modal').setAttribute('hidden', ''); }

function openNewClientModal() {
  document.getElementById('new-client-form').reset();
  document.getElementById('new-client-country').value = 'Argentina';
  document.getElementById('new-client-status').textContent = '';
  document.getElementById('new-client-modal').removeAttribute('hidden');
  document.getElementById('new-client-first-name').focus();
}

async function createManagedClient(event) {
  event.preventDefault();
  const form = event.currentTarget; const status = document.getElementById('new-client-status'); const submit = document.getElementById('new-client-submit');
  if (!form.reportValidity()) return;
  const value = id => document.getElementById(id).value.trim();
  const payload = { firstName: value('new-client-first-name'), lastName: value('new-client-last-name'), email: value('new-client-email') || null, phone: value('new-client-phone'), country: value('new-client-country') || 'Argentina' };
  submit.disabled = true; status.textContent = 'Creando cliente...';
  try {
    const response = await fetch(`${HASH_CLOUD_URL}/crm/clients`, { method: 'POST', headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'No se pudo crear el cliente.');
    closeNewClientModal(); document.getElementById('crm-status').textContent = 'Cliente creado correctamente.'; loadCrmData();
  } catch (error) { status.textContent = error.message; } finally { submit.disabled = false; }
}

function closeNewDriverModal() {
  document.getElementById('new-driver-modal').setAttribute('hidden', '');
}

function openNewDriverModal() {
  document.getElementById('new-driver-status').textContent = '';
  document.getElementById('new-driver-modal').removeAttribute('hidden');
  loadVehicleOwners().catch(() => { document.getElementById('new-driver-status').textContent = 'No se pudieron cargar los propietarios.'; });
  document.getElementById('new-driver-first-name').focus();
}

async function createManagedDriver(event) {
  event?.preventDefault();
  const form = document.getElementById('new-driver-form');
  const status = document.getElementById('new-driver-status');
  const submit = document.getElementById('new-driver-submit');
  if (!form.reportValidity()) return;
  const value = id => document.getElementById(id).value.trim();
  const bornDate = value('new-driver-born-date');
  const imageFile = document.getElementById('new-driver-image').files[0];
  const driverImage = imageFile ? await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(imageFile); }) : null;
  const payload = {
    cuil: value('new-driver-cuil') || null,
    dni: Number(value('new-driver-dni')),
    driverImage,
    bornDate: bornDate ? `${bornDate}T03:00:00.000Z` : null,
    firstName: value('new-driver-first-name'), lastName: value('new-driver-last-name'),
    genre: value('new-driver-genre') || null, age: null,
    city: value('new-driver-city'), province: value('new-driver-province'), country: value('new-driver-country') || 'Argentina',
    driverUserEmail: value('new-driver-email'), phoneNumber: value('new-driver-phone'),
    streetName: value('new-driver-street'), streetNumber: value('new-driver-street-number'),
    typeOfLivingPlace: value('new-driver-home-type'), floorNumber: value('new-driver-floor'), postalCode: value('new-driver-postal-code'),
    languages: [{ name: 'carrier.drivers.new_edit.languages.spanish', languageLevel: 5 }],
    driverSchedule: [2, 3, 4, 5, 6, 7, 1].map(dayNumber => ({ dayNumber, from: null, to: null })),
    travelPercentage: value('new-driver-travel-percentage') || '15', costPercentage: Number(value('new-driver-cost-percentage') || 0),
    paymentSettings: [
      { applyFinancing: false, isEnabled: true, paymentMethod: 'CREDIT_CARD' },
      { applyFinancing: false, isEnabled: true, paymentMethod: 'CHECKING_ACCOUNT' },
      { applyFinancing: false, isEnabled: true, paymentMethod: 'CASH' },
    ],
    vehicles: [], documents: [], vehicleOwnerId: Number(value('new-driver-owner')) || null,
  };
  submit.disabled = true; status.textContent = 'Creando chofer...';
  try {
    const response = await fetch(`${HASH_CLOUD_URL}/crm/drivers`, { method: 'POST', headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'No se pudo crear el chofer.');
    closeNewDriverModal();
    document.getElementById('crm-status').textContent = 'Chofer creado correctamente.';
    loadCrmData();
  } catch (error) { status.textContent = error.message; } finally { submit.disabled = false; }
}

function closeNewVehicleModal() {
  document.getElementById('new-vehicle-modal').setAttribute('hidden', '');
}

function openNewVehicleModal() {
  const modal = document.getElementById('new-vehicle-modal');
  const status = document.getElementById('new-vehicle-status');
  status.textContent = 'Cargando tipos...';
  // Abrir primero evita que la latencia de Livre Cloud bloquee el popup.
  modal.removeAttribute('hidden');
  document.getElementById('new-vehicle-domain').focus();
  vehicleTypesPromise = vehicleTypesPromise || apiCrm('vehicles/types');
  vehicleTypesPromise.then(data => {
    document.getElementById('new-vehicle-type').innerHTML = (data.items || []).map(type => `<option value="${crmEscape(type.id)}">${crmEscape(type.name || type.description || type.id)}</option>`).join('');
    status.textContent = '';
  }).catch(() => { status.textContent = 'No se pudieron cargar los tipos de vehículo.'; modal.removeAttribute('hidden'); });
}

async function createManagedVehicle() {
  const status = document.getElementById('new-vehicle-status');
  const submit = document.getElementById('new-vehicle-submit');
  const value = id => document.getElementById(id).value.trim();
  const card = { domain: value('new-vehicle-domain'), mark: value('new-vehicle-brand'), model: value('new-vehicle-model'), yearOfVehicle: value('new-vehicle-year'), color: value('new-vehicle-color'), vehicleTypeId: value('new-vehicle-type'), chassis: value('new-vehicle-chassis') || null, motor: value('new-vehicle-motor') || null };
  if ([card.domain, card.mark, card.model, card.yearOfVehicle, card.color, card.vehicleTypeId].some(item => !item)) { status.textContent = 'Completá todos los campos obligatorios.'; return; }
  submit.disabled = true; status.textContent = 'Creando...';
  try {
    const image = document.getElementById('new-vehicle-image').files[0];
    const photo = image ? await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(image); }) : null;
    const response = await fetch(`${HASH_CLOUD_URL}/crm/vehicles`, { method: 'POST', headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' }, body: JSON.stringify({ documents: [], identificationCard: card, characteristics: { haveAirConditioner: false, haveGas: false, haveDiesel: false, haveLuggage: false, haveMascotsPlace: false, kmsTraveled: 0 }, vehicleOwnerId: null, photo }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'No se pudo crear el vehículo.');
    document.getElementById('new-vehicle-modal').setAttribute('hidden', '');
    document.getElementById('crm-status').textContent = 'Vehículo creado correctamente.';
    loadCrmData();
  } catch (error) { status.textContent = error.message; } finally { submit.disabled = false; }
}

function renderTravelDistribution(distribution = {}) {
  const render = (elementId, points, formatLabel) => {
    const target = document.getElementById(elementId);
    if (!target) return;
    const values = Array.isArray(points) ? points : [];
    const max = Math.max(1, ...values.map(point => Number(point.total) || 0));
    target.classList.add('distribution-bars');
    target.innerHTML = values.length ? values.map(point => {
      const total = Number(point.total) || 0;
      const label = formatLabel(point.label);
      return `<div class="distribution-bar" title="${crmEscape(`${label}: ${total} viajes`)}"><span class="distribution-bar-value">${total}</span><i style="height:${Math.max(2, (total / max) * 100)}%"></i><small>${crmEscape(label)}</small></div>`;
    }).join('') : '<span>Sin datos de distribución</span>';
  };
  render('travel-distribution-hourly', distribution.hourly, label => String(label || '').slice(11, 16));
  render('travel-distribution-daily', distribution.daily, label => String(label || '').slice(5));
}

function renderTravelManagement(data, summary) {
  const table = document.getElementById('travel-management-table');
  const stateLabels = {
    SEARCHING_DRIVER: 'Buscando conductor', WITH_DRIVER_ASSIGNED: 'Conductor asignado', RESERVED: 'Reservado',
    CLOSING_TRAVEL: 'Cerrando viaje', GOING_TO_CLIENT: 'En camino al pasajero', GOING_TO_DESTINATION: 'En camino al destino',
    SCHEDULED: 'Programado', NO_AUTH: 'Sin autorización', NO_PAY: 'Sin pago', IN_CONFLICT: 'En conflicto',
    LOST: 'Perdido', CANCELED: 'Cancelado', CANCELLED: 'Cancelado', DONE: 'Finalizado',
  };
  const pick = (payload, keys) => { for (const key of keys) if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') return payload[key]; return '—'; };
  const cancellableStates = new Set(['SEARCHING_DRIVER', 'WITH_DRIVER_ASSIGNED', 'RESERVED', 'GOING_TO_CLIENT', 'GOING_TO_DESTINATION', 'CLOSING_TRAVEL', 'SCHEDULED', 'IN_CONFLICT']);
  const rows = data.items.map(item => {
    const p = { ...item, ...(item.raw_payload || {}) };
    if (p.origen !== undefined) p.origin = p.origen;
    if (p.destino !== undefined) p.destination = p.destino;
    if (p.created_at !== undefined) p.travelDate = p.created_at;
    if (p.status === 'pending' || p.status === 'searching') p.state = 'SEARCHING_DRIVER';
    if (p.status === 'confirmed') p.state = 'WITH_DRIVER_ASSIGNED';
    if (p.status === 'cancelled') p.state = 'CANCELLED';
    const state = pick(p, ['state', 'status', 'travelStatus']);
    const driver = [p.driverFirstName, p.driverLastName].filter(Boolean).join(' ') || p.driverName || p.driver || p.tracking_driver_name || (p.assigned_driver_user_id ? `ID ${p.assigned_driver_user_id}` : '—');
    const passenger = [p.passengerFirstName, p.passengerLastName].filter(Boolean).join(' ') || p.passengerName || p.passenger || '—';
    const readableState = state.split('-').map(value => stateLabels[value] || value).join(' · ');
    const travelId = p.travelId ?? p.id ?? item.id;
    const canCancel = state.split('-').some(value => cancellableStates.has(value));
    const action = canCancel ? `<button type="button" class="travel-cancel-row" data-travel-cancel="${crmEscape(travelId)}">Cancelar</button>` : '—';
    const vehicle = p.vehicleMark && p.vehicleModel ? `${p.vehicleMark} ${p.vehicleModel}` : [p.tracking_vehicle_model, p.tracking_vehicle_color, p.tracking_plate].filter(Boolean).join(' · ') || p.vehicleType || p.vehicle || '—';
    return `<tr><td>${crmEscape(travelId)}</td><td>${crmEscape(p.serviceType || p.type || p.travelType || '—')}</td><td>${crmEscape(p.travelDate || p.creationDate || p.scheduledAt)}</td><td>${crmEscape(driver)}</td><td>${crmEscape(passenger)}</td><td>${crmEscape(p.origin || p.from || '—')}</td><td>${crmEscape(p.destination || p.to || '—')}</td><td>${crmEscape(p.finalPrice ?? p.budget ?? p.price ?? p.amount)}</td><td>${crmEscape(vehicle)}</td><td><span class="travel-state">${crmEscape(readableState)}</span></td><td>${crmEscape(p.etafromBase)}</td><td>${crmEscape(p.distanceToPPUP)}</td><td>${crmEscape(p.travelDuration)}</td><td>${crmEscape(p.candidateCanceledQty)}</td><td>${action}</td></tr>`;
  }).join('');
  const size = Number(data.size) || travelPageSize;
  const page = Number(data.page) || 1;
  const totalPages = Math.max(1, Math.ceil((Number(data.total) || 0) / size));
  table.innerHTML = `<div class="travel-table-scroll"><table><thead><tr><th>Código</th><th>Tipo</th><th>Fecha</th><th>Chofer</th><th>Pasajero</th><th>Origen</th><th>Destino</th><th>Presupuesto</th><th>Tipo de vehículo</th><th>Estado</th><th>TEA</th><th>Distancia al pasajero</th><th>Tiempo en cola</th><th>Cancelaciones de candidatos</th><th>Acciones</th></tr></thead><tbody>${rows || '<tr><td colspan="15">No hay viajes registrados.</td></tr>'}</tbody></table></div><div class="travel-table-footer"><span>Total: ${data.total || 0}</span><label>Mostrar <select data-travel-size><option value="20" ${size === 20 ? 'selected' : ''}>20</option><option value="50" ${size === 50 ? 'selected' : ''}>50</option><option value="100" ${size === 100 ? 'selected' : ''}>100</option></select></label><span>Página ${page} de ${totalPages}</span><button type="button" data-travel-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button><button type="button" data-travel-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Siguiente</button></div>`;
  table.querySelectorAll('[data-travel-cancel]').forEach(button => button.addEventListener('click', () => cancelManagedTravel(button)));
  table.querySelectorAll('[data-travel-page]').forEach(button => button.addEventListener('click', () => {
    crmOffset = (Number(button.dataset.travelPage) - 1) * travelPageSize;
    loadCrmData();
  }));
  table.querySelector('[data-travel-size]').addEventListener('change', event => {
    travelPageSize = Number(event.target.value) || 20;
    crmOffset = 0;
    loadCrmData();
  });
  const sync = summary.last_sync && (summary.last_sync.finished_at || summary.last_sync.started_at);
  document.getElementById('travel-management-sync').textContent = sync ? `Última actualización: ${sync}` : 'Última actualización: —';
  renderTravelDistribution(data.distribution);
}
async function cancelManagedTravel(button) {
  const travelId = button.dataset.travelCancel;
  if (!travelId || !window.confirm(`¿Cancelar el viaje ${travelId}?`)) return;
  button.disabled = true;
  button.textContent = 'Cancelando...';
  try {
    const response = await fetch(`${HASH_CLOUD_URL}/crm/travels/${encodeURIComponent(travelId)}/cancel`, {
      method: 'PUT', headers: { Authorization: 'Bearer ' + getToken() },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'No se pudo cancelar el viaje.');
    document.getElementById('crm-status').textContent = data.message || 'Viaje cancelado correctamente.';
    loadCrmData();
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Cancelar';
    document.getElementById('crm-status').textContent = error.message || 'No se pudo cancelar el viaje.';
  }
}

async function loadCrmData() {
  const status = document.getElementById('crm-status');
  const loadSequence = ++crmLoadSequence;
  crmLoadController?.abort();
  crmLoadController = new AbortController();
  const requestOptions = { signal: crmLoadController.signal };
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
      const snapshot = await apiCrm('operational', requestOptions);
      if (loadSequence !== crmLoadSequence) return;
      renderOperationalDashboard(snapshot);
      status.textContent = 'Datos operativos actualizados.';
      return;
    }
    if (resource === 'travels') {
      const liveParams = new URLSearchParams({
        page: String(Math.floor(crmOffset / travelPageSize) + 1),
        size: String(travelPageSize),
        q: query.trim(),
        state: travelStateFilter,
        date_to: document.getElementById('travel-management-date').value,
      });
      if (document.getElementById('travel-management-date-from').value) {
        liveParams.set('date_from', document.getElementById('travel-management-date-from').value);
      }
      const data = await apiCrm('travels/live?' + liveParams.toString(), requestOptions);
      renderTravelManagement(data, {});
      const totals = data.totals || {};
      const counts = ['toAsignQuantity', 'inProgressQuantity', 'scheduledQuantity', 'inConflictQuantity', 'lostQuantity', 'cancelledQuantity', 'doneQuantity'];
      document.querySelectorAll('#travel-management-view .travel-status-tabs small').forEach((node, index) => {
        node.textContent = totals[counts[index]] ?? 0;
      });
      status.textContent = 'Viajes actualizados desde Livre Cloud.';
      return;
    }
    if (resource === 'passengers') {
      const liveParams = new URLSearchParams({
        page: String(Math.floor(crmOffset / crmPageSize) + 1),
        size: String(crmPageSize),
        q: query.trim(),
      });
      const data = await apiCrm('passengers?' + liveParams.toString(), requestOptions);
      if (loadSequence !== crmLoadSequence) return;
      renderCrmTable({
        resource: 'passengers',
        items: data.items.map(normalizeCrmPassenger),
        total: data.total,
        page: data.page,
        size: data.size,
      });
      status.textContent = 'Clientes actualizados desde la base local.';
      return;
    }
    if (resource === 'vehicles') {
      const liveParams = new URLSearchParams({ page: String(Math.floor(crmOffset / crmPageSize) + 1), size: String(crmPageSize), q: query.trim() });
      const data = await apiCrm('vehicles/live?' + liveParams.toString(), requestOptions);
      if (loadSequence !== crmLoadSequence) return;
      renderVehicleManagement(data);
      status.textContent = 'Vehículos actualizados desde Livre Cloud.';
      return;
    }
    if (resource === 'drivers') {
      const liveParams = new URLSearchParams({
        page: String(Math.floor(crmOffset / crmPageSize) + 1),
        size: String(crmPageSize),
        driver_code: driverFilters.code.trim(),
        driver_name: driverFilters.name.trim(),
        phone: driverFilters.phone.trim(),
        email: driverFilters.email.trim(),
        vehicle: driverFilters.vehicle.trim(),
      });
      const data = await apiCrm('drivers/live?' + liveParams.toString(), requestOptions);
      if (loadSequence !== crmLoadSequence) return;
      renderDriverManagement(data);
      status.textContent = 'Choferes actualizados desde Livre Cloud.';
      return;
    }
    const [summary, data] = await Promise.all([
      apiCrm('summary', requestOptions),
      apiCrm(resource + '?' + params.toString(), requestOptions),
    ]);
    if (loadSequence !== crmLoadSequence) return;
    if (resource === 'drivers') renderDriverManagement(data);
    else if (resource === 'vehicles') renderVehicleManagement(data);
    else {
      renderCrmCards(summary);
      renderCrmTable(data);
    }
    status.textContent = summary.last_sync ? `Última sincronización: ${new Date(summary.last_sync.finished_at || summary.last_sync.started_at).toLocaleString('es-AR')}` : '';
  } catch (error) {
    if (error.name === 'AbortError' || loadSequence !== crmLoadSequence) return;
    status.textContent = 'No se pudieron cargar los datos del CRM.';
    console.error(error);
  }
}

async function loadConversations() {
  const status = document.getElementById('conversations-status');
  const table = document.getElementById('conversations-table');
  status.textContent = 'Consultando Livre Cloud...';
  try {
    const data = await apiCrm('conversations?limit=100');
    const rows = (data.items || []).map(row => `<tr><td>${crmEscape(row.name || row.key)}</td><td>${crmEscape(row.chat_id || '—')}</td><td>${crmEscape(row.rows_count)}</td><td>${crmEscape(row.updated_at || row.created_at || '—')}</td></tr>`).join('');
    table.innerHTML = rows ? `<div class="vehicle-table-scroll"><table><thead><tr><th>Conversación</th><th>Chat</th><th>Mensajes</th><th>Última actualización</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="crm-empty">No hay conversaciones locales cargadas.</p>';
    status.textContent = `${data.total || 0} conversación(es) locales.`;
  } catch (error) {
    status.textContent = 'No se pudieron cargar las conversaciones locales.';
    console.error(error);
  }
}

function showConversations() {
  crmVisible = true;
  setChatWorkspaceVisible(false);
  document.getElementById('crm-title').textContent = 'Conversaciones';
  document.getElementById('crm-subtitle').textContent = 'Transcripciones y chats almacenados en Livre Cloud.';
  ['crm-cards', 'travel-management-view', 'driver-management-view', 'vehicle-management-view', 'owner-management-view', 'agency-commissions-view', 'driver-shift-closures-view', 'conversations-view', 'operational-view', 'map-view', 'crm-toolbar', 'crm-table-wrap'].forEach(id => { const node = document.getElementById(id) || document.querySelector('.' + id); if (node) node.hidden = true; });
  document.getElementById('conversations-view').hidden = false;
  document.getElementById('message-list').hidden = true;
  document.getElementById('composer').hidden = true;
  document.getElementById('travel-form-view').hidden = true;
  document.getElementById('crm-dashboard').hidden = false;
  loadConversations();
}

async function loadAgencyCommissions() {
  const status = document.getElementById('agency-commissions-status');
  const from = document.getElementById('agency-commissions-from').value;
  const to = document.getElementById('agency-commissions-to').value;
  const owner = document.getElementById('agency-commissions-owner').value;
  status.textContent = 'Consultando Livre Cloud...';
  try {
    const params = new URLSearchParams({ date_from: from, date_to: to, owner_id: owner, size: '50' });
    const data = await apiCrm('agency-commissions?' + params.toString());
    const ownerSelect = document.getElementById('agency-commissions-owner');
    const selected = ownerSelect.value;
    ownerSelect.innerHTML = '<option value="">Todos</option>' + (data.owners || []).map(item =>
      `<option value="${crmEscape(item.id)}">${crmEscape(item.name || '')}</option>`
    ).join('');
    ownerSelect.value = selected || data.owner_id || '';
    const totals = data.totals || {};
    document.getElementById('agency-commissions-totals').innerHTML = [
      ['Viajes', totals.trips], ['Vehículos', totals.vehicles], ['Total liquidado', totals.total],
      ['Comisión', totals.commission], ['Porcentaje', totals.commission_percent == null ? '—' : `${totals.commission_percent}%`],
    ].map(([label, value]) => `<article class="crm-card"><strong>${crmEscape(value)}</strong><span>${label}</span></article>`).join('');
    const rows = (data.items || []).map(row => `<tr><td>${crmEscape(row.travel_id)}</td><td>${crmEscape(row.vehicle)}</td><td>${crmEscape(row.vehicle_model)}</td><td>${crmEscape(row.owner)}</td><td>${crmEscape(row.total)}</td><td>${crmEscape(row.commission)}</td><td>${crmEscape(row.commission_percent)}%</td><td>${row.settled ? 'Liquidada' : 'Pendiente'}</td></tr>`).join('');
    document.getElementById('agency-commissions-table').innerHTML = rows ? `<div class="vehicle-table-scroll"><table><thead><tr><th>Viaje</th><th>Vehículo</th><th>Modelo</th><th>Propietario</th><th>Total</th><th>Comisión</th><th>%</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="crm-empty">No hay viajes Premium completados para el período seleccionado.</p>';
    status.textContent = `${data.total || 0} liquidación(es) encontradas.`;
  } catch (error) {
    status.textContent = 'No se pudieron cargar las comisiones.';
    console.error(error);
  }
}

async function settleAgencyCommissions() {
  const status = document.getElementById('agency-commissions-status');
  const button = document.getElementById('agency-commissions-settle');
  if (!window.confirm('¿Liquidar únicamente viajes Premium completados pendientes?')) return;
  button.disabled = true;
  status.textContent = 'Liquidando viajes Premium...';
  try {
    const data = await apiCrm('agency-commissions/settle', { method: 'POST' });
    status.textContent = `${data.settled_count || 0} viaje(s) Premium liquidado(s).`;
    await loadAgencyCommissions();
  } catch (error) {
    status.textContent = 'No se pudieron liquidar las comisiones.';
    console.error(error);
  } finally { button.disabled = false; }
}

function formatClosureMoney(value) {
  if (value === null || value === undefined) return '—';
  return `ARS ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

async function loadDriverShiftClosures() {
  const status = document.getElementById('shift-closures-status');
  const from = document.getElementById('shift-closures-from').value;
  const to = document.getElementById('shift-closures-to').value;
  if (from && to && from > to) { status.textContent = 'La fecha Desde no puede ser posterior a la fecha Hasta.'; return; }
  status.textContent = 'Consultando Livre Cloud...';
  try {
    const params = new URLSearchParams({ date_from: from, date_to: to, size: '50' });
    const data = await apiCrm('driver-shift-closures?' + params.toString());
    const columns = ['Fecha', 'Chofer', 'Vehículo', 'Viajes', 'Total facturado', 'Conductor', 'Comisión'];
    const rows = (data.items || []).map(row => `<tr><td>${crmEscape(row.closure_date)}</td><td>${crmEscape(row.driver_name)}</td><td>${crmEscape((row.vehicle_labels || []).join(', '))}</td><td>${crmEscape(row.trip_count)}</td><td>${crmEscape(formatClosureMoney(row.total_revenue))}</td><td>${crmEscape(formatClosureMoney(row.driver_revenue))}</td><td>${crmEscape(formatClosureMoney(row.commission))}</td></tr>`).join('');
    document.getElementById('shift-closures-table').innerHTML = rows ? `<div class="vehicle-table-scroll"><table><thead><tr>${columns.map(column => `<th>${crmEscape(column)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="crm-empty">No hay cierres para el período seleccionado.</p>';
    status.textContent = `${data.total || 0} cierre(s) encontrados.`;
  } catch (error) { status.textContent = 'No se pudieron cargar los cierres.'; console.error(error); }
}

function showDriverShiftClosures() {
  crmVisible = true;
  setChatWorkspaceVisible(false);
  document.getElementById('crm-title').textContent = 'Historial y cierres';
  document.getElementById('crm-subtitle').textContent = 'Cierres registrados en Livre Cloud.';
  ['crm-cards', 'travel-management-view', 'driver-management-view', 'vehicle-management-view', 'owner-management-view', 'agency-commissions-view', 'driver-shift-closures-view', 'conversations-view', 'operational-view', 'map-view', 'crm-toolbar', 'crm-table-wrap'].forEach(id => { const node = document.getElementById(id) || document.querySelector('.' + id); if (node) node.hidden = true; });
  document.getElementById('driver-shift-closures-view').hidden = false;
  document.getElementById('message-list').hidden = true;
  document.getElementById('composer').hidden = true;
  document.getElementById('travel-form-view').hidden = true;
  document.getElementById('crm-dashboard').hidden = false;
  const today = new Date().toISOString().slice(0, 10);
  const from = document.getElementById('shift-closures-from');
  const to = document.getElementById('shift-closures-to');
  if (!from.value) from.value = today;
  if (!to.value) to.value = today;
  loadDriverShiftClosures();
}

function showAgencyCommissions() {
  crmVisible = true;
  setChatWorkspaceVisible(false);
  document.getElementById('crm-title').textContent = 'Comisiones de agencia';
  document.getElementById('crm-subtitle').textContent = 'Liquidaciones consultadas desde Livre Cloud.';
  ['crm-cards', 'travel-management-view', 'driver-management-view', 'vehicle-management-view', 'owner-management-view', 'agency-commissions-view', 'driver-shift-closures-view', 'conversations-view', 'operational-view', 'map-view', 'crm-toolbar', 'crm-table-wrap'].forEach(id => { const node = document.getElementById(id) || document.querySelector('.' + id); if (node) node.hidden = true; });
  document.getElementById('agency-commissions-view').hidden = false;
  document.getElementById('message-list').hidden = true;
  document.getElementById('composer').hidden = true;
  document.getElementById('travel-form-view').hidden = true;
  document.getElementById('crm-dashboard').hidden = false;
  const today = new Date().toISOString().slice(0, 10);
  const from = document.getElementById('agency-commissions-from');
  const to = document.getElementById('agency-commissions-to');
  if (!from.value) from.value = today;
  if (!to.value) to.value = today;
  loadAgencyCommissions();
}

function showCrm(resource) {
  crmVisible = true;
  setChatWorkspaceVisible(false);
  crmMode = resource === 'control' ? 'control' : 'resource';
  if (resource === 'control') resource = 'travels';
  crmOffset = 0;
  crmPageSize = 20;
  travelStateFilter = '';
  const titles = {
    travels: ['Viajes', 'Listado y estado de los viajes.'],
    drivers: ['Choferes', 'Listado de choferes registrados.'],
    vehicles: ['Vehículos', 'Listado de vehículos registrados.'],
    passengers: ['Clientes', 'Listado de clientes registrados.'],
  };
  const title = crmMode === 'control' ? ['Operaciones', 'Resumen actualizado de la operación.'] : (titles[resource] || ['Gestión de datos', 'Datos registrados.']);
  document.getElementById('crm-title').textContent = title[0];
  document.getElementById('crm-subtitle').textContent = title[1];
  if (resource === 'travels') {
    resetTravelDateFilterToToday();
    travelStateFilter = TRAVEL_STATE_FILTERS[0];
    document.getElementById('travel-management-table')?.replaceChildren();
    document.querySelectorAll('#travel-management-view .travel-status-tabs button').forEach((button, index) => {
      button.classList.toggle('active', index === 0);
      button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    });
  }
  document.getElementById('crm-cards').hidden = true;
  document.getElementById('travel-management-view').hidden = crmMode !== 'resource' || resource !== 'travels';
  document.getElementById('driver-management-view').hidden = crmMode !== 'resource' || resource !== 'drivers';
  document.getElementById('vehicle-management-view').hidden = crmMode !== 'resource' || resource !== 'vehicles';
  document.getElementById('owner-management-view').hidden = true;
  document.getElementById('agency-commissions-view').hidden = true;
  document.getElementById('driver-shift-closures-view').hidden = true;
  document.getElementById('operational-view').hidden = crmMode !== 'control';
  document.getElementById('map-view').hidden = true;
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

function showVehicleOwnerManagement() {
  crmVisible = true;
  setChatWorkspaceVisible(false);
  document.getElementById('crm-title').textContent = 'Propietarios';
  document.getElementById('crm-subtitle').textContent = 'Propietarios registrados y disponibles para asignar.';
  document.getElementById('crm-cards').hidden = true;
  document.getElementById('travel-management-view').hidden = true;
  document.getElementById('driver-management-view').hidden = true;
  document.getElementById('vehicle-management-view').hidden = true;
  document.getElementById('owner-management-view').hidden = false;
  document.getElementById('agency-commissions-view').hidden = true;
  document.getElementById('driver-shift-closures-view').hidden = true;
  document.getElementById('operational-view').hidden = true;
  document.querySelector('.crm-toolbar').hidden = true;
  document.getElementById('crm-table-wrap').hidden = true;
  document.getElementById('message-list').hidden = true;
  document.getElementById('composer').hidden = true;
  document.getElementById('travel-form-view').hidden = true;
  document.getElementById('crm-dashboard').hidden = false;
  loadVehicleOwners().catch(error => { document.getElementById('crm-status').textContent = error.message; });
}

function hideCrm() {
  crmVisible = false;
  document.getElementById('crm-dashboard').hidden = true;
  document.getElementById('message-list').hidden = false;
  document.getElementById('composer').hidden = false;
}

function showChat() {
  setChatWorkspaceVisible(true);
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
let geocodeRequests = {};
let geocodePoints = {};
let travelLocations = null;
let travelMapResizeObserver = null;
let travelTileLayer = null;
let travelTileFallbackUsed = false;
let travelRouteRequest = 0;

function scheduleTravelMapInit() {
  let attempts = 0;
  const retry = () => {
    initTravelMap();
    if (travelMap || attempts++ >= 20) return;
    setTimeout(retry, 100);
  };
  requestAnimationFrame(() => requestAnimationFrame(retry));
}

function initTravelMap() {
  const container = document.getElementById('travel-map');
  if (!container || !window.L) return;
  if (!travelMap) {
    travelMap = L.map(container).setView([-38.7183, -62.2663], 12);
    travelTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
    }).addTo(travelMap);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      pane: 'overlayPane',
    }).addTo(travelMap);
    travelTileLayer.on('tileerror', () => {
      if (travelTileFallbackUsed || !travelMap) return;
      travelTileFallbackUsed = true;
      travelTileLayer.setUrl('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}');
    });
  }
  requestAnimationFrame(() => requestAnimationFrame(() => travelMap?.invalidateSize()));
  if (!travelMapResizeObserver && window.ResizeObserver) {
    travelMapResizeObserver = new ResizeObserver(() => travelMap?.invalidateSize());
    travelMapResizeObserver.observe(container);
  }
}

function clearTravelMapGraphics() {
  travelMapMarkers.forEach(marker => marker.remove());
  travelMapMarkers = [];
  travelRoute?.remove();
  travelRoute = null;
}

async function renderTravelAddressPoints(points) {
  if (!travelMap || !window.L) return;
  clearTravelMapGraphics();
  const validPoints = points.filter(Boolean);
  validPoints.forEach((point, index) => {
    const label = index === 0 ? 'Origen' : 'Destino';
    travelMapMarkers.push(L.marker(point).addTo(travelMap).bindPopup(label));
  });
  if (validPoints.length === 2) {
    const requestId = ++travelRouteRequest;
    const coordinates = validPoints.map(([latitude, longitude]) => `${longitude},${latitude}`).join(';');
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`, { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      const geometry = data.routes?.[0]?.geometry?.coordinates;
      if (requestId !== travelRouteRequest || !Array.isArray(geometry) || geometry.length < 2) return;
      travelRoute = L.polyline(geometry.map(([longitude, latitude]) => [latitude, longitude]), {
        color: '#55b9a9', weight: 5, opacity: 0.9,
      }).addTo(travelMap);
    } catch (_) {
      // Keep the verified address markers visible if routing is unavailable.
    }
  }
  if (validPoints.length) travelMap.fitBounds(validPoints, { padding: [24, 24], maxZoom: 16 });
}

async function geocodeTravelAddress(field, value) {
  const address = value.trim();
  if (!address) return null;
  const requestId = (geocodeRequests[field] || 0) + 1;
  geocodeRequests[field] = requestId;
  try {
    const response = await fetch('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
      q: `${address}, Bahía Blanca, Buenos Aires, Argentina`,
      format: 'jsonv2', limit: '1', countrycodes: 'ar',
    }), { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const result = (await response.json())[0];
    if (requestId !== geocodeRequests[field] || !result) return null;
    return [Number(result.lat), Number(result.lon)];
  } catch (_) {
    return null;
  }
}

function refreshTravelMap() {
  initTravelMap();
  if (!travelMap) return;
  travelLocations = null;
  travelRouteRequest += 1;
  clearTimeout(geocodeTimers.origin);
  clearTimeout(geocodeTimers.destination);
  geocodeTimers = {};
  geocodeRequests = {};
  geocodePoints = {};
  clearTravelMapGraphics();
  travelMap.setView([-38.7183, -62.2663], 12);
  const fields = [
    ['origin', document.getElementById('travel-origin')?.value || ''],
    ['destination', document.getElementById('travel-destination')?.value || ''],
  ];
  fields.forEach(([field, value]) => {
    if (!value.trim()) return;
    geocodeTimers[field] = setTimeout(async () => {
      const point = await geocodeTravelAddress(field, value);
      if (point) geocodePoints[field] = point;
      else delete geocodePoints[field];
      renderTravelAddressPoints([geocodePoints.origin, geocodePoints.destination]);
    }, 450);
  });
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
  setChatWorkspaceVisible(false);
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
  scheduleTravelMapInit();
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
let travelQuoteOptions = [];
const PANEL_WHATSAPP_USER = '5492915650870';

function decodeGooglePolyline(encoded) {
  const points = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([latitude / 1e5, longitude / 1e5]);
  }
  return points;
}

function travelMapPoint(value) {
  if (!value) return null;
  const latitude = Number(value.latitude ?? value.lat ?? value[0]);
  const longitude = Number(value.longitude ?? value.lng ?? value.lon ?? value[1]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null;
}

function renderTravelMapFromQuote(option) {
  travelRouteRequest += 1;
  let routeMap = option?.routeMap;
  if (typeof routeMap === 'string') {
    try { routeMap = JSON.parse(routeMap); } catch (_) { routeMap = null; }
  }
  const route = routeMap?.routes?.[0];
  const encoded = route?.overviewPolyline?.encodedPath || route?.overviewPolyline?.points;
  if (!window.L) return false;
  const points = encoded ? decodeGooglePolyline(encoded) : [];
  initTravelMap();
  if (!travelMap) return false;
  travelMapMarkers.forEach(marker => marker.remove());
  travelMapMarkers = [];
  travelRoute?.remove();
  if (points.length) travelRoute = L.polyline(points, { color: '#55b9a9', weight: 5, opacity: 0.9 }).addTo(travelMap);
  const bounds = points.slice();
  const origin = travelMapPoint(option?.origin || route?.origin || travelLocations?.origin);
  const destination = travelMapPoint(option?.destination || route?.destination || travelLocations?.destination);
  [[origin, 'Origen'], [destination, 'Destino']].forEach(([point, label]) => {
    if (!point) return;
    travelMapMarkers.push(L.marker(point).addTo(travelMap).bindPopup(label));
    bounds.push(point);
  });
  if (points.length) {
    if (bounds.length) travelMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  } else if (origin && destination) {
    renderTravelAddressPoints([origin, destination]);
  } else if (bounds.length) {
    travelMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
  }
  return Boolean(points.length || bounds.length);
}

function renderTravelQuotes(options) {
  const quoteBox = document.getElementById('travel-quote');
  const available = (options || []).filter(option => ['1', '2'].includes(String(option.transportTypeId)) && String(option.serviceStatus || '').toUpperCase() === 'AVAILABLE');
  const displayOptions = available.map((option, index) => {
    const id = String(option.transportTypeId || '');
    const premium = id === '1';
    return {
      option,
      id,
      label: premium ? 'Livre Premium' : 'Livre Ahorro',
      icon: premium ? '🚘' : '🚗',
      speed: premium ? 'Más rápido' : 'Más lento',
      selected: index === 0 ? ' checked' : '',
    };
  });
  travelQuoteOptions = displayOptions.map(item => item.option);
  quoteBox.innerHTML = displayOptions.map(item => `<label class="travel-quote-option"><input type="radio" name="travel-service" value="${crmEscape(String(item.option.transportTypeId))}"${item.selected}><span><strong>${item.icon} ${item.label}</strong><small>${item.speed} · Pago en efectivo</small><small>${crmEscape(item.option.duration || 'Tiempo no informado')} · ${crmEscape(item.option.distance ? `${item.option.distance} km` : 'Distancia no informada')}</small><small>Créditos dentro de la app</small></span><b>$ ${Number(item.option.pricePointToPoint || 0).toLocaleString('es-AR')}</b></label>`).join('');
  quoteBox.hidden = !available.length;
  return available;
}

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
    service_type_id: document.querySelector('input[name="travel-service"]:checked')?.value || null,
    fare: travelQuoteOptions.find(option => String(option.transportTypeId) === String(document.querySelector('input[name="travel-service"]:checked')?.value))?.pricePointToPoint || null,
    quote_id: travelQuote?.quote_id || null,
    conversation_id: travelQuote?.conversation_id || ('panel_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now())),
    source: 'panel',
    activity_type: 'real',
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
      const options = Array.isArray(data.options) ? data.options : [];
      if (!options.length && (!result || /no pude cotizar|error:/i.test(result))) {
        throw new Error(result || 'No se pudo obtener la cotización.');
      }
      travelQuote = {
        quote_id: data.quote_id,
        conversation_id: payload.conversation_id,
        origin,
        destination,
        programmed,
        date,
        time,
      };
      travelLocations = data.locations || null;
      renderTravelQuotes(options);
      renderTravelMapFromQuote(travelQuoteOptions[0]);
      status.textContent = options.length ? 'Elegí Livre Premium o Livre Ahorro y confirmá el viaje.' : result;
      submit.textContent = 'Confirmar y crear viaje';
      return;
    }

    status.textContent = result || 'Viaje creado correctamente.';
    const tripCreated = /Viaje (pedido|registrado|ya registrado|creado correctamente)/i.test(result);
    cancelButton.hidden = !tripCreated;
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
  const res = await fetch(HASH_CLOUD_URL + '/chat/' + chatId + '/title', {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Error ' + res.status);
}

async function apiDeleteChat(chatId) {
  const token = getToken();
  const res = await fetch(HASH_CLOUD_URL + '/chat/' + chatId, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Error ' + res.status);
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

  const processLine = (rawLine) => {
    const line = rawLine.replace(/\r$/, '');
    if (!line.startsWith('data: ')) return false;
    const chunk = line.slice(6);
    if (chunk === '[DONE]') return true;
    if (chunk.startsWith('[CHAT_ID] ')) {
      activeChatId = chunk.slice(10).trim();
      localStorage.setItem('hash_active_chat', activeChatId);
      return false;
    }
    if (chunk.startsWith('[ERROR]')) throw new Error(chunk.slice(8));
    fullReply += chunk.replace(/\\n/g, '\n');
    onChunk(fullReply);
    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer) processLine(buffer);
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (processLine(line)) return fullReply;
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



async function openNewChat() {
  const chat = await apiNewChat();
  const front = { id: chat.chat_id, name: chat.title || 'Nueva conversación', chat_id: chat.chat_id };
  FRONTS = [front, ...FRONTS.filter(item => item.chat_id !== front.chat_id)];
  activeChatId = front.chat_id;
  activeFrontId = front.chat_id;
  messages = [];
  chatCache[front.chat_id] = [];
  localStorage.setItem('hash_active_chat', activeChatId);
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

    const updateTempMessage = (partial, loading = false) => {
      const index = messages.findIndex(m => m.id === tempMsg.id);
      if (index < 0) return;
      messages[index].message = partial;
      messages[index].loading = loading;
      renderMessages();
    };

    const reply = await askHash(contextMessages, (partial) => {
      updateTempMessage(partial, false);
    });

    const tempIndex = messages.findIndex(m => m.id === tempMsg.id);
    if (tempIndex < 0) return;
    messages[tempIndex].message = reply;
    messages[tempIndex].loading = false;
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
  delete chatCache[frontId];
  renderFrontList();
  renderHeader();
  renderMessages();
  if (activeChatId) await syncFront(activeChatId);
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
  const list = document.getElementById('chat-list');
  if (!list) return;
  list.replaceChildren();
  if (!FRONTS.length) {
    const empty = document.createElement('p');
    empty.className = 'chat-list-empty';
    empty.textContent = 'Todavía no hay conversaciones.';
    list.appendChild(empty);
    return;
  }
  FRONTS.forEach(front => {
    const row = document.createElement('div');
    row.className = 'chat-list-row' + (front.chat_id === activeChatId ? ' chat-list-row--active' : '');
    row.setAttribute('role', 'listitem');
    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'chat-list-select';
    select.textContent = front.name || 'Nueva conversación';
    select.title = select.textContent;
    select.onclick = () => selectFront(front.chat_id);
    const actions = document.createElement('div');
    actions.className = 'chat-list-actions';
    const rename = document.createElement('button');
    rename.type = 'button'; rename.className = 'chat-list-action'; rename.textContent = 'Más opciones'; rename.title = 'Más opciones'; rename.setAttribute('aria-label', 'Más opciones');
    rename.onclick = () => openRenameModal(front);
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'chat-list-action chat-list-action--danger'; remove.textContent = 'Eliminar'; remove.title = 'Eliminar'; remove.setAttribute('aria-label', 'Eliminar');
    remove.onclick = () => confirmDeleteFront(front);
    actions.append(rename, remove);
    row.append(select, actions);
    list.appendChild(row);
  });
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



  document.getElementById('chat-new-button').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await openNewChat();
      document.querySelectorAll('#main-navigation .main-nav-item').forEach(item => item.classList.remove('main-nav-item--active'));
      document.querySelector('#main-navigation [data-view="livi"]').classList.add('main-nav-item--active');
    } catch (err) {
      setSyncStatus('error', 'No se pudo crear la conversación. Intentá de nuevo.');
      console.error('openNewChat error:', err);
    } finally {
      button.disabled = false;
    }
  });

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

  const sidebar = document.getElementById('sidebar');

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

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const vehicleModal = document.getElementById('new-vehicle-modal');
  if (vehicleModal && !vehicleModal.hidden) closeNewVehicleModal();
});

function updateTravelHistoryDateConstraints() {
  const from = document.getElementById('history-date-from');
  const to = document.getElementById('history-date-to');
  from.max = to.value || '';
  to.min = from.value || '';
  return !from.value || !to.value || from.value <= to.value;
}

async function loadTravelHistory() {
  const status = document.getElementById('history-status');
  const from = document.getElementById('history-date-from');
  const to = document.getElementById('history-date-to');
  if (!from.value || !to.value) {
    const end = new Date();
    const start = new Date(end); start.setDate(start.getDate() - 7);
    const iso = date => date.toISOString().slice(0, 10);
    if (!from.value) from.value = iso(start);
    if (!to.value) to.value = iso(end);
  }
  if (!updateTravelHistoryDateConstraints()) {
    status.textContent = 'La fecha Desde no puede ser posterior a la fecha Hasta.';
    return;
  }
  const params = new URLSearchParams({ page: '1', size: '50', date_from: from.value, date_to: to.value, state: document.getElementById('history-state').value, q: document.getElementById('history-search').value.trim() });
  status.textContent = 'Cargando historial real desde Livre Cloud...';
  try { const result = await apiCrm('travel-history?' + params); renderTravelHistory(result.items || [], result.summary); status.textContent = `Historial actualizado desde Livre Cloud · ${result.total || result.items?.length || 0} registros`; }
  catch (error) { status.textContent = 'No se pudo cargar el historial desde Livre Cloud.'; console.error(error); }
}
const TRAVEL_HISTORY_COLUMNS = [
  ['Col1', 'ID viaje'], ['Col2', 'Código'], ['Col3', 'Fecha'], ['Col4', 'Hora'],
  ['Col5', 'Chofer'], ['Col6', 'Pasajero'], ['Col7', 'Vehículo'], ['Col8', 'Servicio'],
  ['Col9', 'Origen'], ['Col10', 'Destino'], ['Col11', 'Precio final'], ['Col12', 'Estado'],
  ['Col13', 'Forma de pago'], ['Col14', 'Importe'], ['Col15', 'Presupuesto'],
];

function formatHistoryValue(value, key) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  if (/^Col(11|14|15)$/.test(key)) {
    const number = typeof value === 'number' ? value : Number(String(value).replace(/[$ARS\s.]/g, '').replace(',', '.'));
    if (Number.isFinite(number)) return `ARS ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)}`;
  }
  return String(value);
}

function renderTravelHistory(items, summary = {}) {
  const root = document.getElementById('travel-history-table'); root.replaceChildren();
  const summaryRoot = document.getElementById('travel-history-summary');
  const ars = value => `ARS ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
  summaryRoot.innerHTML = `<article><strong>${summary.trips ?? items.length}</strong><span>Viajes</span></article><article><strong>${ars(summary.final_amount_ars)}</strong><span>Importe final</span></article><article><strong>${ars(summary.amount_ars)}</strong><span>Importe total</span></article><article><strong>${ars(summary.budget_ars)}</strong><span>Presupuesto</span></article>`;
  if (!items.length) { root.innerHTML = '<p class="empty-state">No hay viajes para esos filtros.</p>'; return; }
  const available = new Set(items.flatMap(item => Object.keys(item || {})));
  const columns = TRAVEL_HISTORY_COLUMNS.filter(([key]) => available.has(key));
  const table = document.createElement('table');
  table.innerHTML = `<thead><tr>${columns.map(([, label]) => `<th>${crmEscape(label)}</th>`).join('')}</tr></thead>`;
  const tbody = document.createElement('tbody');
  items.forEach(item => {
    const tr = document.createElement('tr');
    columns.forEach(([key]) => { const td = document.createElement('td'); td.textContent = formatHistoryValue(item[key], key); tr.appendChild(td); });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); root.appendChild(table);
}
function showTravelHistory() {
  setChatWorkspaceVisible(false);
  document.getElementById('travel-form-view').hidden = true; document.getElementById('crm-dashboard').hidden = true; document.getElementById('travel-history-view').hidden = false; document.getElementById('message-list').hidden = true; document.getElementById('composer').hidden = true; crmVisible = false; loadTravelHistory();
}
function initThemeToggle() {
  const button = document.getElementById('theme-toggle');
  const meta = document.querySelector('meta[name="theme-color"]');
  const applyTheme = theme => {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    if (meta) meta.content = next === 'dark' ? '#111216' : '#ffffff';
    button.setAttribute('aria-pressed', String(next === 'dark'));
    button.textContent = next === 'dark' ? '☀️ Light' : '🌙 Dark';
  };
  applyTheme(localStorage.getItem('livre_theme'));
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('livre_theme', next);
    applyTheme(next);
  });
}

document.addEventListener('DOMContentLoaded', () => {

  initThemeToggle();
  const savedFont = localStorage.getItem('hash_font_size') || '18';
  document.documentElement.style.setProperty('--font-size-base', savedFont + 'px');
  document.querySelectorAll('#main-navigation .main-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#main-navigation .main-nav-item').forEach(item => item.classList.remove('main-nav-item--active'));
      btn.classList.add('main-nav-item--active');
      const view = btn.dataset.view;
      if (view === 'control') {
        showCrm('control');
      } else if (view === 'map-view') {
        showMapViewer();
      } else if (view === 'travels' || view === 'drivers' || view === 'vehicles' || view === 'passengers') {
        showCrm(view);
      } else if (view === 'agency-commissions') {
        showAgencyCommissions();
      } else if (view === 'driver-shift-closures') {
        showDriverShiftClosures();
      } else if (view === 'conversations') {
        showConversations();
      } else if (view === 'vehicle-owners') {
        showVehicleOwnerManagement();
      } else if (view === 'crear-viaje') {
        showTravelForm();
      } else {
        showChat();
      }
      closeSidebar();
    });
  });
  document.getElementById('crm-back').addEventListener('click', showChat);
  document.getElementById('travel-history-btn').addEventListener('click', showTravelHistory);
  document.getElementById('history-apply').addEventListener('click', loadTravelHistory);
  document.getElementById('history-refresh').addEventListener('click', loadTravelHistory);
  ['history-date-from', 'history-date-to'].forEach(id => document.getElementById(id).addEventListener('change', updateTravelHistoryDateConstraints));
  document.getElementById('history-state').addEventListener('change', loadTravelHistory);
  document.getElementById('history-search').addEventListener('keydown', event => { if (event.key === 'Enter') loadTravelHistory(); });

  document.getElementById('driver-new-button').addEventListener('click', openNewDriverModal);
  document.getElementById('owner-new-button').addEventListener('click', () => openOwnerModal());
  document.getElementById('new-owner-form').addEventListener('submit', saveVehicleOwner);
  document.getElementById('client-new-button').addEventListener('click', openNewClientModal);
  document.getElementById('new-client-form').addEventListener('submit', createManagedClient);
  document.getElementById('new-client-cancel').addEventListener('click', closeNewClientModal);
  document.getElementById('new-client-close').addEventListener('click', closeNewClientModal);
  document.getElementById('new-client-modal').addEventListener('click', event => { if (event.target.id === 'new-client-modal') closeNewClientModal(); });
  document.getElementById('new-owner-cancel').addEventListener('click', closeOwnerModal);
  document.getElementById('new-owner-close').addEventListener('click', closeOwnerModal);
  document.getElementById('new-owner-modal').addEventListener('click', event => { if (event.target.id === 'new-owner-modal') closeOwnerModal(); });
  document.getElementById('new-owner-email-confirm').addEventListener('click', event => confirmManagedEmail('new-owner-email', 'VEHICLEOWNER', 'new-owner-status', event.currentTarget));
  document.getElementById('owner-management-search').addEventListener('input', () => { ownerPage = 1; clearTimeout(crmSearchTimer); crmSearchTimer = setTimeout(loadVehicleOwners, 350); });
  document.getElementById('crm-refresh').addEventListener('click', loadCrmData);
  document.getElementById('map-view-refresh').addEventListener('click', loadMapViewer);
  document.getElementById('agency-commissions-apply').addEventListener('click', loadAgencyCommissions);
  document.getElementById('agency-commissions-settle').addEventListener('click', settleAgencyCommissions);
  document.getElementById('shift-closures-apply').addEventListener('click', loadDriverShiftClosures);
  ['operational-driver-search'].forEach(id => {
    const control = document.getElementById(id);
    if (control) control.addEventListener('input', () => { if (operationalSnapshot) renderOperationalDashboard(operationalSnapshot); });
  });
  document.getElementById('sidebar-settings').addEventListener('click', () => document.getElementById('settings-modal').removeAttribute('hidden'));
  document.getElementById('sidebar-logout').addEventListener('click', logout);
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
    const resource = document.getElementById('crm-resource').value;
    travelStateFilter = resource === 'travels' ? TRAVEL_STATE_FILTERS[0] : '';
    if (resource === 'travels') {
      document.querySelectorAll('#travel-management-view .travel-status-tabs button').forEach((button, index) => {
        button.classList.toggle('active', index === 0);
        button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      });
      document.getElementById('travel-management-table')?.replaceChildren();
    }
    document.getElementById('client-new-button').hidden = resource !== 'passengers';
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
  openDatePickerOnClick(document.getElementById('travel-management-date-from'));
  openDatePickerOnClick(document.getElementById('travel-management-date'));
  document.getElementById('vehicle-management-search').addEventListener('input', reloadFromStart);
  document.querySelector('.vehicle-new-button').addEventListener('click', openNewVehicleModal);
  document.getElementById('new-vehicle-cancel').addEventListener('click', closeNewVehicleModal);
  document.getElementById('new-vehicle-close').addEventListener('click', closeNewVehicleModal);
  document.getElementById('new-vehicle-modal').addEventListener('click', event => { if (event.target.id === 'new-vehicle-modal') closeNewVehicleModal(); });
  document.getElementById('new-vehicle-submit').addEventListener('click', createManagedVehicle);
  document.getElementById('new-driver-form').addEventListener('submit', createManagedDriver);
  document.getElementById('new-driver-cancel').addEventListener('click', closeNewDriverModal);
  document.getElementById('new-driver-close').addEventListener('click', closeNewDriverModal);
  document.getElementById('new-driver-modal').addEventListener('click', event => { if (event.target.id === 'new-driver-modal') closeNewDriverModal(); });
  document.getElementById('new-driver-email-confirm').addEventListener('click', event => confirmManagedEmail('new-driver-email', 'DRIVER', 'new-driver-status', event.currentTarget));
  document.querySelectorAll('#travel-management-view .travel-status-tabs button').forEach((button, index) => {
    button.addEventListener('click', () => {
      travelStateFilter = TRAVEL_STATE_FILTERS[index] || '';
      crmOffset = 0;
      syncTravelDateFromFilter();
      document.querySelectorAll('#travel-management-view .travel-status-tabs button').forEach(item => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-selected', item === button ? 'true' : 'false');
      });
      loadCrmData();
    });
  });
  document.querySelectorAll('#travel-management-view .travel-status-tabs button').forEach((button, index) => {
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
  });
  syncTravelDateFromFilter();
  resetTravelDateFilterToToday();
  checkAuth();
  setInterval(() => {
    const resource = document.getElementById('crm-resource')?.value;
    const travelsVisible = crmVisible && crmMode === 'resource' && resource === 'travels';
    if ((crmMode === 'control' || travelsVisible) && document.visibilityState === 'visible') loadCrmData();
  }, 5000);
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
