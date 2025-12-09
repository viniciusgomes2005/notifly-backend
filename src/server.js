const express = require("express");
const cors = require("cors");
const { envz } = require("./config/envz");
const { usersRoute } = require("./routes/user.routes");
const { chatsRoute } = require("./routes/chat.routes");
const { msgsRoute } = require("./routes/message.routes");
const { authRoute } = require("./routes/auth.routes");
const { tasksRoute } = require("./routes/task.routes");
const { jwtGuard } = require("./middleware/jwt.middleware");

const appSrv = express();

appSrv.use(cors());
appSrv.use(express.json());

appSrv.get("/health", (req, res) => {
  res.json({
    ok: true,
    srv: "notfly-backend",
    env: process.env.NODE_ENV || "dev",
  });
});

appSrv.use("/auth", authRoute);

appSrv.use("/users", jwtGuard, usersRoute);
appSrv.use("/chats", jwtGuard, chatsRoute);
appSrv.use("/messages", jwtGuard, msgsRoute);
appSrv.use("/tasks", jwtGuard, tasksRoute);

const p0rt = envz.PORT || 4000;
appSrv.listen(p0rt, () => {
  console.log(`🚀 NotFly backend ouv1ndo na porta ${p0rt}`);
});
