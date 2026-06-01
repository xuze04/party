const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

// 正式上线时填 Firebase Realtime Database 配置。
// 中国访问建议把本页面部署到已备案的 .cn / 国内云域名，再接入自己的数据库服务。
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  appId: ""
};

// 如果上线后的中国网址和当前页面不一致，可填如：https://juhui.example.cn
const chinaSiteUrl = "";

const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL);
const colors = ["#22d3ee", "#2dd4bf", "#fb4566", "#a855f7", "#facc15", "#38bdf8", "#84cc16", "#f97316"];
const wordPairs = [["牛奶", "豆浆"], ["手机", "平板"], ["火锅", "麻辣烫"], ["可乐", "雪碧"], ["沙发", "椅子"], ["面包", "蛋糕"], ["公交车", "地铁"], ["雨伞", "雨衣"]];

let db = null;
const roomRefs = { undercover: null, werewolf: null };
let ignoreLocalSync = false;

const state = {
  mode: "finger",
  touches: new Map(),
  fingerWinner: null,
  rooms: {
    undercover: { code: "", players: [], cards: [] },
    werewolf: { code: "", players: [], cards: [] }
  }
};

const gameMeta = {
  undercover: {
    label: "卧底",
    codeEl: "#undercoverRoomCode",
    inputEl: "#undercoverRoomInput",
    nameEl: "#undercoverPlayerName",
    playersEl: "#undercoverPlayersList",
    cardsEl: "#undercoverCards",
    statusEl: "#undercoverStatus"
  },
  werewolf: {
    label: "狼人杀",
    codeEl: "#werewolfRoomCode",
    inputEl: "#werewolfRoomInput",
    nameEl: "#werewolfPlayerName",
    playersEl: "#werewolfPlayersList",
    cardsEl: "#werewolfCards",
    statusEl: "#werewolfStatus"
  }
};

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1800);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function roomUrl(game) {
  const base = chinaSiteUrl || window.location.href;
  const url = new URL(base);
  url.searchParams.set("game", game);
  url.searchParams.set("room", state.rooms[game].code);
  return url.toString();
}

function switchMode(mode) {
  state.mode = mode;
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  $$(".panel").forEach((panel) => panel.classList.remove("active"));
  $(`#${mode}Panel`).classList.add("active");
}

function initFirebase() {
  const text = hasFirebaseConfig && window.firebase
    ? "在线同步已开启，可用微信、QQ 或房间号邀请好友。"
    : "当前是本机演示模式；填入云端配置并部署到中国网址后，好友可实时进同一房间。";
  $("#undercoverStatus").textContent = text;
  $("#werewolfStatus").textContent = text;
  if (!hasFirebaseConfig || !window.firebase) return;
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
}

function localKey(game) {
  return `party-room-${game}-${state.rooms[game].code}`;
}

function saveLocalRoom(game) {
  if (ignoreLocalSync) return;
  const room = state.rooms[game];
  localStorage.setItem(localKey(game), JSON.stringify({ players: room.players, cards: room.cards }));
}

function readLocalRoom(game) {
  const raw = localStorage.getItem(localKey(game));
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    state.rooms[game].players = data.players || [];
    state.rooms[game].cards = data.cards || [];
  } catch (_) {}
}

function renderRoom(game) {
  renderPlayers(game);
  renderCards(game);
}

function publishRoom(game) {
  const room = state.rooms[game];
  if (db && roomRefs[game]) {
    roomRefs[game].set({ players: room.players, cards: room.cards, updatedAt: Date.now() });
  } else {
    saveLocalRoom(game);
    renderRoom(game);
  }
}

