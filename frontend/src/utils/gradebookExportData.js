import { getRubric, rubricMaxTotal } from './rubric.js';

const HEADER_STYLE = {
  fontWeight: 'bold',
  textColor: '#273822',
  backgroundColor: '#EAF4E6',
  borderColor: '#B8CEAD',
  align: 'center',
  alignVertical: 'center',
  wrap: true,
};

const DATA_BORDER_COLOR = '#DCE5D6';

const sanitizeFileSegment = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[\\/:*?"<>|]+/g, '_');

const roundScore = (value) => Math.round(Number(value) * 100) / 100;

/**
 * Tạo tên file .xlsx cho bảng điểm đã duyệt của lớp.
 */
export function buildExportFileName(classroom, currentClassId, date = new Date()) {
  const schoolPart = classroom?.school ? `${sanitizeFileSegment(classroom.school)}_` : '';
  const classPart = sanitizeFileSegment(currentClassId || 'Lop');
  const datePart = date.toISOString().slice(0, 10);
  return `Bang_Diem_${schoolPart}${classPart}_${datePart}.xlsx`;
}

/**
 * Chuẩn hóa dữ liệu bảng điểm các bài đã duyệt sang cấu trúc sheetData + columns cho write-excel-file.
 */
export function buildApprovedGradesSheet(approvedStudents, rawClassRubric) {
  const classRubric = getRubric(rawClassRubric);
  const classMax = rubricMaxTotal(classRubric);

  const rubricHeaderLabels = classRubric.map((r) => `${r.name} (/${r.max})`);
  const totalHeaderLabel = `Tổng điểm (/${classMax})`;

  const headerRow = [
    { value: 'Mã HS', ...HEADER_STYLE },
    { value: 'Họ và tên', ...HEADER_STYLE },
    ...rubricHeaderLabels.map((label) => ({ value: label, ...HEADER_STYLE })),
    { value: totalHeaderLabel, ...HEADER_STYLE },
    { value: 'Nhận xét của giáo viên', ...HEADER_STYLE },
  ];

  const dataRows = approvedStudents.map((s) => {
    const sc = s.teacherScores?.length ? s.teacherScores : (s.scores || []);
    const sum = sc.reduce((a, b) => a + (Number(b) || 0), 0);
    // Bài chấm theo bộ tiêu chí khác số lượng → không xếp vào cột chi tiết để tránh lệch
    const sameShape = sc.length === classRubric.length;

    const scoreCells = classRubric.map((_, i) => {
      if (!sameShape || sc[i] === undefined || sc[i] === null || sc[i] === '') {
        return {
          type: String,
          value: '',
          align: 'center',
          alignVertical: 'center',
          borderColor: DATA_BORDER_COLOR,
        };
      }
      const num = Number(sc[i]);
      if (!Number.isFinite(num)) {
        return {
          type: String,
          value: '',
          align: 'center',
          alignVertical: 'center',
          borderColor: DATA_BORDER_COLOR,
        };
      }
      return {
        type: Number,
        value: roundScore(num),
        align: 'center',
        alignVertical: 'center',
        borderColor: DATA_BORDER_COLOR,
      };
    });

    return [
      {
        type: String,
        value: String(s.id ?? ''),
        format: '@',
        align: 'center',
        alignVertical: 'center',
        borderColor: DATA_BORDER_COLOR,
      },
      {
        type: String,
        value: String(s.name ?? ''),
        align: 'left',
        alignVertical: 'center',
        borderColor: DATA_BORDER_COLOR,
      },
      ...scoreCells,
      {
        type: Number,
        value: roundScore(sum),
        fontWeight: 'bold',
        align: 'center',
        alignVertical: 'center',
        borderColor: DATA_BORDER_COLOR,
      },
      {
        type: String,
        value: String(s.teacherFeedback || s.feedback || ''),
        align: 'left',
        alignVertical: 'center',
        wrap: true,
        borderColor: DATA_BORDER_COLOR,
      },
    ];
  });

  const columns = [
    { width: 12 },
    { width: 28 },
    ...rubricHeaderLabels.map((label) => ({
      width: Math.max(18, Math.min(34, label.length + 4)),
    })),
    { width: 18 },
    { width: 52 },
  ];

  return {
    sheetData: [headerRow, ...dataRows],
    columns,
  };
}

