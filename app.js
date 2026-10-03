// AOTO教室アプリ(芦屋)画面
const $app = document.getElementById('app');
const S = { idToken: null, me: null, sel: 0, days: {}, day: null, msgInfo: null, unpaid: null, preview: null };
let pending = 0, inflight = false;

// ───────── 小道具 ─────────
const DOW_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DOW_JP = '日月火水木金土';
const day = s => new Date(s + 'T12:00:00+09:00').getUTCDay();
const md = s => s.slice(5).replace('-', '.');
const dd = s => s.slice(8);
const dow = s => DOW_EN[day(s)];
const jp = s => `${Number(s.slice(5, 7))}月${Number(s.slice(8))}日(${DOW_JP[day(s)]})`;
const yen = n => Number(n).toLocaleString('ja-JP') + '円';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTH_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const time = r => `${esc(r.start)} – ${esc(r.end)}`;

const I = {
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
  arrow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  out: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17L17 7M9 7h8v8"/></svg>',
  web: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#004796" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>',
  insta: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#004796" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="#004796"/></svg>',
  event: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#004796" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  cam: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
};

function toast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { t.className = ''; }, 3200);
}

async function api(action, params = {}) {
  pending++;
  document.body.classList.add('busy');
  let j;
  try {
    const res = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action, idToken: S.idToken, ...params }) });
    j = await res.json();
  } finally {
    if (--pending === 0) document.body.classList.remove('busy');
  }
  if (j.error === 'LOGIN_EXPIRED') {
    liff.logout();
    liff.login({ redirectUri: location.href });
    throw new Error('もう一度ログインします');
  }
  if (j.error) throw new Error(j.error);
  return j;
}

function openUrl(url) {
  if (!url) return;
  if (window.liff && liff.isInClient()) liff.openWindow({ url, external: !/^https:\/\/(aotoart\.jp|www\.instagram\.com)/.test(url) });
  else window.open(url, '_blank', 'noopener');
}

// ───────── 起動と画面の切り替え ─────────
async function boot() {
  try {
    await liff.init({ liffId: CONFIG.LIFF_ID });
    if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return; }
    S.idToken = liff.getIDToken();
    S.me = await api('me');
    $app.addEventListener('click', onClick);
    $app.addEventListener('submit', onSubmit);
    $app.addEventListener('change', onChange);
    window.addEventListener('hashchange', render);
    render();
    if (S.me.isStaff) prefetchStaff();
  } catch (e) {
    $app.innerHTML = `<div class="errorpage"><div class="title">うまく開けませんでした</div><p>${esc(e.message)}</p><p>時間をおいてもう一度開くか、教室にご連絡ください。</p></div>`;
  }
}

function prefetchStaff() {
  api('staffDay', {}).then(d => { S.days[''] = d; S.days[d.date] = d; }).catch(() => {});
  Promise.all([api('msgInfo'), api('unpaid')]).then(([i, u]) => { S.msgInfo = i; S.unpaid = u; }).catch(() => {});
}

const route = () => { const [name = '', arg = ''] = location.hash.slice(1).split('/'); return { name, arg: decodeURIComponent(arg) }; };
const student = () => S.me.students[S.sel] || S.me.students[0];
function view(html) { $app.innerHTML = html; window.scrollTo(0, 0); }

async function render() {
  const { name, arg } = route();
  const me = S.me;
  freeUrls();
  // 子どもクラスの人が見ているときだけ、少しやわらかい配色にする
  const kidsMode = !name.startsWith('staff') && me.students.length && (me.students[S.sel] || me.students[0]).cls === '子ども';
  document.body.classList.toggle('kids', !!kidsMode);
  if (name.startsWith('staff') && me.isStaff) return renderStaff(name, arg);
  if (!me.students.length) {
    if (me.isStaff && name !== 'register') { location.hash = 'staff'; return; }
    return view(registerView());
  }
  const st = student();
  if (st.status === '承認待ち') return view(pendingView(st));
  if (name === 'lessons') return view(lessonsView(st));
  if (name === 'absence') return view(absenceView(st, arg));
  if (name === 'calendar') return view(calendarView(st));
  if (name === 'tasks') return view(tasksView(st));
  if (name === 'notices') return view(noticesView());
  if (['works', 'work', 'works-new', 'works-edit'].includes(name)) return renderWorks(st, name, arg);
  if (name === 'register') return view(registerView());
  return view(homeView(st));
}

const sub = (eyebrow, title, back = '#', extra = '') => `
  <div class="sub"><a class="back" href="${back}" aria-label="戻る">${I.back}</a>
  <div style="flex-grow:1"><div class="eyebrow">${eyebrow}</div><div class="title">${title}</div></div>${extra}</div>`;

// ───────── 生徒の画面 ─────────
// ───────── お知らせ ─────────
// 読んだお知らせは、この端末だけに記録する
function readSet() { try { return new Set(JSON.parse(localStorage.getItem('aoto_read') || '[]')); } catch (e) { return new Set(); } }
function markRead(ids) {
  try { const r = readSet(); ids.forEach(i => r.add(i)); localStorage.setItem('aoto_read', JSON.stringify([...r].slice(-200))); } catch (e) { /* 保存できない端末では何もしない */ }
}

// 受講料の案内(未払いはオレンジ、次回が支払い日は青)
function feeNotice(st, next) {
  const d = st.due;
  if (!d) return '';
  const kids = st.cls === '子ども';
  const what = kids ? d.label.replace('月謝', '受講料') : `受講料(${esc(d.label)} ${yen(d.amount)})`;
  if (d.overdue) {
    return `<div class="fee warn"><b>${what}のお支払いが確認できていません。</b>次回お持ちください。${kids ? `(${yen(d.amount)})` : ''}<small>行き違いの場合はご容赦ください。</small></div>`;
  }
  if (next && d.date === next.date) {
    return `<div class="fee">次回、${kids ? `${what} ${yen(d.amount)}` : `受講料 ${yen(d.amount)}(${esc(d.label)})`}をお持ちください。</div>`;
  }
  return '';
}

