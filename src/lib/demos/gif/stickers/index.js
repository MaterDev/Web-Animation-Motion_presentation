// @ts-nocheck -- sheet code, untyped on the sheet
import { stage } from '../../_kit/stage.js';
import { disposer } from '../../_kit/disposer.js';
import css from './demo.css?raw';
import htmlRaw from './demo.html?raw';

const ASSET = {
  idle: new URL('./assets/slime-idle.gif', import.meta.url).href,
  eat: new URL('./assets/slime-eat.gif', import.meta.url).href,
  sleep: new URL('./assets/slime-sleep.gif', import.meta.url).href,
  happy: new URL('./assets/slime-happy.gif', import.meta.url).href,
};

/* the markup keeps the sheet's relative asset paths; they are pointed at
   this folder's copies here */
const html = htmlRaw
  .replaceAll('assets/slime-idle.gif', ASSET.idle)
  .replaceAll('assets/slime-eat.gif', ASSET.eat)
  .replaceAll('assets/slime-sleep.gif', ASSET.sleep)
  .replaceAll('assets/slime-happy.gif', ASSET.happy);

export function mount(host) {
  const { root } = stage(host, { css, html });
  const d = disposer();
  if (window.top !== window.self) root.getElementById('crumb').style.display = 'none';

  /* The conversation is an async loop paced by timeouts. Every pending
     timeout is tracked so dispose can clear them; a cleared wait never
     resolves, so the loop simply stops where it was. The set drops each
     id as it fires, so a long-running demo does not accumulate them. */
  const timers = new Set();
  d.add(() => { timers.forEach(clearTimeout); timers.clear(); });

  (function () {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const GIFS = { idle: ASSET.idle, eat: ASSET.eat, sleep: ASSET.sleep, happy: ASSET.happy };
    const MOOD_LABEL = { idle: 'checking', eat: 'working', sleep: 'resting', happy: 'celebrating' };
    // hp/nrg/soc aren't just decorative — they move with the mood, the
    // way an actual digital pet's stats respond to what it's doing
    const STATS = {
      idle:  { hp: 74, nrg: 78, soc: 55 },
      eat:   { hp: 62, nrg: 58, soc: 88 },
      happy: { hp: 96, nrg: 90, soc: 82 },
      sleep: { hp: 45, nrg: 22, soc: 12 },
    };
    const BEATS = [
      { who: 'ai', mood: 'idle', text: "deploy's stuck on the queue — let me check" },
      { who: 'human', text: '10 minutes stuck and counting 😩' },
      { who: 'ai', mood: 'eat', sticker: true, text: 'on it — chewing through the queue now' },
      { who: 'human', text: 'any luck??' },
      { who: 'ai', mood: 'happy', sticker: true, text: 'fixed it!! 🎉 bad node in the pool' },
      { who: 'human', text: 'amazing, thank you!! going to bed' },
      { who: 'ai', mood: 'sleep', text: 'goodnight 🌙', last: true },
    ];

    const screen = root.getElementById('tamaScreen');
    const pet = root.getElementById('tamaPet');
    const moodEl = root.getElementById('tamaMood');
    const headerAvatar = root.getElementById('headerAvatar');
    const log = root.getElementById('aiChatLog');
    const typedEl = root.getElementById('chatTypedText');
    const sendBtn = root.getElementById('chatSend');
    const statHp = root.getElementById('statHp');
    const statNrg = root.getElementById('statNrg');
    const statSoc = root.getElementById('statSoc');
    const wait = ms => new Promise(r => {
      const id = setTimeout(() => { timers.delete(id); r(); }, reduce ? 0 : ms);
      timers.add(id);
    });

    function setMood(mood) {
      screen.dataset.mood = mood;
      const src = GIFS[mood] + '?m=' + mood; // force GIF restart on mood change, not just src swap
      pet.src = src;
      headerAvatar.src = src;
      moodEl.textContent = MOOD_LABEL[mood];
      const s = STATS[mood];
      statHp.style.width = s.hp + '%';
      statNrg.style.width = s.nrg + '%';
      statSoc.style.width = s.soc + '%';
    }

    function bubble(text) {
      const el = document.createElement('div');
      el.className = 'mock-bubble pop-in';
      el.textContent = text;
      return el;
    }

    function typing(show) {
      let el = log.querySelector('.typing');
      if (show && !el) {
        el = document.createElement('div');
        el.className = 'ai-turn';
        el.innerHTML = '<span class="gif-frame"><img class="ai-avatar" src="' + pet.src + '" alt="assistant"></span><div class="typing pop-in"><span></span><span></span><span></span></div>';
        log.appendChild(el);
        log.scrollTop = log.scrollHeight;
      } else if (!show && el) {
        el.closest('.ai-turn').remove();
      }
    }

    // types the human's line into the input pill character by character,
    // pauses, then "sends" it — the pacing beat that actually sells a
    // live conversation instead of a bubble slideshow
    async function typeAndSend(text) {
      typedEl.textContent = '';
      sendBtn.classList.remove('armed');
      for (let i = 0; i < text.length; i++) {
        typedEl.textContent += text[i];
        await wait(38 + Math.random() * 46);
      }
      sendBtn.classList.add('armed');
      await wait(550);
      typedEl.textContent = '';
      sendBtn.classList.remove('armed');
    }

    async function play() {
      log.innerHTML = '';
      setMood('idle');
      const divider = document.createElement('span');
      divider.className = 'ts-divider';
      divider.textContent = 'today · 11:42 pm';
      log.appendChild(divider);

      for (const beat of BEATS) {
        if (beat.who === 'human') {
          await typeAndSend(beat.text);
        } else {
          typing(true);
          await wait(1700);
          typing(false);
          setMood(beat.mood);
        }

        const row = document.createElement('div');
        if (beat.sticker) {
          // a sticker send is still followed by a line — a real companion
          // doesn't just lob an emotion at you and go silent
          row.className = 'ai-turn ai-turn-sticker pop-in';
          row.innerHTML = `<span class="gif-frame"><img class="ai-avatar" src="${GIFS[beat.mood]}" alt="assistant"></span><span class="gif-frame"><img class="mock-sticker-pop sm" src="${GIFS[beat.mood]}" alt="assistant sticker"></span>`;
          log.appendChild(row);
          log.scrollTop = log.scrollHeight;
          await wait(900);
          const followUp = document.createElement('div');
          followUp.className = 'ai-turn pop-in';
          followUp.innerHTML = `<span class="gif-frame"><img class="ai-avatar" src="${GIFS[beat.mood]}" alt="assistant"></span>`;
          followUp.appendChild(bubble(beat.text));
          log.appendChild(followUp);
          log.scrollTop = log.scrollHeight;
          await wait(2200);
          continue;
        } else if (beat.who === 'ai') {
          row.className = 'ai-turn pop-in';
          row.innerHTML = `<span class="gif-frame"><img class="ai-avatar" src="${GIFS[beat.mood]}" alt="assistant"></span>`;
          row.appendChild(bubble(beat.text));
        } else {
          row.className = 'human-turn pop-in';
          row.appendChild(bubble(beat.text));
          const av = document.createElement('div');
          av.className = 'human-avatar';
          row.appendChild(av);
        }
        log.appendChild(row);

        if (beat.last) {
          const d = document.createElement('span');
          d.className = 'delivered';
          d.textContent = 'read · 11:47 pm';
          log.appendChild(d);
        }

        log.scrollTop = log.scrollHeight;
        await wait(2200);
      }
      await wait(3800);
      play();
    }
    play();

    /* The periodic reveal (restored, Key): every GIF on the slide gets the
       red trace together on its own clock, so the actual GIF canvas is
       findable. The sheet's version also reached into the agent roster;
       this one is scoped to this demo's root and reads the stickers too. */
    if (!reduce) {
      d.interval(() => {
        root.querySelectorAll('.gif-frame').forEach((el) => {
          el.classList.remove('gif-pulse');
          void el.offsetWidth;
          el.classList.add('gif-pulse');
        });
      }, 4200);
    }
  })();

  return () => { d.run(); root.innerHTML = ''; };
}
