// ============================================
// BURGER OF THE MONTH CLUB - APPLICATION
// Uses Supabase REST API directly (no SDK needed)
// ============================================

let burgerData = [];
let galleryPhotos = [];
let lightboxIndex = 0;
let map;
let adminLoggedIn = false;
let attendeesData = {}; // Maps ranking -> array of names
let membersData = []; // Array of member name strings from 'members' table

// ============================================
// SUPABASE REST HELPERS
// ============================================

const API_BASE = CONFIG.SUPABASE_URL + '/rest/v1';
const STORAGE_BASE = CONFIG.SUPABASE_URL + '/storage/v1';
const API_HEADERS = {
    'apikey': CONFIG.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
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
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${STORAGE_BASE}/object/${bucket}/${path}`, {
        method: 'POST',
        headers: {
            'apikey': CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: file,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);

    // Return the public URL
    return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
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

    // Ensure rankings have no gaps (fixes deletions that happened before auto-recalc)
    recalculateRankings().then(() => loadRankings()).catch(e => console.error('Recalc failed:', e));

    initMap();

    // Load members list
    await loadMembers().catch(e => console.error('Members load failed:', e));

    // Load secondary features in background
    loadGallery().catch(e => console.error('Gallery load failed:', e));
    checkFormStatus().catch(e => console.error('Form status check failed:', e));
    initSuggestionForm();
    loadMainAttendanceTracker().catch(e => console.error('Main tracker load failed:', e));
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
            'lat': row.lat || null,
            'lng': row.lng || null,
        }));

        // Load attendees data
        await loadAttendeesData();

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
    const headers = ['Ranking', 'Burger Rating', 'Restaurant', 'Description', 'Price', 'Location', 'Date of Visit', 'Attendees'];

    table.innerHTML = `
        <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
            ${data.map(row => {
                const ranking = row['Ranking'];
                const attendees = attendeesData[ranking] || [];
                const count = attendees.length;

                return `<tr>
                    <td class="rank-cell">${escapeHtml(row['Ranking'])}</td>
                    <td class="rating-cell">${escapeHtml(row['Burger Rating'])}</td>
                    <td><strong>${escapeHtml(row['Restaurant'])}</strong></td>
                    <td>${escapeHtml(row['Description'])}</td>
                    <td>${escapeHtml(row['Price'])}</td>
                    <td>${escapeHtml(row['Location'])}</td>
                    <td>${escapeHtml(row['Date of Visit'])}</td>
                    <td class="attendees-cell" onclick="showAttendees(${ranking})" style="cursor:pointer;color:var(--red);font-weight:500;">
                        ${count > 0 ? count : '—'}
                    </td>
                </tr>`;
            }).join('')}
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
// ATTENDEES TRACKING
// ============================================

async function loadAttendeesData() {
    if (!isConfigured()) return;

    try {
        // Historical submission counts from original Google Sheet
        // Maps ranking -> number of original form submissions
        const historicalCounts = {
            1: 6,  // Rolo's
            2: 7,  // Red Hook Tavern
            3: 6,  // The Lions Bar & Grill
            4: 7,  // Virginia's
            5: 8,  // Raoul's
            6: 7,  // Au Cheval
            7: 7,  // Suprema Provisions
            8: 7,  // Peter Luger
            9: 6,  // Cozy Royale (regular)
            10: 7, // Minetta Tavern BLACK LABEL
            11: 6, // Cozy Royale Dry-Aged
            12: 5, // Hamburger America CLASSIC SMASH
            13: 7, // Minetta Tavern MINETTA
            14: 10, // Gotham Burger
            15: 5, // Hamburger America FRIED ONION
            16: 4, // Nowon LEGENDARY
            17: 7, // Smacking Burger
            18: 4, // Fairfax
            19: 4, // Nowon DRY AGED
            20: 8, // Petey's Burger
            21: 7, // Burger by Day
            22: 9, // JG Melon
            23: 5, // Corner Bistro
        };

        // Load attendees table
        const attendees = await dbSelect('attendees', 'select=*');

        // Load ratings to get names from form submissions
        const ratings = await dbSelect('ratings', 'select=*');

        // Clear existing data
        attendeesData = {};

        // Initialize all burgers with empty arrays
        burgerData.forEach(row => {
            attendeesData[row['Ranking']] = [];
        });

        // Build map: burger label -> ranking
        const burgerToRanking = {};
        burgerData.forEach(row => {
            const label = `${row['Restaurant']} — ${row['Description']}`;
            burgerToRanking[label] = row['Ranking'];
        });

        // Populate from attendees table first
        attendees.forEach(att => {
            const ranking = att.burger_id;
            if (!attendeesData[ranking]) attendeesData[ranking] = [];
            if (!attendeesData[ranking].includes(att.name)) {
                attendeesData[ranking].push(att.name);
            }
        });

        // Add names from ratings (auto-populate for ALL ratings regardless of label match)
        // This ensures historical entries get their attendees populated
        ratings.forEach(r => {
            const burgerLabel = r.burger;
            const ranking = burgerToRanking[burgerLabel];

            if (!ranking) {
                // Skip unknown burgers (like deleted test burgers)
                return;
            }

            if (!attendeesData[ranking]) attendeesData[ranking] = [];

            // Only add if not already in attendees list
            if (r.name && !attendeesData[ranking].includes(r.name)) {
                attendeesData[ranking].push(r.name);
            }
        });

        // For historical burgers: Add "Unknown" placeholders based on original submission counts
        // Save these to the database so they can be edited later
        for (const row of burgerData) {
            const ranking = parseInt(row['Ranking']);
            const burgerRating = row['Burger Rating'];
            const currentCount = attendeesData[ranking]?.length || 0;
            const historicalCount = historicalCounts[ranking] || 0;

            // Skip if no historical data for this burger
            if (historicalCount === 0) continue;

            // If burger has a rating score, add Unknown placeholders
            if (burgerRating && burgerRating !== '') {
                // Calculate how many Unknowns we need
                // If user already added names (e.g., "Angelo"), create (historicalCount - currentCount) Unknowns
                const unknownsNeeded = Math.max(0, historicalCount - currentCount);

                if (unknownsNeeded > 0) {
                    // Check if Unknown placeholders already exist in DB for this burger
                    const existingUnknowns = attendees.filter(a =>
                        a.burger_id == ranking && a.name.startsWith('Unknown ')
                    );

                    // Only create new Unknowns if we don't have enough
                    const existingUnknownCount = existingUnknowns.length;
                    const toCreate = unknownsNeeded - existingUnknownCount;

                    if (toCreate > 0) {
                        // Create Unknown placeholders in database
                        for (let i = 1; i <= toCreate; i++) {
                            const unknownName = `Unknown ${i}`;
                            try {
                                await dbInsert('attendees', {
                                    burger_id: ranking,
                                    name: unknownName,
                                    rating_id: null,
                                });
                                attendeesData[ranking].push(unknownName);
                            } catch (insertErr) {
                                console.error(`Failed to create ${unknownName} for burger ${ranking}:`, insertErr);
                            }
                        }
                    } else {
                        // Add existing unknowns to attendeesData
                        existingUnknowns.forEach(u => {
                            if (!attendeesData[ranking].includes(u.name)) {
                                attendeesData[ranking].push(u.name);
                            }
                        });
                    }
                }
            }
        }

    } catch (err) {
        console.error('Load attendees error:', err);
    }
}

// ============================================
// MEMBERS
// ============================================

async function loadMembers() {
    if (!isConfigured()) return;
    try {
        const data = await dbSelect('members', 'select=name&order=name.asc');
        membersData = data.map(m => m.name);
    } catch (err) {
        console.error('Load members error:', err);
        membersData = [];
    }
}

function populateRaterNameSelect() {
    const select = document.getElementById('raterNameSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Select your name --</option>' +
        membersData.map(name =>
            `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
        ).join('') +
        '<option value="__new__">+ New Member</option>';
}

function populatePhotographerSelect() {
    const select = document.getElementById('galleryPhotographer');
    if (!select) return;

    select.innerHTML = '<option value="">-- Select photographer --</option>' +
        membersData.map(name =>
            `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
        ).join('') +
        '<option value="__new__">+ Other</option>';
}

// ============================================
// ADMIN MEMBER MANAGEMENT
// ============================================

async function loadMembersManager() {
    const container = document.getElementById('adminMembersList');
    if (!container) return;

    await loadMembers();

    if (membersData.length === 0) {
        container.innerHTML = '<p style="color:#999;">No members yet. Add some below or run the SQL migration.</p>';
        return;
    }

    container.innerHTML = membersData.map(name => `
        <div class="attendee-tag">
            <span onclick="editMemberAdmin('${escapeHtml(name).replace(/'/g, "\\'")}')" style="cursor:pointer;" title="Click to edit name">${escapeHtml(name)} ✏️</span>
            <button class="tag-remove" onclick="removeMemberAdmin('${escapeHtml(name).replace(/'/g, "\\'")}')" title="Remove member">×</button>
        </div>
    `).join('');
}

async function addMemberAdmin() {
    const input = document.getElementById('newMemberName');
    const name = input.value.trim();

    if (!name) {
        alert('Please enter a member name.');
        return;
    }

    try {
        await dbInsert('members', { name: name });
        input.value = '';
        await loadMembers();
        loadMembersManager();
        populateRaterNameSelect();
        populatePhotographerSelect();
    } catch (err) {
        if (err.message.includes('duplicate') || err.message.includes('unique') || err.message.includes('23505')) {
            alert(`"${name}" is already a member.`);
        } else {
            console.error('Add member error:', err);
            alert('Failed to add member: ' + err.message);
        }
    }
}

async function removeMemberAdmin(name) {
    if (!confirm(`Remove "${name}" from the members list? This won't affect existing attendance records.`)) return;

    try {
        // Find and delete the member
        const members = await dbSelect('members', `select=*&name=eq.${encodeURIComponent(name)}`);
        if (members && members.length > 0) {
            await dbDelete('members', 'id', members[0].id);
        }

        await loadMembers();
        loadMembersManager();
        populateRaterNameSelect();
        populatePhotographerSelect();
    } catch (err) {
        console.error('Remove member error:', err);
        alert('Failed to remove member: ' + err.message);
    }
}

async function editMemberAdmin(oldName) {
    const newName = prompt(`Rename "${oldName}" to:`, oldName);
    if (!newName || newName.trim() === '' || newName.trim() === oldName) return;

    try {
        const members = await dbSelect('members', `select=*&name=eq.${encodeURIComponent(oldName)}`);
        if (members && members.length > 0) {
            await dbUpdate('members', { name: newName.trim() }, 'id', members[0].id);
        }

        await loadMembers();
        loadMembersManager();
        populateRaterNameSelect();
        populatePhotographerSelect();
    } catch (err) {
        if (err.message.includes('duplicate') || err.message.includes('unique') || err.message.includes('23505')) {
            alert(`"${newName.trim()}" already exists as a member.`);
        } else {
            console.error('Edit member error:', err);
            alert('Failed to edit member: ' + err.message);
        }
    }
}

function showAttendees(ranking) {
    const attendees = attendeesData[ranking] || [];
    const burger = burgerData.find(b => b['Ranking'] == ranking);

    const modal = document.getElementById('attendeesModal');
    const title = document.getElementById('attendeesModalTitle');
    const list = document.getElementById('attendeesModalList');

    if (!burger) return;

    title.textContent = `Attendees: ${burger['Restaurant']}`;

    if (attendees.length === 0) {
        list.innerHTML = '<p style="color:#999;text-align:center;">No attendees recorded yet.</p>';
    } else {
        // Sort attendees alphabetically (Unknown names at the end)
        const sorted = [...attendees].sort((a, b) => {
            const aIsUnknown = a.startsWith('Unknown ');
            const bIsUnknown = b.startsWith('Unknown ');

            if (aIsUnknown && !bIsUnknown) return 1;  // Unknown goes after real names
            if (!aIsUnknown && bIsUnknown) return -1; // Real names go before Unknown
            return a.localeCompare(b); // Alphabetical within each group
        });

        list.innerHTML = sorted.map(name => `
            <div class="attendee-item">${escapeHtml(name)}</div>
        `).join('');
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeAttendeesModal() {
    document.getElementById('attendeesModal').style.display = 'none';
    document.body.style.overflow = '';
}

// Initialize attendees modal close handler
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('attendeesModalClose')?.addEventListener('click', closeAttendeesModal);
    document.getElementById('attendeesModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeAttendeesModal();
    });
});

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

    addMarkersToMap();

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
    addMarkersToMap();
}

