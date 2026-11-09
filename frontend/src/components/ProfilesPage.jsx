import React, { useState } from 'react';

export default function ProfilesPage({ classroom, students }) {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || '');
  const activeStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  return (
    <div>
      <div className="pagehead">
        <div>
          <div className="eyebrow">
            TRỢ LÝ CHẤM CHỮA BÀI · HỒ SƠ NĂNG LỰC
          </div>
          <h1>Hồ sơ học tập theo từng học sinh</h1>
          <p className="sub">
            Tổng hợp điểm mạnh, dẫn chứng thực tế và định hướng bồi dưỡng của học sinh {classroom?.label}.
          </p>
        </div>
      </div>

      <div className="profile-grid">
        {/* Student Selector */}
        <div className="card" style={{ padding: '16px' }}>
          <h4>Chọn học sinh</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', maxHeight: '550px', overflowY: 'auto' }}>
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStudentId(s.id)}
                className={`student ${selectedStudentId === s.id ? 'selected' : ''}`}
                style={{ textAlign: 'left', width: '100%' }}
              >
                <span className="avatar small">{s.id.slice(-2)}</span>
                <div>
                  <strong>{s.name}</strong>
                  <div style={{ fontSize: '12px', color: '#7a8670' }}>{s.id}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Profile Details */}
        {activeStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <span className="avatar" style={{ width: '48px', height: '48px', fontSize: '18px' }}>
                  {activeStudent.id.slice(-2)}
                </span>
                <div>
                  <h2 style={{ margin: 0 }}>{activeStudent.name}</h2>
                  <div style={{ color: '#7a8670', fontSize: '14px' }}>
                    Mã học sinh: <b>{activeStudent.id}</b> · {classroom?.label}
                  </div>
                </div>
              </div>

              <div className="profile-strengths-grid">
                <div style={{ background: '#f5faf2', padding: '16px', borderRadius: '8px', border: '1px solid #d4e6cd' }}>
                  <h4 style={{ color: '#2d6325', marginBottom: '8px' }}>Điểm mạnh ghi nhận</h4>
                  <p style={{ lineHeight: '1.6' }}>{activeStudent.strength || 'Chưa có dữ liệu bài làm'}</p>
                  {activeStudent.evidence && (
                    <div style={{ marginTop: '12px', fontSize: '13px', color: '#4d6148', background: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e2ebd9' }}>
                      <b>Dẫn chứng trong bài:</b> {activeStudent.evidence}
                    </div>
                  )}
                </div>

                <div style={{ background: '#fff9f0', padding: '16px', borderRadius: '8px', border: '1px solid #f2dfc2' }}>
                  <h4 style={{ color: '#8a5c1b', marginBottom: '8px' }}>Nội dung cần hỗ trợ rèn luyện</h4>
                  <p style={{ lineHeight: '1.6' }}>{activeStudent.support || 'Chưa có ghi nhận'}</p>
                </div>
              </div>

              <div style={{ marginTop: '16px', background: '#f4f6fa', padding: '16px', borderRadius: '8px', border: '1px solid #d9e1ee' }}>
                <h4 style={{ color: '#2a4c82', marginBottom: '8px' }}>Hoạt động tiếp theo</h4>
                <p style={{ lineHeight: '1.6' }}>{activeStudent.activity || 'Tiếp tục theo dõi và luyện tập theo chương trình'}</p>
              </div>

              {activeStudent.feedback && (
                <div style={{ marginTop: '16px', background: '#f8faf6', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #3d6333' }}>
                  <h4 style={{ color: '#273822', marginBottom: '8px' }}>Lời nhận xét chính thức</h4>
                  <p style={{ margin: 0, fontStyle: 'italic', lineHeight: '1.6' }}>
                    "{activeStudent.teacherFeedback || activeStudent.feedback}"
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
