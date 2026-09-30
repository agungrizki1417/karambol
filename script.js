let dataGlobal = null;

function switchTab(tabName, el) {
    document.querySelectorAll('.tab-panel').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active');
    el.classList.add('active');
}

function hitungPeluangLolos(player, klasemen, rondeAktif, jadwalRonde) {
    if (player.nama_pemain && player.nama_pemain.toLowerCase().includes('bye')) {
        return 0;
    }
    const poin = player.jumlah_poin;
    const main = player.jumlah_main;
    const rank = player.peringkat;

    if (rondeAktif === 3 && main === 3) {
        return rank <= 8 ? 100 : 0;
    }

    const sisaRonde = 3 - main;
    const potensiPoinMaksimal = poin + (sisaRonde * 3);

    const poinPeringkat8 = klasemen[7] ? klasemen[7].jumlah_poin : 0;
    if (potensiPoinMaksimal < poinPeringkat8) {
        return 0;
    }

    const targetPoinAman = 5; 
    let persenBase = 0;

    if (poin >= targetPoinAman) {
        persenBase = 85 + ((poin - targetPoinAman) * 5) + ((3 - rank) * 2);
    } else {
        const rasioPotensi = potensiPoinMaksimal / targetPoinAman;
        persenBase = rasioPotensi * 45 + (poin * 8);
    }

    let penyesuaianMeja = 0;
    if (jadwalRonde && Array.isArray(jadwalRonde)) {
        const matchPlayer = jadwalRonde.find(m => m.players.includes(player.id_pemain || player.nama_pemain));
        if (matchPlayer && !matchPlayer.completed && dataGlobal.player_map) {
            let totalPoinLawan = 0;
            let countLawan = 0;
            matchPlayer.players.forEach(pid => {
                const namaLawan = dataGlobal.player_map[pid] || pid;
                if (namaLawan !== player.nama_pemain) {
                    const lawanObj = klasemen.find(k => k.nama_pemain === namaLawan);
                    if (lawanObj) {
                        totalPoinLawan += lawanObj.jumlah_poin;
                        countLawan++;
                    }
                }
            });

            if (countLawan > 0) {
                const avgPoinLawan = totalPoinLawan / countLawan;
                penyesuaianMeja = (poin - avgPoinLawan) * 3;
            }
        }
    }

    let hasilAkhir = Math.round(persenBase + penyesuaianMeja);

    if (hasilAkhir > 98) hasilAkhir = 98;
    if (hasilAkhir < 2) hasilAkhir = 2;

    return hasilAkhir;
}

async function loadData() {
    try {
        const res = await fetch('klasemen_sementara.json?t=' + new Date().getTime());
        dataGlobal = await res.json();

        if (dataGlobal && dataGlobal.klasemen) {
            dataGlobal.klasemen = urutkanKlasemenTanpaBias(dataGlobal.klasemen);
        }

        renderHeader();
        renderKlasemen();
        renderJadwalSimulasi();
        renderPemain();
    } catch (err) {
        console.error("Gagal membaca file JSON:", err);
    }
}

function renderHeader() {
    const statusText = dataGlobal.status_turnamen === "finished" 
        ? "TURNAMEN SELESAI" 
        : `RONDE ${dataGlobal.ronde_aktif} DARI 3 | BERLANGSUNG`;
    document.getElementById('header-status').innerText = statusText;
}

