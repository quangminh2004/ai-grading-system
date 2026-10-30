# Sử dụng Node.js LTS
FROM node:20-alpine

WORKDIR /app

# Sao chép package descriptors
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Cài đặt dependencies backend và build frontend
RUN cd backend && npm install --production
RUN cd frontend && npm install

# Sao chép toàn bộ mã nguồn
COPY . .

# Build frontend production bundle
RUN cd frontend && npm run build && cd .. && cp -r frontend/dist dist

# Môi trường chạy
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Khởi chạy máy chủ Node.js phục vụ cả API và giao diện Web SPA
CMD ["node", "backend/src/server.js"]

