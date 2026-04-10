// ═══════════════════════════════════════════════
// STUDIO FERRAN — admin.js
// 1 barbeiro · Listener tempo real · Relatórios
// ═══════════════════════════════════════════════

var AD = {
  servicos: [],
  clientes: [],
  agendamentos: [],
  currentDate: new Date(),
  unsub: null,
  profId: "feran",
  profNome: "Feran",
  relPage: 0,
  relPerPage: 20,
  relFiltered: [],
};

var SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
];

// ── INIT ──────────────────────────────────────
window.addEventListener("DOMContentLoaded", async function () {
  setupNav();
  setupClock();
  setupStatus();
  setupDateNav();
  try {
    await seedBanco();
    var res = await Promise.all([
      db.collection("servicos").orderBy("nome").get(),
      db.collection("clientes").orderBy("nome").get(),
    ]);
    AD.servicos = res[0].docs.map(toObj);
    AD.clientes = res[1].docs.map(toObj);
  } catch (e) {
    console.warn("[admin]", e.message);
    AD.servicos = demoServs();
    AD.clientes = [];
    toast("Modo offline", "err");
  }
  iniciarListener();
  navTo("agendamentos");
});

// ── LISTENER TEMPO REAL ────────────────────────
function iniciarListener() {
  if (AD.unsub) AD.unsub();
  AD.unsub = db.collection("agendamentos").onSnapshot(
    function (snap) {
      var antesIds = AD.agendamentos.map(function (a) {
        return a.id;
      });
      AD.agendamentos = snap.docs.map(toObj);
      var novos = AD.agendamentos
        .filter(function (a) {
          return antesIds.indexOf(a.id) === -1 && a.status === "aguardando";
        })
        .map(function (a) {
          return a.id;
        });
      renderKanban(novos);
      if (document.getElementById("pg-relatorios").classList.contains("active"))
        renderRelatorios();
    },
    function (e) {
      console.warn("[listener]", e.message);
    },
  );
}

// ── NAV ───────────────────────────────────────
function setupNav() {
  document.querySelectorAll(".sb-item").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      navTo(el.getAttribute("data-page"));
      closeSidebar();
    });
  });
  document.getElementById("menuBtn").addEventListener("click", function () {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("sbOverlay").classList.toggle("show");
  });
  document.getElementById("sbOverlay").addEventListener("click", closeSidebar);
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sbOverlay").classList.remove("show");
}
window.navTo = function (page) {
  document.querySelectorAll(".sb-item").forEach(function (i) {
    i.classList.toggle("active", i.getAttribute("data-page") === page);
  });
  document.querySelectorAll(".page").forEach(function (p) {
    p.classList.remove("active");
  });
  document.getElementById("pg-" + page).classList.add("active");
  if (page === "agendamentos") renderKanban([]);
  if (page === "novo") initNovo();
  if (page === "clientes") renderClientes();
  if (page === "servicos") renderServicos();
  if (page === "relatorios") renderRelatorios();
};

// ── CLOCK ─────────────────────────────────────
function setupClock() {
  var t = function () {
    var el = document.getElementById("topbarClock");
    if (el)
      el.textContent = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
  };
  t();
  setInterval(t, 1000);
}

// ── STATUS ────────────────────────────────────
function setupStatus() {
  var H = {
    1: [9, 19],
    2: [9, 19],
    3: [9, 19],
    4: [9, 19],
    5: [9, 19],
    6: [9, 17],
  };
  var ch = function () {
    var n = new Date(),
      d = n.getDay(),
      hm = n.getHours() * 60 + n.getMinutes(),
      h = H[d];
    var dot = document.getElementById("statusDot"),
      txt = document.getElementById("statusTxt");
    if (!dot) return;
    if (h) {
      var o = hm >= h[0] * 60 && hm <= h[1] * 60;
      dot.className = "st-dot " + (o ? "open" : "closed");
      txt.textContent = o ? "Aberto" : "Fechado";
    } else {
      dot.className = "st-dot closed";
      txt.textContent = "Fechado hoje";
    }
  };
  ch();
  setInterval(ch, 60000);
}

