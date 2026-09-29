// AOTO教室アプリ(芦屋)画面
const $app = document.getElementById('app');
const S = { idToken: null, me: null, sel: 0, staffDay: null, msgInfo: null, unpaid: null, preview: null };

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
};

function toast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { t.className = ''; }, 3200);
}

async function api(action, params = {}) {
  const res = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action, idToken: S.idToken, ...params }) });
  const j = await res.json();
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
  if (window.liff && liff.isInClient()) liff.openWindow({ url, external: true });
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
  } catch (e) {
    $app.innerHTML = `<div class="errorpage"><div class="title">うまく開けませんでした</div><p>${esc(e.message)}</p><p>時間をおいてもう一度開くか、教室にご連絡ください。</p></div>`;
  }
}

const route = () => { const [name = '', arg = ''] = location.hash.slice(1).split('/'); return { name, arg: decodeURIComponent(arg) }; };
const student = () => S.me.students[S.sel] || S.me.students[0];
function view(html) { $app.innerHTML = html; window.scrollTo(0, 0); }

async function render() {
  const { name, arg } = route();
  const me = S.me;
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
  if (name === 'register') return view(registerView());
  return view(homeView(st));
}

const sub = (eyebrow, title, back = '#', extra = '') => `
  <div class="sub"><a class="back" href="${back}" aria-label="戻る">${I.back}</a>
  <div style="flex-grow:1"><div class="eyebrow">${eyebrow}</div><div class="title">${title}</div></div>${extra}</div>`;

// ───────── 生徒の画面 ─────────
function homeView(st) {
  const me = S.me, set = me.settings;
  const next = st.upcoming.find(r => r.absent !== '前日まで');
  const sibs = me.students.length > 1 ? `<div class="sibs">${me.students.map((s, i) =>
    `<button type="button" data-act="sel" data-i="${i}" aria-pressed="${i === S.sel}">${esc(s.name)}</button>`).join('')}</div>` : '';
  let fee;
  if (st.due && st.due.overdue) fee = `<div class="warn">${yen(st.due.amount)} 未受領</div><div class="small">次回、現金でお持ちください</div>`;
  else if (st.due && next && st.due.date === next.date) fee = `<div class="warn">次回 ${yen(st.due.amount)}</div><div class="small">${esc(st.due.label)}・現金でお持ちください</div>`;
  else if (st.due) fee = `<div class="ok">お支払い済み</div><div class="small">次のお支払いは ${md(st.due.date)}</div>`;
  else fee = `<div class="ok">お支払い済み</div>`;
  const m = st.month;
  const links = [[set.hp, 'ホームページ', I.web], [set.instagram, 'Instagram', I.insta], [set.events, '展覧会・イベント', I.event]].filter(x => x[0]);
  return `<div class="page">
  <div class="top"><div><img src="logo.svg" alt="AOTO ART"><div class="place">芸術教室 ─ 芦屋</div></div>
  <div class="who">${esc(st.name)} さん<br>${esc(st.cls)}クラス</div></div>
  ${sibs}
  <div class="hero">
    <div style="display:flex;justify-content:space-between;align-items:center"><div class="eyebrow">NEXT LESSON</div><div class="dim" style="font-size:11px">${esc(st.cls)}クラス</div></div>
    ${next ? `<div class="bigdate"><b>${md(next.date)}</b><span>${dow(next.date)}</span></div>
    <div class="rule"></div><div class="row2"><div>${time(next)}</div><div class="dim">${next.title ? '課題あり' : ''}</div></div>`
    : `<div style="font-size:15px">次のレッスン日はまだお知らせしていません</div>`}
  </div>
  <div class="tiles2">
    <div class="tile"><div class="eyebrow" style="color:var(--muted)">THIS MONTH</div>
      <div style="margin-top:8px;display:flex;align-items:baseline;gap:4px"><span class="n">${m.planned}</span><span class="of">/ ${m.total} 回 出席予定</span></div>
      <div class="bars">${Array.from({ length: m.total }, (_, i) => `<i class="${i < m.planned ? 'on' : ''}"></i>`).join('')}</div></div>
    <div class="tile"><div class="eyebrow" style="color:var(--muted)">受講料</div>${fee}</div>
  </div>
  <nav class="menu">
    <a href="#lessons"><span class="no">01</span><span class="t">レッスン日</span>${I.arrow}</a>
    <a href="#absence"><span class="no">02</span><span class="t">欠席連絡</span>${I.arrow}</a>
    ${st.cls === '子ども' ? `<a href="#tasks"><span class="no">03</span><span class="t">課題を見る</span>${I.arrow}</a>` : ''}
    <a href="#calendar"><span class="no">${st.cls === '子ども' ? '04' : '03'}</span><span class="t">カレンダーに登録</span>${I.arrow}</a>
    ${me.isStaff ? `<a href="#staff"><span class="no">★</span><span class="t">先生の画面</span>${I.arrow}</a>` : ''}
  </nav>
  ${links.length ? `<div class="linkhead"><b>AOTO ART</b><span>AOTO Bagでイベント300円引き</span></div>
  <div class="links">${links.map(([u, t, i]) => `<a href="#" data-act="open" data-url="${esc(u)}">${i}<span>${t}</span></a>`).join('')}</div>` : ''}
  <div class="foot"><span>お急ぎはお電話で</span><a href="tel:${esc(set.phone)}" style="color:var(--muted);font-weight:600">${esc(set.phone)}</a></div>
  <div class="foot" style="padding-top:0"><a href="#register" style="color:var(--muted)">きょうだいを追加する</a></div>
  </div>`;
}

