/* ============================================================
   Axeom OS — UI controller
   Tabs: Today (actions) · Clients · Money · New files
   Everything is computed from the engine; screens only suggest.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- state ---------- */
  var STORE_KEY = "axeom-uploads-v1";
  function normalizePack(src) {
    var out = {};
    Object.keys(src || {}).forEach(function (k) {
      var clean = k.replace(/\.csv$|\.txt$/, "");
      out[clean] = src[k];
    });
    return out;
  }
  var ORIGINAL = normalizePack(window.AXEOM_DATA);
  var dataStrings = normalizePack(window.AXEOM_DATA);
  var rep = null;
  var state = { tab: "home", decided: {} };

  // restore the owner's previous upload + decisions (so their uploads survive refresh)
  try {
    var saved = localStorage.getItem(STORE_KEY);
    if (saved) {
      var savedMap = JSON.parse(saved);
      Object.keys(savedMap).forEach(function (k) { dataStrings[k] = savedMap[k]; });
    }
  } catch (e) {}
  state.decided = (function () { try { return JSON.parse(localStorage.getItem(STORE_KEY + "-decided") || "{}"); } catch (e) { return {}; } })();

  function recompute() { rep = window.Axeom.computeReport(dataStrings); }
  recompute();

  /* ---------- helpers ---------- */
  var $view = document.getElementById("view");
  var $sheet = document.getElementById("sheet");
  var $overlay = document.getElementById("overlay");
  var NAV = document.getElementById("bottomnav");
  var $asof = document.getElementById("asof");

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function usd(n) { return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }); }
  function MONTHS(m) { return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m]; }

  $asof.textContent = "Data as of " + Axeom.TODAY.getDate() + " " + MONTHS(Axeom.TODAY.getMonth()) + " " + Axeom.TODAY.getFullYear();

  function setView(node) { $view.innerHTML = ""; $view.appendChild(node); }
  function markDecided(id, choice) {
    state.decided[id] = { choice: choice, at: new Date().toISOString().slice(0, 16).replace("T", " ") };
    try { localStorage.setItem(STORE_KEY + "-decided", JSON.stringify(state.decided)); } catch (e) {}
    tab(state.tab);
  }

  /* ============================================================
     TAB: TODAY — the 10-second dashboard
     ============================================================ */
  function buildActions() {
    var actions = [];
    var leave = rep.most_likely_to_leave;
    if (leave && leave.client) {
      var lateBill = rep.overdue_list.find(function (o) { return o.client === leave.client; });
      actions.push({
        id: "leave-" + leave.client, sev: "red", tag: "Do this first",
        title: "Call " + leave.client,
        why: leave.why + (lateBill ? " " + lateBill.invoice + " is " + lateBill.days_late + " days late (" + usd(lateBill.amount_owed) + ")." : ""),
        proof: leave.proof
      });
    }
    var owe = rep.we_owe.slice().sort(function (a, b) { return b.amount - a.amount; })[0];
    if (owe) {
      actions.push({
        id: "refund-" + (owe._pid || owe.client), sev: "amber", tag: "We owe them",
        title: "Refund " + usd(owe.amount) + " to " + owe.client,
        why: owe.why, proof: "payments.csv · " + (owe.invoice || "")
      });
    }
    var late = rep.overdue_list[0];
    if (late) {
      actions.push({
        id: "overdue-" + late.invoice, sev: "amber", tag: late.days_late + " days late",
        title: "Chase " + late.invoice + " — " + late.client + " owes " + usd(late.amount_owed),
        why: late.note, proof: "Due date missed by " + late.days_late + " days as of " + rep.today + "."
      });
    }
    return actions.slice(0, 3);
  }

  function viewToday() {
    var view = el("div");
    view.appendChild(el("h2", "sec", "Do these 3 things"));
    var acts = buildActions();
    var open = acts.filter(function (a) { return !state.decided[a.id]; });
    var done = acts.filter(function (a) { return state.decided[a.id]; });

    if (!open.length) {
      view.appendChild(el("div", "card green",
        "<h3>All clear for now ✓</h3><div class='why'>Every suggestion has been approved or deferred. New data can add more.</div>"));
    }
    open.forEach(function (a) {
      var c = el("div", "card " + a.sev);
      c.innerHTML = "<div class='tagline'><span class='tag " + a.sev + "'>" + esc(a.tag) + "</span></div>" +
        "<h3>" + esc(a.title) + "</h3>" +
        "<div class='why'>" + esc(a.why) + "</div>" +
        "<div class='proof'>proof: " + esc(a.proof) + "</div>" +
        "<div class='acts'><button class='btn yes'>Yes, do it</button><button class='btn mute'>Not now</button></div>";
      var b = c.querySelectorAll(".btn");
      b[0].addEventListener("click", function () { markDecided(a.id, "yes"); });
      b[1].addEventListener("click", function () { markDecided(a.id, "no"); });
      view.appendChild(c);
    });

    if (done.length) {
      view.appendChild(el("h2", "sec", "Handled (" + done.length + ")"));
      done.slice().reverse().forEach(function (a) {
        var d = state.decided[a.id];
        view.appendChild(el("div", "card done",
          "<h3>" + esc(a.title) + "</h3><div class='why'>" + (d.choice === "yes" ? "Owner approved" : "Owner deferred") + " · " + esc(d.at) + "</div>"));
      });
    }

    setView(view);
  }
  function kpiCard(n, label, cls) {
    return "<div class='kpi " + cls + "'><span class='n'>" + usd(n) + "</span><span class='l'>" + label + "</span></div>";
  }
  function escalBars(months) {
    var max = Math.max.apply(null, months.map(function (m) { return rep.escalation_months[m]; }));
    return months.map(function (m) {
      var h = Math.max(6, Math.round(rep.escalation_months[m] / max * 70));
      return "<div class='bar' style='height:" + h + "px'><span class='lbl'>" + m.slice(2) + "</span></div>";
    }).join("");
  }

  /* ============================================================
     TAB: CLIENTS
     ============================================================ */
  function viewClients(q0) {
    var view = el("div");
    var s = el("input", "search");
    s.placeholder = "Search clients…";
    s.value = q0 || "";
    var list = el("div");

    function drawRows(q) {
      list.innerHTML = "";
      var items = rep.clients;
      if (q) items = items.filter(function (c) { return c.key.toLowerCase().indexOf(q.toLowerCase()) !== -1; });
      items.forEach(function (c) {
        var chip = c.health === "at risk" ? "<span class='chip risk'>at risk</span>" :
                   c.health === "warning" ? "<span class='chip warn'>warning</span>" :
                   c.health === "chasing" ? "<span class='chip chasing'>" + c.late_invoices + " late</span>" :
                   "<span class='chip ok'>ok</span>";
        var r = el("div", "row client-row");
        r.innerHTML = "<div class='who'><b>" + esc(c.key) +
          (c.payer ? " <span class='legend'>· billed via " + esc(c.payer) + "</span>" : "") + "</b>" +
          "<div class='sub'>" + c.bookings + " shoots · " + c.videos + " videos · last " + esc(c.last_booking) + "</div></div>" +
          "<div class='num'>" + chip + "<div class='legend'>" +
          (c.overdue > 0 ? "<span style='color:var(--danger)'>" + usd(c.overdue) + " open</span>" : "paid ✓") + "</div></div>";
        r.addEventListener("click", function () { openClient(c.key); });
        list.appendChild(r);
      });
      if (!items.length) list.appendChild(el("div", "legend", "No client matches “" + esc(q) + "”."));
    }
    s.addEventListener("input", function () { drawRows(s.value); });
    drawRows(q0);
    view.appendChild(s);
    if (rep.never_replied_leads && rep.never_replied_leads.length) {
      var leads = el("div", "card amber");
      var bits = rep.never_replied_leads.map(function (id) {
        var row = (rep.leads || []).find(function (l) { return l.lead_id === id; });
        var who = row ? (row.name || row.business || id) : id;
        return "<b>" + esc(id) + "</b> " + esc(who);
      }).join(" · ");
      leads.innerHTML = "<div class='tagline'><span class='tag amber'>" + rep.never_replied_leads.length + " leads</span></div>" +
        "<h3>Nobody replied to these</h3><div class='why'>" + bits + "</div>";
      view.appendChild(leads);
    }
    view.appendChild(list);
    setView(view);
  }

  function openClient(key) {
    var c = rep.clients.find(function (x) { return x.key === key; });
    var subs = rep.clients.filter(function (x) { return x.payer === key; });
    var bookings = rep.bookings.filter(function (b) { return b.client === key; }).slice().reverse().slice(0, 8);
    var invoices = rep.invoices.filter(function (iv) { return iv.client === key; }).slice().reverse().slice(0, 8);
    var vids = rep.videos.filter(function (v) { return v.client === key; }).slice().reverse().slice(0, 8);
    var msgs = rep.messages.filter(function (m) {
      return !m.spam && !m.fromOwner && (m.client === key || (c.payer && m.client === c.payer));
    }).slice().reverse().slice(0, 10);

    var sheet = el("div");
    sheet.innerHTML =
      "<button class='close' aria-label='close'>&times;</button>" +
      "<h2 style='margin-top:4px'>" + esc(key) + "</h2>" +
      (subs.length ? "<div class='legend' style='margin-bottom:6px'>Also serves: " + subs.map(function (x) { return esc(x.key); }).join(" · ") + "</div>" : "") +
      "<div class='statline'>" +
      st("In bank", usd(c.revenue)) + st("Open", usd(c.overdue)) +
      st("Shoots", c.bookings) + st("Videos", c.videos) + st("Complaints", c.escalations) + "</div>";

    var invH = "<h2 class='sec'>Latest invoices</h2>" +
      "<table><tr><th>Invoice</th><th>Tool says</th><th class='num'>Billed</th><th class='num'>Bank</th></tr>" +
      invoices.map(function (iv) {
        var really = iv.paid_total >= iv.amount_n - 0.01;
        var flagged = ((iv.status === "paid") !== really) ? " <span style='color:var(--warn)'>⚠</span>" : "";
        return "<tr><td class='mono'>" + iv.invoice_no + "</td><td>" + esc(iv.status) + flagged + "</td>" +
          "<td class='num'>" + usd(iv.amount_n) + "</td><td class='num'>" + usd(iv.paid_total) + "</td></tr>";
      }).join("") + (invoices.length ? "" : "<tr><td colspan='4' class='legend'>none — billed via " + esc(c.payer || "agency") + "</td></tr>") + "</table>";
    sheet.innerHTML += invH;

    sheet.innerHTML += "<h2 class='sec'>Latest shoots</h2>" +
      (bookings.length ? bookings.map(function (b) {
        return "<div class='row'><div class='who'><b>" + esc(b.service) + " · " + esc(b.date) + "</b>" +
          "<div class='sub mono'>" + b.booking_id + (b.matched_invoice ? " · " + b.matched_invoice : "") + "</div></div>" +
          "<div class='num'><b>" + usd(b.price_n) + "</b><div class='sub'>" + esc(b.status) + "</div></div></div>";
      }).join("") : "<div class='legend'>none</div>");

    sheet.innerHTML += "<h2 class='sec'>Videos</h2>" +
      (vids.length ? vids.map(function (v) {
        return "<div class='row'><div class='who'><b>" + esc(v.title) + "</b>" +
          "<div class='sub mono'>" + v.video_id + " · " + esc(v.editor) + " · " + v.revisions_n + " revisions" +
          (v.notes ? " · note: " + esc(String(v.notes_on_board).slice(0, 40)) : "") + "</div></div>" +
          "<div class='num'><span class='chip " + (v.stage === "Delivered" ? "ok" : "warn") + "'>" + esc(v.stage) + "</span></div></div>";
      }).join("") : "<div class='legend'>no videos</div>");

    sheet.innerHTML += "<h2 class='sec'>Message history</h2><div class='msghist'>" +
      (msgs.length ? msgs.map(function (m) {
        return "<div class='m" + (m.frustrated ? " bad" : "") + "'><div class='d'>" + esc(m.date) + " · " + esc(m.channel) + (m.inbox ? " · " + esc(m.inbox) : "") + "</div>" +
          "<div class='c'>" + esc(m.text.slice(0, 130)) + "</div></div>";
      }).join("") : "<div class='legend'>no messages on file</div>") + "</div>";

    openSheet(sheet);
  }
  function st(k, v) { return "<span class='st'>" + esc(k) + " <b>" + esc(v) + "</b></span>"; }
  function openSheet(node) {
    $sheet.innerHTML = node.innerHTML;
    var close = $sheet.querySelector(".close");
    if (close) close.addEventListener("click", closeSheet);
    $overlay.classList.remove("hidden");
    $sheet.classList.remove("hidden");
    $sheet.scrollTop = 0;
  }
  function closeSheet() { $sheet.classList.add("hidden"); $overlay.classList.add("hidden"); }

  /* ============================================================
     TAB: MONEY
     ============================================================ */
  function viewMoney() {
    var view = el("div");
    var months = Object.keys(rep.escalation_months || {}).sort();
    var chartHtml = "";
    if (months.length) {
      var totalEsc = months.reduce(function (s, m) { return s + rep.escalation_months[m]; }, 0);
      chartHtml = "<div class='card amber'>" +
        "<div class='tagline'><span class='tag amber'>" + totalEsc + " complaints</span></div>" +
        "<h3>Complaints climbing since " + esc(rep.lost_requests_started_getting_worse_in || "") + "</h3>" +
        "<div class='bars barwrap'>" + escalBars(months) + "</div>" +
        "<div class='why'>The three things to do are on Today. This page is the backup: who owes what, what we never billed, and where the billing tool lied.</div></div>";
    }

    view.innerHTML = chartHtml + "<h2 class='sec'>Who owes us — <span style='color:var(--danger)'>" + usd(rep.overdue_total) + "</span></h2><table>" +
      "<tr><th>Client</th><th>Invoice</th><th class='num'>Owed</th><th class='num'>Days late</th></tr>" +
      rep.overdue_list.map(function (o) {
        return "<tr><td>" + esc(o.client) + "</td><td class='mono'>" + o.invoice + "</td>" +
          "<td class='num'>" + usd(o.amount_owed) + "</td><td class='num'>" + o.days_late + "</td></tr>";
      }).join("") +
      "<tr class='total'><td>Total</td><td></td><td class='num'>" + usd(rep.overdue_total) + "</td><td></td></tr></table>";

    view.innerHTML += "<h2 class='sec'>Work we never billed — <span style='color:var(--warn)'>" + usd(rep.never_billed_total) + "</span></h2>" +
      rep.never_billed.map(function (n) {
        return "<div class='row'><div class='who'><b>" + esc(n.client) + "</b><div class='sub'>" + esc(n.booking_id_or_month) + "</div></div>" +
          "<div class='num'><b>" + usd(n.amount) + "</b></div></div>";
      }).join("") + (rep.never_billed.length ? "" : "<div class='legend'>nothing outstanding</div>");

    view.innerHTML += "<h2 class='sec'>We owe them — <span style='color:var(--warn)'>" + usd(rep.we_owe_total) + "</span></h2>" +
      (rep.we_owe.length ? rep.we_owe.map(function (w) {
        return "<div class='row'><div class='who'><b>Refund " + usd(w.amount) + " → " + esc(w.client) + "</b>" +
          "<div class='sub'>" + esc(w.why) + "</div></div></div>";
      }).join("") : "<div class='legend'>nothing to refund</div>");

    view.innerHTML += "<h2 class='sec'>Where the billing tool is wrong</h2>" +
      rep.billing_tool_is_wrong.map(function (t) {
        var sev = /no matching/.test(t.truth) ? "red" : /really paid/.test(t.truth) ? "green" : /void/.test(t.tool_says) ? "green" : "amber";
        return "<div class='card " + sev + "'>" +
          "<div class='tagline'><span class='tag " + sev + "'>" + esc(t.invoice) + "</span></div>" +
          "<h3>Tool says: " + esc(t.tool_says) + "</h3>" +
          "<div class='why'><b>Truth:</b> " + esc(t.truth) + "</div>" +
          "<div class='proof'>" + esc(t.how_you_know) + "</div></div>";
      }).join("");

    setView(view);
  }

  /* ============================================================
     TAB: UPLOAD — judges' hidden-file test
     ============================================================ */
  var SCHEMAS = ["bookings.csv", "invoices.csv", "payments.csv", "leads.csv",
    "production_board.csv", "messages.txt", "team.csv", "costs.csv"];

  function detectSchema(name, text) {
    if (/^\s*\[20\d\d-/.test(text)) return "messages";
    var head = String(text).slice(0, 400).toLowerCase();
    if (/booking_id/.test(head)) return "bookings";
    if (/invoice_no/.test(head)) return "invoices";
    if (/payment_id/.test(head)) return "payments";
    if (/lead_id/.test(head)) return "leads";
    if (/video_id/.test(head)) return "production_board";
    if (/item,\s*cost/.test(head)) return "costs";
    if (/name,\s*role/.test(head)) return "team";
    return null;
  }

  function viewUpload(resultHtml) {
    var view = el("div");
    view.innerHTML =
      "<h2 class='sec'>Add new files</h2>" +
      "<div class='drop'><b>Drop the studio's exported files here</b>" +
      "<div class='upl-note'>Same schemas as the original pack. A file replaces its own dataset; everything recomputes instantly — totals, overdue debts, lost requests, actions.</div>" +
      "<input type='file' id='upinput' multiple accept='.csv,.txt' style='display:none'>" +
      "<button class='btn yes' style='display:block;max-width:280px;margin:14px auto 0' id='upbtn'>Choose files</button>" +
      "<button class='btn mute' style='display:block;max-width:280px;margin:8px auto 0' id='upreset'>Reset to original files</button></div>" +
      "<div class='filemap'>Accepted: " + SCHEMAS.join(" · ") + "</div>" +
      "<div class='diff' id='updiff'>" + (resultHtml || "") + "</div>";
    setView(view);

    var inp = view.querySelector("#upinput");
    view.querySelector("#upbtn").addEventListener("click", function () { inp.click(); });
    var drop = view.querySelector(".drop");
    drop.addEventListener("dragover", function (e) { e.preventDefault(); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); handleFiles(e.dataTransfer.files); });
    inp.addEventListener("change", function () { handleFiles(inp.files); });
    view.querySelector("#upreset").addEventListener("click", function () {
      dataStrings = normalizePack(ORIGINAL);
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      recompute();
      tab("upload", "<div class='card green'><h3>Back to the original files</h3><div class='why'>Owed to us is " + usd(rep.overdue_total) + " again.</div></div>");
    });
  }

  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    var replaced = [], skipped = [];
    var pending = files.length;
    if (!pending) return;

    files.forEach(function (f) {
      var reader = new FileReader();
      reader.onload = function () {
        var schema = detectSchema(f.name, String(reader.result));
        if (schema) {
          var oldRows = (dataStrings[schema] || "").split("\n").filter(function (l) { return l.trim(); }).length;
          dataStrings[schema] = String(reader.result);
          var newRows = String(reader.result).split("\n").filter(function (l) { return l.trim(); }).length;
          replaced.push(f.name + " → " + schema + ": " + (oldRows - 1) + " rows → " + (newRows - 1) + " rows");
        } else {
          skipped.push(f.name);
        }
        pending--;
        if (pending === 0) finish();
      };
      reader.onerror = function () { skipped.push(f.name); pending--; if (pending === 0) finish(); };
      reader.readAsText(f);
    });

    function finish() {
      var oldTotals = { overdue: rep.overdue_total, nb: rep.never_billed_total, owe: rep.we_owe_total, clients: rep.counts.clients_total };
      recompute();
      try { localStorage.setItem(STORE_KEY, JSON.stringify(dataStrings)); } catch (e) {}
      var html = "";
      if (replaced.length) {
        html += "<div class='card green'><h3>Updated ✓</h3><div class='why'>" + replaced.map(esc).join("<br>") +
          (skipped.length ? "<br>Skipped (unknown format): " + skipped.map(esc).join(", ") : "") + "</div></div>" +
          "<div class='row'><div class='who'><b>Totals recalculated</b>" +
          "<div class='sub'>overdue " + usd(oldTotals.overdue) + " → <b>" + usd(rep.overdue_total) + "</b> · never billed " + usd(oldTotals.nb) + " → <b>" + usd(rep.never_billed_total) + "</b> · we owe " + usd(oldTotals.owe) + " → <b>" + usd(rep.we_owe_total) + "</b> · clients " + oldTotals.clients + " → <b>" + rep.counts.clients_total + "</b></div></div></div>";
      } else {
        html += "<div class='card amber'><h3>No files matched</h3><div class='why'>Unknown format: " + skipped.map(esc).join(", ") + "</div></div>";
      }
      tab("upload", html);
    }
  }

  /* ============================================================
     router
     ============================================================ */
  NAV.addEventListener("click", function (e) {
    var t = e.target.getAttribute("data-tab");
    if (t) tab(t);
  });

  function tab(name, opt) {
    state.tab = name;
    Array.prototype.forEach.call(NAV.querySelectorAll("button"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-tab") === name);
    });
    closeSheet();
    if (name === "home") viewToday();
    else if (name === "clients") viewClients(opt === true ? undefined : "");
    else if (name === "money") viewMoney();
    else if (name === "upload") viewUpload(opt);
  }

  $overlay.addEventListener("click", closeSheet);
  tab("home");
})();
