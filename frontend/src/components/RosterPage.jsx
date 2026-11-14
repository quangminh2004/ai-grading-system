import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { rubricMaxTotal, sumScores, fmtScore } from '../utils/rubric';

export default function RosterPage({
  classroom,
  students,
  onAddStudent,
  onImportRoster,
  showToast,
  currentUser,
}) {
  const [singleName, setSingleName] = useState('');
  const [singleId, setSingleId] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [tab, setTab] = useState('list'); // 'list' | 'single' | 'bulk' | 'parents'

  const canManageParents =
    currentUser?.role === 'admin' ||
    (currentUser?.role === 'teacher' &&
      classroom?.teacherUsername &&
      classroom.teacherUsername === currentUser.username);

  const [parents, setParents] = useState([]);
  const [parentsLoading, setParentsLoading] = useState(false);
  const [parentForm, setParentForm] = useState({
    username: '',
    password: '',
    fullName: '',
    phone: '',
    studentIds: [],
  });
  const [editingParentId, setEditingParentId] = useState(null);
  const [editStudentIds, setEditStudentIds] = useState([]);
  const [resetPwd, setResetPwd] = useState({ userId: '', password: '' });
  const [savingParent, setSavingParent] = useState(false);

  const loadParents = async () => {
    if (!classroom?.classId || !canManageParents) return;
    setParentsLoading(true);
    try {
      const res = await api.listClassParents(classroom.classId);
      if (res.success) {
        setParents(res.parents || []);
      } else {
        showToast?.(res.message || 'Không tải được danh sách phụ huynh.');
      }
    } catch (err) {
      showToast?.('Lỗi tải phụ huynh: ' + err.message);
    } finally {
      setParentsLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'parents' && canManageParents) {
      loadParents();
    }
  }, [tab, classroom?.classId, canManageParents]);

  const handleAddSingle = async (e) => {
    e.preventDefault();
    if (!singleName.trim()) return;
    await onAddStudent({ name: singleName, studentId: singleId });
    setSingleName('');
    setSingleId('');
    setTab('list');
  };

  const handleImportBulk = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) return;
    await onImportRoster(bulkText);
    setBulkText('');
    setTab('list');
  };

  const toggleStudentId = (list, setList, id) => {
    if (list.includes(id)) {
      setList(list.filter((x) => x !== id));
    } else {
      setList([...list, id]);
    }
  };

  const handleCreateParent = async (e) => {
    e.preventDefault();
    if (!classroom?.classId) return;
    if (!parentForm.studentIds.length) {
      showToast?.('Vui lòng chọn ít nhất một học sinh.');
      return;
    }
    setSavingParent(true);
    try {
      const res = await api.createClassParent(classroom.classId, {
        username: parentForm.username,
        password: parentForm.password,
        fullName: parentForm.fullName,
        phone: parentForm.phone,
        studentIds: parentForm.studentIds,
      });
      if (res.success) {
        showToast?.(res.message || 'Đã tạo tài khoản phụ huynh.');
        setParentForm({
          username: '',
          password: '',
          fullName: '',
          phone: '',
          studentIds: [],
        });
        await loadParents();
      } else {
        showToast?.(res.message || 'Không tạo được tài khoản phụ huynh.');
      }
    } catch (err) {
      showToast?.('Lỗi: ' + err.message);
    } finally {
      setSavingParent(false);
    }
  };

  const handleSaveEditChildren = async (userId) => {
    if (!classroom?.classId) return;
    setSavingParent(true);
    try {
      const res = await api.updateClassParent(classroom.classId, userId, {
        studentIds: editStudentIds,
      });
      if (res.success) {
        showToast?.(res.message || 'Đã cập nhật danh sách con.');
        setEditingParentId(null);
        await loadParents();
      } else {
        showToast?.(res.message || 'Không cập nhật được.');
      }
    } catch (err) {
      showToast?.('Lỗi: ' + err.message);
    } finally {
      setSavingParent(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!classroom?.classId || !resetPwd.userId) return;
    setSavingParent(true);
    try {
      const res = await api.resetClassParentPassword(
        classroom.classId,
        resetPwd.userId,
        resetPwd.password
      );
      if (res.success) {
        showToast?.(res.message || 'Đã đặt lại mật khẩu.');
        setResetPwd({ userId: '', password: '' });
      } else {
        showToast?.(res.message || 'Không đặt lại được mật khẩu.');
      }
    } catch (err) {
      showToast?.('Lỗi: ' + err.message);
    } finally {
      setSavingParent(false);
    }
  };

  const studentNameById = Object.fromEntries(students.map((s) => [s.id, s.name]));

  return (
    <div>
      <div className="pagehead">
        <div>
          <div className="eyebrow">
            TRỢ LÝ CHẤM CHỮA BÀI · DANH SÁCH LỚP HỌC
          </div>
          <h1>Danh sách học sinh · {classroom?.label}</h1>
          <p className="sub">
            Quản lý sĩ số lớp {classroom?.label}. Tổng cộng: {students.length} học sinh.
          </p>
        </div>
        <div className="actions">
          <button
            className={`btn ${tab === 'list' ? 'primary' : 'outline'}`}
            onClick={() => setTab('list')}
          >
            Danh sách
          </button>
          <button
            className={`btn ${tab === 'single' ? 'primary' : 'outline'}`}
            onClick={() => setTab('single')}
          >
            + Thêm 1 học sinh
          </button>
          <button
            className={`btn ${tab === 'bulk' ? 'primary' : 'outline'}`}
            onClick={() => setTab('bulk')}
          >
            Nhập hàng loạt
          </button>
          {canManageParents && (
            <button
              className={`btn ${tab === 'parents' ? 'primary' : 'outline'}`}
              onClick={() => setTab('parents')}
            >
              Phụ huynh
            </button>
          )}
        </div>
      </div>

      {tab === 'list' && (
        <div className="card" style={{ padding: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e3e8dc', color: '#66755e' }}>
                <th style={{ padding: '12px' }}>STT</th>
                <th style={{ padding: '12px' }}>Mã HS</th>
                <th style={{ padding: '12px' }}>Họ và tên</th>
                <th style={{ padding: '12px' }}>Trạng thái bài làm</th>
                <th style={{ padding: '12px' }}>Điểm</th>
                <th style={{ padding: '12px' }}>Tệp đính kèm</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, idx) => {
                const isTeacher = s.teacherScores?.length > 0;
                const sc = isTeacher ? s.teacherScores : s.scores;
                const hasScore = sc?.length > 0;
                const maxTotal = rubricMaxTotal(s.rubric || classroom?.rubric);
                return (
                <tr key={s.id} style={{ borderBottom: '1px solid #eef2ea' }}>
                  <td style={{ padding: '12px', color: '#7a8670' }}>{idx + 1}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{s.id}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="avatar small">{s.id.slice(-2)}</span>
                      <span>{s.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      className={`status ${
                        s.state === 'approved' ? 'approved' : s.state === 'new' ? 'new' : ''
                      }`}
                    >
                      {s.state === 'approved'
                        ? 'Đã duyệt'
                        : s.state === 'suggested'
                        ? 'Chờ GV duyệt'
                        : 'Chưa có bài'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {hasScore ? (
                      <span title={isTeacher ? 'Điểm giáo viên chấm' : 'Điểm AI đề xuất (chưa duyệt)'}>
                        <b style={{ color: s.state === 'approved' ? '#2b5120' : '#8d6313', fontSize: '15px' }}>
                          {fmtScore(sumScores(sc))}
                        </b>
                        <span style={{ color: '#7a8670' }}> / {fmtScore(maxTotal)}</span>
                        {s.state !== 'approved' && (
                          <span style={{ fontSize: '12px', color: '#a08a5a', marginLeft: '6px' }}>
                            ({isTeacher ? 'nháp' : 'AI'})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: '#a0ac96' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', color: '#687560' }}>
                    {s.attachments?.length ? `${s.attachments.length} tệp` : '—'}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'single' && (
        <div className="card" style={{ padding: '24px', maxWidth: '500px' }}>
          <h3>Thêm học sinh mới vào lớp {classroom?.label}</h3>
          <form onSubmit={handleAddSingle} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                Mã học sinh (tùy chọn, vd: HS07):
              </label>
              <input
                type="text"
                placeholder="Tự động tạo nếu để trống"
                value={singleId}
                onChange={(e) => setSingleId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                Họ và tên học sinh (*):
              </label>
              <input
                type="text"
                required
                placeholder="Nhập họ và tên..."
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="submit" className="btn primary">
                Thêm học sinh
              </button>
              <button type="button" className="btn outline" onClick={() => setTab('list')}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'bulk' && (
        <div className="card" style={{ padding: '24px', maxWidth: '650px' }}>
          <h3>Nhập danh sách học sinh hàng loạt</h3>
          <p style={{ color: '#687560', fontSize: '14px' }}>
            Dán danh sách học sinh vào ô bên dưới, mỗi học sinh trên một dòng. Có thể bao gồm mã HS hoặc chỉ họ tên.
          </p>

          <form onSubmit={handleImportBulk} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            <textarea
              rows="8"
              required
              placeholder={`Nguyễn Văn A\nTrần Thị B\nHS05 Lê Văn C`}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px' }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn primary">
                Nhập danh sách
              </button>
              <button type="button" className="btn outline" onClick={() => setTab('list')}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'parents' && canManageParents && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px', maxWidth: '720px' }}>
            <h3 style={{ marginTop: 0 }}>Tạo tài khoản phụ huynh</h3>
            <p style={{ color: '#687560', fontSize: '14px' }}>
              Phụ huynh chỉ xem được điểm và nhận xét các bài đã duyệt của học sinh được gắn.
            </p>
            <form
              onSubmit={handleCreateParent}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                    Họ tên phụ huynh (*)
                  </label>
                  <input
                    required
                    value={parentForm.fullName}
                    onChange={(e) => setParentForm({ ...parentForm, fullName: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                    Số điện thoại
                  </label>
                  <input
                    value={parentForm.phone}
                    onChange={(e) => setParentForm({ ...parentForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                    Tên đăng nhập (*)
                  </label>
                  <input
                    required
                    minLength={3}
                    value={parentForm.username}
                    onChange={(e) => setParentForm({ ...parentForm, username: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                    Mật khẩu (*)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={parentForm.password}
                    onChange={(e) => setParentForm({ ...parentForm, password: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ccc' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
                  Gắn học sinh (*)
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '8px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    padding: '8px',
                    border: '1px solid #e3e8dc',
                    borderRadius: '8px',
                  }}
                >
                  {students.map((s) => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                      <input
                        type="checkbox"
                        checked={parentForm.studentIds.includes(s.id)}
                        onChange={() =>
                          toggleStudentId(
                            parentForm.studentIds,
                            (next) => setParentForm({ ...parentForm, studentIds: next }),
                            s.id
                          )
                        }
                      />
                      {s.id} · {s.name}
                    </label>
                  ))}
                  {!students.length && (
                    <span style={{ color: '#687560' }}>Chưa có học sinh trong lớp.</span>
                  )}
                </div>
              </div>

              <button type="submit" className="btn primary" disabled={savingParent}>
                {savingParent ? 'Đang tạo...' : 'Tạo tài khoản phụ huynh'}
              </button>
            </form>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ marginTop: 0 }}>Phụ huynh đã gắn lớp này</h3>
            {parentsLoading ? (
              <p style={{ color: '#687560' }}>Đang tải...</p>
            ) : !parents.length ? (
              <p style={{ color: '#687560' }}>Chưa có tài khoản phụ huynh nào.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e3e8dc', color: '#66755e' }}>
                    <th style={{ padding: '10px' }}>Họ tên</th>
                    <th style={{ padding: '10px' }}>Tài khoản</th>
                    <th style={{ padding: '10px' }}>Con trong lớp</th>
                    <th style={{ padding: '10px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {parents.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #eef2ea', verticalAlign: 'top' }}>
                      <td style={{ padding: '10px' }}>{p.fullName}</td>
                      <td style={{ padding: '10px' }}>{p.username}</td>
                      <td style={{ padding: '10px' }}>
                        {editingParentId === p.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {students.map((s) => (
                              <label key={s.id} style={{ display: 'flex', gap: '6px', fontSize: '13px' }}>
                                <input
                                  type="checkbox"
                                  checked={editStudentIds.includes(s.id)}
                                  onChange={() =>
                                    toggleStudentId(editStudentIds, setEditStudentIds, s.id)
                                  }
                                />
                                {s.id} · {s.name}
                              </label>
                            ))}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                              <button
                                type="button"
                                className="btn primary compact"
                                disabled={savingParent}
                                onClick={() => handleSaveEditChildren(p.id)}
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                className="btn outline compact"
                                onClick={() => setEditingParentId(null)}
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          (p.children || [])
                            .map((c) => studentNameById[c.studentId] || c.studentId)
                            .join(', ') || '—'
                        )}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn outline compact"
                            onClick={() => {
                              setEditingParentId(p.id);
                              setEditStudentIds((p.children || []).map((c) => c.studentId));
                            }}
                          >
                            Sửa danh sách con
                          </button>
                          {resetPwd.userId === p.id ? (
                            <form onSubmit={handleResetPassword} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <input
                                type="password"
                                required
                                minLength={6}
                                placeholder="Mật khẩu mới"
                                value={resetPwd.password}
                                onChange={(e) =>
                                  setResetPwd({ ...resetPwd, password: e.target.value })
                                }
                                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #ccc' }}
                              />
                              <button type="submit" className="btn primary compact" disabled={savingParent}>
                                Đặt lại
                              </button>
                              <button
                                type="button"
                                className="btn outline compact"
                                onClick={() => setResetPwd({ userId: '', password: '' })}
                              >
                                Hủy
                              </button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="btn outline compact"
                              onClick={() => setResetPwd({ userId: p.id, password: '' })}
                            >
                              Đặt lại mật khẩu
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
