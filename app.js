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

const LOCATION_COORDS = {
    'rolo\'s': [40.7020, -73.9037],              // 853 Onderdonk Ave, Ridgewood
    'red hook tavern': [40.6780, -74.0120],       // 329 Van Brunt St, Red Hook
    'the lions bar & grill': [40.7275, -73.9853], // 132 1st Ave, East Village
    'virginia\'s': [40.7228, -73.9834],           // 200 E 3rd St, East Village
    'raoul\'s': [40.7263, -74.0021],              // 180 Prince St, SoHo
    'au cheval': [40.7179, -74.0021],             // 33 Cortlandt Alley, Tribeca
    'au chavel': [40.7179, -74.0021],             // 33 Cortlandt Alley, Tribeca (typo alias)
    'suprema provisions': [40.7325, -74.0037],    // 305 Bleecker St, West Village
    'peter luger': [40.7101, -73.9631],           // 178 Broadway, Williamsburg
    'cozy royale': [40.7169, -73.9430],           // 434 Humboldt St, Williamsburg
    'minetta tavern': [40.7300, -74.0006],        // 113 Macdougal St, Greenwich Village
    'hamburger america': [40.7280, -74.0023],     // 51 MacDougal St, SoHo
    'gotham burger': [40.7199, -73.9876],         // 131 Essex St, Lower East Side
    'nowon': [40.7254, -73.9837],                 // 507 E 6th St, East Village
    'smacking burger': [40.7384, -74.0040],       // 51 8th Ave, West Village
    'fairfax': [40.7343, -74.0031],               // 234 W 4th St, West Village
    'petey\'s burger': [40.7460, -73.9531],       // 46-46 Vernon Blvd, Long Island City
    'burger by day': [40.7184, -73.9944],         // 242 Grand St, Chinatown/LES
    'jg melon': [40.7711, -73.9595],              // 1291 3rd Ave, Upper East Side
    'corner bistro': [40.7381, -74.0038],         // 331 W 4th St, West Village
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

    // One pin per restaurant, popup lists all burgers from that spot
    const grouped = {};
    burgerData.forEach(row => {
        const name = (row['Restaurant'] || '').toLowerCase().trim();
        if (!name) return;
        if (!grouped[name]) grouped[name] = [];
        grouped[name].push(row);
    });

    for (const [name, entries] of Object.entries(grouped)) {
        let coords = LOCATION_COORDS[name];
        if (!coords) {
            for (const [locKey, locCoords] of Object.entries(LOCATION_COORDS)) {
                if (name.includes(locKey) || locKey.includes(name)) {
                    coords = locCoords;
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
                    <div class="popup-detail">${escapeHtml(entries[0]['Location'])}</div>
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
        document.getElementById('showSupabaseUrl').value = CONFIG.SUPABASE_URL;
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
        const ratings = await dbSelect('ratings', 'select=*&order=created_at.desc&limit=50');
        const ratingsDiv = document.getElementById('submittedRatings');
        if (ratings && ratings.length > 0) {
            ratingsDiv.innerHTML = ratings.map(r => `
                <div class="rating-entry">
                    <strong>${escapeHtml(r.name)}</strong> rated <strong>${escapeHtml(r.burger)}</strong><br>
                    Toppings: ${r.toppings} | Bun: ${r.bun} | Doneness: ${r.doneness} | Flavor: ${r.flavor}<br>
                    <small style="color:#999;">${new Date(r.created_at).toLocaleString()}</small>
                </div>
            `).join('');
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
}

function populateBurgerSelect() {
    const select = document.getElementById('activateBurgerSelect');
    const unique = [...new Set(burgerData.map(r => r['Restaurant']))].filter(Boolean);
    unique.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
}

// ============================================
// ADDRESS SEARCH (Nominatim / OpenStreetMap)
// ============================================

let selectedAddressData = null;

function initAddressSearch() {
    const searchBtn = document.getElementById('searchAddressBtn');
    const addressInput = document.getElementById('newAddress');

    searchBtn.addEventListener('click', () => searchAddress());
    addressInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); searchAddress(); }
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
            const mainLine = [addr.house_number, addr.road].filter(Boolean).join(' ') ||
                             item.display_name.split(',')[0];
            const detailLine = [addr.city || addr.town || addr.village, addr.state, addr.postcode]
                .filter(Boolean).join(', ');

            return `
                <div class="address-result-item" data-index="${i}"
                     data-lat="${item.lat}" data-lon="${item.lon}"
                     data-display="${escapeHtml(item.display_name)}"
                     data-short="${escapeHtml(detailLine || item.display_name)}">
                    <div class="addr-main">${escapeHtml(mainLine)}</div>
                    <div class="addr-detail">${escapeHtml(detailLine || item.display_name)}</div>
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
    const display = item.dataset.display;
    const short = item.dataset.short;

    selectedAddressData = { lat, lon, display, short };

    document.getElementById('newLat').value = lat;
    document.getElementById('newLng').value = lon;
    document.getElementById('newLocation').value = short;

    const selectedDiv = document.getElementById('selectedAddress');
    selectedDiv.innerHTML = `
        &#x2705; <strong>${escapeHtml(display)}</strong>
        <span class="clear-address" title="Clear selection">&times;</span>
    `;
    selectedDiv.style.display = 'flex';

    selectedDiv.querySelector('.clear-address').addEventListener('click', () => {
        clearAddressSelection();
    });

    document.getElementById('addressResults').classList.remove('show');
    document.getElementById('newAddress').value = display.split(',')[0];
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

    const burger = {
        restaurant: document.getElementById('newRestaurant').value,
        description: document.getElementById('newDescription').value,
        price: document.getElementById('newPrice').value,
        location: document.getElementById('newLocation').value,
        date_of_visit: document.getElementById('newDate').value,
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

        // Add coords to local map so it shows up immediately
        const key = burger.restaurant.toLowerCase().trim();
        LOCATION_COORDS[key] = [burger.lat, burger.lng];

        msg.textContent = 'Burger added to the rankings!';
        msg.className = 'form-message success';

        const select = document.getElementById('activateBurgerSelect');
        const opt = document.createElement('option');
        opt.value = burger.restaurant;
        opt.textContent = burger.restaurant;
        select.appendChild(opt);

        // Reset form
        document.getElementById('newRestaurant').value = '';
        document.getElementById('newDescription').value = '';
        document.getElementById('newPrice').value = '';
        document.getElementById('newDate').value = '';
        clearAddressSelection();
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

    const burgerName = document.getElementById('activateBurgerSelect').value;
    if (open && !burgerName) {
        msg.textContent = 'Select a burger to activate the form for.';
        msg.className = 'form-message error';
        return;
    }

    try {
        const update = { is_open: open };
        if (open) update.active_burger = burgerName;

        await dbUpdate('form_config', update, 'id', 1);

        msg.textContent = open ? `Form opened for "${burgerName}"!` : 'Form closed.';
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
    const restaurant = document.getElementById('galleryRestaurant').value;
    const caption = document.getElementById('galleryCaption').value;

    if (!isConfigured()) {
        msg.textContent = 'Supabase not configured.';
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
                restaurant: restaurant,
                caption: caption,
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
// UTILITIES
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