// ── DATE NAV ──────────────────────────────────
function setupDateNav() {
  updateDateDisplay();
  document.getElementById("btnPrev").addEventListener("click", function () {
    AD.currentDate.setDate(AD.currentDate.getDate() - 1);
    updateDateDisplay();
    renderKanban([]);
  });
  document.getElementById("btnNext").addEventListener("click", function () {
    AD.currentDate.setDate(AD.currentDate.getDate() + 1);
    updateDateDisplay();
    renderKanban([]);
  });
}
function updateDateDisplay() {
  var d = AD.currentDate,
    t = new Date(),
    isT = d.toDateString() === t.toDateString();
  document.getElementById("dateDisplay").textContent = d.toLocaleDateString(
    "pt-BR",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );
  document.getElementById("dayLabel").textContent = isT
    ? "Hoje"
    : d.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "short",
      });
}

// ── KANBAN ────────────────────────────────────
function renderKanban(novosIds) {
  var ds = toDateStr(AD.currentDate);
  var ags = AD.agendamentos
    .filter(function (a) {
      return a.data === ds;
    })
    .sort(function (a, b) {
      return a.horario.localeCompare(b.horario);
    });
  var el = document.getElementById("kanban");
  el.innerHTML =
    '<div class="kcol">' +
    '<div class="kcol-head"><span class="kcol-name">Feran</span><span class="kcol-count">' +
    ags.length +
    "</span></div>" +
    '<div class="kcol-cards">' +
    (ags.length === 0
      ? '<div class="kcol-empty">Livre hoje</div>'
      : ags
          .map(function (a) {
            var cls =
              a.status === "concluido"
                ? "ok"
                : a.status === "cancelado"
                  ? "can"
                  : "ag";
            var pulse = novosIds.indexOf(a.id) > -1 ? " new-pulse" : "";
            return (
              '<div class="kcard ' +
              cls +
              pulse +
              '" onclick="abrirAg(\'' +
              a.id +
              "')\">" +
              '<div class="kcard-time">⏰ ' +
              a.horario +
              "</div>" +
              '<div class="kcard-client">' +
              a.clienteNome +
              "</div>" +
              '<div class="kcard-servs">' +
              (a.servicos || []).join(", ") +
              "</div>" +
              '<div class="kcard-price">R$ ' +
              fmtM(a.total) +
              "</div>" +
              "</div>"
            );
          })
          .join("")) +
    "</div></div>";
}

window.abrirAg = function (id) {
  var ag = AD.agendamentos.find(function (a) {
    return a.id === id;
  });
  if (!ag) return;
  document.getElementById("mAgTitle").textContent =
    "Agendamento — " + ag.horario;
  document.getElementById("mAgBody").innerHTML =
    '<div class="ag-rows">' +
    agRow("Cliente", ag.clienteNome) +
    agRow("Data / Hora", fmtDate(ag.data) + " — " + ag.horario) +
    agRow("Serviços", (ag.servicos || []).join(", ")) +
    agRow("Origem", ag.origem === "online" ? "📱 Online" : "🔧 Admin") +
    agRowTotal("Total", "R$ " + fmtM(ag.total)) +
    "</div>" +
    '<div style="margin-top:10px"><span class="badge badge-' +
    stCls(ag.status) +
    '">' +
    stLbl(ag.status) +
    "</span></div>";
  var foot = document.getElementById("mAgFoot");
  foot.innerHTML =
    '<button class="btn-ghost" onclick="closeModal(\'mAg\')">Fechar</button>';
  if (ag.status === "aguardando") {
    foot.innerHTML +=
      '<button class="btn-err" onclick="setStatus(\'' +
      ag.id +
      "','cancelado')\">Cancelar</button>";
    foot.innerHTML +=
      '<button class="btn-ok" onclick="setStatus(\'' +
      ag.id +
      "','concluido')\">✓ Concluído</button>";
  }
  openModal("mAg");
};

