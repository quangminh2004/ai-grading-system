import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function AdminSchoolsPage({ showToast }) {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal thêm trường mới
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    address: '',
    level: 'Tiểu học',
  });

  // Modal sửa trường
  const [editModalSchool, setEditModalSchool] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    address: '',
    level: 'Tiểu học',
  });

  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    setLoading(true);
    try {
      const res = await api.getSchoolsSummary();
      if (res.success) {
        setSchools(res.schools);
      }
    } catch (err) {
      showToast('Lỗi tải dữ liệu trường học: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      showToast('Tên trường học không được để trống');
      return;
    }

    try {
      const res = await api.createSchool({
        name: createForm.name.trim(),
        code: createForm.code.trim(),
        address: createForm.address.trim(),
        level: createForm.level,
      });

      if (res.success) {
        showToast(`✓ Đã thêm trường "${createForm.name}" vào cơ sở dữ liệu!`);
        setShowCreateModal(false);
        setCreateForm({ name: '', code: '', address: '', level: 'Tiểu học' });
        await loadSchools();
      } else {
        showToast(res.message || 'Lỗi khi thêm trường');
      }
    } catch (err) {
      showToast('Lỗi: ' + err.message);
    }
  };

  const handleOpenEdit = (item) => {
    setEditModalSchool(item);
    setEditForm({
      name: item.school,
      code: item.code || '',
      address: item.address || '',
      level: item.level || 'Tiểu học',
    });
  };

  const handleUpdateSchool = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      showToast('Tên trường học không được để trống');
      return;
    }

    try {
      const res = await api.updateSchool(editModalSchool._id, {
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        address: editForm.address.trim(),
        level: editForm.level,
      });

      if (res.success) {
        showToast('✓ Cập nhật thông tin trường thành công!');
        setEditModalSchool(null);
        await loadSchools();
      } else {
        showToast(res.message || 'Lỗi cập nhật trường');
      }
    } catch (err) {
      showToast('Lỗi: ' + err.message);
    }
  };

  const handleDeleteSchool = async (item) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa trường "${item.school}" khỏi hệ thống?`)) {
      return;
    }

    try {
      const res = await api.deleteSchool(item._id);
      if (res.success) {
        showToast(`✓ Đã xóa trường "${item.school}"`);
        await loadSchools();
      } else {
        showToast(res.message || 'Không thể xóa trường này');
      }
    } catch (err) {
      showToast('Lỗi: ' + err.message);
    }
  };

  const filtered = schools.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.school?.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q) ||
      s.address?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-page-container">
      <div className="card admin-table-card">
        <div className="card-header-flex">
          <div>
            <h3>Danh mục Trường Học &amp; Lớp Học</h3>
            <p className="card-subtext">
              Tổng hợp mạng lưới các trường học, số lượng giáo viên và danh sách lớp học trực thuộc.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>+</span>
            <span>Thêm trường học mới</span>
          </button>
        </div>

        <div className="admin-toolbar">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Tìm theo tên trường, mã trường, địa chỉ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="clear-search-btn" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>

        <div className="table-responsive">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Tên trường học</th>
                <th>Giáo viên phụ trách</th>
                <th>Danh sách lớp</th>
                <th>Tổng học sinh</th>
                <th>Tiến độ chấm bài</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>
                    ⏳ Đang tải danh sách trường học...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                    Chưa có trường học nào phù hợp. Nhấn "+ Thêm trường học mới" để tạo trường đầu tiên!
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item._id || item.school}>
                    <td>
                      <div className="user-name-cell">
                        <span className="avatar-bubble school">🏫</span>
                        <div>
                          <strong>{item.school}</strong>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                            <span className="badge-tag level-tag">{item.level || 'Tiểu học'}</span>
                            {item.code && (
                              <code style={{ fontSize: '11px', background: '#f3f4f6', padding: '1px 5px', borderRadius: '3px' }}>
                                {item.code}
                              </code>
                            )}
                            {item.address && (
                              <small style={{ color: '#666' }}>📍 {item.address}</small>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{item.teacherCount} cô giáo</strong>
                        <div style={{ marginTop: '2px' }}>
                          {item.teachers && item.teachers.length > 0 ? (
                            item.teachers.map((t) => (
                              <span
                                key={t.username}
                                className="badge-tag teacher-tag"
                                title={`Tài khoản: @${t.username}${t.phone ? ' - ' + t.phone : ''}`}
                              >
                                👩‍🏫 {t.fullName}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted" style={{ fontSize: '11px' }}>Chưa có giáo viên</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        {item.classes && item.classes.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {item.classes.map((c) => (
                              <span key={c.classId} className="badge-tag class-tag">
                                📚 {c.label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '11px' }}>Chưa tạo lớp</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <strong>{item.studentCount}</strong> học sinh
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        <span>
                          Đã duyệt: <b>{item.approvedCount}</b> / {item.submissionCount} bài
                        </span>
                        <div
                          style={{
                            background: '#e5e7eb',
                            height: '6px',
                            borderRadius: '3px',
                            marginTop: '4px',
                            overflow: 'hidden',
                            width: '120px',
                          }}
                        >
                          <div
                            style={{
                              background: '#28664e',
                              height: '100%',
                              width: item.submissionCount
                                ? `${Math.round((item.approvedCount / item.submissionCount) * 100)}%`
                                : '0%',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons-group">
                        <button
                          className="btn-action edit"
                          onClick={() => handleOpenEdit(item)}
                          title="Sửa thông tin trường học"
                        >
                          ✏️ Sửa
                        </button>
                        {item._id && (
                          <button
                            className="btn-action delete"
                            onClick={() => handleDeleteSchool(item)}
                            title="Xóa trường học"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Thêm trường học mới */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thêm trường học mới</h3>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateSchool} className="modal-form">
              <div className="form-group">
                <label>Tên trường học *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Trường Tiểu học Yên Nghĩa"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Mã trường (tùy chọn)</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: TH-YENNGHIA"
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Cấp học</label>
                  <select
                    value={createForm.level}
                    onChange={(e) => setCreateForm({ ...createForm, level: e.target.value })}
                  >
                    <option value="Tiểu học">Tiểu học</option>
                    <option value="THCS">Trung học cơ sở (THCS)</option>
                    <option value="Liên cấp">Trường Liên cấp</option>
                    <option value="Mầm non">Mầm non</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Địa chỉ / Khu vực (tùy chọn)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Phường Yên Nghĩa, Quận Hà Đông, Hà Nội"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  ✓ Thêm trường học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Sửa trường học */}
      {editModalSchool && (
        <div className="modal-backdrop" onClick={() => setEditModalSchool(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh sửa trường học</h3>
              <button className="modal-close-btn" onClick={() => setEditModalSchool(null)}>✕</button>
            </div>
            <form onSubmit={handleUpdateSchool} className="modal-form">
              <div className="form-group">
                <label>Tên trường học *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Mã trường</label>
                  <input
                    type="text"
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Cấp học</label>
                  <select
                    value={editForm.level}
                    onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                  >
                    <option value="Tiểu học">Tiểu học</option>
                    <option value="THCS">Trung học cơ sở (THCS)</option>
                    <option value="Liên cấp">Trường Liên cấp</option>
                    <option value="Mầm non">Mầm non</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Địa chỉ / Khu vực</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditModalSchool(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
