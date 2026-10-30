// ============================================================
//  data.js — Dữ liệu gốc & tiện ích dùng chung
//  Trợ lý Chấm Chữa Bài · Thanh Lân
// ============================================================

// ----- Tiện ích cơ bản -----

/** Rút gọn querySelector */
const $ = s => document.querySelector(s);

/** Escape ký tự HTML để tránh XSS */
const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));


// ----- Bộ tiêu chí chấm điểm -----

const rubric = [
  {
    name: 'Nội dung & chi tiết',
    max: 4,
    desc: 'Đúng yêu cầu tả cây; có chi tiết cụ thể về hình dáng, đặc điểm hoặc sự gắn bó.',
  },
  {
    name: 'Sắp xếp ý',
    max: 2,
    desc: 'Các ý được kết nối và sắp xếp hợp lý trong đoạn văn.',
  },
  {
    name: 'Từ ngữ & diễn đạt',
    max: 2,
    desc: 'Từ ngữ phù hợp; câu rõ nghĩa; có cách diễn đạt riêng.',
  },
  {
    name: 'Chính tả & dấu câu',
    max: 2,
    desc: 'Viết đúng chính tả, viết hoa và sử dụng dấu câu phù hợp.',
  },
];


// ----- Dữ liệu bài mẫu (seeds) -----

const seeds = [

  // HS01 - Nguyễn Minh An
  {
    id: 'HS01',
    color: 'peach',
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

  // HS02 - Trần Ngọc Bảo
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

  // HS03 - Lê Hà Chi
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

  // HS04 - Phạm Gia Huy (đã duyệt)
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

  // HS05 - Hoàng Khánh Linh
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

  // HS06 - Đỗ Đức Minh
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