window.setStatus = async function (id, status) {
  try {
    await db.collection("agendamentos").doc(id).update({ status: status });
  } catch (e) {}
  var ag = AD.agendamentos.find(function (a) {
    return a.id === id;
  });
  if (ag) ag.status = status;
  closeModal("mAg");
  toast(
    status === "concluido" ? "Concluído ✓" : "Cancelado",
    status === "concluido" ? "ok" : "err",
  );
};

function agRow(k, v) {
  return (
    '<div class="ag-row"><span>' + k + "</span><span>" + v + "</span></div>"
  );
}
function agRowTotal(k, v) {
  return (
    '<div class="ag-row total"><span>' +
    k +
    "</span><span>" +
    v +
    "</span></div>"
  );
}

// ── NOVO AGENDAMENTO ──────────────────────────
function initNovo() {
  renderNovoServList();
  setupCliSearch();
  var inp = document.getElementById("newDate");
  inp.value = inp.min = toDateStr(new Date());
  inp.onchange = renderNovoTimeGrid;
  renderNovoTimeGrid();
}

function renderNovoServList() {
  document.getElementById("newServList").innerHTML = AD.servicos
    .map(function (s) {
      var sel = window._novoServs && window._novoServs.indexOf(s.id) > -1;
      return (
        '<div class="ns-item' +
        (sel ? " sel" : "") +
        '" onclick="togServ(\'' +
        s.id +
        "')\">" +
        '<div><div class="ns-nome">' +
        s.nome +
        '</div><div class="ns-dur">' +
        (s.duracao ? s.duracao + " min" : "Consumível") +
        "</div></div>" +
        '<span class="ns-preco">R$ ' +
        fmtM(s.preco) +
        "</span>" +
        "</div>"
      );
    })
    .join("");
  atualizarNovoTotal();
}

if (!window._novoServs) window._novoServs = [];
window.togServ = function (id) {
  var i = window._novoServs.indexOf(id);
  if (i > -1) window._novoServs.splice(i, 1);
  else window._novoServs.push(id);
  renderNovoServList();
};
function atualizarNovoTotal() {
  var bar = document.getElementById("newServTotal");
  if (!window._novoServs.length) {
    bar.classList.add("hidden");
    return;
  }
  var t = window._novoServs.reduce(function (acc, id) {
    var s = AD.servicos.find(function (x) {
      return x.id === id;
    });
    return acc + (s ? Number(s.preco) : 0);
  }, 0);
  document.getElementById("newServTotalVal").textContent = "R$ " + fmtM(t);
  bar.classList.remove("hidden");
}

function setupCliSearch() {
  var inp = document.getElementById("newCliSearch"),
    dd = document.getElementById("cliDropdown");
  window._novoCli = null;
  inp.value = "";
  inp.oninput = function () {
    var q = inp.value.toLowerCase().trim();
    if (!q) {
      dd.classList.add("hidden");
      return;
    }
    var m = AD.clientes.filter(function (c) {
      return c.nome.toLowerCase().includes(q) || (c.telefone || "").includes(q);
    });
    dd.innerHTML =
      m
        .map(function (c) {
          return (
            '<div class="cli-opt" onclick="selCli(\'' +
            c.id +
            "')\">" +
            c.nome +
            ' <span style="color:var(--t3);font-size:11px">' +
            (c.telefone || "") +
            "</span></div>"
          );
        })
        .join("") ||
      '<div class="cli-opt" style="color:var(--t3)">Nenhum resultado</div>';
    dd.classList.remove("hidden");
  };
  document.addEventListener("click", function (e) {
    if (!inp.contains(e.target) && !dd.contains(e.target))
      dd.classList.add("hidden");
  });
}
window.selCli = function (id) {
  window._novoCli = AD.clientes.find(function (c) {
    return c.id === id;
  });
  document.getElementById("newCliSearch").value = window._novoCli.nome;
  document.getElementById("cliDropdown").classList.add("hidden");
  window._novoCliNovo = false;
};
window.toggleNewCli = function () {
  var f = document.getElementById("newCliFields");
  window._novoCliNovo = f.classList.contains("hidden");
  f.classList.toggle("hidden", !window._novoCliNovo);
  if (window._novoCliNovo) {
    window._novoCli = null;
    document.getElementById("newCliSearch").value = "";
  }
};