function renderKlasemen() {
    const tbody = document.getElementById('body-klasemen');
    tbody.innerHTML = '';

    if (!dataGlobal || !dataGlobal.klasemen) return;

    dataGlobal.klasemen.forEach((p, idx) => {
        const row = document.createElement('tr');
        if (p.peringkat <= 8) row.classList.add('top-4');

        const prob = hitungPeluangLolos(p, dataGlobal.klasemen, dataGlobal.ronde_aktif, dataGlobal.jadwal_ronde);
        
        let probClass = "prob-low";
        if (prob >= 70) probClass = "prob-high";
        else if (prob >= 40) probClass = "prob-mid";

        row.innerHTML = `
            <td class="col-rank">${p.peringkat}</td>
            <td class="col-name"><strong>${p.nama_pemain}</strong></td>
            <td>${p.jumlah_main}</td>
            <td><strong>${p.jumlah_poin}</strong></td>
            <td><span class="badge-prob ${probClass}">${prob}%</span></td>
            <td>
                <button class="btn-detail" onclick="bukaModalAnalisis(${idx})">
                    <i class="fa-solid fa-circle-info"></i> Lihat
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

const PIN_PANITIA_RAHASIA = "0000";
let indeksPemainDipilih = null;

function bukaModalAnalisis(idx) {
    if (!dataGlobal || !dataGlobal.klasemen || !dataGlobal.klasemen[idx]) return;
    
    indeksPemainDipilih = idx;
    
    const inputPin = document.getElementById('input-pin-panitia');
    const pesanError = document.getElementById('pesan-error-pin');
    
    if (inputPin) inputPin.value = '';
    if (pesanError) pesanError.style.display = 'none';

    const modalAuth = document.getElementById('modal-auth');
    if (modalAuth) modalAuth.style.display = 'flex';

    setTimeout(() => { if (inputPin) inputPin.focus(); }, 100);
}

function konfirmasiPinPanitia() {
    const inputPin = document.getElementById('input-pin-panitia').value;
    const pesanError = document.getElementById('pesan-error-pin');

    if (inputPin === PIN_PANITIA_RAHASIA) {
        tutupModalAuth();
        tampilkanDetailAnalisis(indeksPemainDipilih);
    } else {
        if (pesanError) pesanError.style.display = 'block';
    }
}

function tampilkanDetailAnalisis(idx) {
    const p = dataGlobal.klasemen[idx];
    
    let teksAnalisis = "Gagal memuat analisis.";
    if (typeof hasilkanAnalisisPemain === 'function') {
        teksAnalisis = hasilkanAnalisisPemain(p, dataGlobal.klasemen, dataGlobal.ronde_aktif, dataGlobal.jadwal_ronde, dataGlobal);
    }

    document.getElementById('modal-nama-pemain').textContent = p.nama_pemain;
    document.getElementById('modal-teks-analisis').innerHTML = teksAnalisis;
    
    const modalAnalisis = document.getElementById('modal-analisis');
    if (modalAnalisis) modalAnalisis.style.display = 'flex';
}

function tutupModalAuth() {
    const modalAuth = document.getElementById('modal-auth');
    if (modalAuth) modalAuth.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const inputPin = document.getElementById('input-pin-panitia');
    if (inputPin) {
        inputPin.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') konfirmasiPinPanitia();
        });
    }
});

function tutupModalAnalisis() {
    const modal = document.getElementById('modal-analisis');
    modal.style.display = 'none';
}

function renderJadwalSimulasi() {
    const container = document.getElementById('container-jadwal');
    container.innerHTML = '';

    if (!dataGlobal || !dataGlobal.jadwal_ronde) return;

    const jadwalKalender = {
        1: [ // Ronde 1
            { tgl: "Sabtu, 26 September 2026", jam: "20.00 - 21.00 WIB" },
            { tgl: "Sabtu, 26 September 2026", jam: "21.00 - 22.00 WIB" },
            { tgl: "Minggu, 27 September 2026", jam: "20.00 - 21.00 WIB" },
            { tgl: "Minggu, 27 September 2026", jam: "21.00 - 22.00 WIB" },
            { tgl: "Senin, 28 September 2026", jam: "20.00 - 21.00 WIB" }
        ],
        2: [ // Ronde 2
            { tgl: "Senin, 28 September 2026", jam: "21.00 - 22.00 WIB" },
            { tgl: "Selasa, 29 September 2026", jam: "20.00 - 21.00 WIB" },
            { tgl: "Selasa, 29 September 2026", jam: "21.00 - 22.00 WIB" },
            { tgl: "Rabu, 30 September 2026", jam: "20.00 - 21.00 WIB" },
            { tgl: "Rabu, 30 September 2026", jam: "21.00 - 22.00 WIB" }
        ],
        3: [ // Ronde 3
            { tgl: "Kamis, 1 Oktober 2026", jam: "20.00 - 21.00 WIB" },
            { tgl: "Kamis, 1 Oktober 2026", jam: "21.00 - 22.00 WIB" },
            { tgl: "Jumat, 2 Oktober 2026", jam: "20.00 - 21.00 WIB" },
            { tgl: "Jumat, 2 Oktober 2026", jam: "21.00 - 22.00 WIB" },
            { tgl: "Sabtu, 3 Oktober 2026", jam: "20.00 - 21.00 WIB" }
        ]
    };

    const rondeAktif = dataGlobal.ronde_aktif || 1;
    const jadwalSaatIni = jadwalKalender[rondeAktif] || jadwalKalender[1];

    dataGlobal.jadwal_ronde.forEach((match, i) => {
        const infoWaktu = jadwalSaatIni[i] || { tgl: "TBA", jam: "20.00 WIB" };
        
        let playersHTML = '';
        match.players.forEach((pid, idx) => {
            const namaPemain = dataGlobal.player_map[pid] || pid;
            playersHTML += `
                <div class="player-slot">
                    <span>${idx + 1}. ${namaPemain}</span>
                </div>
            `;
        });

        let statusBadge = '<span style="color: var(--text-muted)">⚪ Belum Main</span>';
        if (match.completed) {
            statusBadge = '<span style="color: var(--accent-red)">🔴 Selesai</span>';
        } else if (i === 0 || (i > 0 && dataGlobal.jadwal_ronde[i-1].completed)) {
            statusBadge = '<span style="color: var(--accent-green)">🟢 Selanjutnya</span>';
        }

        const card = document.createElement('div');
        card.className = 'match-card';
        card.innerHTML = `
            <div class="match-header">
                <div>
                    <strong>MATCH ${match.meja} (Ronde ${rondeAktif})</strong> 
                    <span style="font-size:0.75rem; color:var(--accent-dark); display:block; margin-top:2px;">
                        <i class="fa-regular fa-calendar-days"></i> ${infoWaktu.tgl}
                    </span>
                    <span style="font-size:0.72rem; color:var(--text-muted); display:block;">
                        <i class="fa-regular fa-clock"></i> ${infoWaktu.jam}
                    </span>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:0.8rem; font-weight:bold; color:var(--accent-dark);">Meja Utama</span><br>
                    ${statusBadge}
                </div>
            </div>
            <div class="match-players">
                ${playersHTML}
            </div>
        `;
        container.appendChild(card);
    });

    const infoDrawing = document.createElement('div');
    infoDrawing.className = 'info-drawing-card';
    infoDrawing.innerHTML = `
        <div class="info-drawing-header">
            <i class="fa-solid fa-circle-info"></i>
            <strong>Catatan Tambahan</strong>
        </div>
        <p>Jadwal dan pembagian meja untuk <strong>Ronde ${rondeAktif + 1}</strong> baru akan dibuat dan muncul otomatis setelah seluruh pertandingan Ronde ${rondeAktif} selesai dimainkan.</p>
    `;
    container.appendChild(infoDrawing);
}

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

function filterPemain() {
    const query = document.getElementById('input-search').value.toLowerCase();
    const cards = document.querySelectorAll('.player-card');

    cards.forEach(card => {
        const name = card.getAttribute('data-name');
        card.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

function urutkanKlasemenTanpaBias(klasemen) {
    if (!klasemen || !Array.isArray(klasemen)) return [];

    return [...klasemen].sort((a, b) => {
        const isByeA = a.nama_pemain.toLowerCase().includes('bye');
        const isByeB = b.nama_pemain.toLowerCase().includes('bye');

        if (isByeA && !isByeB) return 1;
        if (!isByeA && isByeB) return -1;
        // ----------------------------------------------

        if (b.jumlah_poin !== a.jumlah_poin) {
            return b.jumlah_poin - a.jumlah_poin;
        }

        const potensiA = a.jumlah_poin + ((3 - a.jumlah_main) * 3);
        const potensiB = b.jumlah_poin + ((3 - b.jumlah_main) * 3);
        if (potensiB !== potensiA) {
            return potensiB - potensiA;
        }

        const avgA = a.jumlah_main > 0 ? (a.jumlah_poin / a.jumlah_main) : 0;
        const avgB = b.jumlah_main > 0 ? (b.jumlah_poin / b.jumlah_main) : 0;
        if (avgB !== avgA) {
            return avgB - avgA;
        }

        return a.nama_pemain.localeCompare(b.nama_pemain);
    }).map((player, index) => {
        return {
            ...player,
            peringkat: index + 1
        };
    });
}

loadData();
setInterval(loadData, 3000);