function addMarkersToMap() {
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

    // Group by location address for shared pins
    const grouped = {};
    burgerData.forEach(row => {
        const addr = (row['Location'] || '').toLowerCase().trim();
        if (!addr) return;
        if (!grouped[addr]) grouped[addr] = { entries: [], lat: null, lng: null };
        grouped[addr].entries.push(row);
        // Use lat/lng from database if available (prefer first one found)
        if (!grouped[addr].lat && row.lat && row.lng) {
            grouped[addr].lat = parseFloat(row.lat);
            grouped[addr].lng = parseFloat(row.lng);
        }
    });

    for (const [addr, group] of Object.entries(grouped)) {
        let coords = null;

        // Priority 1: lat/lng from database
        if (group.lat && group.lng) {
            coords = [group.lat, group.lng];
        }

        // Priority 2: hardcoded ADDRESS_COORDS (for old entries without lat/lng)
        if (!coords) {
            coords = ADDRESS_COORDS[addr];
        }

        // Priority 3: fuzzy match on ADDRESS_COORDS
        if (!coords) {
            for (const [addrKey, addrCoords] of Object.entries(ADDRESS_COORDS)) {
                if (addr.includes(addrKey) || addrKey.includes(addr)) {
                    coords = addrCoords;
                    break;
                }
            }
        }

        if (coords) {
            const entries = group.entries;
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
                ${photo.uploaded_by ? `<span class="photo-credit">Photo by ${escapeHtml(photo.uploaded_by)}</span>` : escapeHtml(photo.caption)}
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
    let caption = `${photo.restaurant || ''} ${photo.caption ? '— ' + photo.caption : ''}`.trim();
    if (photo.uploaded_by) {
        caption += ` · Photo by ${photo.uploaded_by}`;
    }
    document.getElementById('lightboxCaption').textContent = caption;
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

            // Populate rater name dropdown with members
            populateRaterNameSelect();

            // Wire up show/hide for new member input
            const raterSelect = document.getElementById('raterNameSelect');
            const newMemberGroup = document.getElementById('newMemberGroup');
            const raterNewInput = document.getElementById('raterNameNew');
            if (raterSelect && !raterSelect._listenerAdded) {
                raterSelect.addEventListener('change', () => {
                    if (raterSelect.value === '__new__') {
                        newMemberGroup.style.display = 'block';
                        raterNewInput.required = true;
                        raterNewInput.focus();
                    } else {
                        newMemberGroup.style.display = 'none';
                        raterNewInput.required = false;
                        raterNewInput.value = '';
                    }
                });
                raterSelect._listenerAdded = true;
            }
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
        const configData = await dbSelect('form_config', 'select=active_burger,is_open,active_burger_ranking&id=eq.1');
        const config = configData[0];

        if (!config || !config.is_open) {
            msg.textContent = 'Form has been closed. Your rating was not submitted.';
            msg.className = 'form-message error';
            submitBtn.disabled = false;
            return;
        }

        // Get name from dropdown or new member input
        const raterSelect = document.getElementById('raterNameSelect');
        const raterNewInput = document.getElementById('raterNameNew');
        let raterName = '';

        if (raterSelect.value === '__new__') {
            raterName = raterNewInput.value.trim();
            if (!raterName) {
                msg.textContent = 'Please enter your name.';
                msg.className = 'form-message error';
                submitBtn.disabled = false;
                return;
            }
        } else if (raterSelect.value) {
            raterName = raterSelect.value;
        } else {
            msg.textContent = 'Please select your name.';
            msg.className = 'form-message error';
            submitBtn.disabled = false;
            return;
        }

        const rating = {
            burger: config.active_burger,
            name: raterName,
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

                // Also add to gallery with photo attribution
                await dbInsert('gallery', {
                    url: publicUrl,
                    restaurant: config.active_burger,
                    caption: `Rated by ${rating.name}`,
                    uploaded_by: rating.name,
                });
            } catch (uploadErr) {
                console.error('Photo upload failed, submitting without photo:', uploadErr);
            }
        }

        await dbInsert('ratings', rating);

        // Add attendee automatically
        // CRITICAL FIX: Use the ranking ID directly from form_config instead of label matching
        // This prevents attendees being routed to wrong burgers when labels don't match
        const ranking = config.active_burger_ranking;
        if (ranking) {
            try {
                await dbInsert('attendees', {
                    burger_id: parseInt(ranking),
                    name: rating.name,
                    rating_id: null,
                });
            } catch (attendeeErr) {
                console.error('Failed to add attendee:', attendeeErr);
            }
        } else {
            // Fallback: If active_burger_ranking is not set (old data), try label matching
            console.warn('active_burger_ranking not found, using fallback label matching');
            const burgerToRanking = {};
            burgerData.forEach(row => {
                const label = `${row['Restaurant']} — ${row['Description']}`;
                burgerToRanking[label] = row['Ranking'];
            });
            const fallbackRanking = burgerToRanking[config.active_burger];
            if (fallbackRanking) {
                try {
                    await dbInsert('attendees', {
                        burger_id: parseInt(fallbackRanking),
                        name: rating.name,
                        rating_id: null,
                    });
                } catch (attendeeErr) {
                    console.error('Failed to add attendee (fallback):', attendeeErr);
                }
            }
        }

        // If new member was added, insert into members table and refresh dropdown
        if (raterSelect.value === '__new__' && raterName) {
            try {
                await dbInsert('members', { name: raterName });
                await loadMembers();
                populateRaterNameSelect();
            } catch (memberErr) {
                // Ignore duplicate error — member may already exist
                console.warn('Member insert (may already exist):', memberErr);
            }
        }

        msg.textContent = 'Rating submitted! Thanks for your vote.';
        msg.className = 'form-message success';
        e.target.reset();
        // Reset new member group visibility
        document.getElementById('newMemberGroup').style.display = 'none';
        document.getElementById('raterNameNew').required = false;

        // Reload gallery if photo was uploaded
        if (photoFile) {
            await loadGallery();
        }

        // Recalculate and update burger rating in results table
        await updateBurgerRating(config.active_burger);
    } catch (err) {
        console.error('Submit error:', err);
        msg.textContent = 'Failed to submit. Please try again.';
        msg.className = 'form-message error';
    }
    submitBtn.disabled = false;
}

