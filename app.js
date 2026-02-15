// ============================================
// BURGER OF THE MONTH CLUB - APPLICATION
// Uses Supabase REST API directly (no SDK needed)
// ============================================

let burgerData = [];
let galleryPhotos = [];
let lightboxIndex = 0;
let map;
let adminLoggedIn = false;

// ============================================
// SUPABASE REST HELPERS
// ============================================

const API_BASE = CONFIG.SUPABASE_URL + '/rest/v1';
const STORAGE_BASE = CONFIG.SUPABASE_URL + '/storage/v1';
const API_HEADERS = {
    'apikey': CONFIG.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
};

async function dbSelect(table, query = '') {
    const res = await fetch(`${API_BASE}/${table}?${query}`, {
        headers: { ...API_HEADERS, 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`DB select failed: ${res.status} ${await res.text()}`);
    return res.json();
}

async function dbInsert(table, data) {
    const res = await fetch(`${API_BASE}/${table}`, {
        method: 'POST',
        headers: { ...API_HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`DB insert failed: ${res.status} ${await res.text()}`);
    return res.json();
}

async function dbUpdate(table, data, matchColumn, matchValue) {
    const res = await fetch(`${API_BASE}/${table}?${matchColumn}=eq.${matchValue}`, {
        method: 'PATCH',
        headers: { ...API_HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`DB update failed: ${res.status} ${await res.text()}`);
    return res.json();
}

async function dbDelete(table, matchColumn, matchValue) {
    const res = await fetch(`${API_BASE}/${table}?${matchColumn}=eq.${matchValue}`, {
        method: 'DELETE',
        headers: API_HEADERS,
    });
    if (!res.ok) throw new Error(`DB delete failed: ${res.status} ${await res.text()}`);
}

async function storageUpload(bucket, path, file) {
    const res = await fetch(`${STORAGE_BASE}/object/${bucket}/${path}`, {
        method: 'POST',
        headers: {
            'apikey': CONFIG.SUPABASE_ANON_KEY,
        },
        body: file,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
    return `${STORAGE_BASE}/object/public/${bucket}/${path}`;
}

function isConfigured() {
    return CONFIG.SUPABASE_URL && CONFIG.SUPABASE_URL !== 'YOUR_SUPABASE_URL';
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initAdminPanel();
    initLightbox();

    // Load rankings — this is the main content
    await loadRankings().catch(e => console.error('Rankings load failed:', e));
    initMap();

    // Load secondary features in background
    loadGallery().catch(e => console.error('Gallery load failed:', e));
    checkFormStatus().catch(e => console.error('Form status check failed:', e));
    initSuggestionForm();
});

// ============================================
// NAVIGATION
// ============================================

function initNavigation() {
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    const navbar = document.getElementById('navbar');

    hamburger.addEventListener('click', () => {
        mobileMenu.classList.toggle('open');
    });

    document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('open');
        });
    });

    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 10);
    });

    const sections = document.querySelectorAll('.section');
    const navLinks = document.querySelectorAll('.nav-link:not(.admin-toggle)');
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const top = section.offsetTop - 100;
            if (window.scrollY >= top) {
                current = section.getAttribute('id');
            }
        });
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    });
}

// ============================================
// RANKINGS DATA
// ============================================

async function loadRankings() {
    if (!isConfigured()) {
        document.getElementById('sheets-table').innerHTML =
            '<tr><td style="padding:20px;text-align:center;color:#999;">Database not connected. Check Supabase config.</td></tr>';
        return;
    }

    try {
        const data = await dbSelect('results', 'select=*&order=ranking.asc');

        if (!data || data.length === 0) {
            document.getElementById('sheets-table').innerHTML =
                '<tr><td style="padding:20px;text-align:center;color:#999;">No rankings data found.</td></tr>';
            return;
        }

        burgerData = data.map(row => ({
            'Ranking': String(row.ranking || ''),
            'Burger Rating': String(row.burger_rating || ''),
            'Restaurant': row.restaurant || '',
            'Description': row.description || '',
            'Price': row.price || '',
            'Location': row.location || '',
            'Date of Visit': row.date_of_visit || '',
        }));

        renderTable(burgerData);
        initTableControls();
        populateBurgerSelect();
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('sheets-table').innerHTML =
            '<tr><td style="padding:20px;text-align:center;color:#999;">Failed to load rankings. Please try again later.</td></tr>';
    }
}

function renderTable(data) {
    const table = document.getElementById('sheets-table');
    const headers = ['Ranking', 'Burger Rating', 'Restaurant', 'Description', 'Price', 'Location', 'Date of Visit'];

    table.innerHTML = `
        <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
            ${data.map(row => `
                <tr>
                    <td class="rank-cell">${escapeHtml(row['Ranking'])}</td>
                    <td class="rating-cell">${escapeHtml(row['Burger Rating'])}</td>
                    <td><strong>${escapeHtml(row['Restaurant'])}</strong></td>
                    <td>${escapeHtml(row['Description'])}</td>
                    <td>${escapeHtml(row['Price'])}</td>
                    <td>${escapeHtml(row['Location'])}</td>
                    <td>${escapeHtml(row['Date of Visit'])}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
}

