import json
import os
import random
from collections import defaultdict

SAVE_FILE = "turnamen_karambol.json"
NUM_ROUNDS = 3
PLAYERS_PER_TABLE = 4
TABLES_PER_ROUND = 5
SCORES = [3, 2, 1, 0]

DEFAULT_NAMES = [
    "Paman Tamil",    # P01
    "Pak RT Teguh",   # P02
    "Pak Ayat",       # P03
    "Paman AA",       # P04
    "Wa Olih",        # P05
    "Rafi",           # P06
    "Kang Gonong",    # P07
    "Kang Waik",      # P08
    "Agung",          # P09
    "Pak Teguh",      # P10
    "Paman Hudi",     # P11
    "Mbah Udin",      # P12
    "Firman",         # P13
    "Paman Ir",       # P14
    "Kang Burhan 1",  # P15
    "BYE 1",          # P16
    "Kang Aing",      # P17
    "BYE 2",          # P18
    "Kang Burhan 2",  # P19
    "Mami"            # P20
]


# ============================================================
# SAVE / LOAD JSON
# ============================================================

def save_state(state):
    """Simpan secara atomik agar file tidak mudah rusak saat mati listrik."""
    temp = SAVE_FILE + ".tmp"
    with open(temp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(temp, SAVE_FILE)


def load_state():
    if not os.path.exists(SAVE_FILE):
        return None

    try:
        with open(SAVE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"File save tidak dapat dibaca: {e}")
        return None


def delete_save():
    if os.path.exists(SAVE_FILE):
        os.remove(SAVE_FILE)

def sync_klasemen_manual():
    state = load_state()
    if state is None:
        print("x Tidak ada file turnamen_karambol.json yang ditemukan.")
        return
    export_klasemen_json(state)
    print("✓ Klasemen & jadwal web berhasil diperbarui dari data JSON terbaru!")

def export_klasemen_json(state, filename="klasemen_sementara.json"):
    """
    Menyimpan data klasemen sementara dan jadwal ronde aktif ke file JSON
    untuk dibaca oleh web dashboard.
    """
    klasemen_data = []
    for pos, p in enumerate(standings(state), 1):
        klasemen_data.append({
            "peringkat": pos,
            "nama_pemain": p["name"],
            "jumlah_main": p["played"],
            "jumlah_poin": p["points"],
            "riwayat_skor": p["results"]
        })

    current_round = state.get("current_round", 1)
    round_key = str(current_round)
    tables_data = []

    if round_key in state.get("rounds", {}):
        for idx, table in enumerate(state["rounds"][round_key]["tables"], 1):
            tables_data.append({
                "meja": idx,
                "players": table["players"],
                "completed": table.get("completed", False),
                "result": table.get("result", None)
            })

    p_map = {p["id"]: p["name"] for p in state["players"]}

    payload = {
        "nama_turnamen": "Turnamen Karambol v2",
        "ronde_aktif": current_round,
        "status_turnamen": state.get("status", "running"),
        "total_pemain": len(state["players"]),
        "klasemen": klasemen_data,
        "jadwal_ronde": tables_data,
        "player_map": p_map
    }

    temp = filename + ".tmp"
    with open(temp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    os.replace(temp, filename)
    print(f"✓ Klasemen dan jadwal diperbarui di {filename}")

# ============================================================
# STATE
# ============================================================

def create_new_state():
    return {
        "version": 2,
        "status": "active",
        "current_round": 1,
        "players": [
            {
                "id": f"P{i + 1:02d}",
                "name": name,
                "points": 0,
                "played": 0,
                "results": []
            }
            for i, name in enumerate(DEFAULT_NAMES)
        ],
        "rounds": {}
    }


def player_map(state):
    return {p["id"]: p for p in state["players"]}


def standings(state):
    # Tie-break resmi belum ditetapkan.
    # Karena itu poin adalah dasar utama; ID dipakai hanya
    # agar urutan konsisten ketika poin sama.
    return sorted(
        state["players"],
        key=lambda p: (-p["points"], p["id"])
    )


# ============================================================
# RIWAYAT LAWAN
# ============================================================

def opponent_history(state):
    history = defaultdict(set)

    for round_data in state["rounds"].values():
        for table in round_data.get("tables", []):
            players = table["players"]
            for i, pid in enumerate(players):
                for j, opponent in enumerate(players):
                    if i != j:
                        history[pid].add(opponent)

    return history


# ============================================================
# PAIRING RONDE 1
# ============================================================

def make_round_one_pairing(state):
    sorted_ids = sorted([p["id"] for p in state["players"]])
    return [
        sorted_ids[i:i + PLAYERS_PER_TABLE]
        for i in range(0, len(sorted_ids), PLAYERS_PER_TABLE)
    ]


# ============================================================
# PAIRING SWISS RONDE 2-3
# ============================================================

def table_quality(table, lookup, history):
    points = [lookup[pid]["points"] for pid in table]
    score_range = max(points) - min(points)

    rematches = 0
    bye_count = 0

    for i in range(len(table)):
        # Hitung jumlah BYE di meja ini
        if "bye" in lookup[table[i]]["name"].lower():
            bye_count += 1

        for j in range(i + 1, len(table)):
            if table[j] in history[table[i]]:
                rematches += 1

    # Denda sangat berat (100.000) jika ada lebih dari 1 BYE di meja yang sama
    bye_penalty = 100000 if bye_count > 1 else 0

    return (score_range * 100) + (rematches * 10) + bye_penalty


def make_swiss_pairing(state):
    players = standings(state)
    lookup = player_map(state)
    history = opponent_history(state)

    best_tables = None
    best_score = float("inf")

    for _ in range(5000):
        groups = defaultdict(list)

        for p in players:
            groups[p["points"]].append(p)

        ordered = []

        for points in sorted(groups.keys(), reverse=True):
            group = groups[points][:]
            random.shuffle(group)
            ordered.extend(group)

        if random.random() < 0.25:
            random.shuffle(ordered)

        tables = [
            [p["id"] for p in ordered[i:i + PLAYERS_PER_TABLE]]
            for i in range(0, len(ordered), PLAYERS_PER_TABLE)
        ]

        if any(len(t) != PLAYERS_PER_TABLE for t in tables):
            continue

        total = sum(
            table_quality(table, lookup, history)
            for table in tables
        )

        if total < best_score:
            best_score = total
            best_tables = tables

    if best_tables is None:
        ids = [p["id"] for p in players]
        best_tables = [
            ids[i:i + PLAYERS_PER_TABLE]
            for i in range(0, len(ids), PLAYERS_PER_TABLE)
        ]

    return best_tables


# ============================================================
# SETUP RONDE
# ============================================================

def setup_round(state, round_number):
    key = str(round_number)

    # Kalau ronde sudah pernah dibuat, JANGAN buat pairing ulang.
    if key in state["rounds"]:
        return

    if round_number == 1:
        tables = make_round_one_pairing(state)
    else:
        tables = make_swiss_pairing(state)

    state["rounds"][key] = {
        "tables": [
            {
                "players": table,
                "result": None,
                "completed": False
            }
            for table in tables
        ]
    }

    state["current_round"] = round_number
    save_state(state)
    export_klasemen_json(state)


# ============================================================
# INPUT HASIL
# ============================================================

def input_result(table_players):
    while True:
        print("Masukkan urutan finish 1-4.")
        print("Contoh:", " ".join(table_players))

        raw = input("> ").strip()
        result = raw.split()

        if len(result) != 4:
            print("Input tidak valid. Harus tepat 4 pemain.")
            continue

        if len(set(result)) != 4:
            print("Input tidak valid. Tidak boleh ada pemain yang sama.")
            continue

        if set(result) != set(table_players):
            print("Input tidak valid. Pemain harus berasal dari meja ini.")
            continue

        return result


def apply_result(state, result):
    lookup = player_map(state)

    for pid, score in zip(result, SCORES):
        lookup[pid]["points"] += score
        lookup[pid]["played"] += 1
        lookup[pid]["results"].append(score)


# ============================================================
# TAMPILAN
# ============================================================

def print_header():
    print("\n" + "=" * 64)
    print("SIMULATOR TURNAMEN KARAMBOL v2")
    print("20 pemain | 3 ronde | 4 pemain/meja | 5 meja/ronde")
    print("Skor: 3-2-1-0")
    print("=" * 64)


def print_round(state, round_number):
    lookup = player_map(state)
    round_data = state["rounds"][str(round_number)]

    print("\n" + "=" * 64)
    print(f"RONDE {round_number}")
    print("=" * 64)

    for i, table in enumerate(round_data["tables"], 1):
        display = " ".join(
            f'{pid}({lookup[pid]["points"]})'
            for pid in table["players"]
        )
        print(f"Meja {i}: {display}")


def print_standings(state):
    print("\n" + "=" * 64)
    print("KLASEMEN")
    print("=" * 64)
    print(
        f"{'Pos':<4} {'Pemain':<20} {'Poin':>5} "
        f"{'Main':>5}  Hasil"
    )
    print("-" * 64)

    for pos, p in enumerate(standings(state), 1):
        results = "-".join(map(str, p["results"])) or "-"
        print(
            f"{pos:<4} {p['name']:<20} {p['points']:>5} "
            f"{p['played']:>5}  {results}"
        )

    print("=" * 64)


def print_top_four(state):
    print("\n" + "=" * 64)
    print("4 BESAR SEMENTARA")
    print("-" * 64)

    for i, p in enumerate(standings(state)[:4], 1):
        print(f"{i}. {p['name']} — {p['points']} poin")

    print("\nCatatan:")
    print("- Pertemuan ulang boleh jika pairing berdasarkan poin membutuhkannya.")
    print("- Tie-break resmi belum ditetapkan.")
    print("- Aturan kecik, hutang, rolet, dan kecik seri tetap menjadi")
    print("  aturan permainan; program ini hanya mengelola hasil/ranking.")
    print("=" * 64)


# ============================================================
# PROSES SATU RONDE
# ============================================================

def round_completed(state, round_number):
    key = str(round_number)

    if key not in state["rounds"]:
        return False

    return all(
        table["completed"]
        for table in state["rounds"][key]["tables"]
    )


def run_round(state, round_number):
    key = str(round_number)
    round_data = state["rounds"][key]

    print_round(state, round_number)

    for table_number, table in enumerate(round_data["tables"], 1):
        # Kalau meja sudah selesai sebelum laptop mati,
        # jangan minta input lagi.
        if table["completed"]:
            continue

        print(f"\nMeja {table_number}: {' '.join(table['players'])}")

        result = input_result(table["players"])

        table["result"] = result
        table["completed"] = True

        apply_result(state, result)

        # SIMPAN LANGSUNG setelah setiap meja.
        save_state(state)
        export_klasemen_json(state)

        print("✓ Hasil tersimpan ke turnamen_karambol.json")

    print_standings(state)


# ============================================================
# TURNAMEN NYATA
# ============================================================

def run_real_tournament():
    state = load_state()

    if state is not None and state.get("status") == "active":
        current = state.get("current_round", 1)

        print("\nDitemukan turnamen yang sedang berjalan.")
        print(f"Ronde aktif/terakhir: {current}")

        choice = input(
            "\n1 = Lanjutkan turnamen\n"
            "2 = Buat turnamen baru\n"
            "Pilih [1/2]: "
        ).strip()

        if choice == "2":
            confirm = input(
                "Yakin membuat turnamen baru dan mengganti save lama? [Y/N]: "
            ).strip().upper()

            if confirm != "Y":
                print("Dibatalkan.")
                return

            state = create_new_state()
            save_state(state)
        else:
            print("Melanjutkan turnamen...")
    else:
        state = create_new_state()
        save_state(state)
        print("\nTurnamen baru dibuat.")

    print_header()

    for round_number in range(1, NUM_ROUNDS + 1):
        state["current_round"] = round_number
        save_state(state)

        # Jika sudah pernah dibuat, pairing tidak berubah.
        setup_round(state, round_number)

        if not round_completed(state, round_number):
            run_round(state, round_number)

        if round_number < NUM_ROUNDS:
            print(f"\nRonde {round_number} selesai.")
            print(f"Ronde {round_number + 1} akan memakai pairing Swiss.")
        else:
            state["status"] = "finished"
            save_state(state)
            export_klasemen_json(state)

    print("\nTURNAMEN 3 RONDE SELESAI.")
    print_top_four(state)


# ============================================================
# SIMULASI OTOMATIS
# ============================================================

def run_auto_simulation():
    state = create_new_state()
    save_state(state)

    print_header()

    for round_number in range(1, NUM_ROUNDS + 1):
        setup_round(state, round_number)
        round_data = state["rounds"][str(round_number)]

        for table in round_data["tables"]:
            if table["completed"]:
                continue

            result = table["players"][:]
            random.shuffle(result)

            table["result"] = result
            table["completed"] = True
            apply_result(state, result)

            save_state(state)

        print_standings(state)

    state["status"] = "finished"
    save_state(state)
    export_klasemen_json(state)

    print("\nSIMULASI SELESAI.")
    print_top_four(state)


# ============================================================
# MAIN
# ============================================================

def main():
    print("\n" + "=" * 64)
    print("SIMULATOR TURNAMEN KARAMBOL v2")
    print("=" * 64)
    print("1 = Input hasil pertandingan nyata")
    print("2 = Simulasi hasil pertandingan otomatis")
    print("3 = Hapus data turnamen / mulai dari nol")
    print("4 = Sync / Refresh Klasemen Web (setelah edit manual)")
    print("=" * 64)

    choice = input("Pilih [1/2/3/4]: ").strip()

    if choice == "1":
        run_real_tournament()

    elif choice == "2":
        existing = load_state()

        if existing is not None and existing.get("status") == "active":
            print("\nAda turnamen nyata yang sedang berjalan.")
            confirm = input(
                "Simulasi akan menggantikan file save tersebut. [Y/N]: "
            ).strip().upper()

            if confirm != "Y":
                print("Dibatalkan.")
                return

        run_auto_simulation()

    elif choice == "3":
        if os.path.exists(SAVE_FILE):
            confirm = input(
                f"Yakin menghapus {SAVE_FILE}? [Y/N]: "
            ).strip().upper()

            if confirm == "Y":
                delete_save()
                print("✓ Data turnamen dihapus.")
            else:
                print("Dibatalkan.")
        else:
            print("Belum ada file turnamen_karambol.json.")

    elif choice == "4":
        sync_klasemen_manual()

    else:
        print("Pilihan tidak valid.")


if __name__ == "__main__":
    main()
