# In production

1. Copy swarm folder in your vps
2. run

```shell
cd <path>/swarm

sudo docker swarm init

sudo apt update && sudo apt install -y jq

sudo chmod +x ./rotate_secrets.sh ./deploy.sh

MEMOIZE_TTS_API_KEY=api_key \
MEMOIZE_MONGODB_USERNAME=admin \
MEMOIZE_MONGODB_PASSWORD=password \
MEMOIZE_BUCKET_NAME=name \
MEMOIZE_S3_STORAGE_ENDPOINT=endpoint \
MEMOIZE_S3_STORAGE_ACCESS_KEY=access_key \
MEMOIZE_S3_STORAGE_SECRET_KEY=secret_key \
MEMOIZE_S3_API_KEY=api_key \
./rotate_secrets.sh ./secrets.env

# Because swarm doesn't automatically load .env file, we use compose config instead.
./deploy.sh memoize
```

## Note before running ./deploy.sh

In case compose and env and configuration files have transferred with windows line endings, run:

```bash
sed -i 's/\r$//' ./*.*
sed -i 's/\r$//' ./grafana/dashboards/*.*
sed -i 's/\r$//' ./grafana/provisioning/dashboards/*.*
sed -i 's/\r$//' ./grafana/provisioning/datasources/*.*
sed -i 's/\r$//' ./.env
```
