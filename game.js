// Brain Lag — game logic. Plain functions, no framework. Rules: PLAN.md / CLAUDE.md.
(() => {
  "use strict";

  // ---------- Config ----------
  const ROUND = 20;          // answers per normal round
  const TUTORIAL_ROUND = 5;  // answers in the guided tutorial
  const GRACE_MS = 250;      // time to change a mis-tapped answer
  const OK_MS = 500;         // how long correct feedback shows
  const BAD_MS = 1200;       // how long wrong feedback shows

  const LEVELS = [
    { n: 1, name: "1-BACK", sub: "Answer the previous problem" },
    { n: 2, name: "2-BACK", sub: "Answer two problems ago" },
    { n: 3, name: "3-BACK", sub: "Answer three problems ago" },
    { n: 4, name: "4-BACK", sub: "Answer four problems ago" },
  ];
  const TUTORIAL = { n: 1, name: "TUTORIAL", tutorial: true };

  // Intro copy — the only place the game explains its purpose (PLAN.md §1b).
  const INTRO = [
    { label: "Why", title: "Your attention is trained to jump.",
      text: "Feeds, alerts and tabs teach you to switch every few seconds. This game does the opposite." },
    { label: "What", title: "It works your working memory.",
      text: "The mental notepad behind your forehead. It holds about four things. Here you'll hold answers you can't see, swap one out each turn, and ignore the problem right in front of you." },
    { label: "Honestly", title: "No miracle claims.",
      text: "You'll get better at this game. Whether that carries over to everything else, scientists still argue. Think of it as two minutes of single focus." },
  ];

  // ---------- Small helpers ----------
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const DEBUG = params.has("debug");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage unavailable */ } },
  };

  const fmtTime = (ms) => {
    const sec = Math.floor(ms / 1000);
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  };

  // Seeded random so ?debug (and a future daily challenge) can replay the same round.
  function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  function shuffle(rng, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- Problem generator ----------
  // Answers spread evenly over 0–9, never the same answer twice in a row,
  // single-digit operands, no "+0" or "−0".
  function answerSequence(rng, count) {
    const bag = [];
    while (bag.length < count) bag.push(...shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    const pool = bag.slice(0, count);
    // Draw from the pool, never repeating the previous answer. Retry on the rare dead end.
    for (let attempt = 0; attempt < 50; attempt++) {
      const left = pool.slice();
      const seq = [];
      while (left.length) {
        const options = left.map((v, i) => i).filter((i) => left[i] !== seq[seq.length - 1]);
        if (!options.length) break;
        const pick = options[Math.floor(rng() * options.length)];
        seq.push(left.splice(pick, 1)[0]);
      }
      if (seq.length === count) return seq;
    }
    return pool;
  }

  function problemFor(rng, ans) {
    const canAdd = ans >= 2;        // a + b with a, b ≥ 1
    const canSub = ans <= 8;        // a − b with b ≥ 1 and a ≤ 9
    const add = canAdd && (!canSub || rng() < 0.5);
    if (add) {
      const a = randInt(rng, 1, ans - 1);
      return { a, b: ans - a, op: "+", ans };
    }
    const b = randInt(rng, 1, 9 - ans);
    return { a: ans + b, b, op: "−", ans };
  }

  function makeProblems(count) {
    const seed = DEBUG ? Number(params.get("seed")) || 1 : Math.floor(Math.random() * 2 ** 32);
    const rng = makeRng(seed);
    return answerSequence(rng, count).map((ans) => problemFor(rng, ans));
  }

  // ---------- Sound (off by default) ----------
  let soundOn = store.get("brainlag.sound") === true;
  let audio = null;
  function tone(freq, start, dur, type, gain) {
    const t = audio.currentTime + start;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur);
  }
  function sfx(kind) {
    if (!soundOn) return;
    try {
      audio = audio || new AudioContext();
      if (audio.state === "suspended") audio.resume();
      if (kind === "ok") { tone(784, 0, 0.09, "sine", 0.12); tone(1175, 0.08, 0.14, "sine", 0.12); }
      else if (kind === "bad") { tone(165, 0, 0.18, "square", 0.05); }
    } catch { /* audio unavailable */ }
  }

  // ---------- Views ----------
  const views = { intro: $("view-intro"), menu: $("view-menu"), game: $("view-game"), results: $("view-results") };
  let currentView = null;
  function show(name) {
    currentView = name;
    for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
    $("btn-close").hidden = !(name === "game" || name === "results");
  }

  // ---------- Intro ----------
  let introStep = 0;
  let introReturn = "menu"; // "first" | "menu" | "game" | "results"
  function openIntro(returnTo) {
    introReturn = returnTo;
    introStep = 0;
    renderIntro();
    show("intro");
  }
  function renderIntro() {
    const step = INTRO[introStep];
    $("intro-step").textContent = `${introStep + 1} / ${INTRO.length} · ${step.label}`;
    $("intro-title").textContent = step.title;
    $("intro-text").textContent = step.text;
    $("intro-next").textContent = introStep === INTRO.length - 1 ? "Start" : "Next";
    $("intro-skip").hidden = introStep === INTRO.length - 1;
    $("intro-dots").replaceChildren(...INTRO.map((_, i) => {
      const d = document.createElement("span");
      d.className = "dot" + (i === introStep ? " is-on" : "");
      return d;
    }));
  }
  function introNext() {
    if (introStep < INTRO.length - 1) { introStep++; renderIntro(); }
    else finishIntro();
  }
  function finishIntro() {
    const firstTime = !store.get("brainlag.seenIntro");
    store.set("brainlag.seenIntro", true);
    if (introReturn === "first" || (firstTime && introReturn === "menu")) startRound(TUTORIAL);
    else if (introReturn === "game") { show("game"); showPause(); }
    else if (introReturn === "results") show("results");
    else renderMenu();
  }

  // ---------- Menu ----------
  const bestKey = (n) => `brainlag.best.${n}`;
  function renderMenu() {
    $("tracks").replaceChildren(...LEVELS.map((lvl, i) => {
      const best = store.get(bestKey(lvl.n));
      const li = document.createElement("li");
      li.innerHTML = `<button class="track" type="button">
        <span class="track-num">0${i + 1}</span>
        <span class="track-text"><span class="track-name"></span><span class="track-sub"></span></span>
        <span class="track-best"></span></button>`;
      li.querySelector(".track-name").textContent = lvl.name;
      li.querySelector(".track-sub").textContent = lvl.sub;
      li.querySelector(".track-best").innerHTML = best ? `<b>${best.correct}/${ROUND}</b>${fmtTime(best.ms)}` : "—";
      li.querySelector("button").addEventListener("click", () => startRound(lvl));
      return li;
    }));
    show("menu");
  }

  // ---------- Round state ----------
  let s = null;
  const stackEl = $("stack");
  const windowEl = $("window");
  const actionKey = $("key-action");
  const ACTION_NEXT = "Next";
  const ACTION_PASS = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 3l5 6H3z"/><rect x="3" y="11" width="10" height="2"/></svg>Pass`;

  function startRound(level) {
    if (s) clearTimeout(s.timeout), clearTimeout(s.pendingTimer);
    const total = level.tutorial ? TUTORIAL_ROUND : ROUND;
    s = {
      level, n: level.n, total,
      problems: makeProblems(total),
      k: 0,
      results: [],
      phase: "play",       // play | feedback | done
      pending: null,
      pendingTimer: null,
      timeout: null,
      elapsed: 0,
      runningSince: performance.now(),
      held: false,         // timer held by pause / quit dialog / help
      deferredNext: false,
    };
    stackEl.replaceChildren();
    hideOverlays();
    show("game");
    render();
  }

  // ---------- Timer ----------
  const elapsed = () => s.elapsed + (s.runningSince ? performance.now() - s.runningSince : 0);
  function holdTimer() {
    if (!s || s.held) return;
    s.elapsed = elapsed();
    s.runningSince = null;
    s.held = true;
  }
  function releaseTimer() {
    if (!s || !s.held || s.phase === "done") return;
    s.runningSince = performance.now();
    s.held = false;
    if (s.deferredNext) { s.deferredNext = false; next(); }
  }
  setInterval(() => { if (s && currentView === "game") $("timer").textContent = fmtTime(elapsed()); }, 200);

  // ---------- Rendering ----------
  function rowsFor() {
    const { n, k, total } = s;
    const rows = [];
    if (k < total) rows.push({ key: `p${k}`, state: "current", idx: k });
    else rows.push({ key: "blank", state: "blank" });
    for (let i = k - 1; i > k - n; i--) if (i >= 0 && i < total) rows.push({ key: `p${i}`, state: "hidden", idx: i });
    if (k >= n) rows.push({ key: `p${k - n}`, state: "answer", idx: k - n });
    return rows;
  }

  const exprOf = (p) => `${p.a} ${p.op} ${p.b}`;

  function fillRow(el, row, feedback) {
    const p = row.idx != null ? s.problems[row.idx] : null;
    el.className = `row is-${row.state}`;
    const tag = `<span class="tag">${row.idx != null ? row.idx + 1 : ""}</span>`;
    if (row.state === "current") {
      el.innerHTML = `${tag}<div class="row-main"><span>${exprOf(p)} =</span><span class="box">?</span></div>`;
    } else if (row.state === "hidden") {
      el.innerHTML = `${tag}<div class="row-main"><span>${exprOf(p)} =</span></div><span class="cover-label">remember${DEBUG ? ` · ${p.ans}` : ""}</span>`;
    } else if (row.state === "blank") {
      const left = s.total + s.n - s.k;
      el.innerHTML = `${tag}<div class="row-main"><span>no input · recall ${left} left</span></div>`;
    } else if (feedback) {
      el.classList.add(feedback.ok ? "is-ok" : "is-bad");
      const given = feedback.given == null ? "–" : feedback.given;
      el.innerHTML = `${tag}<div class="row-main"><span>${exprOf(p)} =</span><span class="box">${given}</span>` +
        `<span class="verdict">${feedback.ok ? "✓" : `it's ${p.ans}`}</span></div>`;
    } else {
      const pending = s.pending != null;
      el.innerHTML = `${tag}<div class="row-main">${DEBUG ? `<span class="verdict">${p.ans}</span>` : ""}` +
        `<span>? ? ? =</span><span class="box${pending ? " is-pending" : ""}">${pending ? s.pending : ""}</span></div>`;
    }
  }

  function render(feedback) {
    const wanted = rowsFor();
    const existing = new Map([...stackEl.children].map((el) => [el.dataset.key, el]));
    const before = new Map();
    existing.forEach((el, key) => before.set(key, el.getBoundingClientRect().top));

    const els = wanted.map((row) => {
      let el = existing.get(row.key);
      const isNew = !el;
      if (isNew) { el = document.createElement("div"); el.dataset.key = row.key; }
      const prevState = el.dataset.state;
      el.dataset.state = row.state;
      fillRow(el, row, row.state === "answer" ? feedback : null);
      if (isNew && s.k > 0) el.classList.add("is-entering");
      if (prevState === "current" && row.state === "hidden") el.classList.add("is-closing");
      return el;
    });
    stackEl.replaceChildren(...els);

    // FLIP: rows that moved slide from their old spot to the new one.
    if (!reducedMotion.matches) {
      for (const el of els) {
        const top = before.get(el.dataset.key);
        if (top == null) continue;
        const dy = top - el.getBoundingClientRect().top;
        if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(.2,.8,.3,1)" });
      }
    }

    renderChrome();
  }

  function renderChrome() {
    const { n, k, total, level } = s;
    const memorizing = k < n;
    $("status").textContent = memorizing
      ? `${level.name} · memorize ${k + 1}/${n}`
      : `${level.name} · recall #${k - n + 1}`;
    actionKey.innerHTML = memorizing ? ACTION_NEXT : ACTION_PASS;
    actionKey.setAttribute("aria-label", memorizing ? "Next problem" : "Pass");

    const done = s.results.length;
    $("progress-fill").style.width = `${(done / total) * 100}%`;
    $("progress-label").textContent = `${done}/${total}`;

    renderCoach();
  }

  // Tutorial hints: point at the row that matters right now.
  function renderCoach() {
    const coach = $("coach");
    if (!s.level.tutorial) { coach.hidden = true; return; }
    const { k, total } = s;
    let text, arrow = "▲", target = null;
    if (k === 0) { text = "Remember this answer. Then press Next."; target = stackEl.firstElementChild; }
    else if (k === 1) { text = "The first problem is covered now, at the bottom. Type its answer. Keep the new one at the top in mind."; target = stackEl.lastElementChild; }
    else if (k < total) { text = "Same again: answer the bottom, remember the top."; }
    else { text = "No new problems. Answer the last one."; target = stackEl.lastElementChild; }
    $("coach-text").textContent = text;
    $("coach-arrow").textContent = arrow;
    coach.hidden = false;
    if (target && s.phase === "play") target.classList.add("is-coach");
  }

  // ---------- Input ----------
  const inputBlocked = () => !s || currentView !== "game" || s.held || s.phase !== "play";

  function pressDigit(d) {
    if (inputBlocked()) return;
    if (s.k < s.n) { nudge(actionKey); return; } // still memorizing: point at Next
    s.pending = d;
    clearTimeout(s.pendingTimer);
    s.pendingTimer = setTimeout(() => lock(s.pending), GRACE_MS);
    render();
  }

  function pressAction() {
    if (inputBlocked()) return;
    if (s.k < s.n) { next(); return; }
    clearTimeout(s.pendingTimer);
    lock(null); // pass
  }

  function lock(given) {
    if (!s || s.phase !== "play") return;
    const p = s.problems[s.k - s.n];
    const ok = given === p.ans;
    s.pending = null;
    s.results.push(ok);
    s.phase = "feedback";
    render({ ok, given });
    sfx(ok ? "ok" : "bad");
    if (!ok) shake(windowEl);
    s.timeout = setTimeout(() => {
      s.phase = "play";
      if (s.held) s.deferredNext = true;
      else next();
    }, ok ? OK_MS : BAD_MS);
  }

  function next() {
    s.k++;
    if (s.k >= s.total + s.n) finish();
    else render();
  }

  function shake(el) {
    el.classList.remove("is-shaking");
    void el.offsetWidth;
    el.classList.add("is-shaking");
  }
  function nudge(el) {
    el.classList.remove("is-nudge");
    void el.offsetWidth;
    el.classList.add("is-nudge");
  }

  // ---------- Finish ----------
  function finish() {
    holdTimer();
    s.phase = "done";
    const ms = s.elapsed;
    const correct = s.results.filter(Boolean).length;
    const { level, total, n } = s;

    let isBest = false;
    let prev = null;
    if (!level.tutorial) {
      prev = store.get(bestKey(n));
      isBest = !prev || correct > prev.correct || (correct === prev.correct && ms < prev.ms);
      if (isBest) store.set(bestKey(n), { correct, ms });
    }

    $("res-level").textContent = level.name;
    $("res-correct").textContent = correct;
    $("res-total").textContent = `/${total}`;
    $("res-time").textContent = fmtTime(ms);
    $("res-strip").replaceChildren(...s.results.map((ok) => {
      const i = document.createElement("i");
      if (!ok) i.className = "miss";
      return i;
    }));
    $("res-badge").hidden = !isBest;
    $("res-line").textContent = level.tutorial
      ? "tutorial done · ready for 1-back"
      : `held ${n} item${n > 1 ? "s" : ""} · ${fmtTime(ms)} without switching`;
    $("res-again").textContent = level.tutorial ? "Play 1-Back" : "Again";
    show("results");
  }

  // ---------- Pause + quit ----------
  function hideOverlays() { $("overlay-pause").hidden = true; $("overlay-quit").hidden = true; }
  function showPause() {
    if (!s || s.phase === "done") return;
    holdTimer();
    $("overlay-quit").hidden = true;
    $("overlay-pause").hidden = false;
  }
  function resume() { hideOverlays(); releaseTimer(); }
  function askQuit() {
    if (!s || s.phase === "done") { renderMenu(); return; }
    holdTimer();
    $("overlay-quit").hidden = false;
  }
  function quit() {
    hideOverlays();
    if (s) { clearTimeout(s.timeout); clearTimeout(s.pendingTimer); s.phase = "done"; }
    renderMenu();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && currentView === "game" && s && s.phase !== "done" && $("overlay-quit").hidden) showPause();
  });

  // ---------- Wiring ----------
  $("keypad").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-key]");
    if (!btn) return;
    const key = btn.dataset.key;
    if (key === "retry") { if (s && !s.held) startRound(s.level); }
    else if (key === "action") pressAction();
    else pressDigit(Number(key));
  });

  function flashKey(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add("is-pressed");
    setTimeout(() => el.classList.remove("is-pressed"), 90);
  }

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key;

    if (!$("overlay-quit").hidden) {
      if (key === "Escape") { e.preventDefault(); resume(); }
      return;
    }
    if (!$("overlay-pause").hidden) {
      if (key === "Enter" || key === " " || key === "Escape") { e.preventDefault(); resume(); }
      return;
    }

    if (currentView === "game") {
      if (/^[0-9]$/.test(key)) { flashKey(`[data-key="${key}"]`); pressDigit(Number(key)); }
      else if (key === "Enter" || key === " ") { e.preventDefault(); if (s.k < s.n) { flashKey("#key-action"); pressAction(); } }
      else if (key.toLowerCase() === "p") { if (s.k >= s.n) { flashKey("#key-action"); pressAction(); } }
      else if (key === "Escape") askQuit();
    } else if (currentView === "results") {
      if (key === "Enter") { e.preventDefault(); $("res-again").click(); }
      else if (key === "Escape") renderMenu();
    } else if (currentView === "intro") {
      if (key === "Enter" || key === "ArrowRight") { e.preventDefault(); introNext(); }
      else if (key === "Escape") finishIntro();
    }
  });

  $("btn-sound").addEventListener("click", () => {
    soundOn = !soundOn;
    store.set("brainlag.sound", soundOn);
    $("btn-sound").setAttribute("aria-pressed", String(soundOn));
    sfx("ok");
  });
  $("btn-sound").setAttribute("aria-pressed", String(soundOn));

  $("btn-help").addEventListener("click", () => {
    if (currentView === "intro") return;
    if (currentView === "game" && s && s.phase !== "done") { holdTimer(); hideOverlays(); openIntro("game"); }
    else openIntro(currentView === "results" ? "results" : "menu");
  });
  $("btn-close").addEventListener("click", () => (currentView === "game" ? askQuit() : renderMenu()));

  $("intro-next").addEventListener("click", introNext);
  $("intro-skip").addEventListener("click", finishIntro);
  $("menu-why").addEventListener("click", () => openIntro("menu"));
  $("menu-tutorial").addEventListener("click", () => startRound(TUTORIAL));
  $("pause-resume").addEventListener("click", resume);
  $("quit-stay").addEventListener("click", resume);
  $("quit-leave").addEventListener("click", quit);
  $("res-again").addEventListener("click", () => startRound(s.level.tutorial ? LEVELS[0] : s.level));
  $("res-levels").addEventListener("click", renderMenu);

  // ---------- Boot ----------
  if (store.get("brainlag.seenIntro")) renderMenu();
  else openIntro("first");
})();
