// ============================================================
//  app.js — Logic chính: render, state, actions
//  Trợ lý Chấm Chữa Bài · Thanh Lân
// ============================================================


// ============================================================
//  KHỞI TẠO DỮ LIỆU
// ============================================================

const sampleNames = [
  'Nguyễn Minh An', 'Trần Ngọc Bảo', 'Lê Hà Chi',
  'Phạm Gia Huy',   'Hoàng Khánh Linh', 'Đỗ Đức Minh',
];

const sampleTypes = ['png', 'pdf', 'jpg', 'png', 'pdf', 'jpg'];

/** Tạo danh sách học sinh mẫu từ seeds, gán tên và tệp đính kèm */
const makeSeeds = () =>
  structuredClone(seeds).map((s, i) => ({
    ...s,
    name: sampleNames[i],
    attachments: [{
      key:       'sample-' + s.id,
      name:      sampleNames[i] + '.' + sampleTypes[i],
      type:      sampleTypes[i] === 'pdf'  ? 'application/pdf'
               : sampleTypes[i] === 'png'  ? 'image/png'
               :                             'image/jpeg',
      sampleUrl: 'samples/' + s.id + '.' + sampleTypes[i],
    }],
    sample: true,
  }));

/** Tạo một học sinh rỗng (chưa có bài) */
const blankStudent = (id, name) => ({
  id,
  name,
  text:        '',
  state:       'new',
  custom:      true,
  attachments: [],
  logs:        [],
});

/** Dữ liệu ban đầu (2 lớp mẫu) */
const initialData = () => ({
  classId: '4A',
  classes: [
    {
      id:       '4A',
      label:    'Lớp 4A',
      students: makeSeeds(),
    },
    {
      id:       '4B',
      label:    'Lớp 4B',
      students: ['Bùi Minh Anh', 'Nguyễn Hải Đăng', 'Trần Tuệ Lâm', 'Lê Bảo Ngọc']
                  .map((n, i) => blankStudent('HS' + String(i + 1).padStart(2, '0'), n)),
    },
  ],
});


// ============================================================
//  STATE
// ============================================================

let data, storageOK = true;

// Thử load từ localStorage, fallback về initialData
try {
  const saved = JSON.parse(localStorage.getItem('tl-review-v2'));
  data = saved && Array.isArray(saved.classes) && saved.classes.length
       ? saved
       : initialData();
} catch {
  data      = initialData();
  storageOK = false;
}

let classroom = data.classes.find(c => c.id === data.classId) || data.classes[0];
let students  = classroom.students;
let page      = 'intake';
let selected  = students[0]?.id || '';
let tab       = 'review';
let filter    = 'all';
let query     = '';

/** Tên hiển thị cho từng trang */
const names = {
  overview: 'Tổng quan',
  intake:   'Nhận bài & chấm AI',
  grading:  'Chấm, chữa bài',
  roster:   'Danh sách lớp',
  profiles: 'Hồ sơ học tập',
  rubric:   'Tiêu chí đánh giá',
};


// ============================================================
//  TIỆN ÍCH
// ============================================================

/** Tổng cộng mảng số */
const total = a => (a || []).reduce((s, n) => s + Number(n), 0);

/** Format số theo kiểu Việt Nam */
const fmt = n => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

/** Học sinh đang được chọn */
const current = () => students.find(s => s.id === selected) || students[0];

/** Badge trạng thái bài làm */
const badge = s =>
  `<span class="status ${s.state === 'approved' ? 'approved' : s.state === 'new' ? 'new' : ''}">
    ${s.state === 'approved' ? 'Đã duyệt'
    : s.state === 'new' ? (s.attachments?.length ? 'Chờ đọc & chấm' : 'Chưa có bài')
    : 'Chờ GV duyệt'}
  </span>`;


// ============================================================
//  LƯU DỮ LIỆU
// ============================================================

function save() {
  data.classId       = classroom.id;
  classroom.students = students;
  try {
    localStorage.setItem('tl-review-v2', JSON.stringify(data));
  } catch {
    storageOK = false;
    toast('Trình duyệt không cho lưu. Dữ liệu chỉ tồn tại trong phiên này.');
  }
}


// ============================================================
//  TOAST & MODAL
// ============================================================

function toast(t) {
  $('#toast').textContent    = t;
  $('#toast').style.display  = 'block';
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => $('#toast').style.display = 'none', 4000);
}

function modal(title, body) {
  $('#modalContent').innerHTML =
    `<div class="modal-head">
       <h2>${title}</h2>
       <button class="iconbtn" data-action="close" aria-label="Đóng">×</button>
     </div>${body}`;
  $('#modal').showModal();
}


// ============================================================
//  THỐNG KÊ LỚP
// ============================================================

