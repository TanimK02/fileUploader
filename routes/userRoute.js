import { Router } from "express";
import { body, validationResult } from "express-validator";
import prisma from "../prisma.js";
import passport from "passport";
import bcrypt from "bcrypt";
import { name } from "ejs";
const userRouter = Router();

const ensureGuest = (req, res, next) => {
    if (req.isAuthenticated()) {
        return res.redirect("/home")
    }
    next()
}
userRouter.get("/sign-up", ensureGuest, (req, res) => {
    res.render("signUpForm")
})

userRouter.post("/sign-up", ensureGuest, [
    body("username").isLength({
        min: 3,
        max: 16
    }).trim().escape().withMessage("Username must be bewteen 3-16 characters."),
    body("password").isLength({
        min: 8,
        max: 60
    }).trim().escape().withMessage("Password must be bewteen 8-20 characters."),

], async (req, res, next) => {
    const result = validationResult(req);
    if (!result.isEmpty()) {
        return res.status(400).render("signUpForm", {
            errors: result.array()
        })
    }
    try {
        const user = await prisma.user.findUnique({
            where: {
                username: req.body.username
            }
        })
        if (user) {
            return res.status(400).render("signUpForm", {
                errors: [{ path: "username", msg: "Username already taken" }]
            });
        }

    }
    catch (err) {
        return next(err)
    }
    try {
        const password = await bcrypt.hash(req.body.password, 10);
        const user = await prisma.user.create({
            data: {
                username: req.body.username,
                password: password,
            },
            select: {
                id: true,
                username: true
            }
        })
        const rootFolder = await prisma.folder.create({
            data: {
                name: "home",
                userId: user.id,
                parentId: null
            }
        })
        req.login(user, (err) => {
            if (err) return next(err);
            res.redirect("/home");
        })
    }
    catch (err) {
        return next(err)
    }
})

userRouter.get("/login", ensureGuest, (req, res) => {
    res.render("loginForm");
});

userRouter.post("/login", ensureGuest,
    [
        body("username")
            .trim()
            .escape()
            .notEmpty()
            .withMessage("Username is required"),

        body("password")
            .trim()
            .notEmpty()
            .withMessage("Password is required")
    ],
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next()
    },
    passport.authenticate("local", {
        failureRedirect: "/users/login",
        successRedirect: "/home"
    }));

const ensureNotGuest = (req, res, next) => {
    if (!req.isAuthenticated()) {
        res.redirect("/users/login")
    }
    next()
}

userRouter.get("/logout", ensureNotGuest, (req, res) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect("/users/login")
    });

})

export default userRouter;