function lessonRow(st, r) {
  const today = S.me.today;
  if (r.absent === '前日まで') {
    return `<div class="item gone"><div class="d"><b>${dd(r.date)}</b><span>${dow(r.date)}</span></div>
    <div class="body"><div class="st">欠席連絡済み</div><div class="sm">次のレッスン日へずらしました</div></div>
    ${r.date > today ? `<button class="sbtn txt" data-act="cancel" data-date="${r.date}">取り消す</button>` : ''}</div>`;
  }
  if (r.absent === '当日') {
    return `<div class="item gone"><div class="d"><b>${dd(r.date)}</b><span>${dow(r.date)}</span></div>
    <div class="body"><div class="st">当日のご欠席</div><div class="sm">1回ご受講として扱います</div></div></div>`;
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
  <p class="note">前日までに欠席連絡をいただくと、その回は次のレッスン日にずらせます。</p>
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
  <div class="actions"><button class="btn" type="submit">欠席連絡する</button></div>
  </form></div>`;
}

function absInfo(st, date) {
  if (date > S.me.today) {
    return `<div class="box"><div class="h">${I.check}前日までのご連絡なので、次のレッスン日にずらせます</div>
    <div class="kv"><span>${jp(date)}</span><b>次のレッスン日へ</b></div></div>`;
  }
  return `<div class="box warn"><div class="h">当日のご連絡です</div>
  <div style="font-size:12px;line-height:1.7">当日のご連絡の場合は、1回ご受講されたものとして扱います。</div></div>`;
}

function calendarView(st) {
  const set = CONFIG.API_URL;
  const feed = set.replace(/^https?:/, 'webcal:') + '?feed=' + encodeURIComponent(st.calKey);
  const rows = st.upcoming.filter(r => r.absent !== '前日まで').slice(0, 6);
  return `<div class="page">${sub('CALENDAR', 'カレンダーに登録')}
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

function tasksView(st) {
  const rows = st.upcoming.filter(r => r.absent !== '前日まで');
  const first = rows[0];
  const rest = rows.slice(1, 6);
  return `<div class="page">${sub('ASSIGNMENTS', '子どもクラスの課題')}
  ${first ? `<div class="card"><div class="head"><div style="display:flex;justify-content:space-between;align-items:center"><div class="pill">NEXT</div></div>
    <div style="display:flex;align-items:baseline;gap:10px"><b>${md(first.date)}</b><span>${dow(first.date)} ${time(first)}</span></div>
    <div class="tt">${esc(first.title || '課題はまだ決まっていません')}</div></div>
    <div class="in">${first.body ? `<div>${esc(first.body)}</div>` : ''}
    ${first.bring ? `<div class="chips">${first.bring.split(/[、,・]/).filter(Boolean).map(b => `<i>${esc(b.trim())}</i>`).join('')}</div>` : ''}
    ${S.me.settings.hp ? `<a href="#" data-act="open" data-url="${esc(S.me.settings.hp)}" style="font-weight:700;display:flex;align-items:center;gap:6px;text-decoration:none">これまでの作品をHPで見る${I.out}</a>` : ''}</div></div>` : `<div class="list"><div class="empty">課題はまだ登録されていません。</div></div>`}
  ${rest.length ? `<div class="label">UPCOMING / この先の課題</div><div class="list">${rest.map(r => `
    <div class="item"><div class="d"><b style="font-size:20px">${md(r.date)}</b><span>${dow(r.date)}</span></div>
    <div class="body"><div class="name">${esc(r.title || '未定')}</div></div></div>`).join('')}</div>` : ''}
  </div>`;
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

async function renderStaff(name, arg) {
  if (name === 'staff-msg') {
    view(staffShell(name, '<div class="loading">読み込み中…</div>'));
    const [info, unpaid] = await Promise.all([api('msgInfo'), api('unpaid')]);
    S.msgInfo = info; S.unpaid = unpaid; S.preview = null;
    return view(staffShell(name, staffMsgView()));
  }
  if (name === 'staff-bc') {
    view(staffShell(name, '<div class="loading">読み込み中…</div>'));
    S.msgInfo = await api('msgInfo');
    return view(staffShell(name, staffBcView()));
  }
  if (!S.staffDay || arg !== (S.staffDay.date || '') || !arg) {
    view(staffShell('staff', '<div class="loading">読み込み中…</div>'));
    S.staffDay = await api('staffDay', { date: arg });
  }
  view(staffShell('staff', staffDayView(S.staffDay)));
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
  ${d.groups.map(g => `<div class="grouphead"><b>${esc(g.cls)}クラス</b><span>${time(g.lesson)}${g.lesson.title ? ' ・ ' + esc(g.lesson.title) : ''}</span></div>
  <div class="list">${g.students.length ? g.students.map(s => staffRow(s, d.date, g.cls)).join('') : '<div class="empty">在籍の生徒がいません</div>'}</div>`).join('')
  || '<div class="note">この日はレッスンがありません。</div>'}
  <div style="height:24px"></div>`;
}

function staffRow(s, date, cls) {
  if (s.absent) {
    return `<div class="item gone"><div class="body"><div class="name" style="text-decoration:line-through">${esc(s.name)}</div>
    <div class="sm">${s.absent === '前日まで' ? '欠席連絡(前日まで)・次回へずらし' : '当日欠席・1回受講扱い'}</div></div><div style="font-size:12px;font-weight:600">欠席</div></div>`;
  }
  let right;
  if (s.paid) right = `<div class="paid">${I.check}${esc(s.paid)}</div>`;
  else if (s.due && cls === '子ども') right = `<button class="sbtn" data-act="receive" data-id="${s.id}" data-date="${date}">${yen(s.due.amount)} 受取</button>`;
  else if (s.due) right = `<div class="btns"><button class="sbtn" data-act="receive" data-id="${s.id}" data-date="${date}" data-kind="2回セット">2回 受取</button><button class="sbtn out" data-act="receive" data-id="${s.id}" data-date="${date}" data-kind="1回">1回</button></div>`;
  else right = `<button class="sbtn txt" data-act="sameday" data-id="${s.id}" data-date="${date}">当日欠席</button>`;
  const sm = s.due ? `${s.due.overdue ? '未受領あり ・ ' : ''}${esc(s.due.label)} ${yen(s.due.amount)}` : '受講料 受取済み';
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
  <div id="bcq">${quotaLine(S.msgInfo.quota, c['全員'])}</div>
  <div class="actions" style="padding-bottom:24px"><button class="btn" type="submit">確認して送信</button></div>
  </form>`;
}

// ───────── 操作 ─────────
async function busy(el, fn) {
  const btns = el.querySelectorAll ? el.querySelectorAll('button') : [];
  btns.forEach(b => { b.disabled = true; });
  if (el.tagName === 'BUTTON') el.disabled = true;
  try { await fn(); } catch (e) { toast(e.message, true); } finally {
    btns.forEach(b => { b.disabled = false; });
    if (el.tagName === 'BUTTON') el.disabled = false;
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
  if (act === 'cancel') {
    if (!confirm(jp(b.dataset.date) + ' の欠席連絡を取り消して、出席にしますか?')) return;
    busy(b, async () => { S.me = await api('cancelAbsence', { studentId: student().id, date: b.dataset.date }); toast('出席に戻しました'); render(); });
    return;
  }
  if (act === 'receive') {
    const s = S.staffDay.groups.flatMap(g => g.students).find(x => x.id === b.dataset.id);
    const label = b.dataset.kind ? b.dataset.kind : s.due.label;
    if (!confirm(`${s.name}さんから ${label} を受け取りましたか?`)) return;
    busy(b, async () => { S.staffDay = await api('receive', { studentId: b.dataset.id, date: b.dataset.date, kind: b.dataset.kind }); toast('受け取りを記録しました'); render(); });
    return;
  }
  if (act === 'sameday') {
    const s = S.staffDay.groups.flatMap(g => g.students).find(x => x.id === b.dataset.id);
    if (!confirm(`${s.name}さんを当日欠席(1回受講扱い)にしますか?`)) return;
    busy(b, async () => { S.staffDay = await api('sameDay', { studentId: b.dataset.id, date: b.dataset.date }); render(); });
  }
}

function onChange(e) {
  const f = e.target.form;
  if (!f) return;
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
    if (act === 'absent') {
      const date = fd.get('date');
      const msg = date > S.me.today ? `${jp(date)} を欠席連絡します。次のレッスン日にずらします。` : `${jp(date)} は当日のため、1回ご受講として扱います。欠席連絡しますか?`;
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
      const r = await api('broadcast', { target, text: fd.get('text') });
      toast(`${r.sent}名に送信しました`);
      f.reset();
    }
  });
}

boot();
