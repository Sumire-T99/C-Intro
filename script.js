/* Recipe data: adjust amounts and timing here without changing stage logic. */
const RECIPE = {
  stages: ["Gather", "Rice", "Warishita", "Onion", "Beef", "Serve"],
  coreIngredients: [
    { id: "beef", english: "Thinly sliced beef", japanese: "薄切り牛肉 · usugiri gyuniku", icon: "🥩", note: "Ribeye or chuck" },
    { id: "onion", english: "Yellow onion", japanese: "玉ねぎ · tamanegi", icon: "🧅", note: "One medium" },
    { id: "rice", english: "Short-grain rice", japanese: "米 · kome", icon: "🍚", note: "Japanese rice" },
    { id: "dashi", english: "Dashi stock", japanese: "だし · dashi", icon: "🍵", note: "The savory base" },
    { id: "soy", english: "Soy sauce", japanese: "醤油 · shoyu", icon: "🫙", note: "2 tablespoons" },
    { id: "mirin", english: "Mirin", japanese: "みりん · mirin", icon: "🍶", note: "Gentle sweetness" },
    { id: "sake", english: "Cooking sake", japanese: "酒 · sake", icon: "🍶", note: "1 tablespoon" },
    { id: "sugar", english: "Sugar", japanese: "砂糖 · satō", icon: "🧂", note: "Just a little" }
  ],
  toppings: [
    { id: "ginger", english: "Pickled red ginger", japanese: "紅生姜 · beni shoga", icon: "🌺", note: "Bright and tangy" },
    { id: "scallion", english: "Green onion", japanese: "青ねぎ · ao-negi", icon: "🌿", note: "Freshly sliced" },
    { id: "shichimi", english: "Seven-spice chili", japanese: "七味唐辛子 · shichimi", icon: "🌶️", note: "A warm little kick" },
    { id: "egg", english: "Raw or onsen egg", japanese: "温泉卵 · onsen tamago", icon: "🥚", note: "Silky and rich" }
  ],
  decoys: [
    { id: "ketchup", english: "Ketchup", japanese: "トマトケチャップ", icon: "🍅", note: "A different kitchen" },
    { id: "cream", english: "Heavy cream", japanese: "生クリーム", icon: "🥛", note: "Not for this bowl" }
  ],
  sauceOrder: ["dashi", "sake", "mirin", "sugar", "soy"],
  sauceLabels: { dashi: "Dashi", sake: "Sake", mirin: "Mirin", sugar: "Sugar", soy: "Soy sauce" },
  sauceAmounts: { dashi: 120, sake: 1, mirin: 2, sugar: 1, soy: 2 },
  sauceTargetRatio: 1.42,
  riceWaterTarget: 1.2,
  onionCuts: 5,
  simmerSeconds: { easy: 7, normal: 8, chef: 9 },
  beefTimingWindows: {
    easy: { start: 4, end: 11, total: 14 },
    normal: { start: 5, end: 9, total: 13 },
    chef: { start: 5.5, end: 8, total: 12 }
  },
  beefPortions: 4
};

const state = {
  screen: "title",
  difficulty: "normal",
  reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  sound: false,
  picked: [],
  scores: {},
  rice: { rinse: 0, water: RECIPE.riceWaterTarget, cooking: false, cooked: false },
  sauce: { order: [], amounts: { ...RECIPE.sauceAmounts } },
  onion: { cuts: [], knife: 50, heat: "medium", soft: false, burned: false },
  beef: { portions: 0, separated: 0, foam: 0, skimmed: 0, elapsed: 0, done: false, result: null },
  plate: { rice: false, toppingSelected: [], served: false },
  hint: "",
  timer: null,
  toastTimer: null
};

const view = document.querySelector("#stage-view");
const progressFill = document.querySelector("#progress-fill");
const progressBar = document.querySelector("#progress-bar");
const progressLabel = document.querySelector("#progress-label");
const progressCount = document.querySelector("#progress-count");
const dots = document.querySelector("#stage-dots");
const toast = document.querySelector("#toast");
let audioContext;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function playTone(frequency = 540) {
  if (!state.sound) return;
  try {
    audioContext ??= new window.AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.06, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.13);
  } catch {
    state.sound = false;
    updateSoundButton();
  }
}

function updateSoundButton() {
  const button = document.querySelector("#sound-toggle");
  button.setAttribute("aria-pressed", String(state.sound));
  button.setAttribute("aria-label", state.sound ? "Turn sound off" : "Turn sound on");
  button.title = state.sound ? "Sound on" : "Sound off";
  button.innerHTML = state.sound
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M17 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="m17 9 5 6m0-6-5 6"/></svg>';
}

function updateProgress() {
  const stageIndex = typeof state.screen === "number" ? state.screen : state.screen === "end" ? 6 : 0;
  const names = ["Gather", "Rice", "Warishita", "Onion", "Beef", "Serve"];
  progressFill.style.width = `${Math.min(stageIndex / 6, 1) * 100}%`;
  progressBar.setAttribute("aria-valuenow", String(stageIndex));
  progressLabel.textContent = stageIndex === 0 ? "WELCOME TO THE KITCHEN" : state.screen === "end" ? "BOWL COMPLETE" : `STEP ${stageIndex} · ${names[stageIndex - 1].toUpperCase()}`;
  progressCount.textContent = stageIndex === 0 ? "READY WHEN YOU ARE" : state.screen === "end" ? "SERVED WITH CARE" : `${stageIndex} OF 6`;
  dots.innerHTML = names.map((name, index) => {
    const step = index + 1;
    const current = state.screen === step;
    const done = state.screen === "end" || (typeof state.screen === "number" && state.screen > step);
    return `<span class="stage-dot ${current ? "is-current" : ""} ${done ? "is-done" : ""}" ${current ? 'aria-current="step"' : ""}><b>${done ? "✓" : step}</b><span>${name}</span></span>`;
  }).join("");
}

