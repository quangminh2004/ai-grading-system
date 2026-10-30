import React from 'react';

const rubric = [
  {
    name: '1. Nội dung & chi tiết',
    max: 4,
    desc: 'Đúng yêu cầu tả cây; có chi tiết cụ thể về hình dáng, đặc điểm hoặc sự gắn bó.',
  },
  {
    name: '2. Sắp xếp ý',
    max: 2,
    desc: 'Các ý được kết nối và sắp xếp hợp lý trong đoạn văn.',
  },
  {
    name: '3. Từ ngữ & diễn đạt',
    max: 2,
    desc: 'Từ ngữ phù hợp; câu rõ nghĩa; có cách diễn đạt riêng.',
  },
  {
    name: '4. Chính tả & dấu câu',
    max: 2,
    desc: 'Viết đúng chính tả, viết hoa và sử dụng dấu câu phù hợp.',
  },
];

export default function RubricPage() {
  return (
    <div>
      <div className="pagehead">
        <div>
          <div className="eyebrow">
            TRỢ LÝ CHẤM CHỮA BÀI · HỆ THỐNG TIÊU CHÍ CHUẨN
          </div>
          <h1>Tiêu chí đánh giá đoạn văn miêu tả</h1>
          <p className="sub">
            Khung chấm điểm chuẩn môn Tiếng Việt Lớp 4 · Tổng điểm: 10 điểm.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', maxWidth: '1000px', width: '100%' }}>
        <div style={{ background: '#f5f7f2', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 6px 0', color: '#273822' }}>
            Đề bài: Viết đoạn văn ngắn miêu tả một cây bóng mát hoặc cây hoa/cây ăn quả
          </h3>
          <p style={{ margin: 0, color: '#556550', fontSize: '14px' }}>
            Áp dụng cho học sinh khối 4 theo định hướng phát triển phẩm chất và năng lực học sinh tiểu học.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {rubric.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderRadius: '8px',
                border: '1px solid #dce4d5',
                background: '#fff',
              }}
            >
              <div>
                <strong style={{ fontSize: '16px', color: '#273822' }}>{r.name}</strong>
                <p style={{ margin: '6px 0 0 0', color: '#687560', fontSize: '14px', lineHeight: '1.5' }}>
                  {r.desc}
                </p>
              </div>
              <div
                style={{
                  background: '#eef5ea',
                  color: '#2d6325',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  whiteSpace: 'nowrap',
                  marginLeft: '20px',
                }}
              >
                Tối đa {r.max}đ
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '24px', padding: '16px', background: '#fafbfa', borderRadius: '8px', border: '1px dashed #cbd6c5', fontSize: '13px', color: '#687560' }}>
          💡 <b>Ghi chú dành cho giáo viên:</b> Điểm số do AI đề xuất chỉ đóng vai trò tham khảo. Thầy cô có toàn quyền điều chỉnh điểm số từng tiêu chí và nhận xét trước khi nhấn phê duyệt.
        </div>
      </div>
    </div>
  );
}