function noticeBox(st, next) {
  const fee = feeNotice(st, next);
  const list = S.me.notices || [];
  if (!fee && !list.length) return '';
  const read = readSet();
  return `<section class="notices"><div class="nhead"><b>お知らせ</b>${list.length ? `<a href="#notices">すべて見る</a>` : ''}</div>
  ${fee}
  ${list.slice(0, 2).map(n => `<a class="nitem" href="#notices"><i class="${read.has(n.id) ? '' : 'new'}" aria-label="${read.has(n.id) ? '' : '未読'}"></i><span class="nd">${n.date ? md(n.date) : ''}</span><span class="nt">${esc(n.title || n.body)}</span></a>`).join('')}
  </section>`;
}

function noticesView() {
  const list = S.me.notices || [];
  const read = readSet();
  markRead(list.map(n => n.id));
  return `<div class="page">${sub('NEWS', 'お知らせ')}
  <div class="list">${list.length ? list.map(n => `<div class="item" style="align-items:flex-start">
    <div class="body" style="display:flex;flex-direction:column;gap:6px">
      <div style="font-size:11px;color:var(--muted);display:flex;gap:8px;align-items:center">${n.date ? jp(n.date) : ''}${read.has(n.id) ? '' : '<span class="tag blue">NEW</span>'}${n.target !== '全員' ? `<span>${esc(n.target)}クラス</span>` : ''}</div>
      ${n.title ? `<div class="name">${esc(n.title)}</div>` : ''}
      ${n.body ? `<div style="font-size:13px;line-height:1.8;color:#26354A;white-space:pre-wrap">${esc(n.body)}</div>` : ''}
    </div></div>`).join('') : '<div class="empty">お知らせはありません。</div>'}</div>
  <div style="height:24px"></div></div>`;
}

function homeView(st) {
  const me = S.me, set = me.settings;
  const next = st.upcoming.find(r => r.absent !== '前日まで');
  const sibs = me.students.length > 1 ? `<div class="sibs">${me.students.map((s, i) =>
    `<button type="button" data-act="sel" data-i="${i}" aria-pressed="${i === S.sel}">${esc(s.name)}</button>`).join('')}</div>` : '';
  const links = [[set.hp, '芸術教室HP', I.web], [set.instagram, 'Instagram', I.insta], [set.events, '展覧会・イベント', I.event]].filter(x => x[0]);
  return `<div class="page">
  <div class="top"><div><img src="logo.svg" alt="AOTO ART"><div class="place">芸術教室 ─ 芦屋</div></div>
  <div class="who">${esc(st.name)} さん<br>${esc(st.cls)}クラス</div></div>
  ${sibs}
  <div class="hero">
    <div class="eyebrow">NEXT LESSON</div>
    ${next ? `<div class="bigdate"><b>${md(next.date)}</b><span>${dow(next.date)}</span></div>
    <div class="rule"></div><div class="row2"><div>${time(next)}</div><div class="dim">${esc(st.cls)}クラス</div></div>`
    : `<div style="font-size:15px">次のレッスン日はまだお知らせしていません</div>`}
  </div>
  ${noticeBox(st, next)}
  <nav class="menu">
    <a href="#lessons"><span class="no">01</span><span class="t">レッスン日</span>${I.arrow}</a>
    <a href="#absence"><span class="no">02</span><span class="t">欠席連絡</span>${I.arrow}</a>
    ${st.cls === '子ども' ? `<a href="#tasks"><span class="no">03</span><span class="t">課題を見る</span>${I.arrow}</a>` : ''}
    <a href="#works"><span class="no">${st.cls === '子ども' ? '04' : '03'}</span><span class="t">MY作品集</span>${I.arrow}</a>
    <a href="#calendar"><span class="no">${st.cls === '子ども' ? '05' : '04'}</span><span class="t">自分のカレンダーに登録</span>${I.arrow}</a>
    ${me.isStaff ? `<a href="#staff"><span class="no">★</span><span class="t">先生の画面</span>${I.arrow}</a>` : ''}
  </nav>
  ${links.length ? `<div class="linkhead"><b>AOTO ART</b><span>AOTO Bagでイベント300円引き</span></div>
  <div class="links">${links.map(([u, t, i]) => `<a href="#" data-act="open" data-url="${esc(u)}">${i}<span>${t}</span></a>`).join('')}</div>` : ''}
  <div class="foot"><span>お急ぎはお電話で</span><a href="tel:${esc(set.phone)}" style="color:var(--muted);font-weight:600">${esc(set.phone)}</a></div>
  ${me.students.some(s => s.cls === '子ども') ? `<div class="foot" style="padding-top:0"><a href="#register" style="color:var(--muted)">きょうだいを追加する</a></div>` : ''}
  </div>`;
}

function lessonRow(st, r) {
  const today = S.me.today;
  if (r.absent === '前日まで') {
    return `<div class="item gone"><div class="d"><b>${dd(r.date)}</b><span>${dow(r.date)}</span></div>
    <div class="body"><div class="st">欠席連絡済み</div><div class="sm">1回分を次回に回します</div></div>
    ${r.date > today ? `<button class="sbtn txt" data-act="cancel" data-date="${r.date}">取り消す</button>` : ''}</div>`;
  }
  if (r.absent === '当日') {
    return `<div class="item gone"><div class="d"><b>${dd(r.date)}</b><span>${dow(r.date)}</span></div>
    <div class="body"><div class="st">当日のご欠席</div><div class="sm">次回に回す対象外です</div></div></div>`;
  }
  const payHere = st.due && st.due.date === r.date ? `受講料 ${yen(st.due.amount)}(${esc(st.due.label)})` : time(r);
  return `<div class="item"><div class="d"><b>${dd(r.date)}</b><span>${dow(r.date)}</span></div>
  <div class="body"><div class="st">出席予定</div><div class="sm">${payHere}</div></div>
  <a class="sbtn out" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="#absence/${r.date}">欠席連絡</a></div>`;
}