function goTo(screen) {
  clearInterval(state.timer);
  state.timer = null;
  state.screen = screen;
  state.hint = "";
  document.body.classList.toggle("reduce-motion", state.reduceMotion);
  render();
  document.querySelector("#game").focus({ preventScroll: true });
}

function render() {
  updateProgress();
  if (state.screen === "title") view.innerHTML = renderTitle();
  else if (state.screen === 1) view.innerHTML = renderIngredients();
  else if (state.screen === 2) view.innerHTML = renderRice();
  else if (state.screen === 3) view.innerHTML = renderSauce();
  else if (state.screen === 4) view.innerHTML = renderOnion();
  else if (state.screen === 5) view.innerHTML = renderBeef();
  else if (state.screen === 6) view.innerHTML = renderPlate();
  else view.innerHTML = renderEnd();
  bindStageEvents();
}

function renderTitle() {
  return `<section class="title-layout" aria-labelledby="game-title">
    <div class="title-copy"><span class="eyebrow">A COZY LITTLE COOKING GAME</span><h1 id="game-title">Make a bowl.<br><em>Make it yours.</em></h1>
      <p class="lead">Gather the good things, build a gentle broth, and make your own comforting gyudon.</p>
      <div class="button-row"><button class="button button-primary" data-action="start">Start cooking <span aria-hidden="true">→</span></button><button class="button button-secondary" data-action="how">How to play</button></div>
      <div class="difficulty-wrap"><label for="difficulty">Kitchen pace</label><select class="difficulty-select" id="difficulty" aria-label="Choose difficulty"><option value="easy" ${state.difficulty === "easy" ? "selected" : ""}>Easy</option><option value="normal" ${state.difficulty === "normal" ? "selected" : ""}>Normal</option><option value="chef" ${state.difficulty === "chef" ? "selected" : ""}>Chef</option></select><label class="toggle-line"><input id="motion-toggle" type="checkbox" ${state.reduceMotion ? "checked" : ""}> Reduce motion</label></div>
    </div>
    <div class="kitchen-art" role="img" aria-label="A warm kitchen counter with a bowl of gyudon"><span class="window-glow"></span><span class="steam"></span><div class="art-bowl"><span class="rice"></span><span class="beef"></span><span class="ginger"></span><span class="scallion"></span><span class="outer"></span></div><span class="art-caption">A good meal, one small step at a time.</span></div>
  </section>`;
}

function stageHead(number, title, instruction) {
  const hintsOff = state.difficulty === "chef";
  return `<header class="stage-head"><div><span class="eyebrow">KITCHEN STEP ${number} OF 6</span><h2>${title}</h2><p>${instruction}</p></div><button class="hint-button" data-action="hint" ${hintsOff ? "disabled title='Hints are off in Chef mode'" : ""} aria-label="Show a gentle hint">Hint</button></header>`;
}

function hintMarkup() {
  return `<p class="hint-box" role="status">${state.hint ? escapeHTML(state.hint) : ""}</p>`;
}

function stageActions(canContinue, continueLabel = "Continue", action = "next") {
  return `<div class="stage-actions"><div class="action-left"><button class="button button-text button-small" data-action="retry">↻ Retry stage</button></div><button class="button button-primary" data-action="${action}" ${canContinue ? "" : "disabled"}>${continueLabel} <span aria-hidden="true">${action === "next" ? "→" : ""}</span></button></div>`;
}

function renderIngredients() {
  const items = [...RECIPE.coreIngredients, ...RECIPE.toppings, ...RECIPE.decoys];
  const required = RECIPE.coreIngredients.filter((item) => state.picked.includes(item.id)).length;
  const pickedNames = state.picked.map((id) => [...RECIPE.coreIngredients, ...RECIPE.toppings].find((item) => item.id === id)?.english).filter(Boolean);
  return `${stageHead(1, "Gather your ingredients", "Tap each ingredient for the bowl. The Japanese name comes along when it lands on your counter.")}
    <div class="kitchen-columns"><div class="ingredient-grid" aria-label="Ingredient counter">${items.map((item) => {
      const selected = state.picked.includes(item.id);
      const decoy = RECIPE.decoys.some((entry) => entry.id === item.id);
      return `<button class="ingredient-card ${selected ? "is-picked" : ""}" data-item="${item.id}" aria-label="${escapeHTML(item.english)}${selected ? ", collected" : ""}" ${selected ? "disabled" : ""}><span class="ingredient-icon" aria-hidden="true">${item.icon}</span><span class="ingredient-name">${escapeHTML(item.english)}</span><span class="ingredient-tag">${escapeHTML(item.note)}</span>${selected ? '<span class="ingredient-mark" aria-hidden="true">✓</span>' : ""}${decoy ? '<span class="sr-only">Decoy</span>' : ""}</button>`;
    }).join("")}</div>
    <aside class="panel side-note"><span class="eyebrow">ON THE COUNTER</span><h3>${required} / 8 essentials</h3><p>Beef, onion, rice, and the five-part sauce are the heart of this bowl. Toppings are a lovely extra.</p><div class="picked-list">${pickedNames.length ? pickedNames.map((name) => `<span class="picked-chip">${escapeHTML(name)}</span>`).join("") : '<span class="ingredient-tag">Nothing picked up yet</span>'}</div></aside></div>
    ${hintMarkup()}${stageActions(required === 8)}`;
}

