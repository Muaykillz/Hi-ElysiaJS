import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { opentelemetry } from "@elysiajs/opentelemetry";
import { note } from "./note";
import { user } from "./user";

const app = new Elysia()
  .use(opentelemetry())
  .use(swagger())
  .onError(({ error, code }) => {
    // ต้องประกาศ error handler ให้กับทุก route ก่อน
    if (code === "NOT_FOUND") return "Not Found :(";

    console.error(error);
  })
  .use(user)
  .use(note)
  .listen(3000);