function stats() {
  const approved = students.filter(s => s.state === 'approved');
  const pending  = students.filter(s => s.state === 'suggested');
  const avgScore = approved.length
    ? fmt(approved.reduce((a, s) => a + total(s.teacherScores), 0) / approved.length)
    : '—';

  return `
    <div class="stats">
      <div class="stat">
        <div class="stat-top">Học sinh trong lớp <span class="stat-icon">▤</span></div>
        <div class="stat-value">${students.length.toString().padStart(2, '0')}</div>
        <small>Tiếng Việt · ${esc(classroom.label)} minh họa</small>
      </div>
      <div class="stat">
        <div class="stat-top">Chờ giáo viên duyệt <span class="stat-icon">◷</span></div>
        <div class="stat-value pending">${pending.length.toString().padStart(2, '0')}</div>
        <small>Đã có đề xuất từ AI mô phỏng</small>
      </div>
      <div class="stat">
        <div class="stat-top">Giáo viên đã duyệt <span class="stat-icon">☑</span></div>
        <div class="stat-value good">${approved.length.toString().padStart(2, '0')}</div>
        <small>Kết quả được giáo viên xác nhận</small>
      </div>
      <div class="stat">
        <div class="stat-top">Điểm TB đã duyệt <span class="stat-icon">↗</span></div>
        <div class="stat-value">
          ${avgScore}<span style="font-size:12px;color:#a0ac96;letter-spacing:0"> /10</span>
        </div>
        <small>Chỉ tính bài đã được duyệt</small>
      </div>
    </div>`;
}


// ============================================================
//  CÁC COMPONENT HTML
// ============================================================

/** Banner nhắc nhở vai trò giáo viên */
function notice() {
  return `
    <div class="notice">
      <span class="symbol">✳</span>
      <div>
        <strong>Một trợ lý tận tâm, một quyết định của thầy cô.</strong>
        AI đề xuất điểm và cách chữa; giáo viên kiểm tra, chỉnh sửa và duyệt trước khi sử dụng.
      </div>
    </div>`;
}

/** Tiêu đề trang */
function header(title, sub, actions = '') {
  return `
    <div class="pagehead">
      <div>
        <div class="eyebrow">TRỢ LÝ CHẤM CHỮA BÀI · THANH LÂN</div>
        <h1>${title}</h1>
        <p class="sub">${sub}</p>
      </div>
      <div class="actions">${actions}</div>
    </div>`;
}


// ============================================================
//  RENDER CHÍNH
// ============================================================

function render() {
  renderClassPicker();

  // Highlight nav button đang active
  document.querySelectorAll('nav button')
    .forEach(b => b.classList.toggle('active', b.dataset.page === page));

  $('#crumb').textContent     = names[page];
  $('#navcount').textContent  = students.length;

  // Render nội dung trang
  $('#main').innerHTML =
    page === 'intake'   ? intake()                                    :
    page === 'roster'   ? rosterPage()                                :
    page === 'grading'  ? (students.length ? grading()  : emptyClass()) :
    page === 'profiles' ? (students.length ? profiles() : emptyClass()) :
    page === 'rubric'   ? rubricPage()                                :
                          overview();

  mountAttachmentPreview();

  if (!storageOK) toast('Lưu cục bộ chưa khả dụng; dữ liệu chỉ tồn tại trong phiên này.');
}


// ============================================================
//  DANH SÁCH BÀI LÀM (panel trái)
// ============================================================

function list() {
  const visible = students.filter(s =>
    (filter === 'all' || s.state === filter) &&
    normalize(s.name + ' ' + s.id).includes(normalize(query))
  );

  return `
    <div class="card">
      <div class="card-head">
        <h3>Danh sách bài làm</h3>
        <span class="count">${students.length} HS</span>
      </div>
      <div class="searchbox">
        <span>⌕</span>
        <input
          aria-label="Tìm tên hoặc mã học sinh"
          placeholder="Tìm tên hoặc mã học sinh…"
          value="${esc(query)}"
          id="search">
      </div>
      <div class="filters">
        ${[['all', 'Tất cả'], ['suggested', 'Chờ duyệt'], ['approved', 'Đã duyệt'], ['new', 'Chưa có kết quả']]
            .map(([k, v]) => `<button class="filter ${filter === k ? 'active' : ''}" data-filter="${k}">${v}</button>`)
            .join('')}
      </div>
      <div class="student-list" id="studentList">${rows(visible)}</div>
      <div class="list-foot">◌ Danh sách mẫu · Có thể sửa ở Danh sách lớp</div>
    </div>`;
}

/** Render từng dòng học sinh trong danh sách */
function rows(items) {
  if (!items.length) return '<div class="empty">Không tìm thấy bài phù hợp.</div>';

  return items.map(s => `
    <button
      class="student ${selected === s.id ? 'selected' : ''}"
      data-student="${esc(s.id)}"
      aria-label="Mở bài ${esc(s.name || s.id)}">
      <span class="avatar">${esc(s.id.slice(-2))}</span>
      <span class="student-info">
        <strong>${esc(s.name || s.id)}</strong>
        <small>${esc(s.id)} · ${badge(s)}</small>
      </span>
      <span class="student-score">
        ${s.state === 'new'
          ? '—'
          : fmt(total(s.state === 'approved' ? s.teacherScores : s.scores))}
      </span>
    </button>`).join('');
}


// ============================================================
//  TRANG CHẤM BÀI
// ============================================================

