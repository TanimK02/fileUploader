// Load environment variables from .env during app startup
import express from "express";
import expressSession from 'express-session';
import passport from "passport";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import { PrismaClient } from "@prisma/client";
import userRouter from "./routes/userRoute.js";
import indexRouter from "./routes/indexRoute.js";
import "./config/passport.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
const assetsPath = path.join(__dirname, "public");
app.use(express.static(assetsPath));
app.use(express.urlencoded({ extended: true }));

app.use(
    expressSession({
        cookie: {
            maxAge: 7 * 24 * 60 * 60 * 1000 // ms
        },
        secret: 'a santa at nasa',
        resave: true,
        saveUninitialized: true,
        store: new PrismaSessionStore(
            new PrismaClient(),
            {
                checkPeriod: 2 * 60 * 1000,  //ms
                dbRecordIdIsSessionId: true,
                dbRecordIdFunction: undefined,
            }
        )
    })
);

app.use(passport.initialize())
app.use(passport.session())

const ensureAuthentication = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.redirect("/users/sign-up")
    }
    next()
}

app.use("/users", userRouter)
app.use("/", ensureAuthentication, indexRouter)

app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err.statusCode === 404) {
        res.render("404", { error: err });
    } else {
        res.render("500", { error: err });
    }
});

app.keepAliveTimeout = 61 * 1000;
app.headersTimeout = 65 * 1000;

app.listen(10000, 'localhost', () => {
    console.log("Server is running on http://localhost:10000/users/sign-up");
});