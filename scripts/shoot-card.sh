#!/bin/sh
# shoot-card.sh <v> <card-id> [<card-id>...] — open each wallet card and screenshot it after 6 s
V=$1; shift; S=/private/tmp/claude-501/-Users-key-Code-web-animation-motion-presentation-2026/4a35697c-d97c-4f41-b147-dc23884f222f/scratchpad
C="(id)=>document.querySelector('[data-testid='+id+']').click()"
ARGS="--eval new\ Promise(r=>{document.querySelector('[data-testid=wl-card]').scrollIntoView({block:'center'});($C)('wl-auto');setTimeout(()=>r('go'),4500)})"
set -- "$@"
CMD="bun scripts/cdp-verify.js http://127.0.0.1:8765/techniques/webgpu.html?v=$V --wait 6000"
ARR=()
ARR+=(--eval "new Promise(r=>{document.querySelector('[data-testid=wl-card]').scrollIntoView({block:'center'});($C)('wl-auto');setTimeout(()=>r('go'),4500)})")
for id in "$@"; do ARR+=(--eval "new Promise(r=>{if(document.querySelector('.wl-on'))($C)('wl-close');setTimeout(()=>{($C)('wl-$id');setTimeout(()=>r('$id'),${SHOT_WAIT:-6000})},1100)})" --shot "$S/wl-$id.png@[data-testid=wl-$id]"); done
bun scripts/cdp-verify.js "http://127.0.0.1:8765/techniques/webgpu.html?v=$V" --wait 6000 "${ARR[@]}" 2>&1 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.out.filter(o=>!/^shot/.test(o)).join(' | '), 'logs', j.logs.length);[...new Set(j.logs.map(l=>l.split('\n').slice(0,4).join(' | ').slice(0,500)))].slice(0,6).forEach(l=>console.log(' -',l))})"