function renderRice() {
  const cooked = state.rice.cooked;
  const cooking = state.rice.cooking;
  return `${stageHead(2, "Give the rice a rinse", "Tap or swipe through the rice until the rinse water runs clear, then set the water level and cook.")}
    <div class="rice-layout"><section class="panel workbench"><h3>Rinse, rinse, rinse</h3><p>Rinsing removes extra surface starch for fluffy, distinct grains.</p>
      <div class="rice-basin" data-action="rinse" role="button" tabindex="0" aria-disabled="${cooking || cooked}" aria-label="Rinse the rice. Tap or press Enter to rinse"><div class="rice-bowl-art" aria-hidden="true">米</div></div>
      <div class="meter-label"><span>Water clarity</span><span>${Math.round(state.rice.rinse)}%</span></div><div class="meter" role="progressbar" aria-label="Rice water clarity" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(state.rice.rinse)}"><span style="width:${state.rice.rinse}%"></span></div>
      <div class="button-row" style="margin-top:12px"><button class="button button-secondary button-small" data-action="rinse" ${cooking || cooked ? "disabled" : ""}>Swish the rice <span aria-hidden="true">↻</span></button></div>
      <div class="slider-row"><div class="meter-label"><label for="water-amount">Water for 1 cup dry rice</label><output id="water-output">${Number(state.rice.water).toFixed(1)} cups</output></div><input id="water-amount" type="range" min="0.8" max="1.6" step="0.05" value="${state.rice.water}" aria-label="Water amount in cups"><div class="slider-readout"><span>0.8 cup</span><span>1.6 cups</span></div></div>
    </section><div class="cook-pot ${cooked ? "" : ""}" role="img" aria-label="A lidded pot of rice ${cooked ? "ready" : "waiting to cook"}"><div class="pot-shape"><span class="pot-content"><i></i><i></i><i></i></span></div></div></div>
    <p class="feedback" role="status">${cooked ? "The rice is ready: tender, glossy, and waiting in its pot." : cooking ? "The rice cooker is doing its quiet work." : state.rice.rinse >= 100 ? "Clear as a little mountain stream. Set the water and start the cooker." : "A few more swishes will clear the cloudy starch."}</p>
    ${hintMarkup()}${stageActions(cooked, cooked ? "Rice is ready" : cooking ? "Cooking…" : "Cook the rice", "cook-rice")}`;
}

function sauceRatio() {
  const amount = state.sauce.amounts;
  const sweet = amount.mirin + amount.sugar * 1.35;
  const savory = amount.soy + amount.dashi / 120 * 0.25 + amount.sake * 0.1;
  return sweet / Math.max(savory, 0.1);
}

function ratioText() {
  const ratio = sauceRatio();
  if (ratio < RECIPE.sauceTargetRatio - 0.11) return "Leaning savory · a touch more mirin or sugar could soften it.";
  if (ratio > RECIPE.sauceTargetRatio + 0.11) return "Leaning sweet · a little more shoyu will bring it back.";
  return "Just right · sweet, savory, and full of umami.";
}

function renderSauce() {
  const ratio = sauceRatio();
  const marker = Math.max(3, Math.min(97, 50 + (ratio - RECIPE.sauceTargetRatio) * 78));
  const nextId = RECIPE.sauceOrder[state.sauce.order.length];
  const orderDone = state.sauce.order.length === RECIPE.sauceOrder.length;
  const amountRows = ["mirin", "sugar", "soy"].map((id) => {
    const unit = id === "sugar" ? "tsp" : "tbsp";
    return `<div class="amount-row"><span>${RECIPE.sauceLabels[id]}</span><button class="step-button" data-amount="${id}" data-delta="-0.5" aria-label="Use less ${RECIPE.sauceLabels[id]}">−</button><span class="amount-value">${state.sauce.amounts[id]} ${unit}</span><button class="step-button" data-amount="${id}" data-delta="0.5" aria-label="Use more ${RECIPE.sauceLabels[id]}">+</button></div>`;
  }).join("");
  return `${stageHead(3, "Build the warishita", "Add the sauce ingredients in order: dashi, sake, mirin, sugar, then shoyu. A gentle balance is the goal.")}
    <div class="sauce-layout"><section class="panel workbench"><h3>The pot wants ${nextId ? RECIPE.sauceLabels[nextId] : "a taste"}</h3><p>${orderDone ? "Everything is in. Tune the sweet-savory balance to your liking." : "Tap the next ingredient when you're ready; order gives the broth its layered flavor."}</p>
      <div class="order-list" aria-label="Sauce ingredient order">${RECIPE.sauceOrder.map((id, index) => `<span class="order-chip ${index < state.sauce.order.length ? "is-done" : index === state.sauce.order.length ? "is-next" : ""}"><b>${index < state.sauce.order.length ? "✓" : index + 1}</b>${RECIPE.sauceLabels[id]}</span>`).join("")}</div>
      <div class="button-row"><button class="button button-secondary" data-action="add-sauce" ${orderDone ? "disabled" : ""}>Add ${nextId ? RECIPE.sauceLabels[nextId] : "all added"}</button></div>
      ${orderDone ? `<div class="amount-controls">${amountRows}</div>` : ""}
    </section><section class="panel workbench"><h3>Sweet meets savory</h3><div class="ratio-meter" role="meter" aria-label="Sweet and savory balance" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(marker)}"><span class="ratio-marker" style="left:${marker}%"></span></div><div class="ratio-legend"><span>More savory</span><span>Balanced</span><span>More sweet</span></div><p class="feedback" role="status">${orderDone ? ratioText() : "The balance meter wakes up once your ingredients are in."}</p><div class="cook-pot" role="img" aria-label="Pot of warishita sauce"><div class="pot-shape"><span class="pot-content"><i></i><i></i><i></i></span></div></div></section></div>
    ${hintMarkup()}${stageActions(orderDone, "Simmer the onions next")}`;
}