function grading() {
  return (
    header(
      'Chấm bài, hiểu học trò.',
      'Thêm một góc nhìn để mỗi lời nhận xét đến gần hơn với học sinh.',
      `<button class="btn" data-action="export">↓ Xuất kết quả đã duyệt</button>
       <button class="btn primary" data-action="upload"><span class="plus">+</span>Nhận ảnh / PDF</button>`
    ) +
    notice() +
    stats() +
    `<div class="assignment">
       <div class="assignment-icon">▧</div>
       <div>
         <h2>Viết đoạn văn miêu tả một cây em yêu thích</h2>
         <p class="sub">Tiếng Việt · ${esc(classroom.label)} minh họa · 4 tiêu chí · Thang điểm 10</p>
       </div>
       <span class="tag">Dữ liệu &amp; kết quả AI mô phỏng</span>
     </div>
     <div class="layout">${list()}${detail()}</div>`
  );
}

/** Panel chi tiết học sinh được chọn */
function detail() {
  const s = current();
  return `
    <section class="card">
      <div class="detail-head">
        <span class="avatar peach">${esc(s.id.slice(-2))}</span>
        <div>
          <h2>${esc(s.name || s.id)}</h2>
          <small>${esc(s.id)} · ${s.attachments?.length || 0} tệp · ${s.custom ? 'Bài tải lên' : 'Bài mẫu minh họa'}</small>
        </div>
        ${badge(s)}
      </div>

      <!-- Tabs -->
      <div class="tabs">
        ${[['review', 'Bài làm & chữa bài'], ['insights', 'Góc nhìn học tập'], ['history', 'Lịch sử duyệt']]
            .map(([k, v]) => `<button class="tab ${tab === k ? 'active' : ''}" data-tab="${k}">${v}</button>`)
            .join('')}
      </div>

      <div class="detail-body">
        ${tab === 'history' ? history(s) : tab === 'insights' ? insights(s) : review(s)}
      </div>

      ${tab === 'review' ? `
        <div class="review-bottom">
          <p>◉ Kết quả cuối cùng do giáo viên xác nhận.</p>
          <div class="actions">
            ${s.state === 'approved'
              ? `<button class="btn" data-action="reopen">Mở lại để chỉnh sửa</button>`
              : `<button class="btn" data-action="edit">Chỉnh điểm &amp; nhận xét</button>
                 <button class="btn primary" data-action="approve">✓ Kiểm tra &amp; duyệt</button>`}
          </div>
        </div>` : ''}
    </section>`;
}


// ============================================================
//  PANEL XEM BÀI & CHỮA LỖI
// ============================================================

/** Bôi đỏ lỗi trong bản chữ */
function marked(s) {
  let text = esc(s.text);
  for (const e of s.errors || []) {
    if (e[0] !== 'Gợi ý diễn đạt') {
      text = text.replace(esc(e[1]), `<mark>${esc(e[1])}</mark>`);
    }
  }
  return text;
}

/** Toàn bộ tab "Bài làm & chữa bài" */
function review(s) {
  // ---- Phần trái: bản chữ & tệp gốc ----
  const leftCol = `
    <div>
      <div class="sectionlabel">
        Tệp bài làm gốc <span>${s.attachments?.length || 0} TỆP</span>
      </div>
      <div id="attachmentPreview"></div>
      <div class="paper ${!s.text ? 'no-transcript' : ''}">
        <div class="paper-title">${s.text ? 'BẢN CHỮ MINH HỌA' : 'CHỜ NHẬN DẠNG NỘI DUNG'}</div>
        ${s.text
          ? marked(s)
          : 'Chưa có bản chữ được nhận dạng. Hệ thống giữ nguyên tệp gốc để giáo viên kiểm tra.'}
      </div>
      <div class="paper-foot">
        <span><i></i> Nội dung cần xem xét</span>
        <span>${s.text
          ? s.text.trim().split(/\s+/).length + ' từ (tách theo khoảng trắng)'
          : 'AI chưa đọc tệp mới'}</span>
      </div>

      ${s.state === 'new'
        ? /* Chưa chấm */
          `<div class="notice warning">
             <div>${
               s.custom
                 ? (s.attachments?.length
                     ? 'Đã nhận tệp. Chưa kết nối AI để đọc chữ viết và chấm tự động. Giáo viên có thể chấm thủ công.'
                     : 'Học sinh chưa nộp bài. Tải ảnh/PDF từ trang Nhận bài & chấm AI.')
                 : 'Bài mẫu sẵn sàng để chạy quy trình phân tích mô phỏng.'
             }</div>
           </div>
           ${!s.custom ? '<button class="btn primary" data-action="analyze">✳ Phân tích bài mẫu</button>' : ''}`

        : /* Đã có gợi ý chữa */
          `<div class="correction-title">
             Gợi ý chữa bài <b>${(s.errors || []).length}</b>
           </div>
           ${(s.errors || []).length
             ? s.errors.map(e => `
                 <div class="correction">
                   <div class="kind">${esc(e[0])}</div>
                   <del>${esc(e[1])}</del><span> → </span><ins>${esc(e[2])}</ins>
                   <p>${esc(e[3])}</p>
                 </div>`).join('')
             : '<div class="correction"><p>Chưa ghi nhận lỗi rõ trong bản phân tích mẫu. Giáo viên vẫn cần đọc và kiểm tra toàn bộ bài.</p></div>'}`
      }
    </div>`;

  // ---- Phần phải: điểm & nhận xét ----
  const rightCol = `
    <div>
      <div class="sectionlabel">
        ${s.state === 'approved' ? 'Kết quả giáo viên đã duyệt' : 'Đề xuất từ AI'}
        <span>${s.state === 'approved' ? 'ĐÃ XÁC NHẬN' : 'MÔ PHỎNG'}</span>
      </div>
      ${s.state === 'new'
        ? `<div class="empty">
             <span style="font-size:35px">✳</span>
             <p>Chưa có đề xuất điểm</p>
             <small>${s.custom
               ? 'Chấm thủ công bằng nút bên dưới.'
               : 'Chọn "Phân tích bài mẫu" để xem đề xuất.'}</small>
           </div>`
        : scorePanel(s)}
      ${s.teacherScores && s.state !== 'approved'
        ? `<div class="approved-panel">
             Điểm giáo viên đang soạn: <strong>${fmt(total(s.teacherScores))}/10</strong> · Chưa duyệt
           </div>`
        : ''}
    </div>`;

  return `<div class="review-grid">${leftCol}${rightCol}</div>`;
}