function renderNovoTimeGrid() {
  var date = document.getElementById("newDate").value;
  var grid = document.getElementById("newTimeGrid");
  if (!date) {
    grid.innerHTML =
      '<p style="color:var(--t3);font-size:12px">Selecione uma data.</p>';
    return;
  }
  var occ = AD.agendamentos
    .filter(function (a) {
      return (
        a.data === date &&
        a.profissionalId === AD.profId &&
        a.status !== "cancelado"
      );
    })
    .map(function (a) {
      return a.horario;
    });
  var isSab = new Date(date + "T12:00:00").getDay() === 6;
  var slots = SLOTS.filter(function (h) {
    return isSab ? parseInt(h) < 17 : true;
  });
  window._novoHorario = null;
  grid.innerHTML = slots
    .map(function (h) {
      var busy = occ.indexOf(h) > -1;
      return (
        '<div class="nt-pill' +
        (busy ? " busy" : "") +
        '"' +
        (busy ? "" : " onclick=\"selHorario('" + h + "')\"") +
        ">" +
        h +
        "</div>"
      );
    })
    .join("");
}
window.selHorario = function (h) {
  window._novoHorario = h;
  document.querySelectorAll(".nt-pill").forEach(function (el) {
    el.classList.toggle("sel", el.textContent === h);
  });
};

window.newConfirmar = async function () {
  if (!window._novoServs || !window._novoServs.length) {
    toast("Selecione ao menos um serviço", "err");
    return;
  }
  var cliId = window._novoCli ? window._novoCli.id : null,
    cliNome = window._novoCli ? window._novoCli.nome : null;
  if (window._novoCliNovo) {
    var nome = document.getElementById("newCliNome").value.trim(),
      tel = document.getElementById("newCliTel").value.trim();
    if (!nome) {
      toast("Informe o nome do cliente", "err");
      return;
    }
    try {
      var cr = await db
        .collection("clientes")
        .add({
          nome: nome,
          telefone: tel,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        });
      cliId = cr.id;
    } catch (e) {
      cliId = "c" + Date.now();
    }
    AD.clientes.push({ id: cliId, nome: nome, telefone: tel });
    cliNome = nome;
  }
  if (!cliId) {
    toast("Selecione ou cadastre um cliente", "err");
    return;
  }
  if (!window._novoHorario) {
    toast("Selecione um horário", "err");
    return;
  }
  var date = document.getElementById("newDate").value;
  if (!date) {
    toast("Selecione uma data", "err");
    return;
  }
  var t = window._novoServs.reduce(function (acc, id) {
    var s = AD.servicos.find(function (x) {
      return x.id === id;
    });
    return acc + (s ? Number(s.preco) : 0);
  }, 0);
  var ns = window._novoServs.map(function (id) {
    var s = AD.servicos.find(function (x) {
      return x.id === id;
    });
    return s ? s.nome : id;
  });
  var ag = {
    profissionalId: AD.profId,
    profissionalNome: AD.profNome,
    clienteId: cliId,
    clienteNome: cliNome,
    servicos: ns,
    servicosIds: window._novoServs.slice(),
    total: t,
    horario: window._novoHorario,
    data: date,
    status: "aguardando",
    origem: "admin",
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await db.collection("agendamentos").add(ag);
  } catch (e) {
    ag.id = "a" + Date.now();
    AD.agendamentos.push(ag);
  }
  window._novoServs = [];
  window._novoCli = null;
  window._novoHorario = null;
  toast("Agendamento confirmado! ✓", "ok");
  navTo("agendamentos");
};

