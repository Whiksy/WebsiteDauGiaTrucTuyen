// ⚠️ CẤU HÌNH ĐƯỜNG DẪN PUBLIC (NGROK) TẠI ĐÂY
// Khi chạy lại ngrok, chỉ cần thay đổi dòng này là xong.
const BASE_URL = "https://b6f1e5322cad.ngrok-free.app";

module.exports = {
  "PublicUrl": BASE_URL,
  "ConnectionStrings": {
    "DefaultConnection": {
      "server": "localhost",
      "port": 1433,
      "database": "AuctionDB",
      "user": "AuctionUser",
      "password": "Aimabiet123",
      "options": {
        "encrypt": false,
        "trustServerCertificate": true
      }
    }
  },
  "Jwt": {
    "Secret": "nguyenduy"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "Session": {
    "IdleTimeout": "30",
    "CookieHttpOnly": true,
    "CookieIsEssential": true
  },
  "Momo": {
    "PartnerCode": "MOMOBKUN20180529",
    "AccessKey": "klm05TvNBzhg7h7j",
    "SecretKey": "at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa",
    "Endpoint": "https://test-payment.momo.vn/v2/gateway/api/create",
    "ReturnUrl": `${BASE_URL}/payment/success`,
    "NotifyUrl": `${BASE_URL}/api/payment/ipn`
  },
  "Gmail": {
    "SmtpServer": "smtp.gmail.com",
    "Port": 587,
    "Username": "whisky3z04@gmail.com",
    "Password": "obzwlfswawsuvkrh"
  }
};