function onionEvenness() {
  if (state.onion.cuts.length < 2) return 0;
  const positions = [...state.onion.cuts].sort((a, b) => a - b);
  const gaps = [positions[0], ...positions.slice(1).map((position, index) => position - positions[index]), 100 - positions.at(-1)];
  const mean = 100 / (RECIPE.onionCuts + 1);
  const deviation = gaps.reduce((sum, gap) => sum + Math.abs(gap - mean), 0) / gaps.length;
  return Math.max(0, Math.round(100 - deviation * 2.5));
}

function renderOnion() {
  const sliced = state.onion.cuts.length >= RECIPE.onionCuts;
  const simmering = Boolean(state.onion.timer);
  return `${stageHead(4, "Slice, then soften the onion", "Make ${RECIPE.onionCuts} even cuts across the onion. Add them to the sauce and keep the heat gentle while they soften.")}
    <div class="onion-layout"><section class="panel workbench"><h3>${sliced ? `Evenness: ${onionEvenness()} / 100` : `Cut ${state.onion.cuts.length} of ${RECIPE.onionCuts}`}</h3><p>Click or tap across the onion. Keyboard cooks: arrows move the knife, Space makes a cut.</p>
      <div class="onion-board" id="onion-board" role="button" tabindex="0" aria-label="Onion cutting board. Use arrow keys to move the knife and Space to cut."><span class="knife-position" style="left:${state.onion.knife}%"></span><div class="onion-whole">${state.onion.cuts.map((position) => `<span class="cut-mark" style="left:${position}%"></span>`).join("")}</div></div>
      <div class="button-row"><button class="button button-secondary button-small" data-action="cut" ${sliced ? "disabled" : ""}>Slice at knife <span aria-hidden="true">✂</span></button><button class="button button-text button-small" data-action="add-onion" ${!sliced || state.onion.soft || simmering ? "disabled" : ""}>Add to sauce</button></div>
      <div class="heat-options" role="group" aria-label="Choose simmer heat">${["low", "medium", "high"].map((heat) => `<button class="heat-choice" data-heat="${heat}" aria-pressed="${state.onion.heat === heat}" ${simmering || state.onion.soft ? "disabled" : ""}>${heat === "low" ? "Low" : heat === "medium" ? "Medium" : "High"}</button>`).join("")}</div>
      <div class="button-row"><button class="button button-primary button-small" data-action="simmer-onion" ${!sliced || !state.onion.added || state.onion.soft || simmering ? "disabled" : ""}>${simmering ? "Softening…" : "Start gentle simmer"}</button></div>
    </section><section class="panel workbench"><h3>Listen for the simmer</h3><div class="soft-onion ${state.onion.soft ? "is-soft" : ""}" role="img" aria-label="Onion slices ${state.onion.soft ? "soft and translucent" : "waiting in sauce"}"><span></span><span></span><span></span></div><p class="feedback" role="status">${state.onion.burned ? "Too hot: the sauce caught at the bottom." : state.onion.soft ? "Soft and translucent, just right for the beef." : simmering ? "Keep the heat calm and let the onion turn sweet." : "Medium heat is the cozy middle path."}</p></section></div>
    ${hintMarkup()}${stageActions(state.onion.soft, "Add the beef")}`;
}

function timingWindow() { return RECIPE.beefTimingWindows[state.difficulty]; }

