import { describe, expect, it } from "vitest";
import { pgConnectionString } from "@/db/client";

describe("pgConnectionString", () => {
  it("asks for full certificate verification instead of the modes node-postgres will weaken", () => {
    for (const mode of ["prefer", "require", "verify-ca"]) {
      expect(pgConnectionString(`postgres://u:p@host/db?sslmode=${mode}&channel_binding=require`)).toBe(
        "postgres://u:p@host/db?sslmode=verify-full&channel_binding=require",
      );
    }
    expect(pgConnectionString("postgres://u:p@host/db?channel_binding=require&sslmode=require")).toBe(
      "postgres://u:p@host/db?channel_binding=require&sslmode=verify-full",
    );
  });

  it("leaves other connection strings alone", () => {
    for (const url of [
      "postgres://u:p@127.0.0.1:5432/db",
      "postgres://u:p@host/db?sslmode=disable",
      "postgres://u:p@host/db?sslmode=verify-full",
      "postgres://u:p@host/db?application_name=require",
    ]) {
      expect(pgConnectionString(url)).toBe(url);
    }
  });
});