function lessonsView(st) {
  const groups = {};
  st.upcoming.forEach(r => { (groups[r.date.slice(0, 7)] = groups[r.date.slice(0, 7)] || []).push(r); });
  const keys = Object.keys(groups);
  return `<div class="page">${sub('SCHEDULE', 'レッスン日', '#', `<div style="font-size:12px;color:var(--muted);padding-right:8px">${esc(st.cls)}クラス</div>`)}
  ${keys.length ? keys.map(k => {
    const rows = groups[k];
    return `<div class="month"><b>${Number(k.slice(5))}<span>${MONTH_EN[Number(k.slice(5)) - 1]}</span></b>
    <div style="font-size:14px;font-weight:700"><span style="color:var(--blue)">${rows.filter(r => r.absent !== '前日まで').length}</span> / ${rows.length} 回 出席予定</div></div>
    <div class="list">${rows.map(r => lessonRow(st, r)).join('')}</div>`;
  }).join('<div style="height:12px"></div>') : `<div class="list"><div class="empty">レッスン日はまだお知らせしていません。</div></div>`}
  <p class="note">前日までにご連絡いただくと、お休みした1回分を次回以降に回せます。<br>恐れ入りますが、当日のご連絡は対象外とさせていただいております。</p>
  </div>`;
}

function absenceView(st, arg) {
  const cands = st.upcoming.filter(r => !r.absent).slice(0, 4);
  if (!cands.length) {
    return `<div class="page">${sub('ABSENCE', '欠席連絡')}<div class="list"><div class="empty">欠席連絡できるレッスン日がありません。</div></div></div>`;
  }
  const sel = cands.find(r => r.date === arg) ? arg : cands[0].date;
  return `<div class="page">${sub('ABSENCE', '欠席連絡', '#lessons')}
  <form data-act="absent" style="display:flex;flex-direction:column;flex-grow:1">
  <div class="label" style="padding-top:10px">欠席する日</div>
  <fieldset class="pick"><legend class="label" style="position:absolute;left:-9999px">欠席する日</legend>
  ${cands.map((r, i) => `<label><div class="k">${i === 0 ? 'NEXT' : ''}<input type="radio" name="date" value="${r.date}" ${r.date === sel ? 'checked' : ''}></div>
    <b>${md(r.date)}</b><span class="w">${dow(r.date)}</span></label>`).join('')}
  </fieldset>
  <div id="absinfo">${absInfo(st, sel)}</div>
  <div class="field"><label for="memo">先生へのひとこと(任意)</label><textarea id="memo" name="memo" rows="3"></textarea></div>
  <p class="note">前日までにご連絡いただくと、お休みした1回分を次回以降に回せます。<br>恐れ入りますが、当日のご連絡は対象外とさせていただいております。</p>
  <div class="actions"><button class="btn" type="submit">欠席連絡する</button></div>
  </form></div>`;
}

function absInfo(st, date) {
  if (date > S.me.today) {
    return `<div class="box"><div class="h">${I.check}前日までのご連絡です。お休みした1回分は次回以降に回ります。</div></div>`;
  }
  return `<div class="box warn"><div class="h">当日のご連絡です</div>
  <div style="font-size:12px;line-height:1.7">恐れ入りますが、当日のご連絡は対象外とさせていただいております。</div></div>`;
}

function calendarView(st) {
  const set = CONFIG.API_URL;
  const feed = set.replace(/^https?:/, 'webcal:') + '?feed=' + encodeURIComponent(st.calKey);
  const rows = st.upcoming.filter(r => r.absent !== '前日まで').slice(0, 6);
  return `<div class="page">${sub('CALENDAR', '自分のカレンダーに登録')}
  <div class="hero" style="background:var(--blue)">
    <div class="eyebrow" style="color:var(--pale2)">RECOMMENDED</div>
    <div style="font-size:18px;font-weight:700;line-height:1.5">一度の登録で、レッスン日が自動で入る</div>
    <div style="font-size:12px;line-height:1.7;color:#E1E8FC">先生がレッスン日を登録すると自動で追加され、欠席連絡をした日は自動で消えます。</div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
      <button class="sbtn" style="background:#fff;color:var(--ink);min-height:48px" data-act="open" data-url="${esc(feed)}">iPhone</button>
      <button class="sbtn" style="background:#fff;color:var(--ink);min-height:48px" data-act="open" data-url="${esc('https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(feed))}">Googleカレンダー</button>
    </div>
  </div>
  <div class="label">1回ずつ追加する場合</div>
  <div class="list">${rows.length ? rows.map(r => {
    const g = 'https://calendar.google.com/calendar/render?action=TEMPLATE&ctz=Asia/Tokyo'
      + '&text=' + encodeURIComponent('AOTO Art ' + st.cls + 'クラス')
      + '&dates=' + r.date.replace(/-/g, '') + 'T' + r.start.replace(':', '').padStart(4, '0') + '00/' + r.date.replace(/-/g, '') + 'T' + r.end.replace(':', '').padStart(4, '0') + '00';
    const ics = CONFIG.API_URL + '?ics=1&cls=' + encodeURIComponent(st.cls) + '&date=' + r.date;
    return `<div class="item"><div class="body" style="font-size:18px;font-weight:700">${md(r.date)} <span style="font-size:11px;letter-spacing:.12em;color:var(--muted)">${dow(r.date)}</span></div>
    <div class="btns"><button class="sbtn out" data-act="open" data-url="${esc(ics)}">iPhone</button><button class="sbtn out" data-act="open" data-url="${esc(g)}">Google</button></div></div>`;
  }).join('') : `<div class="empty">登録できるレッスン日がありません。</div>`}</div>
  <p class="note">前日の夕方にはLINEでもお知らせします。</p></div>`;
}