// ============================================
// UPDATE BURGER RATING
// ============================================

async function updateBurgerRating(burgerLabel) {
    try {
        // Get all ratings for this burger
        const ratings = await dbSelect('ratings', `select=*&burger=eq.${encodeURIComponent(burgerLabel)}`);

        if (!ratings || ratings.length === 0) return;

        // Calculate average of each category across all raters
        const avgToppings = ratings.reduce((sum, r) => sum + (r.toppings || 0), 0) / ratings.length;
        const avgBun = ratings.reduce((sum, r) => sum + (r.bun || 0), 0) / ratings.length;
        const avgDoneness = ratings.reduce((sum, r) => sum + (r.doneness || 0), 0) / ratings.length;
        const avgFlavor = ratings.reduce((sum, r) => sum + (r.flavor || 0), 0) / ratings.length;

        // Weighted scoring: Flavor 40%, Toppings 20%, Bun 20%, Doneness 20%
        const overallAvg = (
            avgToppings * 0.20 +
            avgBun * 0.20 +
            avgDoneness * 0.20 +
            avgFlavor * 0.40
        ).toFixed(2);

        // Parse the burger label to get restaurant and description
        const parts = burgerLabel.split(' \u2014 ');
        const restaurant = parts[0];
        const description = parts.length > 1 ? parts[1] : '';

        // Find and update the corresponding entry in results table
        const results = await dbSelect('results',
            `select=*&restaurant=eq.${encodeURIComponent(restaurant)}&description=eq.${encodeURIComponent(description)}`);

        if (results && results.length > 0) {
            const result = results[0];
            await dbUpdate('results', { burger_rating: parseFloat(overallAvg) }, 'ranking', result.ranking);
        }

        // Recalculate ALL rankings based on burger_rating (highest = #1)
        await recalculateRankings();

        // Reload the rankings table and map to show updated rating
        await loadRankings();
        rebuildMap();
    } catch (err) {
        console.error('Update burger rating error:', err);
    }
}