function enterRoom(game, code) {
  const room = state.rooms[game];
  const meta = gameMeta[game];
  room.code = (code || makeRoomCode()).trim().toUpperCase();
  room.players = [];
  room.cards = [];
  $(meta.codeEl).textContent = `${meta.label}房间 ${room.code}`;
  $(meta.inputEl).value = room.code;

  if (roomRefs[game]) roomRefs[game].off();
  if (db) {
    roomRefs[game] = db.ref(`partyRooms/${game}/${room.code}`);
    roomRefs[game].on("value", (snapshot) => {
      const data = snapshot.val() || {};
      room.players = data.players || [];
      room.cards = data.cards || [];
      renderRoom(game);
    });
    roomRefs[game].transaction((oldRoom) => oldRoom || { players: [], cards: [], createdAt: Date.now() });
  } else {
    readLocalRoom(game);
    renderRoom(game);
  }

  const url = new URL(window.location.href);
  url.searchParams.set("game", game);
  url.searchParams.set("room", room.code);
  window.history.replaceState({}, "", url);
}

function resetCurrent() {
  if (state.mode === "finger") {
    state.touches.clear();
    state.fingerWinner = null;
    renderTouches();
    return;
  }
  if (state.mode === "undercover" || state.mode === "werewolf") {
    const room = state.rooms[state.mode];
    room.cards = [];
    room.players = room.players.map((player) => ({ ...player, ready: false }));
    publishRoom(state.mode);
  }
}

function renderTouches() {
  const pad = $("#fingerPad");
  pad.querySelectorAll(".finger-dot").forEach((dot) => dot.remove());
  $("#fingerHint").textContent = state.touches.size ? "保持按住，点击开始" : "按住屏幕加入";
  $("#fingerList").innerHTML = "";
  Array.from(state.touches.values()).forEach((touch, index) => {
    const dot = document.createElement("div");
    dot.className = "finger-dot";
    if (state.fingerWinner === touch.id) dot.classList.add("winner");
    dot.style.left = `${touch.x}px`;
    dot.style.top = `${touch.y}px`;
    dot.style.background = colors[index % colors.length];
    dot.textContent = index + 1;
    pad.appendChild(dot);

    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = `手指 ${index + 1}`;
    chip.style.background = colors[index % colors.length];
    $("#fingerList").appendChild(chip);
  });
}

function updateTouches(event) {
  event.preventDefault();
  const rect = $("#fingerPad").getBoundingClientRect();
  state.fingerWinner = null;
  state.touches.clear();
  Array.from(event.touches).forEach((touch) => {
    state.touches.set(touch.identifier, { id: touch.identifier, x: touch.clientX - rect.left, y: touch.clientY - rect.top });
  });
  renderTouches();
}

function pickFinger() {
  const ids = Array.from(state.touches.keys());
  if (!ids.length) return toast("请先把手指按在屏幕上");
  let ticks = 0;
  const timer = setInterval(() => {
    state.fingerWinner = ids[Math.floor(Math.random() * ids.length)];
    renderTouches();
    ticks += 1;
    if (ticks > 11) {
      clearInterval(timer);
      toast("抽中这位");
    }
  }, 90);
}

function renderPlayers(game) {
  const room = state.rooms[game];
  const list = $(gameMeta[game].playersEl);
  list.innerHTML = "";
  room.players.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `<div class="player-meta"><strong>${player.name}</strong><span>${player.ready ? "已准备" : "等待准备"}</span></div><button class="ready-btn ${player.ready ? "ready" : ""}" type="button">${player.ready ? "取消" : "准备"}</button>`;
    row.querySelector("button").addEventListener("click", () => {
      room.players[index].ready = !room.players[index].ready;
      room.cards = [];
      publishRoom(game);
    });
    list.appendChild(row);
  });
}

