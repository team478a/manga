import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { pageCanvasSchema } from "@mangai/canvas-core";
import { dialogueInnerRegion } from "../src/modules/manga/domain/dialogue-region.ts";
import { isDialogueTextContainedInBalloon, isDialogueTextLayoutReadable } from "../src/modules/manga/domain/dialogue-placement.ts";

// Explicit, isolated, no-published-port Docker test container only. Never use
// PGHOST/PGPASSWORD or a Supabase environment from the developer machine.
const container = process.argv[process.argv.indexOf("--container") + 1];
assert.ok(process.argv.includes("--container") && /^mangai-c3b-postgres-[a-z0-9-]+$/.test(container), "explicit isolated container required");
const metadata = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8" }))[0];
assert.equal(metadata.Config.Labels["mangai.task"], "c3b-20261012");
assert.equal(Object.keys(metadata.HostConfig.PortBindings ?? {}).length, 0, "test DB must not publish ports");
const database = "manga_c3b_roundtrip";
const query = (sql) => execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-X", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }).trim();
const build = (page, fn = "build_cloud_storyboard_canvas") => JSON.parse(query(`select public.${fn}('00000000-0000-4000-8000-000000000001',1600,2400,'${JSON.stringify(page).replaceAll("'", "''")}'::jsonb);`));

let checks = 0;
const legacy = build({ panels: [{ dialogue: [{ type: "speech", speaker: "A", text: "鍵だ。" }] }] }, "build_cloud_storyboard_canvas_unfitted_v1");
assert.equal(isDialogueTextContainedInBalloon(legacy.textObjects[0], legacy.balloons[0]), false, "prior DB builder reproduces unsafe ellipse frame");
for (const panelCount of [1, 2, 4, 6]) {
  const page = { panels: Array.from({ length: panelCount }, () => ({ dialogue: [
    { type: "speech", speaker: "A", text: "鍵だ。" },
    { type: "thought", speaker: "B", text: "証拠を" },
    { type: "narration", speaker: "語り", text: "夜が明ける。" },
  ] })) };
  const canvas = build(page);
  assert.equal(pageCanvasSchema.safeParse(canvas).success, true, "schema v1 must remain valid");
  assert.equal(canvas.panels.length, panelCount);
  assert.equal(canvas.textObjects.length, panelCount * 3);
  for (const text of canvas.textObjects) {
    const balloon = canvas.balloons.find(item => item.id === text.parentBalloonId);
    const region = dialogueInnerRegion(balloon);
    for (const field of ["x", "y", "width", "height"])
      assert.ok(Math.abs(text[field] - region[field]) < 0.001, `SQL/TS ${field} parity`);
    assert.ok(isDialogueTextContainedInBalloon(text, balloon), "normal fixture must fit the shape");
    assert.ok(isDialogueTextLayoutReadable(text), "short fixture must be readable");
    checks += 1;
  }
}

for (const value of ["｜鍵《かぎ》だ。", "「きゃー、鍵だ。」", "鍵。".repeat(1000), "一行\n二行\n三行"]) {
  const canvas = build({ panels: [{ dialogue: [{ type: "speech", speaker: "A", text: value }] }] });
  const text = canvas.textObjects[0];
  assert.equal(text.text, value, "never truncate dialogue");
  assert.ok(text.fontSize >= 18 && text.fontSize <= 32);
  if (value.length > 1000) {
    assert.equal(isDialogueTextContainedInBalloon(text, canvas.balloons[0]) && isDialogueTextLayoutReadable(text), false, "unfittable text must stay blocked");
  } else if (value.startsWith("｜")) {
    assert.ok(isDialogueTextContainedInBalloon(text, canvas.balloons[0]), "ruby fixture must fit");
  }
  checks += 1;
}

// Replay creates fresh IDs, so compare shape/layout fields, not random UUIDs.
const empty = build({ panels: [{ dialogue: [] }] });
assert.equal(empty.textObjects.length, 0);
assert.equal(empty.balloons.length, 0);
assert.equal(query("select has_function_privilege('authenticated','public.build_cloud_storyboard_canvas(uuid,integer,integer,jsonb)','EXECUTE');"), "f");
assert.equal(query("select has_function_privilege('service_role','public.build_cloud_storyboard_canvas_unfitted_v1(uuid,integer,integer,jsonb)','EXECUTE');"), "f");
console.log(`C3b SQL/TypeScript region checks passed: ${checks} text fixtures, empty page, ACLs.`);