async function recalculateRankings() {
    try {
        // Get all results
        const all = await dbSelect('results', 'select=*');
        if (!all || all.length === 0) return;

        // Separate rated and unrated
        const rated = all.filter(r => r.burger_rating !== null && r.burger_rating !== undefined);
        const unrated = all.filter(r => r.burger_rating === null || r.burger_rating === undefined);

        // Sort rated by rating descending (highest rating = rank #1)
        rated.sort((a, b) => parseFloat(b.burger_rating) - parseFloat(a.burger_rating));

        // Assign rankings: rated first, then unrated at the end
        let rank = 1;
        for (const entry of rated) {
            if (entry.ranking !== rank) {
                await dbUpdate('results', { ranking: rank }, 'id', entry.id);
            }
            rank++;
        }
        for (const entry of unrated) {
            if (entry.ranking !== rank) {
                await dbUpdate('results', { ranking: rank }, 'id', entry.id);
            }
            rank++;
        }
    } catch (err) {
        console.error('Recalculate rankings error:', err);
    }
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
    document.getElementById('addMemberAdminBtn')?.addEventListener('click', addMemberAdmin);
    document.getElementById('newMemberName')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addMemberAdmin(); }
    });

    // Photographer dropdown show/hide for "Other"
    const photoSelect = document.getElementById('galleryPhotographer');
    const newPhotoGroup = document.getElementById('newPhotographerGroup');
    if (photoSelect && newPhotoGroup) {
        photoSelect.addEventListener('change', () => {
            if (photoSelect.value === '__new__') {
                newPhotoGroup.style.display = 'block';
                document.getElementById('galleryPhotographerNew')?.focus();
            } else {
                newPhotoGroup.style.display = 'none';
            }
        });
    }

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
                ${config.is_open && config.active_burger ? `<p>Active burger: <strong>${escapeHtml(config.active_burger)}</strong></p>` : ''}
            `;
        }
    } catch (e) {
        console.error('Load admin data error:', e);
    }

    try {
        const ratings = await dbSelect('ratings', 'select=*&order=created_at.desc&limit=100');
        const ratingsDiv = document.getElementById('submittedRatings');
        if (ratings && ratings.length > 0) {
            // Filter ratings to only include burgers that still exist in burgerData
            const existingBurgers = new Set(burgerData.map(b => {
                const restaurant = b['Restaurant'] || '';
                const desc = b['Description'] || '';
                return `${restaurant} — ${desc}`;
            }));

            const filteredRatings = ratings.filter(r => {
                // Check if this burger still exists
                const burgerLabel = r.burger || '';
                return existingBurgers.has(burgerLabel);
            });

            if (filteredRatings.length === 0) {
                ratingsDiv.innerHTML = '<p style="color:#999;">No ratings for current burgers.</p>';
            } else {

            // Group by burger for summary
            const byBurger = {};
            filteredRatings.forEach(r => {
                const key = r.burger || 'Unknown';
                if (!byBurger[key]) byBurger[key] = [];
                byBurger[key].push(r);
            });

            // Build interactive ratings table with search, sort, collapse
            let html = `
                <div class="ratings-controls">
                    <input type="text" id="ratingsSearch" placeholder="Search by name or burger..." class="search-input">
                    <select id="ratingsSort" class="sort-select">
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="avg-desc">Highest Avg</option>
                        <option value="avg-asc">Lowest Avg</option>
                        <option value="burger-az">Burger A-Z</option>
                        <option value="name-az">Name A-Z</option>
                    </select>
                </div>
                <div id="ratingsResults">
            `;

            for (const [burger, entries] of Object.entries(byBurger)) {
                const avgT = (entries.reduce((s, r) => s + (r.toppings || 0), 0) / entries.length).toFixed(1);
                const avgB = (entries.reduce((s, r) => s + (r.bun || 0), 0) / entries.length).toFixed(1);
                const avgD = (entries.reduce((s, r) => s + (r.doneness || 0), 0) / entries.length).toFixed(1);
                const avgF = (entries.reduce((s, r) => s + (r.flavor || 0), 0) / entries.length).toFixed(1);
                const avgAll = ((parseFloat(avgT) + parseFloat(avgB) + parseFloat(avgD) + parseFloat(avgF)) / 4).toFixed(2);

                const burgerId = burger.replace(/[^a-zA-Z0-9]/g, '_');
                html += `
                    <div class="ratings-burger-group" data-burger="${escapeHtml(burger)}" data-avg="${avgAll}">
                        <div class="collapsible-header ratings-burger-header-collapsible" onclick="toggleRatingsGroup('${burgerId}')">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <span class="collapse-arrow" id="arrow_${burgerId}">&#9654;</span>
                                <strong>${escapeHtml(burger)}</strong>
                                <span class="ratings-avg">Avg: ${avgAll} (${entries.length} vote${entries.length > 1 ? 's' : ''})</span>
                            </div>
                        </div>
                        <div id="group_${burgerId}" class="collapsible-body" style="display:none;">
                            <div class="ratings-summary">Toppings: ${avgT} | Bun: ${avgB} | Doneness: ${avgD} | Flavor: ${avgF}</div>
                            <table class="ratings-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Toppings</th>
                                        <th>Bun</th>
                                        <th>Doneness</th>
                                        <th>Flavor</th>
                                        <th>Avg</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${entries.map(r => {
                                        const rowAvg = ((r.toppings + r.bun + r.doneness + r.flavor) / 4).toFixed(1);
                                        return `<tr data-name="${escapeHtml(r.name)}" data-date="${r.created_at}" data-avg="${rowAvg}">
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
                    </div>
                `;
            }
            html += '</div>';
            ratingsDiv.innerHTML = html;

            // Add event listeners for search and sort
            document.getElementById('ratingsSearch').addEventListener('input', filterRatings);
            document.getElementById('ratingsSort').addEventListener('change', sortRatings);
            } // end else (filteredRatings.length > 0)
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

    // Load suggestions and requests
    loadSuggestions();
    loadRequests();

    // Load attendees manager and members
    loadAttendeesManager();
    loadMembersManager();
    loadAttendanceTracker();

    // Populate photographer dropdown in gallery tab
    populatePhotographerSelect();
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
            lat: burger.lat,
            lng: burger.lng,
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

        // Reload everything so new burger appears in table, map, dropdowns, gallery
        await loadRankings();
        rebuildMap();
        await loadGallery();
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
        if (open) {
            update.active_burger = burgerLabel;

            // CRITICAL FIX: Store the ranking ID to prevent attendee routing bugs
            // Find the exact burger in burgerData using the full description (not truncated)
            const selectedBurger = burgerData.find(b =>
                b['Restaurant'] === burgerRestaurant && b['Description'] === burgerDesc
            );
            if (selectedBurger) {
                update.active_burger_ranking = parseInt(selectedBurger['Ranking']);
            }
        } else {
            update.active_burger = null;
            update.active_burger_ranking = null;
        }

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

    // Parse "Restaurant ||| Description"
    const [restaurant, burgerDesc] = burgerValue ? burgerValue.split(' ||| ') : ['', ''];

    // Get photographer name
    const photoSelect = document.getElementById('galleryPhotographer');
    const photoNewInput = document.getElementById('galleryPhotographerNew');
    let photographer = '';
    if (photoSelect) {
        if (photoSelect.value === '__new__') {
            photographer = photoNewInput ? photoNewInput.value.trim() : '';
        } else {
            photographer = photoSelect.value;
        }
    }

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
                caption: burgerDesc ? burgerDesc.substring(0, 80) : '',
                uploaded_by: photographer || null,
            });
        }

        msg.textContent = `${files.length} photo(s) uploaded!`;
        msg.className = 'form-message success';
        document.getElementById('galleryPhoto').value = '';
        if (photoSelect) photoSelect.value = '';
        if (photoNewInput) photoNewInput.value = '';
        document.getElementById('newPhotographerGroup').style.display = 'none';
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

        // Recalculate rankings so there are no gaps (1, 2, 3... not 2, 3, 5...)
        await recalculateRankings();

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
    if (form) form.addEventListener('submit', handleSuggestionSubmit);

    const requestForm = document.getElementById('requestForm');
    if (requestForm) requestForm.addEventListener('submit', handleRequestSubmit);
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
                    <button class="btn-delete-suggestion" onclick="deleteSuggestion(${s.id}, '${escapeHtml(s.name)}')" title="Delete this suggestion">&times;</button>
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