function initTableControls() {
    const searchBox = document.getElementById('searchBox');
    const sortSelect = document.getElementById('sortSelect');

    searchBox.addEventListener('input', () => filterAndSort());
    sortSelect.addEventListener('change', () => filterAndSort());
}

function filterAndSort() {
    const query = document.getElementById('searchBox').value.toLowerCase();
    const sortBy = document.getElementById('sortSelect').value;

    let filtered = burgerData.filter(row => {
        return (
            (row['Restaurant'] || '').toLowerCase().includes(query) ||
            (row['Description'] || '').toLowerCase().includes(query) ||
            (row['Location'] || '').toLowerCase().includes(query)
        );
    });

    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'rating-desc':
                return parseFloat(b['Burger Rating'] || 0) - parseFloat(a['Burger Rating'] || 0);
            case 'rating-asc':
                return parseFloat(a['Burger Rating'] || 0) - parseFloat(b['Burger Rating'] || 0);
            case 'price-asc':
                return parsePrice(a['Price']) - parsePrice(b['Price']);
            case 'price-desc':
                return parsePrice(b['Price']) - parsePrice(a['Price']);
            case 'date-desc':
                return new Date(b['Date of Visit'] || 0) - new Date(a['Date of Visit'] || 0);
            case 'date-asc':
                return new Date(a['Date of Visit'] || 0) - new Date(b['Date of Visit'] || 0);
            default:
                return 0;
        }
    });

    renderTable(filtered);
}

function parsePrice(priceStr) {
    if (!priceStr) return 0;
    return parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
}

// ============================================
// MAP (Leaflet.js)
// ============================================

// Keyed by normalized address from the Location field in the data
const ADDRESS_COORDS = {
    '8-53 onderdonk ave, ridgewood, ny 11385':       [40.7020, -73.9037],
    '329 van brunt st, brooklyn, ny 11231':           [40.6780, -74.0120],
    '132 1st ave., new york, ny 10009':               [40.7275, -73.9853],
    'east 3rd st, new york, ny 10009':                [40.7228, -73.9834],
    '180 prince st, new york, ny 10012':              [40.7263, -74.0021],
    '33 cortlandt alley, new york, ny 10013':         [40.7179, -74.0021],
    '305 bleecker st, new york, ny 10014':            [40.7325, -74.0037],
    '178 broadway, brooklyn, ny 11211':               [40.7101, -73.9631],
    '434 humboldt st, brooklyn, ny 11211':            [40.7169, -73.9430],
    '113 macdougal st, new york, ny 10012':           [40.7300, -74.0006],
    '155 w houston st, new york, ny 10012':           [40.7279, -74.0009],
    '131 essex street, new york, ny 10002':           [40.7199, -73.9876],
    '436 jefferson st, brooklyn, ny 11237':           [40.7037, -73.9226],
    '51-63 8th ave, new york, ny 10014':              [40.7384, -74.0040],
    '234 west 4th street, new york, ny 10014':        [40.7343, -74.0031],
    '46-46 vernon blvd, long island city, ny 11101':  [40.7460, -73.9531],
    '242 grand street, manhattan, ny 10012':          [40.7184, -73.9944],
    '1291 3rd ave, new york, ny 10021':               [40.7711, -73.9595],
    '331 w 4th st, new york, ny 10014':               [40.7381, -74.0038],
};

function initMap() {
    if (!document.getElementById('burger-map')) return;

    map = L.map('burger-map').setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
    }).addTo(map);

    const burgerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background: #d32f2f;
            width: 28px;
            height: 28px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        "><span style="transform:rotate(45deg);font-size:12px;">&#127828;</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
    });

    // One pin per address, popup lists all burgers at that location
    const grouped = {};
    burgerData.forEach(row => {
        const addr = (row['Location'] || '').toLowerCase().trim();
        if (!addr) return;
        if (!grouped[addr]) grouped[addr] = [];
        grouped[addr].push(row);
    });

    for (const [addr, entries] of Object.entries(grouped)) {
        let coords = ADDRESS_COORDS[addr];
        // Fuzzy fallback: try partial match
        if (!coords) {
            for (const [addrKey, addrCoords] of Object.entries(ADDRESS_COORDS)) {
                if (addr.includes(addrKey) || addrKey.includes(addr)) {
                    coords = addrCoords;
                    break;
                }
            }
        }

        if (coords) {
            const burgersHtml = entries.map(row => `
                <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #eee;">
                    <div class="popup-rating">${escapeHtml(row['Burger Rating'])}</div>
                    <div class="popup-detail">${escapeHtml(row['Description'])}</div>
                    <div class="popup-detail">${escapeHtml(row['Price'])} · ${escapeHtml(row['Date of Visit'])}</div>
                </div>
            `).join('');

            const marker = L.marker(coords, { icon: burgerIcon }).addTo(map);
            marker.bindPopup(`
                <div class="map-popup">
                    <h3>${escapeHtml(entries[0]['Restaurant'])}</h3>
                    <div class="popup-detail" style="margin-bottom:8px;">${escapeHtml(entries[0]['Location'])}</div>
                    ${burgersHtml}
                </div>
            `, { maxWidth: 280 });
        }
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) map.invalidateSize();
        });
    });
    observer.observe(document.getElementById('map'));
}