function renderBeef() {
  const allDropped = state.beef.portions >= RECIPE.beefPortions;
  const cooking = Boolean(state.beef.timer);
  const window = timingWindow();
  const progress = Math.min(100, state.beef.elapsed / window.total * 100);
  const start = window.start / window.total * 100;
  const width = (window.end - window.start) / window.total * 100;
  const strips = Array.from({ length: state.beef.portions }, (_, index) => `<span class="beef-strip ${state.beef.done ? "is-cooked" : ""}" aria-label="Beef portion ${index + 1}"></span>`).join("");
  const foamCount = Math.max(0, Math.min(4, 2 + Math.floor(state.beef.elapsed / 2)) - state.beef.skimmed);
  const scoreText = state.beef.result === null ? "" : state.beef.result >= 90 ? "Lovely timing: the beef stays tender." : state.beef.result >= 65 ? "Nearly there. A few seconds changed the texture." : "A little under or over. The next bowl will be even better.";
  return `${stageHead(5, "Let the beef stay tender", "Slide the beef in one piece at a time and gently separate it. Tap away the aku (foam), then lift it when the timing bar reaches the green window.")}
    <div class="beef-layout"><section class="panel workbench"><h3>${state.beef.done ? "Beef is ready" : `Beef portions · ${state.beef.portions} / ${RECIPE.beefPortions}`}</h3><p>Small batches help the slices cook evenly in the simmering sauce.</p>
      <div class="beef-pan" role="img" aria-label="Simmering pan with ${state.beef.portions} beef portions">${strips || '<span class="ingredient-tag">A gentle pot, ready for beef</span>'}</div>
      <div class="button-row" style="margin-top:20px"><button class="button button-secondary button-small" data-action="drop-beef" ${allDropped || cooking || state.beef.done ? "disabled" : ""}>Add a beef slice</button><button class="button button-text button-small" data-action="separate-beef" ${!state.beef.portions || state.beef.separated >= state.beef.portions || cooking || state.beef.done ? "disabled" : ""}>Gently separate (${state.beef.separated}/${state.beef.portions})</button></div>
      <div class="foam-row" aria-label="Aku foam to skim">${Array.from({ length: foamCount }, (_, index) => `<button class="foam-bubble" data-action="skim" aria-label="Skim aku foam bubble ${index + 1}" title="Skim aku"></button>`).join("")}${state.beef.skimmed ? `<span class="ingredient-tag">Aku skimmed: ${state.beef.skimmed}</span>` : '<span class="ingredient-tag">Aku means the light foam that rises as the beef simmers.</span>'}</div>
      <button class="button button-primary button-small" data-action="start-beef" ${!allDropped || state.beef.separated < state.beef.portions || cooking || state.beef.done ? "disabled" : ""}>${cooking ? "Simmering…" : "Start the gentle simmer"}</button>
    </section><section class="panel workbench"><h3>Just no longer pink</h3><p>About 1–2 minutes of simmering in real cooking. This little game timer is quicker.</p>
      <div class="timing-track" role="progressbar" aria-label="Beef simmer timing" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><span class="timing-window" style="left:${start}%;width:${width}%"></span><span class="timing-progress" style="width:${progress}%"></span></div>
      <p class="timer-copy">${cooking ? `${state.beef.elapsed.toFixed(1)} sec · green is your tender window` : state.beef.done ? `Lifted at ${state.beef.elapsed.toFixed(1)} seconds` : `Perfect window: ${window.start}–${window.end} seconds`}</p><button class="button button-secondary button-small" data-action="lift-beef" ${!cooking ? "disabled" : ""}>Lift the beef</button><p class="feedback" role="status">${scoreText}</p></section></div>
    ${hintMarkup()}${stageActions(state.beef.done, "Assemble the bowl")}`;
}

function renderBowl(toppings = state.plate.toppingSelected) {
  const hasTopping = toppings.length > 0;
  return `<div class="final-bowl" id="serve-bowl" draggable="true" role="img" aria-label="Gyudon bowl. Drag to the table to serve."><span class="final-rice"></span><span class="final-beef"></span>${hasTopping ? '<span class="final-topping"></span><span class="final-onion"></span>' : ""}${toppings.includes("egg") ? '<span class="final-egg"></span>' : ""}</div>`;
}

function renderPlate() {
  const toppingOptions = RECIPE.toppings.filter((item) => state.picked.includes(item.id));
  return `${stageHead(6, "A bowl, made your way", "Scoop rice, lay the beef and onions over top with a little sauce, add any toppings you like, and bring your bowl to the table.")}
    <div class="plate-layout"><section class="panel workbench"><h3>Build your gyudon</h3><div class="button-row"><button class="button button-secondary button-small" data-action="scoop-rice" ${state.plate.rice ? "disabled" : ""}>${state.plate.rice ? "Rice scooped ✓" : "Scoop the rice"}</button><button class="button button-secondary button-small" data-action="add-beef-plate" ${!state.plate.rice || state.plate.beef ? "disabled" : ""}>${state.plate.beef ? "Beef & sauce added ✓" : "Ladle beef & sauce"}</button></div>
      <h3 style="margin-top:22px">A little something extra</h3><div class="topping-options">${toppingOptions.length ? toppingOptions.map((item) => `<label class="topping-choice"><input type="checkbox" data-topping="${item.id}" ${state.plate.toppingSelected.includes(item.id) ? "checked" : ""}><span>${item.icon} ${escapeHTML(item.english)} <span class="ingredient-tag">${escapeHTML(item.japanese)}</span></span></label>`).join("") : '<span class="ingredient-tag">No toppings gathered. A simple bowl is lovely, too.</span>'}</div>
      <button class="button button-primary button-small" data-action="serve" ${!state.plate.rice || !state.plate.beef || state.plate.served ? "disabled" : ""}>${state.plate.served ? "Served with care ✓" : "Place bowl on the table"}</button>
    </section><section class="panel workbench"><h3>The finishing touch</h3><div class="plating-zone" id="plating-zone" aria-label="Table for your gyudon bowl">${renderBowl()}</div><p class="feedback" role="status">${state.plate.served ? "Itadakimasu! Your bowl is ready." : "You can drag the bowl to the table, or use the serve button."}</p></section></div>
    ${hintMarkup()}${stageActions(state.plate.served, "See your bowl")}`;
}

function finalScore() {
  return Math.round(Object.values(state.scores).reduce((sum, value) => sum + value, 0) / 6);
}

