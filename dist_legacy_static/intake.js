// ============================================================
//  intake.js — Chức năng nhận bài & quản lý lớp
//  Trợ lý Chấm Chữa Bài · Thanh Lân
// ============================================================


// ============================================================
//  STATE CỦA TRANG NHẬN BÀI
// ============================================================

let uploadQueue = [];   // Danh sách tệp đang chờ tiếp nhận
let busy        = false; // Đang xử lý tệp → lock UI
let previewPage = 0;     // Tệp đang xem trước (index)

const urls = new Map(); // Cache URL blob tránh tạo lại nhiều lần


// ============================================================
//  TIỆN ÍCH CHUỖI
// ============================================================

/**
 * Chuẩn hóa chuỗi: bỏ dấu, thường hóa, bỏ ký tự đặc biệt.
 * Dùng để so khớp tên tệp với tên học sinh.
 */
function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}


// ============================================================
//  GHÉP TÊN TỆP VỚI HỌC SINH
// ============================================================

/**
 * Tự động ghép tên tệp với mã học sinh trong danh sách.
 * @param {string} filename  - Tên tệp (kể cả đuôi)
 * @param {Array}  roster    - Danh sách học sinh (mặc định: students)
 * @returns {{ id: string, reason: string }}
 */
function matchFilename(filename, roster = students) {
  const stem = filename.replace(/\.[^.]+$/, '');
  let base   = normalize(stem);

  // Khớp chính xác tên / mã
  const candidates = roster.filter(s =>
    [normalize(s.name), normalize(s.id), normalize(s.id + ' ' + s.name)].includes(base)
  );
  if (candidates.length === 1) return { id: candidates[0].id, reason: 'Khớp tên tệp' };
  if (candidates.length > 1)  return { id: '',                reason: 'Trùng tên · cần chọn mã HS' };

  // Thử bỏ hậu tố "_trang1", "_page2", ...
  base         = normalize(stem.replace(/(?:[_\s-]+)(?:trang|page)\s*\d+$/i, ''));
  const pages  = roster.filter(s =>
    [normalize(s.name), normalize(s.id + ' ' + s.name)].includes(base)
  );
  return pages.length === 1
    ? { id: pages[0].id, reason: 'Khớp tên + số trang' }
    : { id: '',          reason: pages.length > 1 ? 'Trùng tên · cần chọn mã HS' : 'Chưa khớp danh sách lớp' };
}


// ============================================================
//  PHÁT HIỆN ĐỊNH DẠNG TỆP (magic bytes)
// ============================================================

/**
 * Đọc magic bytes để xác định loại tệp thực sự.
 * @param {ArrayBuffer} buffer
 * @returns {'image/png'|'image/jpeg'|'application/pdf'|null}
 */
function fileKind(buffer) {
  const a = new Uint8Array(buffer);

  // PNG: 8 bytes đặc trưng
  if (a[0] === 0x89 && a[1] === 0x50 && a[2] === 0x4e && a[3] === 0x47 &&
      a[4] === 0x0d && a[5] === 0x0a && a[6] === 0x1a && a[7] === 0x0a)
    return 'image/png';

  // JPEG: bắt đầu bằng FF D8 FF
  if (a[0] === 0xff && a[1] === 0xd8 && a[2] === 0xff)
    return 'image/jpeg';

  // PDF: bắt đầu bằng '%PDF-'
  if (String.fromCharCode(...a.slice(0, 5)) === '%PDF-')
    return 'application/pdf';

  return null;
}


// ============================================================
//  INDEXEDDB — LƯU TỆP TRÊN TRÌNH DUYỆT
// ============================================================

/** Mở (hoặc tạo) IndexedDB để lưu tệp đính kèm */
function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('Trình duyệt không hỗ trợ lưu tệp.'));
      return;
    }
    const r = indexedDB.open('thanh-lan-attachments', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'key' });
    r.onsuccess = () => resolve(r.result);
    r.onerror   = () => reject(new Error('Không thể mở nơi lưu tệp trên trình duyệt.'));
  });
}

/**
 * Thao tác CRUD với IndexedDB.
 * @param {'get'|'put'|'delete'} mode
 * @param {string} key
 * @param {object} [record]  - Chỉ cần khi mode = 'put'
 */
