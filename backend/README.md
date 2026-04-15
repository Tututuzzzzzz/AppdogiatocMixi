# HAR Backend (FastAPI)

Production-ready backend for a mobile app that runs activity recognition on-device. This backend handles authentication, activity storage, and analytics.

## Stack

- FastAPI
- Uvicorn
- MongoDB (Motor)
- Pydantic
- JWT authentication

## Project Structure

```text
backend/
  app/
    main.py
    core/
    database/
    models/
    routes/
    schemas/
    services/
  .env.example
  requirements.txt
```

## Run

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Configure environment:

```bash
copy .env.example .env
```

3. Start server:

```bash
uvicorn app.main:app --reload
```

## Run with Docker Compose (MongoDB + API)

1. Optional: create environment file to override defaults:

```bash
copy .env.example .env
```

2. Build and start services:

```bash
docker compose up --build -d
```

3. Check API health:

```bash
curl http://localhost:8000/health
```

4. View logs:

```bash
docker compose logs -f api
```

5. Stop services:

```bash
docker compose down
```

Notes:

- API runs at http://localhost:8000
- MongoDB runs at localhost:27017
- Persistent MongoDB data is stored in the named volume mongo_data
- Docker Compose can run without .env because defaults are embedded in docker-compose.yml

## Main APIs

- `POST /auth/register`
- `POST /auth/login`
- `GET /users/me`
- `POST /activities`
- `GET /activities/history?userId=...`
- `DELETE /activities/history?userId=...&startTimestamp=...&endTimestamp=...`
- `GET /activities/stats?userId=...`

## Notes

- All protected endpoints require `Authorization: Bearer <token>`.
- For activity endpoints, `userId` must match the user from JWT token.
- For deleting by time range, `startTimestamp` and `endTimestamp` are optional epoch milliseconds.
- `CORS_ORIGINS` should be a JSON array string, for example `["http://localhost:8081","http://127.0.0.1:8081","http://localhost:19006","http://127.0.0.1:19006","http://localhost:3000","http://127.0.0.1:3000"]`.
- `confidence` is expected in range `[0, 1]`.