function feedbackLine() {
  const labels = { ingredients: "ingredients", rice: "rice", sauce: "the sauce", onion: "the onion", beef: "the beef", presentation: "presentation" };
  const scores = Object.entries(state.scores).sort((a, b) => a[1] - b[1]);
  if (scores.every(([, value]) => value >= 90)) return "A beautifully balanced bowl. Every little detail found its place.";
  const [lowest, value] = scores[0] || ["rice", 0];
  if (lowest === "beef") return value >= 65 ? "The sauce is lovely; a few seconds less would keep the beef extra tender." : "Next time, trust the gentle simmer and lift the beef in its green window.";
  if (lowest === "sauce") return "A cozy bowl, with room to bring the sweet and savory notes closer together.";
  if (lowest === "onion") return "The onions brought sweetness; more even slices would soften at the same pace.";
  if (lowest === "rice") return "The beef is the star; a clearer rinse and careful water measure make rice shine.";
  return `A warm bowl with good instincts. Your ${labels[lowest]} can shine even more next time.`;
}

function renderEnd() {
  const score = finalScore();
  const stars = Math.max(1, Math.min(5, Math.ceil(score / 20)));
  const scores = [
    ["ingredients", "Ingredient gathering"], ["rice", "Rice preparation"], ["sauce", "Sauce balance"],
    ["onion", "Onion slicing & simmer"], ["beef", "Beef timing & aku"], ["presentation", "Presentation"]
  ];
  return `<section class="end-layout"><div class="end-art" role="img" aria-label="A finished bowl of gyudon with rice, tender beef, red ginger, and green onion">${renderBowl(RECIPE.toppings.filter((item) => state.plate.toppingSelected.includes(item.id)).map((item) => item.id))}</div><div><span class="eyebrow">YOUR LITTLE MASTERPIECE</span><h2>One warm bowl,<br>made by you.</h2><div class="score-number">${score}<small> / 100</small></div><div class="stars" aria-label="${stars} out of 5 stars">${"★".repeat(stars)}${"☆".repeat(5 - stars)}</div><p class="lead" style="font-size:16px">${escapeHTML(feedbackLine())}</p>
    <div class="score-list" aria-label="Score by stage">${scores.map(([key, label]) => `<div class="score-row"><span>${label}</span><strong>${Math.round(state.scores[key] || 0)}</strong><div class="meter"><span style="width:${Math.round(state.scores[key] || 0)}%"></span></div></div>`).join("")}</div>
    <aside class="learned"><h3>What you learned</h3><ul><li>Gyudon is a beloved Japanese fast-food and home-cooking staple.</li><li>Warishita brings dashi, shoyu, sake, mirin, and sugar together.</li><li>Onion turns soft and sweet in the simmering sauce.</li><li>Skimming aku and lifting beef as soon as it is no longer pink helps keep it tender.</li></ul></aside>
    <button class="button button-primary" data-action="play-again">Cook another bowl <span aria-hidden="true">↻</span></button></div></section>`;
}

function addRinse(amount = 12) {
  state.rice.rinse = Math.min(100, state.rice.rinse + amount);
  render();
  playTone(480 + state.rice.rinse * 1.2);
}

function setHint() {
  if (state.difficulty === "chef") return;
  const hints = {
    1: "The eight essentials make the bowl; the four toppings are yours to choose.",
    2: "A cup of rice likes about 1.2 cups of water. The rinse meter needs a few swishes.",
    3: "Let dashi lead, then layer sake, mirin, sugar, and shoyu. Aim for the marker near the middle.",
    4: "Space the five cuts evenly. Medium heat gives the onion time to turn translucent.",
    5: "Separate every piece before simmering; the green window is the tender moment.",
    6: "A little sauce over the rice helps the beef settle in. Simple toppings work beautifully."
  };
  state.hint = hints[state.screen] || "Take it one gentle step at a time.";
  render();
}

function retryStage() {
  clearInterval(state.timer);
  state.timer = null;
  delete state.scores[{ 1: "ingredients", 2: "rice", 3: "sauce", 4: "onion", 5: "beef", 6: "presentation" }[state.screen]];
  if (state.screen === 1) state.picked = [];
  if (state.screen === 2) state.rice = { rinse: 0, water: RECIPE.riceWaterTarget, cooking: false, cooked: false };
  if (state.screen === 3) state.sauce = { order: [], amounts: { ...RECIPE.sauceAmounts } };
  if (state.screen === 4) state.onion = { cuts: [], knife: 50, heat: "medium", soft: false, burned: false, timer: null };
  if (state.screen === 5) state.beef = { portions: 0, separated: 0, foam: 0, skimmed: 0, elapsed: 0, done: false, result: null, timer: null };
  if (state.screen === 6) state.plate = { rice: false, beef: false, toppingSelected: [], served: false };
  render();
  showToast("Fresh start for this step. The rest of your bowl is safe.");
}

function scoreRice() {
  // Rinsing is worth 55%; water accuracy supplies the remaining 45%.
  const waterScore = Math.max(0, 100 - Math.abs(state.rice.water - RECIPE.riceWaterTarget) * 150);
  return Math.round(state.rice.rinse * 0.55 + waterScore * 0.45);
}

function scoreSauce() {
  // Blend sweet-savory balance with the ingredient order used in the pot.
  const ratioError = Math.abs(sauceRatio() - RECIPE.sauceTargetRatio);
  const balance = Math.max(0, 100 - ratioError * 95);
  let orderScore = 100;
  state.sauce.order.forEach((id, index) => { if (id !== RECIPE.sauceOrder[index]) orderScore -= 20; });
  return Math.round(balance * 0.65 + Math.max(0, orderScore) * 0.35);
}

function scoreIngredients() {
  // Essentials carry most of the credit; optional toppings add a small bonus.
  const essentials = RECIPE.coreIngredients.filter((item) => state.picked.includes(item.id)).length / RECIPE.coreIngredients.length;
  const toppings = RECIPE.toppings.filter((item) => state.picked.includes(item.id)).length / RECIPE.toppings.length;
  return Math.round(essentials * 85 + toppings * 15);
}

