function hasilkanAnalisisPemain(player, klasemen, rondeAktif, jadwalRonde, dataGlobal) {
    const nama = player.nama_pemain;
    const poin = player.jumlah_poin;
    const main = player.jumlah_main;
    const ronde = rondeAktif || 1;
    const rank = player.peringkat;

    if (nama.toLowerCase().includes('bye')) {
        return `<strong>SLOT DUMMY (BYE).</strong> Ini adalah slot kosong yang digunakan untuk melengkapi kelipatan meja pertandingan. Slot Bye tidak dihitung dalam perburuan tiket Babak 8 Besar.`;
    }

    const totalMatchRondeIni = jadwalRonde ? jadwalRonde.length : 5;
    const matchSelesaiRondeIni = jadwalRonde ? jadwalRonde.filter(m => m.completed).length : 0;
    const rondeSelesaiPenuh = (matchSelesaiRondeIni === totalMatchRondeIni);

    const sudahTandingDiRondeIni = (main >= ronde);

    let poinPeringkat8 = klasemen && klasemen[7] ? klasemen[7].jumlah_poin : 0;
    if (!rondeSelesaiPenuh && poinPeringkat8 === 0) {
        poinPeringkat8 = 0;
    }

    let kepadatanBubble = 0;
    if (klasemen) {
        kepadatanBubble = klasemen.filter(k =>
            k.peringkat >= 6 && k.peringkat <= 12 && k.jumlah_poin === poin && !k.nama_pemain.toLowerCase().includes('bye')
        ).length;
    }

    const sisaMatchPribadi = Math.max(0, 3 - main);
    const potensiMax = poin + (sisaMatchPribadi * 3);

    const riwayat = player.riwayat_skor || player.results || [];
    const lastSkor = riwayat.length > 0 ? riwayat[riwayat.length - 1] : null;
    const secondLastSkor = riwayat.length > 1 ? riwayat[riwayat.length - 2] : null;

    let trenPerforma = "NETRAL";
    if (lastSkor !== null) {
        if (lastSkor === 3) trenPerforma = "ON_FIRE";
        else if (lastSkor === 0) trenPerforma = "PENURUNAN";
        else if (secondLastSkor !== null && lastSkor > secondLastSkor) trenPerforma = "NAIK";
        else if (secondLastSkor !== null && lastSkor < secondLastSkor) trenPerforma = "TURUN";
    }

    let avgPoinLawan = 0;
    let lawanSemejaList = [];
    let rivalPapanAtasSeMeja = 0;
    let adaByeDiMeja = false;
    let namaPemainByeInTable = "";

    if (jadwalRonde && Array.isArray(jadwalRonde) && dataGlobal && dataGlobal.player_map) {
        const matchPlayer = jadwalRonde.find(m =>
            m.players && m.players.some(pid => (dataGlobal.player_map[pid] || pid) === nama)
        );

        if (matchPlayer) {
            let totalPoinLawan = 0;
            let countLawanAktif = 0;

            matchPlayer.players.forEach(pid => {
                const namaLawan = dataGlobal.player_map[pid] || pid;
                if (namaLawan !== nama) {
                    if (namaLawan.toLowerCase().includes('bye')) {
                        adaByeDiMeja = true;
                        namaPemainByeInTable = namaLawan;
                    } else {
                        lawanSemejaList.push(namaLawan);
                        const lawanObj = klasemen.find(k => k.nama_pemain === namaLawan);
                        if (lawanObj) {
                            totalPoinLawan += lawanObj.jumlah_poin;
                            countLawanAktif++;
                            if (lawanObj.jumlah_poin >= 3) rivalPapanAtasSeMeja++;
                        }
                    }
                }
            });

            if (countLawanAktif > 0) {
                avgPoinLawan = totalPoinLawan / countLawanAktif;
            }
        }
    }

    let tipeMeja = "SEIMBANG";
    if (avgPoinLawan >= 2.5) tipeMeja = "NERAKA";
    else if (avgPoinLawan <= 1.0) tipeMeja = "RINGAN";

    let adaMejaLainDapatBye = false;
    if (jadwalRonde && Array.isArray(jadwalRonde) && dataGlobal && dataGlobal.player_map) {
        adaMejaLainDapatBye = jadwalRonde.some(m => {
            const isMyMatch = m.players && m.players.includes(player.id_pemain || player.nama_pemain);
            if (isMyMatch) return false;
            return m.players.some(pid => (dataGlobal.player_map[pid] || pid).toLowerCase().includes('bye'));
        });
    }

    const sebutanPosisi = (p) => {
        if (rondeSelesaiPenuh) return `Peringkat ke-${p}`;
        if (p <= 3) return `Papan Atas Klasemen Sementara`;
        if (p <= 8) return `Zona 8 Besar Sementara`;
        if (p <= 14) return `Papan Tengah Klasemen Sementara`;
        return `Papan Bawah Klasemen Sementara`;
    };

    if (potensiMax < poinPeringkat8 && main > 0 && rondeSelesaiPenuh) {
        const variasiGugur = [
            `Secara kalkulasi matematis, langkah <strong>${nama}</strong> terhenti. Dengan koleksi ${poin} poin dari ${main} match, batas poin maksimal (${potensiMax} pt) tidak lagi mampu mengejar ambang batas 8 Besar (${poinPeringkat8} pt).`,
            `Peluang kelolosan <strong>${nama}</strong> telah tertutup secara matematis. Walau memenangkan seluruh sisa match, capaian maksimal ${potensiMax} poin belum cukup menembus persaingan papan atas.`,
            `Langkah <strong>${nama}</strong> (${sebutanPosisi(rank)}, ${poin} pt) dipastikan terhenti dari perburuan tiket 8 Besar karena selisih poin yang tak lagi terkejar di sisa ronde.`
        ];
        return variasiGugur[rank % variasiGugur.length];
    }

    if (ronde === 3 && main === 3 && rondeSelesaiPenuh) {
        if (rank <= 8) {
            return `<strong>RESMI LOLOS!</strong> Selamat untuk <strong>${nama}</strong> yang sukses mengamankan tiket Babak 8 Besar di Peringkat ke-${rank} dengan total ${poin} poin.`;
        } else {
            return `<strong>GUGUR DI FINISH LINE.</strong> Perjuangan <strong>${nama}</strong> berakhir di Peringkat ke-${rank} (${poin} pt), tepat berada di luar zona Knockout 8 Besar.`;
        }
    }

    if (ronde === 1) {
        if (!sudahTandingDiRondeIni) {
            let infoProfilLawan = "";
            if (adaByeDiMeja) {
                infoProfilLawan = ` <strong>Keuntungan Meja:</strong> Berada satu meja dengan slot <em>${namaPemainByeInTable}</em>. Persaingan hanya diikuti 3 pemain aktif, membuka peluang emas mendulang minimal 2–3 poin di match pembuka.`;
            }
            else if (tipeMeja === "NERAKA") {
                infoProfilLawan = ` Berada di meja ketat dengan rata-rata lawan ${avgPoinLawan.toFixed(1)} pt.`;
            }
            else {
                infoProfilLawan = ` Menghadapi persaingan meja pembuka yang relatif seimbang.`;
            }
            return `<strong>${nama}</strong> bersiap melakoni match perdana di Ronde 1.${infoProfilLawan} Raihan poin awal ini sangat krusial untuk membentuk fondasi posisi di tabel klasemen.`;
        } else {
            if (lastSkor === 3) {
                return `<strong>START PERFEK!</strong> Kemenangan telak 3 poin di Ronde 1 membawa <strong>${nama}</strong> mengamankan ${sebutanPosisi(rank)}. Kinerja konsisten di Ronde 2 dan 3 akan memuluskan langkah menuju Babak 8 Besar.`;
            } else if (lastSkor === 2) {
                return `<strong>HASIL POSITIF.</strong> <strong>${nama}</strong> mengantongi 2 poin berharga di match pertama (${sebutanPosisi(rank)}). Pijakan awal yang solid untuk menatap laga krusial di Ronde 2.`;
            } else if (lastSkor === 1) {
                return `<strong>MODAL AWAL 1 POIN.</strong> <strong>${nama}</strong> meraih 1 poin di Ronde 1. Masih ada 2 ronde tersisa untuk mendulang poin maksimal dan merangkak naik ke papan atas.`;
            } else {
                return `<strong>PELUANG MASIH TERBUKA.</strong> Meskipun belum mengantongi poin di match pembuka, <strong>${nama}</strong> (${sebutanPosisi(rank)}) masih memiliki potensi hingga 6 poin di 2 ronde tersisa. Kemenangan penuh di Ronde 2 menjadi kunci utama.`;
            }
        }
    }

    if (ronde === 2) {
        if (!sudahTandingDiRondeIni) {
            let narasiMeja = "";
            if (adaByeDiMeja) {
                narasiMeja = ` <strong>Keuntungan Meja:</strong> Satu meja dengan slot <em>Bye</em> (${namaPemainByeInTable}). Hanya ada 3 pemain aktif, momentum emas untuk panen poin maksimal.`;
            } else if (rivalPapanAtasSeMeja >= 2) {
                narasiMeja = ` <strong>Peringatan Meja Keras:</strong> Satu meja dengan ${rivalPapanAtasSeMeja} rival papan atas. Alokasi poin penuh akan sangat diperebutkan.`;
            } else if (tipeMeja === "RINGAN") {
                narasiMeja = ` Berada di meja dengan profil lawan relatif sedang, kesempatan baik untuk mencuri poin.`;
            } else {
                narasiMeja = ` Menghadapi lawan meja dengan rata-rata ${avgPoinLawan.toFixed(1)} poin.`;
            }

            let narasiAncaman = "";
            if (!adaByeDiMeja && adaMejaLainDapatBye && rank >= 6 && rank <= 12) {
                narasiAncaman = ` <em>Catatan Waspada:</em> Ada pesaing di meja lain yang bertanding dengan slot Bye (persaingan lebih longgar). Anda wajib menang untuk mengamankan posisi dari ancaman geseran.`;
            }

            if (poin >= 3) {
                return `<strong>${nama}</strong> (${sebutanPosisi(rank)}, ${poin} pt) <em>belum bertanding di Ronde 2</em>.${narasiMeja}${narasiAncaman} Kemenangan di match ini akan membuat posisinya semakin kokoh di zona 8 Besar.`;
            } else if (poin === 2) {
                return `<strong>${nama}</strong> (${sebutanPosisi(rank)}, 2 pt) <em>menunggu giliran main Ronde 2</em>.${narasiMeja}${narasiAncaman} Wajib meraih minimal Juara 1 atau 2 se-meja untuk mendongkrak posisi ke zona aman.`;
            } else {
                return `<strong>LAGA PENENTUAN.</strong> Mengantongi ${poin} poin, <strong>${nama}</strong> <em>belum tanding di Ronde 2</em>.${narasiMeja}${narasiAncaman} Hasil match ini menentukan apakah ${nama} mampu keluar dari papan bawah.`;
            }
        } else {
            let narasiTren = "";
            if (trenPerforma === "ON_FIRE") narasiTren = " Tren positif berlanjut usai kemenangan penuh di match baru saja!";
            else if (trenPerforma === "PENURUNAN") narasiTren = " Sayang sekali hasil kurang maksimal didapat pada match Ronde 2 ini.";

            if (poin >= 5) {
                return `<strong>POSISI SANGAT KOKOH!</strong> Mengumpulkan ${poin} poin dari 2 match menempatkan <strong>${nama}</strong> di ${sebutanPosisi(rank)}.${narasiTren} Tiket 8 Besar sudah berada di depan mata.`;
            } else if (poin >= 3) {
                let warningBubble = kepadatanBubble > 1 ? ` Hati-hati, ada ${kepadatanBubble} pemain lain berpoin sama di area persaingan!` : "";
                return `<strong>BERADA DI ZONA AMAN.</strong> <strong>${nama}</strong> menduduki ${sebutanPosisi(rank)} dengan ${poin} poin.${narasiTren}${warningBubble} Fokus penuh dibutuhkan di Ronde 3.`;
            } else {
                return `<strong>SITUASI KRITIS.</strong> Dengan total ${poin} poin dari 2 match (${sebutanPosisi(rank)}), posisi <strong>${nama}</strong> rawan tersingkir. Wajib meraih kemenangan penuh 3 poin di Ronde 3.`;
            }
        }
    }

    if (ronde === 3) {
        if (!sudahTandingDiRondeIni) {
            let narasiMejaR3 = "";
            if (adaByeDiMeja) {
                narasiMejaR3 = ` <strong>Keuntungan Krusial:</strong> Di match pamungkas ini, ${nama} berada di meja slot <em>Bye</em> (${namaPemainByeInTable}). Persaingan 3 pemain aktif mempermudah jalan mendulang poin penentu!`;
            }

            if (rank <= 8) {
                if (poin >= 5) {
                    return `<strong>${nama}</strong> (${sebutanPosisi(rank)}, ${poin} pt) <em>belum tanding di Ronde 3</em>.${narasiMejaR3} Posisi sangat aman, bermain tenang di meja akhir akan memastikannya lolos resmi ke 8 Besar.`;
                } else {
                    let textBubble = kepadatanBubble > 1 ? ` Terdapat ${kepadatanBubble} pesaing berpoin sama!` : "";
                    return `<strong>MATCH HIDUP-MATI!</strong> <strong>${nama}</strong> (${sebutanPosisi(rank)}, ${poin} pt) berada di batas rentan 8 Besar.${narasiMejaR3}${textBubble} Wajib tampil habis-habisan di meja Ronde 3 ini untuk mengamankan posisi dari ancaman geseran.`;
                }
            } else {
                return `<strong>MISSION IMPOSSIBLE / KEAJAIBAN.</strong> Berada di ${sebutanPosisi(rank)} (${poin} pt), <strong>${nama}</strong> <em>belum tanding di Ronde 3</em>.${narasiMejaR3} Wajib menang Juara 1 (3 pt) di match ini sambil berharap terjadi pembagian poin menguntungkan di meja pesaing.`;
            }
        } else {
            if (rank <= 8) {
                return `<strong>${nama}</strong> telah menyelesaikan seluruh match dengan total ${poin} poin dan menempati ${sebutanPosisi(rank)}. Tinggal menunggu seluruh match di meja lain selesai untuk penutupan resmi.`;
            } else {
                return `<strong>${nama}</strong> telah mengakhiri seluruh pertandingannya dengan torehan ${poin} poin (${sebutanPosisi(rank)}). Perjuangan terhenti di fase grup.`;
            }
        }
    }

    return `<strong>${nama}</strong> mengumpulkan ${poin} poin dari ${main} pertandingan dan berada di ${sebutanPosisi(rank)}.`;
}