async function deleteSuggestion(id, name) {
    if (!confirm(`Are you sure you want to delete the suggestion from "${name}"?`)) return;
    if (!confirm(`FINAL WARNING: This will permanently delete this suggestion. Continue?`)) return;

    try {
        await dbDelete('suggestions', 'id', id);
        loadSuggestions();
    } catch (err) {
        console.error('Delete suggestion error:', err);
        alert('Failed to delete suggestion: ' + err.message);
    }
}

// ============================================
// RESTAURANT REQUESTS
// ============================================

async function handleRequestSubmit(e) {
    e.preventDefault();
    const msg = document.getElementById('requestMessage');
    const btn = document.getElementById('requestBtn');
    const name = document.getElementById('requestName').value.trim();
    const text = document.getElementById('requestText').value.trim();

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
        await dbInsert('restaurant_requests', {
            name: name,
            request: text,
        });
        msg.textContent = 'Thanks for the request!';
        msg.className = 'form-message success';
        document.getElementById('requestName').value = '';
        document.getElementById('requestText').value = '';
    } catch (err) {
        console.error('Request submit error:', err);
        msg.textContent = 'Failed to submit. Please try again.';
        msg.className = 'form-message error';
    }
    btn.disabled = false;
}

async function loadRequests() {
    const listDiv = document.getElementById('adminRequestsList');
    if (!listDiv) return;

    try {
        const data = await dbSelect('restaurant_requests', 'select=*&order=created_at.desc');

        if (!data || data.length === 0) {
            listDiv.innerHTML = '<p style="color:#999;">No restaurant requests yet.</p>';
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
                            onchange="toggleRequest(${s.id}, this.checked)"
                            title="${s.addressed ? 'Mark as unaddressed' : 'Mark as addressed'}">
                    </div>
                    <div class="suggestion-content">
                        <div class="suggestion-header">
                            <strong>${escapeHtml(s.name)}</strong>
                            <span class="suggestion-date">${created}</span>
                        </div>
                        <div class="suggestion-text">${escapeHtml(s.request)}</div>
                        ${addressedHtml}
                    </div>
                    <button class="btn-delete-suggestion" onclick="deleteRequest(${s.id}, '${escapeHtml(s.name)}')" title="Delete this request">&times;</button>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Load requests error:', err);
        listDiv.innerHTML = '<p style="color:#999;">Could not load requests.</p>';
    }
}

async function toggleRequest(id, addressed) {
    try {
        const update = {
            addressed: addressed,
            addressed_at: addressed ? new Date().toISOString() : null,
        };
        await dbUpdate('restaurant_requests', update, 'id', id);
        loadRequests();
    } catch (err) {
        console.error('Toggle request error:', err);
        alert('Failed to update request.');
    }
}

async function deleteRequest(id, name) {
    if (!confirm(`Are you sure you want to delete the request from "${name}"?`)) return;
    if (!confirm(`FINAL WARNING: This will permanently delete this request. Continue?`)) return;

    try {
        await dbDelete('restaurant_requests', 'id', id);
        loadRequests();
    } catch (err) {
        console.error('Delete request error:', err);
        alert('Failed to delete request: ' + err.message);
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

// ============================================
// RATINGS CONTROLS (Search, Sort, Collapse)
// ============================================

function toggleRatingsGroup(groupId) {
    const group = document.getElementById('group_' + groupId);
    const arrow = document.getElementById('arrow_' + groupId);
    const isOpen = group.style.display !== 'none';
    group.style.display = isOpen ? 'none' : 'block';
    arrow.innerHTML = isOpen ? '&#9654;' : '&#9660;';
}

function filterRatings() {
    const query = document.getElementById('ratingsSearch').value.toLowerCase();
    const groups = document.querySelectorAll('.ratings-burger-group');

    groups.forEach(group => {
        const burger = (group.dataset.burger || '').toLowerCase();
        const rows = group.querySelectorAll('tbody tr');
        let hasMatch = false;

        rows.forEach(row => {
            const name = (row.dataset.name || '').toLowerCase();
            const matches = burger.includes(query) || name.includes(query);
            row.style.display = matches ? '' : 'none';
            if (matches) hasMatch = true;
        });

        group.style.display = hasMatch ? '' : 'none';
    });
}

function sortRatings() {
    const sortBy = document.getElementById('ratingsSort').value;
    const container = document.getElementById('ratingsResults');
    const groups = Array.from(container.querySelectorAll('.ratings-burger-group'));

    groups.sort((a, b) => {
        switch (sortBy) {
            case 'avg-desc':
                return parseFloat(b.dataset.avg || 0) - parseFloat(a.dataset.avg || 0);
            case 'avg-asc':
                return parseFloat(a.dataset.avg || 0) - parseFloat(b.dataset.avg || 0);
            case 'burger-az':
                return (a.dataset.burger || '').localeCompare(b.dataset.burger || '');
            case 'date-desc':
            case 'date-asc':
            case 'name-az':
                // For these, we need to sort within each group
                return 0;
            default:
                return 0;
        }
    });

    // Re-append in sorted order
    groups.forEach(group => container.appendChild(group));

    // If sorting by date or name, sort rows within each group
    if (sortBy === 'date-desc' || sortBy === 'date-asc' || sortBy === 'name-az') {
        groups.forEach(group => {
            const tbody = group.querySelector('tbody');
            if (!tbody) return;
            const rows = Array.from(tbody.querySelectorAll('tr'));

            rows.sort((a, b) => {
                if (sortBy === 'date-desc') {
                    return new Date(b.dataset.date || 0) - new Date(a.dataset.date || 0);
                } else if (sortBy === 'date-asc') {
                    return new Date(a.dataset.date || 0) - new Date(b.dataset.date || 0);
                } else if (sortBy === 'name-az') {
                    return (a.dataset.name || '').localeCompare(b.dataset.name || '');
                }
                return 0;
            });

            rows.forEach(row => tbody.appendChild(row));
        });
    }
}

// ============================================
// ATTENDEES MANAGER (Admin)
// ============================================

async function loadAttendeesManager() {
    const container = document.getElementById('adminAttendeesManager');
    if (!container) return;

    try {
        await loadAttendeesData();

        let html = '';
        for (const row of burgerData) {
            const ranking = row['Ranking'];
            const attendees = attendeesData[ranking] || [];

            html += `
                <div class="attendees-manager-item" style="border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
                        <strong style="color:var(--red);">#${ranking} ${escapeHtml(row['Restaurant'])}</strong>
                        <span style="font-size:0.85em;color:var(--text-muted);">${attendees.length} attendee${attendees.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div id="attendees-list-${ranking}" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
                        ${attendees.map((name, i) => {
                            const isUnknown = name.startsWith('Unknown ');
                            return `
                            <div class="attendee-tag ${isUnknown ? 'unknown-attendee' : ''}">
                                <span ${isUnknown ? `onclick="editUnknownAttendee(${ranking}, '${escapeHtml(name).replace(/'/g, "\\'")}')" style="cursor:pointer;" title="Click to edit"` : ''}>
                                    ${escapeHtml(name)}
                                    ${isUnknown ? ' ✏️' : ''}
                                </span>
                                <button class="tag-remove" onclick="removeAttendee(${ranking}, '${escapeHtml(name).replace(/'/g, "\\'")}')">×</button>
                            </div>
                        `;
                        }).join('')}
                    </div>
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="add-attendee-${ranking}" placeholder="Add attendee name" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:4px;">
                        <button class="btn-small" onclick="addAttendee(${ranking})">Add</button>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (err) {
        console.error('Load attendees manager error:', err);
        container.innerHTML = '<p style="color:#999;">Failed to load attendees manager.</p>';
    }
}

async function addAttendee(ranking) {
    const input = document.getElementById(`add-attendee-${ranking}`);
    const name = input.value.trim();

    if (!name) {
        alert('Please enter a name.');
        return;
    }

    try {
        await dbInsert('attendees', {
            burger_id: parseInt(ranking),
            name: name,
        });

        input.value = '';
        await loadAttendeesData();
        await loadRankings();
        loadAttendeesManager();
    } catch (err) {
        console.error('Add attendee error:', err);
        alert('Failed to add attendee: ' + err.message);
    }
}

async function removeAttendee(ranking, name) {
    if (!confirm(`Remove ${name} from this burger's attendees?`)) return;

    try {
        // Find and delete the attendee entry
        const all = await dbSelect('attendees', `select=*&burger_id=eq.${ranking}&name=eq.${encodeURIComponent(name)}`);
        if (all && all.length > 0) {
            await dbDelete('attendees', 'id', all[0].id);
        }

        await loadAttendeesData();
        await loadRankings();
        loadAttendeesManager();
    } catch (err) {
        console.error('Remove attendee error:', err);
        alert('Failed to remove attendee: ' + err.message);
    }
}

async function editUnknownAttendee(ranking, oldName) {
    const newName = prompt(`Replace "${oldName}" with:`, '');
    if (!newName || newName.trim() === '') return;
    if (newName.trim() === oldName) return;

    try {
        // Find the attendee entry
        const all = await dbSelect('attendees', `select=*&burger_id=eq.${ranking}&name=eq.${encodeURIComponent(oldName)}`);
        if (all && all.length > 0) {
            // Update the name
            await dbUpdate('attendees', { name: newName.trim() }, 'id', all[0].id);
        } else {
            // If not in DB yet (e.g., was just generated), create it
            await dbInsert('attendees', {
                burger_id: parseInt(ranking),
                name: newName.trim(),
                rating_id: null,
            });
        }

        await loadAttendeesData();
        await loadRankings();
        loadAttendeesManager();
        loadMainAttendanceTracker();
        loadAttendanceTracker();
    } catch (err) {
        console.error('Edit attendee error:', err);
        alert('Failed to edit attendee: ' + err.message);
    }
}

// ============================================
// ATTENDANCE TRACKER
// ============================================

async function loadAttendanceTracker() {
    const select1 = document.getElementById('trackerMemberSelect');
    const select2 = document.getElementById('trackerMember1');
    const select3 = document.getElementById('trackerMember2');

    if (!select1) return;

    await loadAttendeesData();

    // Get all unique names (excluding "Unknown" placeholders)
    const allNames = new Set();
    Object.values(attendeesData).forEach(names => {
        names.forEach(n => {
            // Filter out "Unknown" placeholders from tracker
            if (!n.startsWith('Unknown ')) {
                allNames.add(n);
            }
        });
    });

    const sorted = Array.from(allNames).sort();

    [select1, select2, select3].forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select member --</option>' +
            sorted.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    });

    // Event listeners
    select1?.addEventListener('change', showIndividualAttendance);
    document.getElementById('trackerCompareBtn')?.addEventListener('click', compareAttendance);
}

function showIndividualAttendance() {
    const name = document.getElementById('trackerMemberSelect').value;
    const resultsDiv = document.getElementById('trackerIndividualResults');

    if (!name) {
        resultsDiv.innerHTML = '';
        return;
    }

    const attended = [];
    for (const [ranking, names] of Object.entries(attendeesData)) {
        if (names.includes(name)) {
            const burger = burgerData.find(b => b['Ranking'] == ranking);
            if (burger) attended.push(burger);
        }
    }

    if (attended.length === 0) {
        resultsDiv.innerHTML = `<p style="color:#999;">${escapeHtml(name)} hasn't attended any burgers yet.</p>`;
        return;
    }

    resultsDiv.innerHTML = `
        <div style="background:var(--bg);padding:16px;border-radius:8px;margin-top:12px;">
            <h4 style="margin-bottom:10px;color:var(--red);">${escapeHtml(name)} - ${attended.length} burger${attended.length !== 1 ? 's' : ''}</h4>
            ${attended.map(b => `
                <div style="padding:6px 0;border-bottom:1px solid var(--border);">
                    #${b['Ranking']} ${escapeHtml(b['Restaurant'])} — ${escapeHtml(b['Description'])}
                </div>
            `).join('')}
        </div>
    `;
}

function compareAttendance() {
    const name1 = document.getElementById('trackerMember1').value;
    const name2 = document.getElementById('trackerMember2').value;
    const resultsDiv = document.getElementById('trackerComparisonResults');

    if (!name1 || !name2) {
        alert('Please select two members to compare.');
        return;
    }

    const attended1 = [];
    const attended2 = [];

    for (const [ranking, names] of Object.entries(attendeesData)) {
        const burger = burgerData.find(b => b['Ranking'] == ranking);
        if (!burger) continue;

        if (names.includes(name1)) attended1.push(burger);
        if (names.includes(name2)) attended2.push(burger);
    }

    const both = attended1.filter(b => attended2.some(b2 => b2['Ranking'] === b['Ranking']));
    const only1 = attended1.filter(b => !attended2.some(b2 => b2['Ranking'] === b['Ranking']));
    const only2 = attended2.filter(b => !attended1.some(b1 => b1['Ranking'] === b['Ranking']));

    resultsDiv.innerHTML = `
        <div style="background:var(--bg);padding:16px;border-radius:8px;margin-top:12px;">
            <h4 style="color:var(--red);margin-bottom:10px;">Comparison Results</h4>
            <p><strong>${escapeHtml(name1)}:</strong> ${attended1.length} burgers | <strong>${escapeHtml(name2)}:</strong> ${attended2.length} burgers</p>
            <p><strong>Both attended:</strong> ${both.length} burger${both.length !== 1 ? 's' : ''}</p>

            ${both.length > 0 ? `
                <div style="margin-top:10px;padding:10px;background:white;border-radius:6px;">
                    <strong>Both:</strong>
                    ${both.map(b => `<div style="padding:4px 0;">#${b['Ranking']} ${escapeHtml(b['Restaurant'])}</div>`).join('')}
                </div>
            ` : ''}

            ${only1.length > 0 ? `
                <div style="margin-top:10px;padding:10px;background:white;border-radius:6px;">
                    <strong>Only ${escapeHtml(name1)}:</strong>
                    ${only1.map(b => `<div style="padding:4px 0;">#${b['Ranking']} ${escapeHtml(b['Restaurant'])}</div>`).join('')}
                </div>
            ` : ''}

            ${only2.length > 0 ? `
                <div style="margin-top:10px;padding:10px;background:white;border-radius:6px;">
                    <strong>Only ${escapeHtml(name2)}:</strong>
                    ${only2.map(b => `<div style="padding:4px 0;">#${b['Ranking']} ${escapeHtml(b['Restaurant'])}</div>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
}
// ============================================
// MAIN PAGE ATTENDANCE TRACKER
// ============================================

let trackerMemberCount = 2;
let trackerAvailableNames = [];

async function loadMainAttendanceTracker() {
    const individualSelect = document.getElementById('mainTrackerMemberSelect');
    const container = document.getElementById('mainTrackerMemberSelectors');

    if (!individualSelect || !container) return;

    await loadAttendeesData();

    // Get all unique names (excluding "Unknown" placeholders)
    const allNames = new Set();
    Object.values(attendeesData).forEach(names => {
        names.forEach(n => {
            // Filter out "Unknown" placeholders from tracker
            if (!n.startsWith('Unknown ')) {
                allNames.add(n);
            }
        });
    });

    trackerAvailableNames = Array.from(allNames).sort();

    // Populate individual member select
    individualSelect.innerHTML = '<option value="">-- Select a member --</option>' +
        trackerAvailableNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');

    // Initialize with 2 member selects
    trackerMemberCount = 2;
    renderTrackerSelects();

    // Event listeners
    individualSelect.addEventListener('change', showMainIndividualAttendance);
    document.getElementById('mainTrackerCompareBtn')?.addEventListener('click', compareMainAttendance);
    document.getElementById('addMemberBtn')?.addEventListener('click', addTrackerMember);
    document.getElementById('clearMembersBtn')?.addEventListener('click', clearTrackerMembers);
}

function renderTrackerSelects() {
    const container = document.getElementById('mainTrackerMemberSelectors');
    if (!container) return;

    container.innerHTML = '';
    for (let i = 0; i < trackerMemberCount; i++) {
        const select = document.createElement('select');
        select.className = 'tracker-member-select sort-select';
        select.style.width = '100%';
        select.style.maxWidth = '400px';
        select.dataset.index = i;
        select.innerHTML = `<option value="">-- Member ${i + 1} --</option>` +
            trackerAvailableNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
        container.appendChild(select);
    }
}

function addTrackerMember() {
    if (trackerMemberCount >= trackerAvailableNames.length) {
        alert(`Maximum ${trackerAvailableNames.length} members available.`);
        return;
    }
    trackerMemberCount++;
    renderTrackerSelects();
}

function clearTrackerMembers() {
    trackerMemberCount = 2;
    renderTrackerSelects();
    document.getElementById('mainTrackerComparisonResults').innerHTML = '';
}

function showMainIndividualAttendance() {
    const name = document.getElementById('mainTrackerMemberSelect').value;
    const resultsDiv = document.getElementById('mainTrackerIndividualResults');

    if (!name) {
        resultsDiv.innerHTML = '';
        return;
    }

    const attended = [];
    for (const [ranking, names] of Object.entries(attendeesData)) {
        if (names.includes(name)) {
            const burger = burgerData.find(b => b['Ranking'] == ranking);
            if (burger) attended.push(burger);
        }
    }

    if (attended.length === 0) {
        resultsDiv.innerHTML = `<p style="color:#999;margin-top:12px;">${escapeHtml(name)} hasn't attended any burgers yet.</p>`;
        return;
    }

    resultsDiv.innerHTML = `
        <div style="background:var(--bg);padding:20px;border-radius:8px;margin-top:12px;">
            <h3 style="margin-bottom:12px;color:var(--red);">${escapeHtml(name)} - ${attended.length} burger${attended.length !== 1 ? 's' : ''}</h3>
            <div style="display:grid;gap:8px;">
                ${attended.map(b => `
                    <div style="padding:10px;background:white;border-radius:6px;border-left:4px solid var(--red);">
                        <strong>#${b['Ranking']} ${escapeHtml(b['Restaurant'])}</strong>
                        <div style="color:#666;font-size:0.9em;margin-top:4px;">${escapeHtml(b['Description'])}</div>
                        <div style="color:#999;font-size:0.85em;margin-top:4px;">Rating: ${escapeHtml(b['Burger Rating']) || 'Not rated'} | ${escapeHtml(b['Date of Visit'])}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function compareMainAttendance() {
    const memberSelects = document.querySelectorAll('.tracker-member-select');
    const resultsDiv = document.getElementById('mainTrackerComparisonResults');

    // Get selected members
    const selectedMembers = Array.from(memberSelects)
        .map(sel => sel.value)
        .filter(v => v !== '');

    if (selectedMembers.length < 2) {
        alert('Please select at least 2 members to compare.');
        return;
    }

    // Get attendance for each selected member
    const memberAttendance = {};
    selectedMembers.forEach(name => {
        memberAttendance[name] = [];
        for (const [ranking, names] of Object.entries(attendeesData)) {
            if (names.includes(name)) {
                const burger = burgerData.find(b => b['Ranking'] == ranking);
                if (burger) memberAttendance[name].push(burger);
            }
        }
    });

    // Find burgers attended by all selected members
    const attendedByAll = memberAttendance[selectedMembers[0]].filter(burger => {
        return selectedMembers.every(member =>
            memberAttendance[member].some(b => b['Ranking'] === burger['Ranking'])
        );
    });

    // Find unique burgers per member
    const uniquePerMember = {};
    selectedMembers.forEach(member => {
        uniquePerMember[member] = memberAttendance[member].filter(burger => {
            // Only this member attended
            return selectedMembers.filter(m =>
                memberAttendance[m].some(b => b['Ranking'] === burger['Ranking'])
            ).length === 1;
        });
    });

    // Build results HTML
    let html = `
        <div style="background:var(--bg);padding:20px;border-radius:8px;margin-top:16px;">
            <h3 style="color:var(--red);margin-bottom:16px;">Comparison Results</h3>

            <!-- Summary -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px;">
                ${selectedMembers.map(name => `
                    <div style="background:white;padding:12px;border-radius:6px;text-align:center;">
                        <div style="font-weight:700;color:var(--red);">${memberAttendance[name].length}</div>
                        <div style="font-size:0.9em;color:#666;">${escapeHtml(name)}</div>
                    </div>
                `).join('')}
            </div>

            <div style="background:white;padding:12px;border-radius:6px;text-align:center;margin-bottom:20px;">
                <div style="font-weight:700;color:var(--red);">${attendedByAll.length}</div>
                <div style="font-size:0.9em;color:#666;">Attended by all ${selectedMembers.length} members</div>
            </div>
    `;

    // Attended by all
    if (attendedByAll.length > 0) {
        html += `
            <div style="margin-bottom:20px;">
                <h4 style="margin-bottom:10px;">Attended by All</h4>
                <div style="display:grid;gap:8px;">
                    ${attendedByAll.map(b => `
                        <div style="padding:10px;background:#e8f5e9;border-radius:6px;border-left:4px solid #4caf50;">
                            <strong>#${b['Ranking']} ${escapeHtml(b['Restaurant'])}</strong>
                            <div style="font-size:0.9em;color:#666;margin-top:4px;">${escapeHtml(b['Description'])}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Unique per member
    selectedMembers.forEach(member => {
        if (uniquePerMember[member].length > 0) {
            html += `
                <div style="margin-bottom:20px;">
                    <h4 style="margin-bottom:10px;">Only ${escapeHtml(member)} (${uniquePerMember[member].length})</h4>
                    <div style="display:grid;gap:8px;">
                        ${uniquePerMember[member].map(b => `
                            <div style="padding:10px;background:white;border-radius:6px;border-left:4px solid var(--red);">
                                <strong>#${b['Ranking']} ${escapeHtml(b['Restaurant'])}</strong>
                                <div style="font-size:0.9em;color:#666;margin-top:4px;">${escapeHtml(b['Description'])}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    });

    html += '</div>';
    resultsDiv.innerHTML = html;
}
