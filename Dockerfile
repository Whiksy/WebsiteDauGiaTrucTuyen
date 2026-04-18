FROM node:20-alpine

WORKDIR /app

# Chỉ copy package files trước để tối ưu hóa Docker Layer Caching
COPY package*.json ./

# Cài đặt thư viện (Chỉ dùng cho môi trường production)
RUN npm install --only=production

# Copy toàn bộ mã nguồn vào image
COPY . .

EXPOSE 3000

CMD ["npm", "start"]