FROM node:22-alpine AS build
WORKDIR /app
COPY ./frontend/package.json ./
COPY ./frontend/package-lock.json ./
RUN npm install
COPY ./frontend/ ./
RUN npm run build

FROM nginx:alpine AS production
RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist /usr/share/nginx/html
COPY ./Nginx/nginx.conf /etc/nginx/conf.d/default.conf

COPY ./Nginx/certs/fullchain.pem /etc/nginx/ssl/fullchain.pem
COPY ./Nginx/certs/privetkey.pem /etc/nginx/ssl/privetkey.pem

CMD ["nginx", "-g", "daemon off;"]