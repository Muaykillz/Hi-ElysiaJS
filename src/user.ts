import { Elysia, t } from "elysia";

// User services as a duplicated plugin
export const userServices = new Elysia({ name: "user/service" }) // name property สำคัญมากเพื่อลดการสร้าง/เรียกใช้ instance ซ้ำซ้อน
  .state({
    user: {} as Record<string, string>, // <username, password>
    session: {} as Record<number, string>, // <sessionKey, username>
  })
  .model({
    signIn: t.Object({
      username: t.String(),
      password: t.String(),
    }),
    session: t.Cookie(
      {
        token: t.Number(),
      },
      {
        secrets: "seia",
      }
    ),
  })
  .model((model) => ({
    ...model,
    optionalSession: t.Optional(model.session),
  }))
  .macro(({ onBeforeHandle }) => ({
    isSignIn(enabled: boolean) {
      if (!enabled) return;

      onBeforeHandle(({ error, cookie: { token }, store: { session } }) => {
        if (!token.value)
          return error(401, {
            success: false,
            message: "Unauthorized",
          });

        const username = session[token.value as unknown as number]; // type safety

        if (!username)
          return error(401, {
            success: false,
            message: "Unauthorized",
          });
      });
    },
  }));

// Get UserId with resolve
export const getUserId = new Elysia()
  .use(userServices)
  .guard({
    cookie: "session",
  })
  .resolve(({ store: { session }, cookie: { token } }) => ({
    username: session[token.value],
  }))
  .as("plugin");

// User Auth
export const user = new Elysia({ prefix: "/user" })
  .use(userServices)
  // Register
  .post(
    "/sign-up",
    async ({ body: { username, password }, store, error }) => {
      if (store.user[username])
        return error(400, {
          success: false,
          message: "User already exists",
        });

      store.user[username] = await Bun.password.hash(password);

      return {
        success: true,
        message: "User created",
      };
    },
    {
      body: "signIn",
    }
  )
  // Sign-in
  .post(
    "/sign-in",
    async ({
      store: { user, session },
      error,
      body: { username, password },
      cookie: { token },
    }) => {
      // ถ้า username หรือ password ไม่ตรง
      if (
        !user[username] ||
        !(await Bun.password.verify(password, user[username]))
      ) {
        return error(400, {
          success: false,
          message: "Invalid username or password",
        });
      }

      // ถ้าตรง
      const key = crypto.getRandomValues(new Uint32Array(1))[0];
      session[key] = username; // session: {[key(number)]: [username(string)]}
      token.value = key; // เก็บ key ไว้ใน cookie token ของ browser

      return {
        success: true,
        message: `Signed in as ${username}`,
      };
    },
    {
      body: "signIn",
      cookie: "session",
    }
  )
  // Sign-out
  .get(
    "/sign-out",
    ({ cookie: { token } }) => {
      token.remove();

      return {
        success: true,
        message: "Signed out",
      };
    },
    {
      cookie: "optionalSession",
    }
  )
  // Get profile (Only username)
  .use(getUserId)
  .get(
    "/profile",
    ({ username }) => {
      //   const username = session[token.value];

      return {
        success: true,
        message: username,
      };
    },
    {
      isSignIn: true,
    }
  );
