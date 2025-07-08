# Backend Authentication Auditing Payloads

This document outlines the JSON payload structure the frontend sends to the backend for auditing purposes after a successful user authentication event (login or signup).

The backend should expose an endpoint (e.g., `/v1/audit/auth`) to receive these `POST` requests. The entire payload object will be encrypted as per the `architecture-overview.md` specification.

## Common Structure

Each event is sent with a main payload object containing the following fields:

- **`eventType`**: (`string`) The type of authentication event.
- **`user`**: (`object`) Information about the authenticated user.
- **`clientInfo`**: (`object`) Information about the client making the request. Captured server-side in the Next.js Action.
- **`timestamp`**: (`string`) ISO 8601 timestamp of when the event occurred.

---

## Login Event

This event is triggered after a user successfully signs in.

**`eventType`**: `"LOGIN_SUCCESS"`

**Example Payload:**
```json
{
  "eventType": "LOGIN_SUCCESS",
  "user": {
    "uid": "some-firebase-user-uid",
    "email": "user@example.com"
  },
  "clientInfo": {
    "ipAddress": "x.x.x.x",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
  },
  "timestamp": "2023-10-27T10:00:00.000Z"
}
```

### Field Descriptions

- **`user.uid`**: (`string`) The user's unique ID from Firebase Authentication.
- **`user.email`**: (`string`) The user's email address.

---

## Signup Event

This event is triggered after a new user successfully creates an account.

**`eventType`**: `"SIGNUP_SUCCESS"`

**Example Payload:**
```json
{
  "eventType": "SIGNUP_SUCCESS",
  "user": {
    "uid": "new-firebase-user-uid",
    "email": "newuser@example.com",
    "name": "John Doe",
    "plan": "pro"
  },
  "clientInfo": {
    "ipAddress": "x.x.x.x",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
  },
  "timestamp": "2023-10-27T10:05:00.000Z"
}
```

### Field Descriptions

- **`user.uid`**: (`string`) The new user's unique ID from Firebase Authentication.
- **`user.email`**: (`string`) The new user's email address.
- **`user.name`**: (`string`) The user's full name provided during registration.
- **`user.plan`**: (`string`) The plan selected during registration (`free`, `pro`, or `enterprise`).
