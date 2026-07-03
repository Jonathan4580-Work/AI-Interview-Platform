import { randomBytes } from "node:crypto";

const secrets = [
  "SESSION_SECRET_REF",
  "CSRF_SECRET_REF",
  "TOKEN_PEPPER_SECRET_REF",
  "ENCRYPTION_KEY_SECRET_REF",
] as const;

for (const name of secrets) {
  console.log(
    `${name}=local/${name.toLowerCase().replaceAll("_", "-")}-${randomBytes(32).toString("hex")}`,
  );
}
