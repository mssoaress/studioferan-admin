// ═══════════════════════════════════════════════
// STUDIO FERRAN — firebase-config.js
// Compartilhado por agendar.html e index.html
// ═══════════════════════════════════════════════

var firebaseConfig = {
  apiKey: "AIzaSyBAGCoK9o8EtDGmoR6Ji_S75Ec6wR1WpuY",
  authDomain: "barber-team.firebaseapp.com",
  projectId: "barber-team",
  storageBucket: "barber-team.firebasestorage.app",
  messagingSenderId: "761746951630",
  appId: "1:761746951630:web:6468a4a832e4520be62f9f",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
var db = firebase.firestore();

// ── ZERAR + POPULAR BANCO ─────────────────────
// Apaga tudo e insere os dados novos do Studio Feran
async function seedBanco() {
  try {
    // ── ZERA PROFISSIONAIS ─────────────────────
    var pSnap = await db.collection("profissionais").get();
    for (var i = 0; i < pSnap.docs.length; i++) {
      await pSnap.docs[i].ref.delete();
    }

    // ── ZERA SERVIÇOS ──────────────────────────
    var sSnap = await db.collection("servicos").get();
    for (var j = 0; j < sSnap.docs.length; j++) {
      await sSnap.docs[j].ref.delete();
    }

    // ── INSERE PROFISSIONAL ────────────────────
    await db.collection("profissionais").doc("feran").set({
      nome: "Feran",
      especialidade: "Barbeiro",
      foto: "fotos/feran.jpg",
      ativo: true,
    });

    // ── INSERE SERVIÇOS ────────────────────────
    var servicos = [
      { id: "corte", nome: "Corte", preco: 45, duracao: 40, descricao: "" },
      { id: "barba", nome: "Barba", preco: 35, duracao: 30, descricao: "" },
      {
        id: "combo",
        nome: "Combo Corte + Barba",
        preco: 70,
        duracao: 60,
        descricao: "",
      },
      { id: "pezinho", nome: "Pezinho", preco: 10, duracao: 15, descricao: "" },
      {
        id: "sobrancelha",
        nome: "Sobrancelha",
        preco: 15,
        duracao: 15,
        descricao: "",
      },
      {
        id: "hidratacao",
        nome: "Hidratação",
        preco: 30,
        duracao: 20,
        descricao: "",
      },
      {
        id: "bio-simples",
        nome: "Bio-redutora (simples)",
        preco: 50,
        duracao: 40,
        descricao: "",
      },
      {
        id: "bio-redutora",
        nome: "Bio-redutora",
        preco: 85,
        duracao: 60,
        descricao: "",
      },
      {
        id: "bio-completa",
        nome: "Bio-redutora completa",
        preco: 150,
        duracao: 90,
        descricao: "",
      },
    ];

    for (var k = 0; k < servicos.length; k++) {
      var s = servicos[k];
      await db.collection("servicos").doc(s.id).set({
        nome: s.nome,
        preco: s.preco,
        duracao: s.duracao,
        descricao: s.descricao,
        ativo: true,
      });
    }

    console.log("[Studio Feran] Banco populado com sucesso.");
  } catch (e) {
    console.warn("[seed] Erro:", e.code, e.message);
  }
}
