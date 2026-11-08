/* ============================================================
   Axeom Challenge — Data Engine (single source of truth)
   Parses the 8 pack files, resolves client identity, reconciles
   money against the bank, finds lost requests, scores channels.
   Runs in the browser (window.Axeom) and under Node for tests.
   Data "today" per the brief = 2026-10-06.
   ============================================================ */
(function (root) {
  "use strict";

  var TODAY = new Date(2026, 9, 6); // October 6, 2026

  var Axeom = {};
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  /* ---------------- date helpers ---------------- */
  // payments.csv is DD/MM/YYYY (day-first); bookings.csv is MM/DD/YYYY; invoices ISO.
  function dmy(s) { var p = s.split("/"); return new Date(+p[2], +p[1] - 1, +p[0]); }
  function mdy(s) { var p = s.split("/"); return new Date(+p[2], +p[0] - 1, +p[1]); }
  function iso(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmt(d) { return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }
  function daysBetween(a, b) { return Math.round((a - b) / 86400000); }

  /* ---------------- CSV parser (handles quotes, commas, CRLF, BOM) ---------------- */
  function parseCSV(text) {
    var rows = [], row = [], field = "", inQ = false;
    var t = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var i = 0;
    if (t.charCodeAt(0) === 0xFEFF) i = 1;
    while (i < t.length) {
      var c = t[i];
      if (inQ) {
        if (c === '"') {
          if (t[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    row.push(field); rows.push(row);
    while (rows.length && rows[rows.length - 1].join("").trim() === "") rows.pop();
    return rows;
  }
  function toObjects(text) {
    var rows = parseCSV(text);
    if (!rows.length) return [];
    var h = rows[0].map(function (x) { return x.trim(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      h.forEach(function (k, ix) { o[k] = r[ix] !== undefined ? r[ix].trim() : ""; });
      return o;
    });
  }

  /* ---------------- normalizers ---------------- */
  function money(s) { var n = Number(String(s || "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function norm(s) {
    return String(s || "").toLowerCase().replace(/&/g, " and ")
      .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function phone10(s) { var d = digits(s); return d.length > 10 ? d.slice(-10) : d; }
  function emailKey(e) {
    return String(e || "").trim().toLowerCase().replace(/\.con$/, ".com");
  }
  function titleTokens(s) {
    return norm(s).split(" ").filter(function (w) { return w.length > 3; });
  }

  /* ============================================================
     CLIENT IDENTITY
     Known clients merge by email, then by alias.
     An email this pack has never seen becomes its own client
     (so a judge's new file is not dropped on the floor).
     Fieldhouse Marketing is a payer, not a client: it pays for
     Rosewood and Copperline. A row named for one of those
     practices stays with that practice even when the email is
     Fieldhouse's.
     "Oak Cliff Realty" (Lucia) and "Oakcliff Realty Group" (Alan)
     stay separate.
     ============================================================ */
  var CLIENTS = [
    { key: "Brightwater", emails: ["media@brightwaterdfw.org"],
      match: [/brightwater/] },
    { key: "Bold & Brave Podcast", emails: ["megan@boldandbrave.fm", "megan.ramirez.mail@gmail.com"],
      match: [/^bold and brave( podcast)?$/, /^b and b( podcast)?$/, /^megans? ramirez$/] },
    { key: "Evergreen Builders", emails: ["greg@evergreen.build"],
      match: [/evergreen/] },
    { key: "Fischer Dental", emails: ["ivy@fischerdental.com", "ivy@fischerdental.con"],
      match: [/fischer dental/, /^phy fischer$/, /^ivy fischer$/, /^dr\.? fischer$/, /^dr\.? ivy fischer$/] },
    { key: "Metroplex Makers Podcast", emails: ["derek@metroplexmakers.fm"],
      match: [/metroplex/, /^derek cho$/] },
    { key: "Trinity Med Spa", emails: ["renee@trinitymedspa.com", "frisco@trinitymedspa.com"],
      match: [/^trinity/, /trinity med spa/] },
    { key: "Parkside Builders", emails: ["hector@parkside.build"],
      match: [/parkside/] },
    { key: "Hector's Roofing", emails: ["hector@hectorsroofingtx.com"],
      match: [/roofing/, /^hector whitfield$/, /^hector adeyemi$/] },
    { key: "Sage Bridal Boutique", emails: ["rosa@sagebridal.com"],
      match: [/sage bridal/, /^rosa fischer$/] },
    { key: "Glow Wealth Partners", emails: ["awhitfield@glowwp.com"],
      match: [/^glow/, /^alan whitfield$/] },
    { key: "Malik Law Firm", emails: ["hmalik@maliklaw.com"],
      match: [/malik/, /^hector malik$/] },
    { key: "Hillcrest Athletics", emails: ["mia@hillcrestathletics.com", "mia@hillcrestfit.co"],
      match: [/hillcrest/, /^mia romero$/] },
    { key: "Silverleaf Chiropractic", emails: ["drmoore@silverleafchiro.com"],
      match: [/silverleaf/, /^dr\.? moore$/, /^reggie moore$/] },
    { key: "Vista Med Spa", emails: ["rosa@vistamedspa.com"],
      match: [/^vista/, /^rosa castillo$/] },
    { key: "Ridgeway Barbershop", emails: ["ethan@ridgewaybarbers.com"],
      match: [/ridgeway/, /^ethan becker$/] },
    { key: "Oak Cliff Realty", emails: ["lucia@oakcliffrealty.com"],
      match: [/oak cliff/, /^lucia kim$/] },
    { key: "Oakcliff Realty Group", emails: ["alan@oakcliffrg.com"],
      match: [/^oakcliff/, /^alan delgado$/] },
    { key: "Delgado Insurance Group", emails: ["victor@delgadoinsures.com", "grace@delgadoinsures.com"],
      match: [/delgado ins/, /^victor delgado$/] },
    { key: "Kim Dental", emails: ["office@kimdental.com"],
      match: [/kim dental/, /^dana kim$/, /^dr\.? dana kim$/, /^dr\.? kim$/] },
    { key: "Rosewood Pediatrics", emails: ["mzamora@rosewoodpeds.com"],
      match: [/rosewood/] },
    { key: "Copperline Physical Therapy", emails: ["aortiz@copperlineptdallas.com"],
      match: [/copperline/] },
    { key: "Fischer Family Law", emails: ["sfischer@fischerfamilylaw.com"],
      match: [/fischer family law/, /^fischer law$/, /^simone fischer$/] },
    { key: "Fischer's Auto Spa", emails: ["sam@fischersautospa.com"],
      match: [/fischer.?s auto/, /^sam fischer$/] },
    { key: "Cypress Gym", emails: ["jared@cypressgym.co"],
      match: [/cypress/, /^jared lee$/] },
    { key: "The Keystone Lab", emails: ["maria@thekeystonelab.coffee"],
      match: [/keystone/, /^keystonelab/, /^maria( daniels)?$/] },
    { key: "Riverbend Coffee Roasters", emails: ["simone@riverbendcoffee.com"],
      match: [/riverbend/, /^simone chen$/, /^simone$/, /^simone fischer$/] },
    { key: "Bloom Family Therapy", emails: ["hbecker@bloomfamilytherapy.com"],
      match: [/bloom/, /^hannah becker$/] },
    { key: "Brooks Auto Detailing", emails: ["carlos.brooks.detail@gmail.com"],
      match: [/brooks/] },
    { key: "ABC Home Care", emails: ["ivy@abchomecare.com"],
      match: [/abc home/, /^ivy khan$/] }
  ];

  // Agency account: filmed work belongs to the practice, the bill belongs to the payer.
  var PAYERS = [
    { key: "Fieldhouse Marketing", emails: ["ivy@fieldhousemktg.com"],
      match: [/fieldhouse/],
      pays_for: ["Rosewood Pediatrics", "Copperline Physical Therapy"] }
  ];
  var PAYER_ONLY = {};
  PAYERS.forEach(function (p) { PAYER_ONLY[p.key] = p.pays_for; });
  var PAYER_OVERRIDE = {
    "Rosewood Pediatrics": "Fieldhouse Marketing",
    "Copperline Physical Therapy": "Fieldhouse Marketing"
  };
  function payerOf(key) { return PAYER_OVERRIDE[key] || null; }

  // Rebuilt on every computeReport so uploads don't leak into the next run.
  var ident = null;
  function beginIdentity() {
    ident = { byEmail: {}, byName: {}, used: {} };
    CLIENTS.forEach(function (c) { ident.used[c.key] = 1; });
    PAYERS.forEach(function (p) { ident.used[p.key] = 1; });
  }
  function practiceFromName(name) {
    var n = norm(name);
    if (!n) return null;
    if (/rosewood/.test(n)) return "Rosewood Pediatrics";
    if (/copperline/.test(n)) return "Copperline Physical Therapy";
    return null;
  }
  function knownByEmail(email) {
    var ek = emailKey(email);
    if (!ek || ek.indexOf("@") < 0) return null;
    for (var i = 0; i < CLIENTS.length; i++) {
      var es = CLIENTS[i].emails;
      for (var j = 0; j < es.length; j++) if (emailKey(es[j]) === ek) return CLIENTS[i].key;
    }
    return null;
  }
  function knownByName(name) {
    var n = norm(name).replace(/\b(dds|pllc|llc|inc)\b/g, " ").replace(/\s+/g, " ").trim();
    if (!n) return null;
    for (var k = 0; k < CLIENTS.length; k++) {
      var c = CLIENTS[k], rules = c.match;
      for (var m = 0; m < rules.length; m++) {
        var r = rules[m];
        var ok = (typeof r === "string") ? n === r : r.test(n);
        if (!ok) continue;
        if (c.key === "Oakcliff Realty Group" && /\boak cliff\b/.test(n)) continue;
        if (c.key === "Oak Cliff Realty" && /^oakcliff/.test(n)) continue;
        if (c.key === "Malik Law Firm" && /malik tire|karachothekitchen/.test(n)) continue;
        return c.key;
      }
    }
    return null;
  }
  function payerFrom(name, email) {
    var ek = emailKey(email);
    var n = norm(name);
    for (var i = 0; i < PAYERS.length; i++) {
      var p = PAYERS[i];
      if (ek && ek.indexOf("@") > 0) {
        for (var j = 0; j < p.emails.length; j++) if (emailKey(p.emails[j]) === ek) return p.key;
      }
      if (!n) continue;
      // "Fieldhouse - Rosewood" is a practice, already returned above.
      if (/rosewood|copperline/.test(n)) continue;
      for (var m = 0; m < p.match.length; m++) if (p.match[m].test(n)) return p.key;
    }
    return null;
  }
  function claimKey(preferred, email) {
    var key = preferred || email;
    if (ident.used[key]) key = preferred ? (preferred + " · " + email) : email;
    ident.used[key] = 1;
    return key;
  }
  // allowCreate: work rows (bookings, invoices, payments, videos) may open a new client.
  // Leads and messages only attach to a client that already exists.
  function resolveClient(name, email, allowCreate) {
    var practice = practiceFromName(name);
    if (practice) return practice;
    var byMail = knownByEmail(email);
    if (byMail) return byMail;
    var byName = knownByName(name);
    if (byName) return byName;
    var payer = payerFrom(name, email);
    if (payer) return payer;
    if (!ident) return null;
    var ek = emailKey(email);
    var hasEmail = ek.indexOf("@") > 0;
    if (hasEmail && ident.byEmail[ek]) return ident.byEmail[ek].key;
    var nk = norm(name);
    if (!hasEmail && nk && ident.byName[nk]) return ident.byName[nk].key;
    if (!allowCreate) return null;
    if (hasEmail) {
      var key = claimKey(name && String(name).trim(), ek);
      ident.byEmail[ek] = { key: key };
      if (nk) ident.byName[nk] = ident.byEmail[ek];
      return key;
    }
    if (!nk) return null;
    var nameKey = claimKey(String(name).trim(), "");
    ident.byName[nk] = { key: nameKey };
    return nameKey;
  }
  function studioHours(service) {
    var s = String(service || "").toLowerCase();
    if (s.indexOf("content day") >= 0) return 6;
    if (s.indexOf("reels") >= 0) return 3;
    if (s.indexOf("retainer") >= 0) return 4;
    var m = s.match(/(\d+)\s*hr/);
    return m ? +m[1] : 0;
  }

  /* ---------------- spam ---------------- */
  var SPAM_PATTERNS = [
    /insta-verify/, /suspended\.? verify/, /account will be suspended/,
    /domain expires/, /invoice\.zip/, /10x guaranteed/, /rank #1 on google/,
    /free followers/, /crypto opportunity/, /coin-x\.io/, /@a\.co/,
    /rank1seo\.biz/, /fastfollowers\.io/, /acct-dept\.co/
  ];
  function isSpam(sender, text) {
    var s = (sender + " " + text).toLowerCase();
    for (var i = 0; i < SPAM_PATTERNS.length; i++) if (SPAM_PATTERNS[i].test(s)) return true;
    return false;
  }

  /* ============================================================
     MESSAGE PARSING
     [2026-04-09 17:37] WHATSAPP from +1 214-555-0161 (Andre): text
     ============================================================ */
  var EDIT_REQUEST = /(remove|cut|blur|calmer song|music|brand color|phone number|walk-ins welcome|spelled wrong|other shot|captions|outside|stumble|prices|too loud)/i;
  var FRUSTRATION = /(still not fixed|second time i ask|did anyone see|sigue igual|ya les hab|still has the same problem|not happy)/i;

  function parseMessages(text, leads) {
    var out = [];
    var phoneIndex = {};
    (leads || []).forEach(function (l) {
      var p = phone10(l.phone);
      if (p && !phoneIndex[p]) phoneIndex[p] = l;
    });
    var lines = String(text).split("\n");
    lines.forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var first = line.match(/^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\] (.+)$/);
      if (!first) return;
      var date = first[1], body = first[3];
      var second = body.match(/^(WHATSAPP|EMAIL|INSTAGRAM DM|VOICE NOTE|WEBSITE FORM)\s+(to|from)\s+(.+)$/);
      if (!second) return;
      var channel = second[1], dir = second[2], rest = second[3];
      var sender = "", name = "", msg = "", phone = "";
      var email = "", handle = "";
      if (channel === "WHATSAPP" || channel === "VOICE NOTE") {
        var pm = rest.match(/^(\+?\d[\d \-]+)(?: \(([^)]+)\))?[, :]?\s*(.*)$/);
        if (pm) { phone = pm[1]; name = (pm[2] || "").trim(); msg = pm[3].trim(); }
        else msg = rest;
      } else if (channel === "EMAIL") {
        var em = rest.match(/^([\w.\-@]+):\s*([\s\S]*)$/);
        if (em) { email = em[1].trim(); msg = em[2].trim(); }
        else msg = rest;
      } else if (channel === "INSTAGRAM DM") {
        var gm = rest.match(/^(@[\w.]+):\s*([\s\S]*)$/);
        if (gm) { handle = gm[1]; msg = gm[2].trim(); }
        else msg = rest;
      } else { // WEBSITE FORM
        var fm = rest.match(/^([\w.\-@]+) \(([^)]+)\):\s*([\s\S]*)$/);
        if (fm) { email = fm[1].trim(); name = fm[2].trim(); msg = fm[3].trim(); }
        else msg = rest;
      }
      // IG handle -> client (two known handles that are consistent with data)
      var knownHandle = {
        "@fischersautospadfw": "Fischer's Auto Spa",
        "@brooksautodetailin": "Brooks Auto Detailing",
        "@parksidebuildersdfw": "Parkside Builders"
      }[handle] || null;

      var tv = msg.match(/Transcript:\s*([\s\S]*)$/);
      if (tv) msg = tv[1].trim();

      var client = resolveClient(name, email, false);
      var lead = null;
      if (!client && phone) lead = phoneIndex[phone10(phone)] || null;
      if (!client && email) lead = leads.find(function (l) { return emailKey(l.email) === emailKey(email); }) || null;
      if (!client && knownHandle) client = knownHandle;
      if (!client) client = lead ? lead.client : (name ? resolveClient(name, "", false) : null);

      out.push({
        date: date, channel: channel, dir: dir, sender: email || handle || phone,
        email: email, handle: handle, knownHandle: knownHandle,
        name: name || phone, text: msg, phone: phone, lead_id: lead ? lead.lead_id : null,
        client: client, fromOwner: dir === "to",
        spam: isSpam(email + " " + handle + " " + msg, msg),
        isRequest: EDIT_REQUEST.test(msg), frustrated: FRUSTRATION.test(msg)
      });
    });
    return out;
  }

  /* ============================================================
     REPORT
     ============================================================ */
  function relinkMessages(messages, leads) {
    var phoneIndex = {};
    (leads || []).forEach(function (l) {
      var p = phone10(l.phone);
      if (p && !phoneIndex[p]) phoneIndex[p] = l;
    });
    messages.forEach(function (m) {
      var client = resolveClient(m.name, m.email, false);
      var lead = null;
      if (!client && m.phone) lead = phoneIndex[phone10(m.phone)] || null;
      if (!client && m.email) {
        lead = (leads || []).find(function (l) { return emailKey(l.email) === emailKey(m.email); }) || lead;
      }
      if (!client && m.knownHandle) client = m.knownHandle;
      if (!client && lead && lead.client && !PAYER_ONLY[lead.client]) client = lead.client;
      if (!client && m.name) client = resolveClient(m.name, "", false);
      m.client = client;
    });
  }

  function computeReport(dataStrings) {
    beginIdentity();
    var bookings = toObjects(dataStrings.bookings),
        invoices = toObjects(dataStrings.invoices),
        payments = toObjects(dataStrings.payments),
        leadsRows = toObjects(dataStrings.leads),
        videos = toObjects(dataStrings.production_board),
        team = toObjects(dataStrings.team);

    var messages = parseMessages(dataStrings.messages, leadsRows.map(function (l) {
      return { phone: l.phone, email: l.email, lead_id: l.lead_id, client: resolveClient(l.business || l.name, l.email, false) || resolveClient(l.name, l.email, false) };
    }));

    /* ---- normalize rows ---- */
    bookings.forEach(function (b) {
      b.client = resolveClient(b.client_name, b.email, true);
      b.price_n = money(b.price);
      b.date_d = mdy(b.date); b.date_iso = b.date_d.toISOString().slice(0, 10);
      b.completed = b.status === "completed";
    });
    invoices.forEach(function (iv) {
      iv.client = resolveClient(iv.bill_to, iv.email, true);
      iv.amount_n = money(iv.amount);
      iv.issued_d = iso(iv.issued);
      iv.due_d = iv.due ? iso(iv.due) : null;
      iv.paid_total = 0; iv.allocation = [];
    });

    // void duplicates: same client + amount + issued + due as an earlier invoice
    invoices.forEach(function (iv) {
      if (iv.status !== "void") return;
      var twin = invoices.find(function (o) {
        return o !== iv && o.client === iv.client && o.amount_n === iv.amount_n &&
               o.issued === iv.issued && (o.due || "") === (iv.due || "") && o.invoice_no < iv.invoice_no;
      });
      iv.duplicate_of = twin ? twin.invoice_no : null;
    });

    payments.forEach(function (p) {
      p.amount_n = money(p.amount);
      p.date_d = dmy(p.date);
      p.client = resolveClient(p.payer, p.payer_email, true);
      p.refInvoice = /^INV-\d+$/i.test(p.reference || "") ? p.reference.toUpperCase() : null;
      p.allocated = 0; p.overpay = 0; p.note = "";
    });
    videos.forEach(function (v) {
      var viaBooking = !v.shoot_booking ? null :
        (invoices.find(function (iv) { return iv.memo && iv.memo.toUpperCase().indexOf(v.shoot_booking) !== -1; }) || {});
      // Known names first. A new spelling attaches through its shoot before we open a client.
      var byName = resolveClient(v.client, "", false);
      if ((!byName || PAYER_ONLY[byName]) && viaBooking && viaBooking.client && !PAYER_ONLY[viaBooking.client]) byName = viaBooking.client;
      if ((!byName || PAYER_ONLY[byName]) && v.shoot_booking) {
        var bk = bookings.find(function (b) { return b.booking_id === v.shoot_booking; });
        if (bk && bk.client && !PAYER_ONLY[bk.client]) byName = bk.client;
      }
      if (!byName) byName = resolveClient(v.client, "", true);
      v.client = byName;
      v.revisions_n = parseInt(v.revisions, 10) || 0;
      v.hours_n = parseFloat(v.editor_hours) || 0;
      v.notes = norm(v.notes_on_board || "");
    });
    leadsRows.forEach(function (l) {
      l.client = resolveClient(l.business, l.email, false) || resolveClient(l.name, l.email, false);
    });
    relinkMessages(messages, leadsRows);

    // Same memo + amount, only when there are more invoices than shoots that day.
    // Two Hector invoices both say "Reels Pack 9/29" because B154 and B155
    // were both filmed that day — that is not a double bill.
    invoices.forEach(function (iv) {
      if (iv.status === "void" || iv.duplicate_of) return;
      var memo = norm(iv.memo || "");
      if (!memo) return;
      var twins = invoices.filter(function (o) {
        return o.status !== "void" && !o.duplicate_of && o.client === iv.client &&
          Math.abs(o.amount_n - iv.amount_n) < 0.01 && norm(o.memo || "") === memo &&
          Math.abs(o.issued_d - iv.issued_d) <= 14 * 86400000;
      });
      if (twins.length < 2) return;
      var md = String(iv.memo || "").match(/(\d{1,2})\/(\d{1,2})/);
      var shoots = bookings.filter(function (b) {
        if (b.client !== iv.client || !b.completed) return false;
        if (Math.abs(b.price_n - iv.amount_n) > 0.01) return false;
        if (md) return b.date_d.getMonth() + 1 === +md[1] && b.date_d.getDate() === +md[2];
        return Math.abs(b.date_d - iv.issued_d) <= 2 * 86400000;
      });
      if (shoots.length >= twins.length) return;
      var sorted = twins.slice().sort(function (a, b) { return a.invoice_no < b.invoice_no ? -1 : 1; });
      var keep = Math.max(shoots.length, 1);
      for (var ti = keep; ti < sorted.length; ti++) sorted[ti].duplicate_of = sorted[0].invoice_no;
    });

    // Invoices addressed to a payer get moved onto the practice they actually filmed.
    (function assignAgencyInvoices() {
      var used = {};
      function take(iv, bk, payer) {
        if (!bk || !bk.client || PAYER_ONLY[bk.client]) return false;
        iv.billed_via = payer;
        iv.client = bk.client;
        used[bk.booking_id] = iv.invoice_no;
        return true;
      }
      invoices.forEach(function (iv) {
        if (!PAYER_ONLY[iv.client]) return;
        var payer = iv.client;
        var pays = PAYER_ONLY[payer];
        var bid = (String(iv.memo || "").toUpperCase().match(/B\d+/) || [])[0];
        if (bid) {
          var byId = bookings.find(function (b) { return b.booking_id === bid; });
          if (take(iv, byId, payer)) return;
        }
        var md = String(iv.memo || "").match(/(\d{1,2})\/(\d{1,2})/);
        var candidates = bookings.filter(function (b) {
          return !used[b.booking_id] && pays.indexOf(b.client) >= 0 && Math.abs(b.price_n - iv.amount_n) < 0.01;
        });
        var bk = null;
        if (md) {
          var month = +md[1], day = +md[2];
          bk = candidates.find(function (b) {
            return b.date_d.getMonth() + 1 === month && b.date_d.getDate() === day;
          });
        }
        if (!bk) {
          bk = candidates.filter(function (b) {
            return Math.abs(b.date_d - iv.issued_d) <= 3 * 86400000;
          }).sort(function (a, b) {
            return Math.abs(a.date_d - iv.issued_d) - Math.abs(b.date_d - iv.issued_d);
          })[0];
        }
        take(iv, bk, payer);
      });
    })();

    /* ================= MONEY ================= */
    function invoiceByNo(no) {
      return invoices.find(function (iv) { return iv.invoice_no.toUpperCase() === no; });
    }
    // Pass 1: payments that reference a specific invoice
    payments.forEach(function (p) {
      if (!p.refInvoice) return;
      var iv = invoiceByNo(p.refInvoice);
      if (!iv) { p.note = "payment references an invoice number that does not exist"; return; }
      var room = Math.max(0, iv.amount_n - iv.paid_total);
      var need = p.amount_n;
      var use = Math.min(room, need);
      iv.paid_total += use; iv.allocation.push(p.payment_id); p.allocated += use;
      p.overpay = need - use;
      if (p.overpay > 0) p.note = "duplicate payment: extra $" + p.overpay + " beyond what " + iv.invoice_no + " was for";
    });

    // Pass 2: blank-referenced payments, oldest issued unpaid invoice, partial allocations allowed
    var blanks = payments.filter(function (p) { return !p.refInvoice; })
      .sort(function (a, b) { return a.date_d - b.date_d; });
    blanks.forEach(function (p) {
      var remaining = p.amount_n;
      var guard = 0;
      while (remaining > 0.01 && guard++ < 50) {
        var pool = invoices.filter(function (iv) {
          if (iv.paid_total >= iv.amount_n - 0.01 || iv.status === "void" || iv.duplicate_of) return false;
          if (iv.issued_d.getTime() > p.date_d.getTime() + 3 * 86400000) return false;
          if (iv.issued_d.getTime() < p.date_d.getTime() - 170 * 86400000) return false;
          if (PAYER_ONLY[p.client]) return iv.billed_via === p.client;
          return iv.client === p.client;
        }).sort(function (a, b) { return a.issued_d - b.issued_d; });
        if (!pool.length) break;
        var exact = pool.find(function (iv) { return Math.abs(iv.amount_n - iv.paid_total - remaining) < 0.01; });
        var cand = exact || pool[0];
        var use = Math.min(cand.amount_n - cand.paid_total, remaining);
        cand.paid_total += use; cand.allocation.push(p.payment_id); p.allocated += use; remaining -= use;
      }
      if (remaining > 0.01) {
        p.overpay = remaining;
        p.note = "money arrived but could not be matched to any open invoice for this client (" + (p.payer) + ", " + p.date + ")";
      }
    });

    var overdue = [], weOwe = [], toolWrong = [];
    invoices.forEach(function (iv) {
      var owed = Math.max(0, iv.amount_n - iv.paid_total);
      var late = iv.due_d ? (iv.due_d.getTime() < TODAY.getTime()) : false;

      if (iv.duplicate_of && iv.status !== "void") {
        toolWrong.push({
          invoice: iv.invoice_no,
          tool_says: "a second unpaid invoice for the same shoot as " + iv.duplicate_of,
          truth: "the same shoot was billed twice — only one $" + iv.amount_n + " debt is real",
          how_you_know: "Memo \"" + (iv.memo || "") + "\" is the same as " + iv.duplicate_of + " for " + (iv.bill_to || iv.client) + ", both $" + iv.amount_n + ", issued within two weeks. Void one of them."
        });
        return;
      }

      if (iv.status === "void") {
        toolWrong.push({
          invoice: iv.invoice_no, tool_says: "void invoice still in the ledger",
          truth: iv.duplicate_of ? ("duplicate of " + iv.duplicate_of + " — already paid under the original invoice; exclude from any totals")
                                 : "void duplicate; exclude from totals",
          how_you_know: iv.duplicate_of
            ? ("Same client (" + iv.bill_to + "), same amount $" + iv.amount_n + ", same issued/due dates as " + iv.duplicate_of + " which is marked paid. The billing tool generated a second number for one real invoice.")
            : "Marked void by the tool itself; appears as a normal bill in the ledger."
        });
        return;
      }

      if (owed > 0.01 && late && iv.status !== "paid") {
        overdue.push({
          client: iv.client, invoice: iv.invoice_no, amount_owed: iv.amount_n - iv.paid_total,
          days_late: daysBetween(TODAY, iv.due_d),
          note: iv.allocation.length ? ("part-paid by payment " + iv.allocation.join(", ")) : "no payment on record"
        });
      }
      if (owed > 0.01 && late && iv.status === "paid") {
        overdue.push({
          client: iv.client, invoice: iv.invoice_no, amount_owed: iv.amount_n - iv.paid_total,
          days_late: daysBetween(TODAY, iv.due_d),
          note: "billing tool says PAID but no payment ever arrived"
        });
      }

      if (iv.paid_total > iv.amount_n + 0.01) {
        weOwe.push({
          client: iv.client, invoice: iv.invoice_no, amount: iv.paid_total - iv.amount_n,
          why: "Client overpaid " + iv.invoice_no + ". Payments into it: " + iv.allocation.join(", ") + ". Needs a refund of the extra."
        });
      }

      if (iv.paid_total > 0.01 && iv.status === "unpaid") {
        var payIds = iv.allocation.join(", ");
        toolWrong.push({
          invoice: iv.invoice_no, tool_says: "unpaid", truth: "really paid — money is in the bank",
          how_you_know: "Payment" + (iv.allocation.length > 1 ? "s" : "") + " " + payIds + " clear this invoice exactly; the tool never flipped its status."
        });
      }
      if (iv.paid_total < 0.01 && iv.status === "paid" && late) {
        toolWrong.push({
          invoice: iv.invoice_no, tool_says: "paid", truth: "no matching payment — the money never came in",
          how_you_know: "The payments file has no payment (by reference, or by client-email + amount + date) that clears this invoice, yet it is marked paid. It is really " + daysBetween(TODAY, iv.due_d) + " days overdue."
        });
      }
    });

    // payment-level overpay (duplicate payments that attached to already-full invoices)
    payments.forEach(function (p) {
      if (p.overpay > 0.01 && p.client) {
        var already = weOwe.some(function (w) { return w._pid === p.payment_id; });
        if (!already) {
          weOwe.push({
            client: p.client, invoice: p.refInvoice || "—", amount: p.overpay, _pid: p.payment_id,
            why: "Payment " + p.payment_id + " (" + p.date + ") " + (p.note || "could not be matched to an open invoice") + ". Refund or ask the owner how to credit it."
          });
        }
      }
    });

    // A retainer billed below the client's own usual monthly amount.
    (function retainerGaps() {
      var groups = {};
      invoices.forEach(function (iv) {
        if (iv.status === "void" || iv.duplicate_of) return;
        if (!/retainer/i.test(iv.memo || "")) return;
        if (!iv.client || PAYER_ONLY[iv.client]) return;
        (groups[iv.client] = groups[iv.client] || []).push(iv);
      });
      Object.keys(groups).forEach(function (k) {
        var list = groups[k];
        if (list.length < 4) return;
        var counts = {};
        list.forEach(function (iv) { counts[iv.amount_n] = (counts[iv.amount_n] || 0) + 1; });
        var modal = 0, modalN = 0;
        Object.keys(counts).forEach(function (a) {
          if (counts[a] > modalN) { modalN = counts[a]; modal = +a; }
        });
        if (modalN < 3) return;
        list.forEach(function (iv) {
          if (iv.amount_n > modal - 0.01) return;
          var gap = Math.round((modal - iv.amount_n) * 100) / 100;
          toolWrong.push({
            invoice: iv.invoice_no,
            tool_says: "paid in full at $" + iv.amount_n,
            truth: "under-billed by $" + gap + " versus the usual $" + modal + " monthly retainer",
            how_you_know: modalN + " other monthly retainer invoices for " + (iv.bill_to || k) + " are $" + modal + ". " + iv.invoice_no + " (" + (iv.memo || "retainer") + ", issued " + iv.issued + ") is $" + iv.amount_n + "."
          });
        });
      });
    })();

    /* ---- never billed: completed, price>0, no matching invoice (memo first, then email+amount+date) ---- */
    var neverBilled = [], neverBilledTotal = 0, usedInv = {};
    var completedBookings = bookings.filter(function (b) { return b.completed && b.price_n > 0; })
      .sort(function (a, b) { return a.date_d - b.date_d; });
    completedBookings.forEach(function (b) {
      var match = invoices.find(function (iv) {
        if (!iv.client || (iv.client !== b.client && iv.client !== payerOf(b.client))) return false;
        if (usedInv[iv.invoice_no]) return false;
        if (iv.status === "void" || iv.duplicate_of) return false;
        if (iv.memo && iv.memo.toUpperCase().indexOf(b.booking_id) !== -1) return true;
        if (Math.abs(iv.amount_n - b.price_n) > 0.01) return false;
        var dist = iv.issued_d - b.date_d;
        return dist >= -10 * 86400000 && dist <= 45 * 86400000;
      });
      if (match) { usedInv[match.invoice_no] = 1; b.matched_invoice = match.invoice_no; }
      else {
        neverBilled.push({ client: b.client, invoice: "—",
          booking_id_or_month: b.booking_id + " (" + fmt(b.date_d) + ", " + b.service + ")",
          amount: b.price_n,
          amount_owed: b.price_n,
          why: "Booking " + b.booking_id + " (" + fmt(b.date_d) + ", " + b.service + ", $" + b.price_n + ") completed but no invoice was ever issued for it." });
        neverBilledTotal += b.price_n;
      }
    });

    /* ================= PRODUCTION / COSTS ================= */
    var rates = {};
    team.forEach(function (t) { if (t.pay) rates[t.name] = money(t.pay.replace("/hour", "")); });
    var editorHours = {}, editorCost = {};
    videos.forEach(function (v) {
      if (!v.editor) return;
      editorHours[v.editor] = (editorHours[v.editor] || 0) + v.hours_n;
      editorCost[v.editor] = (editorCost[v.editor] || 0) + v.hours_n * (rates[v.editor] || 0);
    });

    /* ================= LEADS & CHANNELS ================= */
    // Cash collected is what landed on the client's invoices. Profit subtracts
    // studio time ($40/h from costs.csv) and editor time (team.csv × board hours).
    var revenueByClient = {};
    invoices.forEach(function (iv) {
      if (!iv.client || PAYER_ONLY[iv.client] || iv.status === "void" || iv.duplicate_of) return;
      revenueByClient[iv.client] = (revenueByClient[iv.client] || 0) + iv.paid_total;
    });
    var costByClient = {};
    bookings.forEach(function (b) {
      if (!b.completed || !b.client || PAYER_ONLY[b.client]) return;
      costByClient[b.client] = (costByClient[b.client] || 0) + studioHours(b.service) * 40;
    });
    videos.forEach(function (v) {
      if (!v.client || PAYER_ONLY[v.client] || !v.editor) return;
      costByClient[v.client] = (costByClient[v.client] || 0) + v.hours_n * (rates[v.editor] || 0);
    });
    var channelRevenue = {}, channelCost = {}, channelWon = {}, channelLeads = {}, channelLost = {};
    leadsRows.forEach(function (l) {
      channelLeads[l.source] = (channelLeads[l.source] || 0) + 1;
      if (l.status === "Lost") channelLost[l.source] = (channelLost[l.source] || 0) + 1;
    });
    leadsRows.forEach(function (l) {
      if (l.status !== "Won" || !l.client) return;
      var firstWon = leadsRows.find(function (o) { return o.client === l.client && o.status === "Won"; });
      if (firstWon && firstWon.lead_id !== l.lead_id) return;
      channelWon[l.source] = (channelWon[l.source] || 0) + 1;
      if (PAYER_ONLY[l.client]) return;
      channelRevenue[l.source] = (channelRevenue[l.source] || 0) + (revenueByClient[l.client] || 0);
      channelCost[l.source] = (channelCost[l.source] || 0) + (costByClient[l.client] || 0);
    });
    var channels = Object.keys(channelLeads).map(function (s) {
      var rev = channelRevenue[s] || 0, cost = channelCost[s] || 0;
      return { source: s, revenue: Math.round(rev), cost: Math.round(cost), profit: Math.round(rev - cost),
               won: channelWon[s] || 0, leads: channelLeads[s] || 0, lost: channelLost[s] || 0,
               win_rate: Math.round((channelWon[s] || 0) / (channelLeads[s] || 1) * 100) };
    }).sort(function (a, b) { return b.profit - a.profit || b.revenue - a.revenue; });

    var neverReplied = leadsRows.filter(function (l) {
      return l.status === "New" && !l.first_reply && !isSpam(l.email + " " + l.name + " " + (l.business || ""), "");
    }).map(function (l) { return l.lead_id; });
    var spamLeads = leadsRows.filter(function (l) {
      return isSpam(l.email + " " + l.name + " " + (l.business || ""), "");
    }).map(function (l) { return l.lead_id; });

    /* ================= LOST REQUESTS ================= */
    var videoIndex = {};
    videos.forEach(function (v) {
      titleTokens(v.title).forEach(function (t) { (videoIndex[t] = videoIndex[t] || []).push(v); });
    });
    function findVideo(clientKey, text) {
      var words = titleTokens(text);
      var best = null, bestScore = 0;
      videos.forEach(function (v) {
        if (!v.client || v.client !== clientKey) return;
        var score = 0;
        words.forEach(function (w) { if (titleTokens(v.title).indexOf(w) !== -1) score += 2; });
        if (score > bestScore) { bestScore = score; best = v; }
      });
      return bestScore >= 2 ? best : null;
    }
    var mEsc = messages.filter(function (m) { return m.frustrated && !m.spam && !m.fromOwner; });
    function threadOf(m) { return m.client + "|" + (m.videoId || norm(m.text).slice(0, 40)); }
    var escalByMonth = {}, monthsOrder = [];
    var seenThreads = {};
    var lostRequests = [];
    mEsc.forEach(function (m) {
      if (!m.client) return;
      var v = findVideo(m.client, m.text) || {};
      m.videoId = v.video_id || "";
      m.thread = threadOf(m);
      var mo = m.date.slice(0, 7);
      if (!escalByMonth[mo]) { escalByMonth[mo] = 0; monthsOrder.push(mo); }
      escalByMonth[mo]++;
      if (seenThreads[m.thread]) {
        var t = seenThreads[m.thread];
        if (m.date < t.first_request) { t.first_request = m.date; t.came_by = m.channel; t.video_id = m.videoId; }
        return;
      }
      var firstDate = m.date, firstCh = m.channel, firstVid = m.videoId;
      messages.forEach(function (o) {
        if (o.client !== m.client || o.date > m.date || o.spam || o.fromOwner) return;
        if (!o.isRequest) return;
        if (o.date === m.date && o.text === m.text) return;
        var ov = findVideo(m.client, o.text) || {};
        var sameVideo = (ov.video_id && ov.video_id === m.videoId) || (!ov.video_id && !m.videoId);
        var vague = /the one we shot last week|last week's|this|it/i.test(o.text) && o.text.length < 90;
        if ((sameVideo || vague) && o.date < firstDate) { firstDate = o.date; firstCh = o.channel; }
        if (sameVideo && ov.video_id && !firstVid) firstVid = ov.video_id;
      });
      var cameBy = firstCh === "WHATSAPP" ? "whatsapp" : firstCh === "VOICE NOTE" ? "voice note" :
                   firstCh === "INSTAGRAM DM" ? "instagram" : firstCh === "WEBSITE FORM" ? "website form" : "email";
      var row = {
        video_id: firstVid, request_date: firstDate, came_by: cameBy,
        client: m.client, escalation_date: m.date, booking_id: v.shoot_booking || "",
        why_it_was_lost: [
          "First request came in on " + firstDate + " via " + cameBy,
          (firstVid ? "on video " + firstVid : "but video couldn't be pinned by name in the thread"),
          "never made it onto the production board",
          "client had to escalate on " + m.date + ": \u201C" + m.text.slice(0, 80) + (m.text.length > 80 ? "…" : "") + "\u201D"
        ].join(" ")
      };
      lostRequests.push(row);
      seenThreads[m.thread] = row;
    });

    // first month where a month's escalations exceed every earlier month combined
    var startedWorse = null, cum = 0;
    monthsOrder.sort().forEach(function (mo) {
      if (!startedWorse && cum >= 2 && escalByMonth[mo] > cum) startedWorse = mo;
      cum += escalByMonth[mo];
    });

    var lostRootCauses = [
      "Client requests arrive on " + Object.keys(messages.reduce(function (acc, m) {
        if (!m.spam && !m.fromOwner) acc[m.channel] = 1; return acc; }, {})).length +
        " channels (email, WhatsApp, Instagram DM, voice note, website form) and there is no single inbox that catches them all.",
      "Messages are not linked to a production-board row: most videos have empty notes_on_board even for clients who asked several times.",
      "Vague references like 'the one we shot last week' or 'this video' are never resolved to a video_id.",
      "Voice notes and Instagram DMs are invisible to the editors on the board.",
      "Wrong-language requests (Spanish messages that were never translated) were treated as done when nobody read them.",
      "There is no closed-loop confirmation: the owner never tells the client 'this fix is done', so silence hides the same broken video for weeks."
    ];

    /* ================= CLIENT TABLE ================= */
    var perClient = {};
    function row(k) {
      return perClient[k] = perClient[k] || {
        key: k, bookings: [], invoices: [], payments: [], videos: [], names: {}, emails: {}
      };
    }
    var CHURN_RE = /whether we continue|talk about (?:our|the) contract|we(?:'|’)ll pause|pause after this month/i;
    function remember(k) { return (k && !PAYER_ONLY[k]) ? row(k) : null; }
    bookings.forEach(function (b) {
      var r = remember(b.client);
      if (r) { r.bookings.push(b); r.names[norm(b.client_name)] = b.client_name; if (b.email) r.emails[emailKey(b.email)] = b.email; }
    });
    invoices.forEach(function (iv) {
      var r = remember(iv.client);
      if (r) { r.invoices.push(iv); r.names[norm(iv.bill_to)] = iv.bill_to; if (iv.email) r.emails[emailKey(iv.email)] = iv.email; }
    });
    payments.forEach(function (p) {
      var r = remember(p.client);
      if (r) { r.payments.push(p); r.names[norm(p.payer)] = p.payer; }
    });
    videos.forEach(function (v) { var r = remember(v.client); if (r) r.videos.push(v); });

    var clientlist = Object.keys(perClient).sort().map(function (k) {
      if (PAYER_ONLY[k]) return null;
      var r = perClient[k];
      var liveInv = r.invoices.filter(function (iv) { return iv.status !== "void" && !iv.duplicate_of; });
      var owed = liveInv.reduce(function (s, iv) { return s + Math.max(0, iv.amount_n - iv.paid_total); }, 0);
      var esc = mEsc.filter(function (m) { return m.client === k; }).length;
      var lost = lostRequests.filter(function (x) { return x.client === k; }).length;
      var unpaid = liveInv.filter(function (iv) { return Math.abs(iv.amount_n - iv.paid_total) > 0.01; }).length;
      var lastB = r.bookings.reduce(function (a, b) { return b.date_d > a ? b.date_d : a; }, new Date(1990, 0, 1));
      var late = liveInv.filter(function (iv) {
        return iv.due_d && iv.due_d < TODAY && iv.amount_n - iv.paid_total > 0.01;
      }).length;
      var churnScore = 0, churnQuotes = [];
      messages.forEach(function (m) {
        if (m.client !== k || m.spam || m.fromOwner || !CHURN_RE.test(m.text || "")) return;
        var age = daysBetween(TODAY, iso(m.date));
        if (age < 0) return;
        churnScore += Math.max(1, 120 - age);
        churnQuotes.push(m);
      });
      churnQuotes.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      var health = "wanted";
      if (churnScore >= 80) health = "at risk";
      else if (late > 0 && (esc >= 2 || lost > 0)) health = "at risk";
      else if (late > 0) health = "chasing";
      else if (esc > 0 || lost > 0) health = "warning";
      return {
        key: k, name: k,
        payer: payerOf(k),
        revenue: Math.round(revenueByClient[k] || 0),
        cost: Math.round(costByClient[k] || 0),
        profit: Math.round((revenueByClient[k] || 0) - (costByClient[k] || 0)),
        overdue: owed, late_invoices: late,
        unpaid_invoices: unpaid,
        bookings: r.bookings.length, videos: r.videos.length,
        escalations: esc, lost_requests: lost,
        churn_score: churnScore, churn_quotes: churnQuotes,
        last_booking: fmt(lastB),
        health: health
      };
    }).filter(Boolean);
    clientlist.sort(function (a, b) { return a.key.localeCompare(b.key); });

    var leave = null;
    clientlist.forEach(function (c) {
      if (c.churn_score > 0 && (!leave || c.churn_score > leave.churn_score ||
          (c.churn_score === leave.churn_score && c.overdue > leave.overdue))) leave = c;
    });
    var mostLikely = null;
    if (leave) {
      var q = leave.churn_quotes[0];
      mostLikely = {
        client: leave.key,
        score: leave.churn_score,
        why: q ? ("They wrote on " + q.date + ": \u201C" + q.text.slice(0, 160) + (q.text.length > 160 ? "…" : "") + "\u201D") : "They wrote about ending the relationship.",
        proof: leave.churn_quotes.map(function (m) { return m.date + " " + m.channel; }).join(" · ")
      };
    }

    var msgChannelCounts = {};
    messages.forEach(function (m) { if (!m.spam) msgChannelCounts[m.channel] = (msgChannelCounts[m.channel] || 0) + 1; });

    return {
      today: fmt(TODAY),
      counts: {
        clients_total: clientlist.length,
        bookings_total: bookings.length,
        bookings_cancelled: bookings.filter(function (b) { return !b.completed; }).length,
        invoices_total: invoices.length,
        payments_total: payments.length,
        leads_total: leadsRows.length,
        videos_total: videos.length,
        messages_total: messages.length
      },
      overdue_list: overdue.sort(function (a, b) { return b.days_late - a.days_late || b.amount_owed - a.amount_owed; }),
      overdue_total: overdue.reduce(function (s, o) { return s + o.amount_owed; }, 0),
      we_owe: weOwe.map(function (w) { return { client: w.client, invoice: w.invoice, amount: w.amount, why: w.why, _pid: w._pid || (w.invoice + "|" + w.client) }; }),
      we_owe_total: weOwe.reduce(function (s, w) { return s + w.amount; }, 0),
      never_billed: neverBilled,
      never_billed_total: neverBilledTotal,
      billing_tool_is_wrong: toolWrong,
      lost_requests: lostRequests,
      escalation_months: escalByMonth,
      lost_requests_root_causes: lostRootCauses,
      lost_requests_started_getting_worse_in: startedWorse,
      never_replied_leads: neverReplied,
      spam_leads: spamLeads,
      most_likely_to_leave: mostLikely,
      payers_who_are_not_clients: PAYERS.map(function (p) { return { name: p.key, pays_for: p.pays_for }; }),
      channels: channels,
      clients: clientlist,
      bookings: bookings, invoices: invoices, payments: payments,
      leads: leadsRows, videos: videos,
      messages: messages,
      msg_channel_counts: msgChannelCounts,
      editor_hours: editorHours, editor_monthly_cost: editorCost, team: team,
      editor_rates: rates
    };
  }

  Axeom.computeReport = computeReport;
  Axeom.resolveClient = resolveClient;
  Axeom.parseMessages = parseMessages;
  Axeom.TODAY = TODAY;
  root.Axeom = Axeom;
})(typeof window !== "undefined" ? window : globalThis);