function rebuildMap() {
    if (!map) return;
    // Remove all existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
    });
    // Re-add markers from current burgerData
    const burgerIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background: #d32f2f;
            width: 28px;
            height: 28px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        "><span style="transform:rotate(45deg);font-size:12px;">&#127828;</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
    });

    const grouped = {};
    burgerData.forEach(row => {
        const addr = (row['Location'] || '').toLowerCase().trim();
        if (!addr) return;
        if (!grouped[addr]) grouped[addr] = [];
        grouped[addr].push(row);
    });

    for (const [addr, entries] of Object.entries(grouped)) {
        let coords = ADDRESS_COORDS[addr];
        if (!coords) {
            for (const [addrKey, addrCoords] of Object.entries(ADDRESS_COORDS)) {
                if (addr.includes(addrKey) || addrKey.includes(addr)) {
                    coords = addrCoords;
                    break;
                }
            }
        }
        if (coords) {
            const burgersHtml = entries.map(row => `
                <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #eee;">
                    <div class="popup-rating">${escapeHtml(row['Burger Rating'])}</div>
                    <div class="popup-detail">${escapeHtml(row['Description'])}</div>
                    <div class="popup-detail">${escapeHtml(row['Price'])} · ${escapeHtml(row['Date of Visit'])}</div>
                </div>
            `).join('');
            const marker = L.marker(coords, { icon: burgerIcon }).addTo(map);
            marker.bindPopup(`
                <div class="map-popup">
                    <h3>${escapeHtml(entries[0]['Restaurant'])}</h3>
                    <div class="popup-detail" style="margin-bottom:8px;">${escapeHtml(entries[0]['Location'])}</div>
                    ${burgersHtml}
                </div>
            `, { maxWidth: 280 });
        }
    }
}

// ============================================
// GALLERY
// ============================================

async function loadGallery() {
    const grid = document.getElementById('gallery-grid');

    if (!isConfigured()) {
        grid.innerHTML = '<p class="empty-text">Gallery not available — configure Supabase in config.js</p>';
        return;
    }

    try {
        const data = await dbSelect('gallery', 'select=*&order=created_at.desc');

        if (!data || data.length === 0) {
            grid.innerHTML = '<p class="empty-text">No photos yet. Photos from burger visits will appear here!</p>';
            return;
        }

        galleryPhotos = data;
        renderGallery(data, grid);
    } catch (err) {
        console.error('Gallery load error:', err);
        grid.innerHTML = '<p class="empty-text">Could not load gallery. Make sure Supabase tables are set up.</p>';
    }
}

function renderGallery(photos, container) {
    container.innerHTML = photos.map((photo, i) => `
        <div class="gallery-item" data-index="${i}" onclick="openLightbox(${i})">
            <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption || 'Burger photo')}" loading="lazy">
            <div class="gallery-caption">
                <strong>${escapeHtml(photo.restaurant)}</strong>
                ${escapeHtml(photo.caption)}
            </div>
        </div>
    `).join('');
}

// ============================================
// LIGHTBOX
// ============================================

function initLightbox() {
    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    document.getElementById('lightboxPrev').addEventListener('click', () => navigateLightbox(-1));
    document.getElementById('lightboxNext').addEventListener('click', () => navigateLightbox(1));

    document.getElementById('lightbox').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeLightbox();
    });

    document.addEventListener('keydown', e => {
        const lb = document.getElementById('lightbox');
        if (lb.style.display === 'none') return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigateLightbox(-1);
        if (e.key === 'ArrowRight') navigateLightbox(1);
    });
}

function openLightbox(index) {
    if (!galleryPhotos.length) return;
    lightboxIndex = index;
    updateLightbox();
    document.getElementById('lightbox').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
    document.body.style.overflow = '';
}

function navigateLightbox(dir) {
    lightboxIndex = (lightboxIndex + dir + galleryPhotos.length) % galleryPhotos.length;
    updateLightbox();
}

function updateLightbox() {
    const photo = galleryPhotos[lightboxIndex];
    document.getElementById('lightboxImg').src = photo.url;
    document.getElementById('lightboxCaption').textContent =
        `${photo.restaurant || ''} ${photo.caption ? '— ' + photo.caption : ''}`.trim();
}

// ============================================
// RATING FORM
// ============================================

