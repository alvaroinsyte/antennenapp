// =================================================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// =================================================================
const users = {
    admin: { password: 'admin123', role: 'admin' },
};
// Generamos los 15 usuarios estándar
for (let i = 1; i <= 15; i++) {
    users[`usuario${i}`] = { password: '123456', role: 'user' };
}

const defaultBrandCategories = {
    "Huawei": ["AAU/ATR", "AQU", "ASI", "APE"],
    "Kathrein": ["Antenas de Panel", "Filtros", "Amplificadores"],
    "Commscope": ["Base Station", "Microwave", "Small Cell"],
    "Rosenberger": ["Antenas de Panel", "Conectores", "Cables"],
    "Andrew": ["Antenas Direccionales", "Antenas Omni", "Cables Coaxiales"]
};

let db;
let editId = null;
let brandCategories = {};
let currentUser = null;

// =================================================================
// INICIALIZACIÓN DE LA APP
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    initDB();
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

function initDB() {
    const request = indexedDB.open('AntennaDatabase', 3);
    request.onerror = (e) => console.error('Error al abrir la base de datos:', e.target.error);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        const transaction = e.target.transaction;
        if (!db.objectStoreNames.contains('antennas')) {
            const antennaStore = db.createObjectStore('antennas', { keyPath: 'id', autoIncrement: true });
             // Aseguramos que el índice se cree junto con la tienda de objetos
            if (!antennaStore.indexNames.contains('registeredBy')) {
                antennaStore.createIndex('registeredBy', 'registeredBy', { unique: false });
            }
        }
        if (!db.objectStoreNames.contains('config')) {
            db.createObjectStore('config', { keyPath: 'id' });
        }
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        console.log('Base de datos lista.');
    };
}

// =================================================================
// LÓGICA DE LOGIN Y AUTENTICACIÓN
// =================================================================
function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const userData = users[username];

    if (userData && userData.password === password) {
        currentUser = { username: username, role: userData.role };
        document.getElementById('loginContainer').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('hidden');
        loadApp();
    } else {
        const loginError = document.getElementById('loginError');
        loginError.classList.remove('hidden');
        setTimeout(() => loginError.classList.add('hidden'), 3000);
    }
}

function handleLogout() {
    currentUser = null;
    location.reload();
}

function loadApp() {
    document.getElementById('welcomeUser').textContent = currentUser.username;
    if (currentUser.role === 'admin') {
        document.getElementById('openAdminPanelBtn').classList.remove('hidden');
    }
    setupEventListeners();
    loadConfigAndInitializeUI(); // <-- Esta es la función clave corregida
}