async function fileDB(mode, key, record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', mode === 'get' ? 'readonly' : 'readwrite');
    const st = tx.objectStore('files');
    let result;

    const r = mode === 'get'    ? st.get(key)    :
              mode === 'put'    ? st.put(record)  :
                                  st.delete(key);
    r.onsuccess        = () => result = r.result;
    r.onerror          = () => reject(r.error);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Lấy URL blob của một tệp đính kèm.
 * Với bài mẫu: dùng sampleUrl trực tiếp.
 */
async function attachmentURL(a) {
  if (a.sampleUrl)    return a.sampleUrl;
  if (urls.has(a.key)) return urls.get(a.key);

  const record = await fileDB('get', a.key);
  if (!record) throw new Error('Tệp không còn trên trình duyệt này. Vui lòng tải lại.');

  const url = URL.createObjectURL(record.blob);
  urls.set(a.key, url);
  return url;
}


// ============================================================
//  DROPDOWN CHỌN LỚP
// ============================================================

function renderClassPicker() {
  const pick = $('#classPicker');
  pick.innerHTML = data.classes
    .map(c => `<option value="${esc(c.id)}" ${c.id === classroom.id ? 'selected' : ''}>${esc(c.label)}</option>`)
    .join('');
  pick.disabled  = busy;

  pick.onchange = () => {
    if (busy) return;
    classroom   = data.classes.find(c => c.id === pick.value);
    students    = classroom.students;
    selected    = students[0]?.id || '';
    uploadQueue = [];
    filter      = 'all';
    query       = '';
    previewPage = 0;
    save();
    render();
  };
}


// ============================================================
//  TRANG NHẬN BÀI (intake)
// ============================================================

function intake() {
  const pending = uploadQueue.filter(q => !q.studentId).length;

  return (
    header(
      'Nhận bài nhanh. Chấm có kiểm soát.',
      'Chụp bài làm, đặt tên tệp theo học sinh và tải lên lớp đã có danh sách.',
      `<button class="btn" data-action="roster">☷ Danh sách lớp</button>
       <button class="btn primary" data-action="upload">↑ Tải bài làm</button>`
    ) +
    `<!-- Các bước -->
     <div class="intake-steps">
       <div><b>01</b><span>Chọn lớp<small>Danh sách học sinh có sẵn</small></span></div>
       <span class="step-arrow">→</span>
       <div><b>02</b><span>Tải ảnh / PDF<small>Đặt tên tệp theo tên học sinh</small></span></div>
       <span class="step-arrow">→</span>
       <div><b>03</b><span>AI đề xuất điểm<small>Giáo viên kiểm tra &amp; duyệt</small></span></div>
     </div>

     <div class="intake-layout">

       <!-- ===== Khu vực upload ===== -->
       <section class="card">
         <div class="card-head">
           <div>
             <h2>Tiếp nhận bài · ${esc(classroom.label)}</h2>
             <p class="sub">${students.length} học sinh · Tiếng Việt · Đoạn văn miêu tả cây</p>
           </div>
           <span class="tag">PDF · PNG · JPEG</span>
         </div>

         <div class="intake-pad">
           <!-- Dropzone -->
           <label class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Chọn ảnh hoặc PDF bài làm">
             <input type="file" id="batchFiles"
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    multiple hidden>
             <span class="upload-symbol">⇧</span>
             <strong>Kéo thả bài làm vào đây</strong>
             <span>hoặc nhấn để chọn nhiều tệp cùng lúc</span>
             <small>PDF, PNG, JPG/JPEG · Tối đa 15 MB/tệp, 20 tệp/lượt, 100 MB/lượt</small>
           </label>

           <!-- Hướng dẫn đặt tên tệp -->
           <div class="filename-guide">
             <strong>Đặt tên để hệ thống ghép đúng học sinh</strong>
             <p><code>Nguyễn Minh An.jpg</code> hoặc <code>HS01_Nguyễn Minh An.pdf</code></p>
             <p>Nhiều ảnh: <code>Nguyễn Minh An_trang1.png</code>, <code>Nguyễn Minh An_trang2.png</code>.
                Mỗi PDF chỉ chứa bài của một học sinh; có thể gồm nhiều trang.</p>
           </div>

           <!-- Danh sách tệp chờ -->
           <div class="queue-head">
             <h3>Tệp chờ tiếp nhận <span class="tag">${uploadQueue.length}</span></h3>
             ${uploadQueue.length ? '<button class="textbtn" data-action="clearQueue">Bỏ danh sách chờ</button>' : ''}
           </div>

           ${uploadQueue.length
             ? `<div class="queue-scroll">
                  <table class="data-table queue-table">
                    <thead>
                      <tr><th>Tệp bài làm</th><th>Học sinh được ghép</th><th></th></tr>
                    </thead>
                    <tbody>
                      ${uploadQueue.map((q, i) => `
                        <tr>
                          <td>
                            <span class="filetype ${q.file.type === 'application/pdf' ? 'pdf' : ''}">
                              ${q.file.type === 'application/pdf' ? 'PDF'
                              : q.file.type === 'image/png' ? 'PNG' : 'JPEG'}
                            </span>
                            <strong>${esc(q.file.name)}</strong>
                            <small>${fmt(q.file.size / 1024)} KB · ${esc(q.reason)}${q.sampleId ? ' · Kết quả mẫu mô phỏng' : ''}</small>
                          </td>
                          <td>
                            <select aria-label="Ghép học sinh cho ${esc(q.file.name)}"
                                    class="queue-match" data-queue="${i}">
                              <option value="">— Chọn học sinh —</option>
                              ${students.map(s =>
                                `<option value="${esc(s.id)}" ${q.studentId === s.id ? 'selected' : ''}>
                                   ${esc(s.name)} (${esc(s.id)})
                                 </option>`
                              ).join('')}
                            </select>
                          </td>
                          <td>
                            <button class="remove-file" data-remove-file="${i}"
                                    aria-label="Bỏ tệp ${esc(q.file.name)}">×</button>
                          </td>
                        </tr>`).join('')}
                    </tbody>
                  </table>
                </div>

                <div class="queue-options">
                  <label>
                    <input id="autoGrade" type="checkbox" checked>
                    Tự động chấm sau khi nhận bài
                  </label>
                  <small>Bài mẫu: chạy kết quả mô phỏng. Bài mới: chờ kết nối AI thật.</small>
                  <label>
                    <input id="replaceExisting" type="checkbox">
                    Cho phép thay bài đã có của học sinh được chọn
                  </label>
                </div>

                ${pending
                  ? `<div class="notice warning" style="margin:12px 0">
                       <div>${pending} tệp chưa ghép được. Vui lòng chọn học sinh trước khi tiếp nhận.</div>
                     </div>`
                  : ''}

                <button class="btn primary import-button" data-action="receive"
                        ${pending || busy ? 'disabled' : ''}>
                  ${busy ? 'Đang nhận tệp…' : 'Nhận bài & bắt đầu chấm'} →
                </button>`

             : '<div class="queue-empty">Chưa có tệp trong danh sách chờ. Tải bài lên hoặc thử bộ bài mẫu bên cạnh.</div>'}
         </div>
       </section>

       <!-- ===== Sidebar phải ===== -->
       <aside class="intake-aside">

         <!-- Trạng thái lớp -->
         <div class="card">
           <div class="card-head">
             <h3>Trạng thái lớp</h3>
             <span class="tag">${esc(classroom.label)}</span>
           </div>
           <div class="class-stats">
             <div><span>Học sinh</span><strong>${students.length}</strong></div>
             <div><span>Đã có tệp bài</span><strong>${students.filter(s => s.attachments?.length).length}</strong></div>
             <div><span>Chờ GV duyệt</span><strong>${students.filter(s => s.state === 'suggested').length}</strong></div>
             <div><span>Đã duyệt</span><strong>${students.filter(s => s.state === 'approved').length}</strong></div>
           </div>
           <button class="btn" data-action="goGrade" style="margin:0 18px 18px;width:calc(100% - 36px)">
             Mở danh sách chấm →
           </button>
         </div>

         <!-- Bộ bài mẫu -->
         <div class="sample-box">
           <span class="eyebrow">THỬ TOÀN BỘ QUY TRÌNH</span>
           <h3>Từ tệp bài đến lời nhận xét</h3>
           <p>Bộ 6 bài mẫu có ảnh PNG, JPEG và PDF, đặt đúng tên học sinh lớp 4A. Điểm và nhận xét được mô phỏng sẵn.</p>
           <button class="btn" data-action="samples" ${busy ? 'disabled' : ''}>Nạp bộ bài mẫu lớp 4A ↗</button>
         </div>

         <!-- Trạng thái kết nối AI -->
         <div class="connection-box">
           <i></i>
           <strong>AI đọc bài mới: chưa kết nối</strong>
           <p>Tệp thật được nhận và xem ngay trên trình duyệt. Đọc chữ viết tay, trích nội dung PDF và chấm bài mới cần kết nối dịch vụ AI.</p>
         </div>

         <p class="privacy-note">Tệp tải lên và danh sách tự nhập được lưu trên trình duyệt của người đang dùng, không đưa lên trang công khai và không chia sẻ cho người xem khác.</p>
       </aside>

     </div>`
  );
}


// ============================================================
//  MOUNT DROPZONE & QUEUE SELECTS
// ============================================================

function mountIntake() {
  const inp  = $('#batchFiles');
  const zone = $('#dropzone');
  if (!inp || !zone) return;

  // Chọn file qua input
  inp.onchange = e => addFiles(Array.from(e.target.files));

  // Kích hoạt dropzone bằng bàn phím
  zone.onkeydown = e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); }
  };

  // Kéo thả
  zone.ondragover  = e => { e.preventDefault(); zone.classList.add('dragging'); };
  zone.ondragleave = ()  => zone.classList.remove('dragging');
  zone.ondrop      = e => {
    e.preventDefault();
    zone.classList.remove('dragging');
    addFiles(Array.from(e.dataTransfer.files));
  };

  // Cập nhật mã HS khi chọn dropdown
  document.querySelectorAll('.queue-match').forEach(sel => {
    sel.onchange = () => {
      const q      = uploadQueue[Number(sel.dataset.queue)];
      q.studentId  = sel.value;
      q.reason     = sel.value ? 'Giáo viên chọn thủ công' : 'Chưa chọn học sinh';
      render();
    };
  });
}