function scoreOnion() {
  // Even slices and a medium simmer reward steady, gentle prep.
  return Math.round(onionEvenness() * 0.7 + (state.onion.heat === "medium" ? 30 : state.onion.heat === "low" ? 22 : 0));
}

function scoreBeef() {
  // Timing and visible aku skimming both contribute to tender, clear broth.
  const window = timingWindow();
  const midpoint = (window.start + window.end) / 2;
  const halfWindow = (window.end - window.start) / 2;
  const timing = Math.max(0, 100 - Math.abs(state.beef.elapsed - midpoint) / halfWindow * 100);
  const skim = Math.min(100, state.beef.skimmed * 35);
  return Math.round(timing * 0.7 + skim * 0.3);
}

function scorePresentation() {
  // Serving the bowl is the gate; optional toppings add up to twenty points.
  const toppings = Math.min(4, state.plate.toppingSelected.length) * 5;
  return Math.round(75 + toppings);
}

function bindStageEvents() {
  view.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", (event) => handleAction(element.dataset.action, element, event));
  });
  view.querySelectorAll("[data-item]").forEach((button) => button.addEventListener("click", () => {
    const item = [...RECIPE.coreIngredients, ...RECIPE.toppings, ...RECIPE.decoys].find((entry) => entry.id === button.dataset.item);
    if (RECIPE.decoys.some((entry) => entry.id === item.id)) {
      showToast(`${item.english} is lovely elsewhere; not in this bowl. ${item.japanese}`);
      playTone(250);
      return;
    }
    if (!state.picked.includes(item.id)) state.picked.push(item.id);
    showToast(`${item.japanese} · ${item.english}`);
    playTone();
    render();
  }));
  view.querySelectorAll("[data-amount]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.amount;
    const step = Number(button.dataset.delta);
    const max = id === "sugar" ? 3 : 4;
    state.sauce.amounts[id] = Math.max(0, Math.min(max, Math.round((state.sauce.amounts[id] + step) * 2) / 2));
    render();
  }));
  view.querySelectorAll("[data-heat]").forEach((button) => button.addEventListener("click", () => {
    if (state.onion.soft || state.onion.timer) return;
    state.onion.heat = button.dataset.heat;
    render();
  }));
  const water = view.querySelector("#water-amount");
  water?.addEventListener("input", () => {
    state.rice.water = Number(water.value);
    view.querySelector("#water-output").textContent = `${state.rice.water.toFixed(2)} cups`;
  });
  water?.addEventListener("change", render);
  view.querySelectorAll("[data-topping]").forEach((input) => input.addEventListener("change", () => {
    const id = input.dataset.topping;
    state.plate.toppingSelected = input.checked ? [...new Set([...state.plate.toppingSelected, id])] : state.plate.toppingSelected.filter((item) => item !== id);
    render();
  }));
  const onionBoard = view.querySelector("#onion-board");
  onionBoard?.addEventListener("click", (event) => {
    if (state.onion.cuts.length >= RECIPE.onionCuts) return;
    const rect = onionBoard.getBoundingClientRect();
    const relative = Math.max(8, Math.min(92, ((event.clientX - rect.left) / rect.width) * 100));
    cutOnion(relative);
  });
  onionBoard?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      state.onion.knife = Math.max(8, Math.min(92, state.onion.knife + (event.key === "ArrowRight" ? 8 : -8)));
      render();
      view.querySelector("#onion-board")?.focus();
    } else if (event.key === " ") {
      event.preventDefault();
      cutOnion(state.onion.knife);
    }
  });
  const bowl = view.querySelector("#serve-bowl");
  const table = view.querySelector("#plating-zone");
  bowl?.addEventListener("dragstart", (event) => event.dataTransfer?.setData("text/plain", "gyudon"));
  table?.addEventListener("dragover", (event) => { event.preventDefault(); table.classList.add("is-over"); });
  table?.addEventListener("dragleave", () => table.classList.remove("is-over"));
  table?.addEventListener("drop", (event) => { event.preventDefault(); table.classList.remove("is-over"); serveBowl(); });
  bowl?.addEventListener("pointerdown", (event) => { bowl.setPointerCapture(event.pointerId); });
  bowl?.addEventListener("pointerup", (event) => {
    const rect = table?.getBoundingClientRect();
    if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) serveBowl();
  });
}

function cutOnion(position) {
  if (state.onion.cuts.length >= RECIPE.onionCuts) return;
  state.onion.cuts.push(Math.round(position));
  playTone(600);
  render();
}

function serveBowl() {
  if (!state.plate.rice || !state.plate.beef || state.plate.served) return;
  state.plate.served = true;
  render();
}