/** Panel hiển thị điểm và rubric */
function scorePanel(s) {
  const a = s.state === 'approved' ? s.teacherScores : s.scores;

  const rubricRows = rubric.map((r, i) => `
    <div class="rubric-row">
      <div class="rubric-title">
        <span>${r.name}</span>
        <strong>
          ${fmt(a?.[i] || 0)}
          <span style="color:#9ba58f;font-weight:400"> /${r.max}</span>
        </strong>
      </div>
      <div class="track">
        <div class="fill" style="width:${(a?.[i] || 0) / r.max * 100}%"></div>
      </div>
      <div class="rubric-explain">${esc(s.explain?.[i] || 'Giáo viên chấm thủ công theo tiêu chí.')}</div>
    </div>`).join('');

  const warning = s.id === 'HS02' && s.state !== 'approved'
    ? `<div class="notice warning" style="margin:12px 0 0">
         <div>Cần xem lại: điểm chính tả 1,5/2 chưa có lỗi làm căn cứ. Đây là ví dụ để giáo viên phát hiện và chỉnh đề xuất AI.</div>
       </div>`
    : '';

  return `
    <div class="scorebox">
      <div class="score-num">${fmt(total(a))}<span> /10</span></div>
      <div>
        <strong>${s.state === 'approved' ? 'Giáo viên đã xác nhận' : 'Điểm đề xuất tham khảo'}</strong>
        <small>${s.state === 'approved'
          ? (s.custom
              ? 'Bài mới do giáo viên chấm thủ công.'
              : `AI mô phỏng đề xuất ban đầu: ${fmt(total(s.scores))}/10`)
          : 'Đọc bài và đối chiếu tiêu chí trước khi duyệt.'}</small>
      </div>
    </div>
    ${rubricRows}
    <div class="feedback">
      <strong>✳ ${s.state === 'approved' ? 'Lời nhận xét của giáo viên' : 'Lời nhận xét gợi ý'}</strong>
      <p>${esc(s.state === 'approved' ? s.teacherFeedback : s.feedback || '')}</p>
    </div>
    ${warning}`;
}


// ============================================================
//  TABS: GÓC NHÌN & LỊCH SỬ
// ============================================================

function insights(s) {
  if (s.state !== 'approved') {
    return `
      <div class="notice warning">
        <div>Góc nhìn AI đang chờ kiểm chứng. Chỉ kết quả đã duyệt mới được đưa vào hồ sơ học tập.</div>
      </div>
      ${s.state === 'new' ? '<div class="empty">Chưa có dữ liệu phân tích.</div>' : insightBody(s)}`;
  }
  return insightBody(s);
}

function insightBody(s) {
  return `
    <div class="box">
      <h3>Điểm mạnh thể hiện trong bài</h3>
      <p>${esc(s.strength || 'Giáo viên bổ sung từ quan sát thực tế.')}</p>
      <div class="evidence">Minh chứng: ${esc(s.evidence || 'Chưa có minh chứng được ghi nhận.')}</div>
    </div>
    <div class="box">
      <h3>Nội dung cần hỗ trợ</h3>
      <p>${esc(s.support || 'Giáo viên xác định sau khi đọc bài.')}</p>
    </div>
    <div class="box">
      <h3>Hoạt động tiếp theo được gợi ý</h3>
      <p>${esc(s.activity || 'Giáo viên lựa chọn hoạt động phù hợp.')}</p>
    </div>
    <p class="sub">
      Phạm vi: 01 bài viết minh họa. Chưa đủ dữ liệu kết luận năng lực tổng thể hoặc xu hướng tiến bộ.
      ${s.state === 'approved'
        ? 'Giáo viên đã xác nhận góc nhìn này.'
        : 'Đây là giả thuyết hỗ trợ giáo viên, chưa phải kết luận.'}
    </p>`;
}

