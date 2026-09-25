let dataGlobal = null;

// Fungsi Ganti Tab
function switchTab(tabName, el) {
    document.querySelectorAll('.tab-panel').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active');
    el.classList.add('active');
}

// Hitung Estimasi Persentase Lolos (Top 4)
function hitungPeluangLolos(poin, main, rank, rondeAktif) {
    if (rondeAktif === 3 && main === 3) {
        return rank <= 4 ? 100 : 0; // Turnamen Selesai
    }

    // Poin Maksimal yang bisa diraih per pertandingan = 3
    let sisaRonde = 3 - main;
    let potensiPoinMaksimal = poin + (sisaRonde * 3);

    // Estimasi kasar probabilitas berbasis posisi & poin
    let persen = 0;
    if (rank <= 4) {
        persen = 70 + (poin * 5); 
    } else {
        persen = (potensiPoinMaksimal / 9) * 50; 
    }

    if (persen > 99) persen = 99;
    if (persen < 5) persen = 5;

    return Math.round(persen);
}

// Muat JSON dari Server/Python
async function loadData() {
    try {
        const res = await fetch('klasemen_sementara.json?t=' + new Date().getTime());
        dataGlobal = await res.json();

        renderHeader();
        renderKlasemen();
        renderJadwalSimulasi();
        renderPemain();
    } catch (err) {
        console.error("Gagal membaca file JSON:", err);
    }
}

// Render Status Header
function renderHeader() {
    const statusText = dataGlobal.status_turnamen === "finished" 
        ? "TURNAMEN SELESAI" 
        : `RONDE ${dataGlobal.ronde_aktif} DARI 3 | BERLANGSUNG`;
    document.getElementById('header-status').innerText = statusText;
}

// Render Tabel Klasemen
function renderKlasemen() {
    const tbody = document.getElementById('body-klasemen');
    tbody.innerHTML = '';

    dataGlobal.klasemen.forEach(p => {
        const row = document.createElement('tr');
        if (p.peringkat <= 4) row.classList.add('top-4');

        const prob = hitungPeluangLolos(p.jumlah_poin, p.jumlah_main, p.peringkat, dataGlobal.ronde_aktif);
        
        let probClass = "prob-low";
        if (prob >= 70) probClass = "prob-high";
        else if (prob >= 40) probClass = "prob-mid";

        row.innerHTML = `
            <td class="col-rank">${p.peringkat}</td>
            <td class="col-name"><strong>${p.nama_pemain}</strong></td>
            <td>${p.jumlah_main}</td>
            <td><strong>${p.jumlah_poin}</strong></td>
            <td><span class="badge-prob ${probClass}">${prob}%</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Render Jadwal 5 Match Lengkap per Ronde
function renderJadwalSimulasi() {
    const container = document.getElementById('container-jadwal');
    container.innerHTML = '';

    if (!dataGlobal || !dataGlobal.klasemen) return;

    // Ambil daftar pemain untuk simulasi 5 Meja/Match di ronde aktif
    const semuaPemain = dataGlobal.klasemen;

    // Waktu mulai match pertama: 20.00 WIB (durasi 60 menit per match)
    const jamMulai = [
        "20.00 - 21.00 WIB",
        "21.00 - 22.00 WIB",
        "22.00 - 23.00 WIB (Malam Berikutnya / Lanjutan)",
        "23.00 - 00.00 WIB (Malam Berikutnya / Lanjutan)",
        "00.00 - 01.00 WIB (Malam Berikutnya / Lanjutan)"
    ];

    // Bagi 20 pemain ke dalam 5 Match (masing-masing 4 pemain)
    for (let i = 0; i < 5; i++) {
        const pemainMeja = semuaPemain.slice(i * 4, (i + 1) * 4);
        
        let playersHTML = '';
        pemainMeja.forEach((p, idx) => {
            playersHTML += `
                <div class="player-slot">
                    <span>${idx + 1}. ${p.nama_pemain}</span>
                    <strong>${p.jumlah_poin} pt</strong>
                </div>
            `;
        });

        // Tentukan Status Match (Simulasi Sederhana)
        let statusBadge = '<span style="color: var(--text-muted)">⚪ Belum Main</span>';
        if (i === 0 && dataGlobal.klasemen[0].jumlah_main > 0) {
            statusBadge = '<span style="color: var(--accent-red)">🔴 Selesai</span>';
        } else if (i === 1 && dataGlobal.klasemen[0].jumlah_main > 0) {
            statusBadge = '<span style="color: var(--accent-green)">🟢 Sedang Berlangsung</span>';
        }

        const card = document.createElement('div');
        card.className = 'match-card';
        card.innerHTML = `
            <div class="match-header">
                <div>
                    <strong>MATCH ${i + 1}</strong> 
                    <span style="font-size:0.75rem; color:var(--text-muted); display:block;">
                        <i class="fa-regular fa-clock"></i> ${jamMulai[i]}
                    </span>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:0.8rem; font-weight:bold; color:var(--accent-dark);">Meja 1</span><br>
                    ${statusBadge}
                </div>
            </div>
            <div class="match-players">
                ${playersHTML}
            </div>
        `;
        container.appendChild(card);
    }
}

// Render Daftar Pemain
function renderPemain() {
    const container = document.getElementById('container-pemain');
    container.innerHTML = '';

    dataGlobal.klasemen.forEach(p => {
        const initial = p.nama_pemain.charAt(0).toUpperCase();
        const card = document.createElement('div');
        card.className = 'player-card';
        card.setAttribute('data-name', p.nama_pemain.toLowerCase());

        card.innerHTML = `
            <div class="player-avatar">${initial}</div>
            <div class="player-details">
                <h4>${p.nama_pemain}</h4>
                <p>Main: ${p.jumlah_main} | Poin: ${p.jumlah_poin}</p>
            </div>
        `;
        container.appendChild(card);
    });
}

// Filter Pencarian Pemain
function filterPemain() {
    const query = document.getElementById('input-search').value.toLowerCase();
    const cards = document.querySelectorAll('.player-card');

    cards.forEach(card => {
        const name = card.getAttribute('data-name');
        card.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

// Jalankan otomatis
loadData();
setInterval(loadData, 3000); // Auto update tiap 3 detik