// ── CLIENTES ──────────────────────────────────
window.renderClientes = function () {
  var q = (document.getElementById("cliSearch").value || "").toLowerCase();
  var f = AD.clientes.filter(function (c) {
    return c.nome.toLowerCase().includes(q) || (c.telefone || "").includes(q);
  });
  document.getElementById("cliCount").textContent =
    AD.clientes.length + " cadastrados";
  document.getElementById("cliBody").innerHTML =
    f
      .map(function (c) {
        var ags = AD.agendamentos.filter(function (a) {
          return a.clienteId === c.id && a.status === "concluido";
        });
        var g = ags.reduce(function (acc, a) {
          return acc + Number(a.total || 0);
        }, 0);
        return (
          "<tr><td><strong>" +
          c.nome +
          "</strong></td>" +
          "<td style=\"font-family:'JetBrains Mono',monospace;font-size:12px\">" +
          (c.telefone || "—") +
          "</td>" +
          '<td style="text-align:center">' +
          ags.length +
          "</td>" +
          "<td style=\"font-family:'JetBrains Mono',monospace;color:var(--acc)\">R$ " +
          fmtM(g) +
          "</td>" +
          '<td><div class="t-acts"><button class="btn-err" onclick="delCliente(\'' +
          c.id +
          "')\">Excluir</button></div></td></tr>"
        );
      })
      .join("") || '<tr class="empty"><td colspan="5">Nenhum cliente</td></tr>';
};
window.salvarCliente = async function () {
  var nome = document.getElementById("mCliNome").value.trim(),
    tel = document.getElementById("mCliTel").value.trim();
  if (!nome) {
    toast("Informe o nome", "err");
    return;
  }
  var id;
  try {
    var r = await db
      .collection("clientes")
      .add({
        nome: nome,
        telefone: tel,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
    id = r.id;
  } catch (e) {
    id = "c" + Date.now();
  }
  AD.clientes.push({ id: id, nome: nome, telefone: tel });
  AD.clientes.sort(function (a, b) {
    return a.nome.localeCompare(b.nome);
  });
  closeModal("mCli");
  document.getElementById("mCliNome").value = "";
  document.getElementById("mCliTel").value = "";
  renderClientes();
  toast("Cliente salvo! ✓", "ok");
};
window.delCliente = async function (id) {
  if (!confirm("Excluir este cliente?")) return;
  try {
    await db.collection("clientes").doc(id).delete();
  } catch (e) {}
  AD.clientes = AD.clientes.filter(function (c) {
    return c.id !== id;
  });
  renderClientes();
  toast("Cliente removido");
};

// ── SERVIÇOS ──────────────────────────────────
function renderServicos() {
  document.getElementById("servCards").innerHTML =
    AD.servicos
      .map(function (s) {
        return (
          '<div class="dcard">' +
          '<div class="dcard-name">' +
          s.nome +
          "</div>" +
          '<div class="dcard-meta">' +
          (s.duracao ? s.duracao + " min" : "Consumível") +
          "</div>" +
          '<div class="dcard-price">R$ ' +
          fmtM(s.preco) +
          "</div>" +
          '<div class="dcard-foot"><button class="btn-err" onclick="delServico(\'' +
          s.id +
          "')\">Excluir</button></div>" +
          "</div>"
        );
      })
      .join("") || '<p style="color:var(--t3)">Nenhum serviço.</p>';
}
window.salvarServico = async function () {
  var nome = document.getElementById("mServNome").value.trim(),
    preco = parseFloat(document.getElementById("mServPreco").value),
    dur = parseInt(document.getElementById("mServDur").value) || 0;
  if (!nome || isNaN(preco)) {
    toast("Preencha nome e preço", "err");
    return;
  }
  var id;
  try {
    var r = await db
      .collection("servicos")
      .add({
        nome: nome,
        preco: preco,
        duracao: dur,
        descricao: "",
        ativo: true,
      });
    id = r.id;
  } catch (e) {
    id = "s" + Date.now();
  }
  AD.servicos.push({ id: id, nome: nome, preco: preco, duracao: dur });
  AD.servicos.sort(function (a, b) {
    return a.nome.localeCompare(b.nome);
  });
  closeModal("mServ");
  ["mServNome", "mServPreco", "mServDur"].forEach(function (i) {
    document.getElementById(i).value = "";
  });
  renderServicos();
  toast("Serviço salvo! ✓", "ok");
};
window.delServico = async function (id) {
  if (!confirm("Excluir este serviço?")) return;
  try {
    await db.collection("servicos").doc(id).delete();
  } catch (e) {}
  AD.servicos = AD.servicos.filter(function (s) {
    return s.id !== id;
  });
  renderServicos();
  toast("Serviço removido");
};

// ── RELATÓRIOS ────────────────────────────────
window.renderRelatorios = function () {
  var periodo = document.getElementById("relPeriodo").value;
  var status = document.getElementById("relStatus").value;
  var busca = (document.getElementById("relSearch").value || "").toLowerCase();
  var now = new Date();

  var ags = AD.agendamentos
    .filter(function (a) {
      var d = new Date(a.data + "T12:00:00");
      if (periodo === "hoje") return a.data === toDateStr(now);
      if (periodo === "semana") {
        var s = new Date(now);
        s.setDate(now.getDate() - now.getDay());
        return d >= s;
      }
      if (periodo === "mes")
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      return true;
    })
    .filter(function (a) {
      if (status && a.status !== status) return false;
      if (busca) {
        var t = (
          a.clienteNome +
          " " +
          (a.servicos || []).join(" ")
        ).toLowerCase();
        if (!t.includes(busca)) return false;
      }
      return true;
    })
    .sort(function (a, b) {
      return (b.data + b.horario).localeCompare(a.data + a.horario);
    });

  AD.relFiltered = ags;
  AD.relPage = 0;

  var ok = ags.filter(function (a) {
    return a.status === "concluido";
  });
  var can = ags.filter(function (a) {
    return a.status === "cancelado";
  });
  var fat = ok.reduce(function (acc, a) {
    return acc + Number(a.total || 0);
  }, 0);
  document.getElementById("relFat").textContent = "R$ " + fmtM(fat);
  document.getElementById("relTotal").textContent = ags.length;
  document.getElementById("relTicket").textContent = ok.length
    ? "R$ " + fmtM(fat / ok.length)
    : "R$ 0,00";
  document.getElementById("relCanc").textContent = can.length;

  renderRelTabela();

  // Serviços mais realizados
  var bs = {};
  ags.forEach(function (a) {
    (a.servicos || []).forEach(function (s) {
      bs[s] = (bs[s] || 0) + 1;
    });
  });
  document.getElementById("relByServ").innerHTML =
    Object.entries(bs)
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, 8)
      .map(function (e, i) {
        return (
          '<div class="rank-row"><span class="rank-n">' +
          (i + 1) +
          '.</span><span style="flex:1;font-size:13px">' +
          e[0] +
          '</span><span class="rank-c">' +
          e[1] +
          "×</span></div>"
        );
      })
      .join("") ||
    '<p style="color:var(--t3);font-size:13px;padding:12px 0">Nenhum dado</p>';

  // Faturamento por serviço (apenas concluídos)
  var bf = {};
  ok.forEach(function (a) {
    (a.servicos || []).forEach(function (sn) {
      var s = AD.servicos.find(function (x) {
        return x.nome === sn;
      });
      bf[sn] = (bf[sn] || 0) + (s ? Number(s.preco) : 0);
    });
  });
  var maxF = Math.max.apply(null, Object.values(bf).concat([1]));
  document.getElementById("relFatServ").innerHTML =
    Object.entries(bf)
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, 6)
      .map(function (e) {
        return (
          '<div class="bar-row">' +
          '<span class="bar-name">' +
          e[0] +
          "</span>" +
          '<div class="bar-track"><div class="bar-fill" style="width:' +
          ((e[1] / maxF) * 100).toFixed(0) +
          '%"></div></div>' +
          '<span class="bar-val">R$ ' +
          fmtM(e[1]) +
          "</span></div>"
        );
      })
      .join("") ||
    '<p style="color:var(--t3);font-size:13px;padding:12px 0">Nenhum dado</p>';
};