function setupEventListeners() {
    document.getElementById('antennaForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('brand').addEventListener('change', updateCategories);
    document.getElementById('cancelBtn').addEventListener('click', cancelEdit);
    document.getElementById('searchInput').addEventListener('input', (e) => loadAntennas(e.target.value));
    document.getElementById('openAdminPanelBtn').addEventListener('click', openAdminPanel);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('closeModalBtn').addEventListener('click', () => document.getElementById('adminModal').classList.add('hidden'));
    document.getElementById('addBrandForm').addEventListener('submit', handleAddBrand);
    document.getElementById('exportCsvBtn').addEventListener('click', exportToCsv);
}

// =================================================================
// LÓGICA DEL PANEL DE ADMIN
// =================================================================
function openAdminPanel() {
    document.getElementById('adminModal').classList.remove('hidden');
    renderAdminDashboard();
    renderBrandManager();
}

function renderAdminDashboard() {
    const contentDiv = document.getElementById('dashboardContent');
    contentDiv.innerHTML = '<p class="text-gray-500">Calculando resumen...</p>';
    const request = db.transaction(['antennas']).objectStore('antennas').getAll();
    request.onsuccess = e => {
        const antennas = e.target.result;
        const summary = { total: antennas.length, byBrand: {} };
        antennas.forEach(a => { summary.byBrand[a.brand] = (summary.byBrand[a.brand] || 0) + 1; });
        let html = `<div class="p-4 bg-blue-100 rounded-lg text-blue-800"><p class="text-3xl font-bold">${summary.total}</p><p>Antenas Totales</p></div>`;
        const brandsSummary = Object.entries(summary.byBrand).map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`).join('');
        html += `<div class="p-4 bg-green-100 rounded-lg text-green-800 col-span-1 md:col-span-2"><h4 class="font-semibold mb-2">Por Marca</h4><ul class="list-disc list-inside">${brandsSummary || '<li>No hay datos</li>'}</ul></div>`;
        contentDiv.innerHTML = html;
    };
}

function renderBrandManager() {
    const contentDiv = document.getElementById('brandManagerContent');
    contentDiv.innerHTML = '';
    Object.keys(brandCategories).sort().forEach(brand => {
        const brandDiv = document.createElement('div');
        brandDiv.className = 'p-3 border rounded-lg bg-gray-50';
        brandDiv.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h5 class="text-lg font-bold text-gray-800">${brand}</h5>
                <button onclick="handleDeleteBrand('${brand}')" class="text-red-500 hover:text-red-700 text-sm"><i class="fas fa-trash-alt"></i> Eliminar</button>
            </div>
            <ul class="space-y-1 ml-4">
                ${brandCategories[brand].map(cat => `
                    <li class="flex justify-between items-center"><span>- ${cat}</span>
                        <button onclick="handleDeleteCategory('${brand}', '${cat}')" class="text-red-500 hover:text-red-700 text-xs"><i class="fas fa-times"></i></button>
                    </li>`).join('') || '<li class="text-gray-500 text-sm">No hay categorías.</li>'}
            </ul>
            <form class="mt-3 flex gap-2" onsubmit="handleAddCategory(event, '${brand}')">
                <input type="text" placeholder="Nueva categoría" required class="flex-grow px-2 py-1 border rounded-md text-sm"><button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Añadir</button>
            </form>`;
        contentDiv.appendChild(brandDiv);
    });
}

function handleAddBrand(e) {
    e.preventDefault();
    const input = document.getElementById('newBrandName');
    const newBrandName = input.value.trim();
    if (newBrandName && !brandCategories[newBrandName]) {
        brandCategories[newBrandName] = [];
        saveConfigAndRefresh();
        input.value = '';
    } else alert('El nombre de la marca no puede estar vacío o ya existe.');
}

function handleAddCategory(e, brand) {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const newCategoryName = input.value.trim();
    if (newCategoryName && !brandCategories[brand].includes(newCategoryName)) {
        brandCategories[brand].push(newCategoryName);
        saveConfigAndRefresh();
    } else alert('El nombre de la categoría no puede estar vacío o ya existe.');
}

async function handleDeleteBrand(brand) {
    if (await isAttributeUsed('brand', brand)) {
        alert(`No se puede eliminar la marca "${brand}" porque está en uso.`);
        return;
    }
    if (confirm(`¿Eliminar permanentemente la marca "${brand}" y todas sus categorías?`)) {
        delete brandCategories[brand];
        saveConfigAndRefresh();
    }
}

async function handleDeleteCategory(brand, category) {
    if (await isAttributeUsed('category', category)) {
        alert(`No se puede eliminar la categoría "${category}" porque está en uso.`);
        return;
    }
    if (confirm(`¿Eliminar la categoría "${category}" de la marca "${brand}"?`)) {
        brandCategories[brand] = brandCategories[brand].filter(c => c !== category);
        saveConfigAndRefresh();
    }
}

function isAttributeUsed(attribute, value) {
    return new Promise(resolve => {
        const request = db.transaction(['antennas']).objectStore('antennas').getAll();
        request.onsuccess = e => resolve(e.target.result.some(a => a[attribute] === value));
        request.onerror = () => resolve(false);
    });
}

async function saveConfigAndRefresh() {
    const transaction = db.transaction(['config'], 'readwrite');
    const store = transaction.objectStore('config');
    store.put({ id: 'brandConfig', data: brandCategories });
    await transaction.complete; // Espera a que la transacción se complete

    // Refresca las vistas que dependen de esta configuración
    renderBrandManager();
    populateBrands();
    updateCategories();
    showNotification('Configuración actualizada', 'success');
}


