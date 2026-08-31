const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const categoriesRouter = require("./routes/categories");
const productsRouter = require("./routes/products");
const ordersRouter = require("./routes/orders");
const peerRouter = require("./routes/peer");
const adminRouter = require("./routes/admin");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan("combined"));

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  // All routes below are served under /store by Nginx (see nginx/merch-store.conf)
  app.use("/categories", categoriesRouter);
  app.use("/products", productsRouter);
  app.use("/orders", ordersRouter);
  app.use("/peer", peerRouter); // exposed for EduCore to consume
  app.use("/admin", adminRouter);

  // Central error handler
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  });

  return app;
}

module.exports = { createApp };
