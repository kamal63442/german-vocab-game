// Mascot Controller - "Der Stift"
const Mascot = (() => {
  let el = null;
  let hideTimeout = null;

  function createSVG(state) {
    return `
      <svg class="mascot ${state}" data-state="${state}" viewBox="0 0 120 120" width="80" height="80" aria-hidden="true">
        <defs>
          <style>
            .body { fill: #F0B429; }
            .body-dark { fill: #D4A024; }
            .eraser { fill: #C0392B; }
            .face { fill: #23324D; }
            .cheek { fill: #F0B429; opacity: 0.6; }
            .highlight { fill: #FFF; opacity: 0.3; }
            .shadow { fill: #000; opacity: 0.1; }
          </style>
        </defs>
        <ellipse cx="60" cy="112" rx="35" ry="6" class="shadow"/>
        <path d="M60 10 L35 95 Q30 100 60 100 Q90 100 85 95 L60 10Z" class="body"/>
        <path d="M60 10 L35 95 Q30 100 60 100" class="body-dark" fill-opacity="0.2"/>
        <rect x="38" y="95" width="44" height="8" rx="2" fill="#8B8B8B"/>
        <rect x="40" y="96" width="40" height="4" rx="1" fill="#B0B0B0"/>
        <rect x="42" y="88" width="36" height="8" rx="3" class="eraser"/>
        <g stroke="#D4A024" stroke-width="0.5" stroke-opacity="0.5" fill="none">
          <line x1="42" y1="15" x2="42" y2="88"/>
          <line x1="50" y1="12" x2="50" y2="88"/>
          <line x1="60" y1="10" x2="60" y2="88"/>
          <line x1="70" y1="12" x2="70" y2="88"/>
          <line x1="78" y1="15" x2="78" y2="88"/>
        </g>
        <path d="M42 15 L42 88" class="highlight" stroke-width="2" fill="none"/>
        <ellipse cx="50" cy="45" rx="6" ry="8" class="face"/>
        <ellipse cx="48" cy="43" rx="2.5" ry="3" class="highlight"/>
        <ellipse cx="70" cy="45" rx="6" ry="8" class="face"/>
        <ellipse cx="68" cy="43" rx="2.5" ry="3" class="highlight"/>
        <ellipse cx="42" cy="55" rx="5" ry="3" class="cheek"/>
        <ellipse cx="78" cy="55" rx="5" ry="3" class="cheek"/>
        ${getMouth(state)}
        ${getStateExtras(state)}
      </svg>
    `;
  }

  function getMouth(state) {
    switch (state) {
      case 'correct': return '<path d="M45 65 Q60 80 75 65" stroke="#2F7A45" stroke-width="3" fill="none" stroke-linecap="round"/>';
      case 'wrong': return '<path d="M50 65 Q60 58 70 65" stroke="#C0392B" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M45 50 Q43 58 45 62 Q47 60 45 50" fill="#3498DB" opacity="0.8"/><rect x="56" y="12" width="16" height="8" rx="2" fill="#FFE4E1" stroke="#C0392B" stroke-width="1"/><rect x="62" y="14" width="4" height="4" fill="#C0392B"/>';
      case 'streak': return '<path d="M48 65 Q60 82 72 65" stroke="#F0B429" stroke-width="3" fill="none" stroke-linecap="round"/>';
      case 'perfect': return '<path d="M45 65 Q60 85 75 65" stroke="#F0B429" stroke-width="3" fill="none" stroke-linecap="round"/>';
      default: return '<path d="M50 65 Q60 75 70 65" stroke="#23324D" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
    }
  }

  function getStateExtras(state) {
    switch (state) {
      case 'correct': return '<g fill="#2F7A45"><polygon points="30,25 32,30 27,30 31,33 26,33 30,38 34,33 29,33 33,30 28,30"/><polygon points="90,30 92,35 87,35 91,38 86,38 90,43 94,38 89,38 93,35 88,35" transform="scale(0.7)"/><polygon points="55,85 57,90 52,90 56,93 51,93 55,98 59,93 54,93 58,90 53,90" transform="scale(0.6)"/></g>';
      case 'streak': return '<g fill="#F0B429"><path d="M25 40 Q22 30 28 25 Q34 30 25 40" opacity="0.9"/><path d="M90 35 Q87 25 93 20 Q99 25 90 35" opacity="0.7" transform="scale(0.8)"/><path d="M40 85 Q37 75 43 70 Q49 75 40 85" opacity="0.6" transform="scale(0.7)"/></g>';
      case 'perfect': return '<g fill="#F0B429"><polygon points="30,20 32,25 27,25 31,28 26,28 30,33 34,28 29,28 33,25 28,25"/><polygon points="90,25 92,30 87,30 91,33 86,33 90,38 94,33 89,33 93,30 88,30" transform="scale(0.7)"/><polygon points="55,80 57,85 52,85 56,88 51,88 55,93 59,88 54,88 58,85 53,85" transform="scale(0.6)"/></g>';
      default: return '';
    }
  }

  function init() {
    if (el) return el;

    el = document.createElement('div');
    el.className = 'mascot-container';
    el.innerHTML = createSVG('idle');

    document.body.appendChild(el);

    if (!document.getElementById('mascot-styles')) {
      const style = document.createElement('style');
      style.id = 'mascot-styles';
      style.textContent = `
        .mascot-container { position: fixed; bottom: 20px; right: 20px; z-index: 9999; pointer-events: none; }
        .mascot { width: 80px; height: 80px; transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15)); }
        .mascot.correct { animation: mascot-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .mascot.streak { animation: mascot-pulse 0.8s ease-in-out; }
        .mascot.perfect { animation: mascot-spin 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .mascot.idle { animation: mascot-breathe 3s ease-in-out infinite; }
        @keyframes mascot-bounce { 0%,100%{transform:translateY(0)scale(1);}30%{transform:translateY(-15px)scale(1.1);}50%{transform:translateY(-5px)scale(1.05);} }
        @keyframes mascot-pulse { 0%,100%{transform:scale(1);}50%{transform:scale(1.1);} }
        @keyframes mascot-spin { 0%{transform:rotate(0)scale(1);}50%{transform:rotate(180deg)scale(1.2);}100%{transform:rotate(360deg)scale(1);} }
        @keyframes mascot-breathe { 0%,100%{transform:translateY(0)scale(1);}50%{transform:translateY(-3px)scale(1.02);} }
        @media (prefers-reduced-motion: reduce) { .mascot, .mascot * { animation: none !important; transition: none !important; } }
      `;
      document.head.appendChild(style);
    }

    return el;
  }

  function show(state) {
    if (!el) init();

    const svg = el.querySelector('.mascot');
    if (svg) {
      svg.outerHTML = createSVG(state);
    }

    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      if (state !== 'idle') show('idle');
    }, 2500);
  }

  return {
    init,
    show,
    hide: () => {},
    correct: () => show('correct'),
    wrong: () => show('wrong'),
    streak: () => show('streak'),
    perfect: () => show('perfect'),
    idle: () => show('idle')
  };
})();

window.Mascot = Mascot;