function history(s) {
  const logs = s.logs || [];
  return `
    <div class="box">
      <h3>Đối chiếu đề xuất và quyết định</h3>
      <p>AI đề xuất: ${s.custom ? 'Chưa kết nối AI' : s.state === 'new' ? 'Chưa có' : `${fmt(total(s.scores))}/10`}</p>
      <p>Giáo viên: ${s.teacherScores ? `${fmt(total(s.teacherScores))}/10` : 'Chưa nhập điểm'}</p>
    </div>
    ${logs.length
      ? logs.map(l => `
          <div class="audit">
            <strong>${esc(l.action)}</strong>
            <small>${esc(l.time)} · Giáo viên demo</small>
            <p>${esc(l.detail)}</p>
          </div>`).join('')
      : `<div class="empty">${
          s.state === 'approved'
            ? 'Bản ghi duyệt có sẵn trong dữ liệu minh họa.'
            : 'Chưa có thao tác duyệt trong phiên demo.'
        }</div>`}`;
}


// ============================================================
//  TRANG HỒ SƠ HỌC TẬP
// ============================================================

function profiles() {
  const s = current();
  return (
    header(
      'Hiểu từng bước tiến.',
      'Hồ sơ ghi nhận biểu hiện học tập có minh chứng, sau khi giáo viên xác nhận.'
    ) +
    `<div class="notice">
       <span class="symbol">◉</span>
       <div>Chỉ tổng hợp bài đã duyệt. Một bài làm không đại diện cho toàn bộ năng lực của học sinh.</div>
     </div>
     <div class="layout">
       ${list()}
       <section class="card">
         <div class="detail-head">
           <span class="avatar peach">${esc(s.id.slice(-2))}</span>
           <div>
             <h2>Hồ sơ · ${esc(s.name || s.id)}</h2>
             <small>Tiếng Việt · ${esc(classroom.label)} minh họa</small>
           </div>
           ${badge(s)}
         </div>
         <div class="detail-body">
           ${s.state === 'approved'
             ? `<div class="scorebox">
                  <div class="score-num">${fmt(total(s.teacherScores))}<span> /10</span></div>
                  <div>
                    <strong>01 bài đã được xác nhận</strong>
                    <small>Chưa đủ dữ liệu để xác định xu hướng tiến bộ.</small>
                  </div>
                </div>
                ${insightBody(s)}`
             : `<div class="empty">
                  <span style="font-size:30px">◌</span>
                  <p>Chưa có bài đã duyệt cho học sinh này.</p>
                  <button class="btn primary" data-action="goGrade">Xem bài &amp; duyệt kết quả</button>
                </div>`}
         </div>
       </section>
     </div>`
  );
}


// ============================================================
//  TRANG TỔNG QUAN
// ============================================================

function overview() {
  const approved = students.filter(s => s.state === 'approved');

  return (
    header(
      'Mỗi bài làm, một cơ hội hiểu thêm.',
      'Không gian hỗ trợ giáo viên đọc bài, phản hồi và lựa chọn hoạt động tiếp theo.',
      `<button class="btn primary" data-action="goGrade">Bắt đầu chấm bài →</button>`
    ) +
    notice() +
    stats() +
    `<div class="steps">
       <div class="step">
         <b>01 · ĐỌC &amp; ĐỐI CHIẾU</b>
         <strong>Bài làm và tiêu chí rõ ràng</strong>
         <p>Giữ nguyên bài gốc để thầy cô kiểm tra từng nhận xét.</p>
       </div>
       <div class="step">
         <b>02 · AI ĐỀ XUẤT</b>
         <strong>Điểm, cách chữa và minh chứng</strong>
         <p>Nhận xét về biểu hiện trong bài, không gắn nhãn học sinh.</p>
       </div>
       <div class="step">
         <b>03 · GIÁO VIÊN DUYỆT</b>
         <strong>Quyết định có sự cân nhắc</strong>
         <p>Chỉnh điểm, nhận xét và góc nhìn học tập trước khi xác nhận.</p>
       </div>
     </div>
     <div class="overview-grid">

       <!-- Bảng bài làm gần đây -->
       <section class="card">
         <div class="card-head">
           <h2>Bài làm gần đây</h2>
           <span class="tag">Mẫu minh họa</span>
         </div>
         <table class="data-table">
           <thead>
             <tr><th>Học sinh</th><th>Trạng thái</th><th>Điểm</th><th></th></tr>
           </thead>
           <tbody>
             ${students.map(s => `
               <tr>
                 <td>${esc(s.name || s.id)}<small>${esc(s.id)}</small></td>
                 <td>${badge(s)}</td>
                 <td>${s.state === 'new' ? '—' : fmt(total(s.state === 'approved' ? s.teacherScores : s.scores))}</td>
                 <td><button data-open="${esc(s.id)}">Xem bài</button></td>
               </tr>`).join('')}
           </tbody>
         </table>
       </section>

       <!-- Góc nhìn lớp học -->
       <section class="card">
         <div class="card-head">
           <h2>Góc nhìn lớp học</h2>
           <span class="count">${approved.length} bài đã duyệt</span>
         </div>
         <div class="detail-body">
           <p class="sub">Điểm trung bình theo tiêu chí, chỉ tính bài đã duyệt. Không dùng để xếp hạng học sinh.</p>
           ${rubric.map((r, i) => {
             const avg = approved.length
               ? approved.reduce((sum, s) => sum + s.teacherScores[i], 0) / approved.length
               : 0;
             return `
               <div class="barrow">
                 <span>${r.name}</span>
                 <div class="track">
                   <div class="fill" style="width:${avg / r.max * 100}%"></div>
                 </div>
                 <strong>${approved.length ? fmt(avg) : '—'}/${r.max}</strong>
               </div>`;
           }).join('')}
           <div class="feedback">
             <strong>Gợi ý cho tiết học tiếp theo</strong>
             <p>${approved.length
               ? 'Giáo viên xem lại các minh chứng trong từng bài đã duyệt để chọn nội dung cần luyện tập. Dữ liệu mẫu hiện chưa đủ để suy rộng cho cả lớp.'
               : 'Duyệt bài làm để bắt đầu tổng hợp minh chứng.'}</p>
           </div>
         </div>
       </section>
     </div>`
  );
}