const chips = bring => bring ? `<div class="chips">${bring.split(/[、,・]/).map(b => b.trim()).filter(Boolean).map(b => `<i>${esc(b)}</i>`).join('')}</div>` : '';

// 分類ごとの色(絵画・工作は固定、ほかは名前から決める)
function catTone(cat) {
  if (/絵|画|デッサン|水彩/.test(cat)) return 'tone-a';
  if (/工作|粘土|立体|造形/.test(cat)) return 'tone-b';
  return ['tone-a', 'tone-b', 'tone-c'][[...cat].reduce((n, c) => n + c.charCodeAt(0), 0) % 3];
}

function tasksView(st) {
  const first = st.upcoming.find(r => r.absent !== '前日まで');
  const t = S.me.today;
  const y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7));
  const months = [[y, m], m === 12 ? [y + 1, 1] : [y, m + 1]].map(([yy, mm]) => `${yy}-${String(mm).padStart(2, '0')}`);
  const section = (key, i) => {
    const rows = st.upcoming.filter(r => r.date.slice(0, 7) === key && r !== first);
    const mon = Number(key.slice(5));
    return `<div class="label">${MONTH_EN[mon - 1]} / ${i === 0 ? '今月' : '来月'}(${mon}月)の課題</div>
    <div class="list">${rows.length ? rows.map(r => `
      <div class="item" style="align-items:flex-start${r.absent ? ';color:var(--gone)' : ''}"><div class="d"><b style="font-size:20px">${md(r.date)}</b><span>${dow(r.date)}</span></div>
      <div class="body" style="display:flex;flex-direction:column;gap:6px">
        <div class="name" style="font-size:${i === 0 ? 15 : 14}px">${r.cat ? `<span class="cat2 ${catTone(r.cat)}">${esc(r.cat)}</span>` : ''}${esc(r.title || '未定')}${r.absent ? '<span class="tag blue">欠席連絡済み</span>' : ''}</div>
        <div style="font-size:${i === 0 ? 13 : 12}px;line-height:1.7;color:${r.body ? '#26354A' : 'var(--muted)'}">${r.body ? esc(r.body) : '内容は決まり次第お知らせします'}</div>
        ${chips(r.bring)}
      </div></div>`).join('') : `<div class="empty">${i === 0 ? '今月これからの課題はありません。' : 'まだ登録されていません。'}</div>`}</div>`;
  };
  return `<div class="page">${sub('ASSIGNMENTS', '子どもクラスの課題')}
  ${first ? `<div class="card"><div class="head"><div class="pill">NEXT</div>
    <div style="display:flex;align-items:baseline;gap:10px"><b>${md(first.date)}</b><span>${dow(first.date)} ${time(first)}</span></div>
    ${first.cat ? `<div class="cat ${catTone(first.cat)}">${esc(first.cat)}</div>` : ''}<div class="tt">${esc(first.title || '課題はまだ決まっていません')}</div></div>
    ${first.body || first.bring ? `<div class="in">${first.body ? `<div>${esc(first.body)}</div>` : ''}${chips(first.bring)}</div>` : ''}</div>`
    : `<div class="list"><div class="empty">課題はまだ登録されていません。</div></div>`}
  ${months.map(section).join('')}
  <div style="height:24px"></div>
  </div>`;
}

