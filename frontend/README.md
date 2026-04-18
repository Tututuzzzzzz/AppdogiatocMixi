# Human Activity Recognition App (Expo)

This mobile app measures phone acceleration and applies an on-device AI-like classifier to detect human behavior states in real time.

## Features

- Real-time accelerometer stream (x/y/z + magnitude)
- Lightweight inference model for behavior labels:
   - `Walking`
   - `Running`
   - `Going upstairs`
   - `Going downstairs`
   - `Sitting`
   - `Standing`
- User-friendly monitoring dashboard with confidence bars and timeline
- Backend authentication (register/login), profile and health check screens
- Backend analytics screen for `/activities/history` and `/activities/stats`
- Monolithic module organization for easier maintenance and expansion

## Monolithic folder structure

```text
app/
   (tabs)/
      index.tsx                       # Tracking dashboard
      explore.tsx                     # Monolithic architecture view

src/
   modules/
      activity-recognition/
         ai/
            behavior-model.ts           # Feature extraction + classification
         hooks/
            use-activity-monitor.ts     # Sensor + AI orchestration
         sensor/
            accelerometer-stream.ts     # Expo accelerometer adapter
         types.ts                      # Shared domain types
```

## Run the app

1. Install dependencies

```bash
npm install
```

2. Start Expo

```bash
npm run start
```

3. Open on Android, iOS, or web from the Expo terminal

## Backend sync for history persistence

Session history is now synced to backend so data remains after app restart.

Create `.env` (or `.env.local`) in `frontend`:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

Notes:

- Android emulator can use `http://10.0.2.2:8000`.
- Physical device should use your PC LAN IP, for example `http://192.168.1.10:8000`.
- Start backend before running app to enable auth, activity sync, and analytics.

## How the inference works

The app prefers the bundled TensorFlow Lite model when it loads successfully; otherwise it falls back to a small embedded centroid classifier:

1. Collect a rolling window of accelerometer samples.
2. Extract motion features (`mean`, `std`, `peak-to-peak`, `delta`, `energy`).
3. Try the on-device TFLite model first.
4. If TFLite is unavailable, compare features against class centroids.
5. Convert similarity into probabilities and choose the top class.

This keeps inference simple, fast, and offline-friendly. You can later replace it with a TensorFlow Lite model trained on your own dataset.
