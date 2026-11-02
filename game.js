const TIME_LIMIT_MS = 10000;
const MAX_MISSES = 2;
const HIT_MARGIN = 0.015;

const el = (id) => document.getElementById(id);
const frame = el("frame");
const result = el("result");
const giveUp = el("give-up");
const next = el("next");

const cats = CATS.filter((cat) => cat.boxes.length);
if (!cats.length) location.replace("picker.html");

// Load everything up front so a slow download never eats into the timer.
for (const cat of cats) {
  cat.img = new Image();
  cat.img.src = cat.src;
  cat.img.alt = "";
  cat.img.draggable = false;
}

let deck = [];
let round = 0;
let lived = 0;
let died = 0;
let misses = 0;
let playing = false;
let startedAt = 0;
let findTimes = [];

const elapsed = () => performance.now() - startedAt;
const outOfTime = () => elapsed() > TIME_LIMIT_MS;

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function show(screen) {
  for (const id of ["start", "game", "score"]) el(id).hidden = id !== screen;
}

function startGame() {
  deck = shuffle(cats);
  round = 0;
  lived = 0;
  died = 0;
  findTimes = [];
  show("game");
  startRound();
}

async function startRound() {
  if (round === deck.length) return showScore();

  const cat = deck[round];
  frame.replaceChildren();
  result.hidden = true;
  next.hidden = true;
  giveUp.hidden = true;

  try {
    await cat.img.decode();
  } catch {
    round++;
    return startRound();
  }

  frame.style.setProperty("--ratio", cat.img.naturalWidth / cat.img.naturalHeight);
  frame.append(cat.img);
  giveUp.hidden = false;
  misses = 0;
  playing = true;
  startedAt = performance.now();
}

function endRound(found) {
  if (!playing) return;
  playing = false;

  if (found) findTimes.push(elapsed());

  const survived = found && !outOfTime();
  if (survived) lived++;
  else died++;

  const outcome = survived ? "lived" : "died";
  for (const { x, y, w, h } of deck[round].boxes) {
    const box = document.createElement("div");
    box.className = `box ${outcome}`;
    box.style.cssText = `left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%`;
    frame.append(box);
  }

  if (survived) result.textContent = "You lived";
  else if (found) result.textContent = "Too slow, you would have died";
  else result.textContent = "You died";
  result.className = outcome;
  result.hidden = false;
  giveUp.hidden = true;
  next.hidden = false;
  next.focus();
}

function showScore() {
  el("lived-count").textContent = lived;
  el("died-count").textContent = died;

  el("median").hidden = !findTimes.length;
  el("median").textContent = `Median time it took you to find the cat: ${(median(findTimes) / 1000).toFixed(1)}s`;

  if (died === 0) el("verdict").textContent = "You avoided all of the cats!";
  else if (lived > died) el("verdict").textContent = "You avoided most of the cats";
  else el("verdict").textContent = "The cats are eating good today";
  show("score");
}

function markMiss(x, y) {
  const miss = document.createElement("div");
  miss.className = "miss";
  miss.style.left = `${x * 100}%`;
  miss.style.top = `${y * 100}%`;
  miss.addEventListener("animationend", () => miss.remove());
  frame.append(miss);
}

frame.addEventListener("click", (event) => {
  if (!playing) return;
  const rect = frame.getBoundingClientRect();
  const clickX = (event.clientX - rect.left) / rect.width;
  const clickY = (event.clientY - rect.top) / rect.height;
  const found = deck[round].boxes.some(
    ({ x, y, w, h }) =>
      clickX >= x - HIT_MARGIN &&
      clickX <= x + w + HIT_MARGIN &&
      clickY >= y - HIT_MARGIN &&
      clickY <= y + h + HIT_MARGIN
  );

  if (found) return endRound(true);

  markMiss(clickX, clickY);
  misses++;
  if (misses > MAX_MISSES && !outOfTime()) endRound(false);
});

el("begin").addEventListener("click", startGame);
el("again").addEventListener("click", startGame);
giveUp.addEventListener("click", () => endRound(false));
next.addEventListener("click", () => {
  round++;
  startRound();
});
