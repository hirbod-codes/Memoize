# Instructions

## for production using Nginx

## for production using vite

run (with production env values):

```bash
docker build --target production --tag ViteWebServer:latest .

docker run -p 3000:3000 \
-e NODE_ENV=production \
-e VITE_API_URL=https://localhost:3000 \
-d --name ViteWebServer web_server:latest
```

## for HTTPS (necessary for development too, because of modern browsers cookie restrictions)

run (for Windows)

```bash
mkcert.exe -install
mkcert.exe localhost 127.0.0.1 ::1
```

## To Do

1. Have contents visible when editing vertically.
2. Make contents sharable between leafs.
