(() => {
  'use strict';
  const photos = window.ARCHIVE_PHOTOS;
  const heroYacht = {...photos.find(p => p.id === 64)};
  const heroCat = {...photos.find(p => p.id === 44),fullImage:'assets/header-cat.webp'};
  const heroPhotos = [heroYacht,heroCat];

  const gallery = document.getElementById('gallery');
  const more = document.getElementById('more');
  const viewer = document.getElementById('viewer');
  const services = document.getElementById('services-dialog');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cards = new Map(), animations = new Set();
  let filter = 'all', limit = 24, shown = [], viewing = null, viewerSequence = photos;
  let priorFocus = null, servicesFocus = null, lastRandom = null;
  const pad = n => String(n).padStart(3, '0');
  const unavailable = new Set();
  let request = 0;
  const syncModalLock = () => document.body.classList.toggle('viewer-open', viewer.open || services.open);
  function animate(element, frames, options) {
    if (motion.matches || typeof element.animate !== 'function') return;
    const animation = element.animate(frames, options);
    animations.add(animation);
    animation.onfinish = animation.oncancel = () => animations.delete(animation);
  }
  function makeCard(p) {
    const card = document.createElement('div'); card.className = 'gallery-card'; card.dataset.key = String(p.id); card.dataset.featured = String(!!p.featured);
    const figure = document.createElement('figure'); figure.className = 'photo-print'; figure.style.setProperty('--print-paper',p.frame === 'cool' ? '#C8C9C7' : '#D8CFC3');
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'photo-open'; button.dataset.photo = p.id;
    button.setAttribute('aria-label', 'Открыть фотографию: ' + p.alt);
    const img = document.createElement('img'); img.src = p.thumbnail; img.srcset = p.srcSet; img.sizes = '(max-width: 439px) 88vw, (max-width: 1050px) 44vw, 23vw'; img.alt = p.alt;
    img.addEventListener('error', () => { if (img.dataset.retried) { unavailable.add(p.id); return; } img.dataset.retried = 'true'; img.removeAttribute('srcset'); img.src = p.fullImage; });
    img.width = p.width; img.height = p.height; img.loading = 'lazy'; img.decoding = 'async';
    const hint = document.createElement('span'); hint.className = 'photo-hint';
    hint.textContent = '↗'; hint.setAttribute('aria-hidden', 'true'); button.append(img, hint);
    const caption = document.createElement('figcaption');
    const number = document.createElement('span'); number.textContent = '№ ' + pad(p.displayNumber);
    const category = document.createElement('span'); category.textContent = p.label;
    caption.append(number, category); figure.append(button, caption); card.append(figure); return card;
  }
  let layoutWidth = 0;
  function layout() {
    const width = gallery.clientWidth;
    const mobile = window.innerWidth <= 700;
    const columns = window.innerWidth < 440 ? 1 : window.innerWidth <= 1050 ? 2 : 4;
    const positions = window.archiveLayout(shown, width, columns, mobile);
    positions.items.forEach((pos,i) => {
      const card = cards.get(shown[i].id);
      Object.assign(card.style,{width:pos.width+'px',left:pos.left+'px',top:pos.top+'px'});
      card.querySelector('img').sizes = Math.ceil(pos.width)+'px';
    });
    gallery.style.height = positions.height+'px'; layoutWidth = width;
  }
  function render(withMotion = false) {
    animations.forEach(animation => animation.cancel()); animations.clear();
    const subset = photos.filter(p => filter === 'all' || p.category === filter);
    shown = subset.slice(0,limit);
    const elements = shown.map(p => {
      if (!cards.has(p.id)) cards.set(p.id,makeCard(p));
      return cards.get(p.id);
    });
    gallery.replaceChildren(...elements); layout();
    if (withMotion) animate(gallery,[{opacity:.65},{opacity:1}],{duration:200,easing:'ease-out'});
    document.getElementById('photo-count').textContent = shown.length + ' из ' + subset.length + ' кадров';
    more.hidden = shown.length === subset.length;
    document.getElementById('archive-status').textContent = more.hidden ? 'Архив открыт целиком. Можно никуда не торопиться.' : 'Сначала — небольшая подборка.';
  }
  new ResizeObserver(() => { if (gallery.clientWidth !== layoutWidth) layout(); }).observe(gallery);
  async function showPhoto(id, sequence) {
    const p = (sequence || viewerSequence) === heroPhotos ? heroPhotos.find(p => p.id === id) : photos.find(p => p.id === id);
    if (!p) return false;
    if (sequence) viewerSequence = sequence;
    const ticket = ++request;
    viewing = p.id;
    const img = document.getElementById('viewer-image');
    const status = document.getElementById('viewer-status');
    img.hidden = true; img.removeAttribute('src'); status.hidden = false; status.textContent = 'Загружаю фотографию…';
    document.getElementById('viewer-caption').textContent = '№ ' + pad(p.displayNumber) + ' / ' + p.label;
    document.getElementById('viewer-number').textContent = '№ ' + pad(p.displayNumber) + ' / ВИЗУАЛЬНЫЙ АРХИВ';
    if (!viewer.open) {
      priorFocus = document.activeElement; viewer.showModal(); syncModalLock();
      document.getElementById('close-viewer').focus();
    }
    try {
      const full = new Image(); full.src = p.fullImage || p.src; await full.decode();
      if (ticket !== request || !viewer.open) return false;
      img.src = full.src; img.alt = p.alt; img.hidden = false; status.hidden = true;
      unavailable.delete(p.id); return true;
    } catch {
      if (ticket !== request || !viewer.open) return false;
      unavailable.add(p.id); status.textContent = 'Кадр не загрузился. Попробуйте соседний или случайный.'; return false;
    }
  }
  function move(direction) {
    const available = viewerSequence.filter(p => !unavailable.has(p.id));
    if (!available.length) return;
    const i = available.findIndex(p => p.id === viewing);
    showPhoto(available[(i + direction + available.length) % available.length].id);
  }
  let randomBusy = false;
  async function randomPhoto() {
    if (randomBusy) return;
    randomBusy = true;
    try {
      let candidates = photos.filter(p => !unavailable.has(p.id) && p.id !== viewing && p.id !== lastRandom);
      if (!candidates.length) candidates = photos.filter(p => !unavailable.has(p.id) && p.id !== viewing);
      if (!candidates.length && photos.filter(p => !unavailable.has(p.id)).length === 1) candidates = photos.filter(p => !unavailable.has(p.id));
      while (candidates.length) {
        const p = candidates.splice(Math.floor(Math.random()*candidates.length),1)[0];
        const pending = request + 1;
        if (await showPhoto(p.id,photos)) { lastRandom = p.id; break; }
        if (request !== pending || !viewer.open) break;
      }
    } finally { randomBusy = false; }
  }
  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-photo]');
    if (opener) {
      const id = Number(opener.dataset.photo);
      showPhoto(id, opener.closest('.hero-stage') ? heroPhotos : shown.some(p => p.id === id) ? shown : photos);
    }
  });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    if (filter === button.dataset.filter) return;
    filter = button.dataset.filter; limit = 24;
    document.querySelectorAll('[data-filter]').forEach(b => {
      const active = b === button; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active));
    });
    render(true);
  }));
  more.addEventListener('click', () => { limit += 24; render(true); document.getElementById('archive-status').focus({preventScroll: true}); });
  document.querySelectorAll('[data-random-photo]').forEach(button => button.addEventListener('click', randomPhoto));
  document.getElementById('close-viewer').addEventListener('click', () => viewer.close());
  document.getElementById('prev-photo').addEventListener('click', () => move(-1));
  document.getElementById('next-photo').addEventListener('click', () => move(1));
  viewer.addEventListener('close', () => { request++; syncModalLock(); if (priorFocus && priorFocus.isConnected) priorFocus.focus({preventScroll: true}); });
  document.addEventListener('keydown', event => {
    if (!viewer.open) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
  });
  document.getElementById('open-services').addEventListener('click', () => {
    servicesFocus = document.activeElement; services.returnValue = ''; services.showModal(); syncModalLock();
    document.getElementById('close-services').focus();
  });
  document.getElementById('close-services').addEventListener('click', () => services.close());
  services.addEventListener('click', event => {
    if (event.target !== services) return;
    const rect = services.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) services.close();
  });
  document.querySelectorAll('[data-to-archive]').forEach(button => button.addEventListener('click', () => services.close('archive')));
  services.addEventListener('close', () => {
    syncModalLock();
    if (services.returnValue === 'archive') {
      const heading = document.getElementById('archive-title');
      heading.focus({preventScroll: true}); heading.scrollIntoView({behavior: motion.matches ? 'auto' : 'smooth', block: 'start'});
    } else if (servicesFocus && servicesFocus.isConnected) servicesFocus.focus({preventScroll: true});
  });
  const chat = document.querySelector('.about-chat');
  let observer = null;
  if (chat && !motion.matches && 'IntersectionObserver' in window) {
    chat.querySelectorAll('.chat-message').forEach((message, i) => message.style.setProperty('--message-index', String(i)));
    chat.classList.add('chat-reveal-ready');
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { chat.classList.add('chat-revealed'); observer.disconnect(); }
    }, {threshold: 0.15});
    observer.observe(chat);
  }
  motion.addEventListener?.('change', () => {
    if (motion.matches) {
      animations.forEach(animation => animation.cancel()); animations.clear();
      chat?.classList.add('chat-revealed'); observer?.disconnect();
    }
  });
  document.querySelector('.hero-note').addEventListener('click', event => {
    event.preventDefault(); const heading = document.getElementById('archive-title');
    heading.focus({preventScroll:true}); document.getElementById('archive').scrollIntoView({behavior:motion.matches?'auto':'smooth',block:'start'});
    history.replaceState(null,'','#archive');
  });
  render();
})();