function renderRelTabela() {
  var total = AD.relFiltered.length;
  var pages = Math.max(1, Math.ceil(total / AD.relPerPage));
  var start = AD.relPage * AD.relPerPage;
  var slice = AD.relFiltered.slice(start, start + AD.relPerPage);

  document.getElementById("relPageInfo").textContent =
    AD.relPage + 1 + " / " + pages;
  document.getElementById("relPrev").disabled = AD.relPage === 0;
  document.getElementById("relNext").disabled = AD.relPage >= pages - 1;

  document.getElementById("relBody").innerHTML =
    slice
      .map(function (a) {
        var p = a.data.split("-");
        return (
          "<tr>" +
          "<td style=\"font-family:'JetBrains Mono',monospace;font-size:12px;white-space:nowrap\">" +
          p[2] +
          "/" +
          p[1] +
          "/" +
          p[0] +
          "</td>" +
          "<td style=\"font-family:'JetBrains Mono',monospace;font-size:12px\">" +
          a.horario +
          "</td>" +
          "<td>" +
          a.clienteNome +
          "</td>" +
          '<td style="font-size:12px;color:var(--t3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          (a.servicos || []).join(", ") +
          "</td>" +
          "<td style=\"font-family:'JetBrains Mono',monospace;color:var(--acc)\">R$ " +
          fmtM(a.total) +
          "</td>" +
          '<td><span class="badge badge-' +
          stCls(a.status) +
          '">' +
          stLbl(a.status) +
          "</span></td>" +
          '<td><span class="badge-orig' +
          (a.origem === "online" ? " online" : "") +
          '">' +
          (a.origem === "online" ? "📱 online" : "🔧 admin") +
          "</span></td>" +
          "</tr>"
        );
      })
      .join("") ||
    '<tr class="empty"><td colspan="7">Nenhum resultado</td></tr>';
}

