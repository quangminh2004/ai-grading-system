import React from 'react';

const rubric = [
  {
    name: '1. Nội dung & chi tiết',
    max: 4,
    desc: 'Đúng trọng tâm yêu cầu bài viết; có chi tiết cụ thể, hình ảnh sinh động hoặc cảm xúc, suy nghĩ chân thực.',
  },
  {
    name: '2. Sắp xếp ý & bố cục',
    max: 2,
    desc: 'Bố cục rõ ràng (Mở bài/Mở đoạn - Thân bài/Thân đoạn - Kết bài/Kết đoạn); các câu văn liên kết mạch lạc, chặt chẽ.',
  },
  {
    name: '3. Từ ngữ & diễn đạt',
    max: 2,
    desc: 'Sử dụng từ ngữ gợi cảm, giàu hình ảnh; câu văn rõ nghĩa, gãy gọn; diễn đạt tự nhiên và có nét sáng tạo riêng.',
  },
  {
    name: '4. Chính tả & dấu câu',
    max: 2,
    desc: 'Viết đúng chính tả tiếng Việt, đúng quy tắc viết hoa và sử dụng các dấu câu chuẩn xác.',
  },
];

export default function RubricPage() {
  return (
    <div>
      <div className="pagehead">
        <div>
          <div className="eyebrow">
            TRỢ LÝ CHẤM CHỮA BÀI · TIÊU CHÍ ĐÁNH GIÁ CHUẨN
          </div>
          <h1>Khung tiêu chí đánh giá bài viết &amp; Tập làm văn</h1>
          <p className="sub">
            Khung chấm điểm chuẩn môn Tiếng Việt Tiểu học (Áp dụng linh hoạt cho mọi đề bài) · Thang điểm chuẩn: 10 điểm
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', maxWidth: '1000px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#233a35', fontWeight: '700' }}>
            4 Tiêu chí đánh giá bài làm học sinh (Tổng 10 điểm)
          </h3>
          <span style={{ fontSize: '13px', color: '#687560' }}>
            Chuẩn môn Tiếng Việt Tiểu học
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {rubric.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '18px 22px',
                borderRadius: '8px',
                border: '1.5px solid #dce4d5',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ flex: 1, paddingRight: '20px' }}>
                <strong style={{ fontSize: '16.5px', color: '#273822' }}>{r.name}</strong>
                <p style={{ margin: '6px 0 0 0', color: '#556550', fontSize: '14.5px', lineHeight: '1.6' }}>
                  {r.desc}
                </p>
              </div>
              <div
                style={{
                  background: '#eef5ea',
                  color: '#2d6325',
                  padding: '8px 18px',
                  borderRadius: '20px',
                  fontWeight: '700',
                  fontSize: '16px',
                  whiteSpace: 'nowrap',
                  border: '1px solid #c9dec1',
                }}
              >
                Tối đa {r.max}đ
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: '24px',
            padding: '16px 18px',
            background: '#fafbfa',
            borderRadius: '8px',
            border: '1px dashed #cbd6c5',
            fontSize: '13.5px',
            color: '#556550',
            lineHeight: '1.7',
          }}
        >
          <b>Ghi chú dành cho giáo viên:</b> Điểm số và nhận xét do AI đề xuất đóng vai trò hỗ trợ tham khảo. Thầy cô có toàn quyền điều chỉnh điểm từng tiêu chí và nhận xét sư phạm trước khi phê duyệt bài cho học sinh.
        </div>
      </div>
    </div>
  );
}