// ============================================================
//  THÊM TỆP VÀO HÀNG CHỜ
// ============================================================

async function addFiles(files, sampleIds = []) {
  if (busy) return;
  const cid      = classroom.id;
  const maxCount = 20 - uploadQueue.length;

  if (files.length > maxCount) {
    toast(`Mỗi lượt tối đa 20 tệp. Còn ${maxCount} vị trí; vui lòng chọn lại.`);
    return;
  }

  const totalSize = files.reduce((n, f) => n + f.size, 0)
                  + uploadQueue.reduce((n, q) => n + q.file.size, 0);
  if (totalSize > 100 * 1024 * 1024) {
    toast('Tổng dung lượng mỗi lượt tối đa 100 MB.');
    return;
  }

  const errors = [];
  busy = true;
  renderClassPicker();

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Kiểm tra dung lượng
      if (!file.size || file.size > 15 * 1024 * 1024) {
        errors.push(file.name + ': tệp rỗng hoặc quá 15 MB');
        continue;
      }

      // Kiểm tra đuôi tệp
      if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) {
        errors.push(file.name + ': chỉ nhận PDF, PNG, JPG/JPEG');
        continue;
      }

      // Kiểm tra magic bytes
      const type = fileKind(await file.slice(0, 12).arrayBuffer());
      if (!type) {
        errors.push(file.name + ': nội dung không đúng định dạng');
        continue;
      }

      // Kiểm tra trùng
      if (uploadQueue.some(q => q.file.name === file.name && q.file.size === file.size)) {
        errors.push(file.name + ': đã có trong danh sách');
        continue;
      }

      const safeFile = new File([file], file.name, { type, lastModified: file.lastModified });
      const match    = matchFilename(file.name);
      uploadQueue.push({
        file:      safeFile,
        studentId: match.id,
        reason:    match.reason,
        sampleId:  sampleIds[i] || null,
      });
    }
  } catch (e) {
    errors.push('Không đọc được tệp: ' + e.message);
  } finally {
    busy = false;
  }

  // Đã đổi lớp trong khi xử lý → hủy
  if (cid !== classroom.id) { uploadQueue = []; return; }

  render();

  if (errors.length) {
    modal('Một số tệp chưa được nhận',
      `<div class="box"><p>${errors.map(esc).join('<br>')}</p></div>
       <button class="btn primary" data-action="close">Đã hiểu</button>`);
  } else {
    toast(`Đã kiểm tra ${files.length} tệp. Hãy kiểm tra tên học sinh trước khi nhận bài.`);
  }
}


