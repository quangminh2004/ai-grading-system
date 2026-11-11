import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import writeXlsxFile from 'write-excel-file/node';
import {
  buildApprovedGradesSheet,
  buildExportFileName,
} from '../src/utils/gradebookExportData.js';

describe('buildExportFileName', () => {
  test('tạo tên file .xlsx đầy đủ tên trường, lớp và ngày', () => {
    const fileName = buildExportFileName(
      { school: 'Trường Tiểu học Chu Văn An' },
      '4D',
      new Date('2026-11-11T03:00:00Z')
    );
    assert.equal(fileName, 'Bang_Diem_Trường_Tiểu_học_Chu_Văn_An_4D_2026-11-11.xlsx');
  });

  test('làm sạch ký tự không hợp lệ cho tên file trên Windows', () => {
    const fileName = buildExportFileName(
      { school: 'Trường A/B:1' },
      'Lớp 4D*?',
      new Date('2026-11-11T03:00:00Z')
    );
    assert.ok(fileName.endsWith('.xlsx'));
    assert.equal(/[\\/:*?"<>|]/.test(fileName), false);
  });
});

describe('buildApprovedGradesSheet', () => {
  test('tạo bảng điểm XLSX đúng tiêu đề, điểm số dạng Number và nhận xét tiếng Việt', () => {
    const approvedStudents = [
      {
        id: 'HS01',
        name: 'Nguyễn Minh Anh',
        teacherScores: [3.5, 1.75, 1.5, 1.75],
        scores: [3, 1.5, 1.5, 1.5],
        teacherFeedback: 'Bài viết giàu cảm xúc, dùng từ gợi tả tốt.',
        feedback: 'Nhận xét AI',
      },
      {
        id: 'HS02',
        name: 'Vũ Thảo Vy',
        teacherScores: null,
        scores: [3, 2, 1.5, 1.5],
        teacherFeedback: '',
        feedback: 'Cần chú ý dấu câu ở đoạn kết.',
      },
    ];

    const { sheetData, columns } = buildApprovedGradesSheet(approvedStudents, null);

    assert.equal(sheetData.length, 3);
    assert.equal(columns.length, 8);

    const headers = sheetData[0].map((c) => c.value);
    assert.deepEqual(headers, [
      'Mã HS',
      'Họ và tên',
      'Nội dung & chi tiết (/4)',
      'Sắp xếp ý & bố cục (/2)',
      'Từ ngữ & diễn đạt (/2)',
      'Chính tả & dấu câu (/2)',
      'Tổng điểm (/10)',
      'Nhận xét của giáo viên',
    ]);

    const row1 = sheetData[1];
    assert.equal(row1[0].value, 'HS01');
    assert.equal(row1[2].type, Number);
    assert.equal(row1[2].value, 3.5);
    assert.equal(row1[6].type, Number);
    assert.equal(row1[6].value, 8.5);
    assert.equal(row1[7].value, 'Bài viết giàu cảm xúc, dùng từ gợi tả tốt.');

    const row2 = sheetData[2];
    assert.equal(row2[0].value, 'HS02');
    assert.equal(row2[6].value, 8);
    assert.equal(row2[7].value, 'Cần chú ý dấu câu ở đoạn kết.');
  });

  test('bài chấm theo bộ tiêu chí cũ (khác số tiêu chí) để trống cột chi tiết và vẫn giữ tổng điểm', () => {
    const customRubric = [
      { name: 'Ý chính', max: 6 },
      { name: 'Trình bày', max: 4 },
    ];
    const approvedStudents = [
      {
        id: 'HS03',
        name: 'Lê Hoàng Nam',
        teacherScores: [3, 2, 1.5, 1.5],
        teacherFeedback: 'Đạt yêu cầu',
      },
    ];

    const { sheetData, columns } = buildApprovedGradesSheet(approvedStudents, customRubric);
    assert.equal(columns.length, 6);
    const row = sheetData[1];
    assert.equal(row[2].value, '');
    assert.equal(row[3].value, '');
    assert.equal(row[4].value, 8);
  });

  test('xuất ra buffer .xlsx hợp lệ qua write-excel-file', async () => {
    const { sheetData, columns } = buildApprovedGradesSheet(
      [
        {
          id: 'HS01',
          name: 'Vũ Thảo Vy',
          teacherScores: [3.5, 2, 1.75, 1.75],
          teacherFeedback: 'Chữ viết sạch đẹp, ý rõ ràng.',
        },
      ],
      null
    );

    const buffer = await writeXlsxFile(
      sheetData,
      { columns, sheet: 'Bảng điểm', stickyRowsCount: 1 },
      { fontFamily: 'Calibri', fontSize: 11 }
    ).toBuffer();

    assert.equal(Buffer.isBuffer(buffer), true);
    assert.ok(buffer.length > 500);
    // File .xlsx là archive ZIP bắt đầu bằng 'PK\x03\x04'
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
    assert.equal(buffer[2], 0x03);
    assert.equal(buffer[3], 0x04);
  });
});

