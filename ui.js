const CAPTION_FADE_MS = 350;  
const OUTRO_FADE_MS = 2400;   
const CLOSING_FADE_MS = 1000;
const CLOSING_GAP_MS = 350;  
const CLOSING_LAST_MS = 1200;


const WORD_MS = 90;
const WORD_MS_PER_CHAR = 15;
const WORD_MS_CAP = 120;
const BREATH_MS = 130;       
const FULL_STOP_MS = 250;     


function gapAfter(word) {
  const gap = Math.min(WORD_MS + word.length * WORD_MS_PER_CHAR, WORD_MS_CAP);
  if (/[.?!\u2026]['"\u2019)\]]?$/.test(word)) return gap + FULL_STOP_MS;
  if (/[,;:\u2014\u2013]['"\u2019)\]]?$/.test(word)) return gap + BREATH_MS;
  return gap;
}

function isHint(line) {
  return /^\(.*\)$/.test(line.trim());
}

function readingTime(line) {
  const rest = 1000 + line.length * 20;
  return isHint(line) ? rest + 1600 : rest;
}


function outroHold(line) {
  return 1400 + line.length * 28;
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const Caption = {
  el: null,
  queue: [],
  token: 0,
  playing: false,
  revealing: false,
  words: [],
  current: null,
  wordTimer: null,
  holdTimer: null,
  fadeTimer: null,

  say(lines, onDone) {
    lines.forEach((line, i) => {
      this.queue.push({ line, onDone: i === lines.length - 1 ? onDone : null });
    });
    if (!this.playing) this._next(this.token);
  },

  clear() {
    this.token++;
    this.queue = [];
    this.playing = false;
    this.revealing = false;
    this.words = [];
    this._stopTimers();
    this.el.classList.remove('show');
    document.body.classList.remove('is-narrating');
  },

  
  skip() {
    if (!this.revealing) return;
    clearTimeout(this.wordTimer);
    this.words.forEach((word) => word.classList.add('in'));
    this._settle(this.token, this.current);
  },

  _stopTimers() {
    clearTimeout(this.wordTimer);
    clearTimeout(this.holdTimer);
    clearTimeout(this.fadeTimer);
  },

  _next(token) {
    if (token !== this.token) return;
    const item = this.queue.shift();
    this.el.classList.remove('show');
    if (!item) {
      this.playing = false;
      document.body.classList.remove('is-narrating');
      return;
    }
    this.playing = true;
    const wait = this.el.textContent ? CAPTION_FADE_MS : 0;
    this.fadeTimer = setTimeout(() => {
      if (token !== this.token) return;
      this._reveal(token, item);
    }, wait);
  },

  
  _reveal(token, item) {
    this.current = item;
    this.el.textContent = '';
    this.el.classList.toggle('is-hint', isHint(item.line));
    document.body.classList.add('is-narrating');
    this.words = item.line.split(' ').map((word, i) => {
      if (i) this.el.appendChild(document.createTextNode(' '));
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = word;
      this.el.appendChild(span);
      return span;
    });
    this.el.classList.add('show');

    if (prefersReducedMotion.matches) {
      this.words.forEach((word) => word.classList.add('in'));
      this._settle(token, item);
      return;
    }

    this.revealing = true;
    let i = 0;
    const step = () => {
      if (token !== this.token) return;
      this.words[i].classList.add('in');
      const previous = this.words[i].textContent;
      i++;
      if (i >= this.words.length) this._settle(token, item);
      else this.wordTimer = setTimeout(step, gapAfter(previous));
    };
    step();
  },

  _settle(token, item) {
    this.revealing = false;
    this.holdTimer = setTimeout(() => {
      if (token !== this.token) return;
      if (item.onDone) item.onDone();
      this._next(token);
    }, readingTime(item.line));
  }
};

const UI = {
  outroToken: 0,

  init(actions) {
    this.tabs = [...document.querySelectorAll('.tab')];
    this.prevBtn = document.getElementById('prevBtn');
    this.nextBtn = document.getElementById('nextBtn');
    this.homeScreen = document.getElementById('homeScreen');
    this.outro = document.getElementById('outro');
    this.closingLine = document.getElementById('closingLine');
    this.outroHomeBtn = document.getElementById('outroHomeBtn');
    Caption.el = document.getElementById('caption');

    window.addEventListener('pointerdown', () => Caption.skip());

    this.tabs.forEach((tab, i) => tab.addEventListener('click', () => actions.goTo(i)));
    this.prevBtn.addEventListener('click', actions.prev);
    this.nextBtn.addEventListener('click', actions.next);
    document.getElementById('homeBtn').addEventListener('click', actions.home);
    document.getElementById('beginBtn').addEventListener('click', actions.begin);
    this.outroHomeBtn.addEventListener('click', actions.home);
  },

  // journey: { current, done[], seen[], unlocked[] }
  refresh(journey) {
    const { current, done, seen, unlocked } = journey;
    this.tabs.forEach((tab, i) => {
      tab.setAttribute('aria-current', i === current ? 'true' : 'false');
      tab.disabled = !unlocked[i];
    });
    this.prevBtn.disabled = current === 0;
    this.nextBtn.disabled = !done[current];
    const isLast = current === done.length - 1;
    this.nextBtn.classList.toggle('ready', done[current] && (isLast || !seen[current + 1]));
  },

  showHome() {
    this.outroToken++;
    document.body.classList.add('is-home');
    document.body.classList.remove('is-outro');
    this.homeScreen.classList.remove('is-hidden');
    this.outro.classList.add('is-hidden');
    this.closingLine.classList.remove('show');
    this.outroHomeBtn.classList.remove('show');
  },

  hideHome() {
    document.body.classList.remove('is-home');
    this.homeScreen.classList.add('is-hidden');
  },
  playOutro(lines) {
    const token = ++this.outroToken;
    const queue = [].concat(lines);
    document.body.classList.add('is-outro');
    this.outro.classList.remove('is-hidden');
    this.closingLine.classList.remove('show');
    this.closingLine.textContent = '';

    const step = (i) => {
      if (token !== this.outroToken) return;
      const line = queue[i];
      const last = i === queue.length - 1;

      this.closingLine.textContent = line;
      this.closingLine.classList.add('show');

      setTimeout(() => {
        if (token !== this.outroToken) return;
        if (last) {
          this.outroHomeBtn.classList.add('show');
          return;
        }
        this.closingLine.classList.remove('show');
        setTimeout(() => step(i + 1), CLOSING_FADE_MS + CLOSING_GAP_MS);
      }, CLOSING_FADE_MS + outroHold(line) + (last ? CLOSING_LAST_MS : 0));
    };

    if (!queue.length) {
      setTimeout(() => {
        if (token === this.outroToken) this.outroHomeBtn.classList.add('show');
      }, OUTRO_FADE_MS);
      return;
    }
    setTimeout(() => step(0), OUTRO_FADE_MS);
  }
};