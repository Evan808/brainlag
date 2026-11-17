(() => {
  const ROUND = 20; // answers per round
  const LEVELS = [
    { n: 1, name: "1-Back", sub: "Answer the previous problem" },
    { n: 2, name: "2-Back", sub: "Answer 2 problems ago" },
    { n: 3, name: "3-Back", sub: "Answer 3 problems ago" },
    { n: 4, name: "4-Back", sub: "Good luck" },
  ];

  const $ = (id) => document.getElementById(id);
  const screens = { menu: $("menu"), game: $("game"), results: $("results") };
  const stackEl = $("stack");
  const statusEl = $("status");
  const timerEl = $("timer");

  // Saved best scores live only in this browser; everything works without them.
  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } },
  };
  const bestKey = (n) => `brainlag.best.${n}`;

  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const fmtTime = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  // Every answer is a single digit (0–9), so one tap answers.
  function makeProblem(prev) {
    let p;
    do {
      if (Math.random() < 0.5) {
        const a = rand(1, 8);
        const b = rand(1, 9 - a);
        p = { a, b, op: "+", ans: a + b };
      } else {
        const ans = rand(0, 9);
        const b = rand(1, 9);
        p = { a: ans + b, b, op: "−", ans };
      }
    } while (prev && prev.a === p.a && prev.b === p.b && prev.op === p.op);
    return p;
  }

  let s = null; // current round state

  function show(name) {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  }

  // ---------- Menu ----------
  function renderMenu() {
    const wrap = $("levels");
    wrap.replaceChildren(
      ...LEVELS.map((lvl) => {
        const best = store.get(bestKey(lvl.n));
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn level-btn";
        btn.innerHTML = `<span><span class="name"></span><span class="sub"></span></span><span class="best"></span>`;
        btn.querySelector(".name").textContent = lvl.name;
        btn.querySelector(".sub").textContent = lvl.sub;
        btn.querySelector(".best").textContent = best ? `Best ${best.correct}/${ROUND} · ${fmtTime(best.ms)}` : "";
        btn.addEventListener("click", () => start(lvl));
        return btn;
      })
    );
    show("menu");
  }

  // ---------- Keypad ----------
  const keys = {};
  function buildKeypad() {
    const pad = $("keypad");
    const layout = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "pass", "0", "next"];
    for (const k of layout) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "key" + (k === "pass" || k === "next" ? " action" : "");
      b.textContent = k === "pass" ? "Pass" : k === "next" ? "Next" : k;
      b.addEventListener("click", () => handleKey(k));
      keys[k] = b;
      pad.append(b);
    }
  }

  function handleKey(k) {
    if (!s || s.locked || s.done) return;
    const memorizing = s.k < s.n;
    if (k === "next") { if (memorizing) advance(); return; }
    if (memorizing) return;
    submit(k === "pass" ? null : Number(k));
  }

  document.addEventListener("keydown", (e) => {
    if (screens.game.hidden) return;
    if (/^[0-9]$/.test(e.key)) handleKey(e.key);
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleKey("next"); }
    else if (e.key.toLowerCase() === "p") handleKey("pass");
    else if (e.key === "Escape") quit();
  });

  // ---------- Round ----------
  function start(level) {
    const problems = [];
    for (let i = 0; i < ROUND; i++) problems.push(makeProblem(problems[i - 1]));
    if (s) clearInterval(s.timerId);
    s = { level, n: level.n, problems, k: 0, results: [], locked: false, done: false, startedAt: performance.now() };
    s.timerId = setInterval(() => { timerEl.textContent = fmtTime(performance.now() - s.startedAt); }, 250);
    timerEl.textContent = "0:00";
    $("level-label").textContent = level.name;
    show("game");
    render();
  }

  // Step k: problem k is new at the top; problem k-n is being answered at the bottom;
  // everything in between is covered.
  function render(feedback) {
    const { n, k, problems } = s;
    const rows = [];
    rows.push(k < ROUND ? row("current", k, problems[k]) : row("blank"));
    for (let i = k - 1; i > k - n; i--) {
      if (i >= 0 && i < ROUND) rows.push(row("hidden", i));
    }
    if (k >= n) rows.push(row("answer", k - n, problems[k - n], feedback));
    if (!feedback) rows[0].classList.add("enter");
    stackEl.replaceChildren(...rows);

    const memorizing = k < n;
    for (const [key, b] of Object.entries(keys)) {
      b.disabled = s.locked || (key === "next" ? !memorizing : memorizing);
    }
    statusEl.textContent = memorizing
      ? `Remember this (${k + 1} of ${n})`
      : `Answer #${k - n + 1}  ·  ${k - n + 1}/${ROUND}`;
  }

  function row(type, idx, p, fb) {
    const el = document.createElement("div");
    el.className = `row ${type}`;
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = idx == null ? "" : String(idx + 1);
    const body = document.createElement("div");
    body.className = "body";

    if (type === "current") {
      body.innerHTML = `<span class="expr">${p.a} ${p.op} ${p.b} =</span><span class="box">?</span>`;
    } else if (type === "hidden") {
      body.textContent = "remember";
    } else if (type === "blank") {
      body.textContent = "no new problems";
    } else if (type === "answer" && !fb) {
      body.innerHTML = `<span class="expr masked">? ? ? =</span><span class="box"></span>`;
    } else if (type === "answer") {
      el.classList.add(fb.ok ? "ok" : "bad");
      const given = fb.given == null ? "–" : fb.given;
      body.innerHTML =
        `<span class="expr">${p.a} ${p.op} ${p.b} =</span>` +
        `<span class="box ${fb.ok ? "ok" : "bad"}">${given}</span>` +
        (fb.ok ? `<span class="mark ok">✓</span>` : `<span class="mark bad">it's ${p.ans}</span>`);
    }
    el.append(tag, body);
    return el;
  }

  function submit(given) {
    const p = s.problems[s.k - s.n];
    const ok = given === p.ans;
    s.results.push(ok);
    s.locked = true;
    render({ ok, given });
    setTimeout(() => {
      if (!s || s.done) return;
      s.locked = false;
      advance();
    }, ok ? 450 : 1200);
  }

  function advance() {
    s.k++;
    if (s.k >= ROUND + s.n) return finish();
    render();
  }

  function finish() {
    s.done = true;
    clearInterval(s.timerId);
    const ms = performance.now() - s.startedAt;
    const correct = s.results.filter(Boolean).length;
    const prev = store.get(bestKey(s.n));
    const isBest = !prev || correct > prev.correct || (correct === prev.correct && ms < prev.ms);
    if (isBest) store.set(bestKey(s.n), { correct, ms });

    $("res-level").textContent = s.level.name;
    $("res-correct").textContent = correct;
    $("res-time").textContent = `Time ${fmtTime(ms)}`;
    $("res-best").textContent = isBest ? "New best!" : `Best ${prev.correct}/${ROUND} · ${fmtTime(prev.ms)}`;
    show("results");
  }

  function quit() {
    if (s) { clearInterval(s.timerId); s.done = true; }
    renderMenu();
  }

  $("retry").addEventListener("click", () => start(s.level));
  $("quit").addEventListener("click", quit);
  $("again").addEventListener("click", () => start(s.level));
  $("to-menu").addEventListener("click", renderMenu);

  buildKeypad();
  renderMenu();
})();