function joinPlayer(game) {
  const room = state.rooms[game];
  const input = $(gameMeta[game].nameEl);
  const name = input.value.trim() || `玩家${room.players.length + 1}`;
  if (room.players.length >= 18) return toast("房间最多 18 人");
  if (room.players.some((player) => player.name === name)) return toast("这个昵称已在房间里");
  const id = window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.random()}`;
  room.players.push({ id, name, ready: false });
  room.cards = [];
  input.value = "";
  publishRoom(game);
}

function renderCards(game) {
  const room = state.rooms[game];
  const container = $(gameMeta[game].cardsEl);
  container.innerHTML = "";
  room.cards.forEach((card) => {
    const wrap = document.createElement("article");
    wrap.className = "identity-card";
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `${card.player}<br>点击查看`;
    button.addEventListener("click", () => {
      wrap.classList.toggle("revealed");
      button.innerHTML = wrap.classList.contains("revealed")
        ? `<span class="card-role">${card.role}</span><span class="card-word">${card.word || card.note}</span>`
        : `${card.player}<br>点击查看`;
    });
    wrap.appendChild(button);
    container.appendChild(wrap);
  });
}

function dealUndercover() {
  const room = state.rooms.undercover;
  const count = room.players.length;
  const civilianWord = $("#civilianWord").value.trim();
  const undercoverWord = $("#undercoverWord").value.trim();
  if (count < 5) return toast("谁是卧底至少需要 5 人");
  if (room.players.some((player) => !player.ready)) return toast("还有玩家未准备");
  if (!civilianWord || !undercoverWord) return toast("请填写两组词");
  const undercoverCount = count >= 8 ? 2 : 1;
  const identities = shuffle([
    ...Array(count - undercoverCount).fill({ role: "平民", word: civilianWord }),
    ...Array(undercoverCount).fill({ role: "卧底", word: undercoverWord })
  ]);
  room.cards = identities.map((identity, index) => ({ player: room.players[index].name, ...identity }));
  publishRoom("undercover");
  toast(`已发出 ${count} 张卧底牌`);
}

function randomWords() {
  const pair = wordPairs[Math.floor(Math.random() * wordPairs.length)];
  $("#civilianWord").value = pair[0];
  $("#undercoverWord").value = pair[1];
}

function werewolfRoles(count) {
  if (count < 6) return null;
  if (count <= 7) return ["狼人", "狼人", "预言家", "女巫", "猎人", ...Array(count - 5).fill("村民")];
  if (count <= 10) return ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", ...Array(count - 7).fill("村民")];
  return ["狼人", "狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "白痴", ...Array(count - 9).fill("村民")];
}

function roleNote(role) {
  return {
    狼人: "夜晚睁眼，和队友确认目标",
    预言家: "每晚查验一名玩家身份",
    女巫: "拥有解药和毒药各一次",
    猎人: "出局时可带走一名玩家",
    守卫: "每晚守护一名玩家",
    白痴: "被投票出局后可翻牌继续发言",
    村民: "白天发言投票找狼人"
  }[role] || "按当前房规执行";
}

function dealWerewolf() {
  const room = state.rooms.werewolf;
  const roles = werewolfRoles(room.players.length);
  if (!roles) return toast("狼人杀至少需要 6 人");
  if (room.players.some((player) => !player.ready)) return toast("还有玩家未准备");
  room.cards = shuffle(roles).map((role, index) => ({ player: room.players[index].name, role, note: roleNote(role) }));
  publishRoom("werewolf");
  toast("狼人杀身份已发放");
}

async function copyInvite(game) {
  const text = `来${gameMeta[game].label}房间：${state.rooms[game].code}\n${roomUrl(game)}`;
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    toast("邀请链接已复制，可粘贴到微信发送");
  } else {
    toast(`房间号：${state.rooms[game].code}`);
  }
}

async function shareWechat(game) {
  const title = `聚会神器${gameMeta[game].label}房间`;
  const text = `房间号：${state.rooms[game].code}`;
  const url = roomUrl(game);
  if (navigator.share) {
    await navigator.share({ title, text, url }).catch(() => {});
  } else {
    await copyInvite(game);
  }
}

function shareQq(game) {
  const title = encodeURIComponent(`聚会神器${gameMeta[game].label}房间`);
  const summary = encodeURIComponent(`房间号：${state.rooms[game].code}`);
  const url = encodeURIComponent(roomUrl(game));
  window.open(`https://connect.qq.com/widget/shareqq/index.html?url=${url}&title=${title}&summary=${summary}`, "_blank");
}

