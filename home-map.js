/* Home: the footprint map. Footprints walk along the trail to the step you pick. */
(function(){
  var map=document.getElementById('map'); if(!map) return;
  var FR=[0,.18,.38,.58,.78,1], SIDES={wide:['below','above','below','right','left','belowleft'],tall:['right','right','right','right','right','right']};
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mq=window.matchMedia('(max-width:700px)');
  var stopsEl=[].slice.call(map.querySelectorAll('.mstop')), cur=0, timer=null, prints=[], total=0, trail, g, vb;
  var fin=document.getElementById('finale'), next=document.getElementById('nextStep'), again=document.getElementById('resetSteps');
  function layout(){
    var tall=mq.matches; trail=document.getElementById(tall?'trailTall':'trailWide');
    g=trail.parentNode.querySelector('.prints'); vb=tall?[360,660]:[1000,500];
    [].slice.call(map.querySelectorAll('.prints')).forEach(function(p){p.innerHTML='';});
    total=trail.getTotalLength(); prints=[];
    var n=Math.floor(total/(tall?26:32));
    for(var i=0;i<=n;i++){
      var L=total*i/n, p=trail.getPointAtLength(L), q=trail.getPointAtLength(Math.min(total,L+2));
      var a=Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI, off=(i%2?1:-1)*7;
      var nx=-Math.sin(a*Math.PI/180)*off, ny=Math.cos(a*Math.PI/180)*off;
      var f=document.createElementNS('http://www.w3.org/2000/svg','g');
      f.setAttribute('class','print');
      f.setAttribute('transform','translate('+(p.x+nx)+' '+(p.y+ny)+') rotate('+(a+90)+') scale('+(tall?1.5:1.75)+')');
      f.innerHTML='<path d="M0 -8c3.4 0 4.4 3.2 4 6.6-.4 3.2-1.4 5-4 5s-3.6-1.8-4-5C-4.4 -4.8 -3.4 -8 0 -8z"/><ellipse cx="0" cy="8" rx="2.6" ry="2.9"/>';
      g.appendChild(f); prints.push({el:f,L:L});
    }
    stopsEl.forEach(function(el,i){
      var pt=trail.getPointAtLength(total*FR[i]);
      el.style.setProperty('--x',(pt.x/vb[0]*100).toFixed(2)); el.style.setProperty('--y',(pt.y/vb[1]*100).toFixed(2));
      el.className='mstop mstop--'+SIDES[tall?'tall':'wide'][i]+(i<=cur?' is-reached':'')+(i===cur?' is-current':'');
    });
    paintPrints(total*FR[cur],true);
  }
  function paintPrints(limit,instant){prints.forEach(function(p){p.el.classList.toggle('on',p.L<=limit+1);});}
  function walkTo(t){
    if(t===cur) return; clearInterval(timer);
    var from=cur, dir=t>from?1:-1; var limit=total*FR[from], end=total*FR[t];
    map.setAttribute('data-step',t);
    if(reduce){cur=t;paintPrints(end);ui();return;}
    var idx=prints.filter(function(p){return p.L<=limit+1;}).length;
    timer=setInterval(function(){
      if(dir>0){ if(idx<prints.length&&prints[idx].L<=end+1){prints[idx].el.classList.add('on');idx++;} else finish(); }
      else { if(idx>0&&prints[idx-1].L>end+1){prints[idx-1].el.classList.remove('on');idx--;} else finish(); }
    },55);
    function finish(){clearInterval(timer);cur=t;ui();}
    cur=from; stopsEl.forEach(function(el,i){el.classList.toggle('is-current',false);});
    setTimeout(function(){},0);
    // mark reached progressively when finished (and immediately for target for clarity)
  }
  function ui(){
    stopsEl.forEach(function(el,i){el.classList.toggle('is-reached',i<=cur);el.classList.toggle('is-current',i===cur);});
    var last=cur===FR.length-1; next.hidden=last; again.hidden=!last; if(fin){fin.classList.toggle('is-live',last);if(last&&!reduce&&fin.scrollIntoView){setTimeout(function(){fin.scrollIntoView({behavior:'smooth',block:'nearest'});},350);}}
    var nl=stopsEl[Math.min(cur+1,5)].querySelector('b').textContent.toLowerCase(); next.textContent=cur===4?'Next: see it live':'Next step: '+nl;
  }
  stopsEl.forEach(function(el,i){el.querySelector('.mstop__dot').addEventListener('click',function(){walkTo(i);});});
  next.addEventListener('click',function(){walkTo(Math.min(cur+1,FR.length-1));});
  again.addEventListener('click',function(){walkTo(0);});
  mq.addEventListener&&mq.addEventListener('change',layout);
  layout(); ui();
  if('IntersectionObserver' in window&&!reduce){var io=new IntersectionObserver(function(e){if(e[0].isIntersecting){io.disconnect();setTimeout(function(){if(cur===0)walkTo(1);},600);}},{threshold:.6});io.observe(map);}
})();