// ============================================================
//  NẠP BỘ BÀI MẪU
// ============================================================

async function loadSamples() {
  if (busy) return;

  // Chuyển sang lớp 4A nếu đang ở lớp khác
  if (classroom.id !== '4A') {
    classroom   = data.classes.find(c => c.id === '4A');
    students    = classroom.students;
    selected    = students[0]?.id || '';
    uploadQueue = [];
    save();
  }

  busy = true;
  render();

  try {
    const files = [];
    for (let i = 0; i < seeds.length; i++) {
      const ext = sampleTypes[i];
      const r   = await fetch('samples/' + seeds[i].id + '.' + ext);
      if (!r.ok) throw new Error('Không tải được tệp mẫu.');
      files.push(new File(
        [await r.blob()],
        sampleNames[i] + '.' + ext,
        { type: ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg' }
      ));
    }
    busy        = false;
    uploadQueue = [];
    await addFiles(files, seeds.map(s => s.id));
    toast('Đã nạp bộ bài mẫu. Bật "Cho phép thay bài đã có" nếu muốn chạy lại.');
  } catch (e) {
    busy = false;
    render();
    toast(e.message);
  }
}


// ============================================================
//  TIẾP NHẬN BÀI (xử lý lưu vào IndexedDB)
// ============================================================

async function receive() {
  if (busy || !uploadQueue.length) return;

  // Kiểm tra còn tệp chưa ghép
  const unmatched = uploadQueue.some(q => !students.some(s => s.id === q.studentId));
  if (unmatched) {
    toast('Vui lòng ghép đầy đủ học sinh trước khi nhận bài.');
    return;
  }

  const replace = $('#replaceExisting')?.checked;
  const auto    = $('#autoGrade')?.checked;

  // Nhóm tệp theo học sinh
  const groups = new Map();
  for (const q of uploadQueue) {
    if (!groups.has(q.studentId)) groups.set(q.studentId, []);
    groups.get(q.studentId).push(q);
  }

  // Kiểm tra học sinh đã có bài
  const conflicts = [...groups.keys()].filter(id =>
    students.find(s => s.id === id).attachments?.length
  );
  if (conflicts.length && !replace) {
    toast('Có học sinh đã có bài. Bật "Cho phép thay bài đã có" hoặc bỏ tệp tương ứng.');
    return;
  }

  busy = true;
  renderClassPicker();

  const button = document.querySelector('[data-action="receive"]');
  if (button) { button.disabled = true; button.textContent = 'Đang nhận và lưu tệp…'; }

  let accepted = 0, mocked = 0;
  const failures = [];

  for (const [id, files] of groups) {
    const s           = students.find(s => s.id === id);
    const attachments = [];
    const stored      = [];

    try {
      // Lưu từng tệp vào IndexedDB
      for (const q of files) {
        const key = crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now() + '-' + Math.random().toString(16).slice(2);
        await fileDB('put', key, { key, blob: q.file, classId: classroom.id, studentId: id });
        stored.push(key);
        attachments.push({ key, name: q.file.name, type: q.file.type, size: q.file.size });
      }

      // Kiểm tra có phải bài mẫu không
      const previous = s.attachments || [];
      const name     = s.name;
      const logs     = s.logs || [];
      const sample   =
        classroom.id === '4A' &&
        files.length === 1 &&
        files[0].sampleId === id &&
        normalize(name) === normalize(sampleNames[seeds.findIndex(x => x.id === id)]);

      if (sample) {
        // Bài mẫu → khôi phục dữ liệu mô phỏng
        const template = structuredClone(seeds.find(x => x.id === id));
        Object.keys(s).forEach(k => delete s[k]);
        Object.assign(s, template, {
          id, name, attachments, logs,
          sample: true, custom: false,
          state: auto ? 'suggested' : 'new',
        });
        delete s.teacherScores;
        delete s.teacherFeedback;
        delete s.reason;
        if (auto) mocked++;
      } else {
        // Bài mới → chờ kết nối AI
        Object.keys(s).forEach(k => delete s[k]);
        Object.assign(s, blankStudent(id, name), { attachments, logs, awaitingAI: true });
      }

      log(s, 'Tiếp nhận tệp bài làm',
        `${attachments.length} tệp được ghép với ${name} (${id}). ` +
        (sample && auto ? 'Đã chạy chấm mẫu mô phỏng.' : 'Chờ kết nối AI hoặc giáo viên chấm thủ công.'));
      save();

      // Xóa tệp cũ
      for (const a of previous) {
        if (!a.sampleUrl) {
          try {
            await fileDB('delete', a.key);
            if (urls.has(a.key)) { URL.revokeObjectURL(urls.get(a.key)); urls.delete(a.key); }
          } catch { /* bỏ qua lỗi xóa */ }
        }
      }

      // Xóa tệp đã xử lý khỏi hàng chờ
      for (const q of files) uploadQueue = uploadQueue.filter(x => x !== q);
      accepted++;

    } catch (e) {
      // Rollback: xóa tệp đã lưu nếu lỗi
      for (const key of stored) {
        try { await fileDB('delete', key); } catch { /* ignore */ }
      }
      failures.push(s.name + ': ' + e.message);
    }
  }

  busy = false;
  render();

  if (failures.length) {
    modal('Kết quả tiếp nhận',
      `<p class="formnote">Đã nhận ${accepted} bài. Một số bài chưa lưu được:</p>
       <div class="box"><p>${failures.map(esc).join('<br>')}</p></div>
       <button class="btn primary" data-action="close">Đóng</button>`);
  } else {
    modal(`Đã tiếp nhận ${accepted} bài`,
      `<div class="box">
         <h3>Ghép theo danh sách lớp hoàn tất</h3>
         <p>${mocked ? mocked + ' bài mẫu đã có điểm và nhận xét mô phỏng, chờ giáo viên duyệt.' : ''}</p>
         <p>${(accepted - mocked) ? (accepted - mocked) + ' bài đang chờ kết nối AI để nhận dạng và chấm; giáo viên có thể chấm thủ công.' : ''}</p>
       </div>
       <div class="modal-actions">
         <button class="btn" data-action="close">Ở lại</button>
         <button class="btn primary" data-action="viewReceived">Xem bài đã nhận →</button>
       </div>`);
  }
}


// ============================================================
//  XEM TRƯỚC TỆP ĐÍNH KÈM
// ============================================================

async function mountAttachmentPreview() {
  mountIntake();

  const host = $('#attachmentPreview');
  if (!host || !students.length) return;

  const s           = current();
  const sid         = s.id;
  const cid         = classroom.id;
  const attachments = s.attachments || [];

  if (!attachments.length) {
    host.innerHTML = '<div class="attachment-empty">Chưa có ảnh/PDF. Tải bài lên từ mục Nhận bài & chấm AI.</div>';
    return;
  }

  previewPage = Math.min(previewPage, attachments.length - 1);
  const a     = attachments[previewPage];

  host.innerHTML = '<div class="attachment-empty">Đang mở tệp gốc…</div>';

  try {
    const url = await attachmentURL(a);

    // Kiểm tra còn đúng học sinh / lớp không
    if (current()?.id !== sid || classroom.id !== cid || !host.isConnected) return;

    const fileViewer = a.type === 'application/pdf'
      ? `<object class="pdf-viewer" data="${esc(url)}" type="application/pdf">
           <p>Trình duyệt không hiển thị PDF tại đây. Chọn "Mở tệp gốc" để xem.</p>
         </object>`
      : `<a href="${esc(url)}" target="_blank" rel="noopener">
           <img src="${esc(url)}" alt="Bài làm của ${esc(s.name)} - ${esc(a.name)}">
         </a>`;

    const pagination = attachments.length > 1
      ? `<div class="file-pages">
           ${attachments.map((f, i) =>
               `<button data-file-page="${i}" class="${previewPage === i ? 'active' : ''}">Tệp ${i + 1}</button>`
             ).join('')}
         </div>`
      : '';

    host.innerHTML = `
      <div class="attachment-frame">${fileViewer}</div>
      <div class="attachment-toolbar">
        <span>${esc(a.name)}</span>
        <a href="${esc(url)}" target="_blank" rel="noopener" class="link">Mở tệp gốc ↗</a>
      </div>
      ${pagination}`;

  } catch (e) {
    if (host.isConnected) {
      host.innerHTML = `<div class="attachment-empty">${esc(e.message)}</div>`;
    }
  }
}


// ============================================================
//  TRANG LỚP TRỐNG
// ============================================================

function emptyClass() {
  return (
    header('Lớp chưa có học sinh.', 'Thêm danh sách lớp trước khi tiếp nhận bài làm.') +
    `<div class="card empty">
       <p>Chưa có học sinh trong ${esc(classroom.label)}.</p>
       <button class="btn primary" data-action="roster">Thêm danh sách học sinh</button>
     </div>`
  );
}


// ============================================================
//  TRANG DANH SÁCH LỚP
// ============================================================

function rosterPage() {
  return (
    header(
      'Danh sách sẵn sàng. Ghép bài chính xác.',
      'Quản lý tên học sinh để ghép với tên tệp bài làm.',
      `<button class="btn" data-action="newClass">+ Thêm lớp</button>
       <button class="btn" data-action="importRoster">Nhập danh sách</button>
       <button class="btn primary" data-action="newStudent">+ Thêm học sinh</button>`
    ) +
    `<div class="notice">
       <span class="symbol">☷</span>
       <div>Danh sách hiện tại là dữ liệu minh họa. Tên và bài làm tự nhập chỉ được lưu trên trình duyệt của bạn.</div>
     </div>
     <section class="card">
       <div class="card-head">
         <h2>${esc(classroom.label)} · ${students.length} học sinh</h2>
         <button class="textbtn" data-action="intake">Nhận bài cho lớp này →</button>
       </div>
       <table class="data-table roster-table">
         <thead>
           <tr>
             <th>STT</th><th>Mã học sinh</th><th>Họ và tên</th>
             <th>Tên tệp gợi ý</th><th>Đã có bài</th><th></th>
           </tr>
         </thead>
         <tbody>
           ${students.map((s, i) => `
             <tr>
               <td>${i + 1}</td>
               <td>${esc(s.id)}</td>
               <td><strong>${esc(s.name || s.id)}</strong></td>
               <td><code>${esc(s.id + '_' + s.name)}.jpg</code></td>
               <td>${s.attachments?.length ? s.attachments.length + ' tệp' : 'Chưa nộp'}</td>
               <td><button data-edit-student="${esc(s.id)}">Sửa tên</button></td>
             </tr>`).join('')}
         </tbody>
       </table>
       ${students.length ? '' : '<div class="empty">Thêm học sinh hoặc nhập nhiều tên cùng lúc.</div>'}
     </section>
     <div class="box" style="margin-top:18px">
       <h3>Nếu có học sinh trùng tên</h3>
       <p>Dùng mã học sinh trong tên tệp, ví dụ HS01_Nguyễn Minh An.jpg. Hệ thống sẽ yêu cầu chọn lại nếu tên tệp có nhiều kết quả khớp.</p>
     </div>`
  );
}


// ============================================================
//  MODAL THÊM / SỬA HỌC SINH
// ============================================================

/** Tạo mã học sinh tiếp theo chưa bị dùng */
function nextStudentID() {
  let n = 1;
  while (students.some(s => s.id === 'HS' + String(n).padStart(2, '0'))) n++;
  return 'HS' + String(n).padStart(2, '0');
}

function studentModal(id) {
  const s = students.find(x => x.id === id);

  modal(s ? 'Sửa tên học sinh' : 'Thêm học sinh', `
    <form id="studentForm">
      <label class="field">Mã học sinh
        <input name="id" value="${esc(s?.id || nextStudentID())}"
               ${s ? 'readonly' : ''}
               pattern="[A-Za-z0-9_-]+" maxlength="24" required>
      </label>
      <label class="field">Họ và tên
        <input name="name" value="${esc(s?.name || '')}" maxlength="100" required placeholder="VD: Nguyễn Minh An">
      </label>
      <p class="formnote">Mã học sinh giúp phân biệt các em trùng họ và tên.</p>
      <div class="modal-actions">
        <button type="button" class="btn" data-action="close">Hủy</button>
        <button class="btn primary">Lưu học sinh</button>
      </div>
    </form>`
  );

  $('#studentForm').onsubmit = e => {
    e.preventDefault();
    const f    = new FormData(e.target);
    const name = String(f.get('name')).trim().replace(/\s+/g, ' ');
    const code = String(f.get('id')).toUpperCase();

    if (!name)                                 { toast('Vui lòng nhập họ và tên.'); return; }
    if (!s && students.some(x => x.id === code)) { toast('Mã học sinh đã tồn tại.'); return; }

    if (s) {
      s.name = name;
    } else {
      students.push(blankStudent(code, name));
    }

    // Cập nhật lại kết quả ghép tên trong hàng chờ
    uploadQueue.forEach(q => {
      if (!q.studentId) {
        const m      = matchFilename(q.file.name);
        q.studentId  = m.id;
        q.reason     = m.reason;
      }
    });

    save();
    $('#modal').close();
    render();
    toast('Đã lưu danh sách lớp.');
  };
}


// ============================================================
//  MODAL NHẬP DANH SÁCH HỌC SINH
// ============================================================

function importRoster() {
  modal('Nhập danh sách học sinh', `
    <form id="rosterForm">
      <p class="formnote">Mỗi dòng một họ và tên. Hệ thống tự cấp mã học sinh và thêm vào lớp hiện tại. Tên đã có sẽ được bỏ qua; học sinh trùng tên nên thêm riêng với mã khác.</p>
      <label class="field">Danh sách họ và tên
        <textarea name="names" maxlength="15000" required
                  placeholder="Nguyễn Minh An&#10;Trần Ngọc Bảo&#10;Lê Hà Chi"
                  style="min-height:190px"></textarea>
      </label>
      <div class="modal-actions">
        <button class="btn" type="button" data-action="close">Hủy</button>
        <button class="btn primary">Thêm vào ${esc(classroom.label)}</button>
      </div>
    </form>`
  );

  $('#rosterForm').onsubmit = e => {
    e.preventDefault();
    const lines = String(new FormData(e.target).get('names'))
      .split(/\r?\n/)
      .map(x => x.trim().replace(/\s+/g, ' '))
      .filter(Boolean);

    if (lines.length > 100) { toast('Mỗi lần nhập tối đa 100 học sinh.'); return; }

    let n = 0;
    for (const name of lines) {
      if (name.length > 100 || students.some(s => normalize(s.name) === normalize(name))) continue;
      students.push(blankStudent(nextStudentID(), name));
      n++;
    }

    save();
    $('#modal').close();
    render();
    toast(`Đã thêm ${n} học sinh; bỏ qua tên trùng hoặc không hợp lệ.`);
  };
}


// ============================================================
//  MODAL THÊM LỚP
// ============================================================

function newClass() {
  modal('Thêm lớp', `
    <form id="classForm">
      <label class="field">Tên lớp
        <input name="label" required maxlength="40" placeholder="VD: Lớp 4C">
      </label>
      <div class="modal-actions">
        <button class="btn" type="button" data-action="close">Hủy</button>
        <button class="btn primary">Tạo lớp</button>
      </div>
    </form>`
  );

  $('#classForm').onsubmit = e => {
    e.preventDefault();
    const label = String(new FormData(e.target).get('label')).trim();
    if (!label) { toast('Vui lòng nhập tên lớp.'); return; }
    if (data.classes.some(c => normalize(c.label) === normalize(label))) { toast('Tên lớp đã có.'); return; }

    classroom = { id: 'class-' + Date.now().toString(36), label, students: [] };
    data.classes.push(classroom);
    students    = classroom.students;
    selected    = '';
    uploadQueue = [];
    page        = 'roster';
    save();
    $('#modal').close();
    render();
  };
}


// ============================================================
//  LOCK UI KHI ĐANG XỬ LÝ
// ============================================================

document.addEventListener('click', e => {
  if (busy && e.target.closest('button,nav,[data-queue]')) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);


// ============================================================
//  MODAL GIỚI THIỆU (nút ? / About)
// ============================================================

function about() {
  modal('Nhận bài · AI hỗ trợ · Giáo viên duyệt', `
    <div class="box">
      <h3>Quy trình trong bản demo</h3>
      <p>Chọn lớp có sẵn danh sách → tải nhiều ảnh PNG/JPEG hoặc PDF → đối chiếu tên tệp với tên/mã học sinh → xem tệp gốc → kiểm tra điểm, cách chữa và nhận xét → giáo viên duyệt.</p>
    </div>
    <div class="box">
      <h3>Nhận tệp và ghép tên hoạt động thật</h3>
      <p>Có thể sửa danh sách, thêm lớp và học sinh; nhận nhiều ảnh cho một bài; xem PDF nhiều trang bằng trình đọc của trình duyệt. Mỗi PDF chỉ chứa bài của một học sinh.</p>
    </div>
    <div class="box">
      <h3>AI đọc và chấm bài mới chưa được kết nối</h3>
      <p>Bộ bài mẫu có kết quả mô phỏng được biên soạn sẵn. Bài bạn tải lên được lưu và xem thật, nhưng chưa tự đọc chữ viết tay, trích nội dung hoặc tạo điểm mới. Giáo viên có thể chấm thủ công trong khi chờ kết nối AI.</p>
    </div>
    <div class="box">
      <h3>Dữ liệu trên thiết bị của người dùng</h3>
      <p>Tệp lưu trong IndexedDB; danh sách và nhận xét lưu trong trình duyệt. Người xem khác không truy cập được tệp bạn tự tải lên. Xóa dữ liệu trình duyệt sẽ làm mất dữ liệu tự nhập.</p>
    </div>
    <button class="btn" data-action="reset">Khôi phục dữ liệu mẫu</button>
    <button class="btn primary" data-action="close" style="float:right">Đã hiểu</button>`
  );
}


// ============================================================
//  SỰ KIỆN CLICK — INTAKE & ROSTER
// ============================================================

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;

  // Xóa tệp khỏi hàng chờ
  if (b.dataset.removeFile !== undefined) {
    uploadQueue.splice(Number(b.dataset.removeFile), 1);
    render();
    return;
  }

  // Chuyển trang xem tệp
  if (b.dataset.filePage !== undefined) {
    previewPage = Number(b.dataset.filePage);
    mountAttachmentPreview();
    return;
  }

  // Sửa học sinh
  if (b.dataset.editStudent) {
    studentModal(b.dataset.editStudent);
    return;
  }

  switch (b.dataset.action) {
    case 'upload':
      page = 'intake'; render(); $('#batchFiles').click();
      break;
    case 'roster':
      page = 'roster'; render();
      break;
    case 'intake':
      page = 'intake'; render();
      break;
    case 'clearQueue':
      if (busy) return;
      uploadQueue = []; render();
      break;
    case 'samples':
      loadSamples();
      break;
    case 'receive':
      receive();
      break;
    case 'viewReceived':
      $('#modal').close();
      page        = 'grading';
      selected    = students.find(s => s.attachments?.length)?.id || students[0]?.id || '';
      tab         = 'review';
      previewPage = 0;
      render();
      break;
    case 'newStudent':
      studentModal();
      break;
    case 'importRoster':
      importRoster();
      break;
    case 'newClass':
      newClass();
      break;
  }
});


// ============================================================
//  KHỞI CHẠY
// ============================================================

$('#about').onclick = about;
$('#help').onclick  = about;
render();
