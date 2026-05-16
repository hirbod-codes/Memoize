# Instructions

## for production

run (with production env values):

```bash
docker build --target production --tag MediaPlayer/backend:latest .

docker run -d \
    -e NODE_ENV=development \
    -e HOST=0.0.0.0 \
    -e PORT=3000 \
    -e ALLOWED_ORIGINS=https://localhost:443 \
    -e DB_DATABASE_NAME=MediaPlayer \
    -e DB_SUPPORTS_TRANSACTION=false \
    -e DB_URL=mongodb://localhost:27017 \
    -e MONGODB_USERNAME=user \
    -e MONGODB_PASSWORD=pass \
    -e JWT_SECRET=very_secret \
    -e ACCESS_TOKEN_SECRET=very_secret \
    -e REFRESH_TOKEN_SECRET=very_secret \
    --network backend_net \
    --name MediaPlayer_backend MediaPlayer/backend-dev:latest

docker run -d \
    -e NODE_ENV=production \
    -e HOST=0.0.0.0 \
    -e PORT=3000 \
    -e ALLOWED_ORIGINS=https://domain.tld \
    -e DB_DATABASE_NAME=MediaPlayer \
    -e DB_SUPPORTS_TRANSACTION=false \
    -e DB_URL=mongodb://mongo:27017 \
    -e MONGODB_USERNAME=user \
    -e MONGODB_PASSWORD=pass \
    -e JWT_SECRET=very_secret \
    -e ACCESS_TOKEN_SECRET=very_secret \
    -e REFRESH_TOKEN_SECRET=very_secret \
    --network backend_net \
    --network db_net \
    --name MediaPlayer_backend MediaPlayer/backend:latest
```

## for HTTPS (necessary for development too, because of modern browsers cookie restrictions)

run (for Windows)

```bash
mkcert.exe -install
mkcert.exe localhost 127.0.0.1 ::1
```

### docker run examples

```bash
docker run -d \
    --name mongo \
    --network mongo_net \
    --restart unless-stopped \
    -p 27017:27017 \
    -e MONGO_INITDB_ROOT_USERNAME=admin \
    -e MONGO_INITDB_ROOT_PASSWORD=strongpassword \
    -v mongo_data:/data/db \
    mongo:8.2.7

docker run -d \
    --name mongo-express \
    --network mongo_net \
    --restart unless-stopped \
    -p 8081:8081 \
    -e ME_CONFIG_MONGODB_ADMINUSERNAME=admin \
    -e ME_CONFIG_MONGODB_ADMINPASSWORD=strongpassword \
    -e ME_CONFIG_MONGODB_SERVER=mongo \
    mongo-express:latest
```