function exportToCsv() {
    db.transaction(['antennas']).objectStore('antennas').getAll().onsuccess = e => {
        const antennas = e.target.result;
        if (antennas.length === 0) return alert('No hay antenas para exportar.');
        const headers = ['Marca', 'Categoría', 'Modelo', 'Registrado por'];
        const rows = antennas.map(a => [a.brand, a.category, a.model, a.registeredBy || 'N/A']);
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(r => `"${r.join('","')}"`).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "inventario_antenas.csv");
        link.click();
        link.remove();
    };
}

// =================================================================
// LÓGICA PRINCIPAL (CRUD, BÚSQUEDA, UI)
// =================================================================

// -------- FUNCIÓN CORREGIDA Y MEJORADA --------
function loadConfigAndInitializeUI() {
    const transaction = db.transaction(['config'], 'readwrite');
    const store = transaction.objectStore('config');
    const request = store.get('brandConfig');

    request.onsuccess = (e) => {
        if (e.target.result) {
            // La configuración ya existe en la base de datos, la usamos.
            brandCategories = e.target.result.data;
        } else {
            // Es la primera vez o no hay configuración, usamos la por defecto y la guardamos.
            brandCategories = defaultBrandCategories;
            store.put({ id: 'brandConfig', data: brandCategories });
        }
    };

    // Esta es la parte crucial: esperamos a que la transacción (lectura o escritura) se complete.
    // Solo entonces estamos seguros de que la variable `brandCategories` tiene los datos correctos.
    transaction.oncomplete = () => {
        console.log("Configuración cargada. Poblando la interfaz de usuario.");
        // Ahora sí, llamamos a las funciones que dibujan la UI.
        populateBrands();
        updateCategories();
        loadAntennas();
    };

    transaction.onerror = (e) => {
        console.error("Error en la transacción de configuración:", e.target.error);
        // Como plan B, si todo falla, usamos los datos por defecto para que la app no quede inutilizable.
        brandCategories = defaultBrandCategories;
        populateBrands();
        updateCategories();
        loadAntennas();
    };
}


function populateBrands() {
    const select = document.getElementById('brand');
    select.innerHTML = '<option value="" disabled selected>Seleccione una marca</option>';
    Object.keys(brandCategories).sort().forEach(brand => {
        select.add(new Option(brand, brand));
    });
}

function updateCategories() {
    const brandSelect = document.getElementById('brand');
    const categorySelect = document.getElementById('category');
    categorySelect.innerHTML = '';
    const selectedBrand = brandSelect.value;
    if (selectedBrand && brandCategories[selectedBrand]) {
        categorySelect.disabled = false;
        categorySelect.classList.remove('bg-gray-100');
        categorySelect.add(new Option("Seleccione una categoría", "", true, true));
        categorySelect.options[0].disabled = true;
        brandCategories[selectedBrand].forEach(cat => categorySelect.add(new Option(cat, cat)));
    } else {
        categorySelect.disabled = true;
        categorySelect.classList.add('bg-gray-100');
        categorySelect.add(new Option("Seleccione una marca primero", ""));
    }
}

function handleFormSubmit(event) {
    event.preventDefault();
    const antennaData = {
        brand: document.getElementById('brand').value,
        category: document.getElementById('category').value,
        model: document.getElementById('model').value.trim(),
    };
    if (!antennaData.brand || !antennaData.category || !antennaData.model) {
        return showNotification('Por favor, complete todos los campos.', 'error');
    }
    const tx = db.transaction(['antennas'], 'readwrite');
    const store = tx.objectStore('antennas');
    if (editId) {
        store.get(editId).onsuccess = e => {
            const original = e.target.result;
            store.put({ ...antennaData, id: editId, registeredBy: original.registeredBy });
        };
    } else {
        antennaData.registeredBy = currentUser.username;
        store.add(antennaData);
    }
    tx.oncomplete = () => {
        showNotification(editId ? 'Antena actualizada' : 'Antena agregada', 'success');
        resetForm();
        loadAntennas();
    };
}

