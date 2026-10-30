import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Class } from '../models/Class.js';
import { Student } from '../models/Student.js';
import { Assignment } from '../models/Assignment.js';
import { Submission } from '../models/Submission.js';

dotenv.config();

const sampleNames = [
  'Nguyễn Minh An', 'Trần Ngọc Bảo', 'Lê Hà Chi',
  'Phạm Gia Huy',   'Hoàng Khánh Linh', 'Đỗ Đức Minh',
];
const sampleTypes = ['png', 'pdf', 'jpg', 'png', 'pdf', 'jpg'];

const seeds = [
  {
    id: 'HS01',
    text: 'Ở góc xân trường em có một cây bàng rất to. Thân cây sần sùi, tán lá xanh như một chiếc ô khổng lồ. Giờ ra chơi, chúng em thường ngồi dưới gốc cây để đọc sách. Cây bàng chở che cho chúng em khỏi cái nắng mùa hè. Em rất yêu cây bàng vì cây đã gắn bó với chúng em qua bao ngày đến lớp.',
    scores: [3.5, 1.5, 1.5, 1.5],
    explain: [
      'Có hình dáng, hoạt động và tình cảm với cây.',
      'Mạch ý rõ; có thể thêm câu nối giữa tả cây và hoạt động.',
      'Có so sánh "chiếc ô khổng lồ"; một số từ cần chỉnh.',
      'Hai từ cần kiểm tra: "xân", "chở che".',
    ],
    errors: [
      ['Chính tả', 'xân trường', 'sân trường', 'Trong cụm chỉ sân của nhà trường, dùng "sân".'],
      ['Dùng từ / chính tả', 'chở che', 'che chở', 'Trong ngữ cảnh này, "che chở" là cách dùng phù hợp.'],
    ],
    strength: 'Miêu tả bằng hình ảnh so sánh và gắn với trải nghiệm thực tế.',
    evidence: '"tán lá xanh như một chiếc ô khổng lồ"; "ngồi dưới gốc cây để đọc sách"',
    support: 'Rà soát chính tả và kết nối ý giữa miêu tả với hoạt động.',
    activity: 'Gạch chân các từ bắt đầu bằng s/x; viết thêm một câu nối trước ý nói về giờ ra chơi.',
    feedback: 'Em đã giúp người đọc hình dung cây bàng qua hình ảnh chiếc ô khổng lồ. Em hãy kiểm tra lại "xân trường", "chở che" và thử thêm một câu nối trước phần kể về giờ ra chơi nhé.',
    state: 'suggested',
  },
  {
    id: 'HS02',
    text: 'Trước cửa lớp em có cây hoa giấy. Những cánh hoa mỏng như tờ giấy nhỏ, hồng rực trong nắng. Cành cây vươn lên giàn, đan vào nhau thành một mái che. Mỗi sáng, em cùng các bạn nhặt lá rụng và tưới nước cho cây. Nhìn những chùm hoa rung rinh, em thấy sân trường thật vui tươi.',
    scores: [4, 2, 1.5, 1.5],
    explain: [
      'Chi tiết rõ, có hành động chăm sóc và cảm xúc.',
      'Các ý được sắp xếp hợp lý.',
      'Có hình ảnh gợi tả; có thể làm rõ từ "vui tươi".',
      'Không có lỗi rõ trong mẫu; GV cần cân nhắc nâng điểm.',
    ],
    errors: [
      ['Gợi ý diễn đạt', 'sân trường thật vui tươi', 'sân trường như bừng sáng', 'Đây là lựa chọn tham khảo, không phải lỗi bắt buộc sửa. Giữ cách viết của em nếu phù hợp.'],
    ],
    strength: 'Chọn được chi tiết về màu sắc, hình dáng và hoạt động chăm sóc.',
    evidence: '"hồng rực trong nắng"; "nhặt lá rụng và tưới nước cho cây"',
    support: 'Thử diễn đạt cảm xúc cụ thể hơn nếu em muốn.',
    activity: 'Giải thích vì sao em dùng từ "vui tươi"; giữ hoặc tự chọn cách diễn đạt khác.',
    feedback: 'Em quan sát hoa giấy khá tinh tế và đã kể được việc mình làm để chăm sóc cây. Em có thể nói rõ hơn điều khiến sân trường trở nên "vui tươi".',
    state: 'suggested',
  },
  {
    id: 'HS03',
    text: 'Trường em có cây phượng. Cây rất cao. Lá cây rất xanh. Hoa phượng màu đỏ. Em thích cây phượng. Em thường chơi ở dưới cây.',
    scores: [2.5, 1, 1, 2],
    explain: [
      'Đúng đối tượng nhưng chi tiết còn chung.',
      'Các câu cùng chủ đề; liên kết còn ít.',
      'Lặp "cây", "rất"; câu khá ngắn.',
      'Không thấy lỗi chính tả rõ trong bài mẫu.',
    ],
    errors: [
      ['Liên kết câu', 'Cây rất cao. Lá cây rất xanh.', 'Cây phượng vươn cao, tán lá xanh che mát một góc sân.', 'Chỉ là ví dụ cho GV; nên đặt câu hỏi để học sinh tự viết lại bằng quan sát của mình.'],
    ],
    strength: 'Xác định đúng đối tượng và nêu được màu sắc lá, hoa.',
    evidence: '"Lá cây rất xanh. Hoa phượng màu đỏ."',
    support: 'Bổ sung chi tiết quan sát và kết nối các câu ngắn.',
    activity: 'Quan sát một bộ phận của cây; trả lời "giống vật gì?" hoặc "em nhìn thấy điều gì đặc biệt?" rồi tự viết lại hai câu.',
    feedback: 'Em đã tả đúng cây phượng. Em thử chọn một bộ phận em thích nhất và kể thêm một chi tiết mà em thật sự nhìn thấy nhé.',
    state: 'suggested',
  },
  {
    id: 'HS04',
    text: 'Cây xoài nhà bà em đứng cạnh bờ ao. Lá xoài dài, xanh thẫm. Mùa hè, những quả xoài vàng ươm lấp ló sau tán lá. Bà thường hái cho em một quả chín. Mùi xoài thơm ngọt làm em nhớ những buổi chiều ở bên bà.',
    scores: [3.5, 2, 2, 2],
    explain: [
      'Có đặc điểm cây và trải nghiệm riêng.',
      'Ý tả và ý kể kết nối mạch lạc.',
      'Từ ngữ gợi cảm, có cảm xúc.',
      'Không thấy lỗi rõ trong bài mẫu.',
    ],
    errors: [],
    strength: 'Gắn chi tiết miêu tả với kỷ niệm và cảm xúc riêng.',
    evidence: '"vàng ươm lấp ló"; "nhớ những buổi chiều ở bên bà"',
    support: 'Có thể thêm một chi tiết về thân hoặc tán cây nếu phù hợp dung lượng.',
    activity: 'Đọc lại đoạn văn và chọn một câu em tâm đắc; giải thích vì sao.',
    feedback: 'Đoạn văn có hình ảnh và kỷ niệm riêng của em. Câu kết giúp người đọc cảm nhận được tình cảm em dành cho bà.',
    state: 'approved',
    teacherScores: [3.5, 2, 2, 2],
    teacherFeedback: 'Đoạn văn có chi tiết chọn lọc, diễn đạt rõ và thể hiện tình cảm riêng. Em tiếp tục phát huy nhé.',
    reason: 'Ví dụ minh họa một bài đã được giáo viên duyệt.',
  },
  {
    id: 'HS05',
    text: 'Cây chuối trong vườn có thân mềm và lá to. Mỗi khi gió thổi những tàu lá lại đung đưa. Em thấy buồng chuối có rất nhiều quả em thích ăn chuối vì chuối rất ngon. Em sẽ chăm sóc cây chuối.',
    scores: [3, 1, 1.5, 1],
    explain: [
      'Có đặc điểm thân, lá và quả.',
      'Chuyển ý còn đột ngột ở phần nói về quả.',
      'Có động từ miêu tả; còn lặp từ.',
      'Một số câu thiếu dấu câu.',
    ],
    errors: [
      ['Dấu câu', 'Mỗi khi gió thổi những tàu lá', 'Mỗi khi gió thổi, những tàu lá', 'Thêm dấu phẩy sau phần nêu hoàn cảnh.'],
      ['Tách câu', 'rất nhiều quả em thích ăn chuối', 'rất nhiều quả. Em thích ăn chuối', 'Hai ý cần được ngắt để người đọc dễ theo dõi.'],
    ],
    strength: 'Nêu được một số bộ phận và chuyển động của lá.',
    evidence: '"những tàu lá lại đung đưa"',
    support: 'Ngắt câu, dùng dấu phẩy và giảm lặp từ.',
    activity: 'Đọc thành tiếng đoạn văn, đánh dấu chỗ cần dừng rồi tự đặt dấu câu.',
    feedback: 'Em đã chú ý đến chuyển động của lá chuối. Em hãy đọc chậm câu nói về buồng chuối và tìm chỗ cần dừng để bổ sung dấu câu nhé.',
    state: 'suggested',
  },
  {
    id: 'HS06',
    text: 'Cây me ở đầu ngõ có những chiếc lá bé xíu. Chiều nào em cũng nghe tiếng chim ríu rít trên cành. Những chùm quả cong cong đung đưa trong gió. Em mong cây luôn xanh tốt để đầu ngõ có bóng mát.',
    scores: [3.5, 1.5, 1.5, 2],
    explain: [
      'Có lá, quả, âm thanh và mong muốn riêng.',
      'Mạch ý nhìn chung rõ.',
      'Từ ngữ phù hợp, có chi tiết gợi tả.',
      'Không thấy lỗi rõ trong bài mẫu.',
    ],
    errors: [],
    strength: 'Quan sát được cả hình ảnh và âm thanh quanh cây.',
    evidence: '"lá bé xíu"; "tiếng chim ríu rít"',
    support: 'Có thể làm rõ thêm hình dáng cây hoặc vị trí quan sát.',
    activity: 'Viết một câu giới thiệu hình dáng cây me theo quan sát của em.',
    feedback: 'Em đã dùng cả hình ảnh và âm thanh để tả cây me. Em thử thêm một chi tiết về dáng cây để người đọc hình dung rõ hơn nhé.',
    state: 'new',
  },
];