async function checkFormStatus() {
    const statusDiv = document.getElementById('formStatus');
    const form = document.getElementById('ratingForm');

    if (!isConfigured()) {
        statusDiv.innerHTML = '<p>Form not available — configure Supabase in config.js</p>';
        statusDiv.className = 'form-status closed';
        return;
    }

    try {
        const data = await dbSelect('form_config', 'select=*&id=eq.1');
        const config = data[0];

        if (config && config.is_open) {
            statusDiv.innerHTML = `<p style="color:#4caf50;font-weight:700;">Form is OPEN</p>
                <p>Currently rating: <strong>${escapeHtml(config.active_burger || 'Unknown')}</strong></p>`;
            statusDiv.className = 'form-status open';
            document.getElementById('currentBurgerInfo').textContent =
                `Rating: ${config.active_burger || 'Current burger'}`;
            form.style.display = 'block';
        } else {
            statusDiv.innerHTML = '<p>The form is currently <strong>closed</strong>. Check back when the admin opens it for the next burger!</p>';
            statusDiv.className = 'form-status closed';
            form.style.display = 'none';
        }
    } catch (err) {
        console.error('Form status error:', err);
        statusDiv.innerHTML = '<p>Could not check form status.</p>';
        statusDiv.className = 'form-status closed';
    }

    form.addEventListener('submit', handleFormSubmit);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const msg = document.getElementById('formMessage');
    submitBtn.disabled = true;
    msg.textContent = 'Submitting...';
    msg.className = 'form-message';

    try {
        const configData = await dbSelect('form_config', 'select=active_burger,is_open&id=eq.1');
        const config = configData[0];

        if (!config || !config.is_open) {
            msg.textContent = 'Form has been closed. Your rating was not submitted.';
            msg.className = 'form-message error';
            submitBtn.disabled = false;
            return;
        }

        const rating = {
            burger: config.active_burger,
            name: document.getElementById('raterName').value,
            toppings: parseFloat(document.getElementById('toppingsRating').value),
            bun: parseFloat(document.getElementById('bunRating').value),
            doneness: parseFloat(document.getElementById('donenessRating').value),
            flavor: parseFloat(document.getElementById('flavorRating').value),
            created_at: new Date().toISOString(),
        };

        // Upload photo if provided
        const photoFile = document.getElementById('photoUpload').files[0];
        if (photoFile) {
            try {
                const fileName = `ratings/${Date.now()}_${photoFile.name}`;
                const publicUrl = await storageUpload('photos', fileName, photoFile);
                rating.photo_url = publicUrl;

                // Also add to gallery
                await dbInsert('gallery', {
                    url: publicUrl,
                    restaurant: config.active_burger,
                    caption: `Rated by ${rating.name}`,
                });
            } catch (uploadErr) {
                console.error('Photo upload failed, submitting without photo:', uploadErr);
            }
        }

        await dbInsert('ratings', rating);

        msg.textContent = 'Rating submitted! Thanks for your vote.';
        msg.className = 'form-message success';
        e.target.reset();
    } catch (err) {
        console.error('Submit error:', err);
        msg.textContent = 'Failed to submit. Please try again.';
        msg.className = 'form-message error';
    }
    submitBtn.disabled = false;
}

// ============================================
// ADMIN PANEL
// ============================================

function initAdminPanel() {
    document.querySelectorAll('.admin-toggle').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            document.getElementById('adminOverlay').style.display = 'flex';
            document.getElementById('mobileMenu').classList.remove('open');
        });
    });

    document.getElementById('adminClose').addEventListener('click', () => {
        document.getElementById('adminOverlay').style.display = 'none';
    });

    document.getElementById('adminOverlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) {
            document.getElementById('adminOverlay').style.display = 'none';
        }
    });

    document.getElementById('adminLoginBtn').addEventListener('click', handleAdminLogin);
    document.getElementById('adminPassword').addEventListener('keydown', e => {
        if (e.key === 'Enter') handleAdminLogin();
    });

    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        });
    });

    document.getElementById('addBurgerBtn').addEventListener('click', handleAddBurger);
    document.getElementById('activateFormBtn').addEventListener('click', () => handleFormControl(true));
    document.getElementById('deactivateFormBtn').addEventListener('click', () => handleFormControl(false));
    document.getElementById('uploadGalleryBtn').addEventListener('click', handleGalleryUpload);
    document.getElementById('changePasswordBtn').addEventListener('click', handleChangePassword);
    initAddressSearch();

    // Collapsible burger list toggle
    document.getElementById('burgerListToggle').addEventListener('click', () => {
        const wrapper = document.getElementById('adminBurgerListWrapper');
        const arrow = document.querySelector('#burgerListToggle .collapse-arrow');
        const isOpen = wrapper.style.display !== 'none';
        wrapper.style.display = isOpen ? 'none' : 'block';
        arrow.textContent = isOpen ? '\u25B6' : '\u25BC';
    });
}

async function handleAdminLogin() {
    const password = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('adminLoginError');

    if (!password) {
        errorEl.textContent = 'Please enter a password.';
        return;
    }

    const hash = await hashPassword(password);
    let storedHash = CONFIG.ADMIN_PASSWORD_HASH;

    if (isConfigured()) {
        try {
            const data = await dbSelect('form_config', 'select=admin_hash&id=eq.1');
            if (data[0] && data[0].admin_hash) {
                storedHash = data[0].admin_hash;
            }
        } catch (e) {
            // Fall back to config hash
        }
    }

    if (hash === storedHash) {
        adminLoggedIn = true;
        errorEl.textContent = '';
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        loadAdminData();
    } else {
        errorEl.textContent = 'Incorrect password.';
    }
}