// ============================================================
//  TRANG TIÊU CHÍ ĐÁNH GIÁ
// ============================================================

function rubricPage() {
  return (
    header(
      'Chấm có căn cứ. Chữa có mục tiêu.',
      'Bộ tiêu chí minh họa dành cho đoạn văn miêu tả cây · Lớp 4.'
    ) +
    `<div class="notice">
       <span class="symbol">☷</span>
       <div>Bộ tiêu chí demo do giáo viên giả lập lựa chọn, không phải thang chấm chính thức của nhà trường. Tổng điểm tối đa: 10.</div>
     </div>
     <section class="card">
       <div class="card-head">
         <h2>Đoạn văn miêu tả một cây em yêu thích</h2>
         <span class="tag">4 tiêu chí cố định trong demo</span>
       </div>
       ${rubric.map(r => `
         <div class="rule-line">
           <strong>${r.name}</strong>
           <p>${r.desc}</p>
           <b>${r.max}<small>điểm tối đa</small></b>
         </div>`).join('')}
     </section>
     <div class="box" style="margin-top:20px">
       <h3>Nguyên tắc sử dụng</h3>
       <p>Điểm AI là đề xuất. Giáo viên đối chiếu bài làm với từng tiêu chí, sửa nhận xét và xác nhận minh chứng trước khi duyệt. Không suy đoán tính cách, hoàn cảnh hay năng lực cố định từ bài viết.</p>
       <p>Để tránh thay đổi thang chấm giữa các bài, phiên bản demo giữ cố định các tiêu chí và mức điểm tối đa.</p>
     </div>`
  );
}


// ============================================================
//  GHI LOG
// ============================================================

function log(s, action, detail) {
  (s.logs ??= []).unshift({
    action,
    detail,
    time: new Date().toLocaleString('vi-VN'),
  });
}


// ============================================================
//  MODAL CHỈNH ĐIỂM / DUYỆT BÀI
// ============================================================

function editModal(approve = false) {
  const s = current();
  const a = s.teacherScores || s.scores || [0, 0, 0, 0];

  modal(
    approve ? 'Kiểm tra trước khi duyệt' : 'Chỉnh điểm & nhận xét',
    `<form id="editForm">
       <p class="sub">${esc(s.name || s.id)} (${esc(s.id)}) · Bài viết miêu tả cây · Giáo viên chịu trách nhiệm với kết quả cuối cùng.</p>
       <div class="score-inputs">
         ${rubric.map((r, i) => `
           <label class="field field-inline">
             ${r.name} (tối đa ${r.max})
             <input aria-label="Điểm ${r.name}" type="number" name="score${i}"
                    value="${a[i]}" min="0" max="${r.max}" step="0.25" required>
           </label>`).join('')}
       </div>
       <label class="field">Nhận xét của giáo viên
         <textarea name="feedback" required maxlength="2000">${esc(s.teacherFeedback || s.feedback || '')}</textarea>
       </label>
       <label class="field">Điểm mạnh thể hiện trong bài
         <textarea name="strength" maxlength="1000">${esc(s.strength || '')}</textarea>
       </label>
       <label class="field">Dẫn chứng từ bài làm
         <textarea name="evidence" maxlength="1000">${esc(s.evidence || '')}</textarea>
       </label>
       <label class="field">Nội dung cần hỗ trợ
         <input name="support" value="${esc(s.support || '')}" maxlength="1000">
       </label>
       <label class="field">Hoạt động tiếp theo
         <input name="activity" value="${esc(s.activity || '')}" maxlength="1000">
       </label>
       <label class="field">Lý do điều chỉnh / ghi chú
         <input name="reason" value="${esc(s.reason || '')}" maxlength="1000"
                placeholder="Ví dụ: Không có lỗi chính tả nên điều chỉnh điểm…">
       </label>
       ${approve
         ? `<label class="review-check">
              <input type="checkbox" required>
              Tôi đã đọc bài, kiểm tra điểm, nhận xét và minh chứng học tập trước khi xác nhận.
            </label>`
         : ''}
       <div class="modal-actions">
         <button type="button" class="btn" data-action="close">Hủy</button>
         <button class="btn primary" type="submit">${approve ? 'Xác nhận & duyệt' : 'Lưu bản chỉnh sửa'}</button>
       </div>
     </form>`
  );

  $('#editForm').onsubmit = e => {
    e.preventDefault();
    const f      = new FormData(e.target);
    const scores = rubric.map((r, i) => Number(f.get('score' + i)));

    // Kiểm tra giới hạn điểm
    if (scores.some((x, i) => !Number.isFinite(x) || x < 0 || x > rubric[i].max)) {
      toast('Điểm phải nằm trong giới hạn mỗi tiêu chí.');
      return;
    }

    const old         = s.teacherScores ? total(s.teacherScores) : null;
    s.teacherScores   = scores;
    for (const k of ['strength', 'evidence', 'support', 'activity', 'reason']) {
      s[k] = String(f.get(k) || '').trim();
    }
    s.teacherFeedback = String(f.get('feedback')).trim();

    if (!s.teacherFeedback) {
      toast('Vui lòng nhập nhận xét của giáo viên.');
      return;
    }

    if (approve) {
      s.state = 'approved';
      log(s, 'Giáo viên duyệt kết quả',
        `Điểm xác nhận ${fmt(total(scores))}/10. ${s.reason || 'Đã đối chiếu bài làm và tiêu chí.'}`);
    } else {
      log(s, 'Lưu bản chỉnh sửa',
        `Điểm đang soạn ${fmt(total(scores))}/10${old !== null ? ` (trước đó ${fmt(old)})` : ''}. Chưa xác nhận.`);
    }

    save();
    $('#modal').close();
    render();
    toast(approve
      ? 'Đã duyệt. Kết quả được cập nhật vào hồ sơ học tập.'
      : 'Đã lưu bản chỉnh sửa. Kết quả vẫn cần được duyệt.');
  };
}