function handleAction(action, element, event) {
  if (action === "start") { goTo(1); return; }
  if (action === "how") { document.querySelector("#how-dialog").showModal(); return; }
  if (action === "hint") { setHint(); return; }
  if (action === "retry") { retryStage(); return; }
  if (action === "next") {
    if (state.screen === 1) state.scores.ingredients = scoreIngredients();
    if (state.screen === 2) state.scores.rice = scoreRice();
    if (state.screen === 3) state.scores.sauce = scoreSauce();
    if (state.screen === 4) state.scores.onion = scoreOnion();
    if (state.screen === 5) state.scores.beef = scoreBeef();
    if (state.screen === 6) { state.scores.presentation = scorePresentation(); goTo("end"); return; }
    goTo(state.screen + 1);
    return;
  }
  if (action === "play-again") { resetGame(); return; }
  if (action === "rinse") { if (state.rice.rinse < 100 && !state.rice.cooked && !state.rice.cooking) addRinse(14); return; }
  if (action === "cook-rice") {
    if (state.rice.rinse < 100 || state.rice.cooked || state.rice.cooking) return;
    state.rice.cooking = true;
    render();
    state.timer = setTimeout(() => {
      const waterDifference = Math.abs(state.rice.water - RECIPE.riceWaterTarget);
      state.rice.cooking = false;
      state.rice.cooked = true;
      render();
      showToast(waterDifference < 0.1 ? "Lovely water measure. Fluffy rice, coming up." : waterDifference < 0.25 ? "The rice is cooked. Water was a little off the mark." : "Rice is cooked; next time, try a little closer to 1.2 cups.");
      playTone(640);
    }, state.difficulty === "easy" ? 2600 : 3400);
    return;
  }
  if (action === "add-sauce") {
    const next = RECIPE.sauceOrder[state.sauce.order.length];
    if (next) state.sauce.order.push(next);
    render();
    playTone(500 + state.sauce.order.length * 40);
    return;
  }
  if (action === "cut") { cutOnion(state.onion.knife); return; }
  if (action === "add-onion") { state.onion.added = true; showToast("The onion slips into the sauce."); render(); return; }
  if (action === "simmer-onion") {
    if (state.onion.cuts.length < RECIPE.onionCuts || !state.onion.added) return;
    state.onion.timer = true;
    render();
    const duration = RECIPE.simmerSeconds[state.difficulty] * 1000;
    state.timer = setTimeout(() => {
      state.onion.soft = true;
      state.onion.burned = state.onion.heat === "high";
      state.onion.timer = null;
      render();
      playTone(state.onion.burned ? 220 : 660);
    }, duration);
    return;
  }
  if (action === "drop-beef") {
    state.beef.portions = Math.min(RECIPE.beefPortions, state.beef.portions + 1);
    render();
    return;
  }
  if (action === "separate-beef") {
    state.beef.separated = Math.min(state.beef.portions, state.beef.separated + 1);
    render();
    return;
  }
  if (action === "skim") {
    state.beef.skimmed++;
    render();
    playTone(720);
    return;
  }
  if (action === "start-beef") { startBeefTimer(); return; }
  if (action === "lift-beef") { finishBeefTimer(); return; }
  if (action === "scoop-rice") { state.plate.rice = true; render(); return; }
  if (action === "add-beef-plate") { state.plate.beef = true; render(); return; }
  if (action === "serve") { serveBowl(); return; }
}

function startBeefTimer() {
  const window = timingWindow();
  state.beef.elapsed = 0;
  state.beef.done = false;
  state.beef.result = null;
  state.beef.timer = true;
  render();
  state.timer = setInterval(() => {
    state.beef.elapsed = Math.round((state.beef.elapsed + 0.1) * 10) / 10;
    const progress = view.querySelector(".timing-progress");
    const track = view.querySelector(".timing-track");
    if (progress) progress.style.width = `${Math.min(100, state.beef.elapsed / window.total * 100)}%`;
    if (track) track.setAttribute("aria-valuenow", String(Math.round(Math.min(100, state.beef.elapsed / window.total * 100))));
    const copy = view.querySelector(".timer-copy");
    if (copy) copy.textContent = `${state.beef.elapsed.toFixed(1)} sec · green is your tender window`;
    if (state.beef.elapsed >= window.total) finishBeefTimer();
  }, 100);
}

function finishBeefTimer() {
  if (!state.beef.timer) return;
  clearInterval(state.timer);
  state.timer = null;
  state.beef.timer = false;
  state.beef.done = true;
  state.beef.result = scoreBeef();
  state.scores.beef = state.beef.result;
  render();
  playTone(state.beef.result >= 70 ? 680 : 250);
}

function resetGame() {
  clearInterval(state.timer);
  state.screen = "title";
  state.picked = [];
  state.scores = {};
  state.rice = { rinse: 0, water: RECIPE.riceWaterTarget, cooking: false, cooked: false };
  state.sauce = { order: [], amounts: { ...RECIPE.sauceAmounts } };
  state.onion = { cuts: [], knife: 50, heat: "medium", soft: false, burned: false, timer: null };
  state.beef = { portions: 0, separated: 0, foam: 0, skimmed: 0, elapsed: 0, done: false, result: null, timer: null };
  state.plate = { rice: false, beef: false, toppingSelected: [], served: false };
  render();
}

document.querySelector("#sound-toggle").addEventListener("click", () => {
  state.sound = !state.sound;
  updateSoundButton();
  if (state.sound) playTone();
});
document.querySelector("#how-dialog .dialog-close").addEventListener("click", () => document.querySelector("#how-dialog").close());
document.querySelector("#how-dialog .dialog-done").addEventListener("click", () => document.querySelector("#how-dialog").close());
document.addEventListener("change", (event) => {
  if (event.target.id === "difficulty") state.difficulty = event.target.value;
  if (event.target.id === "motion-toggle") {
    state.reduceMotion = event.target.checked;
    document.body.classList.toggle("reduce-motion", state.reduceMotion);
  }
});
document.querySelector("#game").setAttribute("tabindex", "-1");
document.body.classList.toggle("reduce-motion", state.reduceMotion);
updateSoundButton();
render();