async function loadAdminData() {
    if (!isConfigured()) return;

    try {
        const data = await dbSelect('form_config', 'select=*&id=eq.1');
        const config = data[0];
        const statusDiv = document.getElementById('formControlStatus');
        if (config) {
            statusDiv.innerHTML = `
                <p>Status: <span class="${config.is_open ? 'status-open' : 'status-closed'}">
                    ${config.is_open ? 'OPEN' : 'CLOSED'}
                </span></p>
                ${config.active_burger ? `<p>Active burger: <strong>${escapeHtml(config.active_burger)}</strong></p>` : ''}
            `;
        }
    } catch (e) {
        console.error('Load admin data error:', e);
    }

    try {
        const ratings = await dbSelect('ratings', 'select=*&order=created_at.desc&limit=100');
        const ratingsDiv = document.getElementById('submittedRatings');
        if (ratings && ratings.length > 0) {
            // Group by burger for summary
            const byBurger = {};
            ratings.forEach(r => {
                const key = r.burger || 'Unknown';
                if (!byBurger[key]) byBurger[key] = [];
                byBurger[key].push(r);
            });

            let html = '';
            for (const [burger, entries] of Object.entries(byBurger)) {
                const avgT = (entries.reduce((s, r) => s + (r.toppings || 0), 0) / entries.length).toFixed(1);
                const avgB = (entries.reduce((s, r) => s + (r.bun || 0), 0) / entries.length).toFixed(1);
                const avgD = (entries.reduce((s, r) => s + (r.doneness || 0), 0) / entries.length).toFixed(1);
                const avgF = (entries.reduce((s, r) => s + (r.flavor || 0), 0) / entries.length).toFixed(1);
                const avgAll = ((parseFloat(avgT) + parseFloat(avgB) + parseFloat(avgD) + parseFloat(avgF)) / 4).toFixed(2);

                html += `
                    <div class="ratings-burger-group">
                        <div class="ratings-burger-header">
                            <strong>${escapeHtml(burger)}</strong>
                            <span class="ratings-avg">Avg: ${avgAll} (${entries.length} vote${entries.length > 1 ? 's' : ''})</span>
                        </div>
                        <div class="ratings-summary">Toppings: ${avgT} | Bun: ${avgB} | Doneness: ${avgD} | Flavor: ${avgF}</div>
                        <table class="ratings-table">
                            <thead><tr><th>Name</th><th>Toppings</th><th>Bun</th><th>Doneness</th><th>Flavor</th><th>Avg</th><th>Date</th></tr></thead>
                            <tbody>
                                ${entries.map(r => {
                                    const rowAvg = ((r.toppings + r.bun + r.doneness + r.flavor) / 4).toFixed(1);
                                    return `<tr>
                                        <td>${escapeHtml(r.name)}</td>
                                        <td>${r.toppings}</td>
                                        <td>${r.bun}</td>
                                        <td>${r.doneness}</td>
                                        <td>${r.flavor}</td>
                                        <td><strong>${rowAvg}</strong></td>
                                        <td>${new Date(r.created_at).toLocaleDateString()}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
            ratingsDiv.innerHTML = html;
        } else {
            ratingsDiv.innerHTML = '<p style="color:#999;">No ratings submitted yet.</p>';
        }
    } catch (e) {
        console.error('Load ratings error:', e);
    }

    try {
        const photos = await dbSelect('gallery', 'select=*&order=created_at.desc');
        const adminGrid = document.getElementById('adminGalleryGrid');
        if (photos && photos.length > 0) {
            adminGrid.innerHTML = photos.map(p => `
                <div class="admin-gallery-item">
                    <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.caption || '')}">
                    <button class="delete-photo" onclick="deletePhoto(${p.id})">&times;</button>
                </div>
            `).join('');
        } else {
            adminGrid.innerHTML = '<p style="color:#999;">No photos in gallery.</p>';
        }
    } catch (e) {
        console.error('Load gallery admin error:', e);
    }

    // Populate existing burgers list with delete buttons
    try {
        const burgerListDiv = document.getElementById('adminBurgerList');
        if (burgerData.length > 0) {
            const sorted = [...burgerData].sort((a, b) =>
                (a['Restaurant'] || '').localeCompare(b['Restaurant'] || ''));
            burgerListDiv.innerHTML = sorted.map(row => {
                const safeRestaurant = (row['Restaurant'] || '').replace(/'/g, "\\'");
                return `
                <div class="admin-burger-entry">
                    <div class="admin-burger-info">
                        <strong>#${escapeHtml(row['Ranking'])} ${escapeHtml(row['Restaurant'])}</strong>
                        <span class="admin-burger-desc">${escapeHtml(row['Description'])}</span>
                        <span class="admin-burger-meta">${escapeHtml(row['Price'])} · ${escapeHtml(row['Location'])} · ${escapeHtml(row['Date of Visit'])}</span>
                    </div>
                    <button class="btn-delete-burger" onclick="deleteBurger(${escapeHtml(row['Ranking'])}, '${safeRestaurant}')" title="Delete this burger">&times;</button>
                </div>
            `}).join('');
        } else {
            burgerListDiv.innerHTML = '<p style="color:#999;">No burgers yet.</p>';
        }
    } catch (e) {
        console.error('Load burger list error:', e);
    }

    // Load suggestions
    loadSuggestions();
}

function populateBurgerSelect() {
    // Populate all selects that need a per-burger dropdown
    const formSelect = document.getElementById('activateBurgerSelect');
    const gallerySelect = document.getElementById('galleryBurgerSelect');

    const selects = [formSelect, gallerySelect].filter(Boolean);

    // Clear existing options first (keep the placeholder)
    selects.forEach(select => {
        select.innerHTML = '<option value="">-- Select a burger --</option>';
    });

    // Build options sorted alphabetically by restaurant then description
    const options = burgerData.map(row => {
        const restaurant = row['Restaurant'] || '';
        const desc = row['Description'] || '';
        const shortDesc = desc.length > 50 ? desc.substring(0, 50) + '...' : desc;
        return {
            label: `${restaurant} — ${shortDesc}`,
            value: `${restaurant} ||| ${desc}`,
            sortKey: restaurant.toLowerCase() + ' ' + desc.toLowerCase(),
        };
    });

    options.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    options.forEach(({ label, value }) => {
        selects.forEach(select => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            select.appendChild(opt);
        });
    });
}

// ============================================
// ADDRESS SEARCH (Nominatim / OpenStreetMap)
// ============================================

let selectedAddressData = null;
let addressSearchTimer = null;

function initAddressSearch() {
    const searchBtn = document.getElementById('searchAddressBtn');
    const addressInput = document.getElementById('newAddress');

    searchBtn.addEventListener('click', () => searchAddress());
    addressInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); searchAddress(); }
    });

    // Auto-suggest as you type (debounced 400ms)
    addressInput.addEventListener('input', () => {
        clearTimeout(addressSearchTimer);
        const val = addressInput.value.trim();
        if (val.length >= 3) {
            addressSearchTimer = setTimeout(() => searchAddress(), 400);
        } else {
            document.getElementById('addressResults').classList.remove('show');
        }
    });
}

