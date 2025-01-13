# Docker instructions

- Build image

```bash
docker build -t file-server .
```

- Start container

```bash
docker run -d --name file-server -p 3010:3010 file-server
```