// ───────── 作品集 ─────────
// 写真はこのスマホの中(IndexedDB)だけに保存し、教室には送らない
let dbp = null;
function db() {
  if (!window.indexedDB) return Promise.reject(new Error('この端末ではMY作品集を使えません'));
  return dbp || (dbp = new Promise((ok, ng) => {
    const r = indexedDB.open('aoto_works', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('works', { keyPath: 'id' }).createIndex('sid', 'sid');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { dbp = null; ng(new Error('MY作品集を開けませんでした')); };
  }));
}
async function store(mode, fn) {
  const d = await db();
  return new Promise((ok, ng) => {
    const tx = d.transaction('works', mode);
    const req = fn(tx.objectStore('works'));
    tx.oncomplete = () => ok(req.result);
    tx.onerror = tx.onabort = () => {
      const e = tx.error || req.error;
      ng(new Error(e && e.name === 'QuotaExceededError' ? 'スマホの空き容量が足りず、保存できませんでした' : '保存できませんでした'));
    };
  });
}
const worksOf = sid => store('readonly', s => s.index('sid').getAll(sid))
  .then(a => a.sort((x, y) => (y.date + y.created).localeCompare(x.date + x.created)));
const workPut = w => store('readwrite', s => s.put(w));
const workDel = id => store('readwrite', s => s.delete(id));

// 画面に出した写真のURLは、次の画面に移るときに片付ける
let urls = [];
const blobUrl = b => { const u = URL.createObjectURL(b); urls.push(u); return u; };
function freeUrls() { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; }

// 写真は長辺1600pxと480px(一覧用)に縮めて保存する
function shrink(file) {
  return new Promise((ok, ng) => {
    const src = URL.createObjectURL(file), im = new Image();
    const size = max => new Promise((done, fail) => {
      const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      c.toBlob(b => (b ? done(b) : fail(new Error('写真を保存できませんでした'))), 'image/jpeg', 0.85);
    });
    im.onload = () => Promise.all([size(1600), size(480)])
      .then(([full, thumb]) => ok({ full, thumb }), ng)
      .finally(() => URL.revokeObjectURL(src));
    im.onerror = () => { URL.revokeObjectURL(src); ng(new Error('この写真は読み込めませんでした')); };
    im.src = src;
  });
}

const ymd = s => `${s.slice(0, 4)}年${jp(s)}`;
const worksNote = `<p class="note">作品の写真は、このスマホの中だけに保存されます。教室や先生には送られません。<br>機種変更やLINEの入れ直しで消えることがあるので、大切な作品は写真アプリにも残しておいてください。</p>`;

async function renderWorks(st, name, arg) {
  try {
    if (name === 'works-new') return view(workForm());
    const list = await worksOf(st.id);
    if (route().name !== name) return;
    if (name === 'works') return view(worksView(st, list));
    const i = list.findIndex(w => w.id === arg);
    if (i < 0) { location.hash = 'works'; return; }
    S.work = list[i];
    view(name === 'works-edit' ? workForm(list[i]) : workView(list, i));
  } catch (e) {
    view(`<div class="page">${sub('MY PORTFOLIO', 'MY作品集')}<div class="list"><div class="empty">${esc(e.message)}</div></div></div>`);
  }
}

function worksView(st, list) {
  const years = {};
  list.forEach(w => { (years[w.date.slice(0, 4)] = years[w.date.slice(0, 4)] || []).push(w); });
  const head = sub('MY PORTFOLIO', 'MY作品集', '#', `<div style="font-size:12px;color:var(--muted);padding-right:8px">${esc(st.name)} さん</div>`);
  if (!list.length) {
    return `<div class="page">${head}
    <div class="hero"><div class="eyebrow">MY WORKS</div>
      <div style="font-size:18px;font-weight:700;line-height:1.6">自分の作品を、ここに貯めておけます</div>
      <div style="font-size:13px;line-height:1.8;color:var(--navy-muted)">作品ができたら写真を撮って追加してください。タイトルやひとことも残せます。使うかどうかは自由です。</div></div>
    <div class="pad" style="margin-top:16px"><a class="btn" href="#works-new">作品を追加する</a></div>
    ${worksNote}</div>`;
  }
  return `<div class="page">${head}
  <div class="pad"><a class="btn" href="#works-new">作品を追加する</a></div>
  ${Object.keys(years).sort().reverse().map(y => `<div class="label">${y} ・ ${years[y].length}点</div>
  <div class="wgrid">${years[y].map(w => `<a href="#work/${w.id}"><img src="${blobUrl(w.thumb)}" alt="${esc(w.title || md(w.date))}" loading="lazy"><span>${md(w.date)}</span></a>`).join('')}</div>`).join('')}
  ${worksNote}</div>`;
}

function workView(list, i) {
  const w = list[i];
  const nav = (j, t) => (list[j] ? `<a href="#work/${list[j].id}">${t}</a>` : `<span style="opacity:.35">${t}</span>`);
  return `<div class="page">${sub('MY PORTFOLIO', 'MY作品集', '#works')}
  <div class="shot"><img src="${blobUrl(w.full)}" alt="${esc(w.title || '作品')}"></div>
  <div class="shotnav">${nav(i - 1, '‹ 新しい')}<span>${i + 1} / ${list.length}</span>${nav(i + 1, '古い ›')}</div>
  <div class="wmeta"><div class="d">${ymd(w.date)}</div>
    <div class="t">${esc(w.title || '無題')}</div>
    ${w.memo ? `<div class="m">${esc(w.memo)}</div>` : ''}</div>
  <div class="pad" style="margin-top:20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
    <button class="btn line" data-act="workSave">写真を保存</button>
    <a class="btn line" href="#works-edit/${w.id}">編集</a></div>
  <div class="foot" style="justify-content:center"><button class="sbtn txt" data-act="workDel" data-id="${w.id}">この作品を削除</button></div>
  </div>`;
}

function workForm(w) {
  return `<div class="page">${sub('MY PORTFOLIO', w ? '作品を編集' : '作品を追加', w ? '#work/' + w.id : '#works')}
  <form data-act="work" data-id="${w ? w.id : ''}" style="display:flex;flex-direction:column;flex-grow:1">
  <label class="photo" for="wp"><img id="wpv" alt="" ${w ? `src="${blobUrl(w.full)}"` : 'hidden'}>
    <span id="wpt" ${w ? 'hidden' : ''}>${I.cam}写真を選ぶ</span></label>
  <input id="wp" type="file" name="photo" accept="image/*" hidden>
  ${w ? '<p class="note" style="margin-top:8px;text-align:center">写真をタップすると差し替えられます</p>' : ''}
  <div class="field"><label for="wt">タイトル(任意)</label><input id="wt" name="title" maxlength="40" value="${w ? esc(w.title) : ''}"></div>
  <div class="field"><label for="wd">制作日</label><input id="wd" name="date" type="date" required value="${w ? w.date : S.me.today}"></div>
  <div class="field"><label for="wm">ひとこと(任意)</label><textarea id="wm" name="memo" rows="3" maxlength="400" placeholder="がんばったところ、使った画材など">${w ? esc(w.memo) : ''}</textarea></div>
  <div class="actions"><button class="btn" type="submit">保存する</button></div>
  </form></div>`;
}

function shareWork(w) {
  const file = new File([w.full], `${(w.title || '作品').replace(/[\\/:*?"<>|]/g, '')}_${w.date}.jpg`, { type: 'image/jpeg' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).catch(e => { if (e.name !== 'AbortError') toast('写真を長押しすると保存できます'); });
  } else {
    toast('写真を長押しすると保存できます');
  }
}

function registerView() {
  const back = S.me.students.length ? '#' : '';
  return `<div class="page">
  <div class="top"><div><img src="logo.svg" alt="AOTO ART"><div class="place">芸術教室 ─ 芦屋</div></div></div>
  ${back ? sub('REGISTER', 'きょうだいを追加') : `<div class="pad"><div class="eyebrow">WELCOME</div><div class="title" style="font-size:22px;margin-top:4px">はじめての登録</div>
  <p class="note" style="margin:8px 0 0">生徒さんのお名前とクラスを登録してください。先生が確認すると使えるようになります。</p></div>`}
  <form data-act="register">
  <div class="field"><label for="rname">生徒さんのお名前</label><input id="rname" name="name" required maxlength="40" autocomplete="name"></div>
  <div class="label">クラス</div>
  <fieldset class="pick"><legend style="position:absolute;left:-9999px">クラス</legend>
    <label><div class="k">日曜<input type="radio" name="cls" value="一般" checked></div><b style="font-size:22px">一般</b></label>
    <label><div class="k">土曜<input type="radio" name="cls" value="子ども"></div><b style="font-size:22px">子ども</b></label>
  </fieldset>
  <div class="actions" style="margin-top:20px"><button class="btn" type="submit">登録する</button></div>
  </form>
  ${back ? '' : `<details style="margin:24px 16px 0"><summary style="font-size:12px;color:var(--muted)">先生の方はこちら</summary>
  <form data-act="registerStaff">
    <div class="field" style="margin-left:0;margin-right:0"><label for="sname">先生のお名前</label><input id="sname" name="name" required maxlength="20"></div>
    <div class="field" style="margin-left:0;margin-right:0"><label for="sword">合言葉</label><input id="sword" name="word" required autocomplete="off"></div>
    <div style="margin-top:12px"><button class="btn line" type="submit">先生として登録</button></div>
  </form></details>`}
  </div>`;
}

function pendingView(st) {
  return `<div class="page"><div class="top"><div><img src="logo.svg" alt="AOTO ART"><div class="place">芸術教室 ─ 芦屋</div></div></div>
  <div class="hero"><div class="eyebrow">THANK YOU</div><div style="font-size:18px;font-weight:700;line-height:1.6">${esc(st.name)} さんの登録を受け付けました</div>
  <div style="font-size:13px;line-height:1.8;color:var(--navy-muted)">先生が確認すると使えるようになります。しばらくお待ちください。</div></div>
  <div class="actions"><button class="btn line" data-act="reload">もう一度読み込む</button></div></div>`;
}

// ───────── 先生の画面 ─────────
function staffShell(tab, body) {
  const tabs = [['staff', '名簿'], ['staff-msg', '連絡'], ['staff-bc', '一斉LINE']];
  if (S.me.students.length) tabs.push(['', '生徒画面']);
  return `<div class="page dark" style="padding-bottom:0">
  <div class="stafftop"><div class="l"><img src="logo-white.svg" alt="AOTO ART"><span>STAFF</span></div><div class="who">${esc(S.me.staffName)}</div></div>
  ${body}
  <nav class="tabs" style="--n:${tabs.length}">${tabs.map(([h, t]) => `<a href="#${h}" ${h === tab ? 'aria-current="page"' : ''}>${t}</a>`).join('')}</nav></div>`;
}

// 先生の画面は、前に読んだ内容をすぐ出してから、裏で最新に更新する
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const loading = name => view(staffShell(name, '<div class="loading">読み込み中…</div>'));
const still = name => route().name === name;

async function renderStaff(name, arg) {
  try {
    if (name === 'staff-msg') {
      if (S.msgInfo && S.unpaid) view(staffShell(name, staffMsgView())); else loading(name);
      const [info, unpaid] = await Promise.all([api('msgInfo'), api('unpaid')]);
      const changed = !same(info, S.msgInfo) || !same(unpaid, S.unpaid);
      S.msgInfo = info; S.unpaid = unpaid;
      if (changed && still(name)) { S.preview = null; view(staffShell(name, staffMsgView())); }
      return;
    }
    if (name === 'staff-bc') {
      if (S.msgInfo) view(staffShell(name, staffBcView())); else loading(name);
      const info = await api('msgInfo');
      const changed = !same(info, S.msgInfo);
      S.msgInfo = info;
      if (changed && still(name) && !document.getElementById('bt').value) view(staffShell(name, staffBcView()));
      return;
    }
    const key = arg || '';
    if (S.days[key]) { S.day = S.days[key]; view(staffShell('staff', staffDayView(S.day))); } else loading('staff');
    const d = await api('staffDay', { date: arg });
    S.days[key] = d; S.days[d.date] = d;
    if (still('staff') && (route().arg || '') === key && !same(d, S.day)) { S.day = d; view(staffShell('staff', staffDayView(d))); }
  } catch (e) {
    toast(e.message, true);
  }
}

function staffDayView(d) {
  const all = d.groups.flatMap(g => g.students);
  const absent = all.filter(s => s.absent);
  const unpaid = all.filter(s => !s.absent && s.due);
  return `
  <div class="daynav"><div><div class="eyebrow">${d.date === d.today ? 'TODAY' : 'LESSON'} ・ ${d.groups.map(g => esc(g.cls)).join('・') || 'レッスンなし'}</div>
  <div class="bigdate" style="margin-top:6px"><b>${md(d.date)}</b><span>${dow(d.date)}</span></div></div>
  <div style="display:flex;gap:6px"><button data-act="day" data-date="${d.prev}" ${d.prev ? '' : 'disabled'} aria-label="前のレッスン日">‹</button><button data-act="day" data-date="${d.next}" ${d.next ? '' : 'disabled'} aria-label="次のレッスン日">›</button></div></div>
  <div class="stats"><div><small>出席予定</small><b>${all.length - absent.length}</b></div><div><small>欠席</small><b>${absent.length}</b></div><div><small>受講料 受取待ち</small><b class="w">${unpaid.length}</b></div></div>
  ${d.groups.map(g => `<div class="grouphead"><b>${esc(g.cls)}クラス</b><span>${time(g.lesson)}${g.cls === '子ども' && g.lesson.title ? ' ・ ' + esc(g.lesson.title) : ''}</span></div>
  <div class="list">${g.students.length ? g.students.map(s => staffRow(s, d.date, g.cls)).join('') : '<div class="empty">在籍の生徒がいません</div>'}</div>`).join('')
  || '<div class="note">この日はレッスンがありません。</div>'}
  <div style="height:24px"></div>`;
}

function staffRow(s, date, cls) {
  if (s.absent) {
    return `<div class="item gone"><div class="body"><div class="name" style="text-decoration:line-through">${esc(s.name)}</div>
    <div class="sm">${s.absent === '前日まで' ? '欠席連絡(前日まで)・1回分を次回へ' : '当日欠席・次回に回す対象外'}</div></div><div style="font-size:12px;font-weight:600">欠席</div></div>`;
  }
  let right;
  if (s.paid) right = `<div class="paid">${I.check}${esc(s.paid)}</div>`;
  else if (s.due && cls === '子ども') right = `<button class="sbtn" data-act="receive" data-id="${s.id}" data-date="${date}">${yen(s.due.amount)} 受取</button>`;
  else if (s.due) right = `<div class="btns"><button class="sbtn" data-act="receive" data-id="${s.id}" data-date="${date}" data-kind="2回セット">2回 受取</button><button class="sbtn out" data-act="receive" data-id="${s.id}" data-date="${date}" data-kind="1回">1回</button></div>`;
  else right = `<button class="sbtn txt" data-act="sameday" data-id="${s.id}" data-date="${date}">当日欠席</button>`;
  const sm = s.due ? `${s.due.overdue ? '<b style="color:var(--warn)">未受領あり</b> ・ ' : ''}${esc(s.due.label)} ${yen(s.due.amount)}` : '受講料 受取済み';
  return `<div class="item"><div class="body"><div class="name">${esc(s.name)}</div><div class="sm">${sm}</div></div>${right}</div>`;
}

function quotaLine(q, n) {
  if (!q) return '';
  const left = q.limit == null ? '上限なし' : `今月の残り ${Math.max(0, q.limit - q.used)} / ${q.limit}通`;
  return `<div class="quota"><span>今回の送信</span><span><b>${n}通</b> ・ ${left}</span></div>`;
}

function staffMsgView() {
  const info = S.msgInfo, un = S.unpaid.list;
  const opts = info.months.map(m => `<option value="${m.cls}|${m.month}">${esc(m.cls)} ・ ${Number(m.month.slice(5))}月(${m.dates.map(md).join('、')})</option>`).join('');
  return `
  <div class="grouphead" style="padding-top:24px"><b>レッスン日をお知らせ</b><span>SCHEDULE</span></div>
  ${opts ? `<form data-act="announce">
  <div class="field" style="margin-top:0"><label for="am">クラスと月</label><select id="am" name="key">${opts}</select></div>
  ${S.preview ? `<div class="preview">${esc(S.preview.preview)}</div>${quotaLine(info.quota, S.preview.count)}
    <div class="pad" style="margin-top:12px;display:grid;gap:8px"><button class="btn" type="submit" name="go" value="send">この内容で送信(${S.preview.count}名)</button></div>`
    : `<div class="pad" style="margin-top:12px"><button class="btn" type="submit" name="go" value="preview">文面を確認する</button></div>`}
  </form>` : `<p class="note">スプレッドシートの「レッスン日」に、これからのレッスン日を入れてください。</p>`}
  <div style="margin:24px 24px 0;height:1px;background:var(--navy-line)"></div>
  <div class="grouphead"><b>受講料の未受領</b><span style="color:#FFB48A">TUITION</span></div>
  <p class="note" style="margin-top:0">レッスンが終わっても受講料が未受領の人です。送る人だけチェックしてください。</p>
  <form data-act="sendUnpaid">
  <div class="list" style="margin-top:10px">${un.length ? un.map(u => `<label class="check"><input type="checkbox" name="ids" value="${u.id}">
    <div><div class="name" style="font-weight:700">${esc(u.name)}</div><div class="sm" style="font-size:11px;color:var(--muted)">${esc(u.cls)} ・ ${esc(u.due.label)} ${yen(u.due.amount)}${u.memo ? ' ・ メモ「' + esc(u.memo) + '」' : ''}</div></div></label>`).join('')
    : '<div class="empty">未受領の人はいません</div>'}</div>
  ${un.length ? `<div class="pad" style="margin-top:12px"><button class="btn" type="submit">確認して送信</button></div>` : ''}
  </form><div style="height:24px"></div>`;
}

function staffBcView() {
  const c = S.msgInfo.counts;
  return `<form data-act="broadcast" style="display:flex;flex-direction:column;flex-grow:1">
  <div class="label">送る相手</div>
  <fieldset class="pick three"><legend style="position:absolute;left:-9999px">送る相手</legend>
  ${[['全員', '全員'], ['一般', '一般(日)'], ['子ども', '子ども(土)']].map(([v, t], i) => `<label><div class="k"><input type="radio" name="target" value="${v}" ${i === 0 ? 'checked' : ''}></div>
    <span style="font-size:13px;font-weight:700">${t}</span><span style="font-size:11px;color:var(--navy-muted)">${c[v]}名</span></label>`).join('')}
  </fieldset>
  <div class="field"><label for="bt">メッセージ</label><textarea id="bt" name="text" rows="7" required></textarea></div>
  <label style="margin:12px 24px 0;display:flex;gap:10px;align-items:center;font-size:13px"><input type="checkbox" name="keep" checked style="width:20px;height:20px;accent-color:#004796">アプリのお知らせにも残す</label>
  <p class="note" style="margin-top:6px">1行目がお知らせのタイトルになります。</p>
  <div id="bcq">${quotaLine(S.msgInfo.quota, c['全員'])}</div>
  <div class="actions" style="padding-bottom:24px"><button class="btn" type="submit">確認して送信</button></div>
  </form>`;
}

// ───────── 操作 ─────────
function setDay(d) {
  S.days[d.date] = d; S.days[route().arg || ''] = d; S.day = d;
  S.unpaid = null;
  view(staffShell('staff', staffDayView(d)));
}

// 処理中は、ほかのボタンを押しても何も起きない(2回押し防止)
async function busy(el, fn) {
  if (inflight) return;
  inflight = true;
  const btns = el.tagName === 'FORM' ? [...el.querySelectorAll('button')] : [el];
  btns.forEach(b => { b.disabled = true; });
  try { await fn(); } catch (e) { toast(e.message, true); } finally {
    inflight = false;
    btns.forEach(b => { if (b.isConnected) b.disabled = false; });
  }
}

function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'FORM') return;
  const act = b.dataset.act;
  if (act === 'open') { e.preventDefault(); openUrl(b.dataset.url); return; }
  if (act === 'sel') { S.sel = Number(b.dataset.i); render(); return; }
  if (act === 'reload') { busy(b, async () => { S.me = await api('me'); render(); }); return; }
  if (act === 'day') { location.hash = 'staff/' + b.dataset.date; return; }
  if (act === 'workSave') { shareWork(S.work); return; }
  if (act === 'workDel') {
    if (!confirm('この作品をMY作品集から削除しますか?\nこのスマホから消えて、元に戻せません。')) return;
    busy(b, async () => { await workDel(b.dataset.id); toast('削除しました'); location.hash = 'works'; });
    return;
  }
  if (act === 'cancel') {
    if (!confirm(jp(b.dataset.date) + ' の欠席連絡を取り消して、出席にしますか?')) return;
    busy(b, async () => { S.me = await api('cancelAbsence', { studentId: student().id, date: b.dataset.date }); toast('出席に戻しました'); render(); });
    return;
  }
  if (act === 'receive') {
    const s = S.day.groups.flatMap(g => g.students).find(x => x.id === b.dataset.id);
    const label = b.dataset.kind ? b.dataset.kind : s.due.label;
    if (!confirm(`${s.name}さんから ${label} を受け取りましたか?`)) return;
    busy(b, async () => { setDay(await api('receive', { studentId: b.dataset.id, date: b.dataset.date, kind: b.dataset.kind })); toast('受け取りを記録しました'); });
    return;
  }
  if (act === 'sameday') {
    const s = S.day.groups.flatMap(g => g.students).find(x => x.id === b.dataset.id);
    if (!confirm(`${s.name}さんを当日欠席(次回に回す対象外)にしますか?`)) return;
    busy(b, async () => { setDay(await api('sameDay', { studentId: b.dataset.id, date: b.dataset.date })); });
  }
}