window.addEventListener("storage", (event) => {
  ["undercover", "werewolf"].forEach((game) => {
    if (event.key !== localKey(game) || db) return;
    ignoreLocalSync = true;
    readLocalRoom(game);
    renderRoom(game);
    ignoreLocalSync = false;
  });
});

$$(".tab").forEach((tab) => tab.addEventListener("click", () => switchMode(tab.dataset.mode)));
$("#resetBtn").addEventListener("click", resetCurrent);
$("#fingerPad").addEventListener("touchstart", updateTouches, { passive: false });
$("#fingerPad").addEventListener("touchmove", updateTouches, { passive: false });
$("#fingerPad").addEventListener("touchend", updateTouches, { passive: false });
$("#fingerPad").addEventListener("touchcancel", updateTouches, { passive: false });
$("#fingerPad").addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse") {
    const rect = $("#fingerPad").getBoundingClientRect();
    state.touches.set(1, { id: 1, x: event.clientX - rect.left, y: event.clientY - rect.top });
    renderTouches();
  }
});

$("#pickFingerBtn").addEventListener("click", pickFinger);
$("#randomWordsBtn").addEventListener("click", randomWords);
$("#dealUndercoverBtn").addEventListener("click", dealUndercover);
$("#dealWerewolfBtn").addEventListener("click", dealWerewolf);

$("#newUndercoverRoomBtn").addEventListener("click", () => enterRoom("undercover", makeRoomCode()));
$("#enterUndercoverRoomBtn").addEventListener("click", () => enterRoom("undercover", $("#undercoverRoomInput").value || makeRoomCode()));
$("#joinUndercoverBtn").addEventListener("click", () => joinPlayer("undercover"));
$("#shareUndercoverWechatBtn").addEventListener("click", () => shareWechat("undercover"));
$("#shareUndercoverQqBtn").addEventListener("click", () => shareQq("undercover"));
$("#undercoverPlayerName").addEventListener("keydown", (event) => { if (event.key === "Enter") joinPlayer("undercover"); });
$("#undercoverRoomInput").addEventListener("keydown", (event) => { if (event.key === "Enter") enterRoom("undercover", $("#undercoverRoomInput").value); });

$("#newWerewolfRoomBtn").addEventListener("click", () => enterRoom("werewolf", makeRoomCode()));
$("#enterWerewolfRoomBtn").addEventListener("click", () => enterRoom("werewolf", $("#werewolfRoomInput").value || makeRoomCode()));
$("#joinWerewolfBtn").addEventListener("click", () => joinPlayer("werewolf"));
$("#shareWerewolfWechatBtn").addEventListener("click", () => shareWechat("werewolf"));
$("#shareWerewolfQqBtn").addEventListener("click", () => shareQq("werewolf"));
$("#werewolfPlayerName").addEventListener("keydown", (event) => { if (event.key === "Enter") joinPlayer("werewolf"); });
$("#werewolfRoomInput").addEventListener("keydown", (event) => { if (event.key === "Enter") enterRoom("werewolf", $("#werewolfRoomInput").value); });

initFirebase();
renderTouches();

const params = new URLSearchParams(window.location.search);
const inviteGame = params.get("game");
const inviteRoom = params.get("room");
enterRoom("undercover", inviteGame === "undercover" && inviteRoom ? inviteRoom : makeRoomCode());
enterRoom("werewolf", inviteGame === "werewolf" && inviteRoom ? inviteRoom : makeRoomCode());
if (inviteGame === "undercover" || inviteGame === "werewolf") switchMode(inviteGame);