function loadAntennas(searchTerm = '') {
    db.transaction(['antennas']).objectStore('antennas').getAll().onsuccess = e => {
        const lowerTerm = searchTerm.toLowerCase();
        const filtered = e.target.result.filter(a =>
            Object.values(a).some(val => String(val).toLowerCase().includes(lowerTerm))
        );
        renderTable(filtered);
    };
}

function renderTable(antennas) {
    const tableBody = document.getElementById('antennaTableBody');
    const noResults = document.getElementById('noResultsMessage');
    tableBody.innerHTML = '';
    noResults.classList.toggle('hidden', antennas.length > 0);
    noResults.textContent = document.getElementById('searchInput').value ? 'No se encontraron resultados.' : 'No hay antenas registradas.';
    antennas.forEach(antenna => {
        const row = tableBody.insertRow();
        row.className = 'hover:bg-gray-50';
        row.innerHTML = `
            <td class="px-6 py-4">${antenna.brand}</td>
            <td class="px-6 py-4"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getCategoryColor(antenna.category)}">${antenna.category}</span></td>
            <td class="px-6 py-4">${antenna.model}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${antenna.registeredBy || 'N/A'}</td>
            <td class="px-6 py-4 text-right text-sm font-medium">
                <button onclick="editAntenna(${antenna.id})" class="text-indigo-600 hover:text-indigo-900 mr-3">Editar</button>
                <button onclick="deleteAntenna(${antenna.id})" class="text-red-600 hover:text-red-900">Eliminar</button>
            </td>`;
    });
}

function editAntenna(id) {
    db.transaction(['antennas']).objectStore('antennas').get(id).onsuccess = e => {
        const antenna = e.target.result;
        if (!antenna) return;
        document.getElementById('brand').value = antenna.brand;
        updateCategories();
        document.getElementById('category').value = antenna.category;
        document.getElementById('model').value = antenna.model;
        document.getElementById('formTitle').textContent = 'Editar Antena';
        document.querySelector('button[type="submit"]').textContent = 'Actualizar Antena';
        document.getElementById('cancelBtn').classList.remove('hidden');
        editId = id;
        document.getElementById('antennaForm').scrollIntoView({ behavior: 'smooth' });
    };
}

function deleteAntenna(id) {
    if (confirm('¿Está seguro de que desea eliminar esta antena?')) {
        const tx = db.transaction(['antennas'], 'readwrite');
        tx.objectStore('antennas').delete(id);
        tx.oncomplete = () => {
            showNotification('Antena eliminada', 'success');
            loadAntennas();
        };
    }
}

function resetForm() {
    document.getElementById('antennaForm').reset();
    document.getElementById('formTitle').textContent = 'Agregar Nueva Antena';
    document.querySelector('button[type="submit"]').textContent = 'Guardar Antena';
    document.getElementById('cancelBtn').classList.add('hidden');
    editId = null;
    updateCategories();
}

function cancelEdit() {
    resetForm();
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-md shadow-lg text-white ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} transition-all duration-300 transform translate-x-full z-50`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.remove('translate-x-full'), 10);
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function getCategoryColor(category) {
    const colors = {
        'AAU/ATR': 'bg-red-100 text-red-800','AQU': 'bg-red-100 text-red-800','ASI': 'bg-red-100 text-red-800','APE': 'bg-red-100 text-red-800',
        'Antenas de Panel': 'bg-blue-100 text-blue-800','Filtros': 'bg-indigo-100 text-indigo-800','Amplificadores': 'bg-purple-100 text-purple-800',
        'Base Station': 'bg-green-100 text-green-800','Microwave': 'bg-yellow-100 text-yellow-800','Small Cell': 'bg-pink-100 text-pink-800',
        'Antenas Direccionales': 'bg-teal-100 text-teal-800','Antenas Omni': 'bg-orange-100 text-orange-800','Cables Coaxiales': 'bg-gray-200 text-gray-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
}