function onChange(e) {
  const f = e.target.form;
  if (!f) return;
  if (f.dataset.act === 'work' && e.target.name === 'photo' && e.target.files[0]) {
    const img = document.getElementById('wpv');
    img.src = blobUrl(e.target.files[0]);
    img.hidden = false;
    document.getElementById('wpt').hidden = true;
  }
  if (f.dataset.act === 'absent' && e.target.name === 'date') {
    document.getElementById('absinfo').innerHTML = absInfo(student(), e.target.value);
  }
  if (f.dataset.act === 'broadcast' && e.target.name === 'target') {
    document.getElementById('bcq').innerHTML = quotaLine(S.msgInfo.quota, S.msgInfo.counts[e.target.value]);
  }
  if (f.dataset.act === 'announce' && e.target.name === 'key' && S.preview) {
    S.preview = null;
    view(staffShell('staff-msg', staffMsgView()));
    document.getElementById('am').value = e.target.value;
  }
}

function onSubmit(e) {
  e.preventDefault();
  const f = e.target, fd = new FormData(f), act = f.dataset.act;
  busy(f, async () => {
    if (act === 'work') {
      const file = fd.get('photo');
      const has = file && file.size;
      const old = f.dataset.id ? S.work : null;
      if (!old && !has) { toast('写真を選んでください', true); return; }
      const w = old ? { ...old } : { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), sid: student().id, created: new Date().toISOString() };
      if (has) {
        document.body.classList.add('busy');
        try { Object.assign(w, await shrink(file)); } finally { document.body.classList.remove('busy'); }
      }
      Object.assign(w, { title: fd.get('title').trim(), date: fd.get('date') || S.me.today, memo: fd.get('memo').trim() });
      await workPut(w);
      // 端末の空き容量が少ないときに、勝手に消されにくくする
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      toast('MY作品集に保存しました');
      location.hash = 'work/' + w.id;
    } else if (act === 'absent') {
      const date = fd.get('date');
      const msg = date > S.me.today ? `${jp(date)} を欠席連絡します。お休みした1回分は次回以降に回ります。` : `${jp(date)} は当日のご連絡のため、次回に回す対象外となります。欠席連絡しますか?`;
      if (!confirm(msg)) return;
      S.me = await api('absent', { studentId: student().id, date, memo: fd.get('memo') });
      toast('欠席連絡を受け付けました');
      location.hash = 'lessons';
    } else if (act === 'register') {
      S.me = await api('register', { name: fd.get('name'), cls: fd.get('cls') });
      S.sel = S.me.students.length - 1;
      location.hash = '';
      render();
    } else if (act === 'registerStaff') {
      S.me = await api('registerStaff', { name: fd.get('name'), word: fd.get('word') });
      location.hash = 'staff';
    } else if (act === 'announce') {
      const [cls, month] = fd.get('key').split('|');
      if (e.submitter && e.submitter.value === 'send') {
        if (!confirm(`${cls}クラスの${Number(month.slice(5))}月のレッスン日を送信します。よろしいですか?`)) return;
        const r = await api('announce', { cls, month });
        toast(`${r.sent}名に送信しました`);
        S.preview = null;
      } else {
        S.preview = await api('announce', { cls, month, preview: true });
      }
      view(staffShell('staff-msg', staffMsgView()));
      const sel = document.getElementById('am');
      if (sel) sel.value = cls + '|' + month;
    } else if (act === 'sendUnpaid') {
      const ids = fd.getAll('ids');
      if (!ids.length) { toast('送る人をチェックしてください', true); return; }
      if (!confirm(`${ids.length}名に受講料のお知らせを送信します。よろしいですか?`)) return;
      const r = await api('sendUnpaid', { ids });
      toast(`${r.sent}名に送信しました`);
    } else if (act === 'broadcast') {
      const target = fd.get('target');
      if (!confirm(`${target === '全員' ? '全員' : target + 'クラス'}(${S.msgInfo.counts[target]}名)に送信します。よろしいですか?`)) return;
      const r = await api('broadcast', { target, text: fd.get('text'), keep: !!fd.get('keep') });
      toast(`${r.sent}名に送信しました`);
      f.reset();
    }
  });
}

boot();