window.relPage = function (dir) {
  var pages = Math.max(1, Math.ceil(AD.relFiltered.length / AD.relPerPage));
  AD.relPage = Math.max(0, Math.min(pages - 1, AD.relPage + dir));
  renderRelTabela();
};

// ── MODALS ────────────────────────────────────
window.openModal = function (id) {
  document.getElementById(id).classList.add("open");
};
window.closeModal = function (id) {
  document.getElementById(id).classList.remove("open");
};
document.querySelectorAll(".modal-bg").forEach(function (o) {
  o.addEventListener("click", function (e) {
    if (e.target === o) o.classList.remove("open");
  });
});

// ── TOAST ─────────────────────────────────────
function toast(msg, type) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show" + (type ? " " + type : "");
  clearTimeout(window._tt);
  window._tt = setTimeout(function () {
    t.classList.remove("show");
  }, 3200);
}

// ── UTILS ─────────────────────────────────────
function toObj(d) {
  return Object.assign({ id: d.id }, d.data());
}
function toDateStr(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
function fmtDate(s) {
  if (!s) return "—";
  var p = s.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}
function fmtM(v) {
  return Number(v || 0)
    .toFixed(2)
    .replace(".", ",");
}
function stCls(s) {
  return { aguardando: "ag", concluido: "ok", cancelado: "can" }[s] || "ag";
}
function stLbl(s) {
  return (
    {
      aguardando: "Aguardando",
      concluido: "Concluído",
      cancelado: "Cancelado",
    }[s] || s
  );
}
function demoServs() {
  return [
    { id: "corte", nome: "Corte", preco: 45, duracao: 40 },
    { id: "barba", nome: "Barba", preco: 35, duracao: 30 },
    { id: "combo", nome: "Combo Corte + Barba", preco: 70, duracao: 60 },
  ];
}
