import writeXlsxFile from 'write-excel-file/browser';
import { buildApprovedGradesSheet, buildExportFileName } from './gradebookExportData';

/**
 * Xuất danh sách bài đã duyệt của lớp ra file Excel (.xlsx) và tải xuống trình duyệt.
 */
export async function exportApprovedGradesXlsx({ approvedStudents, classroom, currentClassId }) {
  const { sheetData, columns } = buildApprovedGradesSheet(approvedStudents, classroom?.rubric);
  const fileName = buildExportFileName(classroom, currentClassId);

  await writeXlsxFile(
    sheetData,
    {
      columns,
      sheet: 'Bảng điểm',
      stickyRowsCount: 1,
    },
    {
      fontFamily: 'Calibri',
      fontSize: 11,
    }
  ).toFile(fileName);

  return { fileName, count: approvedStudents.length };
}