// ============================================================
//  MODAL THÊM BÀI LÀM MỚI
// ============================================================

function addModal() {
  modal('Thêm bài làm', `
    <form id="addForm">
      <p class="formnote">Nhập một bài viết minh họa. Bản demo chưa kết nối AI cho bài mới; giáo viên có thể chấm và duyệt thủ công. Không nhập thông tin cá nhân của học sinh.</p>
      <label class="field">Mã học sinh giả lập
        <input name="id" required maxlength="24" pattern="[A-Za-z0-9_-]+" placeholder="VD: HS07" aria-label="Mã học sinh giả lập">
      </label>
      <label class="field">Nội dung bài viết
        <textarea id="newText" name="text" required maxlength="10000"
                  placeholder="Dán bài viết miêu tả cây tại đây…" style="min-height:170px"></textarea>
      </label>
      <label class="btn file-label">
        ↑ Đọc tệp văn bản .txt
        <input type="file" accept=".txt,text/plain" id="txtFile">
      </label>
      <p class="formnote">Tệp được đọc trên trình duyệt, không gửi lên máy chủ. Chưa hỗ trợ nhận dạng ảnh/PDF.</p>
      <div class="modal-actions">
        <button type="button" class="btn" data-action="close">Hủy</button>
        <button class="btn primary">Thêm bài làm</button>
      </div>
    </form>`
  );

  // Đọc file .txt
  $('#txtFile').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 100000) { toast('Vui lòng chọn tệp văn bản dưới 100 KB.'); return; }
    $('#newText').value = (await f.text()).slice(0, 10000);
  };

  // Submit form thêm bài
  $('#addForm').onsubmit = e => {
    e.preventDefault();
    const f    = new FormData(e.target);
    const id   = String(f.get('id')).trim().toUpperCase();
    const text = String(f.get('text')).trim();

    if (!text)                           { toast('Vui lòng nhập nội dung bài viết.'); return; }
    if (students.some(s => s.id === id)) { toast('Mã này đã có bài. Vui lòng chọn mã khác.'); return; }

    students.push({ id, text, state: 'new', custom: true, logs: [] });
    selected = id; filter = 'all'; query = ''; tab = 'review'; page = 'grading';
    save();
    $('#modal').close();
    render();
    toast('Đã thêm bài. Giáo viên có thể chấm thủ công.');
  };
}


// ============================================================
//  XUẤT KẾT QUẢ CSV
// ============================================================

