import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function AdminUsersPage({ showToast, currentAdmin }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSchool, setFilterSchool] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal tạo giáo viên mới
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    fullName: '',
    school: '',
    customSchool: '',
    email: '',
    phone: '',
  });

  // Modal sửa thông tin giáo viên
  const [editModalUser, setEditModalUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    school: '',
    customSchool: '',
    email: '',
    phone: '',
  });

  // Modal đặt lại mật khẩu
  const [resetModalUser, setResetModalUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadData();
  }, [filterSchool]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes, schoolsRes] = await Promise.all([
        api.getUsers({ school: filterSchool }),
        api.getAdminStats(),
        api.getSchools(),
      ]);

      if (usersRes.success) setUsers(usersRes.users);
      if (statsRes.success) setStats(statsRes.stats);
      if (schoolsRes.success) setSchools(schoolsRes.schools);
    } catch (err) {
      showToast('Lỗi tải dữ liệu người dùng: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    const finalSchool =
      createForm.school === '__custom__'
        ? createForm.customSchool.trim()
        : createForm.school.trim();

    if (!createForm.username || !createForm.password || !createForm.fullName || !finalSchool) {
      showToast('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
      return;
    }

    try {
      const res = await api.createTeacher({
        username: createForm.username,
        password: createForm.password,
        fullName: createForm.fullName,
        school: finalSchool,
        email: createForm.email,
        phone: createForm.phone,
      });

      if (res.success) {
        showToast(`✓ Đã tạo thành công tài khoản giáo viên cho ${createForm.fullName}`);
        setShowCreateModal(false);
        setCreateForm({
          username: '',
          password: '',
          fullName: '',
          school: '',
          customSchool: '',
          email: '',
          phone: '',
        });
        await loadData();
      } else {
        showToast(res.message || 'Lỗi khi tạo tài khoản');
      }
    } catch (err) {
      showToast('Lỗi gửi yêu cầu: ' + err.message);
    }
  };

  const handleOpenEdit = (u) => {
    setEditModalUser(u);
    const isExistingSchool = schools.includes(u.school);
    setEditUserForm({
      fullName: u.fullName || '',
      school: isExistingSchool ? u.school : (u.school ? '__custom__' : ''),
      customSchool: isExistingSchool ? '' : (u.school || ''),
      email: u.email || '',
      phone: u.phone || '',
    });
  };

  const handleUpdateTeacher = async (e) => {
    e.preventDefault();
    const finalSchool =
      editUserForm.school === '__custom__'
        ? editUserForm.customSchool.trim()
        : editUserForm.school.trim();

    if (!editUserForm.fullName.trim() || !finalSchool) {
      showToast('Vui lòng điền đầy đủ Họ và tên và Trường học');
      return;
    }

    try {
      const res = await api.updateUser(editModalUser._id, {
        fullName: editUserForm.fullName.trim(),
        school: finalSchool,
        email: editUserForm.email.trim(),
        phone: editUserForm.phone.trim(),
      });

      if (res.success) {
        showToast(`✓ Cập nhật thông tin cho "${editUserForm.fullName}" thành công!`);
        setEditModalUser(null);
        await loadData();
      } else {
        showToast(res.message || 'Lỗi cập nhật');
      }
    } catch (err) {
      showToast('Lỗi: ' + err.message);
    }
  };

  const handleToggleActive = async (user) => {
    if (user._id === currentAdmin?.id || user.username === currentAdmin?.username) {
      showToast('Không thể tự khóa tài khoản Admin đang đăng nhập');
      return;
    }

    const nextState = !user.active;
    try {
      const res = await api.updateUser(user._id, { active: nextState });
      if (res.success) {
        showToast(`✓ Đã ${nextState ? 'kích hoạt' : 'tạm khóa'} tài khoản ${user.username}`);
        await loadData();
      }
    } catch (err) {
      showToast('Lỗi cập nhật: ' + err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToast('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    try {
      const res = await api.resetUserPassword(resetModalUser._id, newPassword);
      if (res.success) {
        showToast(`✓ Đã đặt lại mật khẩu cho ${resetModalUser.fullName}`);
        setResetModalUser(null);
        setNewPassword('');
      } else {
        showToast(res.message || 'Lỗi đặt lại mật khẩu');
      }
    } catch (err) {
      showToast('Lỗi: ' + err.message);
    }
  };

  const handleDeleteUser = async (user) => {
    if (user._id === currentAdmin?.id || user.username === currentAdmin?.username) {
      showToast('Không thể xóa tài khoản của chính mình');
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${user.fullName}" (${user.username})?`)) {
      return;
    }

    try {
      const res = await api.deleteUser(user._id);
      if (res.success) {
        showToast(`✓ Đã xóa tài khoản ${user.username}`);
        await loadData();
      } else {
        showToast(res.message || 'Không thể xóa');
      }
    } catch (err) {
      showToast('Lỗi: ' + err.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.school?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-page-container">
      {/* KPI Stats Header */}
      {stats && (
        <div className="admin-kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon teacher">👩‍🏫</div>
            <div className="kpi-info">
              <span className="kpi-num">{stats.teachers}</span>
              <span className="kpi-label">Giáo viên các trường</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon school">🏫</div>
            <div className="kpi-info">
              <span className="kpi-num">{stats.schools}</span>
              <span className="kpi-label">Trường học liên kết</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon classes">📚</div>
            <div className="kpi-info">
              <span className="kpi-num">{stats.classes}</span>
              <span className="kpi-label">Lớp học trên hệ thống</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon approved">✓</div>
            <div className="kpi-info">
              <span className="kpi-num">{stats.submissions?.approved || 0}</span>
              <span className="kpi-label">Bài làm đã duyệt</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Admin Card */}
      <div className="card admin-table-card">
        <div className="card-header-flex">
          <div>
            <h3>Quản lý Tài khoản Giáo viên</h3>
            <p className="card-subtext">
              Admin tạo tài khoản, chỉnh sửa thông tin, phân quyền trường học và cấp mật khẩu cho các cô giáo.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>+</span>
            <span>Tạo tài khoản Giáo viên mới</span>
          </button>
        </div>

        {/* Toolbar: Search and Filter */}
        <div className="admin-toolbar">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Tìm theo tên cô, tài khoản, trường học..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>

          <div className="school-filter-box">
            <label>Lọc trường:</label>
            <select
              value={filterSchool}
              onChange={(e) => setFilterSchool(e.target.value)}
            >
              <option value="">Tất cả các trường</option>
              {schools.map((sch) => (
                <option key={sch} value={sch}>{sch}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="table-responsive">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Tên đăng nhập</th>
                <th>Vai trò</th>
                <th>Trường công tác</th>
                <th>Liên hệ</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                    ⏳ Đang tải danh sách giáo viên...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                    Chưa có tài khoản nào. Nhấn "+ Tạo tài khoản Giáo viên mới" để thêm cô giáo đầu tiên!
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="user-name-cell">
                        <span className={`avatar-bubble ${u.role}`}>
                          {u.role === 'admin' ? '👑' : '👩‍🏫'}
                        </span>
                        <div>
                          <strong>{u.fullName}</strong>
                          {u.username === currentAdmin?.username && (
                            <span className="badge-you">(Bạn)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className="username-code">{u.username}</code>
                    </td>
                    <td>
                      <span className={`role-badge ${u.role}`}>
                        {u.role === 'admin' ? 'Quản trị viên' : 'Giáo viên'}
                      </span>
                    </td>
                    <td>
                      <span className="school-name-text">
                        🏫 {u.school || 'Chưa thiết lập'}
                      </span>
                    </td>
                    <td>
                      <div className="contact-info">
                        {u.email && <small>✉️ {u.email}</small>}
                        {u.phone && <small>📞 {u.phone}</small>}
                        {!u.email && !u.phone && <small className="text-muted">—</small>}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${u.active ? 'active' : 'locked'}`}>
                        {u.active ? '✓ Hoạt động' : '🔒 Đã khóa'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons-group">
                        {/* NÚT SỬA THÔNG TIN */}
                        <button
                          className="btn-action edit"
                          onClick={() => handleOpenEdit(u)}
                          title="Chỉnh sửa thông tin giáo viên (họ tên, trường học, liên hệ)"
                        >
                          ✏️ Sửa
                        </button>

                        {/* NÚT ĐẶT LẠI MẬT KHẨU */}
                        <button
                          className="btn-action key"
                          onClick={() => {
                            setResetModalUser(u);
                            setNewPassword('');
                          }}
                          title="Đặt lại mật khẩu cho tài khoản này"
                        >
                          🔑 Đổi MK
                        </button>

                        {/* NÚT KHÓA / MỞ KHÓA */}
                        {u.role !== 'admin' && (
                          <button
                            className={`btn-action ${u.active ? 'lock' : 'unlock'}`}
                            onClick={() => handleToggleActive(u)}
                            title={u.active ? 'Khóa tài khoản này' : 'Mở khóa tài khoản'}
                          >
                            {u.active ? 'Khóa' : 'Mở'}
                          </button>
                        )}

                        {/* NÚT XÓA */}
                        {u.role !== 'admin' && (
                          <button
                            className="btn-action delete"
                            onClick={() => handleDeleteUser(u)}
                            title="Xóa tài khoản này khỏi hệ thống"
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

      {/* Modal: Tạo tài khoản Giáo viên mới */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tạo tài khoản Giáo viên mới</h3>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateTeacher} className="modal-form">
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Họ và tên cô giáo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Cô Nguyễn Thị Lan"
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Tên đăng nhập (Username) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: colan, cothu, ..."
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Mật khẩu khởi tạo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Tối thiểu 6 ký tự"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Số điện thoại (tùy chọn)</label>
                  <input
                    type="tel"
                    placeholder="Ví dụ: 0912345678"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Trường học công tác *</label>
                <select
                  value={createForm.school}
                  onChange={(e) => setCreateForm({ ...createForm, school: e.target.value })}
                  required
                >
                  <option value="">-- Chọn trường có sẵn hoặc nhập mới --</option>
                  {schools.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="__custom__">➕ Nhập tên trường mới...</option>
                </select>

                {createForm.school === '__custom__' && (
                  <input
                    type="text"
                    style={{ marginTop: '8px' }}
                    placeholder="Nhập tên trường học mới (Ví dụ: Trường Tiểu học Yên Nghĩa)"
                    required
                    value={createForm.customSchool}
                    onChange={(e) => setCreateForm({ ...createForm, customSchool: e.target.value })}
                  />
                )}
              </div>

              <div className="form-group">
                <label>Email liên hệ (tùy chọn)</label>
                <input
                  type="email"
                  placeholder="Ví dụ: colan@truong.edu.vn"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
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
                  ✓ Tạo tài khoản Giáo viên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Sửa thông tin Giáo viên */}
      {editModalUser && (
        <div className="modal-backdrop" onClick={() => setEditModalUser(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh sửa thông tin Giáo viên</h3>
              <button className="modal-close-btn" onClick={() => setEditModalUser(null)}>✕</button>
            </div>
            <form onSubmit={handleUpdateTeacher} className="modal-form">
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Tên đăng nhập (Username)</label>
                  <input
                    type="text"
                    disabled
                    value={editModalUser.username}
                    style={{ background: '#f3f4f6', cursor: 'not-allowed', color: '#666' }}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Họ và tên cô giáo *</label>
                  <input
                    type="text"
                    required
                    value={editUserForm.fullName}
                    onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Trường học công tác *</label>
                <select
                  value={editUserForm.school}
                  onChange={(e) => setEditUserForm({ ...editUserForm, school: e.target.value })}
                  required
                >
                  <option value="">-- Chọn trường học --</option>
                  {schools.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="__custom__">➕ Nhập tên trường khác...</option>
                </select>

                {editUserForm.school === '__custom__' && (
                  <input
                    type="text"
                    style={{ marginTop: '8px' }}
                    placeholder="Nhập tên trường học..."
                    required
                    value={editUserForm.customSchool}
                    onChange={(e) => setEditUserForm({ ...editUserForm, customSchool: e.target.value })}
                  />
                )}
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Số điện thoại</label>
                  <input
                    type="tel"
                    placeholder="Ví dụ: 0912345678"
                    value={editUserForm.phone}
                    onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Email liên hệ</label>
                  <input
                    type="email"
                    placeholder="Ví dụ: giaovien@truong.edu.vn"
                    value={editUserForm.email}
                    onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditModalUser(null)}
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

      {/* Modal: Đặt lại mật khẩu */}
      {resetModalUser && (
        <div className="modal-backdrop" onClick={() => setResetModalUser(null)}>
          <div className="modal-card small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Đặt lại mật khẩu</h3>
              <button className="modal-close-btn" onClick={() => setResetModalUser(null)}>✕</button>
            </div>
            <form onSubmit={handleResetPassword} className="modal-form">
              <p style={{ margin: '0 0 12px 0' }}>
                Đang đổi mật khẩu cho tài khoản: <b>{resetModalUser.fullName}</b> (<code>{resetModalUser.username}</code>)
              </p>
              <div className="form-group">
                <label>Mật khẩu mới (tối thiểu 6 ký tự) *</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập mật khẩu mới..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setResetModalUser(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Xác nhận đổi mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
