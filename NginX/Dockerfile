FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/nginx.conf

COPY build/memoize /usr/share/nginx/html/memoize

COPY nginx/certs /etc/nginx/certs

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]