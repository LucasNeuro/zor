import { describe, expect, it } from "vitest";
import { deleteUazapiInstanceRemotely } from "./uazapi-delete-instance";

describe("deleteUazapiInstanceRemotely", () => {
  it("skips when token is empty", async () => {
    const r = await deleteUazapiInstanceRemotely(null);
    expect(r).toEqual({ ok: true, deleted: false });
  });
});
