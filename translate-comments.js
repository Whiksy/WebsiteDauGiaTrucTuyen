const fs = require('fs');
const path = require('path');
const root = path.join(process.cwd(), 'src');

function readFiles(dir) {
  const all = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) all.push(...readFiles(p));
    else if (f.isFile() && f.name.endsWith('.js')) all.push(p);
  }
  return all;
}

const files = readFiles(root);
let converted = 0;

const map = [
  ['Start the server', 'Khởi động máy chủ'],
  ['Create Express app', 'Tạo ứng dụng Express'],
  ['Connect to database', 'Kết nối cơ sở dữ liệu'],
  ['Database Connection Manager', 'Trình quản lý kết nối cơ sở dữ liệu'],
  ['Configuration Manager - Loads and validates environment variables', 'Trình quản lý cấu hình - Tải và xác thực biến môi trường'],
  ['All secrets should be in .env, never hardcoded', 'Tất cả bí mật nên ở trong .env, không hardcode'],
  ['Load configuration from environment variables', 'Tải cấu hình từ biến môi trường'],
  ['Validate critical configuration values', 'Xác thực các giá trị cấu hình quan trọng'],
  ['Logger Service - Centralized logging with levels and formatting', 'Dịch vụ ghi nhật ký - Ghi nhật ký tập trung theo cấp độ và định dạng'],
  ['Supports: DEBUG, INFO, WARN, ERROR', 'Hỗ trợ: DEBUG, INFO, WARN, ERROR'],
  ['Check if log level is enabled', 'Kiểm tra xem cấp độ log có được bật chưa'],
  ['Format log message with timestamp and context', 'Định dạng thông báo log với timestamp và bối cảnh'],
  ['Debug level logging', 'Ghi log cấp DEBUG'],
  ['Info level logging', 'Ghi log cấp INFO'],
  ['Warning level logging', 'Ghi log cấp WARN (Cảnh báo)'],
  ['Error level logging', 'Ghi log cấp ERROR (Lỗi)'],
  ['Get child logger with extended context', 'Lấy child logger với bối cảnh mở rộng'],
  ['Request logging middleware', 'Middleware ghi nhật ký yêu cầu'],
  ['Request timing middleware', 'Middleware ghi thời gian phản hồi'],
  ['Unauthorized', 'Không được phép'],
  ['Not Found', 'Không tìm thấy'],
  ['Forbidden', 'Bị cấm']
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  for (const [from, to] of map) {
    newContent = newContent.split(from).join(to);
  }
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    converted++;
  }
}
console.log(`Đã xử lý ${files.length} file, đã chuyển ${converted} file.`);
