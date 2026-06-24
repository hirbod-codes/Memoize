# Instructions

## for production

run (with production env values):

```bash
docker build --target production --tag Memoize/backend:latest .

docker run -d \
    -e NODE_ENV=development \
    -e HOST=0.0.0.0 \
    -e PORT=3000 \
    -e ALLOWED_ORIGINS=https://localhost:443 \
    -e DB_DATABASE_NAME=Memoize \
    -e DB_SUPPORTS_TRANSACTION=false \
    -e DB_URL=mongodb://localhost:27017 \
    -e MONGODB_USERNAME=user \
    -e MONGODB_PASSWORD=pass \
    -e MEILISEARCH_KEY=very_secret \
    -e MEILISEARCH_HOST=localhost \
    -e MEILISEARCH_PORT=7700 \
    -e ACCESS_TOKEN_SECRET=very_secret \
    -e REFRESH_TOKEN_SECRET=very_secret \
    --network backend_net \
    --restart unless-stopped \
    --shm-size=1g
    --name memoize_backend Memoize/backend-dev:latest

docker run -d \
    -e NODE_ENV=production \
    -e HOST=0.0.0.0 \
    -e PORT=3000 \
    -e ALLOWED_ORIGINS=https://domain.tld \
    -e DB_DATABASE_NAME=Memoize \
    -e DB_SUPPORTS_TRANSACTION=false \
    -e DB_URL=mongodb://mongo:27017 \
    -e MONGODB_USERNAME=user \
    -e MONGODB_PASSWORD=pass \
    -e MEILISEARCH_KEY=very_secret \
    -e MEILISEARCH_HOST=localhost \
    -e MEILISEARCH_PORT=7700 \
    -e ACCESS_TOKEN_SECRET=very_secret \
    -e REFRESH_TOKEN_SECRET=very_secret \
    --network backend_net \
    --network db_net \
    --restart unless-stopped \
    --shm-size=1g
    --name memoize_backend Memoize/backend:latest
```

## for HTTPS (necessary for development too, because of modern browsers cookie restrictions)

### Make sure you run install command, if you haven't already

run (for Windows)

```bash
mkcert.exe -install
mkcert.exe localhost 127.0.0.1 ::1
```

### docker run examples

```bash
docker run -d \
    --name mongo \
    --network db_net \
    --restart unless-stopped \
    -p 27017:27017 \
    -e MONGO_INITDB_ROOT_USERNAME=admin \
    -e MONGO_INITDB_ROOT_PASSWORD=strongpassword \
    -v mongo_data:/data/db \
    mongo:8.2.7

docker run -d \
    --name mongo-express \
    --network db_net \
    --restart unless-stopped \
    -p 8081:8081 \
    -e ME_CONFIG_MONGODB_ADMINUSERNAME=admin \
    -e ME_CONFIG_MONGODB_ADMINPASSWORD=strongpassword \
    -e ME_CONFIG_MONGODB_SERVER=mongo \
    mongo-express:latest

docker run -d \
    --name meilisearch \
    --network db_net \
    -p 7700:7700 \
    -e MEILI_MASTER_KEY=supersecret \
    -e MEILI_NO_ANALYTICS=true \
    getmeili/meilisearch:v1
```

```bash
openssl rand -base64 64
```

## how to commit

feat: add authentication
fix: refresh token rotation
feat!: change API format

Apparently github action doesn't realize new versions when squashing commits when merging.