function exportCSV() {
  const items = students.filter(s => s.state === 'approved');
  if (!items.length) { toast('Chưa có kết quả đã duyệt để xuất.'); return; }

  // Escape cell CSV
  const cell = v => {
    let x = String(v ?? '');
    if (/^[=+@\-\t\r]/.test(x)) x = "'" + x;
    return '"' + x.replace(/"/g, '""') + '"';
  };

  const lines = [
    ['Lớp', 'Mã học sinh', 'Họ và tên', 'Nội dung /4', 'Sắp xếp ý /2', 'Diễn đạt /2', 'Chính tả /2',
     'Điểm GV /10', 'Nhận xét GV', 'Điểm mạnh', 'Minh chứng', 'Cần hỗ trợ', 'Hoạt động tiếp theo', 'Loại dữ liệu'],
    ...items.map(s => [
      classroom.label, s.id, s.name,
      ...s.teacherScores,
      total(s.teacherScores),
      s.teacherFeedback, s.strength, s.evidence, s.support, s.activity,
      'Demo minh họa; không phải hồ sơ học sinh thật',
    ]),
  ];

  const blob = new Blob(
    ['\ufeff' + lines.map(r => r.map(cell).join(',')).join('\r\n')],
    { type: 'text/csv;charset=utf-8;' }
  );
  const a      = document.createElement('a');
  a.href       = URL.createObjectURL(blob);
  a.download   = 'Thanh_Lan_Ket_qua_da_duyet_Demo.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`Đã xuất ${items.length} bài được giáo viên duyệt.`);
}


// ============================================================
//  MODAL GIỚI THIỆU / ABOUT (từ nút sidebar cũ)
// ============================================================

function aboutLegacy() {
  modal('Một trợ lý, không thay thế thầy cô.', `
    <div class="box">
      <h3>Bản demo hiện làm được gì?</h3>
      <p>Trình diễn chấm theo 4 tiêu chí, chữa lỗi trên bài mẫu, chỉnh điểm, duyệt có xác nhận, xem hồ sơ học tập và xuất kết quả CSV. Có thể nhập văn bản mới để giáo viên chấm thủ công.</p>
    </div>
    <div class="box">
      <h3>Phần AI đang được mô phỏng</h3>
      <p>Đề xuất cho 6 bài mẫu đã được biên soạn sẵn. Chưa gọi mô hình AI, chưa nhận dạng chữ viết tay và chưa tự phân tích bài nhập mới. Có một đề xuất điểm chưa hợp lý ở HS02 để trình diễn vai trò kiểm tra của giáo viên.</p>
    </div>
    <div class="box">
      <h3>Lưu trữ &amp; phạm vi nhận xét</h3>
      <p>Dữ liệu chỉ được lưu trong trình duyệt này khi lưu cục bộ khả dụng, chưa có tài khoản giáo viên hay cơ sở dữ liệu dùng chung. Nhận xét chỉ phản ánh bài làm có minh chứng; không chẩn đoán hoặc gắn nhãn năng lực học sinh.</p>
    </div>
    <button class="btn" data-action="reset">Khôi phục dữ liệu mẫu</button>
    <button class="btn primary" data-action="close" style="float:right">Đã hiểu</button>`
  );
}


// ============================================================
//  XỬ LÝ SỰ KIỆN CLICK
// ============================================================

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;

  // --- Navigation ---
  if (b.dataset.page)    { page = b.dataset.page; render(); return; }
  if (b.dataset.student) { selected = b.dataset.student; tab = 'review'; render(); return; }
  if (b.dataset.open)    { selected = b.dataset.open; page = 'grading'; tab = 'review'; render(); return; }
  if (b.dataset.tab)     { tab = b.dataset.tab; render(); return; }
  if (b.dataset.filter)  { filter = b.dataset.filter; render(); return; }

  // --- Actions ---
  switch (b.dataset.action) {

    case 'close':
      $('#modal').close();
      break;

    case 'add':
      addModal();
      break;

    case 'edit':
      if (!current().attachments?.length) {
        toast('Vui lòng nhận tệp bài làm trước khi chấm.');
        break;
      }
      editModal(false);
      break;

    case 'approve':
      if (!current().attachments?.length) {
        toast('Chưa có tệp bài làm để duyệt.');
        break;
      }
      editModal(true);
      break;

    case 'export':
      exportCSV();
      break;

    case 'goGrade':
      page = 'grading'; tab = 'review'; render();
      break;

    case 'analyze': {
      const s = current();
      if (s.custom) return;
      b.disabled    = true;
      b.textContent = 'Đang mở phân tích mô phỏng…';
      setTimeout(() => {
        s.state = 'suggested';
        log(s, 'Mở phân tích AI mô phỏng', 'Kết quả biên soạn sẵn cho bài mẫu; chưa gọi mô hình AI.');
        save(); render();
        toast('Đã có đề xuất mô phỏng. Giáo viên cần kiểm tra trước khi duyệt.');
      }, 650);
      break;
    }

    case 'reopen': {
      const s = current();
      s.state = s.custom ? 'new' : 'suggested';
      log(s, 'Mở lại kết quả', 'Đã rút kết quả khỏi hồ sơ đã duyệt để giáo viên kiểm tra lại.');
      save(); render();
      toast('Đã mở lại bài. Cần duyệt lại để đưa vào hồ sơ.');
      break;
    }

    case 'reset':
      modal('Khôi phục dữ liệu mẫu?', `
        <p class="formnote">Thao tác này sẽ thay danh sách lớp, các thay đổi và bài đã nhập trong demo bằng dữ liệu mẫu ban đầu. Bạn có thể xuất kết quả đã duyệt trước khi thực hiện.</p>
        <div class="modal-actions">
          <button class="btn" data-action="close">Giữ dữ liệu hiện tại</button>
          <button class="btn primary" data-action="confirmReset">Khôi phục mẫu</button>
        </div>`);
      break;

    case 'confirmReset':
      data      = initialData();
      classroom = data.classes[0];
      students  = classroom.students;
      selected  = 'HS01'; page = 'intake'; tab = 'review'; query = ''; filter = 'all';
      save();
      $('#modal').close();
      render();
      toast('Đã khôi phục bộ dữ liệu minh họa.');
      break;
  }
});


// ============================================================
//  XỬ LÝ THANH TÌM KIẾM
// ============================================================

document.addEventListener('input', e => {
  if (e.target.id !== 'search') return;
  query = e.target.value;
  const items = students.filter(s =>
    (filter === 'all' || s.state === filter) &&
    normalize(s.name + ' ' + s.id).includes(normalize(query))
  );
  $('#studentList').innerHTML = rows(items);
});


// ============================================================
//  KHỞI CHẠY
// ============================================================

$('#about').onclick = about;
$('#help').onclick  = about;
