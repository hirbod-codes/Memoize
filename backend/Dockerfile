FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS dependencies
RUN npm install

FROM base AS production-dependencies
RUN npm install --omit=dev

FROM dependencies AS development
ENV NODE_ENV=development
COPY . .
RUN chmod +x ./src/ffmpeg-7.0.2-amd64-static/ffmpeg
RUN chmod +x ./src/ffmpeg-7.0.2-amd64-static/ffprobe
RUN chmod +x ./src/ffmpeg-7.0.2-amd64-static/qt-faststart
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM production-dependencies AS production-build
COPY . .
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
COPY ./src/ffmpeg-7.0.2-amd64-static/ ./src/ffmpeg-7.0.2-amd64-static/
RUN chmod +x ./src/ffmpeg-7.0.2-amd64-static/ffmpeg
RUN chmod +x ./src/ffmpeg-7.0.2-amd64-static/ffprobe
RUN chmod +x ./src/ffmpeg-7.0.2-amd64-static/qt-faststart
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-build /app/dist ./dist
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
