/* Home: the about laptop. The avatar pops up, then "Hi, I'm Paul." and the blurb type out. */
(function(){
  var lap=document.getElementById('laptop'); if(!lap) return;
  var parts=[].slice.call(lap.querySelectorAll('[data-type]')), caret=lap.querySelector('.caret'), timer=null, done=false;
  var texts=parts.map(function(p){return p.getAttribute('data-type');});
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function decode(h){var t=document.createElement('textarea');t.innerHTML=h;return t.value;}
  texts=texts.map(decode);
  function finish(){clearInterval(timer);done=true;parts.forEach(function(p,i){p.textContent=texts[i];});lap.classList.add('is-on','is-done');}
  parts.forEach(function(p){p.textContent='';});
  if(reduce){finish();return;}
  function start(){
    lap.classList.add('is-on');
    var pi=0,ci=0;
    setTimeout(function(){
      timer=setInterval(function(){
        if(pi>=parts.length){finish();return;}
        var t=texts[pi]; ci++; parts[pi].textContent=t.slice(0,ci); parts[pi].appendChild(caret);
        if(ci>=t.length){pi++;ci=0;}
      },19);
    },650);
  }
  lap.addEventListener('click',function(e){if(!done&&!e.target.closest('a'))finish();});
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(en){if(en[0].isIntersecting){io.disconnect();start();}},{threshold:.55});io.observe(lap);}else{finish();}
})();
