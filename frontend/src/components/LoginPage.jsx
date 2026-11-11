import React, { useState } from 'react';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await onLoginSuccess(username.trim(), password);
      if (!res.success) {
        setError(res.message || 'Đăng nhập không thành công.');
      }
    } catch (err) {
      setError('Không thể kết nối đến máy chủ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        {/* Header / Brand */}
        <div className="login-header">
          <div className="login-brand-icon">
            <img
              src="/samples/Thales_STEM_logo_decal_trong_5000px.png"
              alt="Thales STEM"
              style={{ width: '54px', height: '54px', objectFit: 'contain', borderRadius: '12px' }}
            />
          </div>
          <h2>Trợ lý Chấm & Chữa Bài AI</h2>
          <p className="login-subtitle">
            Nền tảng hỗ trợ giáo viên đánh giá bài viết và quản lý lớp học
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="login-error-alert" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="login-username">Tên đăng nhập / Tài khoản</label>
            <div className="input-with-icon">
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập của bạn"
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Mật khẩu</label>
            <div className="input-with-icon">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="btn-toggle-pwd"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                style={{ fontSize: '13px', fontWeight: '500' }}
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-login-submit"
            disabled={loading}
          >
            {loading ? (
              <span>Đang xác thực...</span>
            ) : (
              <span>Đăng nhập hệ thống</span>
            )}
          </button>
        </form>

        <div className="login-footer">
          <small>
            Hệ thống phân quyền dành cho Quản trị viên và Giáo viên các trường
          </small>
        </div>
      </div>
    </div>
  );
}