async function searchAddress() {
    const query = document.getElementById('newAddress').value.trim();
    const resultsDiv = document.getElementById('addressResults');

    if (!query) {
        resultsDiv.classList.remove('show');
        return;
    }

    resultsDiv.innerHTML = '<div class="address-searching">Searching...</div>';
    resultsDiv.classList.add('show');

    try {
        // Use Nominatim free geocoder (OpenStreetMap) — no API key needed
        const url = `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=us`;

        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
        });
        const data = await res.json();

        if (!data || data.length === 0) {
            resultsDiv.innerHTML = '<div class="address-searching">No results found. Try a more specific address.</div>';
            return;
        }

        resultsDiv.innerHTML = data.map((item, i) => {
            const addr = item.address || {};
            const street = [addr.house_number, addr.road].filter(Boolean).join(' ') ||
                             item.display_name.split(',')[0];
            const city = addr.city || addr.town || addr.village || addr.hamlet || '';
            const borough = addr.suburb || addr.neighbourhood || '';
            // For NYC: use borough (Brooklyn, Manhattan, etc.) if city is "New York" or "City of New York"
            const cityDisplay = (city.toLowerCase().includes('new york') && borough) ? borough : city;
            const state = addr.state ? abbrevState(addr.state) : '';
            const zip = addr.postcode || '';
            // Build formatted address like: "592 Leonard Street, Brooklyn, NY 11222"
            const formattedAddr = [street, cityDisplay, [state, zip].filter(Boolean).join(' ')]
                .filter(Boolean).join(', ');

            return `
                <div class="address-result-item" data-index="${i}"
                     data-lat="${item.lat}" data-lon="${item.lon}"
                     data-formatted="${escapeHtml(formattedAddr)}"
                     data-display="${escapeHtml(item.display_name)}">
                    <div class="addr-main">${escapeHtml(street)}</div>
                    <div class="addr-detail">${escapeHtml([cityDisplay, state, zip].filter(Boolean).join(', '))}</div>
                </div>
            `;
        }).join('');

        // Click handler for results
        resultsDiv.querySelectorAll('.address-result-item').forEach(item => {
            item.addEventListener('click', () => selectAddress(item));
        });
    } catch (err) {
        console.error('Address search error:', err);
        resultsDiv.innerHTML = '<div class="address-searching">Search failed. Please try again.</div>';
    }
}

function selectAddress(item) {
    const lat = parseFloat(item.dataset.lat);
    const lon = parseFloat(item.dataset.lon);
    const formatted = item.dataset.formatted;

    selectedAddressData = { lat, lon, formatted };

    document.getElementById('newLat').value = lat;
    document.getElementById('newLng').value = lon;
    document.getElementById('newLocation').value = formatted;

    const selectedDiv = document.getElementById('selectedAddress');
    selectedDiv.innerHTML = `
        &#x2705; <strong>${escapeHtml(formatted)}</strong>
        <span class="clear-address" title="Clear selection">&times;</span>
    `;
    selectedDiv.style.display = 'flex';

    selectedDiv.querySelector('.clear-address').addEventListener('click', () => {
        clearAddressSelection();
    });

    document.getElementById('addressResults').classList.remove('show');
    document.getElementById('newAddress').value = formatted;
}

function clearAddressSelection() {
    selectedAddressData = null;
    document.getElementById('newLat').value = '';
    document.getElementById('newLng').value = '';
    document.getElementById('newLocation').value = '';
    document.getElementById('selectedAddress').style.display = 'none';
    document.getElementById('newAddress').value = '';
}

