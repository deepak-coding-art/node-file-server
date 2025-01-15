# Docker instructions

- Build image

```bash
docker build -t node-file-server .
```

- Start container

```bash
docker run -d --name node-file-server -p 3010:3010 --restart unless-stopped node-file-server
```