export async function runSeed() {
  await connectDB();

  console.log('🌱 Đang dọn dẹp và nạp dữ liệu mẫu ban đầu vào MongoDB Atlas...');
  await Class.deleteMany({});
  await Student.deleteMany({});
  await Assignment.deleteMany({});
  await Submission.deleteMany({});

  // 1. Tạo Tài khoản Mẫu (Admin & Giáo viên các trường)
  console.log('👤 Đang khởi tạo tài khoản Admin và Giáo viên...');
  // Chỉ xóa và tạo lại nếu chưa có hoặc cập nhật
  await User.deleteMany({ username: { $in: ['admin', 'cothanhlan', 'codichvong', 'cobaotram'] } });

  const adminUser = new User({
    username: 'admin',
    password: 'admin@123',
    fullName: 'Quản trị viên Hệ thống',
    role: 'admin',
    school: 'Phòng Giáo dục & Đào tạo',
    email: 'admin@giaoduc.edu.vn',
    phone: '0901234567',
    active: true,
  });
  await adminUser.save();

  const teacherThanhLan = new User({
    username: 'cothanhlan',
    password: '123456',
    fullName: 'Cô Trần Thị Mai',
    role: 'teacher',
    school: 'Trường Tiểu học Thanh Lân',
    email: 'maitt@thanhlan.edu.vn',
    phone: '0912345678',
    active: true,
    assignedClasses: ['4A', '4B'],
    createdBy: 'admin',
  });
  await teacherThanhLan.save();

  const teacherDichVong = new User({
    username: 'codichvong',
    password: '123456',
    fullName: 'Cô Nguyễn Minh Hằng',
    role: 'teacher',
    school: 'Trường Tiểu học Dịch Vọng A',
    email: 'hangnm@dichvong.edu.vn',
    phone: '0987654321',
    active: true,
    assignedClasses: ['4C'],
    createdBy: 'admin',
  });
  await teacherDichVong.save();

  const teacherBaoTram = new User({
    username: 'cobaotram',
    password: '123456',
    fullName: 'Cô Lê Bảo Trâm',
    role: 'teacher',
    school: 'Trường Tiểu học Chu Văn An',
    email: 'tramlb@chuvanan.edu.vn',
    phone: '0934567890',
    active: true,
    assignedClasses: ['4D'],
    createdBy: 'admin',
  });
  await teacherBaoTram.save();

  console.log('✅ Đã tạo 1 Admin (admin) và 3 Giáo viên (cothanhlan, codichvong, cobaotram)');

  // 2. Tạo Assignment mặc định
  const assignment = await Assignment.create({
    title: 'Viết đoạn văn ngắn miêu tả một cây bóng mát hoặc cây hoa/cây ăn quả',
    subject: 'Tiếng Việt 4',
    grade: '4',
  });
  console.log(`✅ Đã tạo Assignment: "${assignment.title}"`);

  // 3. Tạo các Lớp học cho nhiều trường khác nhau
  const class4A = await Class.create({
    classId: '4A',
    label: 'Lớp 4A - Thanh Lân',
    grade: '4',
    academicYear: '2026-2027',
    school: 'Trường Tiểu học Thanh Lân',
    teacherUsername: 'cothanhlan',
  });

  const class4B = await Class.create({
    classId: '4B',
    label: 'Lớp 4B - Thanh Lân',
    grade: '4',
    academicYear: '2026-2027',
    school: 'Trường Tiểu học Thanh Lân',
    teacherUsername: 'cothanhlan',
  });

  const class4C = await Class.create({
    classId: '4C',
    label: 'Lớp 4C - Dịch Vọng A',
    grade: '4',
    academicYear: '2026-2027',
    school: 'Trường Tiểu học Dịch Vọng A',
    teacherUsername: 'codichvong',
  });

  const class4D = await Class.create({
    classId: '4D',
    label: 'Lớp 4D - Chu Văn An',
    grade: '4',
    academicYear: '2026-2027',
    school: 'Trường Tiểu học Chu Văn An',
    teacherUsername: 'cobaotram',
  });
  console.log('✅ Đã tạo các lớp mẫu thuộc nhiều trường: 4A, 4B, 4C, 4D');

  // 4. Tạo học sinh và bài nộp cho 4A (Thanh Lân)
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    const name = sampleNames[i];
    const type = sampleTypes[i];
    const mime = type === 'pdf' ? 'application/pdf' : type === 'png' ? 'image/png' : 'image/jpeg';

    await Student.create({
      studentId: s.id,
      name,
      classId: '4A',
    });

    await Submission.create({
      studentId: s.id,
      classId: '4A',
      assignmentId: assignment._id,
      state: s.state,
      text: s.text,
      scores: s.scores,
      explain: s.explain,
      errors: s.errors,
      strength: s.strength,
      evidence: s.evidence,
      support: s.support,
      activity: s.activity,
      feedback: s.feedback,
      teacherScores: s.teacherScores || null,
      teacherFeedback: s.teacherFeedback || '',
      reason: s.reason || '',
      attachments: [
        {
          key: `sample-${s.id}`,
          name: `${name}.${type}`,
          type: mime,
          sampleUrl: `/samples/${s.id}.${type}`,
        },
      ],
      sample: true,
      custom: false,
    });
  }
  console.log('✅ Đã nạp 6 học sinh và bài mẫu lớp 4A');

  // 5. Tạo học sinh cho 4B (Thanh Lân)
  const students4B = ['Bùi Minh Anh', 'Nguyễn Hải Đăng', 'Trần Tuệ Lâm', 'Lê Bảo Ngọc'];
  for (let i = 0; i < students4B.length; i++) {
    const studentId = `HS${String(i + 1).padStart(2, '0')}`;
    await Student.create({
      studentId,
      name: students4B[i],
      classId: '4B',
    });

    await Submission.create({
      studentId,
      classId: '4B',
      assignmentId: assignment._id,
      state: 'new',
      text: '',
      scores: [],
      explain: [],
      errors: [],
      attachments: [],
      custom: true,
      sample: false,
    });
  }
  console.log('✅ Đã nạp 4 học sinh lớp 4B');

  // 6. Tạo học sinh và bài nộp mẫu cho 4C (Dịch Vọng A)
  const students4C = [
    { id: 'HS01', name: 'Nguyễn Văn Nam' },
    { id: 'HS02', name: 'Trần Quỳnh Chi' },
    { id: 'HS03', name: 'Lê Hoàng Long' },
  ];
  for (const std of students4C) {
    await Student.create({
      studentId: std.id,
      name: std.name,
      classId: '4C',
    });

    await Submission.create({
      studentId: std.id,
      classId: '4C',
      assignmentId: assignment._id,
      state: 'suggested',
      text: 'Vườn trường em có cây hoa sữa tỏa hương thơm ngát mỗi độ thu về. Tán cây cao vút, lá xanh mơn mởn che bóng mát cả khoảng sân.',
      scores: [3.5, 2, 1.5, 2],
      explain: ['Đúng đối tượng miêu tả', 'Mạch ý tự nhiên', 'Từ ngữ gợi cảm xúc tốt', 'Chính tả chuẩn xác'],
      errors: [],
      strength: 'Gợi tả được hương thơm đặc trưng của hoa sữa mùa thu.',
      evidence: '"tỏa hương thơm ngát mỗi độ thu về"',
      support: 'Bổ sung thêm hoạt động của học sinh dưới bóng mát cây.',
      activity: 'Viết thêm câu miêu tả hoạt động vui chơi của em và các bạn quanh cây.',
      feedback: 'Bài viết rất giàu cảm xúc, văn phong trong sáng. Cô khen em nhé!',
      attachments: [],
      custom: true,
      sample: false,
    });
  }
  console.log('✅ Đã nạp 3 học sinh lớp 4C (Trường Dịch Vọng A)');

  // 7. Tạo học sinh cho 4D (Chu Văn An)
  const students4D = ['Chu Đức Huy', 'Vũ Thảo Vy'];
  for (let i = 0; i < students4D.length; i++) {
    const studentId = `HS${String(i + 1).padStart(2, '0')}`;
    await Student.create({
      studentId,
      name: students4D[i],
      classId: '4D',
    });
    await Submission.create({
      studentId,
      classId: '4D',
      assignmentId: assignment._id,
      state: 'new',
      text: '',
      scores: [],
      explain: [],
      errors: [],
      attachments: [],
      custom: true,
      sample: false,
    });
  }
  console.log('✅ Đã nạp 2 học sinh lớp 4D (Trường Chu Văn An)');

  console.log('🎉 NẠP DỮ LIỆU ĐA TRƯỜNG & PHÂN QUYỀN VÀO MONGODB ATLAS THÀNH CÔNG RỰC RỠ!');
}

if (process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Lỗi khi seed:', err);
      process.exit(1);
    });
}
