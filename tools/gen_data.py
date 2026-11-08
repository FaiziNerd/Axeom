# Generates app/js/data.js — embeds the raw data files as JS template-literal strings
# so the app parses them locally (works over file:// AND hosted), and makes the
# "Add new files" flow a simple in-memory string swap.
import os

SRC = r"D:\Internship\data"
OUT = r"D:\Internship\app\js\data.js"
FILES = ["bookings.csv", "invoices.csv", "payments.csv", "leads.csv",
         "production_board.csv", "messages.txt", "team.csv", "costs.csv"]

parts = [
    "// AUTO-GENERATED from data/. Embedded source data so the app runs anywhere.",
    "// File contents kept verbatim; 'Add new files' replaces entries in memory.",
    "window.AXEOM_DATA = {};",
]
for f in FILES:
    with open(os.path.join(SRC, f), "r", encoding="utf-8-sig") as fh:
        txt = fh.read()
    # escape for JS template literal
    esc = txt.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
    key = f.replace(".csv", "").replace(".txt", "")  # engine keys are extension-less
    parts.append(f"window.AXEOM_DATA[{key!r}] = `{esc}`;")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
    fh.write("\n".join(parts) + "\n")
print("written", OUT, os.path.getsize(OUT), "bytes")
