# Backend Authentication Auditing Payloads

This document outlines the JSON payload structure the frontend sends to the backend for auditing purposes after a user authentication event.

The backend should expose an endpoint (e.g., `/v1/audit/auth`) to receive these `POST` requests. The entire payload object will be encrypted as per the `architecture-overview.md` specification.

## Common Structure

Each event is sent with a main payload object containing the following fields:

- **`eventType`**: (`string`) The type of authentication event. See the list of possible values below.
- **`user`**: (`object`) Information about the user related to the event.
- **`clientInfo`**: (`object`) Information about the client making the request. Captured server-side in the Next.js Action.
- **`timestamp`**: (`string`) ISO 8601 timestamp of when the event occurred.

---

## Event Types and Payloads

The `eventType` field is a string that identifies the specific authentication action being audited. The backend should be prepared to handle various event types as the platform grows.

### `LOGIN_SUCCESS`

This event is triggered after a user successfully signs in.

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
**Field Descriptions:**
- **`user.uid`**: (`string`) The user's unique ID from Firebase Authentication.
- **`user.email`**: (`string`) The user's email address.

---

### `SIGNUP_SUCCESS`

This event is triggered after a new user successfully creates an account and the backend tenant creation is confirmed.

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
**Field Descriptions:**
- **`user.uid`**: (`string`) The new user's unique ID from Firebase Authentication.
- **`user.email`**: (`string`) The new user's email address.
- **`user.name`**: (`string`) The user's full name provided during registration.
- **`user.plan`**: (`string`) The plan selected during registration (`free`, `pro`, or `enterprise`).

---

### `LOGIN_FAILURE`

This event is triggered when a sign-in attempt fails. This is crucial for detecting potential security threats like brute-force attacks.

**Example Payload:**
```json
{
  "eventType": "LOGIN_FAILURE",
  "user": {
    "email": "user@example.com"
  },
  "clientInfo": {
    "ipAddress": "x.x.x.x",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
  },
  "failureReason": "INVALID_CREDENTIAL",
  "timestamp": "2023-10-27T10:08:00.000Z"
}
```
**Field Descriptions:**
- **`user.email`**: (`string`) The email address used in the failed attempt. **DO NOT** include the password.
- **`failureReason`**: (`string`) A code representing the reason for failure (e.g., `INVALID_CREDENTIAL`, `USER_NOT_FOUND`, `ACCOUNT_LOCKED`).

---

### Other Event Types

The following event types should also be considered for auditing. Their payload structure generally follows the patterns above, including `user`, `clientInfo`, and `timestamp`.

- **`LOGOUT`**: Triggered when a user explicitly signs out. The `user` object should contain the `uid` and `email` of the user who signed out.
- **`PASSWORD_RESET_REQUEST`**: Triggered when a user requests a password reset link. The `user` object should contain the `email` to which the reset link was sent.
- **`PASSWORD_CHANGE_SUCCESS`**: Triggered when a logged-in user successfully changes their password from their profile settings. The `user` object should contain the `uid` and `email`.

> **Note:** This list will be expanded as new features like Multi-Factor Authentication (MFA), email verification, and account deletion are implemented.
