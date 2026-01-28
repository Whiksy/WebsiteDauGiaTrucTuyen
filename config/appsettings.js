module.exports = {
  "PublicUrl": "https://9e0109500c52.ngrok-free.app", // ⚠️ Dán link Ngrok mới vào đây (VD: https://abcd-1234.ngrok-free.app)
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
    "PartnerCode": "MOMO9FT020240115",
    "AccessKey": "OwlqGx8A2OsOcKvS",
    "SecretKey": "WWe36VM2oioPdUu1vS0IpW5Man0geQW8",
    "Endpoint": "https://payment.momo.vn/v2/gateway/api/create",
    "ReturnUrl": "https://049300cc46cf.ngrok-free.app/Booking/PaymentSuccess",
    "NotifyUrl": "https://049300cc46cf.ngrok-free.app/api/momo/notify"
  },
  "Gmail": {
    "SmtpServer": "smtp.gmail.com",
    "Port": 587,
    "Username": "whisky3z04@gmail.com",
    "Password": "obzwlfswawsuvkrh"
  }
};