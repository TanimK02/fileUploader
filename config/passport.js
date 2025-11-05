import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import prisma from "../prisma.js";

passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const user = await prisma.user.findUnique({
                where: {
                    username: username
                }
            })
            if (!user) {
                return done(null, false)
            }
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return done(null, false)
            }
            return done(null, { id: user.id, username: user.username })
        }
        catch (err) {
            return done(err)
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id)
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: id
            }
        })
        if (!user) {
            return done(new Error("User not found."))
        }
        done(null, { id: user.id, username: user.username })
    }
    catch (err) {
        done(err)
    }
});