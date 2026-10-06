docker stop miawrouter
docker rm miawrouter
docker build -t miawrouter .
docker run -d --name miawrouter -p 21128:21128 --env-file .env -v miawrouter-data:/app/data miawrouter