async function handleAddBurger() {
    const msg = document.getElementById('addBurgerMsg');

    if (!isConfigured()) {
        msg.textContent = 'Supabase not configured.';
        msg.className = 'form-message error';
        return;
    }

    if (!selectedAddressData) {
        msg.textContent = 'Please search and select an address for the map pin.';
        msg.className = 'form-message error';
        return;
    }

    // Auto-format price with $
    let rawPrice = document.getElementById('newPrice').value.trim();
    rawPrice = rawPrice.replace(/[^0-9.]/g, ''); // strip non-numeric
    if (rawPrice && !rawPrice.startsWith('$')) rawPrice = '$' + parseFloat(rawPrice).toFixed(2);

    // Format date as M/D/YYYY
    const rawDate = document.getElementById('newDate').value; // YYYY-MM-DD from date input
    let formattedDate = rawDate;
    if (rawDate) {
        const [y, m, d] = rawDate.split('-');
        formattedDate = `${parseInt(m)}/${parseInt(d)}/${y}`;
    }

    const burger = {
        restaurant: document.getElementById('newRestaurant').value,
        description: document.getElementById('newDescription').value,
        price: rawPrice,
        location: document.getElementById('newLocation').value,
        date_of_visit: formattedDate,
        lat: selectedAddressData.lat,
        lng: selectedAddressData.lon,
    };

    if (!burger.restaurant || !burger.description || !burger.price) {
        msg.textContent = 'Please fill in all required fields.';
        msg.className = 'form-message error';
        return;
    }

    try {
        await dbInsert('burgers', burger);

        // Also add to results table
        const maxData = await dbSelect('results', 'select=ranking&order=ranking.desc&limit=1');
        const nextRanking = (maxData[0] ? maxData[0].ranking : 0) + 1;

        await dbInsert('results', {
            ranking: nextRanking,
            burger_rating: null,
            restaurant: burger.restaurant,
            description: burger.description,
            price: burger.price,
            location: burger.location,
            date_of_visit: burger.date_of_visit,
        });

        // Add coords so map can find the new address
        const addrKey = burger.location.toLowerCase().trim();
        ADDRESS_COORDS[addrKey] = [burger.lat, burger.lng];

        msg.textContent = 'Burger added to the rankings!';
        msg.className = 'form-message success';

        // Reset form
        document.getElementById('newRestaurant').value = '';
        document.getElementById('newDescription').value = '';
        document.getElementById('newPrice').value = '';
        document.getElementById('newDate').value = '';
        clearAddressSelection();

        // Reload everything so new burger appears in table, map, dropdowns
        await loadRankings();
        rebuildMap();
        loadAdminData();
    } catch (err) {
        console.error('Add burger error:', err);
        msg.textContent = 'Failed to add burger: ' + err.message;
        msg.className = 'form-message error';
    }
}

async function handleFormControl(open) {
    const msg = document.getElementById('formControlMsg');

    if (!isConfigured()) {
        msg.textContent = 'Supabase not configured.';
        msg.className = 'form-message error';
        return;
    }

    const burgerValue = document.getElementById('activateBurgerSelect').value;
    if (open && !burgerValue) {
        msg.textContent = 'Select a burger to activate the form for.';
        msg.className = 'form-message error';
        return;
    }

    // Parse "Restaurant ||| Description" format
    const [burgerRestaurant, burgerDesc] = burgerValue.split(' ||| ');
    const burgerLabel = burgerRestaurant + (burgerDesc ? ' — ' + (burgerDesc.length > 60 ? burgerDesc.substring(0, 60) + '...' : burgerDesc) : '');

    try {
        const update = { is_open: open };
        if (open) update.active_burger = burgerLabel;

        await dbUpdate('form_config', update, 'id', 1);

        msg.textContent = open ? `Form opened for "${burgerLabel}"!` : 'Form closed.';
        msg.className = 'form-message success';
        loadAdminData();
        checkFormStatus();
    } catch (err) {
        console.error('Form control error:', err);
        msg.textContent = 'Failed: ' + err.message;
        msg.className = 'form-message error';
    }
}

async function handleGalleryUpload() {
    const msg = document.getElementById('galleryUploadMsg');
    const files = document.getElementById('galleryPhoto').files;
    const burgerValue = document.getElementById('galleryBurgerSelect').value;
    const caption = document.getElementById('galleryCaption').value;

    // Parse "Restaurant ||| Description"
    const [restaurant, burgerDesc] = burgerValue ? burgerValue.split(' ||| ') : ['', ''];

    if (!isConfigured()) {
        msg.textContent = 'Supabase not configured.';
        msg.className = 'form-message error';
        return;
    }

    if (!burgerValue) {
        msg.textContent = 'Please select which burger this photo is for.';
        msg.className = 'form-message error';
        return;
    }

    if (!files.length) {
        msg.textContent = 'Please select at least one photo.';
        msg.className = 'form-message error';
        return;
    }

    msg.textContent = 'Uploading...';
    msg.className = 'form-message';

    try {
        for (const file of files) {
            const fileName = `gallery/${Date.now()}_${file.name}`;
            const publicUrl = await storageUpload('photos', fileName, file);

            await dbInsert('gallery', {
                url: publicUrl,
                restaurant: restaurant || '',
                caption: caption || (burgerDesc ? burgerDesc.substring(0, 80) : ''),
            });
        }

        msg.textContent = `${files.length} photo(s) uploaded!`;
        msg.className = 'form-message success';
        document.getElementById('galleryPhoto').value = '';
        loadGallery();
        loadAdminData();
    } catch (err) {
        console.error('Gallery upload error:', err);
        msg.textContent = 'Upload failed: ' + err.message;
        msg.className = 'form-message error';
    }
}

async function deletePhoto(id) {
    if (!confirm('Delete this photo?')) return;

    try {
        await dbDelete('gallery', 'id', id);
        loadGallery();
        loadAdminData();
    } catch (err) {
        console.error('Delete photo error:', err);
        alert('Failed to delete photo.');
    }
}

