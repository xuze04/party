// app.js

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

tabs.forEach(tab=>{

  tab.addEventListener("click",()=>{

    tabs.forEach(t=>t.classList.remove("active"));
    panels.forEach(p=>p.classList.remove("active"));

    tab.classList.add("active");

    document
    .getElementById(tab.dataset.panel)
    .classList.add("active");

  });

});

// ====================
// 指尖模式
// ====================

const enterFingerBtn =
document.getElementById("enterFingerBtn");

const fingerScreen =
document.getElementById("fingerScreen");

const fingerPad =
document.getElementById("fingerPad");

const startBtn =
document.getElementById("startBtn");

const colors = [
  "#22d3ee",
  "#ef4444",
  "#a855f7",
  "#22c55e",
  "#f97316",
  "#eab308",
  "#3b82f6",
  "#ec4899"
];

const fingerState = {
  touches:new Map(),
  winner:null,
  running:false
};

enterFingerBtn.addEventListener("click",()=>{

  fingerScreen.style.display = "block";

});

function renderTouches(){

  fingerPad
  .querySelectorAll(".finger-dot")
  .forEach(el=>el.remove());

  Array.from(fingerState.touches.values())
  .forEach((touch,index)=>{

    const dot =
    document.createElement("div");

    dot.className = "finger-dot";

    if(fingerState.winner === touch.id){
      dot.classList.add("winner");
    }

    dot.style.left = touch.x + "px";
    dot.style.top = touch.y + "px";

    dot.style.background =
    colors[index % colors.length];

    dot.innerText = index + 1;

    fingerPad.appendChild(dot);

  });

}

function updateTouches(event){

  event.preventDefault();

  const rect =
  fingerPad.getBoundingClientRect();

  fingerState.touches.clear();

  Array.from(event.touches)
  .forEach(touch=>{

    fingerState.touches.set(
      touch.identifier,
      {
        id:touch.identifier,
        x:touch.clientX - rect.left,
        y:touch.clientY - rect.top
      }
    );

  });

  renderTouches();

}

fingerPad.addEventListener(
  "touchstart",
  updateTouches,
  { passive:false }
);

fingerPad.addEventListener(
  "touchmove",
  updateTouches,
  { passive:false }
);

fingerPad.addEventListener(
  "touchend",
  updateTouches,
  { passive:false }
);

startBtn.addEventListener("click",()=>{

  if(fingerState.running) return;

  if(!fingerState.touches.size){

    alert("请先放手指");

    return;
  }

  fingerState.running = true;

  startBtn.style.background = "#ef4444";

  const ids =
  Array.from(fingerState.touches.keys());

  let count = 0;

  const timer = setInterval(()=>{

    fingerState.winner =
    ids[Math.floor(Math.random()*ids.length)];

    renderTouches();

    count++;

    if(count >= 30){

      clearInterval(timer);

      fingerState.running = false;

      startBtn.style.background = "#22c55e";

      const winnerIndex =
      ids.indexOf(fingerState.winner)+1;

      setTimeout(()=>{

        alert(
          "抽中了手指 " + winnerIndex
        );

      },300);

    }

  },100);

});

// ====================
// 谁是卧底
// ====================

const undercoverPlayers = [];

document
.getElementById("addUndercoverPlayer")
.addEventListener("click",()=>{

  const input =
  document.getElementById("undercoverName");

  if(!input.value.trim()) return;

  undercoverPlayers.push(input.value);

  renderUndercoverPlayers();

  input.value = "";

});

function renderUndercoverPlayers(){

  const box =
  document.getElementById("undercoverPlayers");

  box.innerHTML = "";

  undercoverPlayers.forEach(name=>{

    const div =
    document.createElement("div");

    div.className = "player";

    div.innerText = name;

    box.appendChild(div);

  });

}

document
.getElementById("dealUndercover")
.addEventListener("click",()=>{

  const civilian =
  document.getElementById("civilianWord").value;

  const undercover =
  document.getElementById("undercoverWord").value;

  let undercoverCount = 1;

  if(undercoverPlayers.length >= 8){
    undercoverCount = 2;
  }

  const shuffled =
  [...undercoverPlayers]
  .sort(()=>Math.random()-0.5);

  const box =
  document.getElementById("undercoverCards");

  box.innerHTML = "";

  undercoverPlayers.forEach(name=>{

    const isUndercover =
    shuffled
    .slice(0,undercoverCount)
    .includes(name);

    const div =
    document.createElement("div");

    div.className = "card";

    div.innerHTML = `
      <strong>${name}</strong>
      <br><br>
      ${isUndercover ? undercover : civilian}
    `;

    box.appendChild(div);

  });

});

// ====================
// 狼人杀
// ====================

const wolfPlayers = [];

document
.getElementById("addWolfPlayer")
.addEventListener("click",()=>{

  const input =
  document.getElementById("wolfName");

  if(!input.value.trim()) return;

  wolfPlayers.push(input.value);

  renderWolfPlayers();

  input.value = "";

});

function renderWolfPlayers(){

  const box =
  document.getElementById("wolfPlayers");

  box.innerHTML = "";

  wolfPlayers.forEach(name=>{

    const div =
    document.createElement("div");

    div.className = "player";

    div.innerText = name;

    box.appendChild(div);

  });

}

document
.getElementById("dealWolf")
.addEventListener("click",()=>{

  const roles = [];

  const total =
  wolfPlayers.length;

  const wolfCount =
  total >= 9 ? 3 : 2;

  for(let i=0;i<wolfCount;i++){
    roles.push("狼人");
  }

  roles.push("预言家");
  roles.push("女巫");

  while(roles.length < total){
    roles.push("平民");
  }

  roles.sort(()=>Math.random()-0.5);

  const box =
  document.getElementById("wolfCards");

  box.innerHTML = "";

  wolfPlayers.forEach((name,index)=>{

    const div =
    document.createElement("div");

    div.className = "card";

    div.innerHTML = `
      <strong>${name}</strong>
      <br><br>
      ${roles[index]}
    `;

    box.appendChild(div);

  });

});