async function deleteBurger(ranking, restaurant) {
    // Double confirmation
    if (!confirm(`Are you sure you want to delete #${ranking} ${restaurant}?`)) return;
    if (!confirm(`FINAL WARNING: This will permanently delete #${ranking} ${restaurant}. Are you absolutely sure?`)) return;

    try {
        await dbDelete('results', 'ranking', ranking);

        // Reload everything
        await loadRankings();
        rebuildMap();
        loadAdminData();
        alert('Burger deleted successfully.');
    } catch (err) {
        console.error('Delete burger error:', err);
        alert('Failed to delete burger: ' + err.message);
    }
}

async function handleChangePassword() {
    const msg = document.getElementById('changePasswordMsg');
    const newPw = document.getElementById('newAdminPassword').value;
    const confirmPw = document.getElementById('confirmAdminPassword').value;

    if (!newPw || newPw.length < 4) {
        msg.textContent = 'Password must be at least 4 characters.';
        msg.className = 'form-message error';
        return;
    }

    if (newPw !== confirmPw) {
        msg.textContent = 'Passwords do not match.';
        msg.className = 'form-message error';
        return;
    }

    const hash = await hashPassword(newPw);

    if (isConfigured()) {
        try {
            await dbUpdate('form_config', { admin_hash: hash }, 'id', 1);
            msg.textContent = 'Password changed!';
            msg.className = 'form-message success';
        } catch (err) {
            msg.textContent = 'Failed to save: ' + err.message;
            msg.className = 'form-message error';
        }
    } else {
        msg.textContent = `Password hash: ${hash} — Update ADMIN_PASSWORD_HASH in config.js`;
        msg.className = 'form-message success';
    }
}

// ============================================
// SUGGESTIONS
// ============================================

function initSuggestionForm() {
    const form = document.getElementById('suggestionForm');
    if (!form) return;
    form.addEventListener('submit', handleSuggestionSubmit);
}

async function handleSuggestionSubmit(e) {
    e.preventDefault();
    const msg = document.getElementById('suggestMessage');
    const btn = document.getElementById('suggestBtn');
    const name = document.getElementById('suggestName').value.trim();
    const text = document.getElementById('suggestText').value.trim();

    if (!name || !text) {
        msg.textContent = 'Please fill in both fields.';
        msg.className = 'form-message error';
        return;
    }

    if (!isConfigured()) {
        msg.textContent = 'Database not configured.';
        msg.className = 'form-message error';
        return;
    }

    btn.disabled = true;
    msg.textContent = 'Submitting...';
    msg.className = 'form-message';

    try {
        await dbInsert('suggestions', {
            name: name,
            suggestion: text,
        });
        msg.textContent = 'Thanks for the suggestion!';
        msg.className = 'form-message success';
        document.getElementById('suggestName').value = '';
        document.getElementById('suggestText').value = '';
    } catch (err) {
        console.error('Suggestion submit error:', err);
        msg.textContent = 'Failed to submit. Please try again.';
        msg.className = 'form-message error';
    }
    btn.disabled = false;
}

async function loadSuggestions() {
    const listDiv = document.getElementById('adminSuggestionsList');
    if (!listDiv) return;

    try {
        const data = await dbSelect('suggestions', 'select=*&order=created_at.desc');

        if (!data || data.length === 0) {
            listDiv.innerHTML = '<p style="color:#999;">No suggestions yet.</p>';
            return;
        }

        listDiv.innerHTML = data.map(s => {
            const created = new Date(s.created_at).toLocaleString();
            const addressedHtml = s.addressed
                ? `<div class="suggestion-addressed">Addressed ${new Date(s.addressed_at).toLocaleString()}</div>`
                : '';
            return `
                <div class="suggestion-entry ${s.addressed ? 'addressed' : ''}">
                    <div class="suggestion-check">
                        <input type="checkbox" ${s.addressed ? 'checked' : ''}
                            onchange="toggleSuggestion(${s.id}, this.checked)"
                            title="${s.addressed ? 'Mark as unaddressed' : 'Mark as addressed'}">
                    </div>
                    <div class="suggestion-content">
                        <div class="suggestion-header">
                            <strong>${escapeHtml(s.name)}</strong>
                            <span class="suggestion-date">${created}</span>
                        </div>
                        <div class="suggestion-text">${escapeHtml(s.suggestion)}</div>
                        ${addressedHtml}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Load suggestions error:', err);
        listDiv.innerHTML = '<p style="color:#999;">Could not load suggestions.</p>';
    }
}

async function toggleSuggestion(id, addressed) {
    try {
        const update = {
            addressed: addressed,
            addressed_at: addressed ? new Date().toISOString() : null,
        };
        await dbUpdate('suggestions', update, 'id', id);
        loadSuggestions();
    } catch (err) {
        console.error('Toggle suggestion error:', err);
        alert('Failed to update suggestion.');
    }
}

// ============================================
// UTILITIES
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function abbrevState(stateName) {
    const states = {
        'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA',
        'colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA',
        'hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS',
        'kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA',
        'michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT',
        'nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM',
        'new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK',
        'oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC',
        'south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT',
        'virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY',
    };
    return states[stateName.toLowerCase